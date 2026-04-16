/**
 * StudentUploadInterface.tsx
 *
 * Description:
 * This component implements the student upload interface for the BatchGrade application.
 * It provides a simple UI for students to submit their project code files for grading.
 *
 * The interface includes:
 *  - A title indicating the purpose of the page
 *  - A button to trigger the file submission process (currently simulated with an alert)
 *  - A navigation button to return to the home page
 *
 * This component is intended to be expanded in the future to include actual file upload functionality,
 * validation, and integration with the backend grading system.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../components/AuthContext'
import { NavBar } from '../components/Navbar'
import { Footer } from '../components/Footer'
import { CppWorkflowPanel } from '../components/compiler/CppWorkflowPanel'
import type { CompileCppResult, RunCppResult } from 'src/shared/compiler'
import { SubmitPanel } from '../components/submission/SubmitPanel'
import { OutputDiffPanel } from '../components/OutputDiffPanel'
import type { Assignment } from '../../../shared/types'

/**
 * StudentUploadInterface Component
 *
 * Provides the interface for students to upload their project code files
 * for grading within the BatchGrade application.
 *
 * @returns StudentUploadInterface(): React.JSX.Element
 */
export function StudentUploadInterface(): React.JSX.Element {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [compileResult, setCompileResult] = useState<CompileCppResult | null>(null)

  const [runResult, setRunResult] = useState<RunCppResult | null>(null)
  const [expectedOutput, setExpectedOutput] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('')

  /**
   * @brief Handles assignment selection changes from either the OutputDiffPanel
   * dropdown or SubmitPanel, keeping both in sync.
   *
   * @param uuid The selected assignment UUID.
   */
  function handleAssignmentChange(uuid: string): void {
    setSelectedAssignmentId(uuid)
    const assignment = assignments.find((a) => a.uuid === uuid)
    setExpectedOutput(assignment?.expectedOutputText ?? null)
  }

  return (
    <>
      <NavBar />
      <div className="dashboard-header">
        <div className="dashboard-header-container interface-icon"></div>
        <div className="dashboard-header-container">
          <h1 className="title">Student Upload Interface</h1>
          <p className="subtitle">Submit your project code for grading</p>
        </div>
      </div>
      <div className="dashboard-container">
        <CppWorkflowPanel
          title="Student Compilation Workspace"
          description="Choose the files you want to submit, compile them, optionally run them with input, and review the output before submitting."
          autoCompileOnSelection={true}
          allowExecution={true}
          onSelectionChange={setSelectedFiles}
          onCompileResultChange={setCompileResult}
          onRunResultChange={setRunResult}
        />

        <OutputDiffPanel
          actualOutput={runResult?.stdout ?? null}
          expectedOutput={expectedOutput}
          assignments={assignments}
          selectedAssignmentId={selectedAssignmentId}
          onAssignmentChange={handleAssignmentChange}
        />

        <SubmitPanel
          compileResult={compileResult}
          selectedFiles={selectedFiles}
          userId={user?.uuid}
          selectedAssignmentId={selectedAssignmentId}
          onAssignmentsLoaded={(loaded) => {
            setAssignments(loaded)
            if (loaded.length > 0 && !selectedAssignmentId) {
              setSelectedAssignmentId(loaded[0].uuid)
              setExpectedOutput(loaded[0].expectedOutputText ?? null)
            }
          }}
          onExpectedOutputChange={setExpectedOutput}
        />
      </div>

      <div className="button-container">
        <button className="secondary-button" onClick={() => navigate('/studentdashboard')}>
          Go Home
        </button>
      </div>

      <Footer />
    </>
  )
}
