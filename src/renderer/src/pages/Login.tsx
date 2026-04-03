/**
 * Login.tsx
 *
 * Description:
 * This component implements the login interface for the BatchGrade
 * application. Users must first select their role (student or instructor)
 * after which they are prompted to enter their email and password.
 *
 * The component performs basic validation and retrieves user records
 * from the backend through the Electron IPC API. If a valid user is
 * found, the authentication state is updated via the AuthenContext and
 * the user is redirected to the appropriate dashboard.
 *
 * Primary Responsibilities:
 *  - Collect login credentials (email and password)
 *  - Validate the login attempt
 *  - Authenticate the user through AuthContext
 *  - Redirect the user to the correct dashboard
 */
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { User } from '../../../shared/types'
import { useAuth } from '../components/AuthContext'

/**
 * Login Component
 *
 * Provides the login interface and authentication logic
 * for users attempting to access the BatchGrade Platform
 *
 * @returns Login(): React.JSX.Element
 */
export function Login(): React.JSX.Element {
  // -----------------------------------------------------------
  // Navigation Hook
  // -----------------------------------------------------------
  // React Router navigation hook for redirecting users
  const navigate = useNavigate()

  // Access login function from global authentication context
  const { login } = useAuth()

  // -----------------------------------------------------------
  // Component State
  // -----------------------------------------------------------
  // Role selection removed; role is determined after login

  // Stores user credential input
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Stores login error messages
  const [error, setError] = useState<string | null>(null)

  // -----------------------------------------------------------
  // Login Handler
  // -----------------------------------------------------------
  /**
   * Handles the login attempt by validating credentials
   * and retrieving user records from the backend
   */
  async function handleLogin(): Promise<void> {
    // Reset any previous error state
    setError(null)

    // Retrieve all registered users from backend
    const users: User[] = await window.api.users.getAll()

    // Attempt to find a user with a matching email
    const foundUser = users.find((user) => user.email === email)

    // If no matching user exists, display error
    if (email.length === 0) {
      setError('Email required')
      return
    } else if (!foundUser) {
      setError('User does not exist')
      return
    }

    // Basic password validation
    // (actual password verification assumed to occur on backend)
    if (password.length === 0) {
      setError('Password required')
      return
    } else if (password !== foundUser.password) {
      setError('Incorrect password')
      return
    }

    // -----------------------------------------------------------
    // Successful Login
    // -----------------------------------------------------------

    // Update global authentication state with role from database
    const validRoles = ['student', 'instructor'] as const
    type Role = (typeof validRoles)[number]
    if (validRoles.includes(foundUser.role as Role)) {
      login({
        uuid: foundUser.uuid,
        email: foundUser.email,
        role: foundUser.role as Role
      })
    } else {
      setError('Invalid user role')
      return
    }

    // Redirect user based on role from database
    if (foundUser.role === 'student') {
      navigate('/studentdashboard')
    } else if (foundUser.role === 'instructor') {
      navigate('/instructordashboard')
    }
  }

  // -----------------------------------------------------------
  // Render Login Interface
  // -----------------------------------------------------------

  return (
    <div className="login-container">
      {/*-----------------------------------------------------------
        Login Header
      -----------------------------------------------------------*/}
      <div className="login-title">
        <header className="header">
          <h1 className="title">BatchGrade</h1>
          <p className="subtitle">Automated grading made easy</p>
        </header>
      </div>

      <div className="login-item">
        <div className="login-form">
          <p className="subtitle">Welcome back!</p>
          <h2>Please enter your credentials</h2>
          {/* Email input */}
          <input
            type="text"
            placeholder="Email"
            className="login-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          {/* Password input */}
          <input
            type="password"
            placeholder="Password"
            className="login-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {/*-----------------------------------------------------------
              Login Action Buttons
            -----------------------------------------------------------*/}
          <div className="login-actions">
            {/* Submit login request */}
            <button className="submit-button" onClick={handleLogin}>
              Login
            </button>

            {/* Cancel login and reset form */}
            <button
              className="secondary-button"
              onClick={() => {
                setEmail('')
                setPassword('')
                setError(null)
                navigate('/signup')
              }}
            >
              Sign Up
            </button>
          </div>
          {/* Display login error message if present */}
          {error && <div className="error">⚠ {error}</div>}
        </div>
      </div>
    </div>
  )
}