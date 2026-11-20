import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DockerPreflight } from "@/components/docker-preflight";
import {
  runCppSource,
  selectCppSource,
  type CppRunResult,
  type StageResult,
  type StageStatus,
} from "@/lib/cpp";
import "./App.css";

const STATUS_TEXT: Record<StageStatus, string> = {
  success: "Succeeded",
  compileError: "Compilation failed",
  runtimeError: "Program failed",
  timeLimitExceeded: "Time limit exceeded",
  outputLimitExceeded: "Output limit exceeded",
  memoryLimitExceeded: "Memory limit exceeded",
};

function describeResult(result: StageResult) {
  const exit =
    result.exitCode === null ? "" : ` · Exit code ${result.exitCode}`;
  return `${STATUS_TEXT[result.status]}${exit} · ${result.durationMs} ms`;
}

function App() {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CppRunResult | null>(null);

  async function selectFile() {
    setIsSelecting(true);
    setError(null);

    try {
      const path = await selectCppSource();

      if (path !== null) {
        setSelectedPath(path);
        setResult(null);
      }
    } catch {
      setError("Unable to open the file picker. Please try again.");
    } finally {
      setIsSelecting(false);
    }
  }

  async function compileAndRun() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      setResult(await runCppSource());
    } catch (reason) {
      setError(
        typeof reason === "string"
          ? reason
          : "Could not compile and run the selected file.",
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="container text-blue-300">
      <h1>BatchGrade V2</h1>
      <p>
        A local-first desktop application for grading programming assignments.
      </p>
      <p>Application in development.</p>
      <div className="flex justify-center gap-2">
        <Button onClick={selectFile} disabled={isSelecting || running}>
          Select C++ file
        </Button>
        <Button
          onClick={compileAndRun}
          disabled={!selectedPath || isSelecting || running}
        >
          Compile and run
        </Button>
      </div>
      {selectedPath && (
        <p className="px-4 break-all" role="status">
          Selected file: {selectedPath}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <div aria-live="polite">
        {running && <p>Compiling and running…</p>}
        {result && (
          <section
            aria-label="C++ results"
            className="mx-auto mt-4 w-full max-w-2xl space-y-2 px-4 text-left"
          >
            <h2 className="text-lg font-semibold">Compilation</h2>
            <p>{describeResult(result.compilation)}</p>
            {result.compilation.stderr && (
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words">
                {result.compilation.stderr}
              </pre>
            )}
            {result.execution && (
              <>
                <h2 className="text-lg font-semibold">Program output</h2>
                <p>{describeResult(result.execution)}</p>
                <pre
                  aria-label="Standard output"
                  className="max-h-48 overflow-auto whitespace-pre-wrap break-words"
                >
                  {result.execution.stdout || "No output."}
                </pre>
                {result.execution.stderr && (
                  <>
                    <h3 className="font-semibold">Standard error</h3>
                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words">
                      {result.execution.stderr}
                    </pre>
                  </>
                )}
              </>
            )}
          </section>
        )}
      </div>
      <DockerPreflight />
    </main>
  );
}

export default App;
