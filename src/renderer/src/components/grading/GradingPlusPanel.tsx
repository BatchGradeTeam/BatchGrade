import { useEffect, useRef, useState } from 'react'
import type { BatchJudgeCaseResult, BatchStudentSubmission } from '../../../../shared/batchGrading'
import type { GradebookRecord } from '../../../../shared/gradebookTypes'
import type { Assignment, AssignmentTestCase } from '../../../../shared/types'
import {
  clearGradebookRecords,
  saveGradebookRecord,
  type GradebookStorageMode
} from '../../lib/gradebookStorage'
import {
  loadAssignmentTestCases,
  loadServerAssignments,
  loadServerSubmissionsForGrading
} from '../../lib/serverData'
import { StudentGradingCard } from './StudentGradingCard'

/**
 * Props used to configure Grading+ for instructor, guest, local, or server workflows.
 */
interface GradingPlusPanelProps {
  title?: string
  description?: string
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

/**
 * Returns the file name without its extension.
 * Used as a fallback student id/name for manual file uploads.
 */
function getFileStem(filePath: string): string {
  return getFileName(filePath).replace(/\.[^.]+$/, '')
}

type JudgeFilePairPreview = {
  inputFile: string | null
  outputFile: string
}

type GradingMode = 'local' | 'docker'
type JudgeCaseData = {
  testNumber: number
  inputLabel: string | null
  outputLabel: string
  stdin: string
  expectedOutput: string
}

type TestCaseMode = 'saved' | 'manual'

/**
 * Stores the Guest BatchGrade queue and results so they survive route changes.
 */
const GUEST_BATCHGRADE_STUDENTS_KEY = 'guestBatchGradeStudents'

/**
 * Builds a preview list showing how input files and expected output files
 * will be paired during manual test-case grading.
 */
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

/**
 * Sorts selected judge files so input/output pairing is predictable.
 */
function sortFilesAlphabetically(files: string[]): string[] {
  return [...files].sort((a, b) => a.localeCompare(b))
}

/**
 * Converts one graded student result into a Gradebook record.
 */
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
    submittedAt: Date.now(),
    scoreSource: 'offline-batch-grade'
  }
}

export function GradingPlusPanel({
  title = 'Grading+ Page',
  description = 'Batch grading workflow for compiling and judging multiple student submissions.',
  dataSourceMode = 'server',
  gradebookMode = 'local',
  showHomeButton = false,
  onGoHome
}: GradingPlusPanelProps): React.JSX.Element {
  /**
   * Stores the current batch queue. In Guest Mode, saved students are loaded
   * from localStorage so results remain after navigating away and returning.
   */
  const [students, setStudents] = useState<BatchStudentSubmission[]>(() => {
    if (gradebookMode !== 'guest') {
      return []
    }

    try {
      const savedStudents = localStorage.getItem(GUEST_BATCHGRADE_STUDENTS_KEY)

      return savedStudents ? (JSON.parse(savedStudents) as BatchStudentSubmission[]) : []
    } catch (error) {
      console.error('Failed to load Guest BatchGrade results:', error)
      return []
    }
  })
  const [selectedInputFiles, setSelectedInputFiles] = useState<string[]>([])
  const [selectedOutputFiles, setSelectedOutputFiles] = useState<string[]>([])

  // Tracks grading progress and UI feedback during single-student or batch grading.
  const [currentStudentIndex, setCurrentStudentIndex] = useState<number | null>(null)
  const [isBatchGrading, setIsBatchGrading] = useState(false)
  const [batchError, setBatchError] = useState<string | null>(null)
  const [batchMessage, setBatchMessage] = useState<string | null>(null)
  const [expandedStudentIndex, setExpandedStudentIndex] = useState<number | null>(null)

  // Controls dropdown menu visibility for mode/input/output selectors.
  const [showInputMenu, setShowInputMenu] = useState(false)
  const [showOutputMenu, setShowOutputMenu] = useState(false)
  const [gradingMode, setGradingMode] = useState<GradingMode>('local')
  const [showModeMenu, setShowModeMenu] = useState(false)

  // Assignment and test-case data used when grading server/local saved assignments.
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('')
  const [isLoadingServerSubmissions, setIsLoadingServerSubmissions] = useState(false)
  const [assignmentTestCases, setAssignmentTestCases] = useState<AssignmentTestCase[]>([])
  const [isLoadingAssignmentTestCases, setIsLoadingAssignmentTestCases] = useState(false)
  const [testCaseMode, setTestCaseMode] = useState<TestCaseMode>('saved')

  // Derived values used to keep rendering and grading logic easier to read.
  const isServerMode = dataSourceMode === 'server'
  const gradebookDestinationLabel =
    gradebookMode === 'local' ? 'offline gradebook on this device' : 'online gradebook'
  const activeAssignmentId = selectedAssignmentId || 'guest-batchgrade'

  // Determines whether grading should use saved assignment cases or manual files.
  const useSavedTestCases = testCaseMode === 'saved' && assignmentTestCases.length > 0
  const judgeFilePairPreview = useSavedTestCases
    ? assignmentTestCases.map((testCase) => ({
        inputFile:
          testCase.inputFileName ??
          (testCase.inputText ? `Test ${testCase.caseOrder} input` : null),
        outputFile: testCase.expectedOutputFileName ?? `Test ${testCase.caseOrder} expected output`
      }))
    : buildJudgeFilePairPreview(selectedInputFiles, selectedOutputFiles)

  // Stores references to student cards so the active card can scroll into view.
  const studentCardRefs = useRef<(HTMLDivElement | null)[]>([])

  /**
   * Persists Guest Mode batch results whenever the student queue changes.
   */
  useEffect(() => {
    if (gradebookMode !== 'guest') {
      return
    }

    try {
      localStorage.setItem(GUEST_BATCHGRADE_STUDENTS_KEY, JSON.stringify(students))
    } catch (error) {
      console.error('Failed to save Guest BatchGrade results:', error)
    }
  }, [gradebookMode, students])

  /**
   * Closes open dropdown menus when the user clicks elsewhere on the page.
   */
  useEffect(() => {
    function handleClickOutside(): void {
      setShowModeMenu(false)
      setShowInputMenu(false)
      setShowOutputMenu(false)
    }

    window.addEventListener('click', handleClickOutside)

    return () => {
      window.removeEventListener('click', handleClickOutside)
    }
  }, [])

  /**
   * Loads available assignments based on the selected data source mode.
   * Server mode falls back to local assignments if server loading fails.
   */
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

  /**
   * Automatically scrolls to the student card currently being graded.
   */
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

  /**
   * Loads test cases for the selected assignment.
   * Falls back to local test cases if server test cases are unavailable.
   */
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

  /**
   * Updates one student in the batch queue without replacing the whole list manually.
   */
  function updateStudent(index: number, updates: Partial<BatchStudentSubmission>): void {
    setStudents((currentStudents) =>
      currentStudents.map((student, i) => (i === index ? { ...student, ...updates } : student))
    )
  }

  /**
   * Adds a selected file only if it exists and has not already been selected.
   */
  function appendUniqueFile(files: string[], nextFile: string | undefined): string[] {
    if (!nextFile || files.includes(nextFile)) {
      return files
    }

    return [...files, nextFile]
  }

  /**
   * Adds individual C++ files as separate student submissions.
   */
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

  /**
   * Imports a folder of student submissions, where each subfolder becomes one student.
   */
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

  /**
   * Loads assignment submissions from the server and materializes them locally
   * so the existing compiler and judge flow can process them.
   */
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

  /**
   * Selects one manual input file for judge testing.
   */
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

  /**
   * Imports a folder of manual input files for judge testing.
   */
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

  /**
   * Selects one expected output file for judge testing.
   */
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

  /**
   * Imports a folder of expected output files for judge testing.
   */
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

  /**
   * Builds the judge test cases from either saved assignment test cases
   * or manually selected input/output files.
   */
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

  /**
   * Grades one student by compiling their C++ files, running judge cases,
   * updating the UI status, and saving the result to the selected Gradebook mode.
   */
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

    // Compile with either Docker or the local compiler depending on the selected mode.
    try {
      let compileResult
      if (gradingMode === 'docker') {
        const dockerResult = await window.api.compiler.dockerCompileCpp(student.filePaths)

        compileResult = {
          compileSuccess: dockerResult.success,
          compilerPath: 'docker',
          executablePath: dockerResult.executablePath,
          sourceFiles: student.filePaths,
          stdout: dockerResult.stdout,
          stderr: dockerResult.stderr,
          message: dockerResult.message
        }
      } else {
        compileResult = await window.api.compiler.compileCpp({
          sourceFiles: student.filePaths
        })
      }

      updateStudent(index, {
        compileResult
      })

      // Save failed compile attempts so they still appear in the Gradebook.
      if (!compileResult.compileSuccess || !compileResult.executablePath) {
        const failedRecord = buildGradebookRecord(student, activeAssignmentId, 0, 0, 'failed')
        await saveGradebookRecord(failedRecord, gradebookMode)

        updateStudent(index, {
          status: 'failed',
          errorMessage: 'Compilation failed.',
          savedToGradebook: true
        })
        return
      }

      // Switch the student status from compiling to judging before running tests.
      updateStudent(index, {
        status: 'judging'
      })

      const judgeCases = await buildJudgeCases()
      const judgeResults: BatchJudgeCaseResult[] = []

      // Run every judge case and collect detailed pass/fail results.
      for (const judgeCase of judgeCases) {
        const result =
          gradingMode === 'docker'
            ? await window.api.compiler.dockerJudgeCpp({
                executablePath: compileResult.executablePath,
                stdin: judgeCase.stdin,
                expectedOutput: judgeCase.expectedOutput,
                timeoutMs: 5000
              })
            : await window.api.compiler.judgeCpp({
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

      // Save completed grading results and update the visible student card.
      const passedCount = judgeResults.filter((test) => test.result.passed).length
      const totalCount = judgeResults.length
      const savedRecord = buildGradebookRecord(
        student,
        activeAssignmentId,
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

      const failedRecord = buildGradebookRecord(student, activeAssignmentId, 0, 0, 'failed')
      await saveGradebookRecord(failedRecord, gradebookMode)

      updateStudent(index, {
        status: 'failed',
        errorMessage: 'An error occurred while grading this student.',
        savedToGradebook: true
      })
    }
  }

  /**
   * Validates setup requirements before grading a single selected student.
   */
  async function handleGradeStudent(index: number): Promise<void> {
    if (isServerMode && !selectedAssignmentId) {
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

    // Start grading mode and clear previous messages before running.
    setIsBatchGrading(true)
    setBatchError(null)
    setBatchMessage(null)

    try {
      // Run the grading workflow for the selected student.
      await gradeSingleStudent(index)
    } finally {
      setIsBatchGrading(false)
    }
  }

  /**
   * Grades all students that are still pending or previously failed.
   */
  async function handleGradeAllStudents(): Promise<void> {
    if (students.length === 0) {
      setBatchError('No students available to grade.')
      return
    }

    if (isServerMode && !selectedAssignmentId) {
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

    // Build a list of students that still need grading.
    const pendingIndexes = students
      .map((student, index) => ({ student, index }))
      .filter(({ student }) => student.status === 'pending' || student.status === 'failed')
      .map(({ index }) => index)

    if (pendingIndexes.length === 0) {
      setBatchMessage('All students have been graded.')
      return
    }

    // Start batch grading and clear previous status messages.
    setIsBatchGrading(true)
    setBatchError(null)
    setBatchMessage(null)

    try {
      // Grade each pending student one by one in sequence.
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

  /**
   * Clears Guest Mode batch results from both the visible queue and localStorage.
   */
  async function handleClearGuestResults(): Promise<void> {
    if (gradebookMode !== 'guest') {
      return
    }

    try {
      // Reset stored guest results and clear the current UI state.
      localStorage.removeItem(GUEST_BATCHGRADE_STUDENTS_KEY)
      await clearGradebookRecords('guest')

      setStudents([])
      setCurrentStudentIndex(null)
      setExpandedStudentIndex(null)
      setBatchError(null)
      setBatchMessage('Guest BatchGrade results have been cleared.')
    } catch (error) {
      console.error('Error clearing Guest BatchGrade results:', error)
      setBatchError('Could not clear Guest BatchGrade results.')
    }
  }

  /**
   * Expands or collapses a student's detailed grading results.
   */
  function handleToggleStudentDetails(index: number): void {
    setExpandedStudentIndex((currentIndex) => (currentIndex === index ? null : index))
  }

  /**
   * Counts students that have finished grading, including failed compile/judge runs.
   */
  const completedCount = students.filter(
    (student) => student.status === 'done' || student.status === 'failed'
  ).length

  return (
    <div className="panel-shell">
      <h1>{title}</h1>
      <p>{description}</p>
      <p style={{ color: '#cbd5e1', marginBottom: '1rem' }}>
        Completed batch grading runs save to the {gradebookDestinationLabel}.
      </p>

      {/* Shows error and success messages for grading/setup actions. */}
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

      {/* Main setup area for assignments, files, grading mode, and batch actions. */}
      <div
        style={{
          border: '1px solid gray',
          padding: '12px',
          marginBottom: '12px',
          backgroundColor: '#1f1f1f'
        }}
      >
        <h2 style={{ marginBottom: '10px' }}>Batch Setup</h2>

        {/* Server mode lets instructors select an assignment and view saved test-case status. */}
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
          <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '14px' }}>
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

        {/* Action buttons for compiler mode, submissions, judge files, and grading. */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowModeMenu((prev) => !prev)
              }}
              className="primary-button"
            >
              Mode: {gradingMode === 'local' ? 'Local' : 'Docker'} ▼
            </button>

            {showModeMenu && (
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
                    setGradingMode('local')
                    setShowModeMenu(false)
                  }}
                  className="secondary-button"
                  style={{ display: 'block', width: '100%' }}
                >
                  Local Compiler
                </button>

                <button
                  onClick={() => {
                    setGradingMode('docker')
                    setShowModeMenu(false)
                  }}
                  className="secondary-button"
                  style={{ display: 'block', width: '100%' }}
                >
                  Docker
                </button>
              </div>
            )}
          </div>

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

          {gradebookMode === 'guest' && (
            <button
              onClick={() => void handleClearGuestResults()}
              disabled={isBatchGrading || students.length === 0}
              className={
                isBatchGrading || students.length === 0 ? 'cancel-button' : 'secondary-button'
              }
            >
              Clear Guest Results
            </button>
          )}
        </div>

        {/* Manual judge setup reminders. */}
        <p style={{ marginTop: '10px', fontSize: '13px', color: '#facc15' }}>
          ⚠️ If the program requires user input, add input files before grading. Otherwise, test
          cases may fail due to missing input.
        </p>

        <p style={{ fontSize: '13px', color: '#facc15' }}>
          ⚠️ Input and output files are paired by alphabetical order. Make sure filenames follow the
          same naming pattern.
        </p>

        {/* Summary of the current batch queue and selected test-case setup. */}
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

      {/* Student cards show per-student status, compile results, and judge results. */}
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

      {/* Optional navigation button used by Guest Mode to return to the dashboard. */}
      {showHomeButton && onGoHome && (
        <div className="button-container">
          <button className="secondary-button" onClick={onGoHome}>
            Back to Dashboard
          </button>
        </div>
      )}
    </div>
  )
}
