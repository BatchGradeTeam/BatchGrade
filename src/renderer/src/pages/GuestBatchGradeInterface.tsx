// import { useNavigate } from 'react-router-dom'
import { NavBar } from '../components/Navbar'
import { Footer } from '../components/Footer'
import { useNavigate } from 'react-router-dom'
import { GradingPlusPanel } from '../components/grading/GradingPlusPanel'

export function GuestBatchGradeInterface(): React.JSX.Element {
  const navigate = useNavigate()
  return (
    <>
      <NavBar />

      <div className="dashboard-header">
        <p>Batch grading runs locally for guest users.</p>
      </div>

      <div className="dashboard-container">
        <GradingPlusPanel dataSourceMode="local" gradebookMode="local" />
      </div>

      <div className="button-container">
        <button className="secondary-button" onClick={() => navigate('/guestDashboard')}>
          Back to Dashboard
        </button>
      </div>

      <Footer />
    </>
  )
}
