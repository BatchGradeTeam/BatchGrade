// Signup Page

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { INSTRUCTOR_ROLE, STUDENT_ROLE } from '../../../shared/types'
import { useAuth } from '../components/AuthContext'

function SignUp(): React.JSX.Element {
  const navigate = useNavigate()
  const { signup } = useAuth()

  const [role, setRole] = useState<typeof STUDENT_ROLE | typeof INSTRUCTOR_ROLE>(STUDENT_ROLE)

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

    const trimmedEmail = email.trim()
    setIsSubmitting(true)

    try {
      const result = await signup(trimmedEmail, password, role)

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
    <div className="login-container">
      <div className="login-title">
        <header className="header">
          <h1 className="title">
            <span className="react">Create Account</span>
          </h1>
        </header>
      </div>

      <div className="login-item">
        <div className="login-modal">
          <div className="login-form">
            <h2>Sign Up</h2>

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

                  <button className="secondary-button" onClick={() => navigate('/')}>
                    Go Home
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

                {error && <div className="login-error">{error}</div>}
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
                  <button className="submit-button" onClick={handleSignUp} disabled={isSubmitting}>
                    {isSubmitting ? 'Creating Account...' : 'Create Account'}
                  </button>

                  <button
                    className="secondary-button"
                    onClick={() => navigate('/')}
                    disabled={isSubmitting}
                  >
                    Go Home
                  </button>

                  <button
                    className="cancel-button"
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
    </div>
  )
}

export default SignUp
