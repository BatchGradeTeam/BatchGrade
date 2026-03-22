import { HashRouter, Route, Routes } from 'react-router-dom'
import { INSTRUCTOR_ROLE, STUDENT_ROLE } from '../../shared/types'
import { AuthProvider } from './components/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Grading from './pages/Grading'
import Home from './pages/Home'
import InstructorDashboard from './pages/InstructorDashboard'
import Login from './pages/Login'
import SignUp from './pages/SignUp'
import Gradebook from './pages/Gradebook'
import StudentDashboard from './pages/StudentDashboard'

function App(): React.JSX.Element {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route
            path="/studentdashboard"
            element={
              <ProtectedRoute requiredRoles={[STUDENT_ROLE]}>
                <StudentDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/instructordashboard"
            element={
              <ProtectedRoute requiredRoles={[INSTRUCTOR_ROLE]}>
                <InstructorDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/grading" element={<Grading />} />
          <Route path="/gradebook" element={<Gradebook />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}

export default App
