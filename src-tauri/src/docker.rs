//! Docker connectivity preflight.
//!
//! Resolves the selected Docker endpoint and reports whether the local engine
//! can be reached. It never creates containers. When the engine is unreachable,
//! the Docker CLI helps distinguish "not installed" from "not running" and start
//! Docker Desktop.

mod cli;
mod compiler;
mod engine;

pub use compiler::CppEnvironmentStatus;
pub(crate) use compiler::{CppRunResult, compile_and_run};

use std::ffi::OsString;
use std::future::Future;

use serde::Serialize;

use cli::DesktopProbe;
use engine::EngineProbe;

/// Result of a Docker preflight, sent to the frontend as `{ "status": ... }`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(
    tag = "status",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum DockerStatus {
    Available { version: Option<String> },
    NotInstalled,
    NotRunning { can_start: bool },
    Error { detail: String },
}

/// Checks whether the local Docker Engine is reachable.
#[tauri::command]
pub async fn check_docker_status() -> DockerStatus {
    check().await
}

/// Starts Docker Desktop, waits for it, and then checks Docker again.
#[tauri::command]
pub async fn start_docker_desktop() -> DockerStatus {
    let Some(cli) = cli::find_docker_cli_from_env() else {
        return DockerStatus::NotInstalled;
    };
    let started = cli::start_desktop(&cli).await;
    after_start(started, check().await)
}

async fn check() -> DockerStatus {
    let cli = cli::find_docker_cli_from_env();
    let hosts = match selected_hosts(cli.as_deref()).await {
        Ok(hosts) => hosts,
        Err(detail) => return DockerStatus::Error { detail },
    };

    let engine = engine::probe_engine(&hosts).await;
    if engine != EngineProbe::Unreachable {
        return resolve(engine, None);
    }

    // The Engine API cannot tell a stopped Docker from a missing one, so ask the CLI.
    let desktop = match cli {
        Some(cli) => Some(cli::probe_desktop(&cli).await),
        None => None,
    };
    resolve(engine, desktop)
}

async fn selected_hosts(cli: Option<&std::path::Path>) -> Result<Vec<String>, String> {
    resolve_hosts(
        |name| std::env::var_os(name),
        |args| cli::context_output(cli, args),
    )
    .await
}

#[tauri::command]
pub async fn check_cpp_environment() -> CppEnvironmentStatus {
    compiler::check(false).await
}

#[tauri::command]
pub async fn provision_cpp_environment() -> CppEnvironmentStatus {
    compiler::check(true).await
}

/// Returns one selected endpoint, or the platform fallback list if discovery is unavailable.
async fn resolve_hosts<F: Future<Output = Option<String>>>(
    var: impl Fn(&str) -> Option<OsString>,
    context_output: impl Fn(&[&str]) -> F,
) -> Result<Vec<String>, String> {
    let explicit_context = var("DOCKER_CONTEXT").filter(|value| !value.is_empty());
    if explicit_context.is_none()
        && let Some(host) = var("DOCKER_HOST").filter(|value| !value.is_empty())
    {
        let host = host
            .into_string()
            .map_err(|_| "Set DOCKER_HOST to a valid local Docker endpoint.".to_owned())?;
        return Ok(vec![engine::local_host(host)?]);
    }

    let context_error = if explicit_context.is_some() {
        "Could not resolve DOCKER_CONTEXT. Make sure the Docker CLI is installed and check the context with docker context ls."
    } else {
        "Could not resolve the active Docker context. Run docker context ls and select a valid local context."
    };
    let context = match explicit_context {
        Some(context) => context
            .into_string()
            .map_err(|_| context_error.to_owned())?,
        None => {
            let shown = context_output(&["context", "show"])
                .await
                .unwrap_or_default();
            let context = shown.trim();
            if context.is_empty() {
                return Ok(engine::fallback_hosts(|name| var(name)?.into_string().ok()));
            }
            context.to_owned()
        }
    };

    let inspected = context_output(&[
        "context",
        "inspect",
        "--format",
        "{{json .Endpoints.docker.Host}}",
        "--",
        &context,
    ])
    .await;
    let host = inspected
        .and_then(|output| serde_json::from_str::<String>(&output).ok())
        .ok_or_else(|| context_error.to_owned())?;
    Ok(vec![engine::local_host(host)?])
}

/// Combines the engine probe with the Docker Desktop probe.
///
/// `desktop` is `None` when no Docker CLI was found.
fn resolve(engine: EngineProbe, desktop: Option<DesktopProbe>) -> DockerStatus {
    match (engine, desktop) {
        (EngineProbe::Reachable { version }, _) => DockerStatus::Available { version },
        (EngineProbe::Failed(detail), _) => DockerStatus::Error { detail },
        (EngineProbe::Unreachable, None) => DockerStatus::NotInstalled,
        (EngineProbe::Unreachable, Some(DesktopProbe::Running)) => DockerStatus::Error {
            detail: "Docker Desktop is running, but the Docker Engine did not respond. \
                     Wait a moment, then refresh."
                .into(),
        },
        (EngineProbe::Unreachable, Some(DesktopProbe::Stopped)) => {
            DockerStatus::NotRunning { can_start: true }
        }
        (EngineProbe::Unreachable, Some(DesktopProbe::Unavailable)) => {
            DockerStatus::NotRunning { can_start: false }
        }
    }
}

/// Reports a failed start unless Docker became reachable anyway.
fn after_start(started: Result<(), String>, status: DockerStatus) -> DockerStatus {
    match (started, status) {
        (Err(detail), DockerStatus::NotRunning { .. }) => DockerStatus::Error { detail },
        (_, status) => status,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::future::{Ready, ready};

    #[cfg(windows)]
    const LOCAL_TEST_HOST: &str = "npipe:////./pipe/batchgrade_test";
    #[cfg(unix)]
    const LOCAL_TEST_HOST: &str = "unix:///tmp/batchgrade test.sock";

    fn env<'a>(vars: &'a [(&str, &str)]) -> impl Fn(&str) -> Option<OsString> + 'a {
        move |name| {
            vars.iter()
                .find(|(key, _)| *key == name)
                .map(|(_, value)| OsString::from(value))
        }
    }

    #[test]
    fn docker_context_overrides_docker_host() {
        let hosts = tauri::async_runtime::block_on(resolve_hosts(
            env(&[
                ("DOCKER_CONTEXT", "default"),
                ("DOCKER_HOST", "tcp://remote:2375"),
            ]),
            |args| {
                assert_eq!(
                    args,
                    [
                        "context",
                        "inspect",
                        "--format",
                        "{{json .Endpoints.docker.Host}}",
                        "--",
                        "default"
                    ]
                );
                ready(Some(json!(LOCAL_TEST_HOST).to_string()))
            },
        ));

        assert_eq!(hosts.unwrap(), [LOCAL_TEST_HOST]);
    }

    #[test]
    fn docker_host_overrides_active_context_without_calling_cli() {
        let hosts = tauri::async_runtime::block_on(resolve_hosts(
            env(&[("DOCKER_CONTEXT", ""), ("DOCKER_HOST", LOCAL_TEST_HOST)]),
            |_| -> Ready<Option<String>> { panic!("DOCKER_HOST should bypass context discovery") },
        ));

        assert_eq!(hosts.unwrap(), [LOCAL_TEST_HOST]);
    }

    #[test]
    fn selects_only_the_active_context_endpoint() {
        let hosts =
            tauri::async_runtime::block_on(resolve_hosts(env(&[("DOCKER_HOST", "")]), |args| {
                ready(match args {
                    ["context", "show"] => Some("desktop-local\r\n".into()),
                    ["context", "inspect", "--format", _, "--", "desktop-local"] => {
                        Some(json!(LOCAL_TEST_HOST).to_string())
                    }
                    _ => panic!("unexpected arguments: {args:?}"),
                })
            }));

        assert_eq!(hosts.unwrap(), [LOCAL_TEST_HOST]);
    }

    #[test]
    fn missing_cli_uses_platform_fallback_without_an_override() {
        let hosts = tauri::async_runtime::block_on(resolve_hosts(env(&[]), |args| {
            assert_eq!(args, ["context", "show"]);
            cli::context_output(None, args)
        }));

        assert_eq!(hosts.unwrap(), engine::fallback_hosts(|_| None));
    }

    #[test]
    fn missing_cli_cannot_resolve_explicit_context() {
        let result = tauri::async_runtime::block_on(resolve_hosts(
            env(&[("DOCKER_CONTEXT", "work"), ("DOCKER_HOST", LOCAL_TEST_HOST)]),
            |args| cli::context_output(None, args),
        ));

        assert!(result.unwrap_err().contains("DOCKER_CONTEXT"));
    }

    #[test]
    fn invalid_context_does_not_use_fallback_hosts() {
        for vars in [&[][..], &[("DOCKER_CONTEXT", "invalid")][..]] {
            for inspect_output in [None, Some("null")] {
                let result = tauri::async_runtime::block_on(resolve_hosts(env(vars), |args| {
                    ready(match args {
                        ["context", "show"] => Some("invalid\n".into()),
                        ["context", "inspect", "--format", _, "--", "invalid"] => {
                            inspect_output.map(str::to_owned)
                        }
                        _ => panic!("unexpected arguments: {args:?}"),
                    })
                }));

                assert!(result.unwrap_err().contains("docker context ls"));
            }
        }
    }

    #[test]
    fn rejects_remote_host_and_context_endpoints() {
        for remote in ["tcp://build-server:2375", "ssh://user@build-server"] {
            let host = tauri::async_runtime::block_on(resolve_hosts(
                env(&[("DOCKER_HOST", remote)]),
                |_| -> Ready<Option<String>> {
                    panic!("a remote DOCKER_HOST should bypass context discovery")
                },
            ));
            let context = tauri::async_runtime::block_on(resolve_hosts(
                env(&[
                    ("DOCKER_CONTEXT", "remote"),
                    ("DOCKER_HOST", LOCAL_TEST_HOST),
                ]),
                |_| ready(Some(json!(remote).to_string())),
            ));

            for result in [host, context] {
                let detail = result.unwrap_err();
                assert!(detail.contains("Select a local Docker context"), "{detail}");
                assert!(!detail.contains(remote), "{detail}");
            }
        }
    }

    fn to_json(status: DockerStatus) -> serde_json::Value {
        serde_json::to_value(status).unwrap()
    }

    #[test]
    fn serializes_statuses_for_the_frontend() {
        assert_eq!(
            to_json(DockerStatus::Available {
                version: Some("29.9.3".into())
            }),
            json!({ "status": "available", "version": "29.9.3" })
        );
        assert_eq!(
            to_json(DockerStatus::Available { version: None }),
            json!({ "status": "available", "version": null })
        );
        assert_eq!(
            to_json(DockerStatus::NotInstalled),
            json!({ "status": "notInstalled" })
        );
        assert_eq!(
            to_json(DockerStatus::NotRunning { can_start: true }),
            json!({ "status": "notRunning", "canStart": true })
        );
        assert_eq!(
            to_json(DockerStatus::Error {
                detail: "Docker failed.".into()
            }),
            json!({ "status": "error", "detail": "Docker failed." })
        );
    }

    #[test]
    fn reachable_engine_is_available() {
        let engine = EngineProbe::Reachable {
            version: Some("29.9.3".into()),
        };

        assert_eq!(
            resolve(engine, None),
            DockerStatus::Available {
                version: Some("29.9.3".into())
            }
        );
    }

    #[test]
    fn engine_failure_is_an_error() {
        let engine = EngineProbe::Failed("Permission denied.".into());

        assert_eq!(
            resolve(engine, Some(DesktopProbe::Stopped)),
            DockerStatus::Error {
                detail: "Permission denied.".into()
            }
        );
    }

    #[test]
    fn unreachable_engine_without_cli_is_not_installed() {
        assert_eq!(
            resolve(EngineProbe::Unreachable, None),
            DockerStatus::NotInstalled
        );
    }

    #[test]
    fn unreachable_engine_with_stopped_desktop_can_start() {
        assert_eq!(
            resolve(EngineProbe::Unreachable, Some(DesktopProbe::Stopped)),
            DockerStatus::NotRunning { can_start: true }
        );
    }

    #[test]
    fn unreachable_engine_without_desktop_cannot_start() {
        assert_eq!(
            resolve(EngineProbe::Unreachable, Some(DesktopProbe::Unavailable)),
            DockerStatus::NotRunning { can_start: false }
        );
    }

    #[test]
    fn unreachable_engine_with_running_desktop_is_an_error() {
        let status = resolve(EngineProbe::Unreachable, Some(DesktopProbe::Running));

        assert!(
            matches!(&status, DockerStatus::Error { detail } if detail.contains("Docker Desktop is running")),
            "unexpected status: {status:?}"
        );
    }

    #[test]
    fn failed_start_is_reported_when_docker_is_still_not_running() {
        let status = after_start(
            Err("Docker Desktop did not start: timed out.".into()),
            DockerStatus::NotRunning { can_start: true },
        );

        assert_eq!(
            status,
            DockerStatus::Error {
                detail: "Docker Desktop did not start: timed out.".into()
            }
        );
    }

    #[test]
    fn failed_start_is_ignored_when_docker_became_available() {
        let status = after_start(
            Err("Docker Desktop did not start: timed out.".into()),
            DockerStatus::Available {
                version: Some("29.9.3".into()),
            },
        );

        assert_eq!(
            status,
            DockerStatus::Available {
                version: Some("29.9.3".into())
            }
        );
    }

    #[test]
    fn successful_start_returns_the_new_status() {
        let status = after_start(Ok(()), DockerStatus::NotRunning { can_start: true });

        assert_eq!(status, DockerStatus::NotRunning { can_start: true });
    }
}
