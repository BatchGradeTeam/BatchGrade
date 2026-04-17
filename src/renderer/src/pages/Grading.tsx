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
import { Footer } from '../components/Footer'
import { NavBar } from '../components/Navbar'
import { GradingPanel } from '../components/instructor/GradingPanel'

/**
 * Grading Component
 *
 * Provides the interface for instructors to compile and run student submissions
 * for grading within the BatchGrade application.
 *
 * @returns Grading(): React.JSX.Element
 */
export function Grading(): React.JSX.Element {
  const navigate = useNavigate()

  return (
    <>
      <NavBar />

      <div style={{ padding: '6rem' }}>
        <GradingPanel showHomeButton={true} onGoHome={() => navigate('/')} />
      </div>

      <Footer />
    </>
  )
}
