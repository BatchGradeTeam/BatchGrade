import './CppWorkflowPanel.css'
/**
 * CppWorkflowPanel.tsx
 *
 * Description:
 * This component provides a user interface for compiling and optionally running C++ code
 * within the BatchGrade application. It is designed to be used in both the StudentDashboard
 * and StudentUploadInterface pages, allowing students to select their C++ source files,
 * compile them locally, and review the results before submission.
 *
 * The panel includes:
 *  - A section for checking GCC compiler status and setting a manual path if needed
 *  - A section for selecting C++ files and compiling them, with output display
 *  - An optional section for running the compiled executable with custom input
 *
 *  onRunResultChange is passed down into useCppWorkflow so the parent page
 *  can receive runResult.stdout and feed it into OutputDiffPanel.
 */
import type { CompileCppResult, RunCppResult } from '../../../../shared/compiler'
import { useCppWorkflow } from '../../components/compiler/useCPPWorkflow'

type CppWorkflowPanelProps = {
  title: string
  description: string
  allowExecution: boolean
  onSelectionChange?: (files: string[]) => void
  onCompileResultChange?: (result: CompileCppResult | null) => void
  onRunResultChange?: (result: RunCppResult | null) => void
  autoCompileOnSelection?: boolean
}

export function CppWorkflowPanel({
  title,
  description,
  allowExecution,
  onSelectionChange,
  onCompileResultChange,
  onRunResultChange,
  autoCompileOnSelection = false
}: CppWorkflowPanelProps): React.JSX.Element {
  const {
    compileResult,
    runResult,
    errorMessage,
    selectedFiles,
    stdinText,
    isCompiling,
    isRunning,
    setStdinText,
    handleSelectCppFiles,
    handleCompileCpp,
    handleRunProgram
  } = useCppWorkflow({
    onSelectionChange,
    onCompileResultChange,
    onRunResultChange,
    autoCompileOnSelection
  })

  const compileStatus = compileResult
    ? compileResult.compileSuccess
      ? 'Compiled'
      : 'Failed'
    : 'Waiting'

  const compileStatusClass = compileResult
    ? compileResult.compileSuccess
      ? 'success'
      : 'failed'
    : 'waiting'

  return (
    <div className="cpp-workflow-page">
      <div className="cpp-workflow-grid">
        <section className="cpp-card cpp-submission-card">
          <div className="cpp-section-header">
            <h2 className="cpp-section-title">{title}</h2>
            <p className="cpp-section-description">{description}</p>
          </div>

          {errorMessage && (
            <div className="cpp-alert cpp-alert-error">
              <p>{errorMessage}</p>
            </div>
          )}

          <div className="cpp-form-section">
            <label className="cpp-label">Selected C++ Files</label>

            <button
              type="button"
              onClick={() => void handleSelectCppFiles()}
              className="cpp-button cpp-button-secondary"
            >
              Choose C++ Files
            </button>

            <div className="cpp-file-list">
              {selectedFiles.length > 0 ? (
                selectedFiles.map((file) => (
                  <div key={file} className="cpp-file-item">
                    {file}
                  </div>
                ))
              ) : (
                <div className="cpp-file-list-empty">
                  No files selected yet
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleCompileCpp()}
            disabled={isCompiling || selectedFiles.length === 0}
            className="cpp-button cpp-button-primary cpp-button-full"
          >
            {isCompiling ? 'Compiling...' : 'Compile'}
          </button>
        </section>

        <section className="cpp-results-column">
          <div className="cpp-card cpp-summary-card">
            <div>
              <p className="cpp-summary-label">Compilation Status</p>
              <h2 className="cpp-summary-title">{compileStatus}</h2>
              <p className="cpp-summary-subtitle">
                {compileResult
                  ? compileResult.message
                  : 'Choose files and compile to see results'}
              </p>
            </div>

            <span className={`cpp-status-pill ${compileStatusClass}`}>
              {compileStatus}
            </span>
          </div>

          {compileResult && (
            <div className="cpp-card cpp-terminal-card">
              <div className="cpp-card-header">
                <h3>Compiler Output</h3>
              </div>

              <div className="cpp-terminal-window">
                <pre className="cpp-terminal-content">
                  {compileResult.stderr ||
                    compileResult.stdout ||
                    'No compiler output'}
                </pre>
              </div>

              <div className="cpp-result-meta">
                <div className="cpp-result-meta-item">
                  <span className="cpp-result-meta-label">Success</span>
                  <span className="cpp-result-meta-value">
                    {compileResult.compileSuccess ? 'Yes' : 'No'}
                  </span>
                </div>

                <div className="cpp-result-meta-item">
                  <span className="cpp-result-meta-label">Compiler</span>
                  <span className="cpp-result-meta-value cpp-break">
                    {compileResult.compilerPath ?? 'Unknown'}
                  </span>
                </div>

                <div className="cpp-result-meta-item cpp-result-meta-item-full">
                  <span className="cpp-result-meta-label">Executable</span>
                  <span className="cpp-result-meta-value cpp-break">
                    {compileResult.executablePath ?? 'Not generated'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {allowExecution && compileResult?.compileSuccess && (
            <div
              className={`cpp-card cpp-execution-card ${
                runResult ? 'cpp-execution-card-has-output' : ''
              }`}
            >
              <div className="cpp-card-header">
                <h3>Run Program</h3>
              </div>

              <label className="cpp-label" htmlFor="stdin-input">
                Program Input
              </label>

              <textarea
                id="stdin-input"
                value={stdinText}
                onChange={(e) => setStdinText(e.target.value)}
                placeholder="Optional input for your program..."
                className="cpp-textarea"
              />

              <button
                type="button"
                onClick={() => void handleRunProgram()}
                disabled={isRunning}
                className="cpp-button cpp-button-primary"
              >
                {isRunning ? 'Running...' : 'Run Program'}
              </button>

              {runResult && (
                <>
                  <div className="cpp-run-output">
                    <h4 className="cpp-run-output-title">Execution Output</h4>

                    <div className="cpp-terminal-window cpp-run-output-window">
                      <pre className="cpp-terminal-content cpp-run-output-content">
                        {runResult.stdout ||
                          runResult.stderr ||
                          'No program output'}
                      </pre>
                    </div>
                  </div>

                  <div className="cpp-result-meta">
                    <div className="cpp-result-meta-item">
                      <span className="cpp-result-meta-label">
                        Execution Success
                      </span>
                      <span className="cpp-result-meta-value">
                        {runResult.executionSuccess ? 'Yes' : 'No'}
                      </span>
                    </div>

                    <div className="cpp-result-meta-item">
                      <span className="cpp-result-meta-label">Timed Out</span>
                      <span className="cpp-result-meta-value">
                        {runResult.timedOut ? 'Yes' : 'No'}
                      </span>
                    </div>

                    <div className="cpp-result-meta-item cpp-result-meta-item-full">
                      <span className="cpp-result-meta-label">Message</span>
                      <span className="cpp-result-meta-value">
                        {runResult.message}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default CppWorkflowPanel