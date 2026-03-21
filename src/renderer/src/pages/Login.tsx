import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { User } from '../../../shared/types'
import { INSTRUCTOR_ROLE, STUDENT_ROLE } from '../../../shared/types'
import { useAuth } from '../components/AuthContext'

function Login(): React.JSX.Element {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [role, setRole] = useState<typeof STUDENT_ROLE | typeof INSTRUCTOR_ROLE | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(): Promise<void> {
    setError(null)

    const users: User[] = await window.api.users.getAll()
    const foundUser = users.find((user) => user.email === email)

    if (!foundUser) {
      setError('User does not exist')
      return
    }

    if (password.length === 0) {
      setError('Password required')
      return
    }

    const validRoles = [STUDENT_ROLE, INSTRUCTOR_ROLE] as const
    type Role = (typeof validRoles)[number]

    if (!validRoles.includes(foundUser.role as Role)) {
      setError('Invalid user role')
      return
    }

    if (role !== foundUser.role) {
      setError('Selected role does not match user role')
      return
    }

    try {
      const loggedInUser = await login(email, password)

      if (loggedInUser.role === STUDENT_ROLE) {
        navigate('/studentdashboard')
      } else if (loggedInUser.role === INSTRUCTOR_ROLE) {
        navigate('/instructordashboard')
      }
    } catch (err) {
      setError('Login failed. Please check your email and password.')
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
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Login
