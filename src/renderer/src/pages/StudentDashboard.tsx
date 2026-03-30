/**
 * StudentDashboard.tsx
 *
 * Description:
 * This component represents the student-facing dashboard for the
 * BatchGrade platform. After authentication, students are directed
 * to this page where they will eventually be able to interact with
 * assignments and view grading results.
 *
 * Planned functionality for this dashboard includes:
 *  - Viewing assigned programming exercises
 *  - Submitting code solutions
 *  - Viewing automated grading feedback
 *  - Accessing submission history
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CompileCppResult } from '../../../shared/compiler'
import type { SubmitCppResult } from '../../../shared/submission'
import type { Assignment } from '../../../shared/types'
import NavBar from '../components/Navbar'
import Footer from '../components/Footer'
import { useAuth } from '../components/AuthContext'
import { CppWorkflowPanel } from '../components/compiler/CppWorkflowPanel'

/**
 * StudentDashboard Component
 *
 * Provides the primary interface for students after loggin in.
 * This page will eventually allow students to access assignments,
 * submit solutions, and review grading results.
 *
 * @returns StudentDashboard(): React.JSX.Element
 */
function StudentDashboard(): React.JSX.Element {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [compileResult, setCompileResult] = useState<CompileCppResult | null>(null)
  const [submitResult, setSubmitResult] = useState<SubmitCppResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    window.api.assignments
      .getAll()
      .then((result) => {
        setAssignments(result)
        if (result.length > 0) {
          setSelectedAssignmentId(result[0].uuid)
        }
      })
      .catch((error) => {
        console.error('Error loading assignments:', error)
        setErrorMessage('Could not load assignments.')
      })
  }, [])

  const selectedAssignment = useMemo(
    () => assignments.find((assignment) => assignment.uuid === selectedAssignmentId) ?? null,
    [assignments, selectedAssignmentId]
  )

  async function handleSubmit(): Promise<void> {
    if (!user) {
      setErrorMessage('Log in before submitting.')
      return
    }

    if (!selectedAssignmentId) {
      setErrorMessage('Select an assignment before submitting.')
      return
    }

    if (selectedFiles.length === 0) {
      setErrorMessage('Select at least one source file before submitting.')
      return
    }

    if (!compileResult?.compileSuccess) {
      setErrorMessage('Compile successfully before submitting.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)
    setSubmitResult(null)

    try {
      const result = await window.api.submissions.submitCpp({
        assignmentId: selectedAssignmentId,
        studentId: user.uuid,
        sourceFiles: selectedFiles,
        compileSnapshot: {
          compileSuccess: compileResult.compileSuccess,
          compilerPath: compileResult.compilerPath,
          sourceFiles: compileResult.sourceFiles,
          stdout: compileResult.stdout,
          stderr: compileResult.stderr,
          message: compileResult.message
        }
      })

      setSubmitResult(result)
      if (!result.submissionSuccess) {
        setErrorMessage(result.message)
      }
    } catch (error) {
      console.error('Error submitting source files:', error)
      setErrorMessage('Could not save the submission.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <NavBar />

      <div style={{ height: '100vh', padding: '8rem' }}>
        <h1>Student Submission Page</h1>
        <p>
          Compile your C++ source files locally, then submit the source bundle for later grading.
          The submission artifact stores source files and compile logs instead of a host-specific
          executable.
        </p>

        {errorMessage && (
          <div
            style={{
              backgroundColor: '#5a1f1f',
              border: '1px solid red',
              padding: '10px',
              marginTop: '1.5rem'
            }}
          >
            <p>{errorMessage}</p>
          </div>
        )}

        <CppWorkflowPanel
          title="Student Compilation Workspace"
          description="Choose the files you want to submit, compile them, optionally run them with input, and review the output before submitting."
          allowExecution={true}
          onSelectionChange={(files) => {
            setSelectedFiles(files)
            setSubmitResult(null)
          }}
          onCompileResultChange={(result) => {
            setCompileResult(result)
            setSubmitResult(null)
          }}
        />

        <div
          style={{
            border: '1px solid gray',
            padding: '1rem',
            marginTop: '1rem',
            backgroundColor: '#2b2b2b'
          }}
        >
          <h2 style={{ marginBottom: '0.5rem' }}>Submit for Grading</h2>
          <p style={{ marginBottom: '1rem' }}>
            Submission saves a source snapshot and compile log that can be passed into a sandboxed
            grading workflow later.
          </p>

          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Assignment</label>
          <select
            value={selectedAssignmentId}
            onChange={(e) => {
              setSelectedAssignmentId(e.target.value)
              setSubmitResult(null)
              setErrorMessage(null)
            }}
            className="panel-input"
            style={{ maxWidth: '480px', marginBottom: '1rem' }}
          >
            {assignments.length === 0 && <option value="">No assignments available</option>}
            {assignments.map((assignment) => (
              <option key={assignment.uuid} value={assignment.uuid}>
                {assignment.name}
              </option>
            ))}
          </select>

          {selectedAssignment && (
            <div style={{ marginBottom: '1rem', fontSize: '14px', lineHeight: '1.6' }}>
              <p>Due Date: {selectedAssignment.dueDate}</p>
              <p>Grading Criteria: {selectedAssignment.gradingCriteria}</p>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !compileResult?.compileSuccess || selectedFiles.length === 0}
            className={
              isSubmitting || !compileResult?.compileSuccess || selectedFiles.length === 0
                ? 'cancel-button'
                : 'primary-button'
            }
          >
            {isSubmitting ? 'Submitting...' : 'Submit Code'}
          </button>

          {submitResult && (
            <div style={{ marginTop: '1rem', borderTop: '1px solid gray', paddingTop: '1rem' }}>
              <p>Message: {submitResult.message}</p>
              <p>Submission ID: {submitResult.submissionId ?? 'Not created'}</p>
              <p>Submitted At: {submitResult.submittedAt ?? 'Not recorded'}</p>
              <p>Saved Files: {submitResult.submittedFiles.length}</p>
            </div>
          )}
        </div>

        <div style={{ marginTop: '8rem' }}>
          <button onClick={() => navigate('/')} style={{ marginLeft: '1rem' }}>
            Go to home
          </button>
        </div>
      </div>

      <Footer />
    </>
  )
}

export default StudentDashboard
