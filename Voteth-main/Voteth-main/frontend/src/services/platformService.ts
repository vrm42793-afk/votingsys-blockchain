import { supabase } from '@services/supabase/client'
import { UserProfile, Organization, Election, AuditLog } from '@/types/domain'

export interface PlatformStats {
  totalOrgs: number
  totalOrganizers: number
  totalVoters: number
  totalElections: number
  activeElections: number
  totalVotes: number
  recentLogs: AuditLog[]
  electionsThisMonth: number
  votesToday: number
  averageTurnout: number
  failedTransactions: number
  pendingInvitations: number
}

export interface ExtendedOrganization extends Organization {
  member_count: number
  election_count: number
  is_active: boolean
  owner?: {
    full_name: string | null
    email: string
  } | null
}

export interface ExtendedOrganizer {
  profile: UserProfile
  org_name: string | null
  election_count: number
}

export const platformService = {
  /**
   * Fetches high level system stats for the Platform Owner Dashboard
   */
  async getDashboardStats(): Promise<PlatformStats> {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
    const startOfToday = new Date(new Date().setHours(0,0,0,0)).toISOString()

    const [
      orgsRes,
      usersRes,
      electionsRes,
      votesRes,
      logsRes,
      electionsMonthRes,
      votesTodayRes,
      failedVotesRes,
      invitesRes
    ] = await Promise.all([
      supabase.from('organizations').select('id', { count: 'exact', head: true }),
      supabase.from('user_profiles').select('id, platform_role'),
      supabase.from('elections').select('id, status'),
      supabase.from('votes').select('id', { count: 'exact', head: true }),
      supabase.from('audit_logs').select('*, organization:organizations(name)').order('created_at', { ascending: false }).limit(8),
      supabase.from('elections').select('id', { count: 'exact', head: true }).gte('created_at', startOfMonth),
      supabase.from('votes').select('id', { count: 'exact', head: true }).gte('created_at', startOfToday),
      supabase.from('votes').select('id', { count: 'exact', head: true }).eq('is_chain_confirmed', false),
      supabase.from('org_invitations').select('id', { count: 'exact', head: true }).eq('status', 'pending')
    ])

    if (orgsRes.error) throw orgsRes.error
    if (usersRes.error) throw usersRes.error
    if (electionsRes.error) throw electionsRes.error
    if (votesRes.error) throw votesRes.error
    if (logsRes.error) throw logsRes.error
    if (electionsMonthRes.error) throw electionsMonthRes.error
    if (votesTodayRes.error) throw votesTodayRes.error
    if (failedVotesRes.error) throw failedVotesRes.error
    if (invitesRes.error) throw invitesRes.error

    const users = usersRes.data ?? []
    const elections = electionsRes.data ?? []
    const totalVoters = users.filter(u => u.platform_role === 'voter').length
    const totalVotes = votesRes.count ?? 0

    // Average turnout calculation: (Total Votes / Total Voters) * 100
    const averageTurnout = totalVoters > 0 ? Math.round((totalVotes / totalVoters) * 100) : 0

    return {
      totalOrgs: orgsRes.count ?? 0,
      totalOrganizers: users.filter(u => u.platform_role === 'organizer').length,
      totalVoters,
      totalElections: elections.length,
      activeElections: elections.filter(e => e.status === 'open').length,
      totalVotes,
      recentLogs: logsRes.data as unknown as AuditLog[],
      electionsThisMonth: electionsMonthRes.count ?? 0,
      votesToday: votesTodayRes.count ?? 0,
      averageTurnout: Math.min(averageTurnout, 100), // Cap at 100% just in case of testing anomalies
      failedTransactions: failedVotesRes.count ?? 0,
      pendingInvitations: invitesRes.count ?? 0
    }
  },

  /**
   * Fetches all organizations along with owner profiles and statistics
   */
  async getOrganizations(): Promise<ExtendedOrganization[]> {
    const { data: orgs, error } = await supabase
      .from('organizations')
      .select('*, owner:owner_id(full_name, email)')

    if (error) throw error

    // Fetch counts manually to circumvent heavy DB functions
    const [membersRes, electionsRes] = await Promise.all([
      supabase.from('org_memberships').select('organization_id'),
      supabase.from('elections').select('org_id')
    ])

    const members = membersRes.data ?? []
    const elections = electionsRes.data ?? []

    return (orgs ?? []).map(org => {
      const orgMembers = members.filter(m => m.organization_id === org.id)
      const orgElections = elections.filter(e => e.org_id === org.id)
      return {
        ...org,
        member_count: orgMembers.length,
        election_count: orgElections.length,
        is_active: org.is_active ?? true,
        owner: org.owner ? {
          full_name: (org.owner as unknown as { full_name: string | null }).full_name,
          email: (org.owner as unknown as { email: string }).email
        } : null
      }
    })
  },

  /**
   * Toggles an organization's active/suspended status
   */
  async updateOrganizationStatus(orgId: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('organizations')
      .update({ is_active: isActive })
      .eq('id', orgId)

    if (error) throw error

    // Log the event
    await supabase.from('audit_logs').insert({
      action: isActive ? 'ORGANIZATION_REACTIVATE' : 'ORGANIZATION_SUSPEND',
      target_id: orgId,
      metadata: { org_id: orgId }
    })
  },

  /**
   * Deletes an organization and logs the action
   */
  async deleteOrganization(orgId: string): Promise<void> {
    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', orgId)

    if (error) throw error

    // Log the event
    await supabase.from('audit_logs').insert({
      action: 'ORGANIZATION_DELETE',
      target_id: orgId,
      metadata: { org_id: orgId }
    })
  },

  /**
   * Fetches all user profiles
   */
  async getUsers(): Promise<UserProfile[]> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data as UserProfile[]
  },

  /**
   * Updates user platform role with checks to prevent demoting final owner
   */
  async updateUserRole(userId: string, newRole: 'owner' | 'organizer' | 'voter'): Promise<void> {
    // 1. Fetch current profile
    const { data: currentProfile, error: fetchErr } = await supabase
      .from('user_profiles')
      .select('platform_role, email')
      .eq('id', userId)
      .single()

    if (fetchErr) throw fetchErr

    // 2. Safeguard: Prevent self-demotion or owner demotion if it's the last owner
    if (currentProfile.platform_role === 'owner' && newRole !== 'owner') {
      const { data: owners, error: ownersErr } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('platform_role', 'owner')

      if (ownersErr) throw ownersErr
      if ((owners ?? []).length <= 1) {
        throw new Error('Platform protection safeguard: There must be at least one Platform Owner.')
      }
    }

    // 3. Perform update
    const { error } = await supabase
      .from('user_profiles')
      .update({ platform_role: newRole })
      .eq('id', userId)

    if (error) throw error

    // Log the event
    await supabase.from('audit_logs').insert({
      action: 'USER_ROLE_CHANGE',
      target_id: userId,
      metadata: { target_email: currentProfile.email, new_role: newRole }
    })
  },

  /**
   * Suspends or reactivates a user profile
   */
  async updateUserSuspension(userId: string, isSuspended: boolean): Promise<void> {
    const { data: currentProfile, error: fetchErr } = await supabase
      .from('user_profiles')
      .select('platform_role, email')
      .eq('id', userId)
      .single()

    if (fetchErr) throw fetchErr

    // Safeguard: Owner accounts cannot be suspended
    if (currentProfile.platform_role === 'owner') {
      throw new Error('Platform protection safeguard: Owner accounts cannot be suspended.')
    }

    const { error } = await supabase
      .from('user_profiles')
      .update({ is_suspended: isSuspended })
      .eq('id', userId)

    if (error) throw error

    // Log the event
    await supabase.from('audit_logs').insert({
      action: isSuspended ? 'USER_SUSPEND' : 'USER_REACTIVATE',
      target_id: userId,
      metadata: { target_email: currentProfile.email }
    })
  },

  /**
   * Fetches every election across the entire platform
   */
  async getElections(): Promise<Array<Election & { organization: { name: string } }>> {
    const { data, error } = await supabase
      .from('elections')
      .select('*, organization:organizations(name)')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data as unknown as Array<Election & { organization: { name: string } }>
  },

  /**
   * Fetches recent audit logs across the platform
   */
  async getAuditLogs(): Promise<AuditLog[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*, organization:organizations(name)')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data as unknown as AuditLog[]
  }
}
