import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@services/supabase/client'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { 
  ShieldCheck, Settings, Database, KeyRound, RefreshCw, Server
} from 'lucide-react'

interface RpcHealthResponse {
  status: 'healthy' | 'degraded' | 'critical'
  chainId?: number
  blockNumber?: number
  latency?: number
  timestamp: string
  error?: string
}

export function PlatformSettingsPage() {
  const { profile } = useAuth()
  
  // Rpc health check state
  const [healthData, setHealthData] = useState<RpcHealthResponse | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)

  // Maintenance mode state
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false)
  const [maintenanceLoading, setMaintenanceLoading] = useState(true)

  // Local simulation states
  const [verboseLogs, setVerboseLogs] = useState(() => {
    return localStorage.getItem('voteth:sim:verbose_logs') === 'true'
  })

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

  // 1. Env validation values
  const envConfig = {
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    chainId: import.meta.env.VITE_CHAIN_ID || '',
    rpcUrl: import.meta.env.VITE_ALCHEMY_RPC_URL || '',
    registryAddr: import.meta.env.VITE_REGISTRY_CONTRACT_ADDRESS || '',
    electionAddr: import.meta.env.VITE_ELECTION_CONTRACT_ADDRESS || '',
    verifierAddr: import.meta.env.VITE_VERIFIER_CONTRACT_ADDRESS || '',
    explorerUrl: 'https://amoy.polygonscan.com'
  }

  const validateConfig = (val: string, type: 'url' | 'key' | 'address' | 'id') => {
    if (!val) return false
    if (type === 'url') return val.startsWith('http://') || val.startsWith('https://')
    if (type === 'address') return val.startsWith('0x') && val.length === 42
    if (type === 'key') return val.length > 20
    if (type === 'id') return !isNaN(Number(val))
    return true
  }

  // 2. Fetch Centralized Maintenance Mode
  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*')
        .eq('key', 'maintenance_mode')
        .maybeSingle()

      if (error) throw error
      if (data) {
        setMaintenanceEnabled(data.value?.enabled === true)
      }
    } catch (err) {
      console.error('Failed to load platform settings:', err)
      toast.error('Failed to load database settings')
    } finally {
      setMaintenanceLoading(false)
    }
  }

  // 3. Update Maintenance Mode
  const toggleMaintenanceMode = async (enabled: boolean) => {
    setMaintenanceLoading(true)
    try {
      const { error } = await supabase
        .from('platform_settings')
        .upsert({
          key: 'maintenance_mode',
          value: { enabled },
          updated_at: new Date().toISOString()
        })

      if (error) throw error

      // Log to platform audit trail
      await supabase.from('audit_logs').insert({
        action: enabled ? 'MAINTENANCE_MODE_ENABLED' : 'MAINTENANCE_MODE_DISABLED',
        target_type: 'platform',
        metadata: { 
          updated_by: profile?.email,
          simulated: false 
        }
      })

      setMaintenanceEnabled(enabled)
      toast.success(enabled ? 'Maintenance mode activated globally!' : 'Maintenance mode deactivated!')
    } catch (err) {
      console.error('Failed to update maintenance settings:', err)
      toast.error('Failed to save settings to database')
    } finally {
      setMaintenanceLoading(false)
    }
  }

  // 4. Trigger Edge Function RPC Health Check
  const checkRpcHealth = async () => {
    setHealthLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('rpc-health')
      if (error) throw error
      setHealthData(data as RpcHealthResponse)
      
      // Log healthy check to audit logs
      await supabase.from('audit_logs').insert({
        action: 'RPC_HEALTH_CHECK',
        target_type: 'blockchain',
        metadata: { status: data.status, latency: data.latency }
      })

      if (data.status === 'healthy') {
        toast.success('RPC Connection Healthy')
      } else {
        toast.warning('RPC Connection Degraded')
      }
    } catch (err) {
      console.error('RPC check failed:', err)
      setHealthData({
        status: 'critical',
        timestamp: new Date().toISOString(),
        error: err instanceof Error ? err.message : 'Unknown Edge Function failure'
      })
      toast.error('Edge Function health check failed')
    } finally {
      setHealthLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
    checkRpcHealth()
  }, [])

  return (
    <div className="flex flex-col gap-8 max-w-5xl w-full mx-auto animate-fade-in">
      {/* Header Panel */}
      <div>
        <div className="flex items-center gap-2 text-3xs font-semibold uppercase tracking-wider text-neutral-500 mb-3">
          <Link to="/admin" className="hover:text-accent-400 transition-colors">
            Platform Owner Dashboard
          </Link>
          <span>/</span>
          <span className="text-neutral-300">Settings</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-100 tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6 text-accent-500" /> Platform Settings
        </h1>
        <p className="text-xs sm:text-sm text-neutral-400 mt-1">
          Monitor deployment configuration variables, check blockchain network health, and manage global system settings.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: Configuration and Health */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Card 1: Configuration Validation */}
          <div className="bg-brand-850 border border-brand-700/60 rounded-2xl p-6 shadow-xl">
            <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-5 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <KeyRound className="h-4.5 w-4.5 text-accent-500" />
                Startup Config Validation
              </span>
              <span className="text-[9px] bg-brand-900 border border-brand-750 px-2 py-0.5 rounded text-neutral-400 font-bold uppercase">
                Environment variables
              </span>
            </h2>
            <div className="flex flex-col gap-3">
              <ConfigRow 
                name="VITE_SUPABASE_URL" 
                value={envConfig.supabaseUrl} 
                valid={validateConfig(envConfig.supabaseUrl, 'url')}
              />
              <ConfigRow 
                name="VITE_SUPABASE_ANON_KEY" 
                value={envConfig.supabaseAnonKey} 
                valid={validateConfig(envConfig.supabaseAnonKey, 'key')}
                isSensitive
              />
              <ConfigRow 
                name="VITE_ALCHEMY_RPC_URL" 
                value={envConfig.rpcUrl} 
                valid={validateConfig(envConfig.rpcUrl, 'url')}
                isSensitive
              />
              <ConfigRow 
                name="VITE_CHAIN_ID" 
                value={envConfig.chainId} 
                valid={validateConfig(envConfig.chainId, 'id')}
              />
              <ConfigRow 
                name="VITE_REGISTRY_CONTRACT_ADDRESS" 
                value={envConfig.registryAddr} 
                valid={validateConfig(envConfig.registryAddr, 'address')}
              />
              <ConfigRow 
                name="VITE_ELECTION_CONTRACT_ADDRESS" 
                value={envConfig.electionAddr} 
                valid={validateConfig(envConfig.electionAddr, 'address')}
              />
              <ConfigRow 
                name="VITE_VERIFIER_CONTRACT_ADDRESS" 
                value={envConfig.verifierAddr} 
                valid={validateConfig(envConfig.verifierAddr, 'address')}
              />
            </div>
          </div>

          {/* Card 2: Blockchain Connectivity Health */}
          <div className="bg-brand-850 border border-brand-700/60 rounded-2xl p-6 shadow-xl">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                <Database className="h-4.5 w-4.5 text-accent-500 animate-pulse" />
                Decentralized Ledger Health
              </h2>
              <button
                onClick={checkRpcHealth}
                disabled={healthLoading}
                className="px-3 py-1.5 text-3xs font-bold rounded-lg bg-accent-600 hover:bg-accent-500 text-neutral-100 disabled:opacity-50 transition-all border border-accent-500 shadow-md shadow-accent-600/10 flex items-center gap-1"
              >
                <RefreshCw className={`h-3 w-3 ${healthLoading ? 'animate-spin' : ''}`} />
                {healthLoading ? 'Testing...' : 'Test Latency'}
              </button>
            </div>

            {healthData ? (
              <div className="grid grid-cols-2 gap-4">
                <HealthStat label="RPC Link Status" value={healthData.status.toUpperCase()} status={healthData.status} />
                <HealthStat label="Polygon Chain ID" value={healthData.chainId?.toString() ?? 'N/A'} status={healthData.chainId === 80002 ? 'healthy' : 'critical'} />
                <HealthStat label="Latest Block Number" value={healthData.blockNumber?.toString() ?? 'N/A'} status={healthData.blockNumber ? 'healthy' : 'critical'} />
                <HealthStat label="Response Latency" value={healthData.latency ? `${healthData.latency}ms` : 'N/A'} status={healthData.latency && healthData.latency < 200 ? 'healthy' : healthData.latency ? 'degraded' : 'critical'} />
                
                <div className="col-span-2 text-3xs text-neutral-500 font-mono mt-1 text-right">
                  Last checked: {new Date(healthData.timestamp).toLocaleString()}
                </div>
                {healthData.error && (
                  <div className="col-span-2 p-3 rounded-xl bg-danger-950 border border-danger-900/40 text-3xs text-danger-400 font-mono">
                    <span className="font-bold uppercase tracking-wider block mb-1">Health Check Exception</span>
                    {healthData.error}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-28 flex flex-col items-center justify-center gap-2 text-neutral-550 border border-dashed border-brand-700 rounded-xl bg-brand-900/10">
                <span className="w-5 h-5 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-3xs font-semibold uppercase tracking-wider">Syncing blockchain stats...</span>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Settings Toggles */}
        <div className="flex flex-col gap-6">
          
          {/* Card 3: Central Maintenance Mode */}
          <div className="bg-brand-850 border border-brand-700/60 rounded-2xl p-6 flex flex-col justify-between min-h-[180px] shadow-xl">
            <div>
              <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                <ShieldCheck className="h-4.5 w-4.5 text-accent-500" />
                Global Maintenance
              </h2>
              <p className="text-3xs text-neutral-500 leading-relaxed mb-4">
                Locks down all database write operations across all organizations. Best for deployment windows, system updates, or security incident responses.
              </p>
            </div>
            
            {maintenanceLoading ? (
              <div className="h-10 w-full bg-brand-900 border border-brand-700/30 rounded-xl animate-pulse" />
            ) : (
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-brand-900 border border-brand-700/40 shadow-inner">
                <span className="text-xs font-bold text-neutral-350">
                  {maintenanceEnabled ? '🔴 Locked (Active)' : '🟢 Operational (Writable)'}
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={maintenanceEnabled}
                    onChange={(e) => toggleMaintenanceMode(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-brand-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-neutral-100 after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-danger-600"></div>
                </label>
              </div>
            )}
          </div>

          {/* Card 4: Local simulation */}
          <div className="bg-brand-850 border border-brand-700/60 rounded-2xl p-6 flex flex-col justify-between min-h-[180px] shadow-xl">
            <div>
              <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                <Server className="h-4.5 w-4.5 text-accent-500" />
                Developer Simulations
              </h2>
              <p className="text-3xs text-neutral-500 leading-relaxed mb-4">
                Local-only configuration overrides for simulating custom logging outputs and system state flags inside the browser console.
              </p>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-brand-900 border border-brand-700/40 shadow-inner">
              <span className="text-xs font-bold text-neutral-350">Verbose Audit Logs</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={verboseLogs}
                  onChange={(e) => {
                    setVerboseLogs(e.target.checked)
                    localStorage.setItem('voteth:sim:verbose_logs', e.target.checked.toString())
                    toast.success('Simulation state updated locally!')
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-brand-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-neutral-100 after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent-600"></div>
              </label>
            </div>
          </div>

          {/* Card 5: Console Theme Accent */}
          <div className="bg-brand-850 border border-brand-700/60 rounded-2xl p-6 flex flex-col justify-between min-h-[180px] shadow-xl">
            <div>
              <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                <Settings className="h-4.5 w-4.5 text-accent-500" />
                Console Theme Accent
              </h2>
              <p className="text-3xs text-neutral-500 leading-relaxed mb-4">
                Personalize the visual theme accent of your superadmin command dashboard environment.
              </p>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {['purple', 'blue', 'emerald', 'rose'].map((color) => {
                const isSelected = activeAccent === color
                return (
                  <button
                    key={color}
                    onClick={() => handleAccentChange(color)}
                    className={`py-2 rounded-xl border text-center transition-all capitalize text-2xs font-bold ${
                      isSelected 
                        ? 'border-accent-500 bg-accent-950/20 text-neutral-100 shadow'
                        : 'border-brand-700 bg-brand-900 text-neutral-450 hover:border-brand-650'
                    }`}
                  >
                    {color}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ConfigRow({ name, value, valid, isSensitive = false }: { name: string; value: string; valid: boolean; isSensitive?: boolean }) {
  const displayVal = isSensitive && value
    ? `${value.slice(0, 12)}...${value.slice(-8)}`
    : value || 'NOT_CONFIGURED'

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-brand-750/70 text-xs">
      <div className="flex flex-col min-w-0 pr-4">
        <span className="font-mono text-neutral-300 font-semibold">{name}</span>
        <span className="text-3xs text-neutral-600 font-mono truncate max-w-sm mt-0.5">{displayVal}</span>
      </div>
      <span className={`px-2 py-0.5 rounded text-3xs font-bold uppercase shrink-0 border ${
        valid 
          ? 'bg-success-900/20 text-success-400 border-success-700/20' 
          : 'bg-danger-900/20 text-danger-400 border-danger-700/20'
      }`}>
        {valid ? 'Valid' : 'Missing'}
      </span>
    </div>
  )
}

function HealthStat({ label, value, status }: { label: string; value: string; status: 'healthy' | 'degraded' | 'critical' }) {
  const badgeColors = 
    status === 'healthy' ? 'bg-success-900/20 text-success-400 border-success-700/20' :
    status === 'degraded' ? 'bg-amber-900/20 text-amber-400 border-warning-700/20' :
    'bg-danger-900/20 text-danger-400 border-danger-700/20'

  return (
    <div className="p-3.5 bg-brand-900/60 border border-brand-700/40 rounded-xl flex flex-col gap-1.5 shadow-sm hover:border-brand-650 transition-colors">
      <span className="text-3xs text-neutral-500 font-bold uppercase tracking-wider">{label}</span>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-neutral-200 font-mono leading-none">{value}</span>
        <span className={`px-2 py-0.5 rounded-full text-3xs font-bold uppercase border leading-none ${badgeColors}`}>
          {status}
        </span>
      </div>
    </div>
  )
}
