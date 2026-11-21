use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::time::Duration;

use bollard::Docker;
use serde::Deserialize;
use tokio::process::Command;
use uuid::Uuid;

use super::{
    Architecture, CppEnvironmentStatus, is_missing, is_sha256_digest, matches_platform,
    probe_config, run_probe,
};
use crate::docker::cli;

const LOCAL_TAG: &str = "batchgrade-cpp:dev";
const BUILD_TIMEOUT: Duration = Duration::from_secs(15 * 60);

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct BuildInputs {
    base: String,
    debian_snapshot: String,
    security_snapshot: String,
}

fn build_context() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../docker/cpp")
}

pub(super) async fn check(
    docker: &Docker,
    host: &str,
    architecture: Architecture,
    provision: bool,
) -> Result<CppEnvironmentStatus, String> {
    if let Some(id) = available_image(docker, architecture).await? {
        run_probe(docker, architecture, probe_config(&id)).await?;
    } else if provision {
        let id = build(docker, host, architecture).await?;
        run_probe(docker, architecture, probe_config(&id)).await?;
        write_pin(&id)?;
    } else {
        return Ok(CppEnvironmentStatus::LocalImageMissing);
    }
    Ok(CppEnvironmentStatus::Ready)
}

pub(super) async fn available_image(
    docker: &Docker,
    architecture: Architecture,
) -> Result<Option<String>, String> {
    let pin = match fs::read_to_string(build_context().join("compiler-image.local")) {
        Ok(pin) => pin,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
        Err(error) => {
            return Err(format!(
                "Could not read the local compiler image ID: {error}"
            ));
        }
    };
    let id = pin.trim();
    if !is_sha256_digest(id) {
        return Err("The local compiler pin must contain a full SHA-256 image ID.".into());
    }

    match docker.inspect_image(id).await {
        Ok(image) if image.id.as_deref() != Some(id) => {
            Err("Docker returned a local compiler image with an unexpected ID.".into())
        }
        Ok(image) if matches_platform(&image, architecture) => Ok(Some(id.to_owned())),
        Ok(_) => Ok(None),
        Err(error) if is_missing(&error) => Ok(None),
        Err(error) => Err(format!(
            "Could not inspect the local compiler image: {error}"
        )),
    }
}

async fn build(docker: &Docker, host: &str, architecture: Architecture) -> Result<String, String> {
    let cli = cli::find_docker_cli_from_env()
        .ok_or("Install the Docker CLI with Buildx to build the compiler image.")?;
    let inputs: BuildInputs =
        serde_json::from_str(include_str!("../../../../docker/cpp/build-inputs.json"))
            .map_err(|error| format!("The compiler build inputs are invalid: {error}"))?;
    let context = build_context();
    let mut command = Command::new(cli);
    command.current_dir(context).env_remove("DOCKER_CONTEXT");
    let output = cli::run_cli(
        command,
        &[
            "--host",
            host,
            "buildx",
            "build",
            "--builder",
            "default",
            "--platform",
            &architecture.platform(),
            "--load",
            "--tag",
            LOCAL_TAG,
            "--build-arg",
            &format!("DEBIAN_BASE={}", inputs.base),
            "--build-arg",
            &format!("DEBIAN_SNAPSHOT={}", inputs.debian_snapshot),
            "--build-arg",
            &format!("SECURITY_SNAPSHOT={}", inputs.security_snapshot),
            ".",
        ],
        BUILD_TIMEOUT,
    )
    .await
    .map_err(|error| match error.kind() {
        io::ErrorKind::TimedOut => "The compiler build exceeded 15 minutes. Try again.".into(),
        _ => format!("Could not start the compiler build: {error}"),
    })?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let detail = stderr.lines().rev().find(|line| !line.trim().is_empty());
        return Err(match detail {
            Some(line) => format!("Could not build the compiler image: {}", line.trim()),
            None => format!("Could not build the compiler image ({}).", output.status),
        });
    }

    let image = docker
        .inspect_image(LOCAL_TAG)
        .await
        .map_err(|error| format!("Could not inspect the built compiler image: {error}"))?;
    if !matches_platform(&image, architecture) {
        return Err("Docker built a compiler image with an unexpected platform.".into());
    }
    image
        .id
        .filter(|id| is_sha256_digest(id))
        .ok_or_else(|| "Docker did not return a valid ID for the built compiler image.".into())
}

fn write_pin(id: &str) -> Result<(), String> {
    let context = build_context();
    let temporary = context.join(format!("compiler-image.{}.tmp", Uuid::new_v4()));
    let pin = context.join("compiler-image.local");
    let result = fs::write(&temporary, format!("{id}\n")).and_then(|_| fs::rename(&temporary, pin));
    if let Err(error) = result {
        let _ = fs::remove_file(temporary);
        return Err(format!(
            "Could not save the built compiler image ID: {error}"
        ));
    }
    Ok(())
}
