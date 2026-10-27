import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@services/supabase/client'
import { organizationService } from '@/services/organizationService'
import { Link, useNavigate } from 'react-router-dom'
import { useWallet } from '@/contexts/WalletContext'
import { toast } from 'sonner'
import { 
  Calendar, Vote, FolderOpen, Receipt, 
  ChevronRight, Wallet, FileText, Activity, ShieldCheck, ArrowRight,
  Clock, CheckCircle2, AlertCircle, Building2
} from 'lucide-react'

export interface VoterElectionItem {
  id: string
  title: string
  status: string
  start_date: string
  end_date: string
  org_id?: string
  org_name?: string
}

export function DashboardPage() {
  const { 
    profile, 
    activeMembership, 
    memberships, 
    isOrganizer, 
    isPlatformOwner, 
    user,
    refreshProfile
  } = useAuth()
  const { isConnected, connect } = useWallet()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const orgId = activeMembership?.org_id ?? null
  const orgName = activeMembership?.organization?.name ?? 'Community Ballots'
  const isOwner = isPlatformOwner

  // Fetch available organizations for voter access discovery
  const { data: availableOrgs } = useQuery({
    queryKey: ['available-organizations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, slug, description')
        .order('name', { ascending: true })
      if (error) return []
      return (data || []) as { id: string; name: string; slug: string; description: string | null }[]
    },
  })

  // Request membership mutation
  const requestAccessMutation = useMutation({
    mutationFn: async (targetOrgId: string) => {
      await organizationService.requestMembership(targetOrgId)
    },
    onSuccess: () => {
      toast.success('Access request submitted! Awaiting organizer approval.')
      if (refreshProfile) refreshProfile()
      queryClient.invalidateQueries({ queryKey: ['voter-dashboard-elections'] })
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to request membership.')
    },
  })

  // Fetch elections scoped to the user's active org (or all available open/published across orgs)
  const { 
    data: elections, 
    isLoading: electionsLoading,
    error: electionsError,
    refetch: refetchElections
  } = useQuery<VoterElectionItem[]>({
    queryKey: ['voter-dashboard-elections', orgId, user?.id],
    queryFn: async () => {
      let query = supabase
        .from('elections')
        .select(`
          id, title, status, start_date, end_date, org_id,
          organization:organizations(name)
        `)
        .order('start_date', { ascending: false })
        .limit(10)

      if (orgId) {
        query = query.eq('org_id', orgId)
      } else {
        query = query.in('status', ['open', 'published', 'closed'])
      }

      const { data, error } = await query
      if (error) {
        console.error('[DashboardPage] Error fetching elections for voter:', error)
        throw error
      }

      return (data || []).map((e: any) => ({
        id: e.id,
        title: e.title,
        status: e.status,
        start_date: e.start_date,
        end_date: e.end_date,
        org_id: e.org_id,
        org_name: e.organization?.name ?? 'Community Election',
      }))
    },
  })

  // Real-time synchronization: refresh elections and membership status whenever changes occur
  useEffect(() => {
    const channel = supabase
      .channel('voter-dashboard-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'elections' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['voter-dashboard-elections'] })
        }
      )
      .subscribe()

    let memChannel: any = null
    if (user?.id) {
      memChannel = supabase
        .channel(`voter-memberships-${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'org_memberships', filter: `user_id=eq.${user.id}` },
          () => {
            if (refreshProfile) refreshProfile()
            queryClient.invalidateQueries({ queryKey: ['voter-dashboard-elections'] })
          }
        )
        .subscribe()
    }

    return () => {
      if (channel && typeof channel.unsubscribe === 'function') {
        channel.unsubscribe()
      }
      if (memChannel && typeof memChannel.unsubscribe === 'function') {
        memChannel.unsubscribe()
      }
    }
  }, [queryClient, user?.id, refreshProfile])

  // Fetch receipts count for this user
  const { data: receiptsCount } = useQuery({
    queryKey: ['voter-receipts-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0
      const { count, error } = await supabase
        .from('votes')
        .select('*', { count: 'exact', head: true })
        .eq('voter_id', user.id)
      if (error) throw error
      return count ?? 0
    },
    enabled: !!user?.id,
  })

  // Only intercept organizers and platform owners who do not have an active organization
  if (!activeMembership) {
    if (isOwner) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="glass-card max-w-md p-8 text-center border border-brand-700 bg-brand-850 rounded-2xl shadow-xl flex flex-col items-center gap-4 animate-scale-in">
            <div className="text-accent-400 text-5xl">👑</div>
            <h1 className="text-2xl font-bold text-neutral-100 tracking-tight">Platform Owner Session</h1>
            <p className="text-sm text-neutral-400 leading-relaxed">
              You are signed in as the Platform Owner. Oversee global system parameters, monitor active node health, and audit organizations.
            </p>
            <Link
              to="/admin"
              className="mt-2 w-full py-3 px-4 rounded-lg bg-accent-600 hover:bg-accent-500 text-sm font-semibold text-neutral-100 transition-all shadow-md shadow-accent-600/20 text-center"
            >
              Enter Platform Owner Dashboard
            </Link>
          </div>
        </div>
      )
    }

    if (isOrganizer) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="glass-card max-w-md p-8 text-center border border-brand-700 bg-brand-850 rounded-2xl shadow-xl flex flex-col items-center gap-4">
            <div className="text-accent-400 text-5xl">🏛️</div>
            <h1 className="text-2xl font-bold text-neutral-100 tracking-tight">No Active Organization</h1>
            <p className="text-sm text-neutral-400 leading-relaxed">
              You are recognized as an Organizer. Create your organization workspace to configure ballots, invite members, and administer elections.
            </p>
            <div className="flex flex-col gap-2.5 w-full mt-2">
              <Link
                to="/organizations/new"
                className="w-full py-3 px-4 rounded-lg bg-accent-600 hover:bg-accent-500 text-sm font-semibold text-neutral-100 transition-all shadow-md shadow-accent-600/20 text-center"
              >
                Create Organization
              </Link>
              <Link
                to="/organizer"
                className="w-full py-2.5 px-4 rounded-lg bg-brand-800 border border-brand-700 hover:bg-brand-750 text-sm font-semibold text-neutral-300 text-center"
              >
                Go to Organizer Panel
              </Link>
            </div>
          </div>
        </div>
      )
    }
    // Voters without an explicit active membership proceed to view all community ballots
  }

  const activeElectionsCount = elections?.filter(e => e.status === 'open').length ?? 0

  return (
    <div className="flex flex-col gap-8">
      {/* Organizer / Owner Context Banner if viewing Voter Dashboard */}
      {(isOrganizer || isOwner) && (
        <div className="p-4 rounded-xl bg-accent-950/40 border border-accent-800/60 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">🏛️</span>
            <div>
              <div className="text-xs font-bold text-neutral-200">
                You are currently viewing the Voter Portal.
              </div>
              <div className="text-3xs text-neutral-400">
                To manage ballots, candidate profiles, and voter allowlists, navigate to your management panel.
              </div>
            </div>
          </div>
          <Link
            to={isOwner ? '/admin' : '/organizer'}
            className="px-3.5 py-1.5 rounded-lg bg-accent-600 hover:bg-accent-500 text-2xs font-bold text-neutral-100 shrink-0 flex items-center gap-1"
          >
            {isOwner ? 'Platform Admin' : 'Organizer Panel'}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {/* Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-100 tracking-tight flex items-center gap-2">
            Hello {profile?.full_name?.split(' ')[0] ?? 'Voter'} 👋
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            Manage your ballot, track voting receipts, and explore governance at{' '}
            <span className="text-accent-400 font-semibold">{orgName}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 text-2xs font-bold uppercase tracking-wider text-neutral-400 bg-brand-850 border border-brand-700/60 px-3 py-1.5 rounded-lg self-start sm:self-auto">
          <ShieldCheck className="h-4 w-4 text-success-500" />
          <span>Role: {profile?.platform_role ?? 'voter'}</span>
        </div>
      </div>

      {/* Voter Approval & Membership Status Banner */}
      {activeMembership?.status === 'pending' ? (
        <div className="p-4 rounded-xl bg-warning-950/40 border border-warning-900/60 flex items-start gap-3.5">
          <Clock className="h-5 w-5 text-warning-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-warning-300 uppercase tracking-wider">
                Voter Registration Pending Approval
              </h3>
              <span className="px-2 py-0.5 rounded-full text-3xs font-extrabold bg-warning-500/20 text-warning-400 border border-warning-500/40">
                Awaiting Organizer
              </span>
            </div>
            <p className="text-3xs text-neutral-300 mt-1 leading-normal">
              Your registration request for <span className="font-semibold text-accent-400">{orgName}</span> is awaiting review by an organization administrator. Once accepted, you will be authorized to cast votes in active elections.
            </p>
          </div>
        </div>
      ) : activeMembership?.status === 'rejected' ? (
        <div className="p-4 rounded-xl bg-danger-950/40 border border-danger-900/60 flex items-start gap-3.5">
          <AlertCircle className="h-5 w-5 text-danger-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-xs font-bold text-danger-300 uppercase tracking-wider">
              Membership Request Declined
            </h3>
            <p className="text-3xs text-neutral-400 mt-1 leading-normal">
              Your request to join <span className="font-semibold text-neutral-200">{orgName}</span> was not approved. You can request access to another organization or participate in open community ballots.
            </p>
          </div>
        </div>
      ) : activeMembership ? (
        <div className="p-3.5 rounded-xl bg-brand-850 border border-brand-700/60 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success-500/10 border border-success-500/20 text-success-400 shrink-0">
              <CheckCircle2 className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="text-xs font-bold text-neutral-200 flex items-center gap-2">
                <span>Approved Member of {orgName}</span>
                <span className="px-2 py-0.5 rounded-full text-3xs font-semibold bg-success-950 text-success-400 border border-success-800">
                  Authorized
                </span>
              </div>
              <p className="text-3xs text-neutral-400 mt-0.5">
                You are registered on the eligible voter roster and authorized to participate in {orgName} ballots.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-brand-850 border border-brand-700/60 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-accent-500/10 border border-accent-500/20 text-accent-400 shrink-0">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-neutral-200">
                  Request Organization Voter Access
                </h3>
                <p className="text-3xs text-neutral-400 mt-0.5">
                  You are currently browsing open community ballots. To vote in institutional ballots, request access to your organization below.
                </p>
              </div>
            </div>
          </div>
          {availableOrgs && availableOrgs.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-brand-700/40">
              {availableOrgs.slice(0, 4).map((org) => {
                const existingMem = memberships.find(m => m.org_id === org.id)
                const isPending = existingMem?.status === 'pending'
                const isApproved = existingMem?.status === 'approved'
                const isRejected = existingMem?.status === 'rejected'

                return (
                  <div key={org.id} className="flex items-center justify-between p-2.5 rounded-lg bg-brand-900 border border-brand-700/60">
                    <div className="min-w-0 pr-2">
                      <span className="text-xs font-semibold text-neutral-200 block truncate">{org.name}</span>
                      <span className="text-[10px] text-neutral-500 font-mono">/{org.slug}</span>
                    </div>

                    {isApproved ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-success-950 text-success-400 border border-success-800 shrink-0">
                        Approved Member
                      </span>
                    ) : isPending ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-warning-950 text-warning-400 border border-warning-800/60 flex items-center gap-1 shrink-0">
                        <Clock className="h-3 w-3" />
                        Pending Review
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => requestAccessMutation.mutate(org.id)}
                        disabled={requestAccessMutation.isPending}
                        className="px-2.5 py-1 text-3xs font-bold rounded bg-accent-600 hover:bg-accent-500 disabled:bg-brand-800 text-white transition-all shrink-0"
                      >
                        {isRejected ? 'Re-Apply' : 'Request Access'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Elections"
          value={activeElectionsCount}
          icon={Vote}
          color="text-success-400"
          bgColor="bg-success-500/10 border-success-950/40"
        />
        <StatCard
          label="Your Receipts"
          value={receiptsCount ?? 0}
          icon={Receipt}
          color="text-neutral-300"
          bgColor="bg-brand-800/80 border-brand-700/60"
        />
        <StatCard
          label="Available Ballots"
          value={elections?.length ?? 0}
          icon={Calendar}
          color="text-accent-400"
          bgColor="bg-accent-500/10 border-accent-950/40"
        />
        <StatCard
          label="Organizations"
          value={memberships.length}
          icon={FolderOpen}
          color="text-warning-400"
          bgColor="bg-warning-500/10 border-warning-950/40"
        />
      </div>

      {/* Quick Actions Panel */}
      <section className="bg-brand-850 border border-brand-700/60 rounded-2xl p-6">
        <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <QuickActionButton
            title="Cast a Vote"
            description="View active elections and cast your ballot"
            icon={Vote}
            onClick={() => navigate('/elections')}
            primary
          />
          <QuickActionButton
            title="My Receipts"
            description="Verify cryptographic ballot receipts"
            icon={Receipt}
            onClick={() => navigate('/my-votes')}
          />
          <QuickActionButton
            title={isConnected ? "Wallet Connected" : "Connect Wallet"}
            description={isConnected ? "Sepolia Account Linked" : "Pair MetaMask Account"}
            icon={Wallet}
            onClick={isConnected ? () => navigate('/my-votes') : connect}
            highlight={!isConnected}
          />
        </div>
      </section>

      {/* Bottom Grid: Recent Activity & Security */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <section className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
              <Activity className="h-4 w-4 text-accent-500" />
              Available Ballots
            </h2>
            <Link
              to="/elections"
              className="text-xs text-accent-400 hover:text-accent-300 flex items-center gap-0.5 font-semibold"
            >
              All elections <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          {electionsLoading ? (
            <LoadingSkeleton rows={3} />
          ) : electionsError ? (
            <div className="p-4 rounded-xl bg-danger-950/40 border border-danger-800/60 text-center flex flex-col items-center gap-2">
              <p className="text-xs text-danger-300 font-semibold">Failed to load elections.</p>
              <button
                onClick={() => refetchElections()}
                className="px-3 py-1.5 rounded bg-danger-800 hover:bg-danger-700 text-2xs text-white font-medium transition-colors"
              >
                Retry
              </button>
            </div>
          ) : !elections || elections.length === 0 ? (
            <EmptyState
              icon={Vote}
              title="No Active Elections Found"
              description="Elections will appear here once your organization organizer opens and publishes them."
              action={{ label: 'Check All Ballots', href: '/elections' }}
            />
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {elections.map(election => (
                <ElectionCard key={election.id} election={election} />
              ))}
            </div>
          )}
        </section>

        {/* Voter Privacy & Integrity Card */}
        <section className="bg-brand-850/60 border border-brand-700/50 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-wider mb-2.5">
              Ballot Secrecy & Privacy
            </h3>
            <p className="text-xs text-neutral-400 leading-relaxed mb-4">
              VotEth cryptographically separates voter identity from vote choices. Neither organization organizers nor system administrators can see your ballot selection.
            </p>
            <div className="p-3 bg-brand-900 border border-brand-700/50 rounded-xl flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-accent-400 shrink-0 mt-0.5" />
              <div className="text-[10px] text-neutral-400 leading-normal">
                Double-voting is prevented at the ledger level. Each vote generates a verifiable SHA-256 receipt for independent verification.
              </div>
            </div>
          </div>
          <Link
            to="/my-votes"
            className="mt-6 w-full py-2.5 px-4 rounded-lg bg-brand-800 border border-brand-700 text-center text-xs font-semibold hover:bg-brand-750 transition-colors flex items-center justify-center gap-1.5"
          >
            <FileText className="h-3.5 w-3.5" />
            View Vote Receipts
          </Link>
        </section>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  bgColor,
}: {
  label: string
  value: string | number
  icon: any
  color: string
  bgColor: string
}) {
  return (
    <div className={`rounded-xl border p-4.5 flex items-center justify-between ${bgColor}`}>
      <div className="min-w-0">
        <div className="text-2xs text-neutral-400 uppercase tracking-widest font-bold">
          {label}
        </div>
        <div className="text-lg sm:text-xl font-black text-neutral-100 mt-1">
          {value}
        </div>
      </div>
      <div className={`p-2.5 rounded-lg bg-brand-900/60 border border-brand-700/40 ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  )
}

function QuickActionButton({
  title,
  description,
  icon: Icon,
  onClick,
  primary = false,
  highlight = false,
}: {
  title: string
  description: string
  icon: any
  onClick: () => void
  primary?: boolean
  highlight?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left p-4 rounded-xl border transition-all duration-150 flex flex-col justify-between min-h-24 hover:scale-[1.02] ${
        primary 
          ? 'bg-accent-600 hover:bg-accent-500 text-neutral-100 border-accent-600 shadow-md shadow-accent-600/10'
          : highlight
            ? 'bg-brand-900 hover:bg-brand-850 text-neutral-100 border-accent-500/60'
            : 'bg-brand-900 hover:bg-brand-850 text-neutral-100 border-brand-700/60'
      }`}
    >
      <Icon className={`h-5 w-5 ${primary ? 'text-neutral-100' : 'text-accent-400'}`} />
      <div className="mt-3">
        <div className="text-xs font-bold">{title}</div>
        <div className={`text-[10px] mt-0.5 ${primary ? 'text-accent-200' : 'text-neutral-500'}`}>
          {description}
        </div>
      </div>
    </button>
  )
}

function ElectionCard({
  election,
}: {
  election: {
    id: string
    title: string
    status: string
    start_date: string
    end_date: string
    org_name?: string
  }
}) {
  const statusColors: Record<string, { badge: string, dot: string }> = {
    draft: { badge: 'bg-blue-500/10 text-blue-400 border border-blue-500/25', dot: 'bg-blue-400' },
    open: { badge: 'bg-success-500/10 text-success-400 border border-success-500/25', dot: 'bg-success-400' },
    closed: { badge: 'bg-danger-500/10 text-danger-400 border border-danger-500/25', dot: 'bg-danger-400' },
    published: { badge: 'bg-neutral-800 text-neutral-400 border border-neutral-750', dot: 'bg-neutral-500' },
    upcoming: { badge: 'bg-warning-500/10 text-warning-400 border border-warning-500/25', dot: 'bg-warning-400' },
  }

  const currentStatus = statusColors[election.status] ?? { badge: 'bg-brand-800 text-neutral-500 border border-brand-700', dot: 'bg-neutral-500' }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-xl bg-brand-850 border px-5 py-4 hover:border-accent-600/60 transition-all duration-150 group border-brand-700/50">
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-neutral-100 truncate group-hover:text-neutral-50">
            {election.title}
          </span>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${currentStatus.badge}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${currentStatus.dot}`} />
            {election.status}
          </span>
        </div>
        <span className="text-[10px] text-neutral-500 font-medium">
          {election.org_name && (
            <span className="text-accent-400 font-semibold mr-1.5">
              {election.org_name} &bull;
            </span>
          )}
          Start: {election.start_date ? new Date(election.start_date).toLocaleDateString() : 'TBD'} &bull; End: {election.end_date ? new Date(election.end_date).toLocaleDateString() : 'TBD'}
        </span>
      </div>
      <Link
        to={election.status === 'open' ? `/elections/${election.id}/vote` : election.status === 'published' ? `/elections/${election.id}/results` : `/elections/${election.id}`}
        className="mt-3 sm:mt-0 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-brand-900 border border-brand-700 hover:border-accent-600/50 text-2xs font-semibold text-neutral-300 hover:text-neutral-100 transition-colors w-full sm:w-auto"
      >
        <span>
          {election.status === 'open' ? 'Cast Vote' : election.status === 'published' ? 'View Results' : 'Details'}
        </span>
        <ChevronRight className="h-3 w-3" />
      </Link>
    </div>
  )
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: any
  title: string
  description: string
  action?: { label: string; href: string } | undefined
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-brand-700/60 bg-brand-850/40 py-10 px-6 text-center">
      <div className="p-3 bg-brand-900 border border-brand-700/60 rounded-xl mb-3">
        <Icon className="h-6 w-6 text-neutral-500" />
      </div>
      <h3 className="text-xs font-bold text-neutral-200 mb-1">{title}</h3>
      <p className="text-3xs text-neutral-500 max-w-xs leading-normal">{description}</p>
      {action && (
        <Link
          to={action.href}
          className="mt-4 px-4 py-2 rounded-lg bg-accent-600 hover:bg-accent-500 text-3xs font-bold text-neutral-100 transition-all shadow-md shadow-accent-600/10"
        >
          {action.label}
        </Link>
      )}
    </div>
  )
}

function LoadingSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-16 rounded-xl bg-brand-850 border border-brand-700/40 animate-pulse"
        />
      ))}
    </div>
  )
}
