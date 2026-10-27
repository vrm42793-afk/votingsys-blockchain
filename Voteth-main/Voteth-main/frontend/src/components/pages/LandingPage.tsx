import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export function LandingPage() {
  const { user } = useAuth()

  return (
    <div className="relative py-20 px-4 sm:px-6 lg:px-8">
      {/* Background decorations */}
      <div className="absolute top-10 left-10 -z-below h-[300px] w-[300px] rounded-full bg-accent-600/10 blur-[80px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 -z-below h-[300px] w-[300px] rounded-full bg-brand-500/10 blur-[80px] pointer-events-none" />

      <div className="mx-auto max-w-4xl text-center">
        {/* Badge */}
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-accent-950 text-accent-400 border border-accent-800 mb-6">
          🔒 Blockchain-Anchored & RLS-Enforced
        </span>

        {/* Hero title */}
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl text-neutral-100 mb-6">
          verifiable democracy for <br />
          <span className="gradient-text">modern organizations</span>
        </h1>

        {/* Subtitle */}
        <p className="mx-auto max-w-2xl text-base sm:text-lg text-neutral-400 mb-10 leading-relaxed">
          VotEth 2.0 combines the familiarity of a Web2 experience with the cryptographic integrity of blockchain anchoring. Vote off-chain via Supabase and anchor proofs on Polygon Amoy.
        </p>

        {/* CTAs */}
        <div className="flex justify-center gap-4 mb-20">
          {user ? (
            <Link
              to="/dashboard"
              className="text-sm font-semibold bg-accent-600 hover:bg-accent-500 text-neutral-100 px-6 py-3 rounded-lg shadow-md hover:shadow-accent-600/20 transition-all"
            >
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/auth/login"
                className="text-sm font-semibold bg-accent-600 hover:bg-accent-500 text-neutral-100 px-6 py-3 rounded-lg shadow-md hover:shadow-accent-600/20 transition-all"
              >
                Launch App
              </Link>
              <Link
                to="/auth/register"
                className="text-sm font-semibold bg-brand-800 hover:bg-brand-700 border border-brand-750 text-neutral-200 px-6 py-3 rounded-lg transition-all"
              >
                Register Organization
              </Link>
            </>
          )}
        </div>

        {/* Architectural Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left mt-10">
          <div className="glass-card p-6 border border-brand-700 bg-brand-900/40">
            <div className="text-2xl mb-3">🛡️</div>
            <h3 className="text-md font-bold text-neutral-100 mb-2">RLS Security</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Row-Level Security (RLS) policies isolate tenant data at the Postgres tier. Voter records are shielded from admin visibility.
            </p>
          </div>

          <div className="glass-card p-6 border border-brand-700 bg-brand-900/40">
            <div className="text-2xl mb-3">⛓️</div>
            <h3 className="text-md font-bold text-neutral-100 mb-2">Polygon Anchoring</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Cryptographic hashes of every ballot are recorded to smart contracts on Polygon Amoy, preventing post-election tally manipulation.
            </p>
          </div>

          <div className="glass-card p-6 border border-brand-700 bg-brand-900/40">
            <div className="text-2xl mb-3">🤖</div>
            <h3 className="text-md font-bold text-neutral-100 mb-2">AI Triage Tools</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Deno Edge functions integrate anomaly detection models to highlight potential voter fraud, maintaining election transparency.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
