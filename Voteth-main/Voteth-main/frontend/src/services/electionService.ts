import { supabase } from '@services/supabase/client'
import type { Election, ElectionInsert, ElectionStatus } from '@/types/domain'

// ---------------------------------------------------------------------------
// electionService
// All methods are org-scoped. RLS enforces admin-only writes server-side.
// Requirements: ELEC-01 through ELEC-09
// ---------------------------------------------------------------------------

/** Valid state transitions for the election lifecycle */
const VALID_TRANSITIONS: Record<ElectionStatus, ElectionStatus[]> = {
  draft: ['open'],
  open: ['closed'],
  closed: ['published'],
  published: [],
}

export const electionService = {
  /**
   * Creates a new election in DRAFT state for the given org.
   * Throws on Supabase error — caller handles UX.
   * Requirement: ELEC-01
   */
  async create(payload: ElectionInsert): Promise<Election> {
    const { data, error } = await supabase
      .from('elections')
      .insert(payload)
      .select()
      .single()

    if (error) throw error
    return data as Election
  },

  /**
   * Fetches a single election by ID, scoped to the caller's org via RLS.
   * Requirement: ELEC-02
   */
  async getById(id: string): Promise<Election> {
    const { data, error } = await supabase
      .from('elections')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data as Election
  },

  /**
   * Fetches all elections for an org, ordered by start date descending.
   * Requirement: ELEC-03
   */
  async listByOrg(orgId: string): Promise<Election[]> {
    const { data, error } = await supabase
      .from('elections')
      .select('*')
      .eq('org_id', orgId)
      .order('start_date', { ascending: false })

    if (error) throw error
    return (data ?? []) as Election[]
  },

  /**
   * Update election fields (only allowed in DRAFT or by admin).
   * Requirement: ELEC-05
   */
  async update(
    id: string,
    updates: Partial<Pick<Election, 'title' | 'description' | 'election_type' | 'max_votes_per_voter' | 'start_date' | 'end_date'>>
  ): Promise<Election> {
    const { data, error } = await supabase
      .from('elections')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data as Election
  },

  /**
   * Delete an election. Only allowed for DRAFT elections by admin via RLS.
   * Requirement: ELEC-06
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('elections')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  /**
   * Transition election status with validation.
   * Enforces the state machine: DRAFT → OPEN → CLOSED → PUBLISHED
   * Requirement: ELEC-04, ELEC-07
   */
  async transitionStatus(
    id: string,
    newStatus: ElectionStatus
  ): Promise<Election> {
    // Fetch current status first
    const current = await electionService.getById(id)
    const allowed = VALID_TRANSITIONS[current.status]

    if (!allowed.includes(newStatus)) {
      throw new Error(
        `Invalid transition: cannot move from '${current.status}' to '${newStatus}'. ` +
        `Allowed transitions: ${allowed.length > 0 ? allowed.join(', ') : 'none (terminal state)'}.`
      )
    }

    const { data, error } = await supabase
      .from('elections')
      .update({ status: newStatus })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data as Election
  },

  /**
   * Convenience: Open a draft election.
   * Requirement: ELEC-04
   */
  async open(id: string): Promise<Election> {
    return electionService.transitionStatus(id, 'open')
  },

  /**
   * Convenience: Close an open election.
   * Requirement: ELEC-04
   */
  async close(id: string): Promise<Election> {
    return electionService.transitionStatus(id, 'closed')
  },

  /**
   * Convenience: Publish a closed election's results.
   * Requirement: ELEC-04, ELEC-08
   */
  async publish(id: string): Promise<Election> {
    return electionService.transitionStatus(id, 'published')
  },

  /**
   * Get elections the current user is eligible to vote in.
   * Returns elections that are 'open' and where the user is in the voter allowlist.
   */
  async listVotableElections(): Promise<Election[]> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // 1. Get election IDs where the user is an explicit eligible voter
    const { data: voterEntries, error: voterError } = await supabase
      .from('election_voters')
      .select('election_id')
      .eq('user_id', user.id)

    if (voterError) throw voterError
    const allowlistedIds = new Set((voterEntries ?? []).map(v => v.election_id))

    // 2. Get organizations where the user is an active member
    const { data: memberships, error: memberError } = await supabase
      .from('org_memberships')
      .select('organization_id')
      .eq('user_id', user.id)

    if (memberError) throw memberError
    const memberOrgIds = new Set((memberships ?? []).map(m => m.organization_id))

    // 3. Fetch all open elections
    const { data: openElections, error: electionsError } = await supabase
      .from('elections')
      .select('*')
      .eq('status', 'open')
      .order('end_date', { ascending: true })

    if (electionsError) throw electionsError

    return ((openElections ?? []) as Election[]).filter(election => {
      if (allowlistedIds.has(election.id)) return true
      if (election.is_active_eligibility === 'entire_org' && memberOrgIds.has(election.org_id)) return true
      return false
    })
  },

  /**
   * Get election results using the secure SECURITY DEFINER function.
   * Only returns data for published elections.
   * Requirement: ELEC-08, VOTE-08
   */
  async getResults(electionId: string): Promise<{
    candidate_id: string
    candidate_name: string
    vote_count: number
  }[]> {
    const { data, error } = await supabase
      .rpc('get_election_results', { p_election_id: electionId })

    if (error) throw error
    return (data ?? []) as { candidate_id: string; candidate_name: string; vote_count: number }[]
  },

  /**
   * Get admin-only election results (available before publish).
   * Requirement: ELEC-09
   */
  async getAdminResults(electionId: string): Promise<{
    candidate_id: string
    candidate_name: string
    vote_count: number
  }[]> {
    const { data, error } = await supabase
      .rpc('get_admin_election_results', { p_election_id: electionId })

    if (error) throw error
    return (data ?? []) as { candidate_id: string; candidate_name: string; vote_count: number }[]
  },

  /**
   * Get voter turnout metrics using the secure function.
   * Requirement: ANLT-02
   */
  async getTurnout(electionId: string): Promise<{
    total_eligible: number
    total_voted: number
    turnout_percent: number
  }> {
    const { data, error } = await supabase
      .rpc('get_voter_turnout', { p_election_id: electionId })

    if (error) throw error
    const row = Array.isArray(data) ? data[0] : data
    return row as { total_eligible: number; total_voted: number; turnout_percent: number }
  },

  /**
   * List all voters currently on the allowlist for this election.
   */
  async listVoters(electionId: string): Promise<{
    id: string
    user_id: string
    status?: 'pending' | 'approved' | 'rejected'
    added_at: string
    user_profile: {
      full_name: string | null
      avatar_url: string | null
      wallet_address?: string | null
    } | null
  }[]> {
    const { data, error } = await supabase
      .from('election_voters')
      .select('id, user_id, status, added_at, user_profile:user_profiles(full_name, avatar_url, wallet_address)')
      .eq('election_id', electionId)
      .order('added_at', { ascending: false })

    if (error) {
      // Fallback if status column is not yet present
      if (error.code === '42703' || error.message?.includes('status')) {
        const { data: fallback, error: fbErr } = await supabase
          .from('election_voters')
          .select('id, user_id, added_at, user_profile:user_profiles(full_name, avatar_url, wallet_address)')
          .eq('election_id', electionId)
          .order('added_at', { ascending: false })
        if (fbErr) throw fbErr
        return (fallback ?? []).map((v: any) => ({ ...v, status: 'approved' }))
      }
      throw error
    }

    return (data ?? []).map((v: any) => ({
      ...v,
      status: v.status || 'approved',
    }))
  },

  /**
   * Add a single user to the election voter allowlist.
   */
  async addVoter(electionId: string, userId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
      .from('election_voters')
      .insert({
        election_id: electionId,
        user_id: userId,
        added_by: user.id,
      })

    if (error) throw error
  },

  /**
   * Remove a user from the election voter allowlist by registration row ID.
   */
  async removeVoter(voterId: string): Promise<void> {
    const { error } = await supabase
      .from('election_voters')
      .delete()
      .eq('id', voterId)

    if (error) throw error
  },

  /**
   * Add all members of the organization to the election voter allowlist.
   */
  async addAllOrgMembersToVoters(electionId: string, orgId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data: members, error: membersError } = await supabase
      .from('org_memberships')
      .select('user_id')
      .eq('organization_id', orgId)

    if (membersError) throw membersError
    if (!members || members.length === 0) return

    const insertRows = members.map(m => ({
      election_id: electionId,
      user_id: m.user_id,
      added_by: user.id,
    }))

    const { error } = await supabase
      .from('election_voters')
      .upsert(insertRows, { onConflict: 'election_id,user_id' })

    if (error) throw error
  },

  /**
   * Check if the current authenticated user is eligible to vote in this election.
   * Checks both explicit 'election_voters' allowlist and approved organization membership.
   */
  async checkEligibility(electionId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const election = await this.getById(electionId)
    if (!election) return false

    // 1. Direct allowlist check: if explicitly approved on election_voters
    const { data: voter } = await supabase
      .from('election_voters')
      .select('id, status')
      .eq('election_id', electionId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (voter) {
      const vStatus = (voter as any).status
      if (!vStatus || vStatus === 'approved') return true
    }

    // 2. Organization-wide eligibility check:
    // If is_active_eligibility is 'entire_org' (or default null/undefined), any approved member of host org is eligible
    const isEntireOrg = !election.is_active_eligibility || election.is_active_eligibility === 'entire_org'
    if (isEntireOrg) {
      const orgId = election.org_id || (election as any).organization_id
      if (orgId) {
        const { data: member } = await supabase
          .from('org_memberships')
          .select('role, status')
          .eq('organization_id', orgId)
          .eq('user_id', user.id)
          .maybeSingle()

        // Eligible if member exists and is approved (NOT pending or rejected)
        if (member) {
          const status = (member as any).status
          if (!status || status === 'approved') {
            return true
          }
        }
      }
    }

    return false
  },

  /**
   * Returns granular eligibility information for UX banners and action triggers.
   */
  async getDetailedEligibility(electionId: string): Promise<{
    isEligible: boolean
    status: 'eligible' | 'pending_election_request' | 'pending_org_membership' | 'rejected_org' | 'rejected_election' | 'not_member' | 'not_allowlisted'
    orgId: string | null
    orgName?: string
  }> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { isEligible: false, status: 'not_member', orgId: null }
    }

    const { data: election } = await supabase
      .from('elections')
      .select('id, org_id, is_active_eligibility, organization:organizations(name)')
      .eq('id', electionId)
      .maybeSingle()

    if (!election) {
      return { isEligible: false, status: 'not_member', orgId: null }
    }

    const orgId = election.org_id
    const orgName = (election.organization as any)?.name ?? 'Organization'

    // 1. Check election_voters row
    const { data: voter } = await supabase
      .from('election_voters')
      .select('id, status')
      .eq('election_id', electionId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (voter) {
      const vStatus = (voter as any).status
      if (!vStatus || vStatus === 'approved') {
        return { isEligible: true, status: 'eligible', orgId, orgName }
      }
      if (vStatus === 'pending') {
        return { isEligible: false, status: 'pending_election_request', orgId, orgName }
      }
      if (vStatus === 'rejected') {
        return { isEligible: false, status: 'rejected_election', orgId, orgName }
      }
    }

    // 2. Check org membership
    if (orgId) {
      const { data: member } = await supabase
        .from('org_memberships')
        .select('role, status')
        .eq('organization_id', orgId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (member) {
        const mStatus = (member as any).status
        if (mStatus === 'pending') {
          return { isEligible: false, status: 'pending_org_membership', orgId, orgName }
        }
        if (mStatus === 'rejected') {
          return { isEligible: false, status: 'rejected_org', orgId, orgName }
        }
        if (!mStatus || mStatus === 'approved') {
          const isEntireOrg = !election.is_active_eligibility || election.is_active_eligibility === 'entire_org'
          if (isEntireOrg) {
            return { isEligible: true, status: 'eligible', orgId, orgName }
          }
          return { isEligible: false, status: 'not_allowlisted', orgId, orgName }
        }
      }
    }

    return { isEligible: false, status: 'not_member', orgId, orgName }
  },

  /**
   * Voter requests participation access to a specific election.
   */
  async requestElectionAccess(electionId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('You must be signed in to request election access.')

    const { data: existing } = await supabase
      .from('election_voters')
      .select('id, status')
      .eq('election_id', electionId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      if ((existing as any).status === 'pending') {
        throw new Error('Your request to participate in this election is already pending review.')
      }
      if ((existing as any).status === 'approved') {
        throw new Error('You are already an approved voter for this election.')
      }
      // Re-apply if rejected
      const { error: reapplyErr } = await supabase
        .from('election_voters')
        .update({ status: 'pending', updated_at: new Date().toISOString() })
        .eq('id', existing.id)

      if (reapplyErr) throw reapplyErr
      return
    }

    const { error } = await supabase
      .from('election_voters')
      .insert({
        election_id: electionId,
        user_id: user.id,
        status: 'pending',
      })

    if (error) throw error
  },

  /**
   * List all voter registrations/requests for an election with profile information.
   */
  async getElectionVoters(electionId: string): Promise<{
    id: string
    election_id: string
    user_id: string
    status: 'pending' | 'approved' | 'rejected'
    added_at: string
    created_at?: string
    user_profile: {
      id?: string
      full_name: string | null
      email?: string | null
      avatar_url: string | null
      wallet_address: string | null
    } | null
  }[]> {
    const { data, error } = await supabase
      .from('election_voters')
      .select('id, election_id, user_id, status, added_at, created_at, user_profile:user_profiles(id, full_name, email, avatar_url, wallet_address)')
      .eq('election_id', electionId)
      .order('added_at', { ascending: false })

    if (error) throw error
    return (data ?? []).map((v: any) => ({
      ...v,
      status: v.status || 'approved',
    }))
  },

  /**
   * Approve a voter for a specific election.
   */
  async approveElectionVoter(electionId: string, userId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
      .from('election_voters')
      .upsert({
        election_id: electionId,
        user_id: userId,
        status: 'approved',
        added_by: user.id,
      }, { onConflict: 'election_id,user_id' })

    if (error) throw error
  },

  /**
   * Reject a voter's participation request for a specific election.
   */
  async rejectElectionVoter(electionId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('election_voters')
      .update({ status: 'rejected' })
      .eq('election_id', electionId)
      .eq('user_id', userId)

    if (error) throw error
  },
}

