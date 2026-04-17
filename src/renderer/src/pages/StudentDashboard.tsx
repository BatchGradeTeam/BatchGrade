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
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NavBar } from '../components/Navbar'
import { Footer } from '../components/Footer'
import { useAuth } from '../components/AuthContext'
import { CppWorkflowPanel } from '../components/compiler/CppWorkflowPanel'
import { OutputDiffPanel } from '../components/OutputDiffPanel'
import { SubmitPanel } from '../components/submission/SubmitPanel'
import { AboutPanel } from '../components/AboutPanel'
import type { CompileCppResult, RunCppResult } from 'src/shared/compiler'
import type { Assignment } from '../../../shared/types'

type StudentWorkspace = 'none' | 'compile' | 'about'

/**
 * StudentDashboard Component
 *
 * Provides the primary interface for students after loggin in.
 * This page will eventually allow students to access assignments,
 * submit solutions, and review grading results.
 *
 * @returns StudentDashboard(): React.JSX.Element
 */
export function StudentDashboard(): React.JSX.Element {
  const navigate = useNavigate()
  const { logout, user } = useAuth()

  const [activeWorkspace, setActiveWorkspace] = useState<StudentWorkspace>('none')
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [compileResult, setCompileResult] = useState<CompileCppResult | null>(null)
  const [runResult, setRunResult] = useState<RunCppResult | null>(null)
  const [expectedOutput, setExpectedOutput] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('')

  function openCompileWorkspace(): void {
    setActiveWorkspace('compile')
  }

  function closeCompileWorkspace(): void {
    setActiveWorkspace('none')
  }

  function openAboutWorkspace(): void {
    setActiveWorkspace('about')
  }

  function getWorkspaceButtonClass(workspace: Exclude<StudentWorkspace, 'none'>): string {
    return `primary-button dashboard-tab-button${activeWorkspace === workspace ? ' active' : ''}`
  }

  function handleAssignmentChange(uuid: string): void {
    setSelectedAssignmentId(uuid)
    const assignment = assignments.find((a) => a.uuid === uuid)
    setExpectedOutput(assignment?.expectedOutputText ?? null)
  }

  return (
    <>
      <NavBar />

      <div className="dashboard-header">
        <div className="dashboard-header-container student-icon"></div>
        <div className="dashboard-header-container">
          <h1 className="title">Student Portal</h1>
          <p>
            Compile your C++ source files locally, then submit the source bundle for later grading.
            The submission artifact stores source files and compile logs instead of a host-specific
            executable.
          </p>
        </div>
      </div>

      <div className="dashboard-container">
        <div key={activeWorkspace} className="dashboard-panel-transition">
          <div className="dashboard-toolbar">
            {activeWorkspace !== 'none' && (
              <button className="secondary-button" onClick={closeCompileWorkspace}>
                Close Workspace
              </button>
            )}
            <button className={getWorkspaceButtonClass('compile')} onClick={openCompileWorkspace}>
              Compile
            </button>
            <button className={getWorkspaceButtonClass('about')} onClick={openAboutWorkspace}>
              About
            </button>
          </div>

          {activeWorkspace === 'compile' ? (
            <>
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
            </>
          ) : activeWorkspace === 'about' ? (
            <AboutPanel />
          ) : (
            <div className="dashboard-empty-state">
              <h2>Get started</h2>
              <p>
                Select <strong>Compile</strong> to open the student workflow. You can compile,
                execute, compare output against an assignment expectation, and submit in one panel.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="button-container">
        <button
          className="secondary-button"
          onClick={() => {
            logout()
            navigate('/')
          }}
        >
          Logout
        </button>
      </div>

      <Footer />
    </>
  )
}
