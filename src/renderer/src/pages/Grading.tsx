/**
 * Grading.tsx
 *
 * Description:
 * This component implements the grading interface for instructors within the BatchGrade application.
 * It provides tools for compiling and running student submissions as part of the grading workflow.
 *
 * The interface includes:
 *  - A navigation bar for consistent access to other system areas
 *  - A main content area with a CppWorkflowPanel for compilation and execution tasks
 *  - A footer displaying build and version information
 *
 * This page is protected and only accessible to users with the instructor role.
 */
import { useNavigate } from 'react-router-dom'
import Footer from '../components/Footer'
import NavBar from '../components/Navbar'
import { CppWorkflowPanel } from '../components/CppWorkflowPanel'
import { useState } from 'react'
import type { CompileCppResult } from '../../../shared/compiler'
import { CppJudgePanel } from '../components/CppJudgePanel'

/**
 * Grading Component
 *
 * Provides the interface for instructors to compile and run student submissions
 * for grading within the BatchGrade application.
 *
 * @returns Grading(): React.JSX.Element
 */
function Grading(): React.JSX.Element {
  const navigate = useNavigate()
  const [compileResult, setCompileResult] = useState<CompileCppResult | null>(null)

  return (
    <>
      <NavBar />

      <div style={{ padding: '6rem' }}>
        <h1>Grading Page</h1>
        <p>
          Instructor workflow for compiling and running submissions. Execution remains a separate
          step so it can move behind a sandbox boundary later.
        </p>

        <CppWorkflowPanel
          title="Instructor Compilation Workspace"
          description="Compile selected C++ files and optionally run the compiled program for grading checks."
          allowExecution={true}
          onCompileResultChange={setCompileResult}
        />

        <CppJudgePanel compileResult={compileResult} />

        <button
          onClick={() => navigate('/')}
          style={{
            padding: '9px 14px',
            backgroundColor: '#2563eb',
            color: 'white',
            border: '2px solid #93c5fd',
            borderRadius: '6px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          Go to home
        </button>
      </div>

      <Footer />
    </>
  )
}

export default Grading
