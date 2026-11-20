//! Docker Engine API probe over a local Unix socket or Windows named pipe.

use std::error::Error as _;
use std::io;

use bollard::errors::Error as BollardError;
use bollard::models::SystemVersion;
use bollard::{API_DEFAULT_VERSION, Docker};

/// Seconds to wait for the engine before reporting a timeout.
const ENGINE_TIMEOUT_SECS: u64 = 5;

#[cfg(windows)]
const DEFAULT_HOST: &str = "npipe:////./pipe/docker_engine";
#[cfg(unix)]
const DEFAULT_HOST: &str = "unix:///var/run/docker.sock";

/// What the Docker Engine API probe found.
#[derive(Debug, PartialEq, Eq)]
pub(super) enum EngineProbe {
    /// The engine answered, with its version when it reported one.
    Reachable { version: Option<String> },
    /// No engine is listening on any candidate socket or pipe.
    Unreachable,
    /// An engine may be there, but the check failed for the given reason.
    Failed(String),
}

/// Lists local engine addresses to try when context discovery is unavailable.
///
/// The platform default comes first, then the per-user sockets used by Docker
/// Desktop and rootless Docker or the Windows Docker Desktop pipe.
pub(super) fn fallback_hosts(
    #[cfg_attr(windows, allow(unused_variables))] var: impl Fn(&str) -> Option<String>,
) -> Vec<String> {
    let mut hosts = vec![DEFAULT_HOST.to_owned()];

    #[cfg(windows)]
    hosts.push("npipe:////./pipe/dockerDesktopLinuxEngine".to_owned());

    #[cfg(target_os = "macos")]
    hosts.extend(var("HOME").map(|home| format!("unix://{home}/.docker/run/docker.sock")));

    #[cfg(target_os = "linux")]
    {
        hosts.extend(var("XDG_RUNTIME_DIR").map(|dir| format!("unix://{dir}/docker.sock")));
        hosts.extend(var("HOME").map(|home| format!("unix://{home}/.docker/desktop/docker.sock")));
    }

    hosts
}

/// Accepts only addresses that Bollard can open with the platform's local transport.
pub(super) fn local_host(host: String) -> Result<String, String> {
    #[cfg(unix)]
    let local = host
        .strip_prefix("unix://")
        .is_some_and(|path| path.starts_with('/') && !path.contains('\0'))
        .then_some(host);

    #[cfg(windows)]
    let local = host.strip_prefix("npipe://").and_then(|path| {
        let path = path.replace('\\', "/");
        let name = path.strip_prefix("//./pipe/")?;
        (!name.is_empty() && !name.contains(['/', '\0'])).then(|| format!("npipe://{path}"))
    });

    local.ok_or_else(|| {
        "BatchGrade requires a local Docker socket or named pipe. Select a local Docker context \
         and clear any unsupported DOCKER_CONTEXT or DOCKER_HOST override."
            .into()
    })
}

/// Checks each candidate address and returns the first answer from an engine.
///
/// Missing or refusing sockets are skipped. If no engine answers, the first
/// failure is reported, so a permission problem is not hidden.
pub(super) async fn probe_engine(hosts: &[String]) -> EngineProbe {
    let mut failure = None;

    for host in hosts {
        #[cfg(unix)]
        let docker = Docker::connect_with_unix(host, ENGINE_TIMEOUT_SECS, API_DEFAULT_VERSION);
        #[cfg(windows)]
        let docker =
            Docker::connect_with_named_pipe(host, ENGINE_TIMEOUT_SECS, API_DEFAULT_VERSION);
        let probe = match docker {
            Ok(docker) => classify_engine(docker.version().await),
            Err(error) => classify_engine(Err(error)),
        };

        match probe {
            EngineProbe::Reachable { .. } => return probe,
            EngineProbe::Failed(_) if failure.is_none() => failure = Some(probe),
            _ => {}
        }
    }

    failure.unwrap_or(EngineProbe::Unreachable)
}

/// Maps the engine's `/version` response or error to a probe result.
pub(super) fn classify_engine(result: Result<SystemVersion, BollardError>) -> EngineProbe {
    let error = match result {
        Ok(version) => {
            return EngineProbe::Reachable {
                version: version.version,
            };
        }
        Err(error) => error,
    };

    match &error {
        BollardError::SocketNotFoundError(_) => return EngineProbe::Unreachable,
        BollardError::RequestTimeoutError => {
            return EngineProbe::Failed(format!(
                "Docker did not respond within {ENGINE_TIMEOUT_SECS} seconds."
            ));
        }
        BollardError::DockerResponseServerError {
            status_code,
            message,
        } => {
            return EngineProbe::Failed(format!(
                "Docker responded with status {status_code}: {message}"
            ));
        }
        _ => {}
    }

    match io_error_kind(&error) {
        Some(io::ErrorKind::NotFound | io::ErrorKind::ConnectionRefused) => {
            EngineProbe::Unreachable
        }
        Some(io::ErrorKind::PermissionDenied) => EngineProbe::Failed(
            "Permission denied while connecting to Docker. \
             On Linux, add your user to the docker group."
                .into(),
        ),
        _ => EngineProbe::Failed(error.to_string()),
    }
}

/// Finds the I/O error behind a bollard error, if there is one.
fn io_error_kind(error: &BollardError) -> Option<io::ErrorKind> {
    // `IOError` is transparent, so its `source()` skips the I/O error itself.
    if let BollardError::IOError { err } = error {
        return Some(err.kind());
    }

    let mut source = error.source();
    while let Some(current) = source {
        if let Some(io_error) = current.downcast_ref::<io::Error>() {
            return Some(io_error.kind());
        }
        source = current.source();
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io;

    fn env<'a>(vars: &'a [(&'a str, &'a str)]) -> impl Fn(&str) -> Option<String> + 'a {
        move |name| {
            vars.iter()
                .find(|(key, _)| *key == name)
                .map(|(_, value)| (*value).to_owned())
        }
    }

    // Written out instead of reusing the production constant, so the tests pin the address.
    #[cfg(windows)]
    const DEFAULT_HOST: &str = "npipe:////./pipe/docker_engine";
    #[cfg(unix)]
    const DEFAULT_HOST: &str = "unix:///var/run/docker.sock";

    fn missing_host(name: &str) -> String {
        let unique = format!("batchgrade-{name}-{}", std::process::id());
        #[cfg(windows)]
        return format!("npipe:////./pipe/{unique}");
        #[cfg(unix)]
        return format!("unix://{}", std::env::temp_dir().join(unique).display());
    }

    #[cfg(windows)]
    #[test]
    fn validates_local_windows_pipe_paths() {
        assert_eq!(
            local_host(r"npipe://\\.\pipe\docker_engine".into()).unwrap(),
            DEFAULT_HOST
        );
        assert!(local_host("npipe:////remote/pipe/docker_engine".into()).is_err());
    }

    #[cfg(windows)]
    #[test]
    fn fallback_hosts_include_docker_desktop_pipe() {
        let hosts = fallback_hosts(env(&[]));

        assert_eq!(
            hosts,
            [DEFAULT_HOST, "npipe:////./pipe/dockerDesktopLinuxEngine"]
        );
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn fallback_hosts_include_docker_desktop_socket() {
        let hosts = fallback_hosts(env(&[("HOME", "/Users/grader")]));

        assert_eq!(
            hosts,
            [DEFAULT_HOST, "unix:///Users/grader/.docker/run/docker.sock"]
        );
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn fallback_hosts_include_rootless_and_docker_desktop_sockets() {
        let hosts = fallback_hosts(env(&[
            ("HOME", "/home/grader"),
            ("XDG_RUNTIME_DIR", "/run/user/1000"),
        ]));

        assert_eq!(
            hosts,
            [
                DEFAULT_HOST,
                "unix:///run/user/1000/docker.sock",
                "unix:///home/grader/.docker/desktop/docker.sock",
            ]
        );
    }

    #[test]
    fn version_response_is_reachable() {
        let version = SystemVersion {
            version: Some("29.9.3".into()),
            ..Default::default()
        };

        assert_eq!(
            classify_engine(Ok(version)),
            EngineProbe::Reachable {
                version: Some("29.9.3".into())
            }
        );
    }

    #[test]
    fn version_response_without_version_is_reachable() {
        assert_eq!(
            classify_engine(Ok(SystemVersion::default())),
            EngineProbe::Reachable { version: None }
        );
    }

    #[test]
    fn missing_socket_is_unreachable() {
        let error = BollardError::SocketNotFoundError("/var/run/docker.sock".into());

        assert_eq!(classify_engine(Err(error)), EngineProbe::Unreachable);
    }

    #[test]
    fn refused_or_missing_connection_is_unreachable() {
        for kind in [io::ErrorKind::ConnectionRefused, io::ErrorKind::NotFound] {
            let error = BollardError::IOError {
                err: io::Error::from(kind),
            };

            assert_eq!(
                classify_engine(Err(error)),
                EngineProbe::Unreachable,
                "{kind:?}"
            );
        }
    }

    #[test]
    fn permission_denied_explains_the_docker_group() {
        let error = BollardError::IOError {
            err: io::Error::from(io::ErrorKind::PermissionDenied),
        };

        let probe = classify_engine(Err(error));

        assert!(
            matches!(&probe, EngineProbe::Failed(detail) if detail.contains("docker group")),
            "{probe:?}"
        );
    }

    #[test]
    fn timeout_is_a_failure() {
        let probe = classify_engine(Err(BollardError::RequestTimeoutError));

        assert!(
            matches!(&probe, EngineProbe::Failed(detail) if detail.contains("5 seconds")),
            "{probe:?}"
        );
    }

    #[test]
    fn server_error_is_a_failure_with_its_message() {
        let error = BollardError::DockerResponseServerError {
            status_code: 400,
            message: "client version 1.53 is too new".into(),
        };

        let probe = classify_engine(Err(error));

        assert!(
            matches!(&probe, EngineProbe::Failed(detail)
                if detail.contains("400") && detail.contains("client version 1.53 is too new")),
            "{probe:?}"
        );
    }

    #[test]
    fn probe_without_hosts_is_unreachable() {
        let probe = tauri::async_runtime::block_on(probe_engine(&[]));

        assert_eq!(probe, EngineProbe::Unreachable);
    }

    #[test]
    fn probe_of_missing_socket_is_unreachable() {
        let hosts = [missing_host("missing-engine")];

        let probe = tauri::async_runtime::block_on(probe_engine(&hosts));

        assert_eq!(probe, EngineProbe::Unreachable);
    }

    #[cfg(unix)]
    #[test]
    fn probe_of_stale_socket_is_unreachable() {
        let path =
            std::env::temp_dir().join(format!("batchgrade-stale-{}.sock", std::process::id()));
        let _ = std::fs::remove_file(&path);
        // Binding and then dropping the listener leaves a socket file that refuses connections.
        drop(std::os::unix::net::UnixListener::bind(&path).unwrap());

        let probe =
            tauri::async_runtime::block_on(probe_engine(&[format!("unix://{}", path.display())]));
        let _ = std::fs::remove_file(&path);

        assert_eq!(probe, EngineProbe::Unreachable);
    }
}
