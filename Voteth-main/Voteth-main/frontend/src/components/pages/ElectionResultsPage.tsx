import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { electionService } from '@/services/electionService'
import { ElectionResults } from '@/components/features/ElectionResults'

/**
 * ElectionResultsPage — Route-level wrapper for ElectionResults feature component.
 * Route: /elections/:electionId/results
 */
export function ElectionResultsPage() {
  const { electionId } = useParams<{ electionId: string }>()

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
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-neutral-500">
        <Link to="/elections" className="hover:text-accent-400 transition-colors">
          Elections
        </Link>
        <span>/</span>
        <Link
          to={`/elections/${electionId}`}
          className="hover:text-accent-400 transition-colors truncate"
        >
          {election.title}
        </Link>
        <span>/</span>
        <span className="text-neutral-300">Results</span>
      </div>

      <ElectionResults
        electionId={electionId!}
        electionTitle={election.title}
        isPublished={election.status === 'published'}
      />
    </div>
  )
}
