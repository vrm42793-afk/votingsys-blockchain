import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@services/supabase/client'
import { toast } from 'sonner'

export function RegisterPage() {
  const [isOrgSignup, setIsOrgSignup] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [orgName, setOrgName] = useState('')
  const [orgSlug, setOrgSlug] = useState('')
  
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            intended_org_name: isOrgSignup ? orgName.trim() : null,
            intended_org_slug: isOrgSignup ? (orgSlug.trim() || null) : null,
          },
        },
      })

      if (error) {
        // Supabase errors can sometimes have non-string message properties
        const msg = typeof error.message === 'string' && error.message.length > 0
          ? error.message
          : (error.status ? `Registration failed (status ${error.status}). Please try again.` : 'Registration failed. Please try again.')
        setErrorMsg(msg)
        toast.error(msg)
      } else if (data?.user?.identities?.length === 0) {
        // User already exists but Supabase returns no error — email is taken
        setErrorMsg('An account with this email already exists. Please sign in instead.')
        toast.error('An account with this email already exists.')
      } else {
        setSuccess(true)
        toast.success('Account created! Check your email for verification.')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected registration error occurred.'
      setErrorMsg(message)
      toast.error(message)
      console.error('[RegisterPage] Unexpected error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <div className="text-4xl">📨</div>
        <h2 className="text-xl font-bold text-neutral-100">Check your inbox</h2>
        <p className="text-xs text-neutral-400 leading-relaxed">
          We sent a verification link to <span className="font-semibold text-neutral-200">{email}</span>. Confirm your email address to initialize your VotEth account.
        </p>
        <Link
          to="/auth/login"
          className="mt-4 py-2.5 rounded-lg text-sm font-semibold bg-brand-800 border border-brand-700 hover:bg-brand-700 transition-all text-neutral-200"
        >
          Return to Login
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-neutral-100 mb-1">Create an account</h2>
        <p className="text-xs text-neutral-400">Join as a voter or register a new organization</p>
      </div>

      {/* Role Selection Tabs */}
      <div className="grid grid-cols-2 p-1 rounded-lg bg-brand-950 border border-brand-800">
        <button
          type="button"
          onClick={() => setIsOrgSignup(false)}
          className={`py-1.5 rounded-md text-xs font-semibold transition-all ${
            !isOrgSignup
              ? 'bg-accent-600 text-neutral-100 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          🗳️ Join as Voter
        </button>
        <button
          type="button"
          onClick={() => setIsOrgSignup(true)}
          className={`py-1.5 rounded-md text-xs font-semibold transition-all ${
            isOrgSignup
              ? 'bg-accent-600 text-neutral-100 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          🏢 Register Org
        </button>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-lg bg-danger-900/40 border border-danger-700 text-xs text-danger-400">
          ⚠️ {errorMsg}
        </div>
      )}

      <form onSubmit={handleRegister} className="flex flex-col gap-4">
        {isOrgSignup && (
          <>
            <div>
              <label className="block text-3xs font-semibold text-neutral-400 uppercase mb-1.5">
                Organization Name
              </label>
              <input
                type="text"
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Apex Corp"
                className="w-full px-3 py-2 text-sm bg-brand-950 border border-brand-700 rounded-lg text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-accent-500 focus:border-accent-500"
              />
            </div>

            <div>
              <label className="block text-3xs font-semibold text-neutral-400 uppercase mb-1.5">
                Organization Slug (optional)
              </label>
              <input
                type="text"
                value={orgSlug}
                onChange={(e) => setOrgSlug(e.target.value)}
                placeholder="apex-corp"
                className="w-full px-3 py-2 text-sm bg-brand-950 border border-brand-700 rounded-lg text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-accent-500 focus:border-accent-500"
              />
            </div>
          </>
        )}

        <div>
          <label className="block text-3xs font-semibold text-neutral-400 uppercase mb-1.5">
            Full Name
          </label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane Doe"
            className="w-full px-3 py-2 text-sm bg-brand-950 border border-brand-700 rounded-lg text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-accent-500 focus:border-accent-500"
          />
        </div>

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
            placeholder="Min. 8 characters"
            className="w-full px-3 py-2 text-sm bg-brand-950 border border-brand-700 rounded-lg text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-accent-500 focus:border-accent-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg text-sm font-semibold bg-accent-600 hover:bg-accent-500 disabled:bg-brand-800 disabled:text-neutral-500 transition-all text-neutral-100 shadow-md"
        >
          {loading ? 'Creating Account...' : isOrgSignup ? 'Register Organization' : 'Sign Up'}
        </button>
      </form>

      <div className="flex flex-col gap-2 text-center text-xs border-t border-brand-700/50 pt-4">
        <span className="text-neutral-500">
          Already have an account?{' '}
          <Link to="/auth/login" className="text-accent-400 hover:underline">
            Sign In
          </Link>
        </span>
      </div>
    </div>
  )
}
