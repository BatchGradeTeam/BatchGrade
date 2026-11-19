import { invoke } from "@tauri-apps/api/core";

/** Mirrors `DockerStatus` in `src-tauri/src/docker.rs`. */
export type DockerStatus =
  | { status: "available"; version: string | null }
  | { status: "notInstalled" }
  | { status: "notRunning"; canStart: boolean }
  | { status: "error"; detail: string };

export function checkDockerStatus(): Promise<DockerStatus> {
  return invoke<DockerStatus>("check_docker_status");
}

/** Starts Docker Desktop, waits for it, and returns the new status. */
export function startDockerDesktop(): Promise<DockerStatus> {
  return invoke<DockerStatus>("start_docker_desktop");
}
