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
import { AboutPanel } from '../components/AboutPanel'
import { GradebookPanel } from '../components/grading/GradebookPanel'
import { GradingPanel } from '../components/grading/GradingPanel'
import { GradingPlusPanel } from '../components/grading/GradingPlusPanel'

type InstructorWorkspace =
  | 'none'
  | 'assignment'
  | 'assignmentGradebook'
  | 'offlineGradebook'
  | 'grading'
  | 'gradingPlus'
  | 'about'

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
   * @brief Tracks which workspace panel is currently visible.
   */
  const [activeWorkspace, setActiveWorkspace] = useState<InstructorWorkspace>('none')

  /**
   * @brief Opens the assignment configuration panel.
   *
   * @return Nothing.
   */
  function openAssignmentConfig(): void {
    setActiveWorkspace('assignment')
  }

  /**
   * @brief Closes the assignment configuration panel.
   *
   * @return Nothing.
   */
  function closeAssignmentConfig(): void {
    setActiveWorkspace('none')
  }

  function openAssignmentGradebook(): void {
    setActiveWorkspace('assignmentGradebook')
  }

  function openOfflineGradebook(): void {
    setActiveWorkspace('offlineGradebook')
  }

  function openGrading(): void {
    setActiveWorkspace('grading')
  }

  function openGradingPlus(): void {
    setActiveWorkspace('gradingPlus')
  }

  function openAboutWorkspace(): void {
    setActiveWorkspace('about')
  }

  function getWorkspaceButtonClass(workspace: Exclude<InstructorWorkspace, 'none'>): string {
    return `primary-button dashboard-tab-button${activeWorkspace === workspace ? ' active' : ''}`
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
          Instructor Dashboard Workspaces
        -----------------------------------------------------------*/}
        <div key={activeWorkspace} className="dashboard-panel-transition">
          {/*-----------------------------------------------------------
          Instructor Action Toolbar
        -----------------------------------------------------------*/}
          <div className="dashboard-toolbar">
            {activeWorkspace !== 'none' && (
              <button className="secondary-button" onClick={closeAssignmentConfig}>
                Close Workspace
              </button>
            )}
            <button
              className={getWorkspaceButtonClass('assignment')}
              onClick={openAssignmentConfig}
            >
              Assignment Creation
            </button>
            <button
              className={getWorkspaceButtonClass('assignmentGradebook')}
              onClick={openAssignmentGradebook}
            >
              Assignment Gradebook
            </button>
            <button
              className={getWorkspaceButtonClass('offlineGradebook')}
              onClick={openOfflineGradebook}
            >
              Offline Gradebook
            </button>
            <button className={getWorkspaceButtonClass('grading')} onClick={openGrading}>
              Grading
            </button>
            <button className={getWorkspaceButtonClass('gradingPlus')} onClick={openGradingPlus}>
              Grading+
            </button>
            <button className={getWorkspaceButtonClass('about')} onClick={openAboutWorkspace}>
              About
            </button>
          </div>
          {activeWorkspace === 'assignment' ? (
            <AssignmentConfigPanel />
          ) : activeWorkspace === 'assignmentGradebook' ? (
            <GradebookPanel
              dataMode="server"
              title="Assignment Gradebook"
              description="View student submission scores saved to Supabase."
              allowClear={false}
            />
          ) : activeWorkspace === 'offlineGradebook' ? (
            <GradebookPanel
              dataMode="local"
              title="Offline Gradebook"
              description="View local batch grading results saved on this device."
            />
          ) : activeWorkspace === 'grading' ? (
            <GradingPanel />
          ) : activeWorkspace === 'gradingPlus' ? (
            <GradingPlusPanel dataSourceMode="server" gradebookMode="local" />
          ) : activeWorkspace === 'about' ? (
            <AboutPanel />
          ) : (
            <div className="dashboard-empty-state">
              <h2>Get started</h2>
              <p>
                Select an instructor tool above to open it inside this dashboard workspace. You can
                switch between assignment creation, assignment and offline gradebooks, single
                grading, and batch grading without leaving this page.
              </p>
            </div>
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
