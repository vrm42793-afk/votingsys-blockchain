import { Outlet, Link } from 'react-router-dom'
import { useWallet } from '@/contexts/WalletContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuth } from '@/contexts/AuthContext'

export function PublicLayout() {
  const { address, isConnected, isCorrectNetwork, connect, disconnect } = useWallet()
  const { theme, toggleTheme } = useTheme()
  const { user } = useAuth()

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  return (
    <div className="flex min-h-screen flex-col bg-brand-950 text-neutral-100 transition-colors duration-200">
      {/* Testnet Disclaimer Banner */}
      <div className="bg-gradient-to-r from-accent-950 via-brand-900 to-accent-950 border-b border-accent-800/40 px-4 py-1.5 text-center text-xs text-neutral-300">
        <span className="font-bold text-accent-400 mr-2">⚙️ Sepolia Testnet Environment:</span>
        Transactions use free Sepolia test ETH only. Blockchain data is public and auditable on Etherscan. Ballots use cryptographic commitment hashes.
      </div>

      {/* Header */}
      <header className="sticky top-0 z-sticky w-full border-b border-brand-700 bg-brand-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">🗳️</span>
            <span className="font-sans text-xl font-bold tracking-tight text-neutral-100">
              VotEth <span className="text-accent-500">2.0</span>
            </span>
          </Link>

          {/* Nav Actions */}
          <div className="flex items-center gap-4">
            {/* Wallet Connect */}
            {isConnected && address ? (
              <div className="flex items-center gap-2">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${isCorrectNetwork ? 'bg-success-500 shadow-[0_0_8px_#22c55e]' : 'bg-danger-500'}`} />
                <button
                  onClick={disconnect}
                  className="font-mono text-xs text-neutral-300 hover:text-accent-400 bg-brand-800 px-3 py-1.5 rounded-md border border-brand-700 transition-all"
                  title={isCorrectNetwork ? 'Ethereum Sepolia Testnet' : 'Incorrect Network (Switch to Sepolia)'}
                >
                  {formatAddress(address)}
                </button>
              </div>
            ) : (
              <button
                onClick={() => connect()}
                className="text-xs text-neutral-100 hover:bg-accent-600 bg-accent-500 px-3 py-1.5 rounded-md transition-all font-semibold"
              >
                Connect Wallet
              </button>
            )}

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-md hover:bg-brand-800 text-neutral-300"
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            {/* Dashboard Link / Login */}
            {user ? (
              <Link
                to="/dashboard"
                className="text-xs font-semibold bg-brand-800 hover:bg-brand-700 border border-brand-700 px-3 py-1.5 rounded-md text-neutral-100 transition-all"
              >
                Go to Dashboard
              </Link>
            ) : (
              <Link
                to="/auth/login"
                className="text-xs font-semibold hover:text-accent-400 text-neutral-300 transition-all"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-brand-700 bg-brand-950 py-8">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8 flex flex-col gap-3">
          <div className="flex justify-center items-center gap-6 text-xs text-neutral-400">
            <Link to="/privacy" className="hover:text-accent-400 transition-colors">Privacy Policy</Link>
            <span>•</span>
            <Link to="/rules" className="hover:text-accent-400 transition-colors">Voting Rules</Link>
            <span>•</span>
            <a href="https://sepolia.etherscan.io" target="_blank" rel="noopener noreferrer" className="hover:text-accent-400 transition-colors">Sepolia Explorer</a>
          </div>
          <p className="text-xs text-neutral-500">
            VotEth 2.0 — Secure, Tamper-Evident Hybrid Voting Infrastructure.
          </p>
          <p className="text-2xs text-neutral-600">
            Operational ledger managed via Supabase RLS. Immutable consensus anchored to Ethereum Sepolia Testnet (Chain ID: 11155111).
          </p>
        </div>
      </footer>
    </div>
  )
}
