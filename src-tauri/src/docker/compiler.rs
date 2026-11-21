//! Provisioning and isolation checks for the BatchGrade C++ toolchain.

#[cfg(debug_assertions)]
mod local;
mod runner;
pub(crate) use runner::{CppRunResult, compile_and_run};

use std::collections::HashMap;
use std::time::Duration;

use bollard::Docker;
use bollard::errors::Error as DockerError;
use bollard::models::{
    ContainerCreateBody, ContainerInspectResponse, HostConfig, HostConfigCgroupnsModeEnum,
    HostConfigLogConfig, ImageInspect, RestartPolicy, RestartPolicyNameEnum, SystemInfo,
};
use bollard::query_parameters::{
    CreateContainerOptions, CreateImageOptions, InspectContainerOptions, RemoveContainerOptions,
    StartContainerOptions, WaitContainerOptions,
};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;
use uuid::Uuid;

const REPOSITORY: &str = "ghcr.io/batchgradeteam/batchgrade-cpp-compiler";
const IMAGE_DIGESTS: &str = include_str!("../../../docker/cpp/image-digests.json");
const USER: &str = "65534:65534";
const CONTAINER_LABEL: &str = "org.batchgrade.cpp.job";
const NO_NEW_PRIVILEGES: &str = "no-new-privileges=true";
const MEMORY: i64 = 1024 * 1024 * 1024;
const CPU_PERIOD: i64 = 100_000;
const PIDS: i64 = 64;
const SHM_SIZE: i64 = 8 * 1024 * 1024;
const PULL_TIMEOUT: Duration = Duration::from_secs(600);
const PROBE_WAIT: Duration = Duration::from_secs(20);
const PROBE_COMMAND: &[&str] = &["--signal=KILL", "15s", "/usr/bin/g++-14", "--version"];
static OPERATION: Mutex<()> = Mutex::const_new(());

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum CppEnvironmentStatus {
    Ready,
    ImageMissing,
    #[cfg(debug_assertions)]
    LocalImageMissing,
    Unsupported {
        detail: String,
    },
    Error {
        detail: String,
    },
}

impl CppEnvironmentStatus {
    fn error(detail: impl Into<String>) -> Self {
        Self::Error {
            detail: detail.into(),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Architecture {
    Amd64,
    Arm64,
}

impl Architecture {
    fn oci_name(self) -> &'static str {
        match self {
            Self::Amd64 => "amd64",
            Self::Arm64 => "arm64",
        }
    }

    fn platform(self) -> String {
        format!("linux/{}", self.oci_name())
    }
}

#[derive(Deserialize)]
struct ImageDigests {
    amd64: Option<String>,
    arm64: Option<String>,
}

fn image_reference(digests: &str, architecture: Architecture) -> Result<Option<String>, String> {
    let digests: ImageDigests =
        serde_json::from_str(digests).map_err(|_| "The compiler image pins are invalid.")?;
    let digest = match architecture {
        Architecture::Amd64 => digests.amd64,
        Architecture::Arm64 => digests.arm64,
    };
    let Some(digest) = digest else {
        return Ok(None);
    };
    if !is_sha256_digest(&digest) {
        return Err("The compiler image digest is invalid.".into());
    }
    Ok(Some(format!("{REPOSITORY}@{digest}")))
}

fn is_sha256_digest(value: &str) -> bool {
    value.strip_prefix("sha256:").is_some_and(|hex| {
        hex.len() == 64
            && hex
                .bytes()
                .all(|byte| matches!(byte, b'0'..=b'9' | b'a'..=b'f'))
    })
}

pub(super) async fn check(provision: bool) -> CppEnvironmentStatus {
    // Finishing this task independently of the invoke keeps cleanup running if its caller leaves.
    tauri::async_runtime::spawn(async move {
        let _operation = OPERATION.lock().await;
        readiness(provision).await.unwrap_or_else(|status| status)
    })
    .await
    .unwrap_or_else(|_| {
        CppEnvironmentStatus::error("The compiler setup task stopped unexpectedly.")
    })
}

async fn selected_engine() -> Result<(Docker, String), String> {
    let cli = super::cli::find_docker_cli_from_env();
    let hosts = super::selected_hosts(cli.as_deref()).await?;
    super::engine::connect_engine(&hosts)
        .await
        .map(|(docker, _, host)| (docker, host.to_owned()))
        .map_err(|probe| match probe {
            super::engine::EngineProbe::Failed(detail) => detail,
            _ => "The selected Docker Engine is unavailable. Start Docker and refresh.".into(),
        })
}

async fn readiness(provision: bool) -> Result<CppEnvironmentStatus, CppEnvironmentStatus> {
    let (docker, _host) = selected_engine()
        .await
        .map_err(CppEnvironmentStatus::error)?;
    let info = docker.info().await.map_err(|error| {
        CppEnvironmentStatus::error(format!("Could not inspect Docker: {error}"))
    })?;
    let architecture =
        capabilities(&info).map_err(|detail| CppEnvironmentStatus::Unsupported { detail })?;
    if let Some(reference) =
        image_reference(IMAGE_DIGESTS, architecture).map_err(CppEnvironmentStatus::error)?
    {
        return check_image(&docker, &reference, architecture, provision)
            .await
            .map_err(CppEnvironmentStatus::error);
    }

    #[cfg(debug_assertions)]
    {
        local::check(&docker, &_host, architecture, provision)
            .await
            .map_err(CppEnvironmentStatus::error)
    }
    #[cfg(not(debug_assertions))]
    Err(CppEnvironmentStatus::error(
        "A compiler image has not been published for this BatchGrade build.",
    ))
}

fn capabilities(info: &SystemInfo) -> Result<Architecture, String> {
    if info.os_type.as_deref() != Some("linux") {
        return Err("Switch Docker to Linux containers to use the C++ compiler.".into());
    }
    let architecture = match info.architecture.as_deref() {
        Some("x86_64" | "amd64") => Architecture::Amd64,
        Some("aarch64" | "arm64") => Architecture::Arm64,
        _ => return Err("The C++ compiler requires an AMD64 or ARM64 Linux Docker Engine.".into()),
    };

    let mut missing = Vec::new();
    for (available, name) in [
        (info.memory_limit, "memory limits"),
        (info.swap_limit, "swap limits"),
        (info.cpu_cfs_period, "CPU periods"),
        (info.cpu_cfs_quota, "CPU quotas"),
        (info.pids_limit, "process limits"),
    ] {
        if available != Some(true) {
            missing.push(name);
        }
    }
    let default_seccomp = info.security_options.iter().flatten().any(|option| {
        let mut fields = option.split(',');
        fields.next() == Some("name=seccomp")
            && fields.any(|field| matches!(field, "profile=builtin" | "profile=default"))
    });
    if !default_seccomp {
        missing.push("the default seccomp profile");
    }
    if missing.is_empty() {
        Ok(architecture)
    } else {
        Err(format!(
            "Docker does not report support for {}.",
            missing.join(", ")
        ))
    }
}

fn is_missing(error: &DockerError) -> bool {
    matches!(
        error,
        DockerError::DockerResponseServerError {
            status_code: 404,
            ..
        }
    )
}

fn verify_image(
    image: &ImageInspect,
    reference: &str,
    architecture: Architecture,
) -> Result<(), String> {
    if matches_platform(image, architecture)
        && image
            .repo_digests
            .iter()
            .flatten()
            .any(|digest| digest == reference)
    {
        Ok(())
    } else {
        Err("Docker returned a compiler image with an unexpected digest or platform.".into())
    }
}

fn matches_platform(image: &ImageInspect, architecture: Architecture) -> bool {
    image.os.as_deref() == Some("linux")
        && image.architecture.as_deref() == Some(architecture.oci_name())
}

async fn check_image(
    docker: &Docker,
    reference: &str,
    architecture: Architecture,
    download: bool,
) -> Result<CppEnvironmentStatus, String> {
    let image = match docker.inspect_image(reference).await {
        Ok(image) => image,
        Err(error) if is_missing(&error) && !download => {
            return Ok(CppEnvironmentStatus::ImageMissing);
        }
        Err(error) if is_missing(&error) => {
            pull_image(docker, reference, architecture).await?;
            docker.inspect_image(reference).await.map_err(|error| {
                format!("Could not verify the downloaded compiler image: {error}")
            })?
        }
        Err(error) => return Err(format!("Could not inspect the compiler image: {error}")),
    };
    verify_image(&image, reference, architecture)?;
    run_probe(docker, architecture, probe_config(reference)).await?;
    Ok(CppEnvironmentStatus::Ready)
}

async fn pull_image(
    docker: &Docker,
    reference: &str,
    architecture: Architecture,
) -> Result<(), String> {
    let docker = docker.clone().with_timeout(PULL_TIMEOUT);
    let options = CreateImageOptions {
        from_image: Some(reference.to_owned()),
        platform: architecture.platform(),
        ..Default::default()
    };
    tokio::time::timeout(PULL_TIMEOUT, async {
        let mut events = docker.create_image(Some(options), None, None);
        while let Some(event) = events.next().await {
            let event =
                event.map_err(|error| format!("Could not download the compiler image: {error}"))?;
            if event.error_detail.is_some() {
                return Err("Docker reported an error downloading the compiler image.".into());
            }
        }
        Ok(())
    })
    .await
    .map_err(|_| "The compiler download exceeded 10 minutes. Refresh before retrying.")?
}

fn probe_config(reference: &str) -> ContainerCreateBody {
    ContainerCreateBody {
        image: Some(reference.into()),
        user: Some(USER.into()),
        entrypoint: Some(vec!["/usr/bin/timeout".into()]),
        cmd: Some(
            PROBE_COMMAND
                .iter()
                .map(|argument| (*argument).to_owned())
                .collect(),
        ),
        host_config: Some(HostConfig {
            network_mode: Some("none".into()),
            ipc_mode: Some("private".into()),
            cgroupns_mode: Some(HostConfigCgroupnsModeEnum::PRIVATE),
            privileged: Some(false),
            readonly_rootfs: Some(true),
            cap_drop: Some(vec!["ALL".into()]),
            security_opt: Some(vec![NO_NEW_PRIVILEGES.into()]),
            tmpfs: Some(HashMap::from([(
                "/tmp".into(),
                "rw,noexec,nosuid,nodev,size=32m,mode=1777".into(),
            )])),
            memory: Some(MEMORY),
            memory_swap: Some(MEMORY),
            cpu_period: Some(CPU_PERIOD),
            cpu_quota: Some(CPU_PERIOD),
            pids_limit: Some(PIDS),
            shm_size: Some(SHM_SIZE),
            restart_policy: Some(RestartPolicy {
                name: Some(RestartPolicyNameEnum::NO),
                ..Default::default()
            }),
            log_config: Some(HostConfigLogConfig {
                typ: Some("none".into()),
                ..Default::default()
            }),
            ..Default::default()
        }),
        ..Default::default()
    }
}

fn verify_sandbox(
    actual: &ContainerInspectResponse,
    expected: &ContainerCreateBody,
) -> Result<(), String> {
    let mismatch = || "Docker did not apply the required container isolation settings.".to_owned();
    let config = actual.config.as_ref().ok_or_else(mismatch)?;
    let host = actual.host_config.as_ref().ok_or_else(mismatch)?;
    let required = expected.host_config.as_ref().ok_or_else(mismatch)?;
    if config.user != expected.user
        || config.entrypoint != expected.entrypoint
        || config.cmd != expected.cmd
        || config.open_stdin.unwrap_or_default() != expected.open_stdin.unwrap_or_default()
        || config.stdin_once.unwrap_or_default() != expected.stdin_once.unwrap_or_default()
        || config.tty == Some(true)
        || expected.labels.iter().flatten().any(|(key, value)| {
            config.labels.as_ref().and_then(|labels| labels.get(key)) != Some(value)
        })
        || config.volumes.iter().any(|volumes| !volumes.is_empty())
        || host.network_mode != required.network_mode
        || host.ipc_mode != required.ipc_mode
        || host.cgroupns_mode != required.cgroupns_mode
        || host.pid_mode.as_deref() == Some("host")
        || host.uts_mode.as_deref() == Some("host")
        || host.userns_mode.as_deref() == Some("host")
        || host.privileged != required.privileged
        || host.readonly_rootfs != required.readonly_rootfs
        || host.cap_drop != required.cap_drop
        || host.security_opt != required.security_opt
        || host.tmpfs != required.tmpfs
        || host.memory != required.memory
        || host.memory_swap != required.memory_swap
        || host.cpu_period != required.cpu_period
        || host.cpu_quota != required.cpu_quota
        || host.pids_limit != required.pids_limit
        || host.shm_size != required.shm_size
        || host.restart_policy.as_ref().and_then(|policy| policy.name)
            != Some(RestartPolicyNameEnum::NO)
        || host.log_config.as_ref().and_then(|log| log.typ.as_deref()) != Some("none")
        || host.publish_all_ports == Some(true)
        || host.auto_remove == Some(true)
        || host.binds.iter().flatten().next().is_some()
        || host.mounts.iter().flatten().next().is_some()
        || host.volumes_from.iter().flatten().next().is_some()
        || host.cap_add.iter().flatten().next().is_some()
        || host.devices.iter().flatten().next().is_some()
        || host.device_requests.iter().flatten().next().is_some()
        || host.device_cgroup_rules.iter().flatten().next().is_some()
        || host.port_bindings.iter().any(|ports| !ports.is_empty())
        || actual.mounts.iter().flatten().any(|mount| {
            mount.typ.as_deref() != Some("tmpfs") || mount.destination.as_deref() != Some("/tmp")
        })
    {
        return Err(mismatch());
    }
    Ok(())
}

async fn run_probe(
    docker: &Docker,
    architecture: Architecture,
    config: ContainerCreateBody,
) -> Result<(), String> {
    with_container(docker, architecture, config, "probe", start_probe).await
}

async fn with_container<T>(
    docker: &Docker,
    architecture: Architecture,
    mut config: ContainerCreateBody,
    stage: &str,
    run: impl AsyncFnOnce(&Docker, &str) -> Result<T, String>,
) -> Result<T, String> {
    let token = Uuid::new_v4().to_string();
    let name = format!("batchgrade-cpp-{stage}-{token}");
    config.labels = Some(HashMap::from([(CONTAINER_LABEL.into(), token.clone())]));
    let options = CreateContainerOptions {
        name: Some(name.clone()),
        platform: architecture.platform(),
    };
    let created = docker.create_container(Some(options), config.clone()).await;
    let (result, cleanup) = match created {
        Ok(container) if !container.id.is_empty() => {
            let id = container.id;
            let result = async {
                if container.warnings.iter().any(|warning| !warning.is_empty()) {
                    return Err(format!(
                        "Docker warned about the {stage} container: {}",
                        container.warnings.join("; ")
                    ));
                }
                let inspected = docker
                    .inspect_container(&id, None::<InspectContainerOptions>)
                    .await
                    .map_err(|error| format!("Could not inspect the {stage} container: {error}"))?;
                verify_sandbox(&inspected, &config)?;
                run(docker, &id).await
            }
            .await;
            (result, remove_container(docker, &id).await)
        }
        result => {
            let detail = result.err().map_or_else(
                || "Docker returned an empty container ID.".into(),
                |error| error.to_string(),
            );
            (
                Err(format!("Could not create the {stage} container: {detail}")),
                recover_container(docker, &name, &token).await,
            )
        }
    };
    match (result, cleanup) {
        (result, Ok(())) => result,
        (result, Err(cleanup)) => Err(match result {
            Ok(_) => format!("Could not clean up container {name}: {cleanup}"),
            Err(error) => format!("{error} Could not clean up container {name}: {cleanup}"),
        }),
    }
}

async fn start_probe(docker: &Docker, id: &str) -> Result<(), String> {
    docker
        .start_container(id, None::<StartContainerOptions>)
        .await
        .map_err(|error| format!("Could not start the compiler probe: {error}"))?;
    let docker = docker.clone().with_timeout(PROBE_WAIT);
    let mut wait = docker.wait_container(id, None::<WaitContainerOptions>);
    match tokio::time::timeout(PROBE_WAIT, wait.next()).await {
        Ok(Some(Ok(result))) if result.status_code == 0 && result.error.is_none() => Ok(()),
        Ok(Some(Err(error))) => Err(format!("The compiler probe failed: {error}")),
        Ok(Some(Ok(result))) => Err(format!(
            "The compiler probe exited with status {}.",
            result.status_code
        )),
        Ok(None) => Err("Docker did not report the compiler probe exit status.".into()),
        Err(_) => Err("The compiler probe exceeded its deadline.".into()),
    }
}

async fn remove_container(docker: &Docker, id: &str) -> Result<(), String> {
    let options = RemoveContainerOptions {
        force: true,
        v: true,
        ..Default::default()
    };
    match docker.remove_container(id, Some(options.clone())).await {
        Ok(()) => Ok(()),
        Err(error) if is_missing(&error) => Ok(()),
        Err(_) => {
            tokio::time::sleep(Duration::from_millis(250)).await;
            match docker.remove_container(id, Some(options)).await {
                Ok(()) => Ok(()),
                Err(error) if is_missing(&error) => Ok(()),
                Err(error) => Err(error.to_string()),
            }
        }
    }
}

async fn recover_container(docker: &Docker, name: &str, token: &str) -> Result<(), String> {
    for _ in 0..3 {
        match docker
            .inspect_container(name, None::<InspectContainerOptions>)
            .await
        {
            Ok(container) => {
                let owner = container
                    .config
                    .and_then(|config| config.labels)
                    .and_then(|mut labels| labels.remove(CONTAINER_LABEL));
                if owner.as_deref() != Some(token) {
                    return Err("the container ownership label did not match".into());
                }
                let id = container.id.ok_or("Docker did not return a container ID")?;
                return remove_container(docker, &id).await;
            }
            Err(error) if is_missing(&error) => (),
            Err(error) => return Err(error.to_string()),
        }
        tokio::time::sleep(Duration::from_millis(250)).await;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use bollard::models::ContainerConfig;
    use bollard::query_parameters::ListContainersOptions;
    use serde_json::json;

    const AMD64_DIGEST: &str =
        "sha256:0000000000000000000000000000000000000000000000000000000000000000";
    const ARM64_DIGEST: &str =
        "sha256:1111111111111111111111111111111111111111111111111111111111111111";

    fn linux_engine() -> SystemInfo {
        SystemInfo {
            os_type: Some("linux".into()),
            architecture: Some("x86_64".into()),
            memory_limit: Some(true),
            swap_limit: Some(true),
            cpu_cfs_period: Some(true),
            cpu_cfs_quota: Some(true),
            pids_limit: Some(true),
            security_options: Some(vec!["name=seccomp,profile=builtin".into()]),
            ..Default::default()
        }
    }

    #[test]
    fn selects_native_linux_platform_and_requires_reported_limits() {
        let mut info = linux_engine();
        assert_eq!(capabilities(&info), Ok(Architecture::Amd64));
        info.architecture = Some("aarch64".into());
        assert_eq!(capabilities(&info), Ok(Architecture::Arm64));
        info.memory_limit = None;
        info.swap_limit = Some(false);
        info.cpu_cfs_period = None;
        info.cpu_cfs_quota = Some(false);
        info.pids_limit = None;
        info.security_options = Some(vec!["name=seccomp,profile=custom".into()]);
        let detail = capabilities(&info).unwrap_err();
        for requirement in [
            "memory",
            "swap",
            "CPU periods",
            "CPU quotas",
            "process",
            "seccomp",
        ] {
            assert!(detail.contains(requirement), "{detail}");
        }

        info.architecture = Some("ppc64le".into());
        assert!(capabilities(&info).unwrap_err().contains("AMD64 or ARM64"));
        info.os_type = Some("windows".into());
        assert!(
            capabilities(&info)
                .unwrap_err()
                .contains("Linux containers")
        );
    }

    #[test]
    fn selects_published_pins_and_distinguishes_unreleased_images() {
        let digests = json!({ "amd64": AMD64_DIGEST, "arm64": ARM64_DIGEST }).to_string();
        for (arch, digest) in [
            (Architecture::Amd64, AMD64_DIGEST),
            (Architecture::Arm64, ARM64_DIGEST),
        ] {
            assert_eq!(
                image_reference(&digests, arch).unwrap(),
                Some(format!("{REPOSITORY}@{digest}"))
            );
        }
        assert_eq!(
            image_reference(r#"{"amd64":null,"arm64":null}"#, Architecture::Amd64).unwrap(),
            None
        );
        assert!(image_reference(r#"{"amd64":"latest"}"#, Architecture::Amd64).is_err());
        assert!(is_sha256_digest(AMD64_DIGEST));
        assert!(!is_sha256_digest("batchgrade-cpp:dev"));
        assert!(!is_sha256_digest("sha256:0011"));
    }

    #[test]
    fn requires_both_the_pinned_digest_and_platform() {
        let reference = format!("{REPOSITORY}@{AMD64_DIGEST}");
        let mut image = ImageInspect {
            os: Some("linux".into()),
            architecture: Some("amd64".into()),
            repo_digests: Some(vec![reference.clone()]),
            ..Default::default()
        };
        assert!(verify_image(&image, &reference, Architecture::Amd64).is_ok());
        assert!(verify_image(&image, &reference, Architecture::Arm64).is_err());
        image.repo_digests = Some(vec![format!("{REPOSITORY}@{ARM64_DIGEST}")]);
        assert!(verify_image(&image, &reference, Architecture::Amd64).is_err());
    }

    #[test]
    fn only_a_not_found_response_marks_an_image_missing() {
        for status_code in [403, 404, 500] {
            let error = DockerError::DockerResponseServerError {
                status_code,
                message: String::new(),
            };
            assert_eq!(is_missing(&error), status_code == 404);
        }
        assert!(!is_missing(&DockerError::RequestTimeoutError));
    }

    #[test]
    fn serializes_compiler_status_for_the_frontend() {
        let to_json = |status| serde_json::to_value(status).unwrap();
        assert_eq!(
            to_json(CppEnvironmentStatus::Ready),
            json!({ "status": "ready" })
        );
        assert_eq!(
            to_json(CppEnvironmentStatus::ImageMissing),
            json!({ "status": "imageMissing" })
        );
        #[cfg(debug_assertions)]
        assert_eq!(
            to_json(CppEnvironmentStatus::LocalImageMissing),
            json!({ "status": "localImageMissing" })
        );
        assert_eq!(
            to_json(CppEnvironmentStatus::Unsupported {
                detail: "Linux required.".into()
            }),
            json!({ "status": "unsupported", "detail": "Linux required." })
        );
        assert_eq!(
            to_json(CppEnvironmentStatus::error("Download failed.")),
            json!({ "status": "error", "detail": "Download failed." })
        );
    }

    #[test]
    fn rejects_weakened_container_settings_before_start() {
        let expected = probe_config("compiler");
        assert_eq!(expected.user.as_deref(), Some("65534:65534"));
        let mut actual = ContainerInspectResponse {
            config: Some(ContainerConfig {
                user: expected.user.clone(),
                cmd: expected.cmd.clone(),
                entrypoint: expected.entrypoint.clone(),
                ..Default::default()
            }),
            host_config: expected.host_config.clone(),
            ..Default::default()
        };
        assert!(verify_sandbox(&actual, &expected).is_ok());

        for insecure in [
            HostConfig {
                memory: Some(0),
                ..expected.host_config.clone().unwrap()
            },
            HostConfig {
                network_mode: Some("host".into()),
                ..expected.host_config.clone().unwrap()
            },
            HostConfig {
                security_opt: Some(vec!["seccomp=unconfined".into()]),
                ..expected.host_config.clone().unwrap()
            },
            HostConfig {
                binds: Some(vec!["/test:/test".into()]),
                ..expected.host_config.clone().unwrap()
            },
        ] {
            actual.host_config = Some(insecure);
            assert!(verify_sandbox(&actual, &expected).is_err());
        }
    }

    pub(super) async fn owned_containers(docker: &Docker) -> std::collections::BTreeSet<String> {
        let options = ListContainersOptions {
            all: true,
            filters: Some(HashMap::from([(
                "label".into(),
                vec![CONTAINER_LABEL.into()],
            )])),
            ..Default::default()
        };
        docker
            .list_containers(Some(options))
            .await
            .unwrap()
            .into_iter()
            .filter_map(|container| container.id)
            .collect()
    }

    #[cfg(debug_assertions)]
    #[test]
    #[ignore = "requires a local compiler image pinned in docker/cpp/compiler-image.local"]
    fn cpp_development_readiness_real_docker() {
        tauri::async_runtime::block_on(async {
            assert_eq!(check(false).await, CppEnvironmentStatus::Ready);
        });
    }

    #[cfg(debug_assertions)]
    #[test]
    #[ignore = "builds and pins the compiler image on a Linux Docker Engine"]
    fn cpp_development_setup_real_docker() {
        tauri::async_runtime::block_on(async {
            assert_eq!(check(false).await, CppEnvironmentStatus::LocalImageMissing);
            assert_eq!(check(true).await, CppEnvironmentStatus::Ready);
            assert_eq!(check(false).await, CppEnvironmentStatus::Ready);
        });
    }

    #[test]
    #[ignore = "requires a Linux Docker Engine and a built or published compiler image"]
    fn cpp_environment_real_docker() {
        tauri::async_runtime::block_on(async {
            let (docker, _) = selected_engine().await.unwrap();
            let architecture = capabilities(&docker.info().await.unwrap()).unwrap();
            let before = owned_containers(&docker).await;
            let reference = if let Ok(local_image) = std::env::var("BATCHGRADE_TEST_COMPILER_IMAGE")
            {
                run_probe(&docker, architecture, probe_config(&local_image))
                    .await
                    .unwrap();
                local_image
            } else {
                let published = image_reference(IMAGE_DIGESTS, architecture)
                    .unwrap()
                    .expect("Add the published image digest before testing a release pull");
                assert_eq!(
                    check_image(&docker, &published, architecture, false)
                        .await
                        .unwrap(),
                    CppEnvironmentStatus::ImageMissing,
                    "Use a clean disposable daemon with the compiler image absent"
                );
                assert_eq!(
                    check_image(&docker, &published, architecture, true)
                        .await
                        .unwrap(),
                    CppEnvironmentStatus::Ready
                );
                assert_eq!(
                    check_image(&docker, &published, architecture, false)
                        .await
                        .unwrap(),
                    CppEnvironmentStatus::Ready
                );
                published
            };
            assert_eq!(owned_containers(&docker).await, before);

            let mut failure = probe_config(&reference);
            failure.cmd = Some(
                ["--signal=KILL", "15s", "/usr/bin/false"]
                    .map(str::to_owned)
                    .into(),
            );
            let failed = run_probe(&docker, architecture, failure).await;
            assert!(failed.unwrap_err().contains("probe failed"));
            assert_eq!(owned_containers(&docker).await, before);

            let mut startup_failure = probe_config(&reference);
            startup_failure.entrypoint = Some(vec!["/does-not-exist".into()]);
            let cannot_start = run_probe(&docker, architecture, startup_failure).await;
            assert!(cannot_start.unwrap_err().contains("Could not start"));
            assert_eq!(owned_containers(&docker).await, before);

            let mut timeout = probe_config(&reference);
            timeout.cmd = Some(
                ["--signal=KILL", "1s", "/usr/bin/sleep", "10"]
                    .map(str::to_owned)
                    .into(),
            );
            let expired = run_probe(&docker, architecture, timeout).await;
            assert!(expired.is_err());
            assert_eq!(owned_containers(&docker).await, before);
        });
    }
}
