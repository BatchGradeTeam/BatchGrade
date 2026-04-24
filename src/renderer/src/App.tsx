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
 *  - Instructor Dashboard
 *  - Guest Dashboard
 *
 * The routing system is wrapped in an AuthProvider to allow all
 * pages within the application to access shared authentication
 * state (login status, user information, etc.)
 */
import { HashRouter, Route, Routes } from 'react-router-dom'
import { INSTRUCTOR_ROLE, STUDENT_ROLE } from '../../main/database/schema'
import { AuthProvider } from './components/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { About } from './pages/About'
//import { GuestBatchGradeInterface } from './pages/GuestBatchGradeInterface'
import { GuestDashboard } from './pages/GuestDashboard'
//import { GuestStudentInterface } from './pages/GuestStudentInterface'
import { InstructorDashboard } from './pages/InstructorDashboard'
import { Login } from './pages/Login'
import { SignUp } from './pages/SignUp'
import { StudentDashboard } from './pages/StudentDashboard'

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
 *    '/'   -> Login page
 *    '/login'    -> Login page
 *    '/studentdashboard'   -> Student interface
 *    '/instructordashboard'    -> Instructor interface
 *    '/guestDashboard'    -> Guest interface
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
          {/* Guest DashBoard */}
          <Route path="/guestDashboard" element={<GuestDashboard />} />
          {/* Guest Batch Interface */}
          
          {/* Guest Student Interface */}
          
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
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
