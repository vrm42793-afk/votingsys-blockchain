import { supabase } from '@services/supabase/client'
import type { Vote, VoteReceipt, Candidate } from '@/types/domain'

// ---------------------------------------------------------------------------
// votingService
// Core voting operations: cast vote, receipts, results, hasVoted checks.
// Requirements: VOTE-02, VOTE-03, VOTE-04, VOTE-06, VOTE-08
// ---------------------------------------------------------------------------

/** Payload for casting a vote. */
interface CastVotePayload {
  election_id: string
  candidate_id: string
  vote_hash: string
  chain_tx_hash?: string | null
  chain_block_number?: number | null
  is_chain_confirmed?: boolean
}

/** Aggregated result for a single candidate. */
interface CandidateResult {
  candidate_id: string
  candidate_name: string
  photo_url: string | null
  ai_summary: string | null
  vote_count: number
  percentage: number
}

export const votingService = {
  /**
   * Cast a vote for a candidate in an election.
   * The vote is recorded off-chain first, then anchored on-chain.
   * Requirement: VOTE-02, VOTE-03
   */
  async castVote(payload: CastVotePayload): Promise<Vote> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('votes')
      .insert({
        election_id: payload.election_id,
        voter_id: user.id,
        candidate_id: payload.candidate_id,
        vote_hash: payload.vote_hash,
        chain_tx_hash: payload.chain_tx_hash ?? null,
        chain_block_number: payload.chain_block_number ?? null,
        is_chain_confirmed: payload.is_chain_confirmed ?? (!!payload.chain_tx_hash),
      })
      .select()
      .single()

    if (error) throw error
    return data as Vote
  },

  /**
   * Get the vote receipt for the current user in an election.
   * Requirement: VOTE-06
   */
  async getVoteReceipt(electionId: string): Promise<VoteReceipt | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('votes')
      .select('vote_hash, chain_tx_hash, created_at')
      .eq('election_id', electionId)
      .eq('voter_id', user.id)
      .maybeSingle()

    if (error) throw error
    if (!data) return null

    return {
      vote_hash: data.vote_hash,
      chain_tx_hash: data.chain_tx_hash,
      timestamp: data.created_at,
    } as VoteReceipt
  },

  async getResults(electionId: string): Promise<CandidateResult[]> {
    // Fetch candidates for this election
    const { data: candidates, error: candError } = await supabase
      .from('candidates')
      .select('id, name, photo_url, ai_summary')
      .eq('election_id', electionId)
      .eq('status', 'approved')

    if (candError) throw candError

    // Fetch vote counts grouped by candidate using the secure RPC
    const { data: tallies, error: rpcError } = await supabase
      .rpc('get_election_results', { p_election_id: electionId })

    if (rpcError) throw rpcError

    // Tally votes per candidate
    const voteCounts = new Map<string, number>()
    const talliesData = (tallies ?? []) as { candidate_id: string; vote_count: string | number }[]
    for (const row of talliesData) {
      voteCounts.set(row.candidate_id, Number(row.vote_count))
    }

    const totalVotes = talliesData.reduce((sum: number, r) => sum + Number(r.vote_count), 0)

    return (candidates ?? []).map((c: Pick<Candidate, 'id' | 'name' | 'photo_url' | 'ai_summary'>) => ({
      candidate_id: c.id,
      candidate_name: c.name,
      photo_url: c.photo_url,
      ai_summary: c.ai_summary,
      vote_count: voteCounts.get(c.id) ?? 0,
      percentage: totalVotes > 0
        ? Math.round(((voteCounts.get(c.id) ?? 0) / totalVotes) * 10000) / 100
        : 0,
    })) as CandidateResult[]
  },

  /**
   * Check if the current user has already voted in an election.
   * Requirement: VOTE-04
   */
  async hasVoted(electionId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const { count, error } = await supabase
      .from('votes')
      .select('id', { count: 'exact', head: true })
      .eq('election_id', electionId)
      .eq('voter_id', user.id)

    if (error) throw error
    return (count ?? 0) > 0
  },

  /**
   * Get the vote count for a specific candidate in an election.
   */
  async getCandidateVoteCount(
    electionId: string,
    candidateId: string
  ): Promise<number> {
    const { count, error } = await supabase
      .from('votes')
      .select('id', { count: 'exact', head: true })
      .eq('election_id', electionId)
      .eq('candidate_id', candidateId)

    if (error) throw error
    return count ?? 0
  },
}
