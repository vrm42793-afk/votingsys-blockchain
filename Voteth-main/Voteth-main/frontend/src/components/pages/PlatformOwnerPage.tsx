import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { platformService } from '@services/platformService'
import { ethers } from 'ethers'
import { 
  Building2, Users2, Vote, ShieldAlert, Activity, 
  Terminal, CheckCircle, RefreshCw, Laptop, Settings,
  Search, ShieldCheck, Trash2, LayoutDashboard, Database, ChevronRight
} from 'lucide-react'
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  CartesianGrid 
} from 'recharts'
import { toast } from 'sonner'

type TabType = 'overview' | 'organizations' | 'users' | 'elections' | 'logs'

interface PlatformOwnerPageProps {
  defaultTab?: TabType
}

export function PlatformOwnerPage({ defaultTab = 'overview' }: PlatformOwnerPageProps) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab)
  const [orgSearch, setOrgSearch] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [electionSearch, setElectionSearch] = useState('')
  const [activeAccent, setActiveAccent] = useState(() => {
    return localStorage.getItem('voteth:admin:accent_theme') || 'purple'
  })

  const handleAccentChange = (color: string) => {
    localStorage.setItem('voteth:admin:accent_theme', color)
    setActiveAccent(color)
    
    // Apply accent class immediately
    const root = document.documentElement
    root.classList.remove('theme-purple', 'theme-blue', 'theme-emerald', 'theme-rose')
    root.classList.add(`theme-${color}`)
    toast.success(`Platform console accent switched to ${color}!`)
  }

  useEffect(() => {
    setActiveTab(defaultTab)
  }, [defaultTab])

  // 1. Queries
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: platformService.getDashboardStats
  })

  const { data: orgs, isLoading: orgsLoading } = useQuery({
    queryKey: ['platform-orgs'],
    queryFn: platformService.getOrganizations,
    enabled: activeTab === 'organizations'
  })

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['platform-users'],
    queryFn: platformService.getUsers,
    enabled: activeTab === 'users'
  })

  const { data: elections, isLoading: electionsLoading } = useQuery({
    queryKey: ['platform-elections'],
    queryFn: platformService.getElections,
    enabled: activeTab === 'elections'
  })

  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ['platform-logs'],
    queryFn: platformService.getAuditLogs,
    enabled: activeTab === 'logs'
  })

  // Blockchain status verification
  const { data: ethBlockNumber, refetch: refetchBlockNumber, isRefetching: blockRefetching } = useQuery({
    queryKey: ['blockchain-health'],
    queryFn: async () => {
      try {
        const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com')
        return await provider.getBlockNumber()
      } catch (err) {
        console.error('Failed to contact Sepolia testnet RPC:', err)
        return null
      }
    },
    refetchInterval: 15000
  })

  // 2. Mutations
  const orgStatusMutation = useMutation({
    mutationFn: ({ orgId, isActive }: { orgId: string; isActive: boolean }) =>
      platformService.updateOrganizationStatus(orgId, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-orgs'] })
      queryClient.invalidateQueries({ queryKey: ['platform-stats'] })
      toast.success('Organization status updated successfully')
    },
    onError: (err: Error) => {
      toast.error(`Status update failed: ${err.message}`)
    }
  })

  const orgDeleteMutation = useMutation({
    mutationFn: (orgId: string) => platformService.deleteOrganization(orgId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-orgs'] })
      queryClient.invalidateQueries({ queryKey: ['platform-stats'] })
      toast.success('Organization deleted successfully')
    },
    onError: (err: Error) => {
      toast.error(`Deletion failed: ${err.message}`)
    }
  })

  const userRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'owner' | 'organizer' | 'voter' }) =>
      platformService.updateUserRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-users'] })
      queryClient.invalidateQueries({ queryKey: ['platform-stats'] })
      toast.success('User platform role updated')
    },
    onError: (err: Error) => {
      toast.error(`Role update failed: ${err.message}`)
    }
  })

  const userSuspensionMutation = useMutation({
    mutationFn: ({ userId, isSuspended }: { userId: string; isSuspended: boolean }) =>
      platformService.updateUserSuspension(userId, isSuspended),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['platform-users'] })
      queryClient.invalidateQueries({ queryKey: ['platform-stats'] })
      toast.success(variables.isSuspended ? 'User suspended successfully' : 'User profile reactivated')
    },
    onError: (err: Error) => {
      toast.error(`Suspension action failed: ${err.message}`)
    }
  })

  // Mock Consolidated Platform Activity Chart Data
  const monthlyVoteVolume = [
    { name: 'All-Time Votes', votes: stats?.totalVotes ?? 0 },
    { name: 'Votes Today', votes: stats?.votesToday ?? 0 }
  ]

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  return (
    <div className="flex flex-col gap-8 max-w-6xl w-full mx-auto">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-brand-700/50 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-100 tracking-tight flex items-center gap-2.5">
            <span className="text-accent-500">👑</span> Platform Owner Command Console
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            Real-time decentralized ledger oversight, tenant organization audits, and global user policy administration.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-brand-850 border border-brand-700/60 p-2 rounded-xl shrink-0">
          <Database className="h-4 w-4 text-accent-500 animate-pulse" />
          <div className="flex flex-col text-right">
            <span className="text-[9px] text-neutral-500 uppercase tracking-widest font-bold">Ethereum Sepolia Node</span>
            <span className="font-mono text-xs font-bold text-neutral-200">
              {ethBlockNumber ? `#${ethBlockNumber.toLocaleString()}` : 'Syncing RPC...'}
            </span>
          </div>
          <button 
            onClick={() => refetchBlockNumber()} 
            disabled={blockRefetching}
            className="p-1 rounded bg-brand-900 border border-brand-700 hover:border-accent-500 text-neutral-400 hover:text-neutral-200 ml-1.5 transition-all"
            title="Refresh Block Height"
          >
            <RefreshCw className={`h-3 w-3 ${blockRefetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats Dashboard Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statsLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-brand-850 border border-brand-700/60 animate-pulse" />
          ))
        ) : (
          <>
            <StatCard label="Organizations" value={stats?.totalOrgs ?? 0} icon={Building2} color="text-accent-400" />
            <StatCard label="Platform Organizers" value={stats?.totalOrganizers ?? 0} icon={Users2} color="text-success-400" />
            <StatCard label="Allowlisted Voters" value={stats?.totalVoters ?? 0} icon={Vote} color="text-warning-400" />
            <StatCard label="Total Elections" value={stats?.totalElections ?? 0} icon={Activity} color="text-info-400" />
            <StatCard label="Active Ballots" value={stats?.activeElections ?? 0} icon={CheckCircle} color="text-success-500" highlight />
            <StatCard label="Failed Tx Count" value={stats?.failedTransactions ?? 0} icon={ShieldAlert} color="text-danger-400" danger={(stats?.failedTransactions ?? 0) > 0} />
          </>
        )}
      </div>

      {/* Overview Analytics Console */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Global Chart */}
          <div className="lg:col-span-2 bg-brand-850 border border-brand-700/60 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                  <Activity className="h-4 w-4 text-accent-500" />
                  Consolidated Platform Vote Volume
                </h2>
                {stats && stats.totalVotes > 0 && (
                  <span className="text-[10px] text-success-400 bg-success-500/10 border border-success-950/40 px-2.5 py-0.5 rounded font-bold">
                    System Active
                  </span>
                )}
              </div>
              <div className="h-48 mt-4 font-mono text-[9px]">
                {(!stats || stats.totalVotes === 0) ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-brand-700/40 rounded-xl bg-brand-900/10">
                    <Activity className="h-7 w-7 text-neutral-500 mb-2" />
                    <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider">No Activity Logged</p>
                    <p className="text-[10px] text-neutral-500 mt-1 max-w-xs leading-normal">
                      Platform transaction analytics will compile automatically once tenant organizations begin casting cryptographic votes.
                    </p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyVoteVolume} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorPlatformVotes" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-accent-600)" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="var(--color-accent-600)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.15} />
                      <XAxis dataKey="name" stroke="#6B7280" />
                      <YAxis stroke="#6B7280" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'var(--color-brand-850)', borderColor: 'var(--color-brand-700)', borderRadius: '10px' }}
                        labelStyle={{ color: 'var(--color-neutral-100)', fontWeight: 'bold' }}
                        itemStyle={{ color: 'var(--color-accent-400)' }}
                      />
                      <Area type="monotone" dataKey="votes" stroke="var(--color-accent-600)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPlatformVotes)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* System status dashboard */}
          <div className="bg-brand-850/60 border border-brand-700/50 rounded-2xl p-5 flex flex-col justify-between shadow-lg">
            <div className="flex flex-col gap-4">
              <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Terminal className="h-4 w-4 text-accent-500" />
                Operational Health Status
              </h3>
              <ul className="flex flex-col gap-3 text-xs">
                <StatusItem label="Supabase Authenticator" status="online" />
                <StatusItem label="Database RLS Enforcement" status="active" />
                <StatusItem 
                  label="VotEth Smart Contracts" 
                  status={
                    import.meta.env.VITE_ELECTION_CONTRACT_ADDRESS && 
                    import.meta.env.VITE_ELECTION_CONTRACT_ADDRESS !== '0x0000000000000000000000000000000000000000' &&
                    import.meta.env.VITE_ELECTION_CONTRACT_ADDRESS.length === 42
                      ? 'deployed' 
                      : 'preview only'
                  } 
                />
                <StatusItem label="Ethereum Sepolia Provider Link" status={ethBlockNumber ? 'online' : 'offline'} />
              </ul>
            </div>
            <div className="p-3 bg-brand-900 border border-brand-700/40 rounded-xl mt-4 flex items-start gap-2.5">
              <ShieldCheck className="h-4.5 w-4.5 text-accent-400 shrink-0 mt-0.5" />
              <div className="text-[10px] text-neutral-500 leading-normal">
                Platform-wide security defaults are automatically enforced via database row-level security (RLS). Global write locks can be activated via maintenance settings.
              </div>
            </div>

            {/* Console Theme Accent */}
            <div className="bg-brand-900 border border-brand-700/40 rounded-xl p-4.5 mt-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold text-neutral-350 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                  <Settings className="h-4 w-4 text-accent-500" />
                  Console Theme Accent
                </h3>
                <p className="text-[10px] text-neutral-500 leading-normal mb-3">
                  Personalize the visual theme accent of your platform command dashboard.
                </p>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {['purple', 'blue', 'emerald', 'rose'].map((color) => {
                  const isSelected = activeAccent === color
                  return (
                    <button
                      key={color}
                      onClick={() => handleAccentChange(color)}
                      className={`py-1 rounded-lg border text-center transition-all capitalize text-[10px] font-bold ${
                        isSelected 
                          ? 'border-accent-500 bg-accent-950/20 text-neutral-100 shadow'
                          : 'border-brand-700 bg-brand-850 text-neutral-450 hover:border-brand-600'
                      }`}
                    >
                      {color}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Active Authorized Sessions */}
            <div className="bg-brand-900 border border-brand-700/40 rounded-xl p-4.5 mt-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold text-neutral-350 uppercase tracking-widest mb-3 flex items-center gap-1.5 select-none">
                  <Laptop className="h-4 w-4 text-accent-500" />
                  Active Authorized Sessions
                </h3>
                <div className="p-3 bg-brand-850 border border-brand-700/30 rounded-lg flex justify-between items-center text-3xs">
                  <div className="flex items-center gap-2">
                    <Laptop className="h-4 w-4 text-success-500" />
                    <div>
                      <span className="text-neutral-200 font-bold block">
                        {(() => {
                          const ua = navigator.userAgent
                          let os = "Unknown OS"
                          let browser = "Browser"
                          if (ua.includes("Windows")) os = "Windows"
                          else if (ua.includes("Macintosh")) os = "macOS"
                          else if (ua.includes("Linux")) os = "Linux"
                          else if (ua.includes("Android")) os = "Android"
                          else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS"
                          
                          if (ua.includes("Firefox")) browser = "Firefox"
                          else if (ua.includes("Edg")) browser = "Edge"
                          else if (ua.includes("Chrome")) browser = "Chrome"
                          else if (ua.includes("Safari")) browser = "Safari"
                          
                          return `${os} • ${browser}`
                        })()}
                      </span>
                      <span className="text-neutral-500">Local Client Access &bull; Current Session</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-success-500/10 text-success-400 font-bold">Active</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation Menu */}
      <div className="flex items-center gap-2 border-b border-brand-700/60 pb-2 overflow-x-auto scrollbar-hide">
        <TabButton id="overview" active={activeTab} onClick={setActiveTab} label="Overview Panel" icon={LayoutDashboard} />
        <TabButton id="organizations" active={activeTab} onClick={setActiveTab} label="Organizations" icon={Building2} />
        <TabButton id="users" active={activeTab} onClick={setActiveTab} label="Users & Roles" icon={Users2} />
        <TabButton id="elections" active={activeTab} onClick={setActiveTab} label="Active Elections" icon={Vote} />
        <TabButton id="logs" active={activeTab} onClick={setActiveTab} label="Audit Trails" icon={Terminal} />
      </div>

      {/* Tabs View Console */}
      <div className="bg-brand-850 border border-brand-700/60 rounded-2xl p-6 min-h-[400px] shadow-xl">
        
        {/* OVERVIEW LOG TRAIL SUBSECTION */}
        {activeTab === 'overview' && (
          <div className="flex flex-col gap-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-neutral-350 uppercase tracking-widest">Recent System Log Trail</h3>
                <p className="text-3xs text-neutral-500 mt-0.5">Live platform-wide operations stream</p>
              </div>
              <button 
                onClick={() => queryClient.invalidateQueries({ queryKey: ['platform-stats'] })}
                className="text-3xs font-bold text-accent-400 hover:text-accent-300 flex items-center gap-1"
              >
                Refresh Log Trail <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            
            <div className="flex flex-col gap-2">
              {statsLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-12 bg-brand-900 border border-brand-700/40 rounded-xl animate-pulse" />
                ))
              ) : stats?.recentLogs && stats.recentLogs.length > 0 ? (
                stats.recentLogs.map((log) => (
                  <div key={log.id} className="p-3.5 bg-brand-900/60 border border-brand-700/40 rounded-xl flex items-center justify-between text-xs hover:border-brand-600 transition-colors">
                    <div>
                      <span className="font-bold text-accent-400 uppercase tracking-wide mr-2.5 bg-brand-950 px-2 py-0.5 rounded border border-brand-800">
                        {log.action}
                      </span>
                      <span className="text-neutral-300">
                        {log.organization ? `Organization: ${log.organization.name}` : 'Platform Level Scope'}
                      </span>
                    </div>
                    <span className="text-neutral-500 text-3xs font-mono">{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-neutral-550 text-xs">No recent administrative activities logged.</div>
              )}
            </div>
          </div>
        )}

        {/* ORGANIZATIONS ADMINISTRATION TAB */}
        {activeTab === 'organizations' && (
          <div className="flex flex-col gap-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-xs font-bold text-neutral-350 uppercase tracking-widest">Active Tenant Organizations</h3>
                <p className="text-3xs text-neutral-500 mt-0.5">Manage, suspend, or delete active organizations on VotEth</p>
              </div>
              <div className="relative max-w-xs w-full">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Search organizations..."
                  value={orgSearch}
                  onChange={(e) => setOrgSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 text-xs bg-brand-900 border border-brand-700 rounded-lg text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-accent-500"
                />
              </div>
            </div>

            {orgsLoading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 bg-brand-900 border border-brand-700/30 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto scrollbar-hide">
                <table className="w-full text-left border-collapse text-xs min-w-[700px]">
                  <thead>
                    <tr className="border-b border-brand-700 text-neutral-500 font-bold uppercase tracking-wider text-2xs">
                      <th className="pb-3 px-3">Org Name</th>
                      <th className="pb-3 px-3">URL Slug</th>
                      <th className="pb-3 px-3">Owner Details</th>
                      <th className="pb-3 px-3 text-center">Members</th>
                      <th className="pb-3 px-3 text-center">Elections</th>
                      <th className="pb-3 px-3 text-center">Brand Theme</th>
                      <th className="pb-3 px-3">Status</th>
                      <th className="pb-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(orgs ?? [])
                      .filter(o => o.name.toLowerCase().includes(orgSearch.toLowerCase()) || o.slug.toLowerCase().includes(orgSearch.toLowerCase()))
                      .map((org) => (
                        <tr key={org.id} className="border-b border-brand-800 hover:bg-brand-900/30 text-neutral-350 transition-colors">
                          <td className="py-4 px-3 font-semibold text-neutral-200">{org.name}</td>
                          <td className="py-4 px-3 font-mono text-neutral-500">{org.slug}</td>
                          <td className="py-4 px-3">
                            {org.owner ? (
                              <div className="flex flex-col">
                                <span className="font-semibold text-neutral-300">{org.owner.full_name || 'N/A'}</span>
                                <span className="text-3xs text-neutral-500 font-mono">{org.owner.email}</span>
                              </div>
                            ) : (
                              <span className="text-neutral-500 italic">No Owner Assigned</span>
                            )}
                          </td>
                          <td className="py-4 px-3 text-center font-bold text-neutral-200">{org.member_count}</td>
                          <td className="py-4 px-3 text-center font-bold text-neutral-200">{org.election_count}</td>
                          <td className="py-4 px-3 text-center">
                            <span className="capitalize text-3xs px-2 py-0.5 rounded border font-semibold border-brand-700 bg-brand-900">
                              {org.accent_theme || 'purple'}
                            </span>
                          </td>
                          <td className="py-4 px-3">
                            <span className={`px-2 py-0.5 rounded text-3xs font-bold uppercase ${org.is_active ? 'bg-success-900/30 text-success-400 border border-success-700/20' : 'bg-danger-900/30 text-danger-400 border border-danger-700/20'}`}>
                              {org.is_active ? 'Active' : 'Suspended'}
                            </span>
                          </td>
                          <td className="py-4 px-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => orgStatusMutation.mutate({ orgId: org.id, isActive: !org.is_active })}
                                className={`px-2.5 py-1 rounded-lg text-3xs font-bold transition-all border ${
                                  org.is_active 
                                    ? 'bg-warning-950 text-warning-400 border-warning-900 hover:bg-warning-900' 
                                    : 'bg-success-900/20 text-success-400 border-success-700/40 hover:bg-success-900'
                                }`}
                              >
                                {org.is_active ? 'Suspend' : 'Activate'}
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Delete organization "${org.name}" permanently? This deletes all memberships and elections.`)) {
                                    orgDeleteMutation.mutate(org.id)
                                  }
                                }}
                                className="p-1 rounded-lg text-danger-400 hover:bg-danger-950 hover:text-danger-300 transition-all"
                                title="Delete Organization"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* USERS AND ROLES MANAGEMENT TAB */}
        {activeTab === 'users' && (
          <div className="flex flex-col gap-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-xs font-bold text-neutral-350 uppercase tracking-widest">Platform User Policy Administration</h3>
                <p className="text-3xs text-neutral-500 mt-0.5">Control platform-wide user privileges, roles, and status suspensions</p>
              </div>
              <div className="relative max-w-xs w-full">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Search user email or name..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 text-xs bg-brand-900 border border-brand-700 rounded-lg text-neutral-100 placeholder-neutral-600 focus:outline-none"
                />
              </div>
            </div>

            {usersLoading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 bg-brand-900 border border-brand-700/30 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto scrollbar-hide">
                <table className="w-full text-left border-collapse text-xs min-w-[700px]">
                  <thead>
                    <tr className="border-b border-brand-700 text-neutral-500 font-bold uppercase tracking-wider text-2xs">
                      <th className="pb-3 px-3">Full Name</th>
                      <th className="pb-3 px-3">Email Address</th>
                      <th className="pb-3 px-3">Cryptographic Wallet Address</th>
                      <th className="pb-3 px-3">System Authorization Role</th>
                      <th className="pb-3 px-3">Access Status</th>
                      <th className="pb-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(users ?? [])
                      .filter(u => (u.full_name ?? '').toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase()))
                      .map((u) => (
                        <tr key={u.id} className="border-b border-brand-800 hover:bg-brand-900/30 text-neutral-350 transition-colors">
                          <td className="py-4 px-3 font-semibold text-neutral-200">{u.full_name || 'N/A'}</td>
                          <td className="py-4 px-3 font-mono text-neutral-400">{u.email}</td>
                          <td className="py-4 px-3 font-mono text-neutral-500" title={u.wallet_address || 'Unlinked'}>
                            {u.wallet_address ? (
                              <span className="bg-brand-900 px-2 py-1 rounded border border-brand-700/40 select-all">
                                {formatAddress(u.wallet_address)}
                              </span>
                            ) : (
                              <span className="italic text-neutral-600">No Web3 Wallet Linked</span>
                            )}
                          </td>
                          <td className="py-4 px-3">
                            <select
                              value={u.platform_role}
                              onChange={(e) => userRoleMutation.mutate({ userId: u.id, role: e.target.value as any })}
                              className="bg-brand-900 border border-brand-700 rounded-lg px-2.5 py-1 text-xs text-neutral-200 focus:outline-none cursor-pointer focus:ring-1 focus:ring-accent-500"
                            >
                              <option value="voter">Voter (Standard User)</option>
                              <option value="organizer">Organizer (Workspace Admin)</option>
                              <option value="owner">Platform Owner (Superadmin)</option>
                            </select>
                          </td>
                          <td className="py-4 px-3">
                            <span className={`px-2 py-0.5 rounded text-3xs font-bold uppercase ${!u.is_suspended ? 'bg-success-900/30 text-success-400' : 'bg-danger-900/30 text-danger-400'}`}>
                              {!u.is_suspended ? 'Active' : 'Suspended'}
                            </span>
                          </td>
                          <td className="py-4 px-3 text-right">
                            {u.platform_role !== 'owner' ? (
                              <button
                                onClick={() => userSuspensionMutation.mutate({ userId: u.id, isSuspended: !u.is_suspended })}
                                className={`px-2.5 py-1 rounded-lg text-3xs font-bold border transition-all ${
                                  !u.is_suspended 
                                    ? 'bg-danger-950 text-danger-400 border-danger-900 hover:bg-danger-900' 
                                    : 'bg-success-900/20 text-success-400 border-success-700/40 hover:bg-success-900'
                                }`}
                              >
                                {!u.is_suspended ? 'Suspend Access' : 'Reactivate'}
                              </button>
                            ) : (
                              <span className="text-[10px] text-neutral-500 italic">Self Oversight</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ELECTIONS TAB VIEW */}
        {activeTab === 'elections' && (
          <div className="flex flex-col gap-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-xs font-bold text-neutral-350 uppercase tracking-widest">Global Platform Elections</h3>
                <p className="text-3xs text-neutral-500 mt-0.5">Audit, inspect, or track the deployment states of all active elections</p>
              </div>
              <div className="relative max-w-xs w-full">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Search election title..."
                  value={electionSearch}
                  onChange={(e) => setElectionSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 text-xs bg-brand-900 border border-brand-700 rounded-lg text-neutral-100 placeholder-neutral-600 focus:outline-none"
                />
              </div>
            </div>

            {electionsLoading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 bg-brand-900 border border-brand-700/30 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto scrollbar-hide">
                <table className="w-full text-left border-collapse text-xs min-w-[700px]">
                  <thead>
                    <tr className="border-b border-brand-700 text-neutral-500 font-bold uppercase tracking-wider text-2xs">
                      <th className="pb-3 px-3">Election Title</th>
                      <th className="pb-3 px-3">Organization Scope</th>
                      <th className="pb-3 px-3">Lifecycle State</th>
                      <th className="pb-3 px-3">Electoral Dates</th>
                      <th className="pb-3 px-3">On-Chain Tx Hash</th>
                      <th className="pb-3 px-3 text-right">Verification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(elections ?? [])
                      .filter(e => e.title.toLowerCase().includes(electionSearch.toLowerCase()))
                      .map((election) => (
                        <tr key={election.id} className="border-b border-brand-800 hover:bg-brand-900/30 text-neutral-350 transition-colors">
                          <td className="py-4 px-3 font-semibold text-neutral-200">{election.title}</td>
                          <td className="py-4 px-3 text-neutral-450">{election.organization?.name || 'Unknown Scope'}</td>
                          <td className="py-4 px-3">
                            <span className={`px-2 py-0.5 rounded text-3xs font-bold uppercase border ${
                              election.status === 'published' ? 'bg-info-900/20 text-info-400 border-info-700/30' :
                              election.status === 'open' ? 'bg-success-900/20 text-success-400 border-success-700/30' :
                              election.status === 'closed' ? 'bg-danger-900/20 text-danger-400 border-danger-700/30' : 'bg-brand-900 text-neutral-450 border-brand-800'
                            }`}>
                              {election.status}
                            </span>
                          </td>
                          <td className="py-4 px-3 text-neutral-500 font-medium">
                            {election.start_date ? new Date(election.start_date).toLocaleDateString() : 'N/A'} -{' '}
                            {election.end_date ? new Date(election.end_date).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="py-4 px-3 font-mono text-neutral-500 truncate max-w-[150px]" title={election.chain_tx_hash || ''}>
                            {election.chain_tx_hash ? (
                              <span className="select-all bg-brand-900 border border-brand-700/30 px-2 py-0.5 rounded text-neutral-450 font-medium">
                                {formatAddress(election.chain_tx_hash)}
                              </span>
                            ) : (
                              <span className="italic text-neutral-600">Off-chain Draft</span>
                            )}
                          </td>
                          <td className="py-4 px-3 text-right">
                            <Link
                              to={`/organizer/elections/${election.id}`}
                              className="px-2.5 py-1 rounded-lg text-3xs font-bold bg-brand-900 border border-brand-700 hover:border-accent-500 text-neutral-350 hover:text-neutral-200 transition-all"
                            >
                              Inspect
                            </Link>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* AUDIT LOG TRAILS TAB */}
        {activeTab === 'logs' && (
          <div className="flex flex-col gap-6 animate-fade-in">
            <div>
              <h3 className="text-xs font-bold text-neutral-350 uppercase tracking-widest">Global Platform Audit Trails</h3>
              <p className="text-3xs text-neutral-500 mt-0.5">Immutable record trail for registrations, role transfers, and lifecycle status changes</p>
            </div>

            {logsLoading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 bg-brand-900 border border-brand-700/30 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto scrollbar-hide">
                <table className="w-full text-left border-collapse text-xs min-w-[700px]">
                  <thead>
                    <tr className="border-b border-brand-700 text-neutral-500 font-bold uppercase tracking-wider text-2xs">
                      <th className="pb-3 px-3">Action Type</th>
                      <th className="pb-3 px-3">Organization Context</th>
                      <th className="pb-3 px-3">Logged Date/Time</th>
                      <th className="pb-3 px-3">Payload Metadata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(logs ?? []).map((log) => (
                      <tr key={log.id} className="border-b border-brand-800 hover:bg-brand-900/30 text-neutral-400 transition-colors">
                        <td className="py-4 px-3 font-bold text-accent-400 uppercase tracking-wide">{log.action}</td>
                        <td className="py-4 px-3 text-neutral-300">
                          {log.organization?.name || <span className="text-neutral-550 italic">Global Platform Level</span>}
                        </td>
                        <td className="py-4 px-3 text-neutral-500">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="py-4 px-3 font-mono text-3xs text-neutral-600 truncate max-w-[300px]" title={JSON.stringify(log.metadata)}>
                          {JSON.stringify(log.metadata)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Redesigned Stats Card helper
// ---------------------------------------------------------------------------
function StatCard({ 
  label, 
  value, 
  icon: Icon, 
  highlight = false, 
  danger = false,
  color
}: { 
  label: string; 
  value: number | string; 
  icon: any; 
  highlight?: boolean; 
  danger?: boolean;
  color: string;
}) {
  const cardColor = 
    danger ? 'bg-danger-950/20 border-danger-700/40 shadow-[0_4px_12px_rgba(239,68,68,0.04)]' :
    highlight ? 'bg-success-950/20 border-success-700/40 shadow-[0_4px_12px_rgba(16,185,129,0.04)]' :
    'bg-brand-900 border-brand-700/60'

  return (
    <div className={`rounded-xl border p-4.5 flex flex-col justify-between min-h-[92px] hover:border-brand-600 transition-all ${cardColor}`}>
      <div className="flex items-center justify-between">
        <span className="text-xl sm:text-2xl font-black text-neutral-100 tracking-tight">{value}</span>
        <div className={`p-2 rounded-lg bg-brand-850 border border-brand-750/70 shrink-0 ${color}`}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
      <div className="mt-3.5">
        <span className="text-3xs font-bold text-neutral-500 uppercase block tracking-widest">{label}</span>
      </div>
    </div>
  )
}

function TabButton({ id, active, onClick, label, icon: Icon }: { id: TabType; active: TabType; onClick: (id: TabType) => void; label: string; icon: any }) {
  const isSelected = active === id
  return (
    <button
      onClick={() => onClick(id)}
      className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all border whitespace-nowrap ${
        isSelected 
          ? 'bg-accent-600 text-neutral-100 border-accent-600 shadow-md shadow-accent-600/10' 
          : 'text-neutral-450 hover:text-neutral-200 border-transparent hover:bg-brand-900/60'
      }`}
    >
      <Icon className="h-4 w-4" /> 
      <span>{label}</span>
    </button>
  )
}

function StatusItem({ label, status }: { label: string; status: string }) {
  const isOk = status === 'online' || status === 'active' || status === 'synced' || status === 'deployed'
  const isWarn = status === 'preview only' || status === 'not deployed'
  return (
    <li className="flex items-center justify-between py-2 border-b border-brand-800">
      <span className="text-neutral-450 font-medium">{label}</span>
      <span className={`px-2.5 py-0.5 rounded-full text-3xs font-bold uppercase border ${
        isOk 
          ? 'bg-success-900/20 text-success-400 border-success-700/20' 
          : isWarn 
            ? 'bg-warning-900/20 text-warning-400 border-warning-700/20'
            : 'bg-danger-900/20 text-danger-400 border-danger-700/20'
      }`}>
        {status}
      </span>
    </li>
  )
}
