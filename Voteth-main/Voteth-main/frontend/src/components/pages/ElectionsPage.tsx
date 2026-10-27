import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@services/supabase/client'
import { Link } from 'react-router-dom'
import { 
  Calendar, Users, Vote, Plus, Filter, AlertCircle
} from 'lucide-react'

type ElectionStatus = 'all' | 'open' | 'closed' | 'draft' | 'published'

interface ElectionData {
  id: string
  title: string
  description: string | null
  status: string
  start_date: string
  end_date: string
  created_at: string
  org_id?: string
  organization?: { name: string } | null
  org_name?: string
  candidates: { id: string }[]
}

export function ElectionsPage() {
  const queryClient = useQueryClient()
  const { activeMembership, isOrganizer } = useAuth()
  const orgId = activeMembership?.org_id ?? null
  const [statusFilter, setStatusFilter] = useState<ElectionStatus>('all')

  const { 
    data: elections, 
    isLoading, 
    error: electionsError, 
    refetch: refetchElections 
  } = useQuery<ElectionData[]>({
    queryKey: ['elections-full-with-candidates', orgId],
    queryFn: async () => {
      let query = supabase
        .from('elections')
        .select(`
          id, title, description, status, start_date, end_date, created_at, org_id,
          organization:organizations(name),
          candidates:candidates(id)
        `)
        .order('start_date', { ascending: false })

      if (orgId) {
        query = query.eq('org_id', orgId)
      } else {
        query = query.in('status', ['open', 'published', 'closed'])
      }

      const { data, error } = await query
      if (error) {
        console.error('[ElectionsPage] Error fetching elections:', error)
        throw error
      }

      return ((data as any) || []).map((e: any) => ({
        ...e,
        org_name: e.organization?.name ?? 'Community Election',
      }))
    },
  })

  // Real-time synchronization on election updates
  useEffect(() => {
    const channel = supabase
      .channel('elections-page-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'elections' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['elections-full-with-candidates'] })
        }
      )
      .subscribe()

    return () => {
      if (channel && typeof channel.unsubscribe === 'function') {
        channel.unsubscribe()
      }
    }
  }, [queryClient])

  const filtered = elections?.filter(
    e => statusFilter === 'all' || e.status === statusFilter
  )

  const isAdmin = activeMembership?.role === 'admin'

  // Only organizers without an active organization are prompted to create one
  if (!activeMembership && isOrganizer) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="glass-card max-w-md p-8 text-center border border-brand-700 bg-brand-850 rounded-2xl shadow-xl flex flex-col items-center gap-4">
          <div className="text-accent-400 text-5xl">🏢</div>
          <h1 className="text-2xl font-bold text-neutral-100 tracking-tight">No Active Organization</h1>
          <p className="text-sm text-neutral-400 leading-relaxed">
            Please create an organization to host ballots and manage elections.
          </p>
          <Link
            to="/organizations/new"
            className="mt-2 w-full py-3 px-4 rounded-lg bg-accent-600 hover:bg-accent-500 text-sm font-semibold text-neutral-100 transition-all shadow-md shadow-accent-600/20 text-center"
          >
            Create Organization
          </Link>
        </div>
      </div>
    )
  }

  const statusTabs: { label: string; value: ElectionStatus }[] = [
    { label: 'All Ballots', value: 'all' },
    { label: 'Open', value: 'open' },
    { label: 'Published', value: 'published' },
    { label: 'Closed', value: 'closed' },
    { label: 'Draft', value: 'draft' },
  ]

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-100 tracking-tight">
            Elections Ballot
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            Browse and cast your votes for active secure elections.
          </p>
        </div>
        {isAdmin && (
          <Link
            to="/organizer/elections/new"
            className="bg-accent-600 hover:bg-accent-500 text-neutral-100 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-md shadow-accent-600/10 flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            Create Election
          </Link>
        )}
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-2 items-center flex-wrap">
        <Filter className="h-4 w-4 text-neutral-500 mr-1 hidden sm:block" />
        {statusTabs.map(tab => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-150 ${
              statusFilter === tab.value
                ? 'bg-accent-600 text-neutral-100 shadow-md shadow-accent-600/10'
                : 'bg-brand-850 text-neutral-400 border border-brand-700/40 hover:text-neutral-200 hover:bg-brand-800'
            }`}
          >
            {tab.label}
            {tab.value !== 'all' && elections && (
              <span className="ml-1 text-3xs opacity-60">
                ({elections.filter(e => e.status === tab.value).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Election Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-44 rounded-xl bg-brand-850 border border-brand-700/55 animate-pulse"
            />
          ))}
        </div>
      ) : electionsError ? (
        <div className="p-8 rounded-2xl bg-danger-950/40 border border-danger-800/60 text-center flex flex-col items-center gap-3">
          <AlertCircle className="h-8 w-8 text-danger-400" />
          <h3 className="text-xs font-bold text-danger-300">Failed to load elections</h3>
          <p className="text-3xs text-neutral-400 max-w-sm">
            An error occurred while fetching elections from the network.
          </p>
          <button
            onClick={() => refetchElections()}
            className="px-4 py-2 rounded-lg bg-danger-800 hover:bg-danger-700 text-xs font-medium text-white transition-colors"
          >
            Retry
          </button>
        </div>
      ) : !filtered || filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-brand-700/60 bg-brand-850/40 py-16 px-6 text-center">
          <div className="p-3 bg-brand-900 border border-brand-700/60 rounded-xl mb-3">
            <Vote className="h-6 w-6 text-neutral-500" />
          </div>
          <h3 className="text-xs font-bold text-neutral-200 mb-1">
            No Elections Found
          </h3>
          <p className="text-3xs text-neutral-500 max-w-xs leading-normal">
            {statusFilter === 'all'
              ? 'No elections are currently open or published. Check back soon or contact your organizer.'
              : `No elections listed with status "${statusFilter}".`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(election => (
            <ElectionCard key={election.id} election={election} isAdmin={isAdmin} />
          ))}
        </div>
      )}
    </div>
  )
}

function ElectionCard({
  election,
  isAdmin,
}: {
  election: ElectionData
  isAdmin: boolean
}) {
  const isOpen = election.status === 'open'
  const isPublished = election.status === 'published'
  const candidateCount = election.candidates?.length ?? 0

  const statusBadge: Record<string, { badge: string, dot: string }> = {
    draft: { badge: 'bg-blue-500/10 text-blue-400 border border-blue-500/20', dot: 'bg-blue-400' },
    open: { badge: 'bg-success-500/10 text-success-400 border border-success-500/20', dot: 'bg-success-400' },
    closed: { badge: 'bg-danger-500/10 text-danger-400 border border-danger-500/20', dot: 'bg-danger-400' },
    published: { badge: 'bg-neutral-800 text-neutral-400 border border-neutral-750', dot: 'bg-neutral-500' },
    upcoming: { badge: 'bg-warning-500/10 text-warning-400 border border-warning-500/20', dot: 'bg-warning-400' },
  }

  const currentStatus = statusBadge[election.status] ?? { badge: 'bg-brand-800 text-neutral-500 border border-brand-700', dot: 'bg-neutral-500' }

  // Get countdown string helper
  const getCountdown = () => {
    const now = new Date()
    const start = new Date(election.start_date)
    const end = new Date(election.end_date)
    if (election.status === 'open') {
      const diff = end.getTime() - now.getTime()
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
      return days > 0 ? `Ends in ${days} day${days > 1 ? 's' : ''}` : 'Ends today'
    }
    if (election.status === 'draft') {
      const diff = start.getTime() - now.getTime()
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
      if (days === 1) return 'Starts tomorrow'
      if (days > 1) return `Starts in ${days} days`
      return 'Starts soon'
    }
    return 'Voting Closed'
  }

  return (
    <div className={`flex flex-col justify-between rounded-xl bg-brand-850 border border-brand-700/50 p-5 hover:border-accent-600/60 transition-all duration-150 hover:scale-[1.01] shadow-lg`}>
      <div className="flex flex-col gap-2.5 mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col min-w-0">
            <h3 className="text-xs font-bold text-neutral-100 leading-snug truncate" title={election.title}>
              {election.title}
            </h3>
            {election.org_name && (
              <span className="text-[10px] text-accent-400 font-semibold mt-0.5 truncate">
                {election.org_name}
              </span>
            )}
          </div>
          <span className={`inline-flex items-center gap-1.5 shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${currentStatus.badge}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${currentStatus.dot}`} />
            {election.status}
          </span>
        </div>
        
        {election.description && (
          <p className="text-3xs text-neutral-500 line-clamp-2 leading-relaxed">
            {election.description}
          </p>
        )}

        <div className="flex flex-col gap-1.5 pt-2 border-t border-brand-700/30 text-3xs text-neutral-400">
          <div className="flex items-center gap-1.5 font-medium">
            <Users className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
            <span>{candidateCount} Candidate{candidateCount !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <Calendar className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
            <span className="text-accent-400 font-semibold">{getCountdown()}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-2 border-t border-brand-700/30">
        {isOpen && (
          <Link
            to={`/elections/${election.id}/vote`}
            className="flex-1 text-center py-2 rounded-lg bg-accent-600 hover:bg-accent-500 text-[10px] font-bold text-neutral-100 transition-all shadow-md shadow-accent-600/10"
          >
            Cast Vote
          </Link>
        )}
        {isPublished && (
          <Link
            to={`/elections/${election.id}/results`}
            className="flex-1 text-center py-2 rounded-lg bg-brand-800 hover:bg-brand-750 text-[10px] font-bold text-neutral-300 transition-all border border-brand-700"
          >
            View Results
          </Link>
        )}
        {isAdmin && (
          <Link
            to={`/organizer/elections/${election.id}`}
            className="flex-1 text-center py-2 rounded-lg bg-brand-900 hover:bg-brand-800 text-[10px] font-bold text-neutral-400 hover:text-neutral-200 transition-all border border-brand-700/60"
          >
            Manage
          </Link>
        )}
        {!isOpen && !isPublished && !isAdmin && (
          <Link
            to={`/elections/${election.id}`}
            className="flex-1 text-center py-2 rounded-lg bg-brand-800 hover:bg-brand-700 text-[10px] font-medium text-neutral-400 transition-all"
          >
            Details
          </Link>
        )}
      </div>
    </div>
  )
}
