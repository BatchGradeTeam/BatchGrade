import { useEffect, useState } from 'react'
import type { CompileCppResult, GccInstallationInfo, RunCppResult } from '../../../shared/compiler'

type CppWorkflowPanelProps = {
  title: string
  description: string
  allowExecution: boolean
  onSelectionChange?: (files: string[]) => void
  onCompileResultChange?: (result: CompileCppResult | null) => void
}

export function CppWorkflowPanel({
  title,
  description,
  allowExecution,
  onSelectionChange,
  onCompileResultChange
}: CppWorkflowPanelProps): React.JSX.Element {
  const [gccStatus, setGccStatus] = useState<GccInstallationInfo | null>(null)
  const [compileResult, setCompileResult] = useState<CompileCppResult | null>(null)
  const [runResult, setRunResult] = useState<RunCppResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [manualPath, setManualPath] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [stdinText, setStdinText] = useState('')
  const [isCompiling, setIsCompiling] = useState(false)
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    window.api.compiler
      .getGccStatus()
      .then((result) => {
        setGccStatus(result)
      })
      .catch((error) => {
        console.error('Error getting GCC status:', error)
        setErrorMessage('Could not load GCC status.')
      })
  }, [])

  useEffect(() => {
    onSelectionChange?.(selectedFiles)
  }, [onSelectionChange, selectedFiles])

  useEffect(() => {
    onCompileResultChange?.(compileResult)
  }, [compileResult, onCompileResultChange])

  function handleSetManualPath(): void {
    window.api.compiler
      .setGccPath(manualPath)
      .then((result) => {
        setGccStatus(result)
        setErrorMessage(null)
      })
      .catch((error) => {
        console.error('Error setting GCC path:', error)
        setErrorMessage('Could not save manual GCC path.')
      })
  }

  function handleSelectCppFiles(): void {
    window.api.file
      .selectCppFiles()
      .then((files) => {
        setSelectedFiles(files)
        setCompileResult(null)
        setRunResult(null)
        setErrorMessage(null)
      })
      .catch((error) => {
        console.error('Error selecting C++ files:', error)
        setErrorMessage('Could not select C++ files.')
      })
  }

  function handleCompileCpp(): void {
    setIsCompiling(true)
    setErrorMessage(null)
    setCompileResult(null)
    setRunResult(null)

    window.api.compiler
      .compileCpp({
        sourceFiles: selectedFiles
      })
      .then((result) => {
        setCompileResult(result)
      })
      .catch((error) => {
        console.error('Error compiling C++ files:', error)
        setErrorMessage('Could not compile the selected files.')
      })
      .finally(() => {
        setIsCompiling(false)
      })
  }

  function handleRunProgram(): void {
    if (!compileResult?.executablePath) {
      setErrorMessage('Compile the program first.')
      return
    }

    setIsRunning(true)
    setErrorMessage(null)
    setRunResult(null)

    window.api.compiler
      .runCompiledProgram({
        executablePath: compileResult.executablePath,
        stdin: stdinText,
        timeoutMs: 5000
      })
      .then((result) => {
        setRunResult(result)
      })
      .catch((error) => {
        console.error('Error running compiled program:', error)
        setErrorMessage('Could not run the compiled program.')
      })
      .finally(() => {
        setIsRunning(false)
      })
  }

  return (
    <div style={{ display: 'grid', gap: '1rem', marginTop: '2rem' }}>
      <div
        style={{
          border: '1px solid gray',
          padding: '1rem',
          backgroundColor: '#2b2b2b'
        }}
      >
        <h2 style={{ marginBottom: '0.4rem' }}>{title}</h2>
        <p style={{ marginBottom: '1rem' }}>{description}</p>

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
                <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
                  <p>Status: {gccStatus.status}</p>
                  <p>Message: {gccStatus.message}</p>
                  <p>Platform: {gccStatus.platform}</p>
                  <p>Path: {gccStatus.path ?? 'Not set'}</p>
                  {gccStatus.installInstruction && <p>Install: {gccStatus.installInstruction}</p>}
                </div>
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
              <button onClick={handleSetManualPath} className="primary-button">
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

            <button onClick={handleSelectCppFiles} className="primary-button">
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
              onClick={handleCompileCpp}
              disabled={isCompiling || selectedFiles.length === 0}
              className={
                isCompiling || selectedFiles.length === 0 ? 'cancel-button' : 'secondary-button'
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
                onClick={handleRunProgram}
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
