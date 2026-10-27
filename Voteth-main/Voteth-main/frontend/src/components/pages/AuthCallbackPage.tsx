import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@services/supabase/client'

/**
 * AuthCallbackPage — Handles oauth / email verification redirects.
 * Exchanges the code parameter for a session and redirects to /dashboard.
 * Requirement: AUTH-09, Phase 7.1
 */
export function AuthCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          console.error('[AuthCallback] Error exchanging code for session:', error.message)
          navigate('/auth/login?error=callback_failed')
          return
        }
      }
      navigate('/dashboard')
    }

    handleCallback()
  }, [searchParams, navigate])

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="glass-card p-8 text-center max-w-md border border-brand-700 bg-brand-900/60 rounded-xl">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent-500 border-t-transparent mx-auto mb-4" />
        <h2 className="text-lg font-bold text-neutral-100 mb-1">Completing Sign In</h2>
        <p className="text-xs text-neutral-400">
          Syncing your secure credentials. Please wait...
        </p>
      </div>
    </div>
  )
}
