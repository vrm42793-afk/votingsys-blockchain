import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { OrgRole, PlatformRole } from '@/types/domain'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: OrgRole
  requiredPlatformRole?: PlatformRole | PlatformRole[]
  requireOrganizer?: boolean
}

export function ProtectedRoute({
  children,
  requiredRole,
  requiredPlatformRole,
  requireOrganizer,
}: ProtectedRouteProps) {
  const { user, profile, activeMembership, memberships, isOrganizer, isPlatformOwner, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-950">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-accent-500 border-t-transparent mx-auto mb-4"></div>
          <h2 className="text-lg font-semibold text-neutral-100">Authenticating Session...</h2>
          <p className="text-sm text-neutral-400">Verifying organizational boundaries</p>
        </div>
      </div>
    )
  }

  if (!user) {
    // Redirect to login page but save the current location they were trying to go to
    return <Navigate to="/auth/login" state={{ from: location }} replace />
  }

  // Platform-level role enforcement (e.g. platform owner)
  if (requiredPlatformRole) {
    const allowed = Array.isArray(requiredPlatformRole) ? requiredPlatformRole : [requiredPlatformRole]
    if (!profile?.platform_role || !allowed.includes(profile.platform_role)) {
      return <Navigate to="/dashboard" replace />
    }
  }

  // Organizer role enforcement (checks org-admin, platform organizer, or platform owner)
  if (requireOrganizer) {
    if (!isOrganizer) {
      return <Navigate to="/dashboard" replace />
    }
  }

  // Tenant-aware role enforcement (checks active organization admin status)
  if (requiredRole) {
    if (isPlatformOwner) {
      return <>{children}</>
    }

    const hasRequiredRole = 
      activeMembership?.role === requiredRole ||
      (requiredRole === 'admin' && memberships.some(m => m.role === 'admin'))

    if (!hasRequiredRole) {
      return <Navigate to="/dashboard" replace />
    }
  }

  return <>{children}</>
}
