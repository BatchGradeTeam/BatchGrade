// import { useNavigate } from 'react-router-dom'
import { NavBar } from '../components/Navbar'
import { Footer } from '../components/Footer'
import { useNavigate } from 'react-router-dom'

export function GuestBatchGradeInterface(): React.JSX.Element {
  const navigate = useNavigate()
  return (
    <>
      <NavBar />

      <div className="dashboard-header">
        <p> Ultimately will be the Batch Grade portion </p>
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
