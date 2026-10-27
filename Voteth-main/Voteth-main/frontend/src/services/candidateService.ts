import { supabase } from '@services/supabase/client'
import type { Candidate, CandidateStatus } from '@/types/domain'

// ---------------------------------------------------------------------------
// candidateService
// CRUD operations for candidates within an election.
// All methods are org-scoped via RLS — only election admins can write.
// Requirements: CAND-01 through CAND-06
// ---------------------------------------------------------------------------

/** Payload for creating a new candidate. */
interface CreateCandidatePayload {
  election_id: string
  name: string
  bio?: string | null
  photo_url?: string | null
  user_id?: string | null
}

/** Payload for updating a candidate. */
interface UpdateCandidatePayload {
  name?: string
  bio?: string | null
  photo_url?: string | null
  status?: CandidateStatus
  ai_summary?: string | null
}

export const candidateService = {
  /**
   * Create a new candidate in an election (defaults to 'pending' status).
   * Requirement: CAND-01
   */
  async create(payload: CreateCandidatePayload): Promise<Candidate> {
    const existing = await candidateService.listByElection(payload.election_id)
    const nextOrder = existing.length

    const { data, error } = await supabase
      .from('candidates')
      .insert({
        election_id: payload.election_id,
        name: payload.name,
        bio: payload.bio ?? null,
        photo_url: payload.photo_url ?? null,
        user_id: payload.user_id ?? null,
        status: 'pending',
        display_order: nextOrder
      })
      .select()
      .single()

    if (error) throw error
    return data as Candidate
  },

  /**
   * List all candidates for an election, ordered by display order.
   * Requirement: CAND-02
   */
  async listByElection(electionId: string): Promise<Candidate[]> {
    const { data, error } = await supabase
      .from('candidates')
      .select('*')
      .eq('election_id', electionId)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true })

    if (error) throw error
    return (data ?? []) as Candidate[]
  },

  /**
   * List only approved candidates for an election (voter-facing).
   * Requirement: CAND-02
   */
  async listApproved(electionId: string): Promise<Candidate[]> {
    const { data, error } = await supabase
      .from('candidates')
      .select('*')
      .eq('election_id', electionId)
      .eq('status', 'approved')
      .order('display_order', { ascending: true })
      .order('name', { ascending: true })

    if (error) throw error
    return (data ?? []) as Candidate[]
  },

  /**
   * Get a single candidate by ID.
   * Requirement: CAND-03
   */
  async getById(id: string): Promise<Candidate> {
    const { data, error } = await supabase
      .from('candidates')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data as Candidate
  },

  /**
   * Update a candidate's details (admin or the candidate's own profile).
   * Requirement: CAND-04
   */
  async update(id: string, updates: UpdateCandidatePayload): Promise<Candidate> {
    const { data, error } = await supabase
      .from('candidates')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data as Candidate
  },

  /**
   * Approve a pending candidate (admin only via RLS).
   * Requirement: CAND-05
   */
  async approve(id: string): Promise<Candidate> {
    return candidateService.update(id, { status: 'approved' })
  },

  /**
   * Reject a pending candidate (admin only via RLS).
   * Requirement: CAND-05
   */
  async reject(id: string): Promise<Candidate> {
    return candidateService.update(id, { status: 'rejected' })
  },

  /**
   * Withdraw a candidate (candidate themselves or admin).
   * Requirement: CAND-06
   */
  async withdraw(id: string): Promise<Candidate> {
    return candidateService.update(id, { status: 'withdrawn' })
  },

  /**
   * Delete a candidate entirely (admin only, typically only in draft elections).
   * Requirement: CAND-06
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('candidates')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  /**
   * Get count of approved candidates for an election.
   */
  async getApprovedCount(electionId: string): Promise<number> {
    const { count, error } = await supabase
      .from('candidates')
      .select('id', { count: 'exact', head: true })
      .eq('election_id', electionId)
      .eq('status', 'approved')

    if (error) throw error
    return count ?? 0
  },
}
