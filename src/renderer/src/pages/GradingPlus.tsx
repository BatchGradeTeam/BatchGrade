/**
 * @file: GradingPlus.tsx
 * @description:
 * This page implements the instructor-only batch grading workflow.
 * It allows the instructor to load multiple student C++ submissions,
 * run compile and judge checks one at a time, save results to the
 * local Gradebook storage, and track progress across the whole grading queue.
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { NavBar } from '../components/Navbar'
import { Footer } from '../components/Footer'
import { compileCppFiles } from '../components/compiler/cppWorkflowApi'
import type { BatchJudgeCaseResult, BatchStudentSubmission } from '../../../shared/batchGrading'
import { StudentGradingCard } from '@renderer/components/grading/StudentGradingCard'
import type { GradebookRecord } from '../../../shared/gradebook'
import { saveGradebookRecord } from '../lib/gradebookStorage'

/**
 * Returns the file name from a full file path.
 *
 * @param {string} filePath - Full file path
 * @returns {string} File name only
 */
function getFileName(filePath: string): string {
  const parts = filePath.split(/[/\\]/)
  return parts[parts.length - 1] || filePath
}

/**
 * Represents one input/output test case pair (for UI preview only).
 */
type JudgeFilePairPreview = {
  inputFile: string
  outputFile: string
}

/**
 * Builds a pairing preview by matching sorted input/output files by index.
 *
 * @param {string[]} inputFiles - Sorted input files
 * @param {string[]} outputFiles - Sorted output files
 * @returns {JudgeFilePairPreview[]} Pair preview list
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
 * Returns a new alphabetically sorted file list.
 *
 * @param {string[]} files - File paths to sort
 * @returns {string[]} Sorted file paths
 */
function sortFilesAlphabetically(files: string[]): string[] {
  return [...files].sort((a, b) => a.localeCompare(b))
}

/**
 * Builds one Gradebook record from a finished grading result.
 *
 * @param student - Student submission info
 * @param passedCount - Number of passed test cases
 * @param totalCount - Total number of test cases
 * @param status - Final grading status
 * @returns Gradebook record ready to save
 */
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

/**
 * GradingPlus page component.
 *
 * @returns {React.JSX.Element} GradingPlus page
 */
export function GradingPlus(): React.JSX.Element {
  const navigate = useNavigate()

  // Stores all student submissions in the grading queue.
  const [students, setStudents] = useState<BatchStudentSubmission[]>([])

  // Stores selected input files for judge testing.
  const [selectedInputFiles, setSelectedInputFiles] = useState<string[]>([])

  // Stores selected expected output files for judge testing.
  const [selectedOutputFiles, setSelectedOutputFiles] = useState<string[]>([])

  // Tracks which student is currently being graded.
  const [currentStudentIndex, setCurrentStudentIndex] = useState<number | null>(null)

  // Tracks whether grading is currently running.
  const [isBatchGrading, setIsBatchGrading] = useState(false)

  // Stores any error message shown to the instructor.
  const [batchError, setBatchError] = useState<string | null>(null)

  // Stores success/info message shown to the instructor.
  const [batchMessage, setBatchMessage] = useState<string | null>(null)

  // Tracks which student card is currently expanded.
  const [expandedStudentIndex, setExpandedStudentIndex] = useState<number | null>(null)

  // Controls whether the input dropdown menu is visible.
  const [showInputMenu, setShowInputMenu] = useState(false)

  // Controls whether the output dropdown menu is visible.
  const [showOutputMenu, setShowOutputMenu] = useState(false)

  // Builds the current input/output pairing preview for display.
  const judgeFilePairPreview = buildJudgeFilePairPreview(selectedInputFiles, selectedOutputFiles)

  // Stores references to student cards for auto-scroll behavior.
  const studentCardRefs = useRef<(HTMLDivElement | null)[]>([])

  /**
   * Closes the input/output dropdown menus when the user clicks outside.
   */
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

  /**
   * Automatically scrolls to the current student card when grading begins.
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
   * Updates one student in the queue.
   *
   * @param {number} index - Student index
   * @param {Partial<BatchStudentSubmission>} updates - Fields to update
   */
  function updateStudent(index: number, updates: Partial<BatchStudentSubmission>): void {
    setStudents((currentStudents) =>
      currentStudents.map((student, i) => (i === index ? { ...student, ...updates } : student))
    )
  }

  /**
   * Adds one selected file to a list if it is not already included.
   *
   * @param {string[]} files - Current file list
   * @param {string | undefined} nextFile - File to add
   * @returns {string[]} Updated file list
   */
  function appendUniqueFile(files: string[], nextFile: string | undefined): string[] {
    if (!nextFile || files.includes(nextFile)) {
      return files
    }

    return [...files, nextFile]
  }

  /**
   * Lets the instructor select multiple student submission files to build the grading queue.
   * Each file is added as a new student in the queue with an initial "pending" status.
   * Duplicate files are ignored to prevent adding the same student multiple times.
   */
  async function handleSelectStudentFiles(): Promise<void> {
    try {
      const files = await window.api.file.selectCppFiles()

      setStudents((currentStudents) => {
        // Track existing file paths so duplicate student files are not added again.
        const existingPaths = new Set(currentStudents.flatMap((student) => student.filePaths))

        // Only keep files that are not already in the queue.
        const newFiles = files.filter((filePath) => !existingPaths.has(filePath))

        if (newFiles.length === 0) {
          return currentStudents
        }

        const startIndex = currentStudents.length

        // Convert each newly selected file into one student queue item.
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

  /**
   * Imports student submissions from a selected parent folder.
   * Each subfolder is treated as one student and all `.cpp` files
   * inside are added to the grading queue.
   */
  async function handleImportSubmissionFolder(): Promise<void> {
    try {
      const groups = await window.api.file.selectSubmissionFolder()

      setStudents((currentStudents) => {
        // Track imported folder names so the same submission folder is not added twice.
        const existingFolderNames = new Set(currentStudents.map((student) => student.folderName))

        // Only keep new student folders.
        const newGroups = groups.filter((group) => !existingFolderNames.has(group.folderName))

        if (newGroups.length === 0) {
          return currentStudents
        }

        const startIndex = currentStudents.length

        // Convert each imported folder into one student queue item.
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

  /**
   * Lets the instructor add one input file for judge testing.
   */
  async function handleSelectInputFile(): Promise<void> {
    try {
      const file = await window.api.file.select()

      // Add the selected file if it is new, then keep the list sorted.
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
   * Lets the instructor import all input files from a selected folder.
   */
  async function handleSelectInputFolder(): Promise<void> {
    try {
      const files = await window.api.file.selectFilesFromFolder()

      // Replace current input list with the sorted folder contents.
      setSelectedInputFiles(sortFilesAlphabetically(files))
      setBatchError(null)
      setBatchMessage(null)
    } catch (error) {
      console.error('Error selecting input folder:', error)
      setBatchError('Could not import input folder.')
    }
  }

  /**
   * Lets the instructor add one expected output file for judge testing.
   */
  async function handleSelectOutputFile(): Promise<void> {
    try {
      const file = await window.api.file.select()

      // Add the selected file if it is new, then keep the list sorted.
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
   * Lets the instructor import all expected output files from a selected folder.
   */
  async function handleSelectOutputFolder(): Promise<void> {
    try {
      const files = await window.api.file.selectFilesFromFolder()

      // Replace current output list with the sorted folder contents.
      setSelectedOutputFiles(sortFilesAlphabetically(files))
      setBatchError(null)
      setBatchMessage(null)
    } catch (error) {
      console.error('Error selecting output folder:', error)
      setBatchError('Could not import output folder.')
    }
  }

  /**
   * Grades one student by compiling submitted files, running judge test cases,
   * and saving the final result to Gradebook storage.
   *
   * @param {number} index - Student index in the queue
   * @returns {Promise<void>}
   */
  async function gradeSingleStudent(index: number): Promise<void> {
    // Mark this student as the current active grading target.
    setCurrentStudentIndex(index)
    setExpandedStudentIndex(index)

    const student = students[index]

    // Reset prior judge results before starting a fresh grading run.
    updateStudent(index, {
      status: 'grading',
      errorMessage: null,
      judgeResults: [],
      passedCount: 0,
      totalCount: 0
    })

    try {
      // Compile all C++ files submitted by this student.
      const compileResult = await compileCppFiles(student.filePaths)

      updateStudent(index, {
        compileResult
      })

      // Stop early if compilation fails.
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

      // Move to judge phase after a successful compile.
      updateStudent(index, {
        status: 'judging'
      })

      // Read expected outputs and input file contents before running tests.
      const expectedOutputs = await Promise.all(
        selectedOutputFiles.map((filePath) => window.api.file.stringify(filePath))
      )

      const stdinValues = await Promise.all(
        selectedInputFiles.map((filePath) => window.api.file.stringify(filePath))
      )

      const judgeResults: BatchJudgeCaseResult[] = []

      // Run each paired test case one at a time.
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

      // Count passed tests, save the Gradebook record, and store final grading results.
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

  /**
   * Grades one selected student from the queue after validating required judge files.
   *
   * @param {number} index - Student index in the queue
   * @returns {Promise<void>}
   */
  async function handleGradeStudent(index: number): Promise<void> {
    // Require at least one input file.
    if (selectedInputFiles.length === 0) {
      setBatchError('Select at least one input file before grading.')
      return
    }

    // Require at least one expected output file.
    if (selectedOutputFiles.length === 0) {
      setBatchError('Select at least one expected output file before grading.')
      return
    }

    // Require matching input/output counts.
    if (selectedInputFiles.length !== selectedOutputFiles.length) {
      setBatchError('Input files must match the number of output files.')
      return
    }

    // Do nothing if this student is already being processed.
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

  /**
   * Grades all pending or failed students in sequence.
   *
   * @returns {Promise<void>}
   */
  async function handleGradeAllStudents(): Promise<void> {
    // Do not start if there are no students in the queue.
    if (students.length === 0) {
      setBatchError('No students available to grade.')
      return
    }

    // Require at least one expected output file.
    if (selectedOutputFiles.length === 0) {
      setBatchError('Select at least one expected output file before grading.')
      return
    }

    // Require matching input/output counts.
    if (selectedInputFiles.length !== selectedOutputFiles.length) {
      setBatchError('Input files must match the number of output files.')
      return
    }

    // Find students that still need grading or retry.
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
      // Grade each pending/failed student one by one.
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
   * Toggles one student card between expanded and collapsed states.
   *
   * @param {number} index - Student index in the queue
   */
  function handleToggleStudentDetails(index: number): void {
    setExpandedStudentIndex((currentIndex) => (currentIndex === index ? null : index))
  }

  // Count how many students have finished grading, whether success or failure.
  const completedCount = students.filter(
    (student) => student.status === 'done' || student.status === 'failed'
  ).length

  return (
    <>
      <NavBar />

      <div style={{ padding: '6rem' }}>
        <h1>Grading+ Page</h1>
        <p>
          Instructor batch grading workflow for compiling and judging multiple student submissions.
        </p>

        {/* Error message banner */}
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

        {/* Success/info message banner */}
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

        {/* Batch setup section */}
        <div
          style={{
            border: '1px solid gray',
            padding: '12px',
            marginBottom: '12px',
            backgroundColor: '#1f1f1f'
          }}
        >
          <h2 style={{ marginBottom: '10px' }}>Batch Setup</h2>

          {/* Main setup buttons */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => void handleImportSubmissionFolder()} className="primary-button">
              Import Submission Folder
            </button>

            <button onClick={() => void handleSelectStudentFiles()} className="primary-button">
              Select Student C++ Files
            </button>

            {/* Input file menu */}
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

            {/* Output file menu */}
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
              className={
                isBatchGrading || students.length === 0 ? 'cancel-button' : 'primary-button'
              }
            >
              Grade All Students
            </button>
          </div>

          {/* Warning about missing input files */}
          <p style={{ marginTop: '10px', fontSize: '13px', color: '#facc15' }}>
            ⚠️ If the program requires user input, add input files before grading. Otherwise, test
            cases may fail due to missing input.
          </p>

          {/* Warning about alphabetical pairing behavior */}
          <p style={{ fontSize: '13px', color: '#facc15' }}>
            ⚠️ Input and output files are paired by alphabetical order. Make sure filenames follow
            the same naming pattern.
          </p>

          {/* Batch status summary */}
          <div style={{ marginTop: '12px', fontSize: '14px', lineHeight: '1.6' }}>
            <p>Total Students: {students.length}</p>
            <p>Input Files: {selectedInputFiles.length}</p>
            <p>Output Files: {selectedOutputFiles.length}</p>

            {/* Preview of how test case files are paired */}
            {judgeFilePairPreview.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <h3 style={{ marginBottom: '4px' }}>Test Case Pairing</h3>

                <ul style={{ paddingLeft: '20px', margin: 0 }}>
                  {judgeFilePairPreview.map((pair, index) => (
                    <li
                      key={`${pair.inputFile}-${pair.outputFile}`}
                      style={{ fontSize: '14px', marginBottom: '4px', overflowWrap: 'anywhere' }}
                    >
                      Test {index + 1}: {getFileName(pair.inputFile)} →{' '}
                      {getFileName(pair.outputFile)}
                    </li>
                  ))}
                </ul>

                {/* Warn if input/output counts are still mismatched */}
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

        {/* Student grading queue */}
        <div style={{ display: 'grid', gap: '12px' }}>
          {students.map((student, index) => {
            return (
              <div
                key={student.studentId}
                ref={(element) => {
                  // Save each card reference for auto-scroll.
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

        {/* Navigation button back to home page */}
        <button
          onClick={() => navigate('/instructordashboard')}
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
      </div>

      <Footer />
    </>
  )
}
