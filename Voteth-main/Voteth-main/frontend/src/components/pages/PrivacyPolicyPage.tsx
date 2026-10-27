import { Link } from 'react-router-dom'
import { ShieldCheck, Eye, Lock, Globe, AlertTriangle, ArrowLeft } from 'lucide-react'

export function PrivacyPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 flex flex-col gap-8 text-neutral-200">
      <div className="flex items-center gap-2">
        <Link to="/" className="text-xs text-neutral-400 hover:text-accent-400 flex items-center gap-1 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Home
        </Link>
      </div>

      <div className="border-b border-brand-700 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <ShieldCheck className="h-8 w-8 text-accent-400" />
          <h1 className="text-3xl font-bold tracking-tight text-neutral-100">Privacy Policy & Transparency Notice</h1>
        </div>
        <p className="text-sm text-neutral-400">
          Last updated: October 2026 • Ethereum Sepolia Testnet Compliance Notice
        </p>
      </div>

      {/* Public Blockchain Disclaimer Alert */}
      <div className="p-5 rounded-xl border border-warning-500/40 bg-warning-950/20 flex items-start gap-4 text-warning-200">
        <AlertTriangle className="h-6 w-6 text-warning-400 shrink-0 mt-0.5" />
        <div className="flex flex-col gap-1 text-xs leading-relaxed">
          <span className="font-bold text-sm text-warning-300">Public Ledger Notice & No False Secrecy Promise</span>
          <p>
            Ethereum Sepolia is an open, permissionless public testnet. All block transactions, sender addresses, gas prices, and contract interaction hashes are permanently visible to anyone via block explorers such as Sepolia Etherscan.
          </p>
          <p className="mt-1">
            <strong>VotEth transparently discloses that ballots are not secret without zero-knowledge proofs.</strong> While votes are hashed deterministically with voter IDs and candidate IDs, your connected wallet address is permanently associated with the transaction on the public blockchain.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-brand-900 border border-brand-700/60 p-6 rounded-2xl flex flex-col gap-3">
          <div className="flex items-center gap-2 text-accent-400 font-bold text-sm">
            <Globe className="h-5 w-5" />
            <span>On-Chain Data (Public & Immutable)</span>
          </div>
          <ul className="text-xs text-neutral-400 flex flex-col gap-2 list-disc list-inside leading-relaxed">
            <li>Connected MetaMask Ethereum address (signer).</li>
            <li>Cryptographic vote hash (Keccak-256 digest).</li>
            <li>Candidate identifier hash recorded for on-chain tallies.</li>
            <li>Block height, timestamp, and gas fee usage.</li>
            <li>Public receipt proofs and event logs.</li>
          </ul>
        </div>

        <div className="bg-brand-900 border border-brand-700/60 p-6 rounded-2xl flex flex-col gap-3">
          <div className="flex items-center gap-2 text-success-400 font-bold text-sm">
            <Lock className="h-5 w-5" />
            <span>Off-Chain Data (Protected via RLS)</span>
          </div>
          <ul className="text-xs text-neutral-400 flex flex-col gap-2 list-disc list-inside leading-relaxed">
            <li>User profile information (encrypted emails, auth tokens).</li>
            <li>Organization membership permissions and roles.</li>
            <li>Election drafts, candidate bios, and photos.</li>
            <li>Enforced by Supabase PostgreSQL Row Level Security (RLS).</li>
            <li>Protected from unauthorized access and SQL injection.</li>
          </ul>
        </div>
      </div>

      <div className="flex flex-col gap-4 text-xs text-neutral-400 leading-relaxed bg-brand-900 border border-brand-700/60 p-6 rounded-2xl">
        <h2 className="text-base font-bold text-neutral-100 flex items-center gap-2">
          <Eye className="h-5 w-5 text-accent-400" />
          How We Protect Your Rights
        </h2>
        <p>
          1. <strong>Zero-Trust Architecture:</strong> Authorization is validated simultaneously in smart contracts and database policies. The frontend UI never acts as the sole gatekeeper.
        </p>
        <p>
          2. <strong>Credential Security:</strong> Private keys and Supabase service-role keys are never embedded in or exposed to client-side code. All user signing occurs securely inside your personal MetaMask wallet.
        </p>
        <p>
          3. <strong>Audit Logs:</strong> Administrative actions, election lifecycle transitions, and organizer approvals are recorded in immutable audit logs accessible to authorized auditors and Super Admins.
        </p>
        <p>
          4. <strong>Testnet Use Only:</strong> This platform is deployed for demonstration, governance research, and academic evaluation on Ethereum Sepolia. Free test ETH has zero monetary value.
        </p>
      </div>
    </div>
  )
}
