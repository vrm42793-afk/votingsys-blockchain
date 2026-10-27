import { supabase } from '@services/supabase/client'

// ---------------------------------------------------------------------------
// analyticsService
// Election analytics and reporting: live counts, turnout, CSV export,
// blockchain verification status.
// Requirements: ANLT-01, ANLT-02, ANLT-03, ANLT-04
// ---------------------------------------------------------------------------

/** Live vote count data. */
interface LiveVoteCount {
  totalVotes: number
  lastUpdated: string
}

/** Turnout metrics data. */
interface TurnoutMetrics {
  eligibleVoters: number
  votesSubmitted: number
  turnoutPercentage: number
}

/** Candidate metrics for the leaderboard. */
interface CandidateMetric {
  candidateId: string
  candidateName: string
  voteCount: number
  percentage: number
  rank: number
}

/** Blockchain verification status. */
interface ChainVerificationStatus {
  totalOnChain: number
  totalOffChain: number
  percentageVerified: number
  lastBlockChecked: number | null
}

export const analyticsService = {
  /**
   * Get the live vote count for an election.
   * Requirement: ANLT-01
   */
  async getLiveVoteCount(electionId: string): Promise<LiveVoteCount> {
    const { count, error } = await supabase
      .from('votes')
      .select('id', { count: 'exact', head: true })
      .eq('election_id', electionId)

    if (error) throw error

    return {
      totalVotes: count ?? 0,
      lastUpdated: new Date().toISOString(),
    }
  },

  /**
   * Get turnout metrics for an election.
   * Requirement: ANLT-02
   */
  async getTurnoutMetrics(electionId: string): Promise<TurnoutMetrics> {
    // Get total eligible voters (members of the org)
    const { data: election, error: electionError } = await supabase
      .from('elections')
      .select('org_id')
      .eq('id', electionId)
      .single()

    if (electionError) throw electionError

    const { count: eligibleCount, error: eligibleError } = await supabase
      .from('org_memberships')
      .select('user_id', { count: 'exact', head: true })
      .eq('organization_id', election.org_id)

    if (eligibleError) throw eligibleError

    // Get submitted votes count
    const { count: voteCount, error: voteError } = await supabase
      .from('votes')
      .select('id', { count: 'exact', head: true })
      .eq('election_id', electionId)

    if (voteError) throw voteError

    const eligible = eligibleCount ?? 0
    const submitted = voteCount ?? 0

    return {
      eligibleVoters: eligible,
      votesSubmitted: submitted,
      turnoutPercentage:
        eligible > 0 ? Math.round((submitted / eligible) * 10000) / 100 : 0,
    }
  },

  /**
   * Export election results as a CSV string.
   * Requirement: ANLT-03
   */
  async exportResultsAsCSV(electionId: string): Promise<string> {
    // Fetch candidates
    const { data: candidates, error: candError } = await supabase
      .from('candidates')
      .select('id, name')
      .eq('election_id', electionId)
      .eq('status', 'approved')

    if (candError) throw candError

    // Fetch votes
    const { data: votes, error: voteError } = await supabase
      .from('votes')
      .select('candidate_id, created_at')
      .eq('election_id', electionId)

    if (voteError) throw voteError

    // Build tally
    const voteCounts = new Map<string, number>()
    for (const vote of votes ?? []) {
      const current = voteCounts.get(vote.candidate_id) ?? 0
      voteCounts.set(vote.candidate_id, current + 1)
    }

    const totalVotes = votes?.length ?? 0

    // Build CSV
    const rows: string[] = ['Rank,Candidate,Votes,Percentage']

    const sorted = (candidates ?? [])
      .map((c) => ({
        name: c.name as string,
        count: voteCounts.get(c.id as string) ?? 0,
      }))
      .sort((a, b) => b.count - a.count)

    sorted.forEach((row, index) => {
      const pct =
        totalVotes > 0
          ? (Math.round((row.count / totalVotes) * 10000) / 100).toFixed(2)
          : '0.00'
      rows.push(`${index + 1},"${row.name}",${row.count},${pct}%`)
    })

    return rows.join('\n')
  },

  /**
   * Get blockchain verification status for votes in an election.
   * Requirement: ANLT-04
   */
  async getChainVerificationStatus(
    electionId: string
  ): Promise<ChainVerificationStatus> {
    // Total votes
    const { count: totalCount, error: totalError } = await supabase
      .from('votes')
      .select('id', { count: 'exact', head: true })
      .eq('election_id', electionId)

    if (totalError) throw totalError

    // On-chain confirmed votes
    const { count: confirmedCount, error: confirmedError } = await supabase
      .from('votes')
      .select('id', { count: 'exact', head: true })
      .eq('election_id', electionId)
      .eq('is_chain_confirmed', true)

    if (confirmedError) throw confirmedError

    // Get the latest block number from confirmed votes
    const { data: latestVote, error: latestError } = await supabase
      .from('votes')
      .select('chain_block_number')
      .eq('election_id', electionId)
      .eq('is_chain_confirmed', true)
      .order('chain_block_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latestError) throw latestError

    const total = totalCount ?? 0
    const confirmed = confirmedCount ?? 0

    return {
      totalOnChain: confirmed,
      totalOffChain: total,
      percentageVerified:
        total > 0 ? Math.round((confirmed / total) * 10000) / 100 : 0,
      lastBlockChecked: latestVote?.chain_block_number ?? null,
    }
  },

  /**
   * Get candidate metrics for the leaderboard.
   */
  async getCandidateMetrics(electionId: string): Promise<CandidateMetric[]> {
    const { data: candidates, error: candError } = await supabase
      .from('candidates')
      .select('id, name')
      .eq('election_id', electionId)
      .eq('status', 'approved')

    if (candError) throw candError

    const { data: votes, error: voteError } = await supabase
      .from('votes')
      .select('candidate_id')
      .eq('election_id', electionId)

    if (voteError) throw voteError

    const voteCounts = new Map<string, number>()
    for (const vote of votes ?? []) {
      const current = voteCounts.get(vote.candidate_id) ?? 0
      voteCounts.set(vote.candidate_id, current + 1)
    }

    const totalVotes = votes?.length ?? 0

    return (candidates ?? [])
      .map((c) => ({
        candidateId: c.id as string,
        candidateName: c.name as string,
        voteCount: voteCounts.get(c.id as string) ?? 0,
        percentage:
          totalVotes > 0
            ? Math.round(
                ((voteCounts.get(c.id as string) ?? 0) / totalVotes) * 10000
              ) / 100
            : 0,
        rank: 0,
      }))
      .sort((a, b) => b.voteCount - a.voteCount)
      .map((m, i) => ({ ...m, rank: i + 1 }))
  },
}
