import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { DockerPreflight } from "@/components/docker-preflight";
import "./App.css";

function App() {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function selectFile() {
    setIsSelecting(true);
    setError(null);

    try {
      const path = await open({
        title: "Select C++ file",
        multiple: false,
        directory: false,
        filters: [{ name: "C++ source files", extensions: ["cpp"] }],
      });

      if (path !== null) {
        setSelectedPath(path);
      }
    } catch {
      setError("Unable to open the file picker. Please try again.");
    } finally {
      setIsSelecting(false);
    }
  }

  return (
    <main className="container text-blue-300">
      <h1>BatchGrade V2</h1>
      <p>
        A local-first desktop application for grading programming assignments.
      </p>
      <p>Application in development.</p>
      <div>
        <Button onClick={selectFile} disabled={isSelecting}>
          Select C++ file
        </Button>
      </div>
      {selectedPath && (
        <p className="px-4 break-all" role="status">
          Selected file: {selectedPath}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <DockerPreflight />
    </main>
  );
}

export default App;
