//! Docker CLI helpers for locating the `docker` executable and running
//! context discovery and Docker Desktop subcommands with timeouts.

use std::ffi::{OsStr, OsString};
use std::future::Future;
use std::io;
use std::path::{Path, PathBuf};
use std::process::{Output, Stdio};
use std::time::Duration;

use serde::Deserialize;
use tokio::process::Command;

/// How long each context, Desktop status, or Desktop version command may take.
const PROBE_TIMEOUT: Duration = Duration::from_secs(5);
/// Seconds passed to `docker desktop start --timeout`.
const START_TIMEOUT_SECS: u64 = 120;
/// Kills `docker desktop start` if it outlives its own timeout.
const START_BACKSTOP: Duration = Duration::from_secs(START_TIMEOUT_SECS + 10);

#[cfg(windows)]
const DOCKER_EXE: &str = "docker.exe";
#[cfg(not(windows))]
const DOCKER_EXE: &str = "docker";

/// Keeps a console window from flashing when the GUI app runs the CLI.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// The part of `docker desktop status --format json` that the probe reads.
#[derive(Deserialize)]
struct DesktopStatus {
    #[serde(rename = "Status")]
    status: String,
}

/// What the Docker Desktop CLI plugin reported.
#[derive(Debug, PartialEq, Eq)]
pub(super) enum DesktopProbe {
    /// Docker Desktop says it is running.
    Running,
    /// The Docker Desktop plugin is installed, but Desktop is not running.
    Stopped,
    /// The `docker` CLI has no Docker Desktop plugin.
    Unavailable,
}

/// Finds the `docker` executable using the process environment.
pub(super) fn find_docker_cli_from_env() -> Option<PathBuf> {
    let extra_dirs = known_install_dirs(|name| std::env::var_os(name));
    find_docker_cli(std::env::var_os("PATH").as_deref(), &extra_dirs)
}

/// Searches absolute `PATH` entries first, then `extra_dirs`.
pub(super) fn find_docker_cli(path_var: Option<&OsStr>, extra_dirs: &[PathBuf]) -> Option<PathBuf> {
    path_var
        .into_iter()
        .flat_map(std::env::split_paths)
        // A relative entry would resolve against the working directory.
        .filter(|dir| dir.is_absolute())
        .chain(extra_dirs.iter().cloned())
        .map(|dir| dir.join(DOCKER_EXE))
        .find(|candidate| candidate.is_file())
}

/// Standard install locations, for apps launched without the shell's `PATH`.
#[cfg(windows)]
pub(super) fn known_install_dirs(var: impl Fn(&str) -> Option<OsString>) -> Vec<PathBuf> {
    var("ProgramFiles")
        .map(|dir| PathBuf::from(dir).join(r"Docker\Docker\resources\bin"))
        .into_iter()
        .collect()
}

/// Standard install locations, for apps launched without the shell's `PATH`.
///
/// Apps opened from Finder only get `/usr/bin:/bin:/usr/sbin:/sbin`.
#[cfg(target_os = "macos")]
pub(super) fn known_install_dirs(var: impl Fn(&str) -> Option<OsString>) -> Vec<PathBuf> {
    let mut dirs = vec![
        PathBuf::from("/usr/local/bin"),
        PathBuf::from("/opt/homebrew/bin"),
    ];
    dirs.extend(var("HOME").map(|home| PathBuf::from(home).join(".docker/bin")));
    dirs.push(PathBuf::from(
        "/Applications/Docker.app/Contents/Resources/bin",
    ));
    dirs
}

/// Standard install locations, for apps launched without the shell's `PATH`.
#[cfg(not(any(windows, target_os = "macos")))]
pub(super) fn known_install_dirs(var: impl Fn(&str) -> Option<OsString>) -> Vec<PathBuf> {
    let mut dirs = vec![PathBuf::from("/usr/bin"), PathBuf::from("/usr/local/bin")];
    dirs.extend(var("HOME").map(|home| PathBuf::from(home).join("bin")));
    dirs
}

/// Reads a Docker context command's stdout when it succeeds.
pub(super) fn context_output(
    cli: Option<&Path>,
    args: &[&str],
) -> impl Future<Output = Option<String>> + use<> {
    let output = cli.map(|cli| {
        let mut command = Command::new(cli);
        // The default context's endpoint can otherwise pick up DOCKER_HOST.
        command
            .env_remove("DOCKER_HOST")
            .env_remove("DOCKER_CONTEXT");
        run_cli(command, args, PROBE_TIMEOUT)
    });
    async move {
        let output = output?.await.ok()?;
        if !output.status.success() {
            return None;
        }
        String::from_utf8(output.stdout).ok()
    }
}

/// Asks the Docker Desktop CLI plugin whether Desktop is running.
pub(super) async fn probe_desktop(cli: &Path) -> DesktopProbe {
    let status = run_cli(
        Command::new(cli),
        &["desktop", "status", "--format", "json"],
        PROBE_TIMEOUT,
    )
    .await;
    let parsed = status.ok().and_then(|output| {
        parse_desktop_status(
            output.status.success(),
            &String::from_utf8_lossy(&output.stdout),
        )
    });
    if let Some(probe) = parsed {
        return probe;
    }

    // A stopped Desktop makes `status` fail, but `version` still succeeds.
    match run_cli(
        Command::new(cli),
        &["desktop", "version", "--format", "json"],
        PROBE_TIMEOUT,
    )
    .await
    {
        Ok(output) if output.status.success() => DesktopProbe::Stopped,
        _ => DesktopProbe::Unavailable,
    }
}

/// Starts Docker Desktop and waits until it is running.
pub(super) async fn start_desktop(cli: &Path) -> Result<(), String> {
    let timeout = START_TIMEOUT_SECS.to_string();
    let args = ["desktop", "start", "--timeout", timeout.as_str()];

    match run_cli(Command::new(cli), &args, START_BACKSTOP).await {
        Ok(output) if output.status.success() => Ok(()),
        Ok(output) => Err(start_failure_detail(&output.stderr)),
        Err(error) => Err(format!("Docker Desktop did not start: {error}")),
    }
}

/// Runs the Docker CLI without a console window and kills it after `limit`.
pub(super) fn run_cli(
    mut command: Command,
    args: &[&str],
    limit: Duration,
) -> impl Future<Output = io::Result<Output>> + use<> {
    command.args(args).stdin(Stdio::null()).kill_on_drop(true);
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);

    let args = args.join(" ");
    async move {
        tokio::time::timeout(limit, command.output())
            .await
            .unwrap_or_else(|_| {
                Err(io::Error::new(
                    io::ErrorKind::TimedOut,
                    format!(
                        "docker {args} did not finish within {} seconds",
                        limit.as_secs()
                    ),
                ))
            })
    }
}

/// Reads `docker desktop status --format json`. Returns `None` when the
/// command failed or printed something other than a status object.
pub(super) fn parse_desktop_status(success: bool, stdout: &str) -> Option<DesktopProbe> {
    if !success {
        return None;
    }
    let desktop: DesktopStatus = serde_json::from_str(stdout).ok()?;

    Some(if desktop.status.eq_ignore_ascii_case("running") {
        DesktopProbe::Running
    } else {
        DesktopProbe::Stopped
    })
}

/// Summarizes a failed `docker desktop start` for the user.
pub(super) fn start_failure_detail(stderr: &[u8]) -> String {
    let stderr = String::from_utf8_lossy(stderr);

    match stderr.lines().map(str::trim).find(|line| !line.is_empty()) {
        Some(line) => format!("Docker Desktop did not start: {line}"),
        None => "Docker Desktop did not start.".to_owned(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    /// Output captured from Docker Desktop 4.99 while it was running.
    const RUNNING_STATUS_JSON: &str = r#"{
    "PauseType": "",
    "SessionID": "00000000-0000-0000-0000-000000000000",
    "Status": "running"
}"#;

    /// A temporary directory removed when dropped.
    struct TempDir(PathBuf);

    impl TempDir {
        fn new(name: &str) -> Self {
            let path =
                std::env::temp_dir().join(format!("batchgrade-{name}-{}", std::process::id()));
            let _ = fs::remove_dir_all(&path);
            fs::create_dir_all(&path).unwrap();
            Self(path)
        }

        fn with_docker(name: &str) -> Self {
            let dir = Self::new(name);
            fs::write(dir.0.join(DOCKER_EXE), b"").unwrap();
            dir
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn missing_cli() -> PathBuf {
        std::env::temp_dir()
            .join(format!("batchgrade-missing-cli-{}", std::process::id()))
            .join(DOCKER_EXE)
    }

    #[test]
    fn finds_docker_on_path() {
        let empty = TempDir::new("path-empty");
        let docker = TempDir::with_docker("path-docker");
        let path_var = std::env::join_paths([&empty.0, &docker.0]).unwrap();

        assert_eq!(
            find_docker_cli(Some(&path_var), &[]),
            Some(docker.0.join(DOCKER_EXE))
        );
    }

    #[test]
    fn falls_back_to_install_dirs() {
        let docker = TempDir::with_docker("install-dir");

        assert_eq!(
            find_docker_cli(None, std::slice::from_ref(&docker.0)),
            Some(docker.0.join(DOCKER_EXE))
        );
    }

    #[test]
    fn returns_none_without_docker() {
        let empty = TempDir::new("no-docker");

        assert_eq!(
            find_docker_cli(Some(empty.0.as_os_str()), std::slice::from_ref(&empty.0)),
            None
        );
    }

    #[test]
    fn ignores_relative_path_entries() {
        // Tests run from the package root, so this relative entry resolves to a real file.
        let relative =
            PathBuf::from("target").join(format!("batchgrade-relative-{}", std::process::id()));
        let absolute = Path::new(env!("CARGO_MANIFEST_DIR")).join(&relative);
        fs::create_dir_all(&absolute).unwrap();
        fs::write(absolute.join(DOCKER_EXE), b"").unwrap();

        let found = find_docker_cli(Some(relative.as_os_str()), &[]);
        let _ = fs::remove_dir_all(&absolute);

        assert_eq!(found, None);
    }

    #[cfg(windows)]
    #[test]
    fn install_dirs_include_docker_desktop() {
        let dirs = known_install_dirs(|name| {
            (name == "ProgramFiles").then(|| OsString::from(r"C:\Program Files"))
        });

        assert_eq!(
            dirs,
            [PathBuf::from(
                r"C:\Program Files\Docker\Docker\resources\bin"
            )]
        );
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn install_dirs_include_docker_desktop() {
        let dirs =
            known_install_dirs(|name| (name == "HOME").then(|| OsString::from("/Users/grader")));

        assert!(dirs.contains(&PathBuf::from("/usr/local/bin")), "{dirs:?}");
        assert!(
            dirs.contains(&PathBuf::from("/opt/homebrew/bin")),
            "{dirs:?}"
        );
        assert!(
            dirs.contains(&PathBuf::from("/Users/grader/.docker/bin")),
            "{dirs:?}"
        );
        assert!(
            dirs.contains(&PathBuf::from(
                "/Applications/Docker.app/Contents/Resources/bin"
            )),
            "{dirs:?}"
        );
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn install_dirs_include_system_and_rootless_locations() {
        let dirs =
            known_install_dirs(|name| (name == "HOME").then(|| OsString::from("/home/grader")));

        assert_eq!(
            dirs,
            [
                PathBuf::from("/usr/bin"),
                PathBuf::from("/usr/local/bin"),
                PathBuf::from("/home/grader/bin"),
            ]
        );
    }

    #[test]
    fn running_status_is_running() {
        assert_eq!(
            parse_desktop_status(true, RUNNING_STATUS_JSON),
            Some(DesktopProbe::Running)
        );
    }

    #[test]
    fn other_status_is_stopped() {
        assert_eq!(
            parse_desktop_status(true, r#"{"Status":"stopped"}"#),
            Some(DesktopProbe::Stopped)
        );
    }

    #[test]
    fn failed_or_unreadable_status_is_unknown() {
        // Docker Desktop 4.99 exits with 1 and writes only to stderr while stopped.
        assert_eq!(parse_desktop_status(false, ""), None);
        assert_eq!(parse_desktop_status(true, "Status running"), None);
        assert_eq!(parse_desktop_status(true, r#"{"version":"4.99.0"}"#), None);
    }

    #[test]
    fn start_failure_uses_first_stderr_line() {
        let detail =
            start_failure_detail(b"\n  Error: Docker Desktop failed to start  \nmore details\n");

        assert_eq!(
            detail,
            "Docker Desktop did not start: Error: Docker Desktop failed to start"
        );
    }

    #[test]
    fn start_failure_without_stderr_is_generic() {
        assert_eq!(start_failure_detail(b""), "Docker Desktop did not start.");
    }

    #[test]
    fn run_cli_reports_a_missing_executable() {
        let result = tauri::async_runtime::block_on(run_cli(
            Command::new(missing_cli()),
            &["version"],
            Duration::from_secs(5),
        ));

        assert_eq!(result.unwrap_err().kind(), io::ErrorKind::NotFound);
    }

    #[test]
    fn probe_desktop_without_cli_is_unavailable() {
        let probe = tauri::async_runtime::block_on(probe_desktop(&missing_cli()));

        assert_eq!(probe, DesktopProbe::Unavailable);
    }

    #[test]
    fn start_desktop_without_cli_fails() {
        let result = tauri::async_runtime::block_on(start_desktop(&missing_cli()));

        assert!(
            matches!(&result, Err(detail) if detail.starts_with("Docker Desktop did not start")),
            "{result:?}"
        );
    }
}
