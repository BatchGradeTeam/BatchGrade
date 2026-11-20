import { invoke } from "@tauri-apps/api/core";

export type StageStatus =
  | "success"
  | "compileError"
  | "runtimeError"
  | "timeLimitExceeded"
  | "outputLimitExceeded"
  | "memoryLimitExceeded";

export type StageResult = {
  status: StageStatus;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
};

export type CppRunResult = {
  compilation: StageResult;
  execution: StageResult | null;
};

export function selectCppSource(): Promise<string | null> {
  return invoke<string | null>("select_cpp_source");
}

export function runCppSource(): Promise<CppRunResult> {
  return invoke<CppRunResult>("run_cpp_source");
}
