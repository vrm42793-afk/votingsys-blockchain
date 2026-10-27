import { useQuery } from '@tanstack/react-query'
import { votingService } from '@/services/votingService'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ElectionResultsProps {
  electionId: string
  electionTitle: string
  isPublished: boolean
}

// ---------------------------------------------------------------------------
// Component
// Requirement: VOTE-08
// ---------------------------------------------------------------------------

/**
 * ElectionResults — Visual results display component.
 * Shows progress bars, vote counts, percentages, and winner announcement.
 * Only visible after election results are published.
 */
export function ElectionResults({
  electionId,
  electionTitle,
  isPublished,
}: ElectionResultsProps) {
  const { data: results, isLoading } = useQuery({
    queryKey: ['election-results', electionId],
    queryFn: () => votingService.getResults(electionId),
    enabled: isPublished,
    refetchInterval: isPublished ? 10000 : false, // Refresh every 10s when published
  })

  // Not published gate
  if (!isPublished) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-brand-700 bg-brand-900/60 py-12 px-6 text-center">
        <span className="text-4xl mb-3">🔒</span>
        <h3 className="text-lg font-bold text-neutral-100 mb-1">
          Results Not Yet Published
        </h3>
        <p className="text-sm text-neutral-400 max-w-sm">
          Results for this election will be visible once the admin publishes them
          after the voting period closes.
        </p>
      </div>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-20 rounded-lg bg-brand-900 border border-brand-700 animate-pulse"
          />
        ))}
      </div>
    )
  }

  if (!results || results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-brand-700 bg-brand-900/40 py-12 px-6 text-center">
        <span className="text-4xl mb-3">📊</span>
        <h3 className="text-sm font-semibold text-neutral-200 mb-1">
          No Votes Recorded
        </h3>
        <p className="text-xs text-neutral-500">No votes were cast in this election.</p>
      </div>
    )
  }

  // Sort by vote count descending
  const sorted = [...results].sort((a, b) => b.vote_count - a.vote_count)
  const totalVotes = sorted.reduce((sum, r) => sum + r.vote_count, 0)
  const winner = sorted[0]
  const maxVotes = winner?.vote_count ?? 0

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-neutral-100">Election Results</h2>
        <p className="text-xs text-neutral-400 mt-0.5">
          {electionTitle} — {totalVotes} total vote{totalVotes !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Winner Announcement */}
      {winner && winner.vote_count > 0 && (
        <div className="rounded-xl bg-gradient-to-r from-accent-900/30 via-brand-900 to-accent-900/30 border border-accent-700 p-5 flex items-center gap-4">
          <span className="text-4xl">🏆</span>
          <div>
            <p className="text-xs text-accent-400 uppercase tracking-wider font-semibold">
              Winner
            </p>
            <p className="text-xl font-bold text-neutral-100">
              {winner.candidate_name}
            </p>
            <p className="text-sm text-neutral-400">
              {winner.vote_count} vote{winner.vote_count !== 1 ? 's' : ''} ({winner.percentage}%)
            </p>
          </div>
        </div>
      )}

      {/* Results List */}
      <ul className="flex flex-col gap-3">
        {sorted.map((result, index) => {
          const barWidth = maxVotes > 0 ? (result.vote_count / maxVotes) * 100 : 0
          const isWinner = index === 0 && result.vote_count > 0

          return (
            <li
              key={result.candidate_id}
              className={`rounded-xl border p-4 transition-all ${
                isWinner
                  ? 'border-accent-700 bg-accent-900/10'
                  : 'border-brand-700 bg-brand-900'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Rank Badge */}
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      isWinner
                        ? 'bg-accent-600 text-white'
                        : 'bg-brand-800 text-neutral-400 border border-brand-600'
                    }`}
                  >
                    {index + 1}
                  </span>
                  {/* Candidate Info */}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-100 truncate">
                      {result.candidate_name}
                    </p>
                    {result.ai_summary && (
                      <p className="text-xs text-neutral-500 truncate">
                        {result.ai_summary}
                      </p>
                    )}
                  </div>
                </div>
                {/* Vote Count */}
                <div className="text-right shrink-0 ml-4">
                  <p className="text-sm font-bold text-neutral-100">
                    {result.vote_count}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {result.percentage}%
                  </p>
                </div>
              </div>
              {/* Progress Bar */}
              <div className="h-2 rounded-full bg-brand-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${
                    isWinner
                      ? 'bg-gradient-to-r from-accent-500 to-accent-400'
                      : 'bg-brand-600'
                  }`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
