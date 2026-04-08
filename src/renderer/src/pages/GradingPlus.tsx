/**
 * @file: GradingPlus.tsx
 * @description:
 * This page implements the instructor-only batch grading workflow.
 * It allows the instructor to load multiple student C++ submissions,
 * run compile and judge checks one student at a time, and track progress
 * across the whole grading queue.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NavBar } from '../components/Navbar'
import { Footer } from '../components/Footer'
import { compileCppFiles } from '../components/compiler/cppWorkflowApi'
import type { BatchJudgeCaseResult, BatchStudentSubmission } from '../../../shared/batchGrading'

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
 * GradingPlus page component.
 *
 * @returns {React.JSX.Element} GradingPlus page
 */
export function GradingPlus(): React.JSX.Element {
  const navigate = useNavigate()

  const [students, setStudents] = useState<BatchStudentSubmission[]>([])
  const [selectedInputFiles, setSelectedInputFiles] = useState<string[]>([])
  const [selectedOutputFiles, setSelectedOutputFiles] = useState<string[]>([])
  const [currentStudentIndex, setCurrentStudentIndex] = useState<number | null>(null)
  const [isBatchGrading, setIsBatchGrading] = useState(false)
  const [batchError, setBatchError] = useState<string | null>(null)
  const [expandedStudentIndex, setExpandedStudentIndex] = useState<number | null>(null)

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
        const existingPaths = new Set(currentStudents.map((student) => student.filePath))

        const newFiles = files.filter((filePath) => !existingPaths.has(filePath))

        if (newFiles.length === 0) {
          return currentStudents
        }

        const startIndex = currentStudents.length

        const newStudents = newFiles.map((filePath, index) => ({
          studentId: `student-${startIndex + index + 1}`,
          studentName: `Student ${startIndex + index + 1}`,
          filePath,
          fileName: getFileName(filePath),
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
    } catch (error) {
      console.error('Error selecting student files:', error)
      setBatchError('Could not select student submission files.')
    }
  }

  /**
   * Lets the instructor add one input file for judge testing.
   */
  async function handleSelectInputFile(): Promise<void> {
    try {
      const file = await window.api.file.select()
      setSelectedInputFiles((currentFiles) => appendUniqueFile(currentFiles, file))
      setBatchError(null)
    } catch (error) {
      console.error('Error selecting input file:', error)
      setBatchError('Could not select input file.')
    }
  }

  /**
   * Lets the instructor add one expected output file for judge testing.
   */
  async function handleSelectOutputFile(): Promise<void> {
    try {
      const file = await window.api.file.select()
      setSelectedOutputFiles((currentFiles) => appendUniqueFile(currentFiles, file))
      setBatchError(null)
    } catch (error) {
      console.error('Error selecting output file:', error)
      setBatchError('Could not select expected output file.')
    }
  }

  /**
   * Grades the next pending student in the queue.
   */
  async function handleGradeNextStudent(): Promise<void> {
    const nextIndex = students.findIndex((student) => student.status === 'pending')

    if (nextIndex === -1) {
      setBatchError('No pending students left to grade.')
      return
    }

    if (selectedOutputFiles.length === 0) {
      setBatchError('Select at least one expected output file before grading.')
      return
    }

    if (selectedInputFiles.length > 0 && selectedInputFiles.length !== selectedOutputFiles.length) {
      setBatchError('Input files must match the number of output files.')
      return
    }

    setIsBatchGrading(true)
    setBatchError(null)
    setCurrentStudentIndex(nextIndex)
    setExpandedStudentIndex(nextIndex)

    const student = students[nextIndex]

    try {
      updateStudent(nextIndex, {
        status: 'grading',
        errorMessage: null,
        judgeResults: [],
        passedCount: 0,
        totalCount: 0
      })

      const compileResult = await compileCppFiles([student.filePath])

      updateStudent(nextIndex, {
        compileResult
      })

      if (!compileResult.compileSuccess || !compileResult.executablePath) {
        updateStudent(nextIndex, {
          status: 'failed',
          errorMessage: 'Compilation failed.'
        })
        return
      }

      updateStudent(nextIndex, {
        status: 'judging'
      })

      const expectedOutputs = await Promise.all(
        selectedOutputFiles.map((filePath) => window.api.file.stringify(filePath))
      )

      const stdinValues =
        selectedInputFiles.length === 0
          ? selectedOutputFiles.map(() => '')
          : await Promise.all(
              selectedInputFiles.map((filePath) => window.api.file.stringify(filePath))
            )

      const judgeResults: BatchJudgeCaseResult[] = []

      for (const [index, outputFile] of selectedOutputFiles.entries()) {
        const inputFile = selectedInputFiles[index] ?? null

        const result = await window.api.compiler.judgeCpp({
          executablePath: compileResult.executablePath,
          stdin: stdinValues[index] ?? '',
          expectedOutput: expectedOutputs[index] ?? '',
          timeoutMs: 5000
        })

        judgeResults.push({
          testNumber: index + 1,
          inputFile,
          outputFile,
          result
        })
      }

      const passedCount = judgeResults.filter((test) => test.result.passed).length
      const totalCount = judgeResults.length

      updateStudent(nextIndex, {
        status: 'done',
        judgeResults,
        passedCount,
        totalCount,
        savedToGradebook: false
      })
    } catch (error) {
      console.error('Error grading student:', error)

      updateStudent(nextIndex, {
        status: 'failed',
        errorMessage: 'An error occurred while grading this student.'
      })
    } finally {
      setIsBatchGrading(false)
    }
  }

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

        <div
          style={{
            border: '1px solid gray',
            padding: '12px',
            marginBottom: '12px',
            backgroundColor: '#1f1f1f'
          }}
        >
          <h2 style={{ marginBottom: '10px' }}>Batch Setup</h2>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => void handleSelectStudentFiles()} className="primary-button">
              Select Student C++ Files
            </button>

            <button onClick={() => void handleSelectInputFile()} className="primary-button">
              Add Input File
            </button>

            <button onClick={() => void handleSelectOutputFile()} className="primary-button">
              Add Output File
            </button>

            <button
              onClick={() => void handleGradeNextStudent()}
              disabled={isBatchGrading || students.length === 0}
              className={
                isBatchGrading || students.length === 0 ? 'cancel-button' : 'primary-button'
              }
            >
              {isBatchGrading ? 'Grading...' : 'Grade Next Student'}
            </button>
          </div>

          <p style={{ marginTop: '10px', fontSize: '13px', color: '#facc15' }}>
            ⚠️ If the program requires user input, add input files before grading. Otherwise, test
            cases may fail due to missing input.
          </p>

          <div style={{ marginTop: '12px', fontSize: '14px', lineHeight: '1.6' }}>
            <p>Total Students: {students.length}</p>
            <p>Input Files: {selectedInputFiles.length}</p>
            <p>Output Files: {selectedOutputFiles.length}</p>
            <p>Completed: {completedCount}</p>
            <p>
              Current Student:{' '}
              {currentStudentIndex !== null ? students[currentStudentIndex]?.studentName : 'None'}
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '12px' }}>
          {students.map((student, index) => {
            const isActive = currentStudentIndex === index
            const isExpanded = expandedStudentIndex === index

            return (
              <div
                key={student.filePath}
                style={{
                  border: isActive ? '2px solid #22c55e' : '1px solid gray',
                  backgroundColor: '#1f1f1f',
                  padding: '12px'
                }}
              >
                <h3 style={{ marginBottom: '8px' }}>
                  {student.studentName} {student.status === 'done' ? '✅' : ''}
                </h3>

                <p style={{ fontSize: '14px' }}>Student ID: {student.studentId}</p>
                <p style={{ fontSize: '14px', overflowWrap: 'anywhere' }}>
                  File: {student.fileName}
                </p>
                <p style={{ fontSize: '14px' }}>Status: {student.status}</p>

                {isExpanded && (
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '12px',
                      border: '1px solid #4b5563',
                      backgroundColor: '#111827'
                    }}
                  >
                    <p style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>
                      Grading Details
                    </p>

                    <p style={{ fontSize: '14px', marginBottom: '8px' }}>
                      {student.status === 'grading' && 'Compiling submission...'}
                      {student.status === 'judging' && 'Running judge test cases...'}
                      {student.status === 'done' && 'Grading complete.'}
                      {student.status === 'failed' && 'Grading failed.'}
                      {student.status === 'pending' && 'Waiting to be graded.'}
                    </p>

                    {student.compileResult && (
                      <div style={{ marginTop: '10px' }}>
                        <p style={{ fontSize: '14px' }}>
                          Compile Success: {student.compileResult.compileSuccess ? 'Yes' : 'No'}
                        </p>
                        <p style={{ fontSize: '14px' }}>Message: {student.compileResult.message}</p>
                      </div>
                    )}

                    {student.totalCount > 0 && (
                      <div style={{ marginTop: '10px' }}>
                        <p style={{ fontSize: '14px' }}>
                          Judge Result: {student.passedCount} / {student.totalCount} passed
                        </p>
                      </div>
                    )}

                    {student.errorMessage && (
                      <p style={{ marginTop: '10px', color: '#f87171' }}>
                        Error: {student.errorMessage}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <button
          onClick={() => navigate('/')}
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
