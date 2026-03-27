import { useEffect, useMemo, useState } from 'react'
import type { CompileCppResult, JudgeCppResult } from '../../../shared/compiler'

// Local type to display judge results
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
  // Append the new file to the existing list
  return [...files, nextFile]
}

export function CppJudgePanel({ compileResult }: CppJudgePanelProps): React.JSX.Element {
  const [selectedOutputFiles, setSelectedOutputFiles] = useState<string[]>([])
  const [selectedInputFiles, setSelectedInputFiles] = useState<string[]>([])
  const [judgeResults, setJudgeResults] = useState<JudgeCaseResult[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isJudging, setIsJudging] = useState(false)

  useEffect(() => {
    setJudgeResults([])
    setErrorMessage(null)
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

  async function handleRunJudge(): Promise<void> {
    // If it fails to compile or no exe fail
    if (!compileResult?.compileSuccess || !compileResult.executablePath) {
      setErrorMessage('Compile successfully before running judge tests.')
      return
    }

    // If there are no output files fail
    if (selectedOutputFiles.length === 0) {
      setErrorMessage('Select at least one expected output file.')
      return
    }

    // If there are more input files than output files fail
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

  return (
    <div className="mt-4 border border-gray-500 bg-[#2b2b2b] p-4">
      <h2 className="mb-2 text-xl font-semibold">Judge Test Cases</h2>
      <p className="mb-4 text-sm leading-6 text-gray-200">
        Select input files and output files in any order. Input files are optional, and when both
        lists are present they are paired by index.
      </p>

      {errorMessage && (
        <div className="mb-4 border border-red-500 bg-[#5a1f1f] p-2.5">
          <p>{errorMessage}</p>
        </div>
      )}

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
        <div className="border border-gray-500 bg-[#1f1f1f] p-3">
          <h3 className="mb-2.5 text-lg font-medium">Optional Input Files</h3>
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
            {selectedInputFiles.length} file{selectedInputFiles.length === 1 ? '' : 's'} selected
          </p>

          {selectedInputFiles.length > 0 && (
            <ul className="mt-2.5 grid max-h-40 gap-1.5 overflow-y-auto text-[13px]">
              {selectedInputFiles.map((filePath) => (
                <li
                  key={filePath}
                  className="border border-slate-700 bg-[#111] p-2 [overflow-wrap:anywhere]"
                >
                  {getFileName(filePath)}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border border-gray-500 bg-[#1f1f1f] p-3">
          <h3 className="mb-2.5 text-lg font-medium">Expected Output Files</h3>
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
              className={selectedOutputFiles.length === 0 ? 'cancel-button' : 'secondary-button'}
            >
              Clear Output Files
            </button>
          </div>

          <p className="mt-2.5 text-sm text-gray-300">
            {selectedOutputFiles.length} file{selectedOutputFiles.length === 1 ? '' : 's'} selected
          </p>

          {selectedOutputFiles.length > 0 && (
            <ul className="mt-2.5 grid max-h-40 gap-1.5 overflow-y-auto text-[13px]">
              {selectedOutputFiles.map((filePath) => (
                <li
                  key={filePath}
                  className="border border-slate-700 bg-[#111] p-2 [overflow-wrap:anywhere]"
                >
                  {getFileName(filePath)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-4 border border-gray-500 bg-[#1f1f1f] p-3">
        <p className="mb-2.5 text-sm text-gray-300 [overflow-wrap:anywhere]">
          Compiled executable:{' '}
          {compileResult?.compileSuccess && compileResult.executablePath
            ? compileResult.executablePath
            : 'Compile a program to enable judging.'}
        </p>

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
  )
}
