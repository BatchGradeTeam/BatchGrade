/**
 * Navbar.tsx
 *
 * Description:
 * This component implements the primary navigation bar used
 * throughout the BatchGrade application. It provides quick
 * access to login functionality and display the current
 * authentication state of the user.
 *
 * If the user is logged in, a profile avatar is displayed
 * which opens a small profile popover with a logout action. If the
 * user is not logged in, a login button is shown instead.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { INSTRUCTOR_ROLE, STUDENT_ROLE } from '../../../main/database/schema'
import avatar from '../assets/profile.png'
import instructorProfile from '../assets/instructor-profile.png'
import studentProfile from '../assets/student-profile.png'
import { useAuth } from './AuthContext'

/**
 * Navbar Component
 *
 * Displays the application's navigation header and manages
 * authentication-related UI elements
 *
 * @returns NavBar(): React.JSX.Element
 */
export function NavBar(): React.JSX.Element {
  // -----------------------------------------------------------
  // Navigation Hook
  // -----------------------------------------------------------
  // Enables navigation between application routes
  const navigate = useNavigate()
  // Access authentication state and logout function
  const { isLoggedIn, user, logout } = useAuth()
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement | null>(null)

  // Determine which profile image to display based on user role
  const profileImage =
    user?.role === STUDENT_ROLE
      ? studentProfile
      : user?.role === INSTRUCTOR_ROLE
        ? instructorProfile
        : avatar

  async function handleLogout(): Promise<void> {
    try {
      await logout()
      setIsProfileModalOpen(false)
      navigate('/login')
    } catch (error) {
      console.error('Error signing out: ', error)
    }
  }

  useEffect(() => {
    function handlePointerDown(event: MouseEvent): void {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setIsProfileModalOpen(false)
      }
    }

    if (!isProfileModalOpen) {
      return
    }

    window.addEventListener('mousedown', handlePointerDown)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
    }
  }, [isProfileModalOpen])

  return (
    <div className="navbar-container">
      <nav className="navbar">
        <div className="navbar-item">
          {/* Application Title */}
          <h1 className="navbar-title hover-underline">BatchGrade</h1>
        </div>
        {/*-----------------------------------------------------------
          Authentication Controls
        -----------------------------------------------------------*/}
        {isLoggedIn ? (
          /* Logged-in State:
              Display user avatar which opens a profile popover
              with account actions when clicked. */
          <div className="navbar-profile-menu" ref={profileMenuRef}>
            <img
              src={profileImage}
              alt="Profile"
              className="profile-image"
              onClick={() => setIsProfileModalOpen((current) => !current)}
            />

            {isProfileModalOpen && (
              <div className="navbar-profile-popover">
                <div className="navbar-profile-modal-header">
                  <img src={profileImage} alt="Profile" className="navbar-profile-modal-image" />

                  <div className="navbar-profile-modal-copy">
                    <h3 className="navbar-profile-modal-title">Profile</h3>
                    <p className="navbar-profile-modal-subtitle">Manage your current session.</p>
                  </div>
                </div>

                <div className="navbar-profile-modal-meta">
                  <p>
                    <span className="navbar-profile-modal-label">Email</span>
                    <span className="navbar-profile-modal-value">{user?.email ?? 'Unknown'}</span>
                  </p>
                  <p>
                    <span className="navbar-profile-modal-label">Role</span>
                    <span className="navbar-profile-modal-value">{user?.role ?? 'Unknown'}</span>
                  </p>
                </div>

                <div className="navbar-profile-modal-actions">
                  <button className="primary-button" onClick={() => void handleLogout()}>
                    Logout
                  </button>
                  <button className="secondary-button" onClick={() => setIsProfileModalOpen(false)}>
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Logged-Out State:
              Display login button */
          <button className="primary-button" onClick={() => navigate('/login')}>
            Login
          </button>
        )}
      </nav>
    </div>
  )
}
