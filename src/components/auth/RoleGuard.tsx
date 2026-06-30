import { Navigate } from 'react-router-dom'
import { useAuthContext } from '../../contexts/AuthContext'
import type { UserRole } from '../../types/auth'

interface RoleGuardProps {
  allow: UserRole[]
  children: React.ReactNode
  fallback?: React.ReactNode
}

/**
 * Renders children only if the current user's role is in `allow`.
 * Redirects to /403 otherwise (or renders `fallback` if provided).
 */
export default function RoleGuard({ allow, children, fallback }: RoleGuardProps) {
  const { role } = useAuthContext()

  if (!role || !allow.includes(role)) {
    return fallback ? <>{fallback}</> : <Navigate to="/403" replace />
  }

  return <>{children}</>
}
