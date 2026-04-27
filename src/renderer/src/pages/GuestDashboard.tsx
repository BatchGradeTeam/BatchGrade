import { useState } from 'react'
import { NavBar } from '../components/Navbar'
import { AboutPanel } from '../components/AboutPanel'
import { GradingPanel } from '../components/grading/GradingPanel'
import { GradingPlusPanel } from '../components/grading/GradingPlusPanel'

type GuestWorkspace = 'none' | 'grading' | 'gradingPlus' | 'about'

export function GuestDashboard(): React.JSX.Element {

  const [activeWorkspace, setActiveWorkspace] = useState<GuestWorkspace>('none')

  function closeWorkspace(): void {
    setActiveWorkspace('none')
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

  function getWorkspaceButtonClass(workspace: Exclude<GuestWorkspace, 'none'>): string {
    return `primary-button dashboard-tab-button${activeWorkspace === workspace ? ' active' : ''}`
  }

  return (
    <>
      <NavBar />

      <div className="dashboard-header">
        <div className="dashboard-header-container guest-icon"></div>
        <div className="dashboard-header-container">
          <h1 className="title">Guest Dashboard</h1>
          <p>Access grading tools and learn more about the platform from this dashboard.</p>
        </div>
      </div>

      <div className="dashboard-container">
        <div key={activeWorkspace} className="dashboard-panel-transition">
          <div className="dashboard-toolbar">
            {activeWorkspace !== 'none' && (
              <button className="secondary-button" onClick={closeWorkspace}>
                Close Workspace
              </button>
            )}

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

          {activeWorkspace === 'grading' ? (
            <GradingPanel />
          ) : activeWorkspace === 'gradingPlus' ? (
            <GradingPlusPanel
              title="Grading+"
              description="Batch grade multiple local submissions"
              dataSourceMode="local"
              gradebookMode="guest"
            />
          ) : activeWorkspace === 'about' ? (
            <AboutPanel />
          ) : (
            <div className="dashboard-empty-state">
              <h2>Get started</h2>
              <p>
                Select a workspace above to begin. Use Grading for single submissions, Grading+ for
                expanded grading workflows, or About to learn more about BatchGrade.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
