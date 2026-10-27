import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

interface GuestRouteProps {
  children: React.ReactNode
}

export function GuestRoute({ children }: GuestRouteProps) {
  const { user, isPlatformOwner, isOrganizer, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-950">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-accent-500 border-t-transparent mx-auto mb-4"></div>
          <h2 className="text-lg font-semibold text-neutral-100">Loading VotEth 2.0...</h2>
          <p className="text-sm text-neutral-400">Restoring your session</p>
        </div>
      </div>
    )
  }

  if (user) {
    let dest = '/dashboard'
    if (isPlatformOwner) {
      dest = '/admin'
    } else if (isOrganizer) {
      dest = '/organizer'
    }
    return <Navigate to={dest} replace />
  }

  return <>{children}</>
}
