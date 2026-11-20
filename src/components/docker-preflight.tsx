import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  checkCppEnvironment,
  checkDockerStatus,
  provisionCppEnvironment,
  startDockerDesktop,
  type CppEnvironmentStatus,
  type DockerStatus,
} from "@/lib/docker";

type Activity = "checking" | "starting";

const CHECK_FAILED = "Could not check Docker. Please try again.";
const START_FAILED = "Could not start Docker Desktop. Please try again.";
const COMPILER_CHECK_FAILED =
  "Could not check the C++ compiler. Refresh to retry.";
const COMPILER_DOWNLOAD_FAILED =
  "Could not download the C++ compiler. Please try again.";

const ACTIVITY_MESSAGES: Record<Activity, string> = {
  checking: "Checking Docker…",
  starting: "Starting Docker Desktop… This can take a minute.",
};

function describeStatus(status: DockerStatus): string {
  switch (status.status) {
    case "available":
      return status.version
        ? `Docker is available (Engine ${status.version}).`
        : "Docker is available.";
    case "notInstalled":
      return "Docker is not installed. Install Docker Desktop or Docker Engine, then refresh.";
    case "notRunning":
      return status.canStart
        ? "Docker Desktop is not running."
        : "Docker is not running. Start the Docker service, then refresh.";
    case "error":
      return `Could not check Docker: ${status.detail}`;
  }
}

function describeCompiler(status: CppEnvironmentStatus | null): string {
  switch (status?.status) {
    case "ready":
      return "The C++ compiler is ready.";
    case "imageMissing":
      return "Download the compiler image to set up C++ compilation.";
    case "unsupported":
    case "error":
      return status.detail;
    default:
      return "Checking the C++ compiler…";
  }
}

async function readCompiler(): Promise<CppEnvironmentStatus> {
  try {
    return await checkCppEnvironment();
  } catch {
    return { status: "error", detail: COMPILER_CHECK_FAILED };
  }
}

export function DockerPreflight() {
  const [status, setStatus] = useState<DockerStatus | null>(null);
  // Starts as "checking" because the first check begins when the panel opens.
  const [activity, setActivity] = useState<Activity | null>("checking");
  const [failure, setFailure] = useState<string | null>(null);
  const [compiler, setCompiler] = useState<CppEnvironmentStatus | null>(null);
  const [downloadFailure, setDownloadFailure] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let ignore = false;

    checkDockerStatus().then(
      async (result) => {
        if (ignore) return;
        setStatus(result);
        const nextCompiler =
          result.status === "available" ? await readCompiler() : null;
        if (ignore) return;
        setCompiler(nextCompiler);
        setActivity(null);
      },
      () => {
        if (!ignore) {
          setFailure(CHECK_FAILED);
          setActivity(null);
        }
      },
    );

    return () => {
      ignore = true;
    };
  }, []);

  async function run(
    nextActivity: Activity,
    action: () => Promise<DockerStatus>,
    failureMessage: string,
  ) {
    setActivity(nextActivity);
    setFailure(null);
    setCompiler(null);
    setDownloadFailure(null);

    try {
      const result = await action();
      setStatus(result);
      if (result.status === "available") setCompiler(await readCompiler());
    } catch {
      setFailure(failureMessage);
    } finally {
      setActivity(null);
    }
  }

  function refresh() {
    return run("checking", checkDockerStatus, CHECK_FAILED);
  }

  function start() {
    return run("starting", startDockerDesktop, START_FAILED);
  }

  async function download() {
    setDownloading(true);
    setDownloadFailure(null);
    try {
      const result = await provisionCppEnvironment();
      if (result.status === "error") {
        setDownloadFailure(result.detail);
      } else {
        setCompiler(result);
      }
    } catch {
      setDownloadFailure(COMPILER_DOWNLOAD_FAILED);
    } finally {
      setDownloading(false);
    }
  }

  const message =
    activity && status?.status !== "available"
      ? ACTIVITY_MESSAGES[activity]
      : (failure ?? (status ? describeStatus(status) : CHECK_FAILED));
  const canStart = status?.status === "notRunning" && status.canStart;
  const busy = activity !== null || downloading;

  return (
    <section aria-labelledby="docker-preflight-heading" className="mt-6">
      <h2 id="docker-preflight-heading" className="text-lg font-semibold">
        Docker
      </h2>
      <p className="px-4" aria-live="polite">
        {message}
      </p>
      <div className="row gap-2">
        <Button variant="outline" onClick={refresh} disabled={busy}>
          Refresh
        </Button>
        {canStart && (
          <Button onClick={start} disabled={busy}>
            Start Docker Desktop
          </Button>
        )}
      </div>
      {status?.status === "available" && !failure && (
        <section aria-labelledby="cpp-environment-heading" className="mt-4">
          <h3 id="cpp-environment-heading">C++ compiler</h3>
          <p className="px-4" aria-live="polite">
            {downloading
              ? "Downloading the C++ compiler…"
              : describeCompiler(compiler)}
          </p>
          {downloadFailure && <p role="alert">{downloadFailure}</p>}
          {compiler?.status === "imageMissing" && (
            <Button variant="outline" onClick={download} disabled={busy}>
              Download compiler
            </Button>
          )}
        </section>
      )}
    </section>
  );
}
