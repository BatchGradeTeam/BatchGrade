/**
 * ProtectedRoute.tsx
 *
 * Description:
 * A small wrapper component that enables role-based route protection.
 *
 * This component checks if the current user is authenticated and,
 * optionally, whether they have the required role(s) to access a route.
 * If not, it redirects them to an appropriate page (login or home).
 * 
 * While authentication state is still being restored, the component temporarily
 * renders a loading message so routes do not redirect prematurely before the user's
 * session has been checked
 */
import { ReactElement } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { VALID_ROLES } from '../../../main/database/schema'

type ValidRoles = (typeof VALID_ROLES)[number]

interface ProtectedRouteProps {
  children: ReactElement
  requiredRoles?: ValidRoles[]
  // Optional fallback path when access is denied
  fallbackPath?: string
}

export default function ProtectedRoute({
  children,
  requiredRoles,
  fallbackPath = '/'
}: ProtectedRouteProps): ReactElement {
  const { isLoggedIn, isAuthLoading, user } = useAuth()

  // While authentication state is still loading -> prevent premature redirects by showing a temporary message
  if (isAuthLoading) {
    return <div>Checking session...</div> // FIXME: change, style however later
  }

  // If the user is not authenticated at all, send them to login
  if (!isLoggedIn || !user) {
    return <Navigate to="/login" replace />
  }

  // If the route requires one or more roles, validate that the user has one of them
  if (requiredRoles && requiredRoles.length > 0) {
    const hasRequiredRole = requiredRoles.includes(user.role)
    if (!hasRequiredRole) {
      return <Navigate to={fallbackPath} replace />
    }
  }

  return children
}
