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
import { useNavigate } from 'react-router-dom'
import { NavBar } from '../components/Navbar'
import { Footer } from '../components/Footer'
import { useAuth } from '../components/AuthContext'

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
  const { logout } = useAuth()

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

      <div className="student-dashboard-container">
        <div className="student-dashboard-item">
          <button 
            className="primary-button"
            onClick={() => navigate('/studentuploadinterface')}
          >
            Compile
          </button>
        </div>
        <div className="student-dashboard-item">
          <button
            className="primary-button"
          >
            Assignments
          </button>
        </div>
        <div className="student-dashboard-item">
          <button
            className="primary-button"
            onClick={() => navigate('/about')}
          >
            About
          </button>
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

      <Footer />
    </>
  )
}