import { useEffect, useMemo, useState, useRef, useEffectEvent } from 'react'
import type { CompileCppResult, JudgeCppResult } from '../../../shared/compiler'

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
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-slate-900">Judge Test Cases</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Add expected output files and optional input files. When both lists are present, files are
          paired by index and run as individual judge cases.
        </p>
      </div>

      {errorMessage && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Optional Input Files</h3>
            <p className="mt-1 text-sm text-slate-600">
              These files provide stdin for each test case.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
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

          <div className="mt-4 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
            {selectedInputFiles.length} input file{selectedInputFiles.length === 1 ? '' : 's'}{' '}
            selected
          </div>

          {selectedInputFiles.length > 0 && (
            <ul className="mt-4 grid max-h-48 gap-2 overflow-y-auto">
              {selectedInputFiles.map((filePath) => (
                <li
                  key={filePath}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 [overflow-wrap:anywhere]"
                >
                  {getFileName(filePath)}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Expected Output Files</h3>
            <p className="mt-1 text-sm text-slate-600">
              These files are used as the expected results for each test.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
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

          <div className="mt-4 rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm text-slate-700">
            {selectedOutputFiles.length} output file{selectedOutputFiles.length === 1 ? '' : 's'}{' '}
            selected
          </div>

          {selectedOutputFiles.length > 0 && (
            <ul className="mt-4 grid max-h-48 gap-2 overflow-y-auto">
              {selectedOutputFiles.map((filePath) => (
                <li
                  key={filePath}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 [overflow-wrap:anywhere]"
                >
                  {getFileName(filePath)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Execution</h3>
          <p className="mt-1 text-sm text-slate-600 [overflow-wrap:anywhere]">
            <span className="font-medium text-slate-800">Compiled executable:</span>{' '}
            {compileResult?.compileSuccess && compileResult.executablePath
              ? compileResult.executablePath
              : 'Compile a program to enable judging.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
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
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-800">
              Passed {summary.passedCount} / {summary.totalCount} test
              {summary.totalCount === 1 ? '' : 's'}
            </div>
          )}
        </div>
      </div>

      {judgeResults.length > 0 && (
        <div className="mt-6 grid gap-4">
          {judgeResults.map((test) => (
            <div
              key={test.id}
              className={`rounded-2xl border bg-white p-5 shadow-sm ${
                test.result.passed ? 'border-green-200' : 'border-red-200'
              }`}
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{test.label}</h3>
                  <p
                    className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                      test.result.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {test.result.passed ? 'Pass' : 'Fail'}
                  </p>
                </div>

                <div className="text-sm text-slate-600">
                  Timed Out:{' '}
                  <span className="font-medium text-slate-800">
                    {test.result.timedOut ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>

              <div className="grid gap-2 text-sm text-slate-700">
                <p className="[overflow-wrap:anywhere]">
                  <span className="font-medium text-slate-900">Output File:</span> {test.outputFile}
                </p>
                <p className="[overflow-wrap:anywhere]">
                  <span className="font-medium text-slate-900">Input File:</span>{' '}
                  {test.inputFile ?? 'No input file'}
                </p>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <h4 className="text-sm font-semibold text-slate-900">Expected Output</h4>
                  <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700 [overflow-wrap:anywhere]">
                    {test.result.expectedOutput || 'No expected output.'}
                  </pre>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <h4 className="text-sm font-semibold text-slate-900">Actual Output</h4>
                  <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700 [overflow-wrap:anywhere]">
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
