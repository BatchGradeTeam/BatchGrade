import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
// import type { User } from '../../../shared/types'
import { INSTRUCTOR_ROLE, STUDENT_ROLE } from '../../../shared/types'
import { useAuth } from '../components/AuthContext'

function Login(): React.JSX.Element {
  const navigate = useNavigate()
  const { login, logout } = useAuth()

  const [role, setRole] = useState<typeof STUDENT_ROLE | typeof INSTRUCTOR_ROLE | null>(null) // Track role the user selects -> initialized as null

  // Controlled input state for login form
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [error, setError] = useState<string | null>(null) // Store any error message

  async function handleLogin(): Promise<void> {
    setError(null) // Clear any previous errors before attempting login

    // const users: User[] = await window.api.users.getAll()
    // const foundUser = users.find((user) => user.email === email)
    // if (!foundUser) {
    //   // Check if user exists
    //   setError('User does not exist.') // FIXME: idk if we would want to keep this (security purposes)
    //   return
    // }

    // All users must have a password
    if (password.length === 0) {
      setError('Password required')
      return
    }

    // if (role !== foundUser.role) {
    //   setError('Selected role does not match user role') // FIXME: again security issue...
    //   return
    // }

    // Actually try logging in (through AuthContext)
    try {
      const loggedInUser = await login(email, password)
      if (role !== loggedInUser.role) {
        await logout()
        setError(
          `This account is registered as a ${loggedInUser.role}. Please use the ${loggedInUser.role} login option.` // FIXME: Probably need to change for security purposes
        )
        return
      }

      if (loggedInUser.role === STUDENT_ROLE) {
        navigate('/studentdashboard')
      } else if (loggedInUser.role === INSTRUCTOR_ROLE) {
        navigate('/instructordashboard')
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Login failed. Please check your email and password again.'
      setError(message)
      console.error(err)
    }
  }

  return (
    <div className="login-container">
      <div className="login-title">
        <header className="header">
          <h1 className="title">
            <span className="react">Login</span>
          </h1>
          <p className="creator">Please select approriate role:</p>
        </header>
      </div>

      <div className="login-item">
        {!role && (
          <main className="main">
            <div className="home-buttons">
              <button className="role-buttons student" onClick={() => setRole(STUDENT_ROLE)}>
                Student Login
              </button>

              <button className="role-buttons instructor" onClick={() => setRole(INSTRUCTOR_ROLE)}>
                Instructor Login
              </button>

              <button className="secondary-button" onClick={() => navigate('/')}>
                Go Home
              </button>
            </div>
          </main>
        )}

        {role && (
          <div className="login-modal">
            <div className="login-form">
              <h2>{role === STUDENT_ROLE ? 'Student Login' : 'Instructor Login'}</h2>

              <input
                type="text"
                placeholder="Email"
                className="login-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <input
                type="password"
                placeholder="Password"
                className="login-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {error && <div className="login-error">{error}</div>}

              <div className="login-actions">
                <button className="submit-button" onClick={handleLogin}>
                  Login
                </button>

                <button
                  className="cancel-button"
                  onClick={() => {
                    setRole(null)
                    setEmail('')
                    setPassword('')
                    setError(null)
                  }}
                >
                  Cancel
                </button>
              </div>

              <div className="create-account">
                <button className="secondary-button" onClick={() => navigate('/signup')}>
                  Create Account
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Login
