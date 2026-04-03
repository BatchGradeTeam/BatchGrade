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
 * which currently functions as a logout trigger. If the
 * user is not logged in, a login button is shown instead.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { DropdownMenu } from './DropdownMenu'
import avatar from '../assets/profile.png'
import studentProfile from '../assets/student-profile.png'
import instructorProfile from '../assets/instructor-profile.png'
import { STUDENT_ROLE, INSTRUCTOR_ROLE } from '../../../main/database/schema'

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
  // Menu state for collapsible menu
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  // Determine which profile image to display based on user role
  const profileImage =
    user?.role === STUDENT_ROLE
      ? studentProfile
      : user?.role === INSTRUCTOR_ROLE
        ? instructorProfile
        : avatar

  return (
    <div className="navbar-container">
      <nav className="navbar">
        <div className="navbar-item">
          <button
            className="menu-button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            ☰
          </button>
          {/* Application Title */}
          <h1 className="navbar-title hover-underline">
            BatchGrade
          </h1>
        </div>
        {/*-----------------------------------------------------------
          Authentication Controls
        -----------------------------------------------------------*/}
        {isLoggedIn ? (
          /* Logged-in State:
              Display user avater which currently triggers logout
              when clicked. Future implementations may include
              a dropdown profile menu */
          <img
            src={profileImage}
            alt="Profile"
            className="profile-image"
            onClick={() => {
              // Log the user out of the application
              logout()
              // Redirect user to the Login page
              navigate('/login')
            }}
          />
        ) : (
          /* Logged-Out State:
              Display login button */
          <button className="primary-button" onClick={() => navigate('/login')}>
            Login
          </button>
        )}
      </nav>

      {/*-----------------------------------------------------------
        Collapsible Menu
      -----------------------------------------------------------*/}
      <DropdownMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </div>
  )
}