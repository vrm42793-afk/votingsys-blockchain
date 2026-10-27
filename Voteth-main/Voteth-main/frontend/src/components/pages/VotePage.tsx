import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { electionService } from '@/services/electionService'
import { supabase } from '@services/supabase/client'
import { VotingInterface } from '@/components/features/VotingInterface'
import type { Candidate } from '@/types/domain'

/**
 * VotePage — Route-level page that loads election data and renders VotingInterface.
 * Route: /elections/:electionId/vote
 */
export function VotePage() {
  const { electionId } = useParams<{ electionId: string }>()

  const { data: election, isLoading: electionLoading } = useQuery({
    queryKey: ['election', electionId],
    queryFn: () => electionService.getById(electionId!),
    enabled: !!electionId,
  })

  const { data: candidates, isLoading: candidatesLoading } = useQuery({
    queryKey: ['candidates', electionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidates')
        .select('*')
        .eq('election_id', electionId!)
        .eq('status', 'approved')
        .order('name')
      if (error) throw error
      return (data ?? []) as Candidate[]
    },
    enabled: !!electionId,
  })

  const isLoading = electionLoading || candidatesLoading

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

  if (election.status !== 'open') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <span className="text-4xl mb-3">🔒</span>
        <h2 className="text-lg font-bold text-neutral-100 mb-1">Voting Not Available</h2>
        <p className="text-sm text-neutral-400 max-w-sm">
          {election.status === 'draft'
            ? 'This election is still in draft mode. Voting has not started yet.'
            : election.status === 'closed'
            ? 'This election is closed. Voting has ended.'
            : 'This election has been published. Results are now available.'}
        </p>
        {election.status === 'published' && (
          <Link
            to={`/elections/${electionId}/results`}
            className="mt-4 px-5 py-2 rounded-lg bg-accent-600 hover:bg-accent-500 text-sm font-semibold text-neutral-100 transition-all"
          >
            View Results
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
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
        <span className="text-neutral-300">Vote</span>
      </div>

      {/* Election Title */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-100 tracking-tight">
          {election.title}
        </h1>
        {election.description && (
          <p className="text-sm text-neutral-400 mt-1">{election.description}</p>
        )}
      </div>

      {/* Voting Interface */}
      <VotingInterface
        electionId={electionId!}
        electionType={election.election_type}
        maxVotesPerVoter={election.max_votes_per_voter}
        candidates={candidates ?? []}
      />
    </div>
  )
}
