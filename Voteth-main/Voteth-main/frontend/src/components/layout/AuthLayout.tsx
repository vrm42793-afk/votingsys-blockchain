import { Outlet, Link } from 'react-router-dom'

export function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-950 p-4 relative overflow-hidden" style={{ touchAction: 'manipulation' }}>
      {/* Decorative background glow — pointer-events-none prevents blocking mobile touch */}
      <div className="absolute top-1/4 left-1/4 -z-below h-[400px] w-[400px] rounded-full bg-accent-600/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 -z-below h-[400px] w-[400px] rounded-full bg-brand-500/10 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-base">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-2">
            <span className="text-3xl">🗳️</span>
            <span className="font-sans text-2xl font-bold tracking-tight text-neutral-100">
              VotEth <span className="text-accent-500">2.0</span>
            </span>
          </Link>
          <p className="text-xs text-neutral-400">Secure, Multi-Tenant Digital Ballot System</p>
        </div>

        {/* Form Container Card */}
        <div className="glass-card p-8 border border-brand-700 bg-brand-900/60 shadow-lg relative z-raised">
          <Outlet />
        </div>

        {/* Back Link */}
        <div className="text-center mt-6">
          <Link
            to="/"
            className="text-xs text-neutral-500 hover:text-accent-400 transition-colors"
          >
            ← Back to Homepage
          </Link>
        </div>
      </div>
    </div>
  )
}
