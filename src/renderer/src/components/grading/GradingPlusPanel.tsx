import { useEffect, useRef, useState } from 'react'
import type { BatchJudgeCaseResult, BatchStudentSubmission } from '../../../../shared/batchGrading'
import type { GradebookRecord } from '../../../../shared/gradebookTypes'
import type { Assignment, AssignmentTestCase } from '../../../../shared/types'
import { saveGradebookRecord, type GradebookStorageMode } from '../../lib/gradebookStorage'
import {
  loadAssignmentTestCases,
  loadServerAssignments,
  loadServerSubmissionsForGrading
} from '../../lib/serverData'
import { StudentGradingCard } from './StudentGradingCard'

interface GradingPlusPanelProps {
  dataSourceMode?: GradebookStorageMode
  gradebookMode?: GradebookStorageMode
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
  inputFile: string | null
  outputFile: string
}

type JudgeCaseData = {
  testNumber: number
  inputLabel: string | null
  outputLabel: string
  stdin: string
  expectedOutput: string
}

type TestCaseMode = 'saved' | 'manual'

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
  dataSourceMode = 'server',
  gradebookMode = 'local',
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
  const [assignmentTestCases, setAssignmentTestCases] = useState<AssignmentTestCase[]>([])
  const [isLoadingAssignmentTestCases, setIsLoadingAssignmentTestCases] = useState(false)
  const [testCaseMode, setTestCaseMode] = useState<TestCaseMode>('saved')
  const isServerMode = dataSourceMode === 'server'
  const gradebookDestinationLabel =
    gradebookMode === 'local' ? 'offline gradebook on this device' : 'online gradebook'

  const useSavedTestCases = testCaseMode === 'saved' && assignmentTestCases.length > 0
  const judgeFilePairPreview = useSavedTestCases
    ? assignmentTestCases.map((testCase) => ({
        inputFile:
          testCase.inputFileName ??
          (testCase.inputText ? `Test ${testCase.caseOrder} input` : null),
        outputFile: testCase.expectedOutputFileName ?? `Test ${testCase.caseOrder} expected output`
      }))
    : buildJudgeFilePairPreview(selectedInputFiles, selectedOutputFiles)
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

    async function loadAssignmentsForMode(): Promise<void> {
      try {
        let result: Assignment[]

        if (isServerMode) {
          try {
            const serverAssignments = await loadServerAssignments()
            result =
              serverAssignments.length > 0
                ? serverAssignments
                : await window.api.assignments.getAll()
          } catch (serverError) {
            console.error(
              'Error loading server assignments for batch grading, using local assignments:',
              serverError
            )
            result = await window.api.assignments.getAll()
          }
        } else {
          result = await window.api.assignments.getAll()
        }

        if (!isMounted) {
          return
        }

        setAssignments(result)
        setSelectedAssignmentId((current) => current || result[0]?.uuid || '')
        setBatchError(null)
      } catch (error) {
        console.error('Error loading assignments for batch grading:', error)
        if (isMounted) {
          setBatchError('Could not load assignments for grading.')
        }
      }
    }

    void loadAssignmentsForMode()

    return () => {
      isMounted = false
    }
  }, [isServerMode])

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

  useEffect(() => {
    let isMounted = true

    async function loadSelectedAssignmentTestCases(): Promise<void> {
      if (!selectedAssignmentId) {
        setAssignmentTestCases([])
        return
      }

      setIsLoadingAssignmentTestCases(true)

      try {
        const testCases = isServerMode
          ? await loadAssignmentTestCases(selectedAssignmentId).then(async (serverTestCases) =>
              serverTestCases.length > 0
                ? serverTestCases
                : window.api.assignments.getTestCases(selectedAssignmentId)
            )
          : await window.api.assignments.getTestCases(selectedAssignmentId)

        if (isMounted) {
          setAssignmentTestCases(testCases)
          setTestCaseMode(testCases.length > 0 ? 'saved' : 'manual')
        }
      } catch (error) {
        console.error('Error loading assignment test cases:', error)

        try {
          const localTestCases = await window.api.assignments.getTestCases(selectedAssignmentId)

          if (isMounted) {
            setAssignmentTestCases(localTestCases)
            setTestCaseMode(localTestCases.length > 0 ? 'saved' : 'manual')
          }
        } catch (fallbackError) {
          console.error('Error loading local assignment test cases:', fallbackError)

          if (isMounted) {
            setAssignmentTestCases([])
            setTestCaseMode('manual')
          }
        }
      } finally {
        if (isMounted) {
          setIsLoadingAssignmentTestCases(false)
        }
      }
    }

    void loadSelectedAssignmentTestCases()

    return () => {
      isMounted = false
    }
  }, [isServerMode, selectedAssignmentId])

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
    if (!isServerMode) {
      setBatchError('Server submissions are only available for signed-in grading.')
      return
    }

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

      setBatchMessage(
        `Loaded ${bundles.length} server submission${bundles.length === 1 ? '' : 's'}.`
      )
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

  async function buildJudgeCases(): Promise<JudgeCaseData[]> {
    if (useSavedTestCases) {
      return assignmentTestCases.map((testCase) => ({
        testNumber: testCase.caseOrder,
        inputLabel:
          testCase.inputFileName ??
          (testCase.inputText ? `Test ${testCase.caseOrder} input` : null),
        outputLabel:
          testCase.expectedOutputFileName ?? `Test ${testCase.caseOrder} expected output`,
        stdin: testCase.inputText ?? '',
        expectedOutput: testCase.expectedOutputText
      }))
    }

    const expectedOutputs = await Promise.all(
      selectedOutputFiles.map((filePath) => window.api.file.stringify(filePath))
    )

    const stdinValues =
      selectedInputFiles.length === 0
        ? selectedOutputFiles.map(() => '')
        : await Promise.all(
            selectedInputFiles.map((filePath) => window.api.file.stringify(filePath))
          )

    return selectedOutputFiles.map((outputFile, index) => ({
      testNumber: index + 1,
      inputLabel: selectedInputFiles[index] ?? null,
      outputLabel: outputFile,
      stdin: stdinValues[index] ?? '',
      expectedOutput: expectedOutputs[index] ?? ''
    }))
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
        await saveGradebookRecord(failedRecord, gradebookMode)

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

      const judgeCases = await buildJudgeCases()
      const judgeResults: BatchJudgeCaseResult[] = []

      for (const judgeCase of judgeCases) {
        const result = await window.api.compiler.dockerJudgeCpp({
          executablePath: compileResult.executablePath,
          stdin: judgeCase.stdin,
          expectedOutput: judgeCase.expectedOutput,
          timeoutMs: 5000
        })

        judgeResults.push({
          testNumber: judgeCase.testNumber,
          inputFile: judgeCase.inputLabel,
          outputFile: judgeCase.outputLabel,
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
      await saveGradebookRecord(savedRecord, gradebookMode)

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
      await saveGradebookRecord(failedRecord, gradebookMode)

      updateStudent(index, {
        status: 'failed',
        errorMessage: 'An error occurred while grading this student.',
        savedToGradebook: true
      })
    }
  }

  async function handleGradeStudent(index: number): Promise<void> {
    if (!selectedAssignmentId) {
      setBatchError('Select an assignment before grading.')
      return
    }

    if (!useSavedTestCases && selectedOutputFiles.length === 0) {
      setBatchError('Select at least one expected output file before grading.')
      return
    }

    if (
      !useSavedTestCases &&
      selectedInputFiles.length > 0 &&
      selectedInputFiles.length !== selectedOutputFiles.length
    ) {
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

    if (!useSavedTestCases && selectedOutputFiles.length === 0) {
      setBatchError('Select at least one expected output file before grading.')
      return
    }

    if (
      !useSavedTestCases &&
      selectedInputFiles.length > 0 &&
      selectedInputFiles.length !== selectedOutputFiles.length
    ) {
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
      <p style={{ color: '#cbd5e1', marginBottom: '1rem' }}>
        Completed batch grading runs save to the {gradebookDestinationLabel}.
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

        {isServerMode && (
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
            {isLoadingAssignmentTestCases ? (
              <span style={{ marginLeft: '8px', fontSize: '13px', color: '#facc15' }}>
                Loading test cases...
              </span>
            ) : assignmentTestCases.length > 0 ? (
              <span style={{ marginLeft: '8px', fontSize: '13px', color: '#22c55e' }}>
                Loaded {assignmentTestCases.length} saved test case
                {assignmentTestCases.length === 1 ? '' : 's'}
              </span>
            ) : (
              <span style={{ marginLeft: '8px', fontSize: '13px', color: '#facc15' }}>
                No saved test cases. Manual files will be used.
              </span>
            )}
          </div>
        )}

        {isServerMode && (
          <div
            style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '14px' }}
          >
            <span style={{ fontSize: '14px' }}>Test cases:</span>

            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="radio"
                name="grading-test-case-mode"
                checked={testCaseMode === 'saved'}
                disabled={assignmentTestCases.length === 0 || isBatchGrading}
                onChange={() => setTestCaseMode('saved')}
              />
              Saved assignment cases
            </label>

            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="radio"
                name="grading-test-case-mode"
                checked={testCaseMode === 'manual'}
                disabled={isBatchGrading}
                onChange={() => setTestCaseMode('manual')}
              />
              Manual files for this run
            </label>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={() => void handleImportSubmissionFolder()} className="primary-button">
            Import Submission Folder
          </button>

          {isServerMode && (
            <button
              onClick={() => void handleLoadServerSubmissions()}
              className="primary-button"
              disabled={isLoadingServerSubmissions || !selectedAssignmentId}
            >
              {isLoadingServerSubmissions
                ? 'Loading Server Submissions...'
                : 'Load Server Submissions'}
            </button>
          )}

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
          <p>
            Active Test Case Mode: {useSavedTestCases ? 'Saved assignment cases' : 'Manual files'}
          </p>
          <p>Saved Test Cases: {assignmentTestCases.length}</p>
          <p>Manual Input Files: {selectedInputFiles.length}</p>
          <p>Manual Output Files: {selectedOutputFiles.length}</p>

          {judgeFilePairPreview.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <h3 style={{ marginBottom: '4px' }}>Test Case Pairing</h3>

              <ul style={{ paddingLeft: '20px', margin: 0 }}>
                {judgeFilePairPreview.map((pair, index) => (
                  <li
                    key={`${pair.inputFile}-${pair.outputFile}`}
                    style={{ fontSize: '14px', marginBottom: '4px', overflowWrap: 'anywhere' }}
                  >
                    Test {index + 1}: {pair.inputFile ? getFileName(pair.inputFile) : 'No input'} →{' '}
                    {getFileName(pair.outputFile)}
                  </li>
                ))}
              </ul>

              {!useSavedTestCases &&
                selectedInputFiles.length > 0 &&
                selectedInputFiles.length !== selectedOutputFiles.length && (
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
