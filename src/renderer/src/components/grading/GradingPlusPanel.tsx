import { useEffect, useRef, useState } from 'react'
import type { BatchJudgeCaseResult, BatchStudentSubmission } from '../../../../shared/batchGrading'
import type { GradebookRecord } from '../../../../shared/gradebookTypes'
import { saveGradebookRecord } from '../../lib/gradebookStorage'
import { StudentGradingCard } from './StudentGradingCard'

interface GradingPlusPanelProps {
  showHomeButton?: boolean
  onGoHome?: () => void
}

function getFileName(filePath: string): string {
  const parts = filePath.split(/[/\\]/)
  return parts[parts.length - 1] || filePath
}

type JudgeFilePairPreview = {
  inputFile: string
  outputFile: string
}

function buildJudgeFilePairPreview(
  inputFiles: string[],
  outputFiles: string[]
): JudgeFilePairPreview[] {
  const pairCount = Math.min(inputFiles.length, outputFiles.length)

  return Array.from({ length: pairCount }, (_, index) => ({
    inputFile: inputFiles[index],
    outputFile: outputFiles[index]
  }))
}

function sortFilesAlphabetically(files: string[]): string[] {
  return [...files].sort((a, b) => a.localeCompare(b))
}

function buildGradebookRecord(
  student: BatchStudentSubmission,
  passedCount: number,
  totalCount: number,
  status: 'done' | 'failed'
): GradebookRecord {
  const score = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0

  return {
    studentId: student.studentId,
    studentName: student.studentName,
    assignmentId: 'assignment-1',
    score,
    passedCount,
    totalCount,
    status,
    submittedAt: Date.now()
  }
}

export function GradingPlusPanel({
  showHomeButton = false,
  onGoHome
}: GradingPlusPanelProps): React.JSX.Element {
  const [students, setStudents] = useState<BatchStudentSubmission[]>([])
  const [selectedInputFiles, setSelectedInputFiles] = useState<string[]>([])
  const [selectedOutputFiles, setSelectedOutputFiles] = useState<string[]>([])
  const [currentStudentIndex, setCurrentStudentIndex] = useState<number | null>(null)
  const [isBatchGrading, setIsBatchGrading] = useState(false)
  const [batchError, setBatchError] = useState<string | null>(null)
  const [batchMessage, setBatchMessage] = useState<string | null>(null)
  const [expandedStudentIndex, setExpandedStudentIndex] = useState<number | null>(null)
  const [showInputMenu, setShowInputMenu] = useState(false)
  const [showOutputMenu, setShowOutputMenu] = useState(false)

  const judgeFilePairPreview = buildJudgeFilePairPreview(selectedInputFiles, selectedOutputFiles)
  const studentCardRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    function handleClickOutside(): void {
      setShowInputMenu(false)
      setShowOutputMenu(false)
    }

    window.addEventListener('click', handleClickOutside)

    return () => {
      window.removeEventListener('click', handleClickOutside)
    }
  }, [])

  useEffect(() => {
    if (currentStudentIndex === null) {
      return
    }

    const activeCard = studentCardRefs.current[currentStudentIndex]

    if (activeCard) {
      activeCard.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      })
    }
  }, [currentStudentIndex])

  function updateStudent(index: number, updates: Partial<BatchStudentSubmission>): void {
    setStudents((currentStudents) =>
      currentStudents.map((student, i) => (i === index ? { ...student, ...updates } : student))
    )
  }

  function appendUniqueFile(files: string[], nextFile: string | undefined): string[] {
    if (!nextFile || files.includes(nextFile)) {
      return files
    }

    return [...files, nextFile]
  }

  async function handleSelectStudentFiles(): Promise<void> {
    try {
      const files = await window.api.file.selectCppFiles()

      setStudents((currentStudents) => {
        const existingPaths = new Set(currentStudents.flatMap((student) => student.filePaths))
        const newFiles = files.filter((filePath) => !existingPaths.has(filePath))

        if (newFiles.length === 0) {
          return currentStudents
        }

        const startIndex = currentStudents.length

        const newStudents = newFiles.map((filePath, index) => ({
          studentId: `student-${startIndex + index + 1}`,
          studentName: `Student ${startIndex + index + 1}`,
          folderName: `Manual Upload ${startIndex + index + 1}`,
          filePaths: [filePath],
          fileNames: [getFileName(filePath)],
          status: 'pending' as const,
          compileResult: null,
          judgeResults: [],
          passedCount: 0,
          totalCount: 0,
          savedToGradebook: false,
          errorMessage: null
        }))

        return [...currentStudents, ...newStudents]
      })

      setBatchError(null)
      setBatchMessage(null)
    } catch (error) {
      console.error('Error selecting student files:', error)
      setBatchError('Could not select student submission files.')
    }
  }

  async function handleImportSubmissionFolder(): Promise<void> {
    try {
      const groups = await window.api.file.selectSubmissionFolder()

      setStudents((currentStudents) => {
        const existingFolderNames = new Set(currentStudents.map((student) => student.folderName))
        const newGroups = groups.filter((group) => !existingFolderNames.has(group.folderName))

        if (newGroups.length === 0) {
          return currentStudents
        }

        const startIndex = currentStudents.length

        const newStudents = newGroups.map((group, index) => ({
          studentId: `student-${startIndex + index + 1}`,
          studentName: group.folderName,
          folderName: group.folderName,
          filePaths: group.cppFiles,
          fileNames: group.cppFiles.map((filePath) => getFileName(filePath)),
          status: 'pending' as const,
          compileResult: null,
          judgeResults: [],
          passedCount: 0,
          totalCount: 0,
          savedToGradebook: false,
          errorMessage: null
        }))

        return [...currentStudents, ...newStudents]
      })

      setBatchError(null)
      setBatchMessage(null)
    } catch (error) {
      console.error('Error importing submission folder:', error)
      setBatchError('Could not import submission folder.')
    }
  }

  async function handleSelectInputFile(): Promise<void> {
    try {
      const file = await window.api.file.select()
      setSelectedInputFiles((currentFiles) =>
        sortFilesAlphabetically(appendUniqueFile(currentFiles, file))
      )
      setBatchError(null)
      setBatchMessage(null)
    } catch (error) {
      console.error('Error selecting input file:', error)
      setBatchError('Could not select input file.')
    }
  }

  async function handleSelectInputFolder(): Promise<void> {
    try {
      const files = await window.api.file.selectFilesFromFolder()
      setSelectedInputFiles(sortFilesAlphabetically(files))
      setBatchError(null)
      setBatchMessage(null)
    } catch (error) {
      console.error('Error selecting input folder:', error)
      setBatchError('Could not import input folder.')
    }
  }

  async function handleSelectOutputFile(): Promise<void> {
    try {
      const file = await window.api.file.select()
      setSelectedOutputFiles((currentFiles) =>
        sortFilesAlphabetically(appendUniqueFile(currentFiles, file))
      )
      setBatchError(null)
      setBatchMessage(null)
    } catch (error) {
      console.error('Error selecting expected output file:', error)
      setBatchError('Could not select expected output file.')
    }
  }

  async function handleSelectOutputFolder(): Promise<void> {
    try {
      const files = await window.api.file.selectFilesFromFolder()
      setSelectedOutputFiles(sortFilesAlphabetically(files))
      setBatchError(null)
      setBatchMessage(null)
    } catch (error) {
      console.error('Error selecting output folder:', error)
      setBatchError('Could not import output folder.')
    }
  }

  async function gradeSingleStudent(index: number): Promise<void> {
    setCurrentStudentIndex(index)
    setExpandedStudentIndex(index)

    const student = students[index]

    updateStudent(index, {
      status: 'grading',
      errorMessage: null,
      judgeResults: [],
      passedCount: 0,
      totalCount: 0
    })

    try {
      const dockerResult = await window.api.compiler.dockerCompileCpp(student.filePaths)

      const compileResult = {
        compileSuccess: dockerResult.success,
        compilerPath: 'docker',
        executablePath: dockerResult.executablePath,
        sourceFiles: student.filePaths,
        stdout: dockerResult.stdout,
        stderr: dockerResult.stderr,
        message: dockerResult.message
      }

      updateStudent(index, {
        compileResult
      })

      if (!compileResult.compileSuccess || !compileResult.executablePath) {
        const failedRecord = buildGradebookRecord(student, 0, 0, 'failed')
        await saveGradebookRecord(failedRecord)

        updateStudent(index, {
          status: 'failed',
          errorMessage: 'Compilation failed.',
          savedToGradebook: true
        })
        return
      }

      updateStudent(index, {
        status: 'judging'
      })

      const expectedOutputs = await Promise.all(
        selectedOutputFiles.map((filePath) => window.api.file.stringify(filePath))
      )

      const stdinValues = await Promise.all(
        selectedInputFiles.map((filePath) => window.api.file.stringify(filePath))
      )

      const judgeResults: BatchJudgeCaseResult[] = []

      for (const [i, outputFile] of selectedOutputFiles.entries()) {
        const inputFile = selectedInputFiles[i] ?? null

        const result = await window.api.compiler.judgeCpp({
          executablePath: compileResult.executablePath,
          stdin: stdinValues[i] ?? '',
          expectedOutput: expectedOutputs[i] ?? '',
          timeoutMs: 5000
        })

        judgeResults.push({
          testNumber: i + 1,
          inputFile,
          outputFile,
          result
        })
      }

      const passedCount = judgeResults.filter((test) => test.result.passed).length
      const totalCount = judgeResults.length
      const savedRecord = buildGradebookRecord(student, passedCount, totalCount, 'done')
      await saveGradebookRecord(savedRecord)

      updateStudent(index, {
        status: 'done',
        judgeResults,
        passedCount,
        totalCount,
        savedToGradebook: true
      })
    } catch (error) {
      console.error('Error grading student:', error)

      const failedRecord = buildGradebookRecord(student, 0, 0, 'failed')
      await saveGradebookRecord(failedRecord)

      updateStudent(index, {
        status: 'failed',
        errorMessage: 'An error occurred while grading this student.',
        savedToGradebook: true
      })
    }
  }

  async function handleGradeStudent(index: number): Promise<void> {
    if (selectedInputFiles.length === 0) {
      setBatchError('Select at least one input file before grading.')
      return
    }

    if (selectedOutputFiles.length === 0) {
      setBatchError('Select at least one expected output file before grading.')
      return
    }

    if (selectedInputFiles.length !== selectedOutputFiles.length) {
      setBatchError('Input files must match the number of output files.')
      return
    }

    if (students[index].status === 'grading' || students[index].status === 'judging') {
      return
    }

    setIsBatchGrading(true)
    setBatchError(null)
    setBatchMessage(null)

    try {
      await gradeSingleStudent(index)
    } finally {
      setIsBatchGrading(false)
    }
  }

  async function handleGradeAllStudents(): Promise<void> {
    if (students.length === 0) {
      setBatchError('No students available to grade.')
      return
    }

    if (selectedOutputFiles.length === 0) {
      setBatchError('Select at least one expected output file before grading.')
      return
    }

    if (selectedInputFiles.length !== selectedOutputFiles.length) {
      setBatchError('Input files must match the number of output files.')
      return
    }

    const pendingIndexes = students
      .map((student, index) => ({ student, index }))
      .filter(({ student }) => student.status === 'pending' || student.status === 'failed')
      .map(({ index }) => index)

    if (pendingIndexes.length === 0) {
      setBatchMessage('All students have been graded.')
      return
    }

    setIsBatchGrading(true)
    setBatchError(null)
    setBatchMessage(null)

    try {
      for (const index of pendingIndexes) {
        await gradeSingleStudent(index)
      }

      setBatchMessage('All students have been graded.')
    } catch (error) {
      console.error('Error during batch grading:', error)
      setBatchError('Batch grading failed.')
    } finally {
      setIsBatchGrading(false)
    }
  }

  function handleToggleStudentDetails(index: number): void {
    setExpandedStudentIndex((currentIndex) => (currentIndex === index ? null : index))
  }

  const completedCount = students.filter(
    (student) => student.status === 'done' || student.status === 'failed'
  ).length

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Grading+</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Batch grading workflow for compiling and judging multiple student submissions.
        </p>
      </div>

      {batchError && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {batchError}
        </div>
      )}

      {batchMessage && (
        <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {batchMessage}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-900">Batch Setup</h2>
          <p className="mt-1 text-sm text-slate-600">
            Import submissions, add judge files, and run grading across multiple students.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button onClick={() => void handleImportSubmissionFolder()} className="primary-button">
            Import Submission Folder
          </button>

          <button onClick={() => void handleSelectStudentFiles()} className="primary-button">
            Select Student C++ Files
          </button>

          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowInputMenu((prev) => !prev)
              }}
              className="primary-button"
            >
              Add Input ▼
            </button>

            {showInputMenu && (
              <div className="absolute left-0 top-full z-20 mt-2 min-w-[180px] rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                <button
                  onClick={() => {
                    setShowInputMenu(false)
                    void handleSelectInputFile()
                  }}
                  className="secondary-button block w-full"
                >
                  Select File
                </button>

                <button
                  onClick={() => {
                    setShowInputMenu(false)
                    void handleSelectInputFolder()
                  }}
                  className="secondary-button mt-2 block w-full"
                >
                  Select Folder
                </button>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowOutputMenu((prev) => !prev)
              }}
              className="primary-button"
            >
              Add Output ▼
            </button>

            {showOutputMenu && (
              <div className="absolute left-0 top-full z-20 mt-2 min-w-[180px] rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                <button
                  onClick={() => {
                    setShowOutputMenu(false)
                    void handleSelectOutputFile()
                  }}
                  className="secondary-button block w-full"
                >
                  Select File
                </button>

                <button
                  onClick={() => {
                    setShowOutputMenu(false)
                    void handleSelectOutputFolder()
                  }}
                  className="secondary-button mt-2 block w-full"
                >
                  Select Folder
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => void handleGradeAllStudents()}
            disabled={isBatchGrading || students.length === 0}
            className={isBatchGrading || students.length === 0 ? 'cancel-button' : 'primary-button'}
          >
            {isBatchGrading ? 'Grading...' : 'Grade All Students'}
          </button>
        </div>

        <div className="mt-5 grid gap-3">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            If the program requires user input, add input files before grading. Otherwise, test
            cases may fail due to missing input.
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Input and output files are paired by alphabetical order. Make sure filenames follow the
            same naming pattern.
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-base font-semibold text-slate-900">Overview</h3>
            <div className="mt-3 grid gap-2 text-sm text-slate-700">
              <p>
                <span className="font-medium text-slate-900">Total Students:</span> {students.length}
              </p>
              <p>
                <span className="font-medium text-slate-900">Input Files:</span>{' '}
                {selectedInputFiles.length}
              </p>
              <p>
                <span className="font-medium text-slate-900">Output Files:</span>{' '}
                {selectedOutputFiles.length}
              </p>
              <p>
                <span className="font-medium text-slate-900">Completed:</span> {completedCount}
              </p>
              <p>
                <span className="font-medium text-slate-900">Current Student:</span>{' '}
                {currentStudentIndex !== null ? students[currentStudentIndex]?.studentName : 'None'}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-base font-semibold text-slate-900">Test Case Pairing</h3>

            {judgeFilePairPreview.length > 0 ? (
              <div className="mt-3">
                <ul className="grid gap-2">
                  {judgeFilePairPreview.map((pair, index) => (
                    <li
                      key={`${pair.inputFile}-${pair.outputFile}`}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 [overflow-wrap:anywhere]"
                    >
                      <span className="font-medium text-slate-900">Test {index + 1}:</span>{' '}
                      {getFileName(pair.inputFile)} → {getFileName(pair.outputFile)}
                    </li>
                  ))}
                </ul>

                {selectedInputFiles.length !== selectedOutputFiles.length && (
                  <p className="mt-3 text-sm text-red-600">
                    Warning: Input and output file counts do not match yet.
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-600">
                Add input and output files to preview pairings.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        {students.map((student, index) => {
          return (
            <div
              key={student.studentId}
              ref={(element) => {
                studentCardRefs.current[index] = element
              }}
            >
              <StudentGradingCard
                student={student}
                isExpanded={expandedStudentIndex === index}
                onToggle={() => handleToggleStudentDetails(index)}
                onGrade={() => void handleGradeStudent(index)}
                isBatchGrading={isBatchGrading}
              />
            </div>
          )
        })}
      </div>

      {showHomeButton && onGoHome && (
        <button onClick={onGoHome} className="primary-button mt-6">
          Go to Home
        </button>
      )}
    </div>
  )
}