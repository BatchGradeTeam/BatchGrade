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
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NavBar } from '../components/Navbar'
import { useAuth } from '../components/AuthContext'
import { CppWorkflowPanel } from '../components/compiler/CppWorkflowPanel'
import { OutputDiffPanel, type OutputComparisonCase } from '../components/OutputDiffPanel'
import { SubmitPanel } from '../components/submission/SubmitPanel'
import { AboutPanel } from '../components/AboutPanel'
import { StudentScoresPanel } from '../components/grading/StudentScoresPanel'
import { summarizeComparisonCases } from '../lib/submissionSelfCheck'
import type { CompileCppResult, RunCppResult } from 'src/shared/compiler'
import type { Assignment, AssignmentTestCase } from '../../../shared/types'
import { loadAssignmentTestCases } from '../lib/serverData'

type StudentWorkspace = 'none' | 'compile' | 'scores' | 'about'

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
  const [assignmentTestCases, setAssignmentTestCases] = useState<AssignmentTestCase[]>([])
  const [comparisonCases, setComparisonCases] = useState<OutputComparisonCase[]>([])
  const [isRunningTestCases, setIsRunningTestCases] = useState(false)
  const [testCaseError, setTestCaseError] = useState<string | null>(null)
  const selfCheckSummary = useMemo(
    () => summarizeComparisonCases(comparisonCases),
    [comparisonCases]
  )
  const requiresCompletedSelfCheck = assignmentTestCases.length > 0

  function openCompileWorkspace(): void {
    setActiveWorkspace('compile')
  }

  function openScoresWorkspace(): void {
    setActiveWorkspace('scores')
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
    setComparisonCases([])
    setTestCaseError(null)
  }

  const handleAssignmentsLoaded = useCallback(
    (loaded: Assignment[]): void => {
      setAssignments(loaded)
      if (loaded.length > 0 && !selectedAssignmentId) {
        setSelectedAssignmentId(loaded[0].uuid)
        setExpectedOutput(loaded[0].expectedOutputText ?? null)
      }
    },
    [selectedAssignmentId]
  )

  useEffect(() => {
    let isMounted = true

    async function loadTestCases(): Promise<void> {
      if (!selectedAssignmentId) {
        setAssignmentTestCases([])
        setComparisonCases([])
        return
      }

      try {
        const serverTestCases = await loadAssignmentTestCases(selectedAssignmentId)
        const testCases =
          serverTestCases.length > 0
            ? serverTestCases
            : await window.api.assignments.getTestCases(selectedAssignmentId)

        if (isMounted) {
          setAssignmentTestCases(testCases)
          setComparisonCases([])
          setTestCaseError(null)
        }
      } catch (error) {
        console.error('Could not load assignment test cases:', error)

        try {
          const localTestCases = await window.api.assignments.getTestCases(selectedAssignmentId)

          if (isMounted) {
            setAssignmentTestCases(localTestCases)
            setComparisonCases([])
            setTestCaseError(null)
          }
        } catch (fallbackError) {
          console.error('Could not load local assignment test cases:', fallbackError)

          if (isMounted) {
            setAssignmentTestCases([])
            setComparisonCases([])
            setTestCaseError('Could not load assignment test cases.')
          }
        }
      }
    }

    void loadTestCases()

    return () => {
      isMounted = false
    }
  }, [selectedAssignmentId])

  useEffect(() => {
    let isMounted = true

    async function runAssignmentTestCases(): Promise<void> {
      if (
        !compileResult?.compileSuccess ||
        !compileResult.executablePath ||
        assignmentTestCases.length === 0
      ) {
        return
      }

      setIsRunningTestCases(true)
      setTestCaseError(null)
      setComparisonCases(
        assignmentTestCases.map((testCase) => ({
          id: testCase.uuid,
          label: `Test ${testCase.caseOrder}`,
          inputLabel: testCase.inputFileName ?? (testCase.inputText ? 'Text input' : null),
          actualOutput: null,
          expectedOutput: testCase.expectedOutputText
        }))
      )

      try {
        const results = await Promise.all(
          assignmentTestCases.map(async (testCase) => {
            const run = await window.api.compiler.runCompiledProgram({
              executablePath: compileResult.executablePath as string,
              stdin: testCase.inputText ?? '',
              timeoutMs: 5000
            })

            return {
              id: testCase.uuid,
              label: `Test ${testCase.caseOrder}`,
              inputLabel: testCase.inputFileName ?? (testCase.inputText ? 'Text input' : null),
              actualOutput: run.stdout,
              expectedOutput: testCase.expectedOutputText,
              executionMessage: run.message,
              executionSuccess: run.executionSuccess,
              timedOut: run.timedOut
            } satisfies OutputComparisonCase
          })
        )

        if (isMounted) {
          setComparisonCases(results)
        }
      } catch (error) {
        console.error('Could not run assignment test cases:', error)

        if (isMounted) {
          setTestCaseError('Could not run assignment test cases.')
        }
      } finally {
        if (isMounted) {
          setIsRunningTestCases(false)
        }
      }
    }

    void runAssignmentTestCases()

    return () => {
      isMounted = false
    }
  }, [assignmentTestCases, compileResult])

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
            <button className={getWorkspaceButtonClass('scores')} onClick={openScoresWorkspace}>
              Scores
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
                comparisonCases={comparisonCases}
                isRunningTestCases={isRunningTestCases}
                testCaseError={testCaseError}
              />

              <SubmitPanel
                compileResult={compileResult}
                selectedFiles={selectedFiles}
                userId={user?.uuid}
                selectedAssignmentId={selectedAssignmentId}
                selfCheckSummary={selfCheckSummary}
                isRunningSelfCheck={isRunningTestCases}
                requiresCompletedSelfCheck={requiresCompletedSelfCheck}
                onAssignmentsLoaded={handleAssignmentsLoaded}
                onExpectedOutputChange={setExpectedOutput}
              />
            </>
          ) : activeWorkspace === 'scores' ? (
            <StudentScoresPanel />
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
    </>
  )
}
