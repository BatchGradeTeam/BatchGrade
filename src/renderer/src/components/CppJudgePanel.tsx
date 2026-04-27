import { useEffect, useMemo, useState, useRef, useEffectEvent } from 'react'
import type { CompileCppResult, JudgeCppResult } from '../../../shared/compiler'
import '../assets/styles/CppJudgePanel.css'

type JudgeCaseResult = {
  id: string
  label: string
  inputFile: string | null
  outputFile: string
  result: JudgeCppResult
}

type CppJudgePanelProps = {
  compileResult: CompileCppResult | null
}

function getFileName(filePath: string): string {
  const parts = filePath.split(/[/\\]/)
  return parts[parts.length - 1] || filePath
}

function appendUniqueFile(files: string[], nextFile: string | undefined): string[] {
  if (!nextFile || files.includes(nextFile)) {
    return files
  }

  return [...files, nextFile]
}

export function CppJudgePanel({ compileResult }: CppJudgePanelProps): React.JSX.Element {
  const [selectedOutputFiles, setSelectedOutputFiles] = useState<string[]>([])
  const [selectedInputFiles, setSelectedInputFiles] = useState<string[]>([])
  const [judgeResults, setJudgeResults] = useState<JudgeCaseResult[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isJudging, setIsJudging] = useState(false)
  const lastAutoJudgeRequestRef = useRef<string | null>(null)

  const runAutomaticJudge = useEffectEvent(() => {
    void handleRunJudge()
  })

  useEffect(() => {
    setJudgeResults([])
    setErrorMessage(null)
    lastAutoJudgeRequestRef.current = null
  }, [compileResult?.executablePath, compileResult?.compileSuccess])

  const summary = useMemo(() => {
    const passedCount = judgeResults.filter((test) => test.result.passed).length
    return {
      totalCount: judgeResults.length,
      passedCount
    }
  }, [judgeResults])

  function handleSelectOutputFiles(): void {
    window.api.file
      .select()
      .then((file) => {
        lastAutoJudgeRequestRef.current = null
        setSelectedOutputFiles((currentFiles) => appendUniqueFile(currentFiles, file))
        setJudgeResults([])
        setErrorMessage(null)
      })
      .catch((error) => {
        console.error('Error selecting output files:', error)
        setErrorMessage('Could not select expected output files.')
      })
  }

  function handleSelectInputFiles(): void {
    window.api.file
      .select()
      .then((file) => {
        lastAutoJudgeRequestRef.current = null
        setSelectedInputFiles((currentFiles) => appendUniqueFile(currentFiles, file))
        setJudgeResults([])
        setErrorMessage(null)
      })
      .catch((error) => {
        console.error('Error selecting input files:', error)
        setErrorMessage('Could not select input files.')
      })
  }

  async function handleRunJudge(): Promise<void> {
    if (!compileResult?.compileSuccess || !compileResult.executablePath) {
      setErrorMessage('Compile successfully before running judge tests.')
      return
    }

    if (selectedOutputFiles.length === 0) {
      setErrorMessage('Select at least one expected output file.')
      return
    }

    if (selectedInputFiles.length > 0 && selectedInputFiles.length !== selectedOutputFiles.length) {
      setErrorMessage('When input files are provided, they must match the number of output files.')
      return
    }

    setIsJudging(true)
    setJudgeResults([])
    setErrorMessage(null)

    try {
      const expectedOutputs = await Promise.all(
        selectedOutputFiles.map((filePath) => window.api.file.stringify(filePath))
      )

      const stdinValues =
        selectedInputFiles.length === 0
          ? selectedOutputFiles.map(() => '')
          : await Promise.all(
              selectedInputFiles.map((filePath) => window.api.file.stringify(filePath))
            )

      const nextResults: JudgeCaseResult[] = []

      for (const [index, outputFile] of selectedOutputFiles.entries()) {
        const inputFile = selectedInputFiles[index] ?? null
        const result = await window.api.compiler.judgeCpp({
          executablePath: compileResult.executablePath,
          stdin: stdinValues[index] ?? '',
          expectedOutput: expectedOutputs[index] ?? '',
          timeoutMs: 5000
        })

        nextResults.push({
          id: `${outputFile}-${index}`,
          label: `Test ${index + 1}`,
          inputFile,
          outputFile,
          result
        })
      }

      setJudgeResults(nextResults)
    } catch (error) {
      console.error('Error running judge tests:', error)
      setErrorMessage('Could not run the judge tests.')
    } finally {
      setIsJudging(false)
    }
  }

  useEffect(() => {
    if (!compileResult?.compileSuccess || !compileResult.executablePath) {
      return
    }

    if (selectedOutputFiles.length === 0) {
      return
    }

    if (selectedInputFiles.length > 0 && selectedInputFiles.length !== selectedOutputFiles.length) {
      return
    }

    const requestKey = [
      compileResult.executablePath,
      ...selectedOutputFiles,
      'inputs',
      ...selectedInputFiles
    ].join('::')

    if (isJudging || lastAutoJudgeRequestRef.current === requestKey) {
      return
    }

    lastAutoJudgeRequestRef.current = requestKey
    runAutomaticJudge()
  }, [
    compileResult?.compileSuccess,
    compileResult?.executablePath,
    isJudging,
    selectedInputFiles,
    selectedOutputFiles
  ])

  return (
    <div className="cpp-judge-panel panel-shell">
      <div className="judge-header">
        <h2 className="judge-title">Judge Test Cases</h2>
        <p className="judge-description">
          Add expected output files and optional input files. When both lists are present, files are
          paired by index and run as individual judge cases.
        </p>
      </div>

      {errorMessage && (
        <div className="judge-error-alert">
          {errorMessage}
        </div>
      )}

      <div className="judge-grid">
        <div className="judge-section-card">
          <div className="judge-section-header">
            <h3 className="judge-section-title">Optional Input Files</h3>
            <p className="judge-section-description">
              These files provide stdin for each test case.
            </p>
          </div>

          <div className="judge-button-group">
            <button onClick={handleSelectInputFiles} className="secondary-button">
              Add Input File
            </button>

            <button
              onClick={() => {
                setSelectedInputFiles([])
                setJudgeResults([])
                setErrorMessage(null)
              }}
              disabled={selectedInputFiles.length === 0}
              className={selectedInputFiles.length === 0 ? 'cancel-button' : 'secondary-button'}
            >
              Clear Input Files
            </button>
          </div>

          <div className="judge-file-count">
            {selectedInputFiles.length} input file{selectedInputFiles.length === 1 ? '' : 's'}{' '}
            selected
          </div>

          {selectedInputFiles.length > 0 && (
            <ul className="judge-file-list">
              {selectedInputFiles.map((filePath) => (
                <li
                  key={filePath}
                  className="judge-file-list-item"
                >
                  {getFileName(filePath)}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="judge-section-card judge-section-card-output">
          <div className="judge-section-header">
            <h3 className="judge-section-title">Expected Output Files</h3>
            <p className="judge-section-description">
              These files are used as the expected results for each test.
            </p>
          </div>

          <div className="judge-button-group">
            <button onClick={handleSelectOutputFiles} className="primary-button">
              Add Output File
            </button>

            <button
              onClick={() => {
                setSelectedOutputFiles([])
                setJudgeResults([])
                setErrorMessage(null)
              }}
              disabled={selectedOutputFiles.length === 0}
              className={selectedOutputFiles.length === 0 ? 'cancel-button' : 'secondary-button'}
            >
              Clear Output Files
            </button>
          </div>

          <div className="judge-file-count">
            {selectedOutputFiles.length} output file{selectedOutputFiles.length === 1 ? '' : 's'}{' '}
            selected
          </div>

          {selectedOutputFiles.length > 0 && (
            <ul className="judge-file-list">
              {selectedOutputFiles.map((filePath) => (
                <li
                  key={filePath}
                  className="judge-file-list-item"
                >
                  {getFileName(filePath)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="judge-execution-card">
        <div className="judge-section-header">
          <h3 className="judge-section-title">Execution</h3>
          <p className="judge-execution-path">
            <span className="judge-execution-label">Compiled executable:</span>{' '}
            {compileResult?.compileSuccess && compileResult.executablePath
              ? compileResult.executablePath
              : 'Compile a program to enable judging.'}
          </p>
        </div>

        <div className="judge-execution-controls">
          <button
            onClick={() => void handleRunJudge()}
            disabled={isJudging || !compileResult?.compileSuccess || !compileResult.executablePath}
            className={
              isJudging || !compileResult?.compileSuccess || !compileResult.executablePath
                ? 'cancel-button'
                : 'primary-button'
            }
          >
            {isJudging ? 'Running Judge...' : 'Run Judge'}
          </button>

          {summary.totalCount > 0 && (
            <div className="judge-summary-pill">
              Passed {summary.passedCount} / {summary.totalCount} test
              {summary.totalCount === 1 ? '' : 's'}
            </div>
          )}
        </div>
      </div>

      {judgeResults.length > 0 && (
        <div className="judge-results-grid">
          {judgeResults.map((test) => (
            <div
              key={test.id}
              className={`judge-result-card ${
                test.result.passed ? 'judge-result-card-pass' : 'judge-result-card-fail'
              }`}
            >
              <div className="judge-result-header">
                <div>
                  <h3 className="judge-result-title">{test.label}</h3>
                  <p
                    className={`judge-result-status-pill ${
                      test.result.passed ? 'judge-result-status-pass' : 'judge-result-status-fail'
                    }`}
                  >
                    {test.result.passed ? 'Pass' : 'Fail'}
                  </p>
                </div>

                <div className="judge-result-metadata">
                  Timed Out:{' '}
                  <span className="judge-result-metadata-value">
                    {test.result.timedOut ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>

              <div className="judge-result-details">
                <p className="judge-result-detail-item">
                  <span className="judge-result-detail-label">Output File:</span> {test.outputFile}
                </p>
                <p className="judge-result-detail-item">
                  <span className="judge-result-detail-label">Input File:</span>{' '}
                  {test.inputFile ?? 'No input file'}
                </p>
              </div>

              <div className="judge-result-output-grid">
                <div className="judge-output-section">
                  <h4 className="judge-output-title">Expected Output</h4>
                  <pre className="judge-output-content">
                    {test.result.expectedOutput || 'No expected output.'}
                  </pre>
                </div>

                <div className="judge-output-section">
                  <h4 className="judge-output-title">Actual Output</h4>
                  <pre className="judge-output-content">
                    {test.result.actualOutput || 'No actual output.'}
                  </pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
