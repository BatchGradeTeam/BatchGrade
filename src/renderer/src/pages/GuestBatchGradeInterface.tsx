import { useNavigate } from 'react-router-dom'
import { NavBar } from '../components/Navbar'
import { Footer } from '../components/Footer'
import { GradingPlusPanel } from '../components/grading/GradingPlusPanel'

export function GuestBatchGradeInterface(): React.JSX.Element {
  const navigate = useNavigate()

  return (
    <>
      <NavBar />

      <div className="dashboard-header">
        <div className="dashboard-header-container student-icon"></div>
        <div className="dashboard-header-container">
          <h1 className="title">Guest BatchGrade</h1>
          <p>
            Compile and batch grade multiple C++ submissions locally using the Grading+ workflow.
          </p>
        </div>
      </div>

      <div style={{ width: '90%', margin: '0 auto 2rem auto' }}>
        <GradingPlusPanel
          title="Guest BatchGrade"
          description="Batch grade multiple submissions locally."
          showHomeButton
          onGoHome={() => navigate('/guestDashboard')}
        />
      </div>

      <Footer />
    </>
  )
}
