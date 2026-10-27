import { useState } from 'react'
import { supabase } from '@services/supabase/client'
import { toast } from 'sonner'

export function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        const msg = typeof error.message === 'string' && error.message.length > 0
          ? error.message
          : (error.status ? `Authentication failed (status ${error.status}). Please try again.` : 'Authentication failed. Please try again.')
        setErrorMsg(msg)
        toast.error(msg)
        setLoading(false)
      }
      // GuestRoute boundary will handle routing automatically on auth state change
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected login error occurred.'
      setErrorMsg(message)
      toast.error(message)
      console.error('[AdminLoginPage] Unexpected error:', err)
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-accent-400 mb-1">Platform Admin Access</h2>
        <p className="text-xs text-neutral-400">Secure login for website administrators</p>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-lg bg-danger-900/40 border border-danger-700 text-xs text-danger-400">
          ⚠️ {errorMsg}
        </div>
      )}

      <form onSubmit={handleLogin} className="flex flex-col gap-4">
        <div>
          <label className="block text-3xs font-semibold text-neutral-400 uppercase mb-1.5">
            Admin Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@platform.com"
            className="w-full px-3 py-2 text-sm bg-brand-950 border border-brand-700 rounded-lg text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-accent-500 focus:border-accent-500"
          />
        </div>

        <div>
          <label className="block text-3xs font-semibold text-neutral-400 uppercase mb-1.5">
            Admin Password
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-3 py-2 text-sm bg-brand-950 border border-brand-700 rounded-lg text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-accent-500 focus:border-accent-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg text-sm font-semibold bg-danger-600 hover:bg-danger-500 disabled:bg-brand-800 disabled:text-neutral-500 transition-all text-neutral-100 shadow-md mt-2"
        >
          {loading ? 'Authenticating...' : 'Authenticate as Admin'}
        </button>
      </form>
    </div>
  )
}
