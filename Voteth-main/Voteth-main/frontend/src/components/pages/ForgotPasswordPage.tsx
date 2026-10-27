import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@services/supabase/client'
import { toast } from 'sonner'

/**
 * ForgotPasswordPage — Phase 7.2
 *
 * Allows the user to request a password reset email.
 * Supabase sends a magic-link style email that redirects to /auth/reset-password
 * with a one-time code parameter that AuthCallbackPage exchanges for a session.
 */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })

      if (error) {
        toast.error(error.message)
        setLoading(false)
        return
      }

      setSubmitted(true)
      toast.success('Password reset email sent!')
    } catch (err: unknown) {
      toast.error('An unexpected error occurred.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col gap-6">
        <div className="text-center">
          <div className="text-accent-400 text-4xl mb-4">📧</div>
          <h2 className="text-xl font-bold text-neutral-100 mb-2">Check Your Email</h2>
          <p className="text-sm text-neutral-400 max-w-xs mx-auto">
            We sent a password reset link to{' '}
            <span className="text-accent-400 font-medium">{email}</span>.
            Click the link in the email to set a new password.
          </p>
        </div>

        <div className="flex flex-col gap-2 text-center text-xs border-t border-brand-700/50 pt-4">
          <span className="text-neutral-500">
            Didn't receive the email?{' '}
            <button
              type="button"
              onClick={() => setSubmitted(false)}
              className="text-accent-400 hover:underline"
            >
              Try again
            </button>
          </span>
          <span className="text-neutral-500">
            <Link to="/auth/login" className="text-accent-400 hover:underline">
              Back to Sign In
            </Link>
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-neutral-100 mb-1">Reset Password</h2>
        <p className="text-xs text-neutral-400">
          Enter your email and we'll send you a link to reset your password.
        </p>
      </div>

      <form onSubmit={handleReset} className="flex flex-col gap-4">
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

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg text-sm font-semibold bg-accent-600 hover:bg-accent-500 disabled:bg-brand-800 disabled:text-neutral-500 transition-all text-neutral-100 shadow-md"
        >
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>

      <div className="flex flex-col gap-2 text-center text-xs border-t border-brand-700/50 pt-4">
        <span className="text-neutral-500">
          Remember your password?{' '}
          <Link to="/auth/login" className="text-accent-400 hover:underline">
            Sign In
          </Link>
        </span>
      </div>
    </div>
  )
}
