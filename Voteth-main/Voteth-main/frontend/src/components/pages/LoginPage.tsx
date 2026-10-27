import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@services/supabase/client'
import { toast } from 'sonner'

export function LoginPage() {
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
        // Supabase errors can sometimes have non-string message properties
        const msg = typeof error.message === 'string' && error.message.length > 0
          ? error.message
          : (error.status ? `Login failed (status ${error.status}). Please try again.` : 'Login failed. Please try again.')
        setErrorMsg(msg)
        toast.error(msg)
        setLoading(false)
      }
      // Note: We deliberately do NOT manually execute `navigate` here.
      // Modifying the session triggers the auth listener in `AuthContext`, which 
      // guarantees atomic multi-tenant bootstrapping. `GuestRoute` acts as the 
      // unified boundary to push authenticated users to the dashboard securely.
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected login error occurred.'
      setErrorMsg(message)
      toast.error(message)
      console.error('[LoginPage] Unexpected error:', err)
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-neutral-100 mb-1">Welcome back</h2>
        <p className="text-xs text-neutral-400">Sign in to access your organizations and ballots</p>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-lg bg-danger-900/40 border border-danger-700 text-xs text-danger-400">
          ⚠️ {errorMsg}
        </div>
      )}

      <form onSubmit={handleLogin} className="flex flex-col gap-4">
        <div>
          <label className="block text-3xs font-semibold text-neutral-400 uppercase mb-1.5">
            Email Address
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@organization.edu"
            className="w-full px-3 py-2 text-sm bg-brand-950 border border-brand-700 rounded-lg text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-accent-500 focus:border-accent-500"
          />
        </div>

        <div>
          <label className="block text-3xs font-semibold text-neutral-400 uppercase mb-1.5">
            Password
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-3 py-2 text-sm bg-brand-950 border border-brand-700 rounded-lg text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-accent-500 focus:border-accent-500"
          />
          <div className="flex justify-end mt-1">
            <Link to="/auth/forgot-password" className="text-3xs text-accent-400 hover:underline">
              Forgot password?
            </Link>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg text-sm font-semibold bg-accent-600 hover:bg-accent-500 disabled:bg-brand-800 disabled:text-neutral-500 transition-all text-neutral-100 shadow-md"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <div className="flex flex-col gap-2 text-center text-xs border-t border-brand-700/50 pt-4">
        <span className="text-neutral-500">
          Don't have an account?{' '}
          <Link to="/auth/register" className="text-accent-400 hover:underline">
            Register your Organization
          </Link>
        </span>
      </div>
    </div>
  )
}
