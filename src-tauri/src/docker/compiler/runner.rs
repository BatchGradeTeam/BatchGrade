use std::time::{Duration, Instant};

use bollard::Docker;
use bollard::container::{AttachContainerResults, LogOutput};
use bollard::query_parameters::{
    AttachContainerOptions, InspectContainerOptions, StartContainerOptions, WaitContainerOptions,
};
use futures_util::StreamExt;
use serde::Serialize;
use tokio::io::AsyncWriteExt;

use super::{
    Architecture, DockerError, IMAGE_DIGESTS, OPERATION, capabilities, image_reference,
    probe_config, selected_engine, verify_image, with_container,
};

const OUTPUT_LIMIT: usize = 64 * 1024;
const ARTIFACT_LIMIT: usize = 16 * 1024 * 1024;
const COMPILER: &str = concat!(
    "/usr/bin/head -c \"$1\" >/tmp/main.cpp && ",
    "/usr/bin/g++-14 -std=c++17 -O0 -Wall -Wextra -pedantic /tmp/main.cpp -o /tmp/program >&2 && ",
    "/usr/bin/cat /tmp/program"
);
const PROGRAM: &str = concat!(
    "/usr/bin/head -c \"$1\" >/tmp/program && ",
    "/usr/bin/chmod 500 /tmp/program && exec /tmp/program </dev/null"
);

#[derive(Debug, Serialize)]
pub struct CppRunResult {
    compilation: StageResult,
    execution: Option<StageResult>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct StageResult {
    status: StageStatus,
    exit_code: Option<i64>,
    stdout: String,
    stderr: String,
    duration_ms: u64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
enum StageStatus {
    Success,
    CompileError,
    RuntimeError,
    TimeLimitExceeded,
    OutputLimitExceeded,
    MemoryLimitExceeded,
}

#[derive(Clone, Copy)]
enum Stage {
    Compile,
    Run,
}

impl Stage {
    fn output_limit(self) -> usize {
        match self {
            Self::Compile => ARTIFACT_LIMIT,
            Self::Run => OUTPUT_LIMIT,
        }
    }
}

#[derive(Default)]
struct Capture {
    stdout: Vec<u8>,
    stderr: Vec<u8>,
}

struct StageOutput {
    status: StageStatus,
    exit_code: Option<i64>,
    capture: Capture,
    duration: Duration,
}

impl StageOutput {
    fn result(&self, include_stdout: bool) -> StageResult {
        StageResult {
            status: self.status,
            exit_code: self.exit_code,
            stdout: if include_stdout {
                String::from_utf8_lossy(&self.capture.stdout).into_owned()
            } else {
                String::new()
            },
            stderr: String::from_utf8_lossy(&self.capture.stderr).into_owned(),
            duration_ms: self.duration.as_millis() as u64,
        }
    }
}

pub(crate) async fn compile_and_run(source: Vec<u8>) -> Result<CppRunResult, String> {
    let _operation = OPERATION
        .try_lock()
        .map_err(|_| "Another compiler operation is in progress. Try again shortly.")?;
    let (docker, _) = selected_engine().await?;
    let architecture = capabilities(
        &docker
            .info()
            .await
            .map_err(|error| format!("Could not inspect Docker: {error}"))?,
    )?;
    let image = selected_image(&docker, architecture).await?;
    let compilation = run_stage(&docker, architecture, &image, Stage::Compile, &source).await?;
    let execution = if compilation.status == StageStatus::Success {
        if compilation.capture.stdout.is_empty() {
            return Err("The compiler did not produce an executable.".into());
        }
        Some(
            run_stage(
                &docker,
                architecture,
                &image,
                Stage::Run,
                &compilation.capture.stdout,
            )
            .await?
            .result(true),
        )
    } else {
        None
    };
    Ok(CppRunResult {
        compilation: compilation.result(false),
        execution,
    })
}

async fn selected_image(docker: &Docker, architecture: Architecture) -> Result<String, String> {
    if let Some(reference) = image_reference(IMAGE_DIGESTS, architecture)? {
        let image = docker.inspect_image(&reference).await.map_err(|error| {
            if super::is_missing(&error) {
                "Download the compiler image in the Docker panel first.".into()
            } else {
                format!("Could not inspect the compiler image: {error}")
            }
        })?;
        verify_image(&image, &reference, architecture)?;
        return Ok(reference);
    }
    #[cfg(debug_assertions)]
    {
        super::local::available_image(docker, architecture)
            .await?
            .ok_or_else(|| "Build the compiler image in the Docker panel first.".into())
    }
    #[cfg(not(debug_assertions))]
    Err("A compiler image has not been published for this BatchGrade build.".into())
}

async fn run_stage(
    docker: &Docker,
    architecture: Architecture,
    image: &str,
    stage: Stage,
    input: &[u8],
) -> Result<StageOutput, String> {
    let (name, command, guard, seconds) = match stage {
        Stage::Compile => ("compile", COMPILER, "65s", 60),
        Stage::Run => ("run", PROGRAM, "6s", 3),
    };
    let mut config = probe_config(image);
    config.open_stdin = Some(true);
    config.stdin_once = Some(true);
    config.cmd = Some(vec![
        "--signal=KILL".into(),
        guard.into(),
        "/bin/sh".into(),
        "-c".into(),
        command.into(),
        "batchgrade".into(),
        input.len().to_string(),
    ]);
    if let Stage::Run = stage {
        let host = config.host_config.as_mut().expect("sandbox configuration");
        host.memory = Some(256 * 1024 * 1024);
        host.memory_swap = host.memory;
        host.tmpfs.as_mut().expect("sandbox tmpfs").insert(
            "/tmp".into(),
            "rw,exec,nosuid,nodev,size=32m,mode=1777".into(),
        );
    }
    with_container(docker, architecture, config, name, async |docker, id| {
        run_attached(docker, id, stage, input, Duration::from_secs(seconds)).await
    })
    .await
}

async fn run_attached(
    docker: &Docker,
    id: &str,
    stage: Stage,
    input: &[u8],
    deadline: Duration,
) -> Result<StageOutput, String> {
    let options = AttachContainerOptions {
        stream: true,
        stdin: true,
        stdout: true,
        stderr: true,
        ..Default::default()
    };
    let AttachContainerResults {
        input: mut stdin,
        mut output,
    } = docker
        .attach_container(id, Some(options))
        .await
        .map_err(|error| format!("Could not attach to Docker: {error}"))?;
    let started = Instant::now();
    let mut capture = Capture::default();
    let docker = docker
        .clone()
        .with_timeout(deadline + Duration::from_secs(1));
    let work = async {
        docker
            .start_container(id, None::<StartContainerOptions>)
            .await
            .map_err(|error| format!("Could not start the container: {error}"))?;
        let send = async {
            stdin
                .write_all(input)
                .await
                .map_err(|error| format!("Could not send input to Docker: {error}"))?;
            stdin
                .flush()
                .await
                .map_err(|error| format!("Could not flush Docker input: {error}"))
        };
        let receive = async {
            while let Some(frame) = output.next().await {
                let frame =
                    frame.map_err(|error| format!("Could not read Docker output: {error}"))?;
                let (buffer, bytes, limit) = match frame {
                    LogOutput::StdOut { message } => {
                        (&mut capture.stdout, message, stage.output_limit())
                    }
                    LogOutput::StdErr { message } => (&mut capture.stderr, message, OUTPUT_LIMIT),
                    _ => return Err("Docker sent an unexpected output stream.".into()),
                };
                if !append_bounded(buffer, &bytes, limit) {
                    return Ok(true);
                }
            }
            Ok::<_, String>(false)
        };
        tokio::pin!(send, receive);
        let output_exceeded = tokio::select! {
            result = &mut receive => {
                let output_exceeded = result?;
                if !output_exceeded { send.await?; }
                output_exceeded
            }
            result = &mut send => {
                result?;
                receive.await?
            }
        };
        if output_exceeded {
            return Ok((StageStatus::OutputLimitExceeded, None));
        }
        let mut wait = docker.wait_container(id, None::<WaitContainerOptions>);
        let exit_code = match wait.next().await {
            Some(Ok(result)) if result.error.is_none() => result.status_code,
            Some(Err(DockerError::DockerContainerWaitError { code, error }))
                if error.is_empty() =>
            {
                code
            }
            Some(Err(error)) => return Err(format!("Could not wait for the container: {error}")),
            _ => return Err("Docker did not report the container exit status.".into()),
        };
        let status = if exit_code == 0 {
            StageStatus::Success
        } else {
            let state = docker
                .inspect_container(id, None::<InspectContainerOptions>)
                .await
                .map_err(|error| format!("Could not inspect the stopped container: {error}"))?
                .state
                .ok_or("Docker did not report the stopped container state.")?;
            if state.oom_killed == Some(true) {
                StageStatus::MemoryLimitExceeded
            } else {
                match stage {
                    Stage::Compile => StageStatus::CompileError,
                    Stage::Run => StageStatus::RuntimeError,
                }
            }
        };
        Ok((status, Some(exit_code)))
    };
    let (status, exit_code) = tokio::time::timeout(deadline, work)
        .await
        .unwrap_or(Ok((StageStatus::TimeLimitExceeded, None)))?;
    Ok(StageOutput {
        status,
        exit_code,
        capture,
        duration: started.elapsed(),
    })
}

fn append_bounded(buffer: &mut Vec<u8>, bytes: &[u8], limit: usize) -> bool {
    let count = bytes.len().min(limit - buffer.len());
    buffer.extend_from_slice(&bytes[..count]);
    count == bytes.len()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn retains_only_the_bounded_output_prefix() {
        let mut output = Vec::new();
        assert!(append_bounded(&mut output, b"ab", 3));
        assert!(!append_bounded(&mut output, b"cd", 3));
        assert_eq!(output, b"abc");
    }

    #[test]
    #[ignore = "requires the configured compiler image and a Linux Docker Engine"]
    fn cpp_run_real_docker() {
        tauri::async_runtime::block_on(async {
            let (docker, _) = selected_engine().await.unwrap();
            let before = super::super::tests::owned_containers(&docker).await;
            let compiled =
                compile_and_run(include_bytes!("../../../../docker/cpp/tests/test.cpp").to_vec())
                    .await
                    .unwrap();
            assert_eq!(
                compiled.compilation.status,
                StageStatus::Success,
                "{compiled:?}"
            );
            let executed = compiled.execution.unwrap();
            assert_eq!(executed.status, StageStatus::Success, "{executed:?}");
            assert_eq!(executed.stdout, "BatchGrade Compiler Ready\n");
            assert_eq!(executed.exit_code, Some(0));

            let failed = compile_and_run(b"int main( {\n".to_vec()).await.unwrap();
            assert_eq!(failed.compilation.status, StageStatus::CompileError);
            assert!(failed.compilation.stderr.contains("error:"));
            assert!(failed.execution.is_none());

            let result = compile_and_run(b"#include <cstdio>\nint main() { puts(\"out\"); fputs(\"err\", stderr); return 7; }".to_vec()).await.unwrap().execution.unwrap();
            assert_eq!(result.status, StageStatus::RuntimeError);
            assert_eq!(result.stdout, "out\n");
            assert_eq!(result.stderr, "err");
            assert_eq!(result.exit_code, Some(7));

            let result = compile_and_run(
                b"#include <cstdio>\nint main() { while (true) puts(\"output\"); }".to_vec(),
            )
            .await
            .unwrap()
            .execution
            .unwrap();
            assert_eq!(result.status, StageStatus::OutputLimitExceeded);
            assert_eq!(result.stdout.len(), OUTPUT_LIMIT);

            let result = compile_and_run(
                b"int main() { volatile int active = 1; while (active) {} }".to_vec(),
            )
            .await
            .unwrap()
            .execution
            .unwrap();
            assert_eq!(result.status, StageStatus::TimeLimitExceeded);
            assert_eq!(super::super::tests::owned_containers(&docker).await, before);
        });
    }
}
