import { useMemo, useState } from 'react'
import type { DockerCompileResult, DockerJudgeResult } from '../../../shared/compiler'

// Local type to display judge results
type JudgeCaseResult = {
  id: string
  label: string
  inputFile: string | null
  outputFile: string
  result: DockerJudgeResult
}

type DockerCppGradePanelProps = {
  sourceFiles: string[]
}

// Get 1 or more files from the user
function getFileName(filePath: string): string {
  const parts = filePath.split(/[/\\]/)
  return parts[parts.length - 1] || filePath
}

// Don't add duplicates
function appendUniqueFile(files: string[], nextFile: string | undefined): string[] {
  if (!nextFile || files.includes(nextFile)) {
    return files
  }
  return [...files, nextFile]
}

export function DockerCppGradePanel({ sourceFiles }: DockerCppGradePanelProps): React.JSX.Element {
  const [compileResult, setCompileResult] = useState<DockerCompileResult | null>(null)
  const [selectedOutputFiles, setSelectedOutputFiles] = useState<string[]>([])
  const [selectedInputFiles, setSelectedInputFiles] = useState<string[]>([])
  const [judgeResults, setJudgeResults] = useState<JudgeCaseResult[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isCompiling, setIsCompiling] = useState(false)
  const [isJudging, setIsJudging] = useState(false)

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
        setSelectedInputFiles((currentFiles) => appendUniqueFile(currentFiles, file))
        setJudgeResults([])
        setErrorMessage(null)
      })
      .catch((error) => {
        console.error('Error selecting input files:', error)
        setErrorMessage('Could not select input files.')
      })
  }

  async function handleDockerCompile(): Promise<void> {
    if (sourceFiles.length === 0) {
      setErrorMessage('Select at least one C++ source file.')
      return
    }

    setIsCompiling(true)
    setErrorMessage(null)
    setJudgeResults([])

    try {
      const result = await window.api.compiler.dockerCompileCpp(sourceFiles)
      setCompileResult(result)

      if (!result.success) {
        setErrorMessage(result.message)
      }
    } catch (error) {
      console.error('Error during Docker compilation:', error)
      setErrorMessage('Docker compilation failed.')
    } finally {
      setIsCompiling(false)
    }
  }

  async function handleRunJudge(): Promise<void> {
    if (!compileResult?.success || !compileResult.executablePath) {
      setErrorMessage('Compile successfully with Docker before running judge tests.')
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
        const result = await window.api.compiler.dockerJudgeCpp({
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
      console.error('Error running Docker judge tests:', error)
      setErrorMessage('Could not run the Docker judge tests.')
    } finally {
      setIsJudging(false)
    }
  }

  return (
    <div className="mt-4 border border-gray-500 bg-[#2b2b2b] p-4">
      <h2 className="mb-2 text-xl font-semibold">Docker Grade & Judge</h2>

      {/* Docker Compile Section */}
      <div className="mt-4 border border-gray-500 bg-[#1f1f1f] p-3">
        <h3 className="mb-2.5 text-lg font-medium">Docker Compile</h3>
        <p className="mb-3 text-sm text-gray-300">
          {sourceFiles.length} file{sourceFiles.length === 1 ? '' : 's'} selected
        </p>

        <button
          onClick={() => void handleDockerCompile()}
          disabled={isCompiling || sourceFiles.length === 0}
          className={isCompiling || sourceFiles.length === 0 ? 'cancel-button' : 'primary-button'}
        >
          {isCompiling ? 'Compiling with Docker...' : 'Compile with Docker'}
        </button>

        {compileResult && (
          <div
            className={`mt-3 border p-3 ${compileResult.success ? 'border-green-600 bg-green-950' : 'border-red-600 bg-red-950'}`}
          >
            <p className="font-medium">{compileResult.message}</p>
            {compileResult.executablePath && (
              <p className="mt-1 text-sm text-gray-300">
                Executable:{' '}
                <span className="[overflow-wrap:anywhere]">{compileResult.executablePath}</span>
              </p>
            )}
            {compileResult.stderr && (
              <div className="mt-2">
                <p className="text-sm font-medium">Errors:</p>
                <pre className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap border border-gray-500 bg-[#111] p-2 text-xs [overflow-wrap:anywhere]">
                  {compileResult.stderr}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Docker Judge Section */}
      {compileResult?.success && (
        <div className="mt-4 border border-gray-500 bg-[#1f1f1f] p-3">
          <h3 className="mb-2.5 text-lg font-medium">Docker Judge Test Cases</h3>
          <p className="mb-4 text-sm leading-6 text-gray-200">
            Select input files and output files in any order. Input files are optional, and when
            both lists are present they are paired by index.
          </p>

          {errorMessage && (
            <div className="mb-4 border border-red-500 bg-[#5a1f1f] p-2.5">
              <p>{errorMessage}</p>
            </div>
          )}

          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
            <div className="border border-gray-500 bg-[#111] p-3">
              <h4 className="mb-2.5 text-lg font-medium">Optional Input Files</h4>
              <div className="flex flex-wrap gap-2.5">
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

              <p className="mt-2.5 text-sm text-gray-300">
                {selectedInputFiles.length} file{selectedInputFiles.length === 1 ? '' : 's'}{' '}
                selected
              </p>

              {selectedInputFiles.length > 0 && (
                <ul className="mt-2.5 grid max-h-40 gap-1.5 overflow-y-auto text-[13px]">
                  {selectedInputFiles.map((filePath) => (
                    <li
                      key={filePath}
                      className="border border-slate-700 bg-[#0a0a0a] p-2 [overflow-wrap:anywhere]"
                    >
                      {getFileName(filePath)}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border border-gray-500 bg-[#111] p-3">
              <h4 className="mb-2.5 text-lg font-medium">Expected Output Files</h4>
              <div className="flex flex-wrap gap-2.5">
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
                  className={
                    selectedOutputFiles.length === 0 ? 'cancel-button' : 'secondary-button'
                  }
                >
                  Clear Output Files
                </button>
              </div>

              <p className="mt-2.5 text-sm text-gray-300">
                {selectedOutputFiles.length} file{selectedOutputFiles.length === 1 ? '' : 's'}{' '}
                selected
              </p>

              {selectedOutputFiles.length > 0 && (
                <ul className="mt-2.5 grid max-h-40 gap-1.5 overflow-y-auto text-[13px]">
                  {selectedOutputFiles.map((filePath) => (
                    <li
                      key={filePath}
                      className="border border-slate-700 bg-[#0a0a0a] p-2 [overflow-wrap:anywhere]"
                    >
                      {getFileName(filePath)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="mt-4 border border-gray-500 bg-[#111] p-3">
            <button
              onClick={() => void handleRunJudge()}
              disabled={isJudging || !compileResult?.success || !compileResult.executablePath}
              className={
                isJudging || !compileResult?.success || !compileResult.executablePath
                  ? 'cancel-button'
                  : 'primary-button'
              }
            >
              {isJudging ? 'Running Docker Judge...' : 'Run Docker Judge'}
            </button>

            {summary.totalCount > 0 && (
              <div className="mt-4 border border-blue-700 bg-blue-950 p-3">
                <p>
                  Passed {summary.passedCount} / {summary.totalCount} judge test
                  {summary.totalCount === 1 ? '' : 's'}.
                </p>
              </div>
            )}
          </div>

          {judgeResults.length > 0 && (
            <div className="mt-4 grid gap-3">
              {judgeResults.map((test) => (
                <div
                  key={test.id}
                  className={`border bg-[#1f1f1f] p-3 ${test.result.passed ? 'border-green-600' : 'border-red-600'}`}
                >
                  <h3 className="mb-2 text-lg font-medium">
                    {test.label}: {test.result.passed ? 'Pass' : 'Fail'}
                  </h3>
                  <p className="text-sm [overflow-wrap:anywhere]">Output File: {test.outputFile}</p>
                  <p className="text-sm [overflow-wrap:anywhere]">
                    Input File: {test.inputFile ?? 'No input file'}
                  </p>
                  <p className="text-sm">Timed Out: {test.result.timedOut ? 'Yes' : 'No'}</p>

                  <div className="mt-3 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
                    <div>
                      <h4 className="text-[15px] font-medium">Expected Output</h4>
                      <pre className="mt-1.5 max-h-40 overflow-y-auto whitespace-pre-wrap border border-gray-500 bg-[#111] p-2 text-xs [overflow-wrap:anywhere]">
                        {test.result.expectedOutput || 'No expected output.'}
                      </pre>
                    </div>

                    <div>
                      <h4 className="text-[15px] font-medium">Actual Output</h4>
                      <pre className="mt-1.5 max-h-40 overflow-y-auto whitespace-pre-wrap border border-gray-500 bg-[#111] p-2 text-xs [overflow-wrap:anywhere]">
                        {test.result.actualOutput || 'No actual output.'}
                      </pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
