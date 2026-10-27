import { Link } from 'react-router-dom'
import { BookOpen, CheckCircle, AlertOctagon, UserCheck, Scale, ArrowLeft } from 'lucide-react'

export function VotingRulesPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 flex flex-col gap-8 text-neutral-200">
      <div className="flex items-center gap-2">
        <Link to="/" className="text-xs text-neutral-400 hover:text-accent-400 flex items-center gap-1 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Home
        </Link>
      </div>

      <div className="border-b border-brand-700 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="h-8 w-8 text-accent-400" />
          <h1 className="text-3xl font-bold tracking-tight text-neutral-100">Voting Rules & Operational Guidelines</h1>
        </div>
        <p className="text-sm text-neutral-400">
          Decentralized Governance Rules for VotEth on Ethereum Sepolia
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-brand-900 border border-brand-700/60 p-6 rounded-2xl flex flex-col gap-3">
          <div className="p-2.5 rounded-xl bg-accent-950 border border-accent-800/60 text-accent-400 w-fit">
            <CheckCircle className="h-6 w-6" />
          </div>
          <h3 className="font-bold text-sm text-neutral-100">One Person, One Vote</h3>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Strictly enforced on-chain via the <code>hasAddressVoted</code> smart contract mapping. Once a vote transaction is confirmed, subsequent voting attempts from the same address are reverted with <code>AlreadyVoted()</code>.
          </p>
        </div>

        <div className="bg-brand-900 border border-brand-700/60 p-6 rounded-2xl flex flex-col gap-3">
          <div className="p-2.5 rounded-xl bg-accent-950 border border-accent-800/60 text-accent-400 w-fit">
            <UserCheck className="h-6 w-6" />
          </div>
          <h3 className="font-bold text-sm text-neutral-100">Organizer Approvals</h3>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Any user may register an organization, but creating official elections requires review and activation by the Super Admin / Election Commissioner in the Platform Governance console.
          </p>
        </div>

        <div className="bg-brand-900 border border-brand-700/60 p-6 rounded-2xl flex flex-col gap-3">
          <div className="p-2.5 rounded-xl bg-accent-950 border border-accent-800/60 text-accent-400 w-fit">
            <Scale className="h-6 w-6" />
          </div>
          <h3 className="font-bold text-sm text-neutral-100">Lifecycle Timing</h3>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Elections follow a strict four-state finite state machine: <strong>DRAFT &rarr; OPEN &rarr; CLOSED &rarr; PUBLISHED</strong>. Ballots submitted outside the OPEN state will be rejected by the smart contract.
          </p>
        </div>
      </div>

      <div className="bg-brand-900 border border-brand-700/60 p-6 rounded-2xl flex flex-col gap-5">
        <h2 className="text-base font-bold text-neutral-100 flex items-center gap-2">
          <AlertOctagon className="h-5 w-5 text-accent-400" />
          Voter Responsibilities & Transaction Verification
        </h2>
        
        <div className="flex flex-col gap-4 text-xs text-neutral-400 leading-relaxed">
          <div className="p-4 rounded-xl bg-brand-850 border border-brand-750">
            <h4 className="font-bold text-neutral-200 mb-1">1. Verify Your MetaMask Connection</h4>
            <p>Ensure your wallet is connected to <strong>Ethereum Sepolia Testnet (Chain ID 11155111)</strong>. You will need a small quantity of free Sepolia ETH to pay for transaction gas.</p>
          </div>

          <div className="p-4 rounded-xl bg-brand-850 border border-brand-750">
            <h4 className="font-bold text-neutral-200 mb-1">2. Transaction Confirmation Requirement</h4>
            <p>A ballot is only recorded after your transaction is included in a block and confirmed on Sepolia. If you reject the MetaMask prompt, run out of gas, or the transaction reverts, your vote is not counted.</p>
          </div>

          <div className="p-4 rounded-xl bg-brand-850 border border-brand-750">
            <h4 className="font-bold text-neutral-200 mb-1">3. Save Your Ballot Hash & Receipt</h4>
            <p>Upon transaction completion, a cryptographic receipt hash is issued. You can verify your transaction hash anytime on Sepolia Etherscan at <code>https://sepolia.etherscan.io/tx/&lt;your-hash&gt;</code>.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
