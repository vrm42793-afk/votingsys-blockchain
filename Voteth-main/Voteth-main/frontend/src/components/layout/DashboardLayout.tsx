import { useState, useEffect, useRef } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useWallet } from '@/contexts/WalletContext'
import { useTheme } from '@/contexts/ThemeContext'
import { supabase } from '@services/supabase/client'
import { 
  Menu, X, LayoutDashboard, Vote, Receipt, 
  PlusCircle, Users, Settings, Wallet, LogOut, 
  Bell, Sun, Moon, Search, CircleDot, Info, WifiOff, Cpu
} from 'lucide-react'
import { toast } from 'sonner'

interface Notification {
  id: string
  text: string
  timestamp: string
  unread: boolean
  category: 'elections' | 'blockchain' | 'organizations' | 'system'
}

export function DashboardLayout() {
  const { 
    profile, 
    activeMembership, 
    memberships, 
    isOrganizer, 
    isPlatformOwner, 
    isVoterOnly, 
    switchOrganization, 
    signOut 
  } = useAuth()
  const { address, balance, isConnected, status, connect, disconnect } = useWallet()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()

  // Layout states
  const [maintenanceActive, setMaintenanceActive] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [activeNotificationTab, setActiveNotificationTab] = useState<'all' | 'elections' | 'blockchain' | 'organizations' | 'system'>('all')

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearchOverlay, setShowSearchOverlay] = useState(false)

  // PWA & Connectivity state
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)

  // Real notifications loaded from database audit logs
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    let isMounted = true
    const fetchRealNotifications = async () => {
      try {
        const { data: logs } = await supabase
          .from('audit_logs')
          .select('id, action, created_at')
          .order('created_at', { ascending: false })
          .limit(6)

        if (isMounted && logs && logs.length > 0) {
          setNotifications(logs.map(l => ({
            id: l.id,
            text: l.action || 'System action logged',
            timestamp: new Date(l.created_at).toLocaleDateString(),
            unread: false,
            category: 'system' as const,
          })))
        }
      } catch (err) {
        console.warn('[DashboardLayout] Failed to load real notifications:', err)
      }
    }
    fetchRealNotifications()
    return () => { isMounted = false }
  }, [])

  const notificationRef = useRef<HTMLDivElement>(null)

  // Real database search results
  const [realSearchResults, setRealSearchResults] = useState<{
    elections: string[]
    organizations: string[]
    members: string[]
    candidates: string[]
  }>({ elections: [], organizations: [], members: [], candidates: [] })

  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setRealSearchResults({ elections: [], organizations: [], members: [], candidates: [] })
      return
    }

    let isMounted = true
    const delayDebounce = setTimeout(async () => {
      const q = `%${searchQuery.trim()}%`
      try {
        const [elecRes, orgsRes, candsRes] = await Promise.all([
          supabase.from('elections').select('title').ilike('title', q).limit(5),
          supabase.from('organizations').select('name').ilike('name', q).limit(5),
          supabase.from('candidates').select('name').ilike('name', q).limit(5),
        ])

        if (isMounted) {
          setRealSearchResults({
            elections: (elecRes.data ?? []).map(e => e.title),
            organizations: (orgsRes.data ?? []).map(o => o.name),
            members: [],
            candidates: (candsRes.data ?? []).map(c => c.name),
          })
        }
      } catch (err) {
        console.warn('[DashboardLayout] Real search error:', err)
      }
    }, 250)

    return () => {
      isMounted = false
      clearTimeout(delayDebounce)
    }
  }, [searchQuery])

  const searchResults = realSearchResults
  const hasSearchResults = Boolean(
    searchResults.elections.length > 0 ||
    searchResults.organizations.length > 0 ||
    searchResults.members.length > 0 ||
    searchResults.candidates.length > 0
  )

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const checkMaintenance = async () => {
      try {
        const { data } = await supabase
          .from('platform_settings')
          .select('value')
          .eq('key', 'maintenance_mode')
          .maybeSingle()

        if (data?.value?.enabled === true) {
          setMaintenanceActive(true)
        }
      } catch (err) {
        console.error('Failed to check maintenance mode status:', err)
      }
    }

    checkMaintenance()
    
    // Subscribe to real-time configuration changes
    const subscription = supabase
      .channel('platform-settings-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'platform_settings' },
        (payload) => {
          if (payload.new && (payload.new as { key: string }).key === 'maintenance_mode') {
            setMaintenanceActive((payload.new as { value: { enabled: boolean } }).value?.enabled === true)
          }
        }
      )
      .subscribe()

    return () => {
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe()
      }
    }
  }, [])

  // Keyboard accessibility triggers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSidebarOpen(false)
        setIsNotificationsOpen(false)
        setShowSearchOverlay(false)
        setSearchQuery('')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Connectivity and PWA install prompt listeners
  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowInstallBanner(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShowInstallBanner(false)
      toast.success('VotEth 2.0 PWA installed successfully!')
    }
    setDeferredPrompt(null)
  }

  const handleLogout = async () => {
    await signOut()
    navigate('/')
  }

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  // Helper to determine active link styling
  const getLinkClass = (path: string) => {
    const isActive = location.pathname === path
    return `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-150 ${
      isActive
        ? 'bg-accent-600 text-neutral-100 shadow-lg shadow-accent-600/20'
        : 'text-neutral-400 hover:text-neutral-100 hover:bg-brand-850'
    }`
  }

  // Removed unused orgName
  const isAdmin = activeMembership?.role === 'admin'
  const unreadCount = notifications.filter(n => n.unread).length

  const markAllRead = () => {
    setNotifications(notifications.map(n => ({ ...n, unread: false })))
    toast.success('Marked all notifications as read.')
  }

  const filteredNotifications = notifications.filter(
    n => activeNotificationTab === 'all' || n.category === activeNotificationTab
  )

  const isOwner = isPlatformOwner

  const voterNavItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Browse Elections', path: '/elections', icon: Vote },
    { label: 'My Ballots & Receipts', path: '/my-votes', icon: Receipt },
  ]

  const organizerItems = [
    { label: 'Organizer Overview', path: '/organizer', icon: LayoutDashboard },
    { label: 'Create Election', path: '/organizer/elections/new', icon: PlusCircle },
    { label: 'Members & Voters', path: '/organizer/members', icon: Users },
    { label: 'Org Settings', path: '/organizer/settings', icon: Settings },
  ]

  const platformOwnerItems = [
    { label: 'Platform Overview', path: '/admin', icon: LayoutDashboard },
    { label: 'Platform Settings', path: '/admin/settings', icon: Settings },
    { label: 'Contract Deployment', path: '/admin/deploy', icon: Cpu },
  ]

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full bg-brand-900 border-r border-brand-700/80 p-5">
      <div>
        {/* Logo */}
        <div className="mb-6">
          <Link to="/" className="flex items-center gap-2 mb-4 px-2">
            <CircleDot className="text-accent-500 h-6 w-6 animate-pulse" />
            <span className="font-sans text-xl font-bold tracking-tight text-neutral-100">
              VotEth <span className="text-accent-500 font-extrabold text-sm align-super">2.0</span>
            </span>
          </Link>

          {/* Workspace selector (Organizers / Owners) or Org indicator (Voters) */}
          <div className="px-2">
            {isVoterOnly ? (
              <div>
                <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-1.5">Enrolled Workspace</div>
                <div className="w-full text-xs font-semibold px-3 py-2 bg-brand-850 border border-brand-700/50 rounded-lg text-neutral-200 truncate">
                  {activeMembership?.organization?.name || 'Voter Community'}
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Workspace</div>
                  <Link
                    to="/organizations/new"
                    onClick={() => setIsSidebarOpen(false)}
                    className="text-[10px] text-accent-400 hover:text-accent-300 font-bold flex items-center gap-0.5"
                    title="Create New Organization"
                  >
                    + New Org
                  </Link>
                </div>
                <select
                  value={activeMembership?.org_id || ''}
                  onChange={(e) => switchOrganization(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 bg-brand-850 border border-brand-700/50 rounded-lg text-neutral-200 focus:outline-none cursor-pointer"
                >
                  {isOwner && (
                    <option value="">Platform Console</option>
                  )}
                  {memberships?.map((m) => (
                    <option key={m.org_id} value={m.org_id}>
                      {m.organization?.name || 'Workspace'}
                    </option>
                  ))}
                  {memberships.length === 0 && (
                    <option value="">No Active Organization</option>
                  )}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Navigation links */}
        <nav className="flex flex-col gap-5">
          {/* Voter Navigation */}
          {isVoterOnly && (
            <div>
              <div className="text-[10px] font-bold tracking-widest text-neutral-500 uppercase px-4 mb-2">
                Voter Portal
              </div>
              <ul className="flex flex-col gap-1">
                {voterNavItems.map((item) => (
                  <li key={item.path}>
                    <Link to={item.path} onClick={() => setIsSidebarOpen(false)} className={getLinkClass(item.path)}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Organizer Control (Organizer / Owner only) */}
          {isOrganizer && (
            <div>
              <div className="text-[10px] font-bold tracking-widest text-neutral-500 uppercase px-4 mb-2">
                Organizer Panel
              </div>
              <ul className="flex flex-col gap-1">
                {organizerItems.map((item) => (
                  <li key={item.path}>
                    <Link to={item.path} onClick={() => setIsSidebarOpen(false)} className={getLinkClass(item.path)}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>

              {/* Voter Access for Organizers */}
              <div className="text-[10px] font-bold tracking-widest text-neutral-500 uppercase px-4 mb-2 mt-4">
                Ballot Access
              </div>
              <ul className="flex flex-col gap-1">
                <li>
                  <Link to="/elections" onClick={() => setIsSidebarOpen(false)} className={getLinkClass('/elections')}>
                    <Vote className="h-4 w-4" />
                    <span>Browse Elections</span>
                  </Link>
                </li>
                <li>
                  <Link to="/my-votes" onClick={() => setIsSidebarOpen(false)} className={getLinkClass('/my-votes')}>
                    <Receipt className="h-4 w-4" />
                    <span>My Receipts</span>
                  </Link>
                </li>
              </ul>
            </div>
          )}

          {/* Platform Owner Control */}
          {isOwner && (
            <div>
              <div className="text-[10px] font-bold tracking-widest text-neutral-500 uppercase px-4 mb-2">
                Platform Admin Panel
              </div>
              <ul className="flex flex-col gap-1">
                {platformOwnerItems.map((item) => (
                  <li key={item.path}>
                    <Link to={item.path} onClick={() => setIsSidebarOpen(false)} className={getLinkClass(item.path)}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </nav>
      </div>

      {/* Footer / Wallet Integration */}
      <div className="flex flex-col gap-4 pt-4 border-t border-brand-700">
        {/* Wallet Widget */}
        <div className="p-3.5 rounded-xl bg-brand-850 border border-brand-700/60 flex flex-col gap-2.5">
          {status === 'connecting' && (
            <div className="flex flex-col gap-2 py-2">
              <div className="text-2xs text-neutral-450 font-bold uppercase tracking-wider text-center flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
                Connecting Wallet...
              </div>
            </div>
          )}

          {status === 'wrong_network' && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-danger-400 font-bold uppercase tracking-wider">Wrong Network</span>
                <span className="inline-block h-2 w-2 rounded-full bg-danger-500 shadow-[0_0_8px_#EF4444]" />
              </div>
              <p className="text-3xs text-neutral-500 leading-normal">
                VotEth is deployed on Ethereum Sepolia Testnet (Chain ID 11155111). Please switch networks in your wallet.
              </p>
              <button
                onClick={() => connect()}
                className="w-full text-center text-[10px] text-neutral-100 bg-danger-600 hover:bg-danger-500 py-1.5 rounded font-bold transition-all shadow-md shadow-danger-600/10"
              >
                Switch to Sepolia
              </button>
            </div>
          )}

          {status === 'locked' && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-warning-400 font-bold uppercase tracking-wider">Wallet Locked</span>
                <span className="inline-block h-2 w-2 rounded-full bg-warning-500 shadow-[0_0_8px_#F59E0B]" />
              </div>
              <p className="text-3xs text-neutral-500 leading-normal">
                Unlock your browser wallet extension to enable cryptographic voting.
              </p>
              <button
                onClick={() => connect()}
                className="w-full text-center text-[10px] text-neutral-100 bg-accent-600 hover:bg-accent-500 py-1.5 rounded font-bold transition-all"
              >
                Unlock Wallet
              </button>
            </div>
          )}

          {status === 'connected' && address && (
            <div className="flex flex-col gap-2.5">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-success-400 font-bold uppercase tracking-wider">Wallet Connected</span>
                <span className="inline-block h-2 w-2 rounded-full bg-success-500 shadow-[0_0_8px_#10B981]" />
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="font-mono text-2xs text-neutral-200 bg-brand-900 px-2 py-1 rounded border border-brand-750 font-medium truncate select-all">
                  {formatAddress(address)}
                </span>
                <span className="text-[9px] text-accent-400 font-bold bg-accent-950 px-1.5 py-0.5 rounded border border-accent-900 shrink-0">
                  Sepolia Testnet
                </span>
              </div>
              <div className="text-xs text-neutral-350 font-medium flex items-center justify-between">
                <span>Balance:</span>
                <span className="font-mono font-bold text-neutral-100">{balance !== null ? `${balance} ETH` : 'Loading...'}</span>
              </div>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => connect(true)}
                  className="flex-1 text-center text-[10px] text-neutral-300 hover:text-neutral-100 bg-brand-700/50 hover:bg-brand-700 py-1.5 rounded font-semibold transition-all border border-brand-700"
                >
                  Change
                </button>
                <button
                  onClick={disconnect}
                  className="text-center text-[10px] hover:text-danger-400 text-neutral-500 transition-colors px-2 py-1.5 rounded font-semibold"
                >
                  Disconnect
                </button>
              </div>
            </div>
          )}

          {(status === 'not_connected' || (!isConnected && status !== 'connecting' && status !== 'wrong_network' && status !== 'locked')) && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Not Connected</span>
                <span className="inline-block h-2 w-2 rounded-full bg-neutral-600" />
              </div>
              <button
                onClick={() => connect()}
                className="w-full text-center text-xs text-neutral-100 bg-accent-600 hover:bg-accent-500 py-2 rounded-lg font-bold transition-all shadow-md shadow-accent-600/10 flex items-center justify-center gap-2 animate-scale-in"
              >
                <Wallet className="h-3.5 w-3.5" />
                Connect Wallet
              </button>
            </div>
          )}
        </div>

        {/* System controls */}
        <div className="flex items-center justify-between text-xs px-1">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 p-2 rounded-lg hover:bg-brand-850 text-neutral-400 hover:text-neutral-100 font-medium transition-colors"
            title="Toggle Theme Mode"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span>Mode</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 p-2 rounded-lg text-neutral-400 hover:text-danger-400 font-medium transition-colors"
          >
            <span>Logout</span>
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-brand-900 text-neutral-100 transition-colors duration-200 overflow-x-hidden font-sans">
      {/* Permanent Desktop Sidebar */}
      <aside className="hidden xl:block w-72 h-screen sticky top-0 shrink-0">
        {sidebarContent}
      </aside>

      {/* Drawer Overlay for Mobile & Tablet */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-brand-950/80 backdrop-blur-sm z-modal xl:hidden transition-all duration-300"
          onClick={() => setIsSidebarOpen(false)}
          aria-modal="true"
          role="dialog"
          aria-label="Navigation Drawer Overlay"
        >
          <div 
            className="w-72 h-full bg-brand-900 animate-slide-up shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 flex justify-end">
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="p-2 text-neutral-400 hover:text-neutral-100 rounded-lg hover:bg-brand-850"
                aria-label="Close Navigation Drawer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="h-[calc(100%-60px)]">
              {sidebarContent}
            </div>
          </div>
        </div>
      )}

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Sticky top Navigation Header */}
        <header className="sticky top-0 bg-brand-900/90 backdrop-blur-md border-b border-brand-700/80 z-sticky px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="xl:hidden p-2 text-neutral-400 hover:text-neutral-100 rounded-lg hover:bg-brand-850"
              aria-label="Toggle Sidebar Menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Brand Logo for Mobile */}
            <div className="xl:hidden flex items-center gap-1.5">
              <CircleDot className="text-accent-500 h-5 w-5 animate-pulse" />
              <span className="font-sans text-md font-bold tracking-tight text-neutral-100">
                VotEth
              </span>
            </div>

            {/* Global Search Bar */}
            <div className="relative hidden md:block max-w-sm w-full ml-4">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
              <input
                type="text"
                placeholder="Search elections, candidates, members..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setShowSearchOverlay(e.target.value.length > 0)
                }}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-lg bg-brand-850 border border-brand-700 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-accent-500 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Bell Notifications */}
            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="p-2 text-neutral-400 hover:text-neutral-100 rounded-lg hover:bg-brand-850 transition-colors relative"
                aria-label="View Notifications"
              >
                <Bell className="h-4.5 w-4.5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1.5 h-2 w-2 rounded-full bg-accent-500 ring-2 ring-brand-900" />
                )}
              </button>

              {isNotificationsOpen && (
                <div 
                  className="absolute right-0 mt-2.5 w-80 bg-brand-850 border border-brand-700/80 rounded-xl shadow-xl z-dropdown animate-fade-in p-4"
                  role="dialog"
                  aria-label="Notifications Dropdown"
                >
                  <div className="flex items-center justify-between border-b border-brand-700 pb-2.5 mb-2.5">
                    <h3 className="text-xs font-bold text-neutral-200">Notifications</h3>
                    {unreadCount > 0 && (
                      <button 
                        onClick={markAllRead}
                        className="text-[10px] text-accent-400 hover:text-accent-300 font-semibold"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  {/* Notification Category Tabs */}
                  <div className="flex gap-1 mb-3 overflow-x-auto pb-1 border-b border-brand-700/40 scrollbar-hide">
                    {['all', 'elections', 'blockchain', 'organizations', 'system'].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setActiveNotificationTab(cat as any)}
                        className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase transition-all whitespace-nowrap ${
                          activeNotificationTab === cat
                            ? 'bg-accent-600 text-neutral-100'
                            : 'text-neutral-400 hover:text-neutral-200'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <ul className="flex flex-col gap-2 max-h-60 overflow-y-auto scrollbar-hide">
                    {filteredNotifications.length === 0 ? (
                      <li className="text-center py-6 text-neutral-550 text-[10px] font-medium leading-normal">
                        No notifications in this category.
                      </li>
                    ) : (
                      filteredNotifications.map((n) => (
                        <li key={n.id} className={`p-2.5 rounded-lg border text-3xs transition-all ${
                          n.unread ? 'bg-brand-900/40 border-accent-950/40' : 'bg-brand-900/10 border-transparent text-neutral-450'
                        }`}>
                          <div className="font-semibold text-neutral-200 leading-normal">{n.text}</div>
                          <div className="text-[9px] text-neutral-500 mt-1 flex items-center justify-between">
                            <span>{n.timestamp}</span>
                            <span className="text-[7px] px-1 bg-brand-800 rounded font-bold uppercase tracking-wider text-neutral-450">{n.category}</span>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )}
            </div>

            {/* Role indicator pill */}
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-brand-850 border border-brand-700 text-neutral-300">
              {isOwner ? '👑 Platform Owner' : profile?.platform_role === 'organizer' ? '🏛️ Organizer' : '🗳️ Voter'}
            </span>

            {/* Profile Avatar Trigger */}
            <div className="h-8 w-8 rounded-full bg-accent-600 text-neutral-100 font-bold text-xs flex items-center justify-center border border-accent-500 shadow-md shadow-accent-600/10 select-none" title={profile?.email || 'User'}>
              {profile?.full_name?.slice(0, 2).toUpperCase() ?? 'VR'}
            </div>
          </div>
        </header>

        {/* Global Search Results Overlay Modal */}
        {showSearchOverlay && searchQuery && (
          <div 
            className="fixed inset-0 bg-brand-950/70 backdrop-blur-sm z-[999] flex items-start justify-center pt-24 px-4"
            onClick={() => {
              setShowSearchOverlay(false)
              setSearchQuery('')
            }}
          >
            <div 
              className="w-full max-w-lg bg-brand-850 border border-brand-700/60 rounded-2xl shadow-2xl p-5 overflow-hidden flex flex-col gap-4 animate-scale-in"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-label="Global Search Results"
            >
              <div className="flex items-center justify-between border-b border-brand-700/40 pb-2">
                <span className="text-3xs font-bold text-neutral-500 uppercase tracking-widest">Search results for "{searchQuery}"</span>
                <button 
                  onClick={() => {
                    setShowSearchOverlay(false)
                    setSearchQuery('')
                  }}
                  className="text-3xs font-bold text-neutral-400 hover:text-neutral-100 border border-brand-700 hover:bg-brand-800 px-2 py-0.5 rounded"
                >
                  Close (Esc)
                </button>
              </div>

              <div className="max-h-[350px] overflow-y-auto flex flex-col gap-4 scrollbar-hide">
                {!hasSearchResults ? (
                  <div className="text-center py-6 text-neutral-500 text-xs">
                    No matching elections, organizations, or teammates found.
                  </div>
                ) : (
                  <>
                    {searchResults.elections.length > 0 && (
                      <div>
                        <h4 className="text-[10px] font-bold text-accent-400 uppercase tracking-wider mb-1.5">Elections</h4>
                        <ul className="flex flex-col gap-1">
                          {searchResults.elections.map((item, idx) => (
                            <li key={idx} className="p-2 rounded-lg bg-brand-900/60 border border-brand-700/30 text-3xs font-semibold hover:border-accent-600 transition-colors">
                              <Link to="/elections" onClick={() => { setShowSearchOverlay(false); setSearchQuery(''); }} className="block text-neutral-200 hover:text-neutral-100">{item}</Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {searchResults.organizations.length > 0 && (
                      <div>
                        <h4 className="text-[10px] font-bold text-success-400 uppercase tracking-wider mb-1.5">Organizations</h4>
                        <ul className="flex flex-col gap-1">
                          {searchResults.organizations.map((item, idx) => (
                            <li key={idx} className="p-2 rounded-lg bg-brand-900/60 border border-brand-700/30 text-3xs font-semibold text-neutral-300">
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {searchResults.members.length > 0 && (
                      <div>
                        <h4 className="text-[10px] font-bold text-warning-400 uppercase tracking-wider mb-1.5">Members</h4>
                        <ul className="flex flex-col gap-1">
                          {searchResults.members.map((item, idx) => (
                            <li key={idx} className="p-2 rounded-lg bg-brand-900/60 border border-brand-700/30 text-3xs font-semibold text-neutral-300">
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {searchResults.candidates.length > 0 && (
                      <div>
                        <h4 className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-1.5">Candidates</h4>
                        <ul className="flex flex-col gap-1">
                          {searchResults.candidates.map((item, idx) => (
                            <li key={idx} className="p-2 rounded-lg bg-brand-900/60 border border-brand-700/30 text-3xs font-semibold text-neutral-300">
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 pb-20 xl:pb-8">
          {isOffline && (
            <div className="bg-warning-950 border-b border-warning-900/60 px-4 py-2 text-center text-xs font-semibold text-warning-400 flex items-center justify-center gap-2 select-none z-sticky animate-scale-in">
              <WifiOff className="h-4 w-4" />
              <span>OFFLINE MODE: You are viewing previously cached election ledger snapshots.</span>
            </div>
          )}
          {maintenanceActive && (
            <div className="bg-danger-900/90 border-b border-danger-700/80 px-4 py-2 text-center text-xs font-semibold text-danger-200 flex items-center justify-center gap-2 select-none z-sticky">
              <span>⚠️</span> SYSTEM UNDER MAINTENANCE: Database write operations are currently restricted.
            </div>
          )}
          <div className="p-4 sm:p-8 max-w-6xl w-full mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>

        {/* Floating PWA Install Prompt Banner */}
        {showInstallBanner && deferredPrompt && (
          <div className="fixed bottom-24 right-4 sm:right-8 bg-brand-850 border border-brand-700/60 p-4 rounded-xl shadow-2xl max-w-xs w-full z-sticky animate-slide-up flex flex-col gap-2.5">
            <div className="flex gap-2 items-start">
              <Info className="h-5 w-5 text-accent-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-2xs font-bold text-neutral-200 leading-none">Install VotEth 2.0</h4>
                <p className="text-3xs text-neutral-500 mt-1 leading-normal">Add VotEth to your home screen for quick, offline election ballots.</p>
              </div>
            </div>
            <div className="flex gap-2 items-center mt-1">
              <button
                onClick={handleInstallClick}
                className="flex-1 py-1.5 rounded bg-accent-600 hover:bg-accent-500 text-3xs font-bold text-neutral-100 transition-colors"
                type="button"
              >
                Install App
              </button>
              <button
                onClick={() => setShowInstallBanner(false)}
                className="px-3 py-1.5 rounded hover:bg-brand-800 text-3xs font-semibold text-neutral-450 hover:text-neutral-200"
                type="button"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Floating Bottom Nav Bar for Mobile (<768px) */}
        <nav className="fixed bottom-4 left-4 right-4 bg-brand-850/90 backdrop-blur-lg border border-brand-700/60 rounded-2xl p-2.5 flex items-center justify-around md:hidden z-sticky shadow-2xl">
          <Link to="/dashboard" className={`flex flex-col items-center gap-1 p-2 text-3xs font-semibold rounded-xl transition-all ${
            location.pathname === '/dashboard' ? 'text-accent-400' : 'text-neutral-400 hover:text-neutral-100'
          }`}>
            <LayoutDashboard className="h-5 w-5" />
            <span>Home</span>
          </Link>
          <Link to="/elections" className={`flex flex-col items-center gap-1 p-2 text-3xs font-semibold rounded-xl transition-all ${
            location.pathname === '/elections' ? 'text-accent-400' : 'text-neutral-400 hover:text-neutral-100'
          }`}>
            <Vote className="h-5 w-5" />
            <span>Vote</span>
          </Link>
          <Link to={isAdmin ? "/organizer/elections/new" : "/dashboard"} className="flex items-center justify-center h-12 w-12 rounded-full bg-accent-600 hover:bg-accent-500 text-neutral-100 shadow-lg shadow-accent-600/30 transition-transform active:scale-95 -translate-y-4 border-2 border-brand-900">
            <PlusCircle className="h-6 w-6" />
          </Link>
          <Link to="/my-votes" className={`flex flex-col items-center gap-1 p-2 text-3xs font-semibold rounded-xl transition-all ${
            location.pathname === '/my-votes' ? 'text-accent-400' : 'text-neutral-400 hover:text-neutral-100'
          }`}>
            <Receipt className="h-5 w-5" />
            <span>Receipts</span>
          </Link>
          <Link to={isAdmin ? "/organizer/settings" : "/dashboard"} className={`flex flex-col items-center gap-1 p-2 text-3xs font-semibold rounded-xl transition-all ${
            location.pathname.startsWith('/organizer/settings') ? 'text-accent-400' : 'text-neutral-400 hover:text-neutral-100'
          }`}>
            <Settings className="h-5 w-5" />
            <span>Settings</span>
          </Link>
        </nav>
      </div>
    </div>
  )
}
