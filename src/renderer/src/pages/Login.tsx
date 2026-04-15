/**
 * Login.tsx
 *
 * Description:
 * This component implements the login interface for the BatchGrade
 * application. Users enter their email and password, and the
 * credentials are sent through the shared authentication context
 * to the server-backed authentication provider.
 *
 * The component performs basic validation, attempts sign-in through
 * AuthContext, and redirects the user to the appropriate dashboard
 * based on the role returned by the authenticated session.
 *
 * Primary Responsibilities:
 *  - Collect login credentials (email and password)
 *  - Validate the login attempt
 *  - Authenticate the user through the server auth provider
 *  - Redirect the user to the correct dashboard
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const { login } = useAuth()

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
   * and authenticating the user through AuthContext
   */
  async function handleLogin(): Promise<void> {
    // Reset any previous error state
    setError(null)

    const trimmedEmail = email.trim()

    if (trimmedEmail.length === 0) {
      setError('Email required')
      return
    }

    if (password.length === 0) {
      setError('Password required')
      return
    }

    try {
      const loggedInUser = await login(trimmedEmail, password)

      if (loggedInUser.role === 'student') {
        navigate('/studentdashboard')
        return
      }

      if (loggedInUser.role === 'instructor') {
        navigate('/instructordashboard')
        return
      }

      setError('Invalid user role')
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Login failed. Please check your email and password again.'
      setError(message)
      console.error(err)
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
            <button className="submit-button" onClick={() => void handleLogin()}>
              Login
            </button>

            <button
              className="secondary-button"
              onClick={() => {
                navigate('/guestDashboard')
              }}
            >
              Guest
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
          {error && <div className="error">{error}</div>}
        </div>
      </div>
    </div>
  )
}
