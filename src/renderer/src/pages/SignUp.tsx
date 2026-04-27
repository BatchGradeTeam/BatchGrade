/**
 * SignUp.tsx
 *
 * Description:
 * This component serves as the registration page for BatchGrade.
 * It keeps the main branch's navigation and hero layout while
 * rendering a server-backed account creation form for students
 * and instructors.
 *
 * The page layout consists of:
 *  - A navigation bar
 *  - A hero section containing registration context and system actions
 *  - A registration form powered by AuthContext
 *  - A footer
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { INSTRUCTOR_ROLE, STUDENT_ROLE } from '../../../shared/types'
import { IpcPing } from '../components/IpcPing'
import { NavBar } from '../components/Navbar'
import { useAuth } from '../components/AuthContext'

/**
 * SignUp Component
 *
 * The SignUp component renders the registration page interface
 * and creates accounts through the shared authentication context.
 *
 * @returns SignUp(): React.JSX.Element
 */
export function SignUp(): React.JSX.Element {
  const navigate = useNavigate()
  const { signup } = useAuth()

  const [role, setRole] = useState<typeof STUDENT_ROLE | typeof INSTRUCTOR_ROLE>(STUDENT_ROLE)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSignupSuccessful, setIsSignupSuccessful] = useState(false)

  async function handleSignUp(): Promise<void> {
    if (isSubmitting) {
      return
    }

    setError(null)
    setIsSignupSuccessful(false)

    if (!firstName.trim()) {
      setError('First name is required.')
      return
    }

    if (!lastName.trim()) {
      setError('Last name is required.')
      return
    }

    if (!email.trim()) {
      setError('Email is required.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsSubmitting(true)

    try {
      const result = await signup(firstName.trim(), lastName.trim(), email.trim(), password, role)

      if (!result.user) {
        setError('Could not confirm account creation. Please try again.')
        return
      }

      setIsSignupSuccessful(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not create account.'
      setError(message)
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {/*-----------------------------------------------------------
        Navigation Bar
        -----------------------------------------------------------*/}
      <NavBar />

      {/*-----------------------------------------------------------
        Hero Section
          Main landing content and registration controls
        -----------------------------------------------------------*/}
      <div className="signup-container">
        <div className="signup-item">
          {/* Application Title */}
          <header className="header">
            <h1 className="title">Sign Up</h1>
            <p className="subtitle">Register & Connect with BatchGrade</p>
          </header>

          {/*-----------------------------------------------------------
            System Actions
              Used for development/testing utilities
            -----------------------------------------------------------*/}
          <div className="actions">
            <div className="action">
              <IpcPing />
            </div>
          </div>
        </div>

        <div className="signup-item">
          {/*-----------------------------------------------------------
            Registration Form
              Creates a server-backed account through AuthContext
            -----------------------------------------------------------*/}
          <div className="login-form">
            <h2>Create Account</h2>

            {isSignupSuccessful ? (
              <>
                <div
                  style={{
                    color: '#86efac',
                    marginTop: '0.75rem',
                    textAlign: 'center'
                  }}
                >
                  Sign Up successful.
                </div>

                <div className="login-actions">
                  <button className="submit-button" onClick={() => navigate('/login')}>
                    Go to Login
                  </button>
                </div>
              </>
            ) : (
              <>
                <select
                  className="login-input"
                  value={role}
                  disabled={isSubmitting}
                  onChange={(e) =>
                    setRole(e.target.value as typeof STUDENT_ROLE | typeof INSTRUCTOR_ROLE)
                  }
                >
                  <option value={STUDENT_ROLE}>Student</option>
                  <option value={INSTRUCTOR_ROLE}>Instructor</option>
                </select>

                <input
                  type="text"
                  placeholder="First Name"
                  className="login-input"
                  value={firstName}
                  disabled={isSubmitting}
                  onChange={(e) => setFirstName(e.target.value)}
                />

                <input
                  type="text"
                  placeholder="Last Name"
                  className="login-input"
                  value={lastName}
                  disabled={isSubmitting}
                  onChange={(e) => setLastName(e.target.value)}
                />

                <input
                  type="text"
                  placeholder="Email"
                  className="login-input"
                  value={email}
                  disabled={isSubmitting}
                  onChange={(e) => setEmail(e.target.value)}
                />

                <input
                  type="password"
                  placeholder="Password"
                  className="login-input"
                  value={password}
                  disabled={isSubmitting}
                  onChange={(e) => setPassword(e.target.value)}
                />

                <input
                  type="password"
                  placeholder="Confirm Password"
                  className="login-input"
                  value={confirmPassword}
                  disabled={isSubmitting}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />

                {error && <div className="error">{error}</div>}
                {isSubmitting && (
                  <div
                    style={{
                      color: '#93c5fd',
                      marginTop: '0.75rem'
                    }}
                  >
                    Creating account...
                  </div>
                )}

                <div className="login-actions">
                  <button
                    className="submit-button"
                    onClick={() => void handleSignUp()}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Creating Account...' : 'Create Account'}
                  </button>

                  <button
                    className="secondary-button"
                    onClick={() => navigate('/login')}
                    disabled={isSubmitting}
                  >
                    Back to Login
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
