import { invoke } from "@tauri-apps/api/core";

/** Mirrors `DockerStatus` in `src-tauri/src/docker.rs`. */
export type DockerStatus =
  | { status: "available"; version: string | null }
  | { status: "notInstalled" }
  | { status: "notRunning"; canStart: boolean }
  | { status: "error"; detail: string };

export type CppEnvironmentStatus =
  | { status: "ready" }
  | { status: "imageMissing" }
  | { status: "localImageMissing" }
  | { status: "unsupported"; detail: string }
  | { status: "error"; detail: string };

export function checkDockerStatus(): Promise<DockerStatus> {
  return invoke<DockerStatus>("check_docker_status");
}

/** Starts Docker Desktop, waits for it, and returns the new status. */
export function startDockerDesktop(): Promise<DockerStatus> {
  return invoke<DockerStatus>("start_docker_desktop");
}

export function checkCppEnvironment(): Promise<CppEnvironmentStatus> {
  return invoke<CppEnvironmentStatus>("check_cpp_environment");
}

export function provisionCppEnvironment(): Promise<CppEnvironmentStatus> {
  return invoke<CppEnvironmentStatus>("provision_cpp_environment");
}
