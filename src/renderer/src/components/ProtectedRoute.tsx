/**
 * ProtectedRoute.tsx
 *
 * Description:
 * A small wrapper component that enables role-based route protection.
 *
 * This component checks if the current user is authenticated and,
 * optionally, whether they have the required role(s) to access a route.
 * If not, it redirects them to an appropriate page (login or home).
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

export function ProtectedRoute({
  children,
  requiredRoles,
  fallbackPath = '/'
}: ProtectedRouteProps): ReactElement {
  const { isLoggedIn, user } = useAuth()

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
