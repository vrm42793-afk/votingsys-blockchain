import { useQuery } from '@tanstack/react-query'
import { analyticsService } from '@/services/analyticsService'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AnalyticsDashboardProps {
  electionId: string
  electionTitle: string
}

// ---------------------------------------------------------------------------
// Component
// Requirements: ANLT-01, ANLT-02, ANLT-03, ANLT-04
// ---------------------------------------------------------------------------

/**
 * AnalyticsDashboard — Comprehensive election analytics interface.
 * Live vote count, turnout metrics, candidate leaderboard,
 * blockchain verification status, and CSV export.
 */
export function AnalyticsDashboard({
  electionId,
  electionTitle,
}: AnalyticsDashboardProps) {
  // Live vote count (5-second refresh) — ANLT-01
  const { data: liveCount } = useQuery({
    queryKey: ['live-vote-count', electionId],
    queryFn: () => analyticsService.getLiveVoteCount(electionId),
    refetchInterval: 5000,
  })

  // Turnout metrics — ANLT-02
  const { data: turnout } = useQuery({
    queryKey: ['turnout-metrics', electionId],
    queryFn: () => analyticsService.getTurnoutMetrics(electionId),
    refetchInterval: 10000,
  })

  // Candidate leaderboard
  const { data: leaderboard, isLoading: leaderboardLoading } = useQuery({
    queryKey: ['candidate-metrics', electionId],
    queryFn: () => analyticsService.getCandidateMetrics(electionId),
    refetchInterval: 10000,
  })

  // Blockchain verification — ANLT-04
  const { data: chainStatus } = useQuery({
    queryKey: ['chain-verification', electionId],
    queryFn: () => analyticsService.getChainVerificationStatus(electionId),
    refetchInterval: 15000,
  })

  // CSV export handler — ANLT-03
  const handleExportCSV = async () => {
    try {
      const csv = await analyticsService.exportResultsAsCSV(electionId)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${electionTitle.replace(/[^a-z0-9]/gi, '_')}_results.csv`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('[AnalyticsDashboard] CSV export failed:', err)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-neutral-100">Analytics</h2>
          <p className="text-xs text-neutral-400 mt-0.5">{electionTitle}</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="px-4 py-2 text-xs font-semibold rounded-lg bg-brand-800 hover:bg-brand-700 text-neutral-300 hover:text-neutral-100 border border-brand-600 transition-all"
        >
          📥 Export CSV
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Live Vote Count */}
        <MetricCard
          label="Total Votes"
          value={liveCount?.totalVotes ?? 0}
          icon="🗳️"
          highlight
          footer={
            liveCount?.lastUpdated
              ? `Updated ${new Date(liveCount.lastUpdated).toLocaleTimeString()}`
              : undefined
          }
        />

        {/* Turnout */}
        <MetricCard
          label="Turnout"
          value={turnout ? `${turnout.turnoutPercentage}%` : '—'}
          icon="📊"
          footer={
            turnout
              ? `${turnout.votesSubmitted} of ${turnout.eligibleVoters} eligible`
              : undefined
          }
        />

        {/* On-Chain Verified */}
        <MetricCard
          label="Blockchain Verified"
          value={chainStatus ? `${chainStatus.percentageVerified}%` : '—'}
          icon="⛓️"
          footer={
            chainStatus
              ? `${chainStatus.totalOnChain} of ${chainStatus.totalOffChain} confirmed`
              : undefined
          }
        />

        {/* Last Block */}
        <MetricCard
          label="Last Block"
          value={chainStatus?.lastBlockChecked ?? '—'}
          icon="🔗"
          footer="Ethereum Sepolia"
        />
      </div>

      {/* Turnout Progress Bar */}
      {turnout && (
        <div className="rounded-xl bg-brand-900 border border-brand-700 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
              Voter Turnout
            </span>
            <span className="text-sm font-bold text-neutral-100">
              {turnout.turnoutPercentage}%
            </span>
          </div>
          <div className="h-3 rounded-full bg-brand-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent-600 to-accent-400 transition-all duration-1000 ease-out"
              style={{ width: `${Math.min(turnout.turnoutPercentage, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-neutral-500">
              {turnout.votesSubmitted} submitted
            </span>
            <span className="text-xs text-neutral-500">
              {turnout.eligibleVoters} eligible
            </span>
          </div>
        </div>
      )}

      {/* Candidate Leaderboard */}
      <div>
        <h3 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider mb-3">
          Candidate Leaderboard
        </h3>
        {leaderboardLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-14 rounded-lg bg-brand-900 border border-brand-700 animate-pulse"
              />
            ))}
          </div>
        ) : !leaderboard || leaderboard.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-brand-700 bg-brand-900/40 py-8 px-6 text-center">
            <span className="text-3xl mb-2">📈</span>
            <p className="text-xs text-neutral-500">
              No candidates or votes to display yet.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {leaderboard.map((candidate) => {
              const maxCount = leaderboard[0]?.voteCount ?? 1
              const barWidth =
                maxCount > 0 ? (candidate.voteCount / maxCount) * 100 : 0

              return (
                <li
                  key={candidate.candidateId}
                  className="rounded-lg bg-brand-900 border border-brand-700 px-4 py-3 hover:border-brand-600 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          candidate.rank === 1
                            ? 'bg-accent-600 text-white'
                            : candidate.rank === 2
                            ? 'bg-brand-600 text-neutral-200'
                            : 'bg-brand-800 text-neutral-400 border border-brand-600'
                        }`}
                      >
                        {candidate.rank}
                      </span>
                      <span className="text-sm font-medium text-neutral-100 truncate">
                        {candidate.candidateName}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <span className="text-sm font-bold text-neutral-100">
                        {candidate.voteCount}
                      </span>
                      <span className="text-xs text-neutral-500 w-12 text-right">
                        {candidate.percentage}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-brand-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ease-out ${
                        candidate.rank === 1
                          ? 'bg-accent-500'
                          : 'bg-brand-600'
                      }`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Blockchain Verification Detail */}
      {chainStatus && (
        <div className="rounded-xl bg-brand-900 border border-brand-700 p-5">
          <h3 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider mb-3">
            ⛓️ Blockchain Verification
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MiniStat label="Total Votes" value={chainStatus.totalOffChain} />
            <MiniStat label="On-Chain" value={chainStatus.totalOnChain} />
            <MiniStat
              label="Verified"
              value={`${chainStatus.percentageVerified}%`}
            />
            <MiniStat
              label="Last Block"
              value={chainStatus.lastBlockChecked ?? 'N/A'}
            />
          </div>
          {chainStatus.percentageVerified < 100 &&
            chainStatus.totalOffChain > 0 && (
              <div className="mt-3 p-3 rounded-lg bg-yellow-900/10 border border-yellow-800/30">
                <p className="text-xs text-yellow-400">
                  ⏳ {chainStatus.totalOffChain - chainStatus.totalOnChain} votes
                  pending on-chain confirmation.
                </p>
              </div>
            )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetricCard({
  label,
  value,
  icon,
  footer,
  highlight,
}: {
  label: string
  value: string | number
  icon: string
  footer?: string | undefined
  highlight?: boolean | undefined
}) {
  return (
    <div
      className={`rounded-xl border p-4 flex flex-col gap-1 ${
        highlight
          ? 'bg-accent-900/10 border-accent-700'
          : 'bg-brand-900 border-brand-700'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">
          {label}
        </span>
      </div>
      <span
        className={`text-2xl font-bold ${
          highlight ? 'text-accent-400' : 'text-neutral-100'
        }`}
      >
        {value}
      </span>
      {footer && <span className="text-xs text-neutral-600">{footer}</span>}
    </div>
  )
}

function MiniStat({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div>
      <p className="text-xs text-neutral-500 uppercase tracking-wider">
        {label}
      </p>
      <p className="text-sm font-bold text-neutral-100 mt-0.5">{value}</p>
    </div>
  )
}
