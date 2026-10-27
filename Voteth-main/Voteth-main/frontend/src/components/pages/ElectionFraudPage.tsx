import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { electionService } from '@/services/electionService'
import { FraudAlertPanel } from '@/components/features/FraudAlertPanel'
import { useAuth } from '@/contexts/AuthContext'

/**
 * ElectionFraudPage — Route-level wrapper for the FraudAlertPanel.
 * Route: /admin/elections/:electionId/fraud
 */
export function ElectionFraudPage() {
  const { electionId } = useParams<{ electionId: string }>()
  const { activeMembership } = useAuth()
  const isAdmin = activeMembership?.role === 'admin'

  const { data: election, isLoading } = useQuery({
    queryKey: ['election', electionId],
    queryFn: () => electionService.getById(electionId!),
    enabled: !!electionId,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!election) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <span className="text-4xl mb-3">🔍</span>
        <h2 className="text-lg font-bold text-neutral-100 mb-1">Election Not Found</h2>
        <p className="text-sm text-neutral-400">This election doesn't exist or you don't have access.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-neutral-500">
        <Link to="/organizer" className="hover:text-accent-400 transition-colors">
          Organizer
        </Link>
        <span>/</span>
        <Link
          to={`/organizer/elections/${electionId}`}
          className="hover:text-accent-400 transition-colors truncate"
        >
          {election.title}
        </Link>
        <span>/</span>
        <span className="text-neutral-300">Fraud Detection</span>
      </div>

      <FraudAlertPanel
        electionId={electionId!}
        isAdmin={isAdmin}
      />
    </div>
  )
}
