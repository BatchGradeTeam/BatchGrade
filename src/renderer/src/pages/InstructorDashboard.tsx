/**
 * InstructorDashboard.tsx
 *
 * Description:
 * This component represents the instructor-facing dashboard within
 * the BatchGrade platform. The dashboard serves as the primary
 * interface for instructors once they have successfully logged in.
 *
 * In its current state, the component functions as a placeholder
 * view that demonstrates navigation flow and page structure.
 * Future development will include instructor-specific tools sush as:
 *  - Assignment management
 *  - Automated grading controls
 *  - Student submission review
 *  - Gradebook access
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../components/AuthContext'
import { NavBar } from '../components/Navbar'
import { Footer } from '../components/Footer'
import AssignmentConfigPanel from '../components/AssignmentConfigPanel'

/**
 * InstructorDashboard component
 *
 * Provides the instructor interface after authentication.
 * This page will eventually contain tools for managing
 * assignments, grading submissions, and viewing student results
 *
 * @returns InstructorDashboard(); React.JSX.Element
 */
export function InstructorDashboard(): React.JSX.Element {
  // -----------------------------------------------------------
  // Navigation Hook
  // -----------------------------------------------------------
  // Enables programmatic navigation between routes
  const navigate = useNavigate()
  const { logout } = useAuth()

  /**
   * @brief Tracks whether the assignment configuration workspace is visible.
   */
  const [showAssignmentConfig, setShowAssignmentConfig] = useState<boolean>(false)

  /**
   * @brief Opens the assignment configuration panel.
   *
   * @return Nothing.
   */
  function openAssignmentConfig(): void {
    setShowAssignmentConfig(true)
  }

  /**
   * @brief Closes the assignment configuration panel.
   *
   * @return Nothing.
   */
  function closeAssignmentConfig(): void {
    setShowAssignmentConfig(false)
  }

  return (
    <>
      {/*-----------------------------------------------------------
        Application Navigation Bar
      -----------------------------------------------------------*/}
      <NavBar />

      {/*-----------------------------------------------------------
        Dashboard Content Area
      -----------------------------------------------------------*/}

      {/* Page Header */}
      <div className="dashboard-header">
        <div className="dashboard-header-container instructor-icon"></div>
        <div className="dashboard-header-container">
          <h1 className="title">Instructor Dashboard</h1>
          <p>
            Manage instructor tools, configure assignments, and review grading workflows from this
            dashboard.
          </p>
        </div>
      </div>
      <div className="dashboard-container">
        {/*-----------------------------------------------------------
          Assignment Configuration Workspace
        -----------------------------------------------------------*/}
        {showAssignmentConfig ? (
          <AssignmentConfigPanel />
        ) : (
          <div className="dashboard-empty-state">
            <h2>Get started</h2>
            <p>
              Select <strong>Assignment Creation</strong> to begin creating an assignment. Choose a
              solution input type, and submit the instructor solution.
            </p>
          </div>
        )}
        {/*-----------------------------------------------------------
          Instructor Action Toolbar
        -----------------------------------------------------------*/}
        <div className="dashboard-toolbar">
          {!showAssignmentConfig ? (
            <button className="primary-button" onClick={openAssignmentConfig}>
              Assignment Creation
            </button>
          ) : (
            <button className="secondary-button" onClick={closeAssignmentConfig}>
              Close Assignment Configuration
            </button>
          )}
        </div>
      </div>

      {/*-----------------------------------------------------------
        Logout Button
      -----------------------------------------------------------*/}
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

      {/*-----------------------------------------------------------
        Application Footer
      -----------------------------------------------------------*/}
      <Footer />
    </>
  )
}
