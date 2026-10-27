import { useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useWallet } from '@/contexts/WalletContext'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@services/supabase/client'
import { Link, useNavigate } from 'react-router-dom'
import { ethers } from 'ethers'
import { 
  Users, Award, Plus, 
  Settings, ChevronRight, BarChart3, Database, Activity, CheckSquare, Download,
  AlertTriangle, RefreshCw
} from 'lucide-react'
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  CartesianGrid, BarChart as RechartsBarChart, Bar
} from 'recharts'
import { toast } from 'sonner'

export function AdminPage() {
  const { activeMembership, memberships, switchOrganization } = useAuth()
  const { isConnected: isWalletConnected, address, balance } = useWallet()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Fall back to any available admin membership if active is not yet set
  const effectiveMembership = activeMembership || memberships.find(m => m.role === 'admin') || memberships[0] || null
  const orgId = effectiveMembership?.org_id ?? null
  const orgName = effectiveMembership?.organization?.name ?? 'Organization'

  useEffect(() => {
    if (!activeMembership && effectiveMembership) {
      switchOrganization(effectiveMembership.org_id)
    }
  }, [activeMembership, effectiveMembership, switchOrganization])

  // Supabase Real-Time Subscriptions for live updates
  useEffect(() => {
    if (!orgId) return

    const channel = supabase
      .channel(`admin-org-realtime-${orgId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'elections', filter: `org_id=eq.${orgId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['admin-elections-list', orgId] })
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'org_memberships', filter: `organization_id=eq.${orgId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['admin-member-count', orgId] })
          queryClient.invalidateQueries({ queryKey: ['admin-teammate-growth', orgId] })
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'votes' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['admin-turnout-data', orgId] })
          queryClient.invalidateQueries({ queryKey: ['admin-candidate-share', orgId] })
        }
      )
      .subscribe()

    return () => {
      if (channel && typeof channel.unsubscribe === 'function') {
        channel.unsubscribe()
      }
    }
  }, [orgId, queryClient])

  // 1. Elections Query: Scoped strictly to the active organization
  const { 
    data: electionsList = [], 
    isLoading: electionsLoading, 
    error: electionsError,
    refetch: refetchElections 
  } = useQuery({
    queryKey: ['admin-elections-list', orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data, error } = await supabase
        .from('elections')
        .select('id, title, status, created_at')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('[AdminPage] Error fetching org elections:', error)
        throw error
      }
      return data ?? []
    },
    enabled: !!orgId,
  })

  // Derived election stats
  const totalElections = electionsList.length
  const openElections = electionsList.filter(e => e.status === 'open').length
  const completedElections = electionsList.filter(e => e.status === 'closed' || e.status === 'published').length
  const electionIds = useMemo(() => electionsList.map(e => e.id), [electionsList])

  // 2. Member Count Query: Scoped strictly to this organization
  const { 
    data: memberCount = 0, 
    isLoading: membersLoading, 
    error: membersError,
    refetch: refetchMembers 
  } = useQuery({
    queryKey: ['admin-member-count', orgId],
    queryFn: async () => {
      if (!orgId) return 0
      const { count, error } = await supabase
        .from('org_memberships')
        .select('user_id', { count: 'exact', head: true })
        .eq('organization_id', orgId)

      if (error) {
        console.error('[AdminPage] Error fetching member count:', error)
        throw error
      }
      return count ?? 0
    },
    enabled: !!orgId,
  })

  // 3. Candidates Count Query: Count actual candidates registered for this organization's elections
  const { 
    data: candidatesCount = 0, 
    isLoading: candidatesLoading, 
    error: candidatesError,
    refetch: refetchCandidates 
  } = useQuery({
    queryKey: ['admin-candidates-count', orgId, electionIds],
    queryFn: async () => {
      if (!orgId || electionIds.length === 0) return 0
      const { count, error } = await supabase
        .from('candidates')
        .select('id', { count: 'exact', head: true })
        .in('election_id', electionIds)

      if (error) {
        console.error('[AdminPage] Error fetching candidates count:', error)
        throw error
      }
      return count ?? 0
    },
    enabled: !!orgId && electionIds.length > 0,
  })

  // 4. Real Turnout Trend Query: Aggregate votes cast over time for this organization's elections
  const { 
    data: turnoutData = [], 
    isLoading: turnoutLoading, 
    error: turnoutError,
    refetch: refetchTurnout 
  } = useQuery({
    queryKey: ['admin-turnout-data', orgId, electionIds],
    queryFn: async () => {
      if (!orgId || electionIds.length === 0) return []
      const { data: votes, error } = await supabase
        .from('votes')
        .select('created_at')
        .in('election_id', electionIds)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('[AdminPage] Error fetching turnout trend votes:', error)
        throw error
      }

      if (!votes || votes.length === 0) return []

      // Group votes by calendar date
      const dateMap = new Map<string, number>()
      for (const v of votes) {
        const d = new Date(v.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        dateMap.set(d, (dateMap.get(d) ?? 0) + 1)
      }

      return Array.from(dateMap.entries()).map(([date, votes]) => ({ date, votes }))
    },
    enabled: !!orgId && electionIds.length > 0,
  })

  // Total votes cast in this organization's elections
  const totalVotesCount = useMemo(() => {
    return turnoutData.reduce((acc, curr) => acc + curr.votes, 0)
  }, [turnoutData])

  // 5. Real Candidate Vote Share Query: Real vote counts per approved candidate across organization elections
  const { 
    data: candidateShareData = [], 
    isLoading: candidateShareLoading, 
    error: candidateShareError,
    refetch: refetchCandidateShare 
  } = useQuery({
    queryKey: ['admin-candidate-share', orgId, electionIds],
    queryFn: async () => {
      if (!orgId || electionIds.length === 0) return []

      const [candsRes, votesRes] = await Promise.all([
        supabase.from('candidates').select('id, name').in('election_id', electionIds).eq('status', 'approved'),
        supabase.from('votes').select('candidate_id').in('election_id', electionIds)
      ])

      if (candsRes.error) {
        console.error('[AdminPage] Error fetching candidates for vote share:', candsRes.error)
        throw candsRes.error
      }
      if (votesRes.error) {
        console.error('[AdminPage] Error fetching votes for vote share:', votesRes.error)
        throw votesRes.error
      }

      const candidates = candsRes.data ?? []
      const votes = votesRes.data ?? []

      if (candidates.length === 0 || votes.length === 0) return []

      const voteMap = new Map<string, number>()
      for (const v of votes) {
        if (v.candidate_id) {
          voteMap.set(v.candidate_id, (voteMap.get(v.candidate_id) ?? 0) + 1)
        }
      }

      const tally = candidates.map(c => ({
        name: c.name,
        votes: voteMap.get(c.id) ?? 0,
      })).filter(c => c.votes > 0)

      return tally.sort((a, b) => b.votes - a.votes)
    },
    enabled: !!orgId && electionIds.length > 0,
  })

  // 6. Real Teammate Growth Query: Cumulative member enrollments over time from org_memberships
  const { 
    data: growthData = [], 
    isLoading: growthLoading,
    error: growthError,
    refetch: refetchGrowth 
  } = useQuery({
    queryKey: ['admin-teammate-growth', orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data: members, error } = await supabase
        .from('org_memberships')
        .select('joined_at')
        .eq('organization_id', orgId)
        .order('joined_at', { ascending: true })

      if (error) {
        console.error('[AdminPage] Error fetching member growth:', error)
        throw error
      }

      if (!members || members.length <= 1) return []

      const monthMap = new Map<string, number>()
      for (const m of members) {
        const d = m.joined_at ? new Date(m.joined_at) : new Date()
        const label = d.toLocaleDateString('en-US', { month: 'short' })
        monthMap.set(label, (monthMap.get(label) ?? 0) + 1)
      }

      let cumulative = 0
      return Array.from(monthMap.entries()).map(([month, count]) => {
        cumulative += count
        return { month, members: cumulative }
      })
    },
    enabled: !!orgId,
  })

  // 7. Real Blockchain Node & RPC Health Verification
  const rpcUrl = import.meta.env.VITE_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com'
  const targetNetworkName = import.meta.env.VITE_NETWORK_NAME || 'Ethereum Sepolia Testnet'
  const electionContractAddress = import.meta.env.VITE_ELECTION_CONTRACT_ADDRESS || ''
  const isContractConfigured = Boolean(
    electionContractAddress &&
    electionContractAddress !== '0x0000000000000000000000000000000000000000' &&
    electionContractAddress.startsWith('0x') &&
    electionContractAddress.length === 42
  )

  const { data: rpcStatus, isLoading: rpcLoading, refetch: refetchRpc } = useQuery({
    queryKey: ['admin-rpc-health', rpcUrl],
    queryFn: async () => {
      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl)
        const [blockNumber, network] = await Promise.all([
          provider.getBlockNumber(),
          provider.getNetwork()
        ])
        return {
          connected: true,
          blockNumber,
          chainId: Number(network.chainId),
        }
      } catch (err: any) {
        console.warn('[AdminPage] RPC health check error:', err?.message)
        return {
          connected: false,
          blockNumber: null,
          chainId: null,
        }
      }
    },
    refetchInterval: 20000,
  })

  const hasAnyQueryError = Boolean(
    electionsError || membersError || candidatesError || turnoutError || candidateShareError || growthError
  )

  const handleExportData = () => {
    const payload = {
      organization: {
        id: orgId,
        name: orgName,
      },
      statistics: {
        totalElections,
        activeElections: openElections,
        completedElections,
        totalMembers: memberCount,
        candidatesCount,
        totalVotesRecorded: totalVotesCount,
      },
      elections: electionsList,
      exportedAt: new Date().toISOString(),
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute("href", dataStr)
    downloadAnchor.setAttribute("download", `voteth_${orgName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_data.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
    toast.success('Genuine governance data exported successfully!')
  }

  const handleRefreshAll = () => {
    refetchElections()
    refetchMembers()
    refetchCandidates()
    refetchTurnout()
    refetchCandidateShare()
    refetchGrowth()
    refetchRpc()
    toast.success('Refreshing dashboard data...')
  }

  // Intercept if no active membership or organization workspace
  if (!activeMembership || !orgId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="glass-card max-w-lg p-8 text-center border border-brand-700 bg-brand-850 rounded-2xl shadow-xl flex flex-col items-center gap-5 animate-scale-in">
          <div className="w-16 h-16 rounded-2xl bg-accent-600/10 border border-accent-500/30 flex items-center justify-center text-3xl">
            🏛️
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-100 tracking-tight">Organizer Workspace</h1>
            <p className="text-sm text-neutral-400 mt-2 leading-relaxed">
              Welcome to the Organizer Panel. To host cryptographic elections, approve candidate profiles, and manage voter allowlists, create your organization workspace.
            </p>
          </div>
          <Link
            to="/organizations/new"
            className="w-full sm:w-auto px-6 py-3 rounded-lg bg-accent-600 hover:bg-accent-500 text-sm font-bold text-neutral-100 transition-all shadow-lg shadow-accent-600/20 flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Organization
          </Link>
        </div>
      </div>
    )
  }

  const isStatsLoading = electionsLoading || membersLoading || candidatesLoading

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-100 tracking-tight">
            Organizer Panel
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            Governance Dashboard for{' '}
            <span className="text-accent-400 font-semibold">{orgName}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefreshAll}
            className="p-2.5 rounded-lg bg-brand-850 hover:bg-brand-800 text-neutral-400 hover:text-neutral-100 border border-brand-700/60 transition-colors"
            title="Refresh Real Data"
            type="button"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={handleExportData}
            className="px-4 py-2 rounded-lg bg-brand-850 hover:bg-brand-800 text-xs font-bold text-neutral-350 hover:text-neutral-100 border border-brand-700/60 transition-colors flex items-center gap-1.5"
            type="button"
          >
            <Download className="h-4 w-4" />
            Export Data
          </button>
          <button
            onClick={() => navigate('/organizer/elections/new')}
            className="bg-accent-600 hover:bg-accent-500 text-neutral-100 px-4.5 py-2.5 rounded-lg text-xs font-bold transition-all shadow-md shadow-accent-600/10 flex items-center justify-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Create Election
          </button>
        </div>
      </div>

      {/* Database Error Banner if any real query failed */}
      {hasAnyQueryError && (
        <div className="p-4 rounded-xl bg-danger-950/40 border border-danger-800/60 flex items-center justify-between gap-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-danger-400 shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-danger-200">Database Query Notice</h4>
              <p className="text-3xs text-danger-400 mt-0.5">
                One or more Supabase queries failed to return records. Verify database permissions and RLS policies.
              </p>
            </div>
          </div>
          <button
            onClick={handleRefreshAll}
            className="px-3 py-1.5 rounded bg-danger-900 border border-danger-750 hover:bg-danger-800 text-2xs font-bold text-danger-200 transition-colors shrink-0"
          >
            Retry Queries
          </button>
        </div>
      )}

      {/* Org Real Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isStatsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-xl bg-brand-850 border border-brand-700/60 animate-pulse"
            />
          ))
        ) : (
          <>
            <AdminStatCard 
              label="Active elections" 
              value={openElections} 
              icon={Activity} 
              color="text-success-400" 
            />
            <AdminStatCard 
              label="Completed" 
              value={completedElections} 
              icon={CheckSquare} 
              color="text-neutral-300" 
            />
            <AdminStatCard 
              label="Total Members" 
              value={memberCount} 
              icon={Users} 
              color="text-accent-400" 
            />
            <AdminStatCard 
              label="Candidates" 
              value={candidatesCount} 
              icon={Award} 
              color="text-warning-400" 
            />
          </>
        )}
      </div>

      {/* Layout Content: Side Actions sidebar and Main Analytics graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Analytics deck */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Real Turnout Chart */}
          <div className="bg-brand-850 border border-brand-700/60 rounded-2xl p-5 flex flex-col justify-between shadow-lg">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-accent-500" />
                  Turnout Trend (Votes Cast)
                </h2>
                {totalVotesCount > 0 && (
                  <span className="text-[10px] text-accent-400 bg-accent-500/10 border border-accent-950/40 px-2 py-0.5 rounded font-bold">
                    {totalVotesCount} Total Vote{totalVotesCount !== 1 ? 's' : ''} Cast
                  </span>
                )}
              </div>
              <div className="h-48 mt-4 font-mono text-[10px]">
                {turnoutLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : turnoutData.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4 border border-dashed border-brand-700/40 rounded-xl bg-brand-900/10">
                    <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider">No Turnout Data Available</p>
                    <p className="text-[10px] text-neutral-500 mt-1 max-w-xs leading-normal">
                      Turnout trend lines will appear once voters cast ballots in open elections.
                    </p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={turnoutData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorVotes" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#7C3AED" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                      <XAxis dataKey="date" stroke="#6B7280" />
                      <YAxis stroke="#6B7280" allowDecimals={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '10px' }}
                        labelStyle={{ color: '#F3F4F6', fontWeight: 'bold' }}
                        itemStyle={{ color: '#A78BFA' }}
                      />
                      <Area type="monotone" dataKey="votes" stroke="#7C3AED" strokeWidth={2} fillOpacity={1} fill="url(#colorVotes)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
 
          {/* Sub Charts: Candidates Share and Growth charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Real Candidate Vote Share */}
            <div className="bg-brand-850 border border-brand-700/60 rounded-2xl p-5 shadow-lg">
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                <Award className="h-4 w-4 text-warning-400" />
                Candidate Vote Share
              </h3>
              <div className="h-40 font-mono text-[9px]">
                {candidateShareLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : candidateShareData.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4 border border-dashed border-brand-700/40 rounded-xl bg-brand-900/10">
                    <p className="text-2xs text-neutral-400 font-bold uppercase tracking-wider">No Candidate Share Recorded</p>
                    <p className="text-[10px] text-neutral-500 mt-1 max-w-xs leading-normal">
                      Candidate vote share will populate automatically as ballots are cast.
                    </p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={candidateShareData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                      <XAxis dataKey="name" stroke="#6B7280" />
                      <YAxis stroke="#6B7280" allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px' }}
                        labelStyle={{ color: '#F3F4F6' }}
                      />
                      <Bar dataKey="votes" fill="#7C3AED" radius={[4, 4, 0, 0]} />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
 
            {/* Real Teammate Growth */}
            <div className="bg-brand-850 border border-brand-700/60 rounded-2xl p-5 shadow-lg">
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                <Users className="h-4 w-4 text-accent-400" />
                Teammate Growth Rate
              </h3>
              <div className="h-40 font-mono text-[9px]">
                {growthLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : growthData.length <= 1 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4 border border-dashed border-brand-700/40 rounded-xl bg-brand-900/10">
                    <p className="text-2xs text-neutral-400 font-bold uppercase tracking-wider">Growth Tracker Paused</p>
                    <p className="text-[10px] text-neutral-500 mt-1 max-w-xs leading-normal">
                      Invite teammates to join your workspace to view enrollment trends over time.
                    </p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={growthData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                      <XAxis dataKey="month" stroke="#6B7280" />
                      <YAxis stroke="#6B7280" allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px' }}
                        labelStyle={{ color: '#F3F4F6' }}
                      />
                      <Area type="monotone" dataKey="members" stroke="#10B981" strokeWidth={2} fillOpacity={0.2} fill="#10B981" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
 
          </div>
 
        </div>
 
        {/* Right Sidebar Column: Verified Blockchain Network Status */}
        <div className="flex flex-col gap-6">
          
          {/* Genuine Blockchain Network Status */}
          <div className="bg-brand-850 border border-brand-700/60 rounded-2xl p-5 shadow-lg">
            <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2 mb-5">
              <Database className="h-4 w-4 text-accent-500" />
              Network & Node Health
            </h2>
            
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-brand-700/40 pb-2.5">
                <span className="text-2xs text-neutral-500 font-bold uppercase tracking-wider">RPC Endpoint</span>
                <span className={`text-xs font-bold flex items-center gap-1.5 ${rpcStatus?.connected ? 'text-success-400' : 'text-danger-400'}`}>
                  <span className={`inline-block h-2 w-2 rounded-full ${rpcStatus?.connected ? 'bg-success-500 shadow-[0_0_8px_#10B981]' : 'bg-danger-500'}`} />
                  {rpcLoading ? 'Checking...' : rpcStatus?.connected ? 'Connected' : 'Unavailable'}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-brand-700/40 pb-2.5">
                <span className="text-2xs text-neutral-500 font-bold uppercase tracking-wider">Web3 Wallet</span>
                <span className={`text-xs font-bold flex items-center gap-1.5 ${isWalletConnected ? 'text-success-400' : 'text-neutral-500'}`}>
                  <span className={`inline-block h-2 w-2 rounded-full ${isWalletConnected ? 'bg-success-500 shadow-[0_0_8px_#10B981]' : 'bg-neutral-600'}`} />
                  {isWalletConnected ? `${address?.slice(0, 6)}...${address?.slice(-4)}` : 'Not Connected'}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-brand-700/40 pb-2.5">
                <span className="text-2xs text-neutral-500 font-bold uppercase tracking-wider">Target Network</span>
                <span className="text-xs font-semibold text-neutral-200">
                  {targetNetworkName}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-brand-700/40 pb-2.5">
                <span className="text-2xs text-neutral-500 font-bold uppercase tracking-wider">Latest Sepolia Block</span>
                <span className="font-mono text-xs font-bold text-neutral-350">
                  {rpcLoading ? '...' : rpcStatus?.blockNumber ? `#${rpcStatus.blockNumber.toLocaleString()}` : 'Unavailable'}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-brand-700/40 pb-2.5">
                <span className="text-2xs text-neutral-500 font-bold uppercase tracking-wider">Smart Contract</span>
                <span className="font-mono text-2xs font-bold text-neutral-400 truncate max-w-[150px]" title={electionContractAddress}>
                  {isContractConfigured ? `${electionContractAddress.slice(0, 6)}...${electionContractAddress.slice(-4)}` : 'Not Deployed (Off-chain)'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-2xs text-neutral-500 font-bold uppercase tracking-wider">Wallet Balance</span>
                <span className="font-mono text-2xs font-bold text-accent-400">
                  {isWalletConnected && balance !== null ? `${balance} ETH` : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Persistent Sidebar shortcuts console */}
          <div className="bg-brand-850 border border-brand-700/60 rounded-2xl p-5 shadow-lg flex flex-col gap-4">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1.5 select-none mb-1">
              <Settings className="h-4 w-4 text-accent-500" />
              Administrative Actions
            </h3>
            
            <div className="flex flex-col gap-2">
              <Link 
                to="/organizer/elections/new"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-brand-900 border border-brand-700/40 hover:border-accent-600/40 hover:bg-brand-800 transition-all group"
              >
                <span className="text-xs text-neutral-350 font-semibold group-hover:text-neutral-200">Create Election</span>
                <ChevronRight className="h-4 w-4 text-neutral-500" />
              </Link>
              <Link 
                to="/organizer/members"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-brand-900 border border-brand-700/40 hover:border-accent-600/40 hover:bg-brand-800 transition-all group"
              >
                <span className="text-xs text-neutral-350 font-semibold group-hover:text-neutral-200">Invite Members</span>
                <ChevronRight className="h-4 w-4 text-neutral-500" />
              </Link>
              <button 
                onClick={handleExportData}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-brand-900 border border-brand-700/40 hover:border-accent-600/40 hover:bg-brand-800 transition-all group text-left"
              >
                <span className="text-xs text-neutral-350 font-semibold group-hover:text-neutral-200">Export Results</span>
                <ChevronRight className="h-4 w-4 text-neutral-500" />
              </button>
              <Link 
                to="/organizer/settings"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-brand-900 border border-brand-700/40 hover:border-accent-600/40 hover:bg-brand-800 transition-all group"
              >
                <span className="text-xs text-neutral-350 font-semibold group-hover:text-neutral-200">Workspace Configurations</span>
                <ChevronRight className="h-4 w-4 text-neutral-500" />
              </Link>
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function AdminStatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: number
  icon: any
  color: string
}) {
  return (
    <div className="rounded-xl border border-brand-700/60 bg-brand-850 p-4.5 flex flex-col justify-between min-h-24 shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-lg sm:text-xl font-black text-neutral-100">{value}</span>
        <div className={`p-1.5 rounded bg-brand-900 border border-brand-700/40 ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <span className="text-3xs text-neutral-400 uppercase tracking-widest font-bold mt-2">
        {label}
      </span>
    </div>
  )
}
