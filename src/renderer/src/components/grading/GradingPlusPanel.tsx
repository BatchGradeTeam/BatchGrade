import { useEffect, useRef, useState } from 'react'
import type { BatchJudgeCaseResult, BatchStudentSubmission } from '../../../../shared/batchGrading'
import type { GradebookRecord } from '../../../../shared/gradebookTypes'
import type { Assignment } from '../../../../shared/types'
import { saveGradebookRecord } from '../../lib/gradebookStorage'
import { loadServerAssignments, loadServerSubmissionsForGrading } from '../../lib/serverData'
import { StudentGradingCard } from './StudentGradingCard'

interface GradingPlusPanelProps {
  showHomeButton?: boolean
  onGoHome?: () => void
}

/**
 * Returns the file name from a full file path.
 */
function getFileName(filePath: string): string {
  const parts = filePath.split(/[/\\]/)
  return parts[parts.length - 1] || filePath
}

function getFileStem(filePath: string): string {
  return getFileName(filePath).replace(/\.[^.]+$/, '')
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
  assignmentId: string,
  passedCount: number,
  totalCount: number,
  status: 'done' | 'failed'
): GradebookRecord {
  const score = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0

  return {
    studentId: student.studentId,
    studentName: student.studentName,
    assignmentId,
    submissionId: student.serverSubmissionId,
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
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('')
  const [isLoadingServerSubmissions, setIsLoadingServerSubmissions] = useState(false)

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
    let isMounted = true

    loadServerAssignments()
      .then(async (result) => (result.length > 0 ? result : window.api.assignments.getAll()))
      .then((result) => {
        if (!isMounted) {
          return
        }

        setAssignments(result)
        setSelectedAssignmentId((current) => current || result[0]?.uuid || '')
      })
      .catch((error) => {
        console.error('Error loading assignments for batch grading:', error)
        if (isMounted) {
          setBatchError('Could not load assignments for grading.')
        }
      })

    return () => {
      isMounted = false
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
          studentId: getFileStem(filePath) || `student-${startIndex + index + 1}`,
          studentName: getFileStem(filePath) || `Student ${startIndex + index + 1}`,
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

        const newStudents = newGroups.map((group) => ({
          studentId: group.folderName,
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

  async function handleLoadServerSubmissions(): Promise<void> {
    if (!selectedAssignmentId) {
      setBatchError('Select an assignment before loading server submissions.')
      return
    }

    setIsLoadingServerSubmissions(true)
    setBatchError(null)
    setBatchMessage(null)

    try {
      const bundles = await loadServerSubmissionsForGrading(selectedAssignmentId)

      if (bundles.length === 0) {
        setBatchMessage('No server submissions found for this assignment.')
        return
      }

      const groups = await window.api.file.materializeServerSubmissions(bundles)

      setStudents((currentStudents) => {
        const existingServerIds = new Set(
          currentStudents.map((student) => student.serverSubmissionId).filter(Boolean)
        )

        const newStudents = groups
          .filter((group) => !existingServerIds.has(group.serverSubmissionId))
          .map((group) => ({
            studentId: group.studentId ?? group.folderName,
            studentName: group.studentName ?? group.folderName,
            folderName: group.folderName,
            serverSubmissionId: group.serverSubmissionId,
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

      setBatchMessage(`Loaded ${bundles.length} server submission${bundles.length === 1 ? '' : 's'}.`)
    } catch (error) {
      console.error('Error loading server submissions:', error)
      setBatchError(error instanceof Error ? error.message : 'Could not load server submissions.')
    } finally {
      setIsLoadingServerSubmissions(false)
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
      console.error('Error selecting output file:', error)
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
        const failedRecord = buildGradebookRecord(student, selectedAssignmentId, 0, 0, 'failed')
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
      const savedRecord = buildGradebookRecord(
        student,
        selectedAssignmentId,
        passedCount,
        totalCount,
        'done'
      )
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

      const failedRecord = buildGradebookRecord(student, selectedAssignmentId, 0, 0, 'failed')
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

    if (!selectedAssignmentId) {
      setBatchError('Select an assignment before grading.')
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

    if (!selectedAssignmentId) {
      setBatchError('Select an assignment before grading.')
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
    <div className="panel-shell">
      <h1>Grading+ Page</h1>
      <p>
        Instructor batch grading workflow for compiling and judging multiple student submissions.
      </p>

      {batchError && (
        <div
          style={{
            backgroundColor: '#5a1f1f',
            border: '1px solid red',
            padding: '10px',
            marginBottom: '1rem'
          }}
        >
          <p>{batchError}</p>
        </div>
      )}

      {batchMessage && (
        <div
          style={{
            backgroundColor: '#1f3a1f',
            border: '1px solid #22c55e',
            padding: '10px',
            marginBottom: '1rem'
          }}
        >
          <p>{batchMessage}</p>
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
        <h2 style={{ marginBottom: '10px' }}>Batch Setup</h2>

        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="batch-assignment-select" style={{ marginRight: '8px' }}>
            Assignment:
          </label>
          <select
            id="batch-assignment-select"
            value={selectedAssignmentId}
            onChange={(e) => setSelectedAssignmentId(e.target.value)}
            disabled={assignments.length === 0 || isBatchGrading}
            style={{ padding: '6px', minWidth: '220px' }}
          >
            {assignments.length === 0 ? (
              <option value="">No assignments available</option>
            ) : (
              assignments.map((assignment) => (
                <option key={assignment.uuid} value={assignment.uuid}>
                  {assignment.name}
                </option>
              ))
            )}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={() => void handleImportSubmissionFolder()} className="primary-button">
            Import Submission Folder
          </button>

          <button
            onClick={() => void handleLoadServerSubmissions()}
            className="primary-button"
            disabled={isLoadingServerSubmissions || !selectedAssignmentId}
          >
            {isLoadingServerSubmissions ? 'Loading Server Submissions...' : 'Load Server Submissions'}
          </button>

          <button onClick={() => void handleSelectStudentFiles()} className="primary-button">
            Select Student C++ Files
          </button>

          <div style={{ position: 'relative' }}>
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
              <div
                style={{
                  position: 'absolute',
                  backgroundColor: '#1f1f1f',
                  border: '1px solid gray',
                  marginTop: '4px',
                  zIndex: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  padding: '6px'
                }}
              >
                <button
                  onClick={() => {
                    setShowInputMenu(false)
                    void handleSelectInputFile()
                  }}
                  className="secondary-button"
                  style={{ display: 'block', width: '100%' }}
                >
                  Select File
                </button>

                <button
                  onClick={() => {
                    setShowInputMenu(false)
                    void handleSelectInputFolder()
                  }}
                  className="secondary-button"
                  style={{ display: 'block', width: '100%' }}
                >
                  Select Folder
                </button>
              </div>
            )}
          </div>

          <div style={{ position: 'relative' }}>
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
              <div
                style={{
                  position: 'absolute',
                  backgroundColor: '#1f1f1f',
                  border: '1px solid gray',
                  marginTop: '4px',
                  zIndex: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  padding: '6px'
                }}
              >
                <button
                  onClick={() => {
                    setShowOutputMenu(false)
                    void handleSelectOutputFile()
                  }}
                  className="secondary-button"
                  style={{ display: 'block', width: '100%' }}
                >
                  Select File
                </button>

                <button
                  onClick={() => {
                    setShowOutputMenu(false)
                    void handleSelectOutputFolder()
                  }}
                  className="secondary-button"
                  style={{ display: 'block', width: '100%' }}
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
            Grade All Students
          </button>
        </div>

        <p style={{ marginTop: '10px', fontSize: '13px', color: '#facc15' }}>
          ⚠️ If the program requires user input, add input files before grading. Otherwise, test
          cases may fail due to missing input.
        </p>

        <p style={{ fontSize: '13px', color: '#facc15' }}>
          ⚠️ Input and output files are paired by alphabetical order. Make sure filenames follow the
          same naming pattern.
        </p>

        <div style={{ marginTop: '12px', fontSize: '14px', lineHeight: '1.6' }}>
          <p>Total Students: {students.length}</p>
          <p>Input Files: {selectedInputFiles.length}</p>
          <p>Output Files: {selectedOutputFiles.length}</p>

          {judgeFilePairPreview.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <h3 style={{ marginBottom: '4px' }}>Test Case Pairing</h3>

              <ul style={{ paddingLeft: '20px', margin: 0 }}>
                {judgeFilePairPreview.map((pair, index) => (
                  <li
                    key={`${pair.inputFile}-${pair.outputFile}`}
                    style={{ fontSize: '14px', marginBottom: '4px', overflowWrap: 'anywhere' }}
                  >
                    Test {index + 1}: {getFileName(pair.inputFile)} → {getFileName(pair.outputFile)}
                  </li>
                ))}
              </ul>

              {selectedInputFiles.length !== selectedOutputFiles.length && (
                <p style={{ fontSize: '13px', color: '#f87171', marginTop: '8px' }}>
                  Warning: Input and output file counts do not match yet.
                </p>
              )}
            </div>
          )}
          <p>Completed: {completedCount}</p>
          <p>
            Current Student:{' '}
            {currentStudentIndex !== null ? students[currentStudentIndex]?.studentName : 'None'}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '12px' }}>
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
        <button
          onClick={onGoHome}
          style={{
            padding: '9px 14px',
            backgroundColor: '#2563eb',
            color: 'white',
            border: '2px solid #93c5fd',
            borderRadius: '6px',
            fontWeight: 'bold',
            cursor: 'pointer',
            marginTop: '16px'
          }}
        >
          Go to home
        </button>
      )}
    </div>
  )
}
