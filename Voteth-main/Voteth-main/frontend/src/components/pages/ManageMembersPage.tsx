import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { organizationService } from '@/services/organizationService'
import { supabase } from '@services/supabase/client'
import { toast } from 'sonner'
import type { OrgRole } from '@/types/domain'
import { 
  UserPlus, Search, User, Check, X, 
  Trash2, AlertTriangle, Shield, CheckCircle2, Clock, Mail, RefreshCw, AlertCircle, Building2
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MemberStatus = 'pending' | 'approved' | 'rejected'

export interface MemberDisplay {
  user_id: string
  organization_id: string
  role: OrgRole
  status: MemberStatus
  joined_at: string
  created_at?: string | undefined
  full_name: string | null
  email: string | null
  avatar_url: string | null
  wallet_address: string | null
}

type TabType = 'pending' | 'approved' | 'rejected'

// ---------------------------------------------------------------------------
// Page Component
// Requirement: ORG-03, ORG-04, ORG-05, ORG-06
// ---------------------------------------------------------------------------

export function ManageMembersPage() {
  const { activeMembership, memberships, switchOrganization } = useAuth()
  const queryClient = useQueryClient()

  // Fall back to any available admin membership if active is not yet set
  const adminMemberships = memberships.filter(m => m.role === 'admin')
  const effectiveMembership = activeMembership || adminMemberships[0] || memberships[0] || null
  const orgId = effectiveMembership?.org_id ?? ''
  const orgName = effectiveMembership?.organization?.name ?? 'Organization'
  const isAdmin = effectiveMembership?.role === 'admin'

  useEffect(() => {
    if (!activeMembership && effectiveMembership) {
      switchOrganization(effectiveMembership.org_id)
    }
  }, [activeMembership, effectiveMembership, switchOrganization])

  // Real-time synchronization: live updates when voters request or are updated
  useEffect(() => {
    if (!orgId) return

    const channel = supabase
      .channel(`org-members-live-${orgId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'org_memberships', filter: `organization_id=eq.${orgId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['org-members', orgId] })
          queryClient.invalidateQueries({ queryKey: ['admin-member-count', orgId] })
        }
      )
      .subscribe()

    return () => {
      if (channel && typeof channel.unsubscribe === 'function') {
        channel.unsubscribe()
      }
    }
  }, [orgId, queryClient])

  // Tab State: default to pending if any pending requests exist, otherwise approved
  const [activeTab, setActiveTab] = useState<TabType>('pending')

  // Search & Invite State
  const [searchTerm, setSearchTerm] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<OrgRole>('viewer')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)

  // Confirmation Modal State
  const [memberToRemove, setMemberToRemove] = useState<MemberDisplay | null>(null)

  // Fetch real members from database
  const { 
    data: members, 
    isLoading, 
    error: membersError, 
    refetch: refetchMembers 
  } = useQuery({
    queryKey: ['org-members', orgId],
    queryFn: async () => {
      if (!orgId) return []
      const raw = await organizationService.getMembers(orgId)
      return raw.map((m): MemberDisplay => ({
        user_id: m.user_id,
        organization_id: m.organization_id,
        role: m.role as OrgRole,
        status: (m.status as MemberStatus) || 'approved',
        joined_at: m.joined_at,
        created_at: m.created_at || m.user_profile?.created_at,
        full_name: m.user_profile?.full_name ?? null,
        email: m.user_profile?.email ?? null,
        avatar_url: m.user_profile?.avatar_url ?? null,
        wallet_address: m.user_profile?.wallet_address ?? null,
      }))
    },
    enabled: !!orgId,
  })

  // Accept / Approve voter mutation
  const approveMutation = useMutation({
    mutationFn: async (userId: string) => {
      await organizationService.approveMember(orgId, userId)
    },
    onSuccess: () => {
      toast.success('Voter approved successfully.')
      queryClient.invalidateQueries({ queryKey: ['org-members', orgId] })
      queryClient.invalidateQueries({ queryKey: ['admin-member-count', orgId] })
      queryClient.invalidateQueries({ queryKey: ['voter-dashboard-elections'] })
      queryClient.invalidateQueries({ queryKey: ['isEligible'] })
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to approve voter.')
    },
  })

  // Reject voter mutation
  const rejectMutation = useMutation({
    mutationFn: async (userId: string) => {
      await organizationService.rejectMember(orgId, userId)
    },
    onSuccess: () => {
      toast.success('Voter request rejected.')
      queryClient.invalidateQueries({ queryKey: ['org-members', orgId] })
      queryClient.invalidateQueries({ queryKey: ['admin-member-count', orgId] })
      queryClient.invalidateQueries({ queryKey: ['voter-dashboard-elections'] })
      queryClient.invalidateQueries({ queryKey: ['isEligible'] })
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to reject voter request.')
    },
  })

  // Remove member mutation
  const removeMutation = useMutation({
    mutationFn: async (userId: string) => {
      await organizationService.removeMember(orgId, userId)
    },
    onSuccess: () => {
      toast.success('Member removed from organization.')
      setMemberToRemove(null)
      queryClient.invalidateQueries({ queryKey: ['org-members', orgId] })
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to remove member.')
    },
  })

  // Invite mutation
  const inviteMutation = useMutation({
    mutationFn: async () => {
      await organizationService.inviteMember({
        org_id: orgId,
        email: inviteEmail,
        role: inviteRole,
      })
    },
    onSuccess: () => {
      setInviteEmail('')
      setInviteError(null)
      setInviteSuccess(`Invitation sent to ${inviteEmail}`)
      toast.success(`Invitation sent to ${inviteEmail}`)
      queryClient.invalidateQueries({ queryKey: ['org-members', orgId] })
      setTimeout(() => setInviteSuccess(null), 4000)
    },
    onError: (err: Error) => {
      setInviteError(err.message)
      setInviteSuccess(null)
      toast.error(err.message)
    },
  })

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: OrgRole }) => {
      await organizationService.updateMemberRole(orgId, userId, newRole)
    },
    onSuccess: () => {
      toast.success('Member role updated.')
      queryClient.invalidateQueries({ queryKey: ['org-members', orgId] })
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update role.')
    },
  })

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) {
      setInviteError('Email is required')
      return
    }
    inviteMutation.mutate()
  }

  const roleOptions: OrgRole[] = ['admin', 'moderator', 'viewer']

  // Accurate counts derived strictly from real database records
  const pendingMembers = members?.filter(m => m.status === 'pending') ?? []
  const approvedMembers = members?.filter(m => m.status === 'approved') ?? []
  const rejectedMembers = members?.filter(m => m.status === 'rejected') ?? []

  // Active tab list with search filter applied
  const currentTabList = activeTab === 'pending'
    ? pendingMembers
    : activeTab === 'approved'
      ? approvedMembers
      : rejectedMembers

  const filteredMembers = currentTabList.filter(m => {
    const term = searchTerm.toLowerCase()
    return (
      (m.full_name ?? '').toLowerCase().includes(term) ||
      (m.email ?? '').toLowerCase().includes(term) ||
      (m.wallet_address ?? '').toLowerCase().includes(term)
    )
  })

  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-3xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
            <Link to="/organizer" className="hover:text-accent-400 transition-colors">
              Organizer Panel
            </Link>
            <span>/</span>
            <span className="text-neutral-300">Members & Voters</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-100 tracking-tight">
            Manage Members & Voter Approvals
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            Review voter registration requests, approve eligible voters for elections, and manage authorization tiers for{' '}
            <span className="text-accent-400 font-semibold">{orgName}</span>.
          </p>
        </div>

        {/* Organization Switcher if multiple orgs are available */}
        {memberships.length > 1 && (
          <div className="flex items-center gap-2 bg-brand-850 border border-brand-700/60 p-2 rounded-xl self-start sm:self-auto">
            <Building2 className="h-4 w-4 text-accent-400 shrink-0" />
            <select
              value={orgId}
              onChange={(e) => switchOrganization(e.target.value)}
              className="bg-brand-900 border border-brand-700 text-xs font-semibold text-neutral-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent-500 cursor-pointer"
            >
              {memberships.map((m) => (
                <option key={m.org_id} value={m.org_id}>
                  {m.organization?.name || m.org_id} ({m.role})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Database Error Banner */}
      {membersError && (
        <div className="p-4 rounded-xl bg-danger-950/40 border border-danger-800/60 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-danger-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-danger-300">Database Query Failed</h4>
              <p className="text-3xs text-danger-400/90 mt-0.5 leading-normal">
                {membersError.message || 'Unable to fetch members from Supabase.'}
              </p>
              {(membersError as any)?.hint && (
                <p className="text-3xs text-neutral-400 mt-1 font-mono">
                  Hint: {(membersError as any).hint}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => refetchMembers()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-danger-900/40 hover:bg-danger-900/60 text-danger-300 border border-danger-700 text-2xs font-semibold transition-colors shrink-0"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        </div>
      )}

      {/* Invite Teammate Form (Admins only) */}
      {isAdmin && (
        <section className="rounded-2xl bg-brand-850 border border-brand-700/60 p-6 shadow-xl">
          <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <UserPlus className="h-4.5 w-4.5 text-accent-500" />
            Invite teammate by Email
          </h2>
          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              placeholder="voter.or.colleague@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1 px-3 py-2 text-xs bg-brand-900 border border-brand-700 rounded-lg text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-accent-500 transition-colors"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as OrgRole)}
              className="px-3 py-2 text-xs bg-brand-900 border border-brand-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-accent-500 transition-colors cursor-pointer"
            >
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {role === 'viewer' ? 'Voter (Viewer)' : role.charAt(0).toUpperCase() + role.slice(1)}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={inviteMutation.isPending}
              className="px-5 py-2.5 rounded-lg bg-accent-600 hover:bg-accent-500 disabled:bg-brand-800 disabled:text-neutral-500 text-xs font-bold text-neutral-100 transition-all shadow-md shadow-accent-600/10 whitespace-nowrap"
            >
              {inviteMutation.isPending ? 'Sending...' : 'Send Invitation'}
            </button>
          </form>
          {inviteError && (
            <p className="text-3xs text-danger-400 mt-2 flex items-center gap-1">
              <span>⚠</span> {inviteError}
            </p>
          )}
          {inviteSuccess && (
            <p className="text-3xs text-success-400 mt-2 flex items-center gap-1 font-semibold">
              <Check className="h-3 w-3" /> {inviteSuccess}
            </p>
          )}
        </section>
      )}

      {/* Tabs & Search Bar */}
      <section className="flex flex-col gap-4">
        {/* Navigation Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-700/60 pb-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === 'pending'
                  ? 'bg-warning-500/15 text-warning-400 border border-warning-500/30'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-brand-800/60'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Pending Requests</span>
              <span className={`px-2 py-0.5 rounded-full text-3xs font-extrabold ${
                pendingMembers.length > 0 
                  ? 'bg-warning-500/20 text-warning-300 border border-warning-500/40' 
                  : 'bg-brand-900 text-neutral-500'
              }`}>
                {pendingMembers.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('approved')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === 'approved'
                  ? 'bg-accent-500/15 text-accent-400 border border-accent-500/30'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-brand-800/60'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Approved Voters</span>
              <span className="px-2 py-0.5 rounded-full text-3xs font-extrabold bg-brand-900 text-neutral-300 border border-brand-700">
                {approvedMembers.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('rejected')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === 'rejected'
                  ? 'bg-danger-500/15 text-danger-400 border border-danger-500/30'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-brand-800/60'
              }`}
            >
              <X className="h-3.5 w-3.5" />
              <span>Removed / Rejected</span>
              <span className="px-2 py-0.5 rounded-full text-3xs font-extrabold bg-brand-900 text-neutral-500">
                {rejectedMembers.length}
              </span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-500" />
            <input 
              type="text" 
              placeholder="Search by name, email, or wallet..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-lg bg-brand-850 border border-brand-700 text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-accent-500 transition-all"
            />
          </div>
        </div>

        {/* Member / Voter Cards Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-xl bg-brand-850 border border-brand-700/60 animate-pulse"
              />
            ))}
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-brand-700/60 bg-brand-850/40 py-14 px-6 text-center">
            <div className="p-3.5 bg-brand-900 border border-brand-700/60 rounded-xl mb-3 text-neutral-500">
              <User className="h-6 w-6" />
            </div>
            <h3 className="text-xs font-bold text-neutral-200 mb-1">
              {activeTab === 'pending' 
                ? 'No pending voter requests' 
                : activeTab === 'approved' 
                  ? 'No approved members found' 
                  : 'No removed or rejected requests'}
            </h3>
            <p className="text-3xs text-neutral-500 max-w-sm leading-relaxed">
              {activeTab === 'pending'
                ? 'When voters register and request access to your organization, their requests will appear here for your review and approval.'
                : activeTab === 'approved'
                  ? 'Use the invite form above or approve pending voter requests to enroll members into your organization.'
                  : 'No member records have been rejected or removed.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredMembers.map((member) => (
              <VoterMemberCard
                key={member.user_id}
                member={member}
                isAdmin={isAdmin}
                roleOptions={roleOptions}
                isApprovePending={approveMutation.isPending}
                isRejectPending={rejectMutation.isPending}
                onApprove={() => approveMutation.mutate(member.user_id)}
                onReject={() => rejectMutation.mutate(member.user_id)}
                onRequestRemove={() => setMemberToRemove(member)}
                onUpdateRole={(newRole) =>
                  updateRoleMutation.mutate({
                    userId: member.user_id,
                    newRole,
                  })
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* Confirmation Modal for Member Removal */}
      {memberToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-brand-850 border border-brand-700 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3 text-danger-400">
              <div className="p-2.5 rounded-xl bg-danger-950/60 border border-danger-900/80">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-100">
                  Remove Voter from Organization
                </h3>
                <p className="text-3xs text-neutral-400">
                  Confirmation required for access revocation
                </p>
              </div>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              Are you sure you want to remove{' '}
              <span className="font-bold text-neutral-100">
                {memberToRemove.full_name || memberToRemove.email || 'this voter'}
              </span>{' '}
              from <span className="font-semibold text-accent-400">{orgName}</span>?
            </p>

            <div className="p-3 rounded-lg bg-brand-900 border border-brand-700/60 text-3xs text-neutral-400 leading-normal">
              <p>• They will be removed from all active election allowlists for this organization.</p>
              <p>• They will no longer be eligible to cast votes in {orgName} ballots.</p>
              <p>• Their global account, profile, and previous voting receipts will NOT be deleted.</p>
            </div>

            <div className="flex items-center justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={() => setMemberToRemove(null)}
                className="px-4 py-2 rounded-lg bg-brand-800 hover:bg-brand-750 text-xs font-semibold text-neutral-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => removeMutation.mutate(memberToRemove.user_id)}
                disabled={removeMutation.isPending}
                className="px-4 py-2 rounded-lg bg-danger-600 hover:bg-danger-500 disabled:bg-danger-900 text-xs font-bold text-white transition-all shadow-md shadow-danger-600/20"
              >
                {removeMutation.isPending ? 'Removing...' : 'Confirm Removal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Voter Member Card Component
// ---------------------------------------------------------------------------

function VoterMemberCard({
  member,
  isAdmin,
  roleOptions,
  isApprovePending,
  isRejectPending,
  onApprove,
  onReject,
  onRequestRemove,
  onUpdateRole,
}: {
  member: MemberDisplay
  isAdmin: boolean
  roleOptions: OrgRole[]
  isApprovePending: boolean
  isRejectPending: boolean
  onApprove: () => void
  onReject: () => void
  onRequestRemove: () => void
  onUpdateRole: (newRole: OrgRole) => void
}) {
  const roleColors: Record<OrgRole, string> = {
    admin: 'bg-accent-950 text-accent-400 border border-accent-900/60',
    moderator: 'bg-brand-900 text-neutral-300 border border-brand-700/40',
    viewer: 'bg-neutral-850 text-neutral-400 border border-neutral-800',
  }

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A'
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="rounded-xl bg-brand-850 border border-brand-700/60 p-4.5 flex flex-col justify-between gap-3.5 hover:border-accent-600/40 transition-colors">
      <div className="flex items-start justify-between gap-3">
        {/* User Info block */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-brand-900 border border-brand-700 flex items-center justify-center text-xs font-bold text-neutral-400 shrink-0 overflow-hidden">
            {member.avatar_url ? (
              <img src={member.avatar_url} alt={member.full_name || 'Member'} className="w-full h-full object-cover" />
            ) : (
              member.full_name?.slice(0, 2).toUpperCase() || member.email?.slice(0, 2).toUpperCase() || '?'
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-neutral-100 truncate">
              {member.full_name ?? member.email?.split('@')[0] ?? 'Anonymous Voter'}
            </span>
            {member.email && (
              <span className="text-[10px] text-neutral-400 truncate flex items-center gap-1 mt-0.5">
                <Mail className="h-2.5 w-2.5 text-neutral-500 shrink-0" />
                {member.email}
              </span>
            )}
            {member.wallet_address ? (
              <span className="text-[10px] text-accent-400/80 font-mono mt-0.5 truncate">
                {formatAddress(member.wallet_address)}
              </span>
            ) : (
              <span className="text-[10px] text-neutral-600 mt-0.5">
                No wallet linked
              </span>
            )}
          </div>
        </div>

        {/* Status / Role Badges */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {member.status === 'pending' ? (
            <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-warning-950 text-warning-400 border border-warning-800/60 flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              Pending
            </span>
          ) : member.status === 'rejected' ? (
            <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-danger-950 text-danger-400 border border-danger-800/60">
              Rejected
            </span>
          ) : (
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${roleColors[member.role]}`}>
              {member.role === 'viewer' ? 'Voter' : member.role}
            </span>
          )}

          <span className="text-[9px] text-neutral-500">
            {member.status === 'pending' ? 'Requested: ' : 'Joined: '}
            {formatDate(member.joined_at || member.created_at)}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-3 border-t border-brand-700/30 flex items-center justify-between gap-2 mt-auto">
        {member.status === 'pending' && isAdmin ? (
          <div className="flex items-center justify-end gap-2 w-full">
            <button
              type="button"
              onClick={onReject}
              disabled={isRejectPending}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-2xs font-semibold text-danger-400 hover:text-danger-200 bg-danger-950/20 border border-danger-900/60 transition-colors"
            >
              <X className="h-3 w-3" />
              Reject
            </button>
            <button
              type="button"
              onClick={onApprove}
              disabled={isApprovePending}
              className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-2xs font-bold text-white bg-success-600 hover:bg-success-500 border border-success-500 transition-colors shadow-sm shadow-success-600/20"
            >
              <Check className="h-3 w-3" />
              Accept
            </button>
          </div>
        ) : member.status === 'rejected' && isAdmin ? (
          <div className="flex items-center justify-end gap-2 w-full">
            <button
              type="button"
              onClick={onApprove}
              disabled={isApprovePending}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-2xs font-bold text-accent-300 hover:text-white bg-accent-950/40 border border-accent-800/60 transition-colors"
            >
              <Check className="h-3 w-3" />
              Re-Approve Voter
            </button>
          </div>
        ) : isAdmin ? (
          <div className="flex items-center justify-between gap-2 w-full">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <span className="text-[10px] text-neutral-500 font-semibold uppercase tracking-wider shrink-0">Role:</span>
              <select
                value={member.role}
                onChange={(e) => onUpdateRole(e.target.value as OrgRole)}
                className="max-w-[120px] px-2 py-1 text-2xs bg-brand-900 border border-brand-700 rounded-md text-neutral-200 focus:outline-none focus:ring-1 focus:ring-accent-500 transition-colors font-medium cursor-pointer"
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role === 'viewer' ? 'Voter' : role.charAt(0).toUpperCase() + role.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={onRequestRemove}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-2xs font-bold text-danger-400 hover:text-danger-200 bg-danger-950/20 border border-danger-900/60 transition-colors shrink-0"
              title="Remove voter"
            >
              <Trash2 className="h-3 w-3" />
              Remove
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[10px] text-neutral-500">
            <Shield className="h-3 w-3 text-neutral-600" />
            <span>Authorized by Organization Admin</span>
          </div>
        )}
      </div>
    </div>
  )
}
