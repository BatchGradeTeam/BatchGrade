import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  checkDockerStatus,
  startDockerDesktop,
  type DockerStatus,
} from "@/lib/docker";

type Activity = "checking" | "starting";

const CHECK_FAILED = "Could not check Docker. Please try again.";
const START_FAILED = "Could not start Docker Desktop. Please try again.";

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

export function DockerPreflight() {
  const [status, setStatus] = useState<DockerStatus | null>(null);
  // Starts as "checking" because the first check begins when the panel opens.
  const [activity, setActivity] = useState<Activity | null>("checking");
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    checkDockerStatus().then(
      (result) => {
        if (!ignore) {
          setStatus(result);
          setActivity(null);
        }
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

    try {
      setStatus(await action());
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

  const message = activity
    ? ACTIVITY_MESSAGES[activity]
    : (failure ?? (status ? describeStatus(status) : CHECK_FAILED));
  const canStart = status?.status === "notRunning" && status.canStart;

  return (
    <section aria-labelledby="docker-preflight-heading" className="mt-6">
      <h2 id="docker-preflight-heading" className="text-lg font-semibold">
        Docker
      </h2>
      <p className="px-4" aria-live="polite">
        {message}
      </p>
      <div className="row gap-2">
        <Button
          variant="outline"
          onClick={refresh}
          disabled={activity !== null}
        >
          Refresh
        </Button>
        {canStart && (
          <Button onClick={start} disabled={activity !== null}>
            Start Docker Desktop
          </Button>
        )}
      </div>
    </section>
  );
}
