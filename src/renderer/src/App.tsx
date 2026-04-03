/**
 * App.tsx
 *
 * Description:
 * This file defines the main application component and configures
 * the routing system for the BatchGrade platform. The routing
 * structure determines which pages component is rendered based on
 * the current URL path.
 *
 * The application uses React Router to manage navigation between
 * the following primary views:
 *  - Login (landing page)
 *  - SignUp (registration page)
 *  - About (project information)
 *  - Student Dashboard
 *    - Student Upload Interface
 *  - Instructor Dashboard
 *    - Grading Interface
 *    - Gradebook Interface
 *
 * The routing system is wrapped in an AuthProvider to allow all
 * pages within the application to access shared authentication
 * state (login status, user information, etc.)
 */
import { HashRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './components/AuthContext'
import { SignUp } from './pages/SignUp'
import { About } from './pages/About'
import { Login } from './pages/Login'
import { Grading } from './pages/Grading'
import { Gradebook } from './pages/Gradebook'
import { StudentDashboard } from './pages/StudentDashboard'
import { InstructorDashboard } from './pages/InstructorDashboard'
import { ProtectedRoute } from './components/ProtectedRoute'
import { StudentUploadInterface } from './pages/studentUploadInterface'
import { STUDENT_ROLE, INSTRUCTOR_ROLE } from '../../main/database/schema'

/**
 * App Component
 *
 * The App component serves as the root component for the BatchGrade
 * application. It establishes global providers and configures all
 * application routes.
 *
 * Routing is implemented using React Router. Each route maps a URL
 * path to a corresponding page component located. in the /pages
 * directory
 *
 * For example:
 *    '/'   -> Home page
 *    '/login'    -> Login page
 *    '/studentdashboard'   -> Student interface
 *    '/instructordashboard'    -> Instructor interface
 *    '/grading'    -> Grading interface
 *
 * Additional routes can be added by:
 *    1. Creating a new page component inside the /page directory.
 *    2. Importing the component at the top of this file.
 *    3. Adding a corresponding <Route> element within the <Routes> block.
 *
 * @returns App(): React.JSX.Element
 */

export function App(): React.JSX.Element {
  return (
    /*-----------------------------------------------------------
      Authentication Provider
        Provides global authentication state to the
        entire application
      -----------------------------------------------------------*/
    <AuthProvider>
      {/*-----------------------------------------------------------
        Router Configuration
          HashRouter is used for routing to ensure
          compatibility with static or local hosting
        -----------------------------------------------------------*/}
      <HashRouter>
        {/*-----------------------------------------------------------
          Application Routes
            Each route maps a URL path to a specific page
          -----------------------------------------------------------*/}
        <Routes>
          {/* Landing Page */}
          <Route path="/" element={<Login />} />
          {/* About Page */}
          <Route path="/about" element={<About />} />
          {/* Login Page */}
          <Route path="/login" element={<Login />} />
          {/* SignUp Page */}
          <Route path="/signup" element={<SignUp />} />
          {/* Student Interface */}
          <Route
            path="/studentdashboard"
            element={
              <ProtectedRoute requiredRoles={[STUDENT_ROLE]}>
                <StudentDashboard />
              </ProtectedRoute>
            }
          />
          {/* Instructor Interface (role-protected) */}
          <Route
            path="/instructordashboard"
            element={
              <ProtectedRoute requiredRoles={[INSTRUCTOR_ROLE]}>
                <InstructorDashboard />
              </ProtectedRoute>
            }
          />
          {/* Student Upload Interface (role-protected) */}
          <Route
            path="/studentuploadinterface"
            element={
              <ProtectedRoute requiredRoles={[STUDENT_ROLE]}>
                <StudentUploadInterface />
              </ProtectedRoute>
            }
          />
          {/* Gradebook Interface (role-protected) */}
          <Route
            path="/gradebook"
            element={
              <ProtectedRoute requiredRoles={[INSTRUCTOR_ROLE]}>
                <Gradebook />
              </ProtectedRoute>
            }
          />
          {/* Grading Interface */}
          <Route
            path="/grading"
            element={
              <ProtectedRoute requiredRoles={[INSTRUCTOR_ROLE]}>
                <Grading />
              </ProtectedRoute>
            }
          />
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
