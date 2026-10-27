import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@services/supabase/client'
import { toast } from 'sonner'

/**
 * ResetPasswordPage — Phase 7.2
 *
 * User arrives here after clicking the password-reset link in their email.
 * Supabase automatically exchanges the URL token for a session when the page loads.
 * The user then enters a new password which is applied via `supabase.auth.updateUser()`.
 */
export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Supabase redirects with a hash fragment containing the recovery token.
  // The JS client auto-picks it up via onAuthStateChange.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true)
      }
    })

    // Also check if user already has a session (e.g. refreshed page)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        setErrorMsg(error.message)
        toast.error('Failed to update password.')
        setLoading(false)
        return
      }

      toast.success('Password updated successfully!')
      navigate('/dashboard')
    } catch (err: unknown) {
      setErrorMsg('An unexpected error occurred.')
      console.error(err)
      setLoading(false)
    }
  }

  if (!sessionReady) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="glass-card p-8 text-center max-w-md border border-brand-700 bg-brand-900/60 rounded-xl">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent-500 border-t-transparent mx-auto mb-4" />
          <h2 className="text-lg font-bold text-neutral-100 mb-1">Verifying Reset Link</h2>
          <p className="text-xs text-neutral-400">
            Validating your password reset token. Please wait...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-neutral-100 mb-1">Set New Password</h2>
        <p className="text-xs text-neutral-400">
          Enter your new password below. Must be at least 8 characters.
        </p>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-lg bg-danger-900/40 border border-danger-700 text-xs text-danger-400">
          ⚠️ {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-3xs font-semibold text-neutral-400 uppercase mb-1.5">
            New Password
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-3 py-2 text-sm bg-brand-950 border border-brand-700 rounded-lg text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-accent-500 focus:border-accent-500"
          />
        </div>

        <div>
          <label className="block text-3xs font-semibold text-neutral-400 uppercase mb-1.5">
            Confirm New Password
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-3 py-2 text-sm bg-brand-950 border border-brand-700 rounded-lg text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-accent-500 focus:border-accent-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg text-sm font-semibold bg-accent-600 hover:bg-accent-500 disabled:bg-brand-800 disabled:text-neutral-500 transition-all text-neutral-100 shadow-md"
        >
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </div>
  )
}
