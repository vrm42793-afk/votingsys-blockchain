import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useWallet } from '@/contexts/WalletContext'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@services/supabase/client'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { 
  Settings, Vote, Database, Palette, ShieldCheck, 
  Check, AlertTriangle, Sliders, Eye, Laptop
} from 'lucide-react'

type SettingsTab = 'general' | 'voting' | 'blockchain' | 'appearance' | 'security'

export function OrgSettingsPage() {
  const { activeMembership, refreshProfile } = useAuth()
  const { address } = useWallet()
  const org = activeMembership?.organization

  // Tabs state
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')

  // General settings state
  const [name, setName] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [description, setDescription] = useState('')
  
  // Voting settings state
  const [allowAiSummaries, setAllowAiSummaries] = useState(true)
  const [defaultBallotType, setDefaultBallotType] = useState('single_choice')
  
  // Blockchain settings state
  const [customRpcUrl, setCustomRpcUrl] = useState('https://rpc-amoy.polygon.technology/')
  const [gasThreshold, setGasThreshold] = useState('50')
  
  // Appearance state
  const [accentTheme, setAccentTheme] = useState('purple')

  // Security state
  const [requireWalletLink, setRequireWalletLink] = useState(true)
  const [inviteExpirationHours, setInviteExpirationHours] = useState('72')
  const [sessionTimeout, setSessionTimeout] = useState('30m')

  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Fetch real Supabase organization audit logs
  const { data: auditLogs, isLoading: logsLoading } = useQuery({
    queryKey: ['org-security-audit-logs', org?.id],
    queryFn: async () => {
      if (!org?.id) return []
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('org_id', org.id)
        .order('created_at', { ascending: false })
        .limit(6)
      if (error) throw error
      return data || []
    },
    enabled: !!org?.id && activeTab === 'security',
  })

  useEffect(() => {
    if (org) {
      setName(org.name)
      setLogoUrl(org.logo_url || '')
      setDescription(org.description || '')
      setAccentTheme(org.accent_theme || 'purple')
    }
  }, [org])

  if (!org) {
    return (
      <div className="p-6 rounded-xl bg-brand-850 border border-brand-700/60 text-center shadow-xl">
        <p className="text-xs text-neutral-400">Please select an organization from the switcher to edit settings.</p>
      </div>
    )
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErrorMsg(null)
    setSuccess(false)

    try {
      if (activeTab === 'general') {
        const { error } = await supabase
          .from('organizations')
          .update({
            name,
            logo_url: logoUrl || null,
            description: description || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', org.id)

        if (error) throw error

        // Log the event
        await supabase.from('audit_logs').insert({
          org_id: org.id,
          action: 'ORGANIZATION_UPDATE',
          metadata: { updated_fields: { name, logo_url: logoUrl, description } }
        })

        await refreshProfile()
      } else if (activeTab === 'appearance') {
        const { error } = await supabase
          .from('organizations')
          .update({
            accent_theme: accentTheme,
            updated_at: new Date().toISOString()
          })
          .eq('id', org.id)

        if (error) throw error

        await supabase.from('audit_logs').insert({
          org_id: org.id,
          action: 'ORGANIZATION_APPEARANCE_UPDATE',
          metadata: { accent_theme: accentTheme }
        })

        await refreshProfile()
      } else {
        // Mock configurations updates saved to logs
        await supabase.from('audit_logs').insert({
          org_id: org.id,
          action: 'ORGANIZATION_UPDATE',
          metadata: { tab: activeTab, timestamp: Date.now() }
        })
      }

      setSuccess(true)
      toast.success('Settings updated successfully!')
      setTimeout(() => setSuccess(false), 4000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update organization details.'
      setErrorMsg(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const tabs: { value: SettingsTab; label: string; icon: any }[] = [
    { value: 'general', label: 'General', icon: Settings },
    { value: 'voting', label: 'Voting', icon: Vote },
    { value: 'blockchain', label: 'Blockchain', icon: Database },
    { value: 'appearance', label: 'Appearance', icon: Palette },
    { value: 'security', label: 'Security', icon: ShieldCheck },
  ]

  return (
    <div className="flex flex-col gap-8 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-3xs font-semibold uppercase tracking-wider text-neutral-500 mb-3">
          <Link to="/organizer" className="hover:text-accent-400 transition-colors">
            Organizer Panel
          </Link>
          <span>/</span>
          <span className="text-neutral-300">Settings</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-100 tracking-tight">
          Organization Settings
        </h1>
        <p className="text-xs sm:text-sm text-neutral-400 mt-1">
          Configure branding, blockchain parameters, and default voting options.
        </p>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-brand-700/60 gap-1 overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.value}
              onClick={() => {
                setActiveTab(tab.value)
                setErrorMsg(null)
                setSuccess(false)
              }}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                activeTab === tab.value
                  ? 'border-accent-500 text-accent-400'
                  : 'border-transparent text-neutral-450 hover:text-neutral-200 hover:border-brand-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {success && (
        <div className="p-3.5 rounded-xl bg-success-500/10 border border-success-950/40 text-2xs text-success-400 flex items-center gap-1.5 animate-scale-in">
          <Check className="h-4 w-4" />
          <span>Workspace settings updated successfully.</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-danger-950 border border-danger-900/60 text-2xs text-danger-400 flex items-center gap-1.5 animate-shake">
          <AlertTriangle className="h-4 w-4" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-brand-850 border border-brand-700/60 rounded-2xl p-6 shadow-xl flex flex-col gap-6">
        
        {/* GENERAL TAB PANEL */}
        {activeTab === 'general' && (
          <div className="flex flex-col gap-5 animate-fade-in">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2 flex items-center gap-2">
              <Sliders className="h-4 w-4 text-accent-500" />
              General Organization Info
            </h3>
            
            <div>
              <label className="block text-2xs font-bold text-neutral-400 uppercase tracking-widest mb-2">Organization Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-brand-900 border border-brand-700 rounded-lg text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-accent-500"
              />
            </div>

            <div>
              <label className="block text-2xs font-bold text-neutral-400 uppercase tracking-widest mb-2">Logo URL</label>
              <input
                type="text"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
                className="w-full px-3 py-2 text-xs bg-brand-900 border border-brand-700 rounded-lg text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-accent-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-2xs font-bold text-neutral-400 uppercase tracking-widest mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief details about the organization..."
                rows={4}
                className="w-full px-3 py-2 text-xs bg-brand-900 border border-brand-700 rounded-lg text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-accent-500 leading-normal"
              />
            </div>
          </div>
        )}

        {/* VOTING TAB PANEL */}
        {activeTab === 'voting' && (
          <div className="flex flex-col gap-5 animate-fade-in">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2 flex items-center gap-2">
              <Vote className="h-4 w-4 text-accent-500" />
              Ballot defaults
            </h3>
            
            <div className="flex items-center justify-between border-b border-brand-700/30 pb-4">
              <div>
                <label className="block text-xs font-bold text-neutral-200">AI Summary Manifestos</label>
                <span className="text-[10px] text-neutral-500 leading-normal block">Automatically compile candidate text into short summaries.</span>
              </div>
              <input 
                type="checkbox"
                checked={allowAiSummaries}
                onChange={(e) => setAllowAiSummaries(e.target.checked)}
                className="w-4 h-4 text-accent-500 rounded bg-brand-900 border-brand-700 focus:ring-accent-500 cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-2xs font-bold text-neutral-400 uppercase tracking-widest mb-2">Default Choice Mechanics</label>
              <select
                value={defaultBallotType}
                onChange={(e) => setDefaultBallotType(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-brand-900 border border-brand-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-accent-500 cursor-pointer"
              >
                <option value="single_choice">Single Choice (Radio Buttons)</option>
                <option value="multi_choice">Multi-Choice (Approval Checkboxes)</option>
              </select>
            </div>
          </div>
        )}

        {/* BLOCKCHAIN TAB PANEL */}
        {activeTab === 'blockchain' && (
          <div className="flex flex-col gap-5 animate-fade-in">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2 flex items-center gap-2">
              <Database className="h-4 w-4 text-accent-500" />
              Web3 ledger RPC settings
            </h3>
            
            <div>
              <label className="block text-2xs font-bold text-neutral-400 uppercase tracking-widest mb-2">Polygon Amoy RPC Endpoint</label>
              <input
                type="text"
                value={customRpcUrl}
                onChange={(e) => setCustomRpcUrl(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-brand-900 border border-brand-700 rounded-lg text-neutral-100 font-mono"
              />
            </div>

            <div>
              <label className="block text-2xs font-bold text-neutral-400 uppercase tracking-widest mb-2">Gas price limit threshold (Gwei)</label>
              <input
                type="number"
                value={gasThreshold}
                onChange={(e) => setGasThreshold(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-brand-900 border border-brand-700 rounded-lg text-neutral-100"
              />
            </div>
          </div>
        )}

        {/* APPEARANCE TAB PANEL */}
        {activeTab === 'appearance' && (
          <div className="flex flex-col gap-5 animate-fade-in">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2 flex items-center gap-2">
              <Palette className="h-4 w-4 text-accent-500" />
              Theme customisation
            </h3>
            
            <div>
              <label className="block text-2xs font-bold text-neutral-400 uppercase tracking-widest mb-3">Accent Brand Theme</label>
              <div className="grid grid-cols-4 gap-3">
                {['purple', 'blue', 'emerald', 'rose'].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setAccentTheme(color)}
                    className={`p-3 rounded-xl border text-center transition-all capitalize text-xs font-bold ${
                      accentTheme === color 
                        ? 'border-accent-500 bg-accent-950/20 text-neutral-100 shadow'
                        : 'border-brand-700 bg-brand-900 text-neutral-450 hover:border-brand-600'
                    }`}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SECURITY TAB PANEL (Extended configurations) */}
        {activeTab === 'security' && (
          <div className="flex flex-col gap-5.5 animate-fade-in">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-accent-500" />
              Security policy parameters
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-3xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Session Timeout Expiry</label>
                <select
                  value={sessionTimeout}
                  onChange={(e) => setSessionTimeout(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-brand-900 border border-brand-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-1 focus:ring-accent-500"
                >
                  <option value="15m">15 Minutes (Idle)</option>
                  <option value="30m">30 Minutes (Idle)</option>
                  <option value="1h">1 Hour (Idle)</option>
                </select>
              </div>

              <div>
                <label className="block text-3xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Moderator Invite Expiry</label>
                <select
                  value={inviteExpirationHours}
                  onChange={(e) => setInviteExpirationHours(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-brand-900 border border-brand-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-1 focus:ring-accent-500"
                >
                  <option value="24">24 Hours</option>
                  <option value="72">72 Hours (Default)</option>
                  <option value="168">7 Days</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-brand-700/40 pt-4.5">
              <div>
                <span className="block text-2xs font-bold text-neutral-200">Enforce Wallet Linking</span>
                <span className="text-[10px] text-neutral-500 leading-normal block">Require members to map Metamask wallets prior to polling.</span>
              </div>
              <input 
                type="checkbox"
                checked={requireWalletLink}
                onChange={(e) => setRequireWalletLink(e.target.checked)}
                className="w-4 h-4 text-accent-500 rounded bg-brand-900 border-brand-700 focus:ring-accent-500 cursor-pointer"
              />
            </div>

            {/* Connected credentials indicator */}
            <div className="p-3 bg-brand-900 border border-brand-700/40 rounded-xl flex items-center justify-between text-3xs">
              <span className="text-neutral-400 font-medium">Mapped Ledger Address:</span>
              <span className="font-mono text-neutral-300 font-bold select-all bg-brand-850 px-2 py-0.5 rounded border border-brand-700/35">
                {address ? `${address.slice(0, 10)}...${address.slice(-6)}` : 'No Wallet Connected'}
              </span>
            </div>

            {/* Active session devices list */}
            <div className="flex flex-col gap-2 pt-2">
              <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-1 select-none">
                <Laptop className="h-3.5 w-3.5 text-accent-500" />
                Active Authorized Sessions
              </h4>
              <div className="flex flex-col gap-2">
                <div className="p-3 rounded-xl bg-brand-900 border border-brand-700/30 flex justify-between items-center text-3xs">
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

            {/* Live Supabase Audit Trail */}
            <div className="flex flex-col gap-3 pt-2">
              <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-1 select-none">
                <Eye className="h-3.5 w-3.5 text-accent-500" />
                Real-Time Security Audit logs
              </h4>
              <div className="flex flex-col gap-2 max-h-48 overflow-y-auto scrollbar-hide">
                {logsLoading ? (
                  <div className="text-center py-4 text-neutral-550 text-3xs">Loading logs timeline...</div>
                ) : !auditLogs || auditLogs.length === 0 ? (
                  <div className="text-center py-4 text-neutral-550 text-3xs">No organization actions logged yet.</div>
                ) : (
                  auditLogs.map((log: any) => (
                    <div key={log.id} className="p-2.5 rounded-lg bg-brand-900 border border-brand-700/30 text-3xs leading-relaxed flex items-start justify-between gap-4">
                      <div>
                        <span className="font-bold text-accent-400 uppercase tracking-wider block mb-0.5">{log.action}</span>
                        <p className="text-neutral-400">{JSON.stringify(log.metadata)}</p>
                      </div>
                      <span className="text-[9px] text-neutral-500 shrink-0 font-mono">{new Date(log.created_at).toLocaleTimeString()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

        {/* Submit Actions */}
        <div className="pt-4 border-t border-brand-700/40 flex items-center justify-end gap-3 print:hidden">
          <Link
            to="/organizer"
            className="px-4 py-2.5 rounded-lg text-xs font-medium text-neutral-450 hover:text-neutral-200 hover:bg-brand-900 transition-colors border border-brand-700"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-lg bg-accent-600 hover:bg-accent-500 disabled:bg-brand-800 disabled:text-neutral-500 text-xs font-bold text-neutral-100 transition-all shadow-md shadow-accent-600/10"
          >
            {saving ? 'Updating...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  )
}
