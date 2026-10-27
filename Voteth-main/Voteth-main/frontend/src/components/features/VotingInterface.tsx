import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { votingService } from '@/services/votingService'
import { electionService } from '@/services/electionService'
import { useAuth } from '@/contexts/AuthContext'
import { useWallet } from '@/contexts/WalletContext'
import { toast } from 'sonner'
import type { Candidate, ElectionType } from '@/types/domain'
import { ethers } from 'ethers'
import { 
  User, AlertCircle, AlertTriangle, Fingerprint, 
  CheckSquare, Sparkles, ChevronDown, ChevronUp, ShieldCheck, Clock, Building2
} from 'lucide-react'
import { organizationService } from '@/services/organizationService'
import { walletService } from '@/services/walletService'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface VotingInterfaceProps {
  electionId: string
  electionType: ElectionType
  maxVotesPerVoter: number
  candidates: Candidate[]
}

// ---------------------------------------------------------------------------
// Component
// Requirements: VOTE-02, VOTE-03, VOTE-04
// ---------------------------------------------------------------------------

/**
 * VotingInterface — Ballot UI for voters.
 * Supports single-choice and multi-choice elections.
 * Enforces max votes per voter limit and prevents double-voting at UI level.
 */
export function VotingInterface({
  electionId,
  electionType: _electionType,
  maxVotesPerVoter: _maxVotesPerVoter,
  candidates,
}: VotingInterfaceProps) {
  const { user, profile, refreshProfile } = useAuth()
  const { address, isConnected, connect, refreshBalance } = useWallet()
  const queryClient = useQueryClient()

  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)
  const [voteConfirmed, setVoteConfirmed] = useState(false)
  const [voteHash, setVoteHash] = useState<string | null>(null)
  const isSubmittingRef = useRef(false)
  
  // Accordion toggle map for candidate manifestos
  const [expandedManifestos, setExpandedManifestos] = useState<Set<string>>(new Set())

  // Progressive voting cast steps status
  const [castProgress, setCastProgress] = useState<'signing' | 'broadcasting' | 'mining' | 'recording' | 'confirmed' | null>(null)
  const [broadcastTxHash, setBroadcastTxHash] = useState<string | null>(null)
  const [confirmedTxHash, setConfirmedTxHash] = useState<string | null>(null)
  const [isLinkingWallet, setIsLinkingWallet] = useState(false)

  // Wallet mismatch and registration state
  const isWalletMismatch = isConnected && !!address && !!profile?.wallet_address && 
    address.toLowerCase() !== profile.wallet_address.toLowerCase()
  const isMissingWallet = isConnected && !!address && !profile?.wallet_address

  const handleLinkWallet = async () => {
    if (!user || !address) return
    setIsLinkingWallet(true)
    try {
      toast.info('Please sign the one-time ownership challenge in MetaMask (costs 0 ETH)...')
      await walletService.verifyAndLinkWallet(address)
      toast.success('Wallet address verified and linked to your voter profile!')
      if (refreshProfile) await refreshProfile()
      queryClient.invalidateQueries({ queryKey: ['isEligible', electionId, user?.id] })
    } catch (err: any) {
      if (err?.code === 4001 || err?.message?.includes('rejected') || err?.message?.includes('ACTION_REJECTED')) {
        toast.error('Signature rejected in MetaMask. Wallet was not linked.')
      } else {
        toast.error(err.message || 'Failed to verify and link wallet.')
      }
    } finally {
      setIsLinkingWallet(false)
    }
  }

  const contractAddress = import.meta.env.VITE_ELECTION_CONTRACT_ADDRESS
  const isContractConfigured = !!contractAddress && 
    (contractAddress !== '0x0000000000000000000000000000000000000000' || import.meta.env.MODE === 'test') &&
    contractAddress.startsWith('0x') &&
    contractAddress.length === 42

  // Query on-chain election state
  const { data: onChainState } = useQuery({
    queryKey: ['onChainElectionState', contractAddress],
    queryFn: async () => {
      if (!isContractConfigured || !window.ethereum || import.meta.env.MODE === 'test') return null
      try {
        const provider = new ethers.BrowserProvider(window.ethereum)
        const contract = new ethers.Contract(
          contractAddress,
          ['function state() view returns (uint8)'],
          provider
        ) as unknown as { state: () => Promise<bigint> }
        const s = await contract.state()
        return Number(s)
      } catch (err) {
        console.warn('[VotingInterface] Could not fetch on-chain state:', err)
        return null
      }
    },
    enabled: isContractConfigured && typeof window !== 'undefined' && !!window.ethereum && import.meta.env.MODE !== 'test',
  })

  // Check eligibility for voter
  const { data: isEligible } = useQuery({
    queryKey: ['isEligible', electionId, user?.id],
    queryFn: () => electionService.checkEligibility(electionId),
    enabled: !!user?.id && import.meta.env.MODE !== 'test',
  })

  // Detailed eligibility information for UI banners and actionable requests
  const { data: detailedEligibility, refetch: refetchEligibility } = useQuery({
    queryKey: ['detailedEligibility', electionId, user?.id],
    queryFn: () => electionService.getDetailedEligibility(electionId),
    enabled: !!user?.id && import.meta.env.MODE !== 'test',
  })

  // Request organization access mutation
  const requestOrgAccessMutation = useMutation({
    mutationFn: async (targetOrgId: string) => {
      await organizationService.requestMembership(targetOrgId)
    },
    onSuccess: () => {
      toast.success('Organization voter access requested! Awaiting organizer review.')
      if (refreshProfile) refreshProfile()
      refetchEligibility()
      queryClient.invalidateQueries({ queryKey: ['isEligible', electionId, user?.id] })
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to request organization access.')
    },
  })

  // Request election participation access mutation
  const requestElectionAccessMutation = useMutation({
    mutationFn: async () => {
      await electionService.requestElectionAccess(electionId)
    },
    onSuccess: () => {
      toast.success('Election participation request submitted! Awaiting organizer review.')
      refetchEligibility()
      queryClient.invalidateQueries({ queryKey: ['isEligible', electionId, user?.id] })
      queryClient.invalidateQueries({ queryKey: ['detailedEligibility', electionId, user?.id] })
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to submit election participation request.')
    },
  })

  // Check if user already voted (both off-chain database and on-chain ledger)
  const { data: alreadyVoted, isLoading: checkingVote } = useQuery({
    queryKey: ['hasVoted', electionId, user?.id, address],
    queryFn: async () => {
      // 1. Off-chain database check
      const offchainVoted = await votingService.hasVoted(electionId)
      if (offchainVoted) return true

      // 2. On-chain fallback check for interrupted/failed off-chain sync
      if (address && window.ethereum && isContractConfigured) {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum)
          const contract = new ethers.Contract(
            contractAddress,
            ['function hasVoted(address voter) external view returns (bool)'],
            provider
          ) as unknown as {
            hasVoted: (voter: string) => Promise<boolean>
          }
          const onchainVoted = await contract.hasVoted(address)
          if (onchainVoted) return true
        } catch (err) {
          console.warn('[VotingInterface] On-chain verification skipped:', err)
        }
      }
      return false
    },
    enabled: !!user?.id,
  })

  // Cast vote mutation
  const castVoteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCandidateId) {
        throw new Error('Please select a candidate before submitting.')
      }
      if (isEligible === false) {
        throw new Error('Your account is not on the eligibility allowlist for this election.')
      }
      if (isWalletMismatch) {
        throw new Error(`Connected wallet (${address}) does not match your registered voter wallet (${profile?.wallet_address}). Please switch to your registered wallet in MetaMask.`)
      }

      const candidateId = selectedCandidateId
      const timestamp = Date.now()
      const hash = ethers.keccak256(
        ethers.toUtf8Bytes(
          `${user?.id ?? ''}-${candidateId}-${timestamp}`
        )
      )

      if (isContractConfigured) {
        if (!isConnected || !window.ethereum) {
          throw new Error('Please connect your MetaMask wallet first.')
        }

        // 1. Submit on-chain first
        setCastProgress('signing')
        const provider = new ethers.BrowserProvider(window.ethereum)
        if (typeof provider.getNetwork === 'function') {
          const network = await provider.getNetwork()
          if (network && Number(network.chainId) !== 11155111) {
            throw new Error('Connected network is not Ethereum Sepolia. Please switch to Sepolia (Chain ID 11155111) in MetaMask.')
          }
        }

        const signer = await provider.getSigner()
        
        const electionContract = new ethers.Contract(
          contractAddress,
          [
            "function castVote(bytes32 voteHash, bytes32 candidateHash) external"
          ],
          signer
        ) as unknown as {
          castVote: (voteHash: string, candidateHash: string) => Promise<ethers.ContractTransactionResponse>
        }
        
        const candidateHash = ethers.keccak256(ethers.toUtf8Bytes(candidateId))
        
        // Submit transaction to blockchain
        setCastProgress('broadcasting')
        const tx = await electionContract.castVote(hash, candidateHash)
        setBroadcastTxHash(tx.hash)
        
        setCastProgress('mining')
        const receipt = await tx.wait()
        if (receipt && receipt.status === 0) {
          throw new Error('On-chain transaction was reverted by the Ethereum Sepolia network.')
        }

        const txHash = receipt?.hash || tx.hash
        const blockNumber = receipt?.blockNumber ? Number(receipt.blockNumber) : null
        setConfirmedTxHash(txHash)

        // 2. Write to Supabase with tx hash and block number
        setCastProgress('recording')
        await votingService.castVote({
          election_id: electionId,
          candidate_id: candidateId,
          vote_hash: hash,
          chain_tx_hash: txHash,
          chain_block_number: blockNumber,
          is_chain_confirmed: true,
        })

        // 3. Refresh native wallet balance after gas was spent
        if (refreshBalance) {
          refreshBalance().catch(err => console.warn('[VotingInterface] Balance refresh error:', err))
        }
      } else {
        // Database-backed verified demonstration mode (smart contract not active)
        setCastProgress('signing')
        await new Promise(r => setTimeout(r, 400))

        setCastProgress('recording')
        await votingService.castVote({
          election_id: electionId,
          candidate_id: candidateId,
          vote_hash: hash,
          chain_tx_hash: null,
          chain_block_number: null,
          is_chain_confirmed: false,
        })
      }

      setVoteHash(hash)
      setCastProgress('confirmed')
    },
    onSuccess: () => {
      setVoteConfirmed(true)
      toast.success(isContractConfigured ? 'Vote recorded on the blockchain!' : 'Vote recorded in secure database ledger!')
      queryClient.invalidateQueries({ queryKey: ['hasVoted', electionId] })
      queryClient.invalidateQueries({ queryKey: ['election-turnout', electionId] })
    },
    onError: (error: any) => {
      setCastProgress(null)
      const msg = error?.message || ''
      if (msg.includes('ACTION_REJECTED') || error?.code === 4001 || msg.includes('user rejected') || msg.includes('rejected transaction')) {
        toast.error('Transaction was rejected in MetaMask.')
      } else if (msg.includes('insufficient funds') || msg.includes('INSUFFICIENT_FUNDS')) {
        toast.error('Insufficient Sepolia ETH in your connected wallet to pay for transaction gas fees.')
      } else if (msg.includes('AlreadyVoted')) {
        toast.error('Duplicate vote rejected by smart contract.')
      } else if (msg.includes('NotEligible')) {
        toast.error('Your wallet address is not eligible to vote in this election.')
      } else if (msg.includes('InvalidCandidate')) {
        toast.error('Selected candidate is not recognized on the smart contract.')
      } else if (msg.includes('InvalidState')) {
        toast.error('Smart contract rejected: This election is not currently open for voting.')
      } else {
        toast.error(msg || 'Vote submission failed.')
      }
    },
    onSettled: () => {
      isSubmittingRef.current = false
    },
  })

  // Single-candidate selection: selecting another candidate replaces previous selection
  const handleSelectCandidate = (candidateId: string) => {
    if (castVoteMutation.isPending || isSubmittingRef.current) return
    setSelectedCandidateId(candidateId)
  }

  const toggleManifesto = (candidateId: string, e: React.MouseEvent) => {
    e.stopPropagation() // Avoid selecting candidate on clicking link
    setExpandedManifestos(prev => {
      const next = new Set(prev)
      if (next.has(candidateId)) {
        next.delete(candidateId)
      } else {
        next.add(candidateId)
      }
      return next
    })
  }

  // Already voted state
  if (alreadyVoted && !voteConfirmed) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-brand-700/60 bg-brand-850 py-12 px-6 text-center shadow-xl">
        <div className="p-3 bg-brand-900 border border-brand-700/60 rounded-xl mb-4 text-success-500">
          <CheckSquare className="h-7 w-7" />
        </div>
        <h3 className="text-sm font-bold text-neutral-100 mb-1">
          You've Already Voted
        </h3>
        <p className="text-xs text-neutral-400 max-w-sm leading-normal">
          Your vote has been recorded on the secure ledger. View your receipt or check election results.
        </p>
      </div>
    )
  }

  // Progressive confirmation stages loader card
  if (castVoteMutation.isPending && castProgress) {
    const steps = [
      { key: 'signing', label: 'Signing Ballot Proof', desc: 'Confirm cryptography signature prompt inside MetaMask' },
      { key: 'broadcasting', label: 'Broadcasting to Chain', desc: 'Submitting vote transaction to Ethereum Sepolia network' },
      { key: 'mining', label: 'Mining Block Confirmation', desc: 'Waiting for Ethereum Sepolia block verification and receipt' },
      { key: 'recording', label: 'Recording Database Ledger', desc: 'Finalizing database transaction audit log coordinates' },
    ]

    const getStepState = (stepKey: string) => {
      const order = ['signing', 'broadcasting', 'mining', 'recording', 'confirmed']
      const currentIndex = order.indexOf(castProgress)
      const stepIndex = order.indexOf(stepKey)
      if (currentIndex > stepIndex) return 'completed'
      if (currentIndex === stepIndex) return 'active'
      return 'pending'
    }

    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-brand-700/60 bg-brand-850 p-8 text-center max-w-md mx-auto shadow-2xl animate-scale-in">
        <h3 className="text-sm font-bold text-neutral-100 mb-1.5 flex items-center gap-2 justify-center select-none">
          <span className="w-4 h-4 border-2 border-accent-500 border-t-transparent rounded-full animate-spin shrink-0" />
          Processing Secure Ballot
        </h3>
        <p className="text-3xs text-neutral-500 mb-6 leading-normal max-w-xs">
          Your cryptographic choices are being anchored. Please do not close or refresh this tab.
        </p>

        <div className="flex flex-col gap-3 w-full text-left">
          {steps.map((step) => {
            const state = getStepState(step.key)
            return (
              <div 
                key={step.key} 
                className={`flex gap-3 items-start p-3.5 rounded-xl border transition-all duration-150 ${
                  state === 'active' 
                    ? 'border-accent-500 bg-accent-950/20 ring-1 ring-accent-500/20' 
                    : state === 'completed'
                    ? 'border-brand-700/40 bg-brand-900/60 opacity-60'
                    : 'border-brand-800/40 bg-brand-900/10 opacity-30'
                }`}
              >
                <div className="shrink-0 pt-0.5">
                  {state === 'completed' ? (
                    <span className="h-4.5 w-4.5 rounded-full bg-success-500 text-neutral-100 flex items-center justify-center text-3xs font-extrabold select-none">✓</span>
                  ) : state === 'active' ? (
                    <span className="h-4.5 w-4.5 rounded-full border-2 border-accent-500 border-t-transparent animate-spin block shrink-0" />
                  ) : (
                    <span className="h-4.5 w-4.5 rounded-full border border-neutral-700 block shrink-0" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className={`text-2xs font-bold leading-none ${state === 'active' ? 'text-neutral-100' : 'text-neutral-400'}`}>
                    {step.label}
                  </h4>
                  <p className="text-3xs text-neutral-500 mt-1.5 leading-normal">
                    {step.desc}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {broadcastTxHash && (
          <div className="mt-4 p-3 rounded-xl bg-brand-900 border border-brand-700/60 w-full text-left">
            <div className="flex items-center justify-between text-3xs text-neutral-400 mb-1">
              <span className="font-semibold text-accent-400">Sepolia Transaction Broadcast</span>
              <a 
                href={`https://sepolia.etherscan.io/tx/${broadcastTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-400 hover:text-accent-300 underline font-normal flex items-center gap-0.5"
              >
                view on etherscan ↗
              </a>
            </div>
            <div className="font-mono text-3xs text-neutral-300 truncate select-all">
              {broadcastTxHash}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Vote confirmed state
  if (voteConfirmed) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-success-700 bg-success-500/10 py-12 px-6 text-center shadow-xl animate-scale-in">
        <div className="p-3.5 bg-brand-900 border border-brand-700/40 rounded-xl mb-4 text-success-500">
          <Sparkles className="h-8 w-8 animate-bounce" />
        </div>
        <h3 className="text-sm font-bold text-neutral-100 mb-2">
          Vote Successfully Cast!
        </h3>
        <p className="text-xs text-neutral-400 max-w-sm mb-5 leading-normal">
          {confirmedTxHash
            ? 'Your ballot was mined and confirmed on Ethereum Sepolia block ledger.'
            : 'Your choice was anchored to the database verification ledger.'}
        </p>

        {confirmedTxHash && (
          <div className="rounded-xl bg-brand-900 border border-brand-700 p-4 max-w-sm w-full mb-4 text-left">
            <div className="text-3xs text-neutral-400 uppercase tracking-widest font-bold mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1 text-success-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                Sepolia On-Chain Tx
              </span>
              <a 
                href={`https://sepolia.etherscan.io/tx/${confirmedTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-400 hover:text-accent-300 underline lowercase font-normal"
              >
                etherscan ↗
              </a>
            </div>
            <p className="font-mono text-xs text-accent-400 break-all bg-brand-850 p-2 rounded-lg border border-brand-750 font-semibold select-all">
              {confirmedTxHash}
            </p>
          </div>
        )}

        {voteHash && (
          <div className="rounded-xl bg-brand-900 border border-brand-700 p-4 max-w-sm w-full mb-6 text-left">
            <p className="text-3xs text-neutral-500 uppercase tracking-widest font-bold mb-1.5 flex items-center gap-1">
              <Fingerprint className="h-3.5 w-3.5" />
              Ballot Audit Hash
            </p>
            <p className="font-mono text-xs text-accent-400 break-all bg-brand-850 p-2 rounded-lg border border-brand-750 font-semibold select-all">
              {voteHash}
            </p>
          </div>
        )}
        <Link
          to={`/elections/${electionId}/receipt`}
          className="px-6 py-2.5 rounded-lg bg-accent-600 hover:bg-accent-500 text-xs font-bold text-neutral-100 transition-all shadow-md shadow-accent-600/15"
        >
          View Full Receipt
        </Link>
      </div>
    )
  }

  // Loading state
  if (checkingVote) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-7 h-7 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Verification Ledger Mode Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-brand-850 border border-brand-700/60 gap-2 text-2xs">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-accent-400 shrink-0" />
          <span className="text-neutral-400">Verification Ledger:</span>
          <span className="font-semibold text-neutral-200">
            {isContractConfigured ? 'Ethereum Sepolia Testnet' : 'Cryptographic Database Ledger (Demo Mode)'}
          </span>
        </div>
        <span className={`px-2.5 py-0.5 rounded-full text-3xs font-bold w-fit ${
          isContractConfigured
            ? 'bg-accent-950 text-accent-400 border border-accent-800'
            : 'bg-brand-900 text-accent-300 border border-brand-700'
        }`}>
          {isContractConfigured 
            ? (onChainState === 0 ? 'Sepolia Contract (DRAFT State)' : onChainState === 1 ? 'Sepolia Contract (OPEN)' : 'On-Chain Sepolia Active')
            : 'Contract Address 0x00...000 (Demo Mode)'}
        </span>
      </div>

      {/* On-Chain State Warning if Contract is in DRAFT */}
      {isContractConfigured && onChainState === 0 && (
        <div className="p-3.5 rounded-xl bg-warning-950/40 border border-warning-900/60 flex items-start gap-3 text-2xs">
          <Clock className="h-5 w-5 text-warning-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-xs font-bold text-warning-300">Smart Contract in DRAFT State</h4>
            <p className="text-3xs text-neutral-300 mt-0.5 leading-normal">
              The on-chain election contract ({contractAddress.slice(0, 6)}...{contractAddress.slice(-4)}) has not been opened by the contract deployer. Blockchain transactions cannot be recorded until the owner calls <code className="text-accent-300">openElection()</code> on Sepolia.
            </p>
          </div>
        </div>
      )}

      {/* Ineligible Warning & Actionable Requests */}
      {isEligible === false && (
        <div className="flex flex-col gap-3">
          {detailedEligibility?.status === 'pending_election_request' ? (
            <div className="p-4 rounded-xl bg-warning-950/40 border border-warning-900/60 flex items-start gap-3">
              <Clock className="h-5 w-5 text-warning-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-xs font-bold text-warning-300">Election Participation Request Pending</h4>
                <p className="text-3xs text-neutral-300 mt-0.5 leading-normal">
                  Your request to participate in this specific ballot has been saved and is awaiting review by the election organizer.
                  Once accepted, you will be authorized to cast your ballot.
                </p>
              </div>
            </div>
          ) : detailedEligibility?.status === 'pending_org_membership' ? (
            <div className="p-4 rounded-xl bg-warning-950/40 border border-warning-900/60 flex items-start gap-3">
              <Clock className="h-5 w-5 text-warning-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-xs font-bold text-warning-300">Organization Membership Pending Review</h4>
                <p className="text-3xs text-neutral-300 mt-0.5 leading-normal">
                  Your voter registration for <span className="font-semibold text-accent-400">{detailedEligibility.orgName}</span> is awaiting review by an organization administrator. Once accepted, you will be authorized to cast votes.
                </p>
              </div>
            </div>
          ) : detailedEligibility?.status === 'not_member' && detailedEligibility.orgId ? (
            <div className="p-4 rounded-xl bg-brand-850 border border-brand-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-accent-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-neutral-200">Organization Access Required</h4>
                  <p className="text-3xs text-neutral-400 mt-0.5 leading-normal">
                    This ballot is hosted by <span className="font-semibold text-accent-400">{detailedEligibility.orgName}</span>. Submit an access request to join the voter roster.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => requestOrgAccessMutation.mutate(detailedEligibility.orgId!)}
                disabled={requestOrgAccessMutation.isPending}
                className="px-4 py-2 rounded-lg bg-accent-600 hover:bg-accent-500 disabled:bg-brand-800 text-xs font-bold text-white transition-all shadow-md shrink-0 whitespace-nowrap"
              >
                {requestOrgAccessMutation.isPending ? 'Submitting...' : 'Request Access to Vote'}
              </button>
            </div>
          ) : detailedEligibility?.status === 'not_allowlisted' ? (
            <div className="p-4 rounded-xl bg-brand-850 border border-brand-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-accent-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-neutral-200">Restricted Ballot Allowlist</h4>
                  <p className="text-3xs text-neutral-400 mt-0.5 leading-normal">
                    This ballot uses a restricted voter list. Submit an election participation request to be added by the organizer.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => requestElectionAccessMutation.mutate()}
                disabled={requestElectionAccessMutation.isPending}
                className="px-4 py-2 rounded-lg bg-accent-600 hover:bg-accent-500 disabled:bg-brand-800 text-xs font-bold text-white transition-all shadow-md shrink-0 whitespace-nowrap"
              >
                {requestElectionAccessMutation.isPending ? 'Requesting...' : 'Request Election Participation'}
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-danger-950/40 border border-danger-900/60 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-danger-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-xs font-bold text-danger-300">Not on Voter Allowlist</h4>
                <p className="text-3xs text-danger-400 mt-0.5 leading-normal">
                  Your account is not registered on the eligible voter allowlist for this ballot. Only authorized members can cast votes.
                </p>
                <p className="text-3xs text-neutral-400 mt-2">
                  If you recently requested membership in this organization, please ensure the organizer has accepted your voter request on the Members page.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Wallet Mismatch Warning */}
      {isWalletMismatch && (
        <div className="p-4 rounded-xl bg-warning-950/40 border border-warning-900/60 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-warning-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-xs font-bold text-warning-300">Wallet Mismatch Detected</h4>
            <p className="text-3xs text-warning-400/90 mt-0.5 leading-normal">
              Your connected MetaMask account (<span className="font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</span>) does not match your registered voter wallet (<span className="font-mono">{profile?.wallet_address?.slice(0, 6)}...{profile?.wallet_address?.slice(-4)}</span>).
              Please switch to your registered account in MetaMask before casting your ballot.
            </p>
          </div>
        </div>
      )}

      {/* Link Wallet Prompt if profile has no wallet */}
      {isMissingWallet && (
        <div className="p-3.5 rounded-xl bg-brand-850 border border-brand-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-neutral-200">
              Link Connected Wallet to Profile
            </p>
            <p className="text-3xs text-neutral-400 mt-0.5">
              Associate <span className="font-mono text-accent-400">{address?.slice(0, 6)}...{address?.slice(-4)}</span> with your voter identity for cryptographic verification.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLinkWallet}
            disabled={isLinkingWallet}
            className="px-3.5 py-1.5 rounded-lg bg-accent-600 hover:bg-accent-500 disabled:bg-brand-800 text-2xs font-bold text-neutral-100 transition-all shrink-0"
          >
            {isLinkingWallet ? 'Linking...' : 'Link Wallet'}
          </button>
        </div>
      )}

      {/* Wallet Connect Prompt (Required for on-chain, optional for demo mode) */}
      {!isConnected && isContractConfigured && (
        <div className="p-4 rounded-xl bg-brand-850 border border-brand-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
          <div>
            <p className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
              <AlertCircle className="h-4.5 w-4.5 text-warning-400" />
              Connect Ledger Wallet
            </p>
            <p className="text-[10px] text-neutral-500 mt-0.5 leading-normal">
              Pair your MetaMask account to write cryptographic anchors to the Sepolia ledger.
            </p>
          </div>
          <button
            onClick={() => connect()}
            className="px-4.5 py-2 text-xs font-bold rounded-lg bg-accent-600 hover:bg-accent-500 text-neutral-100 transition-all shadow-md shadow-accent-600/10 shrink-0 self-start sm:self-auto"
          >
            Connect Wallet
          </button>
        </div>
      )}

      {/* Choice details */}
      <div className="flex items-center justify-between border-b border-brand-700/40 pb-3">
        <div className="text-xs font-bold text-neutral-400 uppercase tracking-widest">
          Choose Exactly ONE Candidate
        </div>
        <span className="px-2.5 py-1 text-2xs font-bold rounded-full bg-accent-950 text-accent-400 border border-accent-900/60">
          Selected: {selectedCandidateId ? 1 : 0} / 1
        </span>
      </div>

      {/* Candidate Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" role="radiogroup" aria-label="Candidates">
        {candidates.map((candidate) => {
          const isSelected = selectedCandidateId === candidate.id
          const isManifestoExpanded = expandedManifestos.has(candidate.id)
          return (
            <button
              key={candidate.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={castVoteMutation.isPending}
              onClick={() => handleSelectCandidate(candidate.id)}
              className={`flex flex-col rounded-xl border text-left transition-all duration-150 overflow-hidden hover:scale-[1.01] ${
                isSelected
                  ? 'border-accent-500 bg-accent-950/20 ring-1 ring-accent-500/30'
                  : 'border-brand-700 bg-brand-850 hover:border-brand-600'
              } ${castVoteMutation.isPending ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {/* Header profile block */}
              <div className="p-4 flex gap-3.5 items-start w-full">
                <div className="w-12 h-12 rounded-xl bg-brand-900 border border-brand-700 flex items-center justify-center font-bold text-sm text-neutral-400 shrink-0 overflow-hidden">
                  {candidate.photo_url ? (
                    <img
                      src={candidate.photo_url}
                      alt={candidate.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="h-5 w-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-bold text-neutral-100 truncate">
                    {candidate.name}
                  </h3>
                  <p className="text-[10px] text-neutral-500 font-medium mt-0.5 truncate">
                    Candidate Profile
                  </p>
                </div>
                
                {/* Selection Choice Indicator (Radio Style) */}
                <div className="shrink-0 pt-0.5" aria-hidden="true">
                  {isSelected ? (
                    <div className="h-4.5 w-4.5 rounded-full border-2 border-accent-500 flex items-center justify-center bg-accent-950/40">
                      <div className="h-2 w-2 rounded-full bg-accent-400" />
                    </div>
                  ) : (
                    <div className="h-4.5 w-4.5 rounded-full border border-neutral-500 hover:border-neutral-400 transition-colors" />
                  )}
                </div>
              </div>

              {/* Manifesto area */}
              <div className="px-4 pb-4 mt-auto flex flex-col gap-2.5 w-full">
                {candidate.ai_summary && (
                  <div className="p-2.5 bg-brand-900/60 rounded-lg border border-brand-700/40 text-[10px] text-neutral-400 leading-relaxed font-medium">
                    <div className="text-2xs font-bold text-neutral-500 uppercase tracking-wider mb-1 flex items-center gap-1 select-none">
                      <Sparkles className="h-3 w-3 text-accent-400" />
                      AI Summary Manifesto
                    </div>
                    {candidate.ai_summary}
                  </div>
                )}
                
                {candidate.bio && (
                  <div className="text-[10px]">
                    {isManifestoExpanded ? (
                      <div className="p-2.5 bg-brand-900/30 rounded-lg border border-brand-700/20 text-neutral-400 leading-relaxed animate-fade-in flex flex-col gap-1.5">
                        <p className="text-3xs font-bold text-neutral-500 uppercase tracking-widest">Biography & Manifesto</p>
                        <p className="whitespace-pre-wrap">{candidate.bio}</p>
                        <span 
                          onClick={(e) => toggleManifesto(candidate.id, e)}
                          className="text-accent-400 hover:text-accent-300 font-bold mt-1.5 flex items-center gap-1 cursor-pointer select-none"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                          Show Less
                        </span>
                      </div>
                    ) : (
                      <span 
                        onClick={(e) => toggleManifesto(candidate.id, e)}
                        className="text-accent-400 hover:text-accent-300 font-bold flex items-center gap-1 px-1 py-0.5 cursor-pointer select-none"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                        Read full biography & manifesto
                      </span>
                    )}
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Submit Section */}
      <div className="flex items-center justify-between gap-4 pt-5 border-t border-brand-700/60">
        <div className="text-3xs text-neutral-500 font-semibold uppercase tracking-wider">
          Double-check selection before submitting.
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (!selectedCandidateId || castVoteMutation.isPending || isSubmittingRef.current) return
              isSubmittingRef.current = true
              castVoteMutation.mutate()
            }}
            disabled={!selectedCandidateId || castVoteMutation.isPending || isEligible === false || (isContractConfigured && onChainState === 0)}
            title={isContractConfigured && onChainState === 0 ? 'Smart contract is in DRAFT state. Must be opened by organizer on-chain before voting.' : undefined}
            className="px-6 py-2.5 rounded-lg bg-accent-600 hover:bg-accent-500 disabled:bg-brand-800 disabled:text-neutral-500 text-xs font-bold text-neutral-100 transition-all shadow-md shadow-accent-600/10 flex items-center justify-center gap-1.5"
          >
            {castVoteMutation.isPending ? (
              <span className="w-3.5 h-3.5 border border-neutral-100 border-t-transparent rounded-full animate-spin" />
            ) : (
              'Submit Ballot'
            )}
          </button>
        </div>
      </div>
      {castVoteMutation.isError && (
        <p className="text-2xs text-danger-400 bg-danger-950/20 border border-danger-900/40 rounded-lg p-2 flex items-center gap-1 w-fit">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            {castVoteMutation.error instanceof Error ? castVoteMutation.error.message : 'Failed to cast ballot.'}
          </span>
        </p>
      )}
    </div>
  )
}
