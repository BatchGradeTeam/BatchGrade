//! Docker connectivity preflight.
//!
//! Reports whether the local Docker Engine can be reached. It never creates
//! containers. When the engine is unreachable, the Docker CLI is consulted to
//! tell "not installed" apart from "not running" and to start Docker Desktop.

mod cli;
mod engine;

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
    let engine = engine::probe_engine(&engine::candidate_hosts_from_env()).await;
    if engine != EngineProbe::Unreachable {
        return resolve(engine, None);
    }

    // The Engine API cannot tell a stopped Docker from a missing one, so ask the CLI.
    let desktop = match cli::find_docker_cli_from_env() {
        Some(cli) => Some(cli::probe_desktop(&cli).await),
        None => None,
    };
    resolve(engine, desktop)
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
            detail: "Docker Desktop is running, but its engine did not respond. \
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
