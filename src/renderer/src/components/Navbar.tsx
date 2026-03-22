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
 * user is not logged in, login and signup buttons are shown instead.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import DropdownMenu from './DropdownMenu'
import avatar from '../assets/profile.png'

/**
 * Navbar Component
 *
 * Displays the application's navigation header and manages
 * authentication-related UI elements
 *
 * @returns NavBar(): React.JSX.Element
 */
function NavBar(): React.JSX.Element {
  // -----------------------------------------------------------
  // Navigation Hook
  // -----------------------------------------------------------
  // Enables navigation between application routes
  const navigate = useNavigate()
  // Access authentication state and logout function
  const { isLoggedIn, logout } = useAuth()
  // Menu state for collapsible menu
  const [isMenuOpen, setIsMenuOpen] = useState(false)

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
          <span className="navbar-title">BatchGrade</span>
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
            src={avatar}
            alt="Profile"
            className="profile-image"
            onClick={() => {
              void logout()
                .then(() => {
                  navigate('/')
                })
                .catch((error) => {
                  console.error('Error signing out: ', error)
                })
            }}
          />
        ) : (
          /* Logged-Out State:
              Display login and signup buttons */
          <div className="navbar-auth-actions">
            <button className="secondary-button" onClick={() => navigate('/signup')}>
              Sign Up
            </button>
            <button className="primary-button" onClick={() => navigate('/login')}>
              Login
            </button>
          </div>
        )}
      </nav>

      {/*-----------------------------------------------------------
        Collapsible Menu
      -----------------------------------------------------------*/}
      <DropdownMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </div>
  )
}

export default NavBar
