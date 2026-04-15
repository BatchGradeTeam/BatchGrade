
import { useNavigate } from 'react-router-dom'
import { NavBar } from '../components/Navbar'
import { Footer } from '../components/Footer'


export function GuestDashboard(): React.JSX.Element {
  const navigate = useNavigate()
  return (
    <>
      <NavBar />

      <div className="dashboard-header">
        <div className="dashboard-header-container student-icon"></div>
        <div className="dashboard-header-container">
          <h1 className="title">Guest Portal</h1>
          <p>
            Compile your C++ source files locally. Choose from either Single or Batch grade component.
          </p>
        </div>
      </div>

      <div className="student-dashboard-container">
        <div className="student-dashboard-item">
          <button className="primary-button" onClick={() => navigate('/guestStudentInterface')}>
            Single Assignment
          </button>
        </div>
        <div className="student-dashboard-item">
            <button className="primary-button" onClick={() => navigate('/guestBatchGradeInterface')}>
                Multi-Assignment BatchGrade
            </button>
        </div>
        <div className="student-dashboard-item">
          <button className="primary-button" onClick={() => navigate('/about')}>
            About
          </button>
        </div>
      </div>

      <Footer />
    </>
  )
}
