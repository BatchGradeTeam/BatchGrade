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
 */
import type { CompileCppResult } from '../../../../shared/compiler'
import { useCppWorkflow } from '../../components/compiler/useCPPWorkflow'

type CppWorkflowPanelProps = {
  title: string
  description: string
  allowExecution: boolean
  onSelectionChange?: (files: string[]) => void
  onCompileResultChange?: (result: CompileCppResult | null) => void
  autoCompileOnSelection?: boolean
}

/**
 * CppWorkflowPanel Component
 *
 * This component provides a user interface for compiling and optionally running C++ code
 * within the BatchGrade application. It is designed to be used in both the StudentDashboard
 * and StudentUploadInterface pages, allowing students to select their C++ source files,
 * compile them locally, and review the results before submission.
 * @param {CppWorkflowPanelProps} props - The properties for the CppWorkflowPanel component
 * @returns {React.JSX.Element} The rendered CppWorkflowPanel component
 */
export function CppWorkflowPanel({
  title,
  description,
  allowExecution,
  onSelectionChange,
  onCompileResultChange,
  autoCompileOnSelection = false
}: CppWorkflowPanelProps): React.JSX.Element {
  const {
    gccStatus,
    compileResult,
    runResult,
    errorMessage,
    manualPath,
    selectedFiles,
    stdinText,
    isCompiling,
    isRunning,
    setManualPath,
    setStdinText,
    handleSetManualPath,
    handleSelectCppFiles,
    handleCompileCpp,
    handleRunProgram
  } = useCppWorkflow({
    onSelectionChange,
    onCompileResultChange,
    autoCompileOnSelection
  })

  const isCompilerReady = gccStatus?.status === 'ready' && !!gccStatus.path

  return (
    <div className="cpp-container">
      <div className="cpp-item">
        <h2 className="cpp-title">{title}</h2>
        <p className="cpp-description">{description}</p>

        {errorMessage && (
          <div
            style={{
              backgroundColor: '#5a1f1f',
              border: '1px solid red',
              padding: '10px',
              marginBottom: '1rem'
            }}
          >
            <p>{errorMessage}</p>
          </div>
        )}

        <div
          style={{
            border: '1px solid gray',
            padding: '12px',
            marginBottom: '12px',
            backgroundColor: '#1f1f1f'
          }}
        >
          <h3 style={{ marginBottom: '8px', fontSize: '20px' }}>Compiler Status</h3>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.1fr 1.2fr',
              gap: '14px',
              alignItems: 'start'
            }}
          >
            <div>
              {!gccStatus && !errorMessage && <p>Checking for GCC...</p>}

              {gccStatus && (
                <>
                  <p>
                    <strong>Status:</strong> {gccStatus.status}
                  </p>
                  <p>
                    <strong>Message:</strong> {gccStatus.message}
                  </p>
                  <p>
                    <strong>Platform:</strong> {gccStatus.platform}
                  </p>
                  <p>
                    <strong>Path:</strong> {gccStatus.path ?? 'Not set'}
                  </p>
                  {gccStatus.installInstruction && (
                    <p>
                      <strong>Install Help:</strong> {gccStatus.installInstruction}
                    </p>
                  )}
                </>
              )}
            </div>

            <div>
              <h4 style={{ marginBottom: '8px', fontSize: '16px' }}>Set Compiler Path Manually</h4>
              <input
                type="text"
                value={manualPath}
                onChange={(e) => setManualPath(e.target.value)}
                placeholder="Enter full path to g++, c++, or clang++"
                style={{
                  width: '100%',
                  padding: '8px',
                  marginBottom: '8px',
                  backgroundColor: '#111',
                  color: 'white',
                  border: '1px solid #6b7280'
                }}
              />
              <button onClick={() => void handleSetManualPath()} className="primary-button">
                Save Compiler Path
              </button>
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: allowExecution ? '1fr 1fr' : '1fr',
            gap: '12px'
          }}
        >
          <div
            style={{
              border: '1px solid gray',
              padding: '12px',
              backgroundColor: '#1f1f1f'
            }}
          >
            <h3 style={{ marginBottom: '10px', fontSize: '20px' }}>Compile C++ Files</h3>

            <button onClick={() => void handleSelectCppFiles()} className="primary-button">
              Choose C++ Files
            </button>

            {selectedFiles.length > 0 && (
              <div style={{ marginTop: '10px', fontSize: '14px' }}>
                <p>Selected Files:</p>
                <ul
                  style={{
                    paddingLeft: '20px',
                    marginTop: '6px',
                    maxHeight: '120px',
                    overflowY: 'auto'
                  }}
                >
                  {selectedFiles.map((file) => (
                    <li key={file} style={{ marginBottom: '6px', overflowWrap: 'anywhere' }}>
                      {file}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={() => void handleCompileCpp()}
              disabled={isCompiling || selectedFiles.length === 0 || !isCompilerReady}
              className={
                isCompiling || selectedFiles.length === 0 || !isCompilerReady
                  ? 'cancel-button'
                  : 'secondary-button'
              }
              style={{ marginTop: '10px' }}
            >
              {isCompiling ? 'Compiling...' : 'Compile'}
            </button>

            {compileResult && (
              <div style={{ marginTop: '12px', borderTop: '1px solid gray', paddingTop: '10px' }}>
                <h4 style={{ fontSize: '17px' }}>Compile Result</h4>
                <div style={{ fontSize: '14px', lineHeight: '1.45' }}>
                  <p>Message: {compileResult.message}</p>
                  <p>Compile Success: {compileResult.compileSuccess ? 'Yes' : 'No'}</p>
                  <p>Compiler: {compileResult.compilerPath ?? 'Not available'}</p>
                  {compileResult.executablePath && (
                    <p>Executable: {compileResult.executablePath}</p>
                  )}
                </div>

                <h5 style={{ marginTop: '10px', fontSize: '15px' }}>Compiler Output</h5>
                <pre
                  style={{
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                    backgroundColor: '#111',
                    padding: '8px',
                    border: '1px solid gray',
                    marginTop: '6px',
                    maxHeight: '160px',
                    overflowY: 'auto',
                    fontSize: '12px'
                  }}
                >
                  {compileResult.stderr || compileResult.stdout || 'No compiler output.'}
                </pre>
              </div>
            )}
          </div>

          {allowExecution && (
            <div
              style={{
                border: '1px solid gray',
                padding: '12px',
                backgroundColor: '#1f1f1f'
              }}
            >
              <h3 style={{ marginBottom: '10px', fontSize: '20px' }}>Run Program</h3>

              <textarea
                value={stdinText}
                onChange={(e) => setStdinText(e.target.value)}
                placeholder="Optional program input"
                style={{
                  width: '100%',
                  minHeight: '100px',
                  padding: '8px',
                  backgroundColor: '#111',
                  color: 'white',
                  border: '1px solid #6b7280',
                  fontSize: '13px'
                }}
              />

              <button
                onClick={() => void handleRunProgram()}
                disabled={
                  isRunning || !compileResult?.compileSuccess || !compileResult.executablePath
                }
                className={
                  isRunning || !compileResult?.compileSuccess || !compileResult.executablePath
                    ? 'cancel-button'
                    : 'primary-button'
                }
                style={{ marginTop: '10px' }}
              >
                {isRunning ? 'Running...' : 'Run'}
              </button>

              {runResult && (
                <div style={{ marginTop: '12px', borderTop: '1px solid gray', paddingTop: '10px' }}>
                  <h4 style={{ fontSize: '17px' }}>Run Result</h4>
                  <div style={{ fontSize: '14px', lineHeight: '1.45' }}>
                    <p>Message: {runResult.message}</p>
                    <p>Execution Success: {runResult.executionSuccess ? 'Yes' : 'No'}</p>
                    <p>Timed Out: {runResult.timedOut ? 'Yes' : 'No'}</p>
                  </div>

                  <h5 style={{ marginTop: '10px', fontSize: '15px' }}>Program Output</h5>
                  <pre
                    style={{
                      whiteSpace: 'pre-wrap',
                      overflowWrap: 'anywhere',
                      backgroundColor: '#111',
                      padding: '8px',
                      border: '1px solid gray',
                      marginTop: '6px',
                      maxHeight: '160px',
                      overflowY: 'auto',
                      fontSize: '12px'
                    }}
                  >
                    {runResult.stdout || runResult.stderr || 'No program output.'}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
