import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { electionService } from '@/services/electionService'
import { candidateService } from '@/services/candidateService'
import { organizationService } from '@/services/organizationService'
import { ipfsService } from '@/services/ipfsService'
import { supabase } from '@services/supabase/client'
import { toast } from 'sonner'
import { Globe, ExternalLink, Copy, Check, RefreshCw, ShieldCheck } from 'lucide-react'
import { ethers } from 'ethers'
import type { ElectionStatus } from '@/types/domain'

/**
 * ElectionDetailPage — Shows election details, candidates, and status.
 * Contains full administrator controls when accessed by an org admin.
 * Route: /elections/:electionId or /admin/elections/:electionId
 */
export function ElectionDetailPage() {
  const { electionId } = useParams<{ electionId: string }>()
  const { activeMembership } = useAuth()
  const queryClient = useQueryClient()

  // Tabs state for admin view
  const [activeTab, setActiveTab] = useState<'overview' | 'candidates' | 'voters'>('overview')

  // Candidate creation form state
  const [candName, setCandName] = useState('')
  const [candBio, setCandBio] = useState('')
  const [candPhoto, setCandPhoto] = useState('')
  const [candError, setCandError] = useState<string | null>(null)

  // Voter manual add state
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [copiedCid, setCopiedCid] = useState(false)

  // 1. Fetch Election Detail
  const { data: election, isLoading: isElectionLoading } = useQuery({
    queryKey: ['election', electionId],
    queryFn: () => electionService.getById(electionId!),
    enabled: !!electionId,
  })

  const isAdmin = activeMembership?.role === 'admin' && activeMembership.org_id === election?.org_id

  // 2. Fetch Candidates (Admins see all; voters see approved only)
  const { data: candidates, refetch: refetchCandidates } = useQuery({
    queryKey: ['candidates', electionId, isAdmin],
    queryFn: () =>
      isAdmin
        ? candidateService.listByElection(electionId!)
        : candidateService.listApproved(electionId!),
    enabled: !!electionId,
  })

  // 3. Fetch Allowlist (Admin only)
  const { data: voters, refetch: refetchVoters } = useQuery({
    queryKey: ['election-voters', electionId],
    queryFn: () => electionService.listVoters(electionId!),
    enabled: !!electionId && isAdmin,
  })

  // 4. Fetch Organization Members (Admin only, for allowlist adding)
  const { data: orgMembers } = useQuery({
    queryKey: ['org-members', activeMembership?.org_id],
    queryFn: () => organizationService.getMembers(activeMembership!.org_id),
    enabled: !!activeMembership?.org_id && isAdmin,
  })

  // 5. Turnout Metrics (Admin only)
  const { data: turnoutMetrics } = useQuery({
    queryKey: ['election-turnout', electionId],
    queryFn: () => electionService.getTurnout(electionId!),
    enabled: !!electionId && isAdmin && election?.status !== 'draft',
  })

  // =========================================================================
  // MUTATIONS (Admin only)
  // =========================================================================

  const transitionMutation = useMutation({
    mutationFn: (status: ElectionStatus) => electionService.transitionStatus(electionId!, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['election', electionId] })
    },
  })

  const archiveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('elections')
        .update({ is_archived: true })
        .eq('id', electionId!)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['election', electionId] })
    },
  })

  const syncIpfsMutation = useMutation({
    mutationFn: async () => {
      if (!election) throw new Error('Election data not loaded')
      const manifest = {
        version: '1.0.0' as const,
        election_id: electionId!,
        org_id: election.org_id,
        title: election.title,
        description: election.description,
        election_type: election.election_type,
        max_votes_per_voter: election.max_votes_per_voter,
        start_date: election.start_date,
        end_date: election.end_date,
        created_at: election.created_at,
        candidates: (candidates ?? []).map(c => ({
          id: c.id,
          name: c.name,
          bio: c.bio,
          photo_url: c.photo_url,
          display_order: c.display_order,
        })),
      }
      const res = await ipfsService.uploadElectionManifest(manifest)
      const { error } = await supabase
        .from('elections')
        .update({ ipfs_cid: res.cid })
        .eq('id', electionId!)
      if (error) throw error
      return res
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['election', electionId] })
      toast.success(res.isLocalFallback
        ? `Manifest pinned locally (Deterministic CID: ${res.cid.slice(0, 12)}...)`
        : `Manifest published to IPFS! CID: ${res.cid.slice(0, 12)}...`)
    },
    onError: (err: any) => {
      toast.error('Failed to pin manifest to IPFS: ' + (err?.message || 'Unknown error'))
    },
  })

  const reorderCandidateMutation = useMutation({
    mutationFn: async ({ candidateId, direction }: { candidateId: string; direction: 'up' | 'down' }) => {
      const index = candidates?.findIndex(c => c.id === candidateId) ?? -1
      if (index === -1 || !candidates) return

      const siblingIndex = direction === 'up' ? index - 1 : index + 1
      if (siblingIndex < 0 || siblingIndex >= candidates.length) return

      const c1 = candidates[index]
      const c2 = candidates[siblingIndex]
      if (!c1 || !c2) return

      const { error } = await supabase
        .from('candidates')
        .update({ display_order: c2.display_order })
        .eq('id', c1.id)
      if (error) throw error

      const { error: error2 } = await supabase
        .from('candidates')
        .update({ display_order: c1.display_order })
        .eq('id', c2.id)
      if (error2) throw error2
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates', electionId] })
    },
  })

  const addCandidateMutation = useMutation({
    mutationFn: async (payload: { name: string; bio: string; photoUrl: string }) => {
      await candidateService.create({
        election_id: electionId!,
        name: payload.name,
        bio: payload.bio || null,
        photo_url: payload.photoUrl || null,
      })
    },
    onSuccess: () => {
      setCandName('')
      setCandBio('')
      setCandPhoto('')
      setCandError(null)
      refetchCandidates()
    },
    onError: (err: Error) => {
      setCandError(err.message)
    },
  })

  const approveCandidateMutation = useMutation({
    mutationFn: (id: string) => candidateService.approve(id),
    onSuccess: () => refetchCandidates(),
  })

  const rejectCandidateMutation = useMutation({
    mutationFn: (id: string) => candidateService.reject(id),
    onSuccess: () => refetchCandidates(),
  })

  const deleteCandidateMutation = useMutation({
    mutationFn: (id: string) => candidateService.delete(id),
    onSuccess: () => refetchCandidates(),
  })

  const addVoterMutation = useMutation({
    mutationFn: (userId: string) => electionService.addVoter(electionId!, userId),
    onSuccess: () => {
      setSelectedMemberId('')
      refetchVoters()
      toast.success('Voter added to election allowlist.')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to add voter.')
    },
  })

  const approveElectionVoterMutation = useMutation({
    mutationFn: (userId: string) => electionService.approveElectionVoter(electionId!, userId),
    onSuccess: () => {
      refetchVoters()
      toast.success('Voter approved for this election.')
      queryClient.invalidateQueries({ queryKey: ['isEligible', electionId] })
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to approve voter.')
    },
  })

  const rejectElectionVoterMutation = useMutation({
    mutationFn: (userId: string) => electionService.rejectElectionVoter(electionId!, userId),
    onSuccess: () => {
      refetchVoters()
      toast.success('Election participation request rejected.')
      queryClient.invalidateQueries({ queryKey: ['isEligible', electionId] })
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to reject voter request.')
    },
  })

  const removeVoterMutation = useMutation({
    mutationFn: (voterId: string) => electionService.removeVoter(voterId),
    onSuccess: () => {
      refetchVoters()
      toast.success('Voter removed from allowlist.')
      queryClient.invalidateQueries({ queryKey: ['isEligible', electionId] })
    },
  })

  const addAllVotersMutation = useMutation({
    mutationFn: () => electionService.addAllOrgMembersToVoters(electionId!, activeMembership!.org_id),
    onSuccess: () => {
      refetchVoters()
      toast.success('All organization members added to allowlist.')
      queryClient.invalidateQueries({ queryKey: ['isEligible', electionId] })
    },
  })

  // =========================================================================
  // HANDLERS
  // =========================================================================

  const handleCreateCandidate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!candName.trim()) {
      setCandError('Candidate name is required')
      return
    }
    addCandidateMutation.mutate({ name: candName, bio: candBio, photoUrl: candPhoto })
  }

  const handleAddVoter = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMemberId) return
    addVoterMutation.mutate(selectedMemberId)
  }

  const contractAddress = import.meta.env.VITE_ELECTION_CONTRACT_ADDRESS
  const isContractConfigured = !!contractAddress && 
    contractAddress !== '0x0000000000000000000000000000000000000000' &&
    contractAddress.startsWith('0x') &&
    contractAddress.length === 42

  const [isSyncingBlockchain, setIsSyncingBlockchain] = useState(false)

  // Query on-chain smart contract state and total votes
  const { data: onChainContractState, refetch: refetchOnChainContractState } = useQuery({
    queryKey: ['onChainElectionState', contractAddress],
    queryFn: async () => {
      if (!isContractConfigured || !window.ethereum || import.meta.env.MODE === 'test') return null
      try {
        const provider = new ethers.BrowserProvider(window.ethereum)
        const contract = new ethers.Contract(
          contractAddress,
          [
            'function state() view returns (uint8)',
            'function getTotalVotes() view returns (uint256)',
            'function owner() view returns (address)',
            'function voterEligibilityEnabled() view returns (bool)'
          ],
          provider
        ) as any
        const [st, votes, ownerAddr, eligibilityEnabled] = await Promise.all([
          contract.state(),
          contract.getTotalVotes(),
          contract.owner(),
          contract.voterEligibilityEnabled().catch(() => false),
        ])
        return {
          state: Number(st), // 0=DRAFT, 1=OPEN, 2=CLOSED, 3=PUBLISHED
          totalVotes: Number(votes),
          owner: ownerAddr as string,
          eligibilityEnabled: Boolean(eligibilityEnabled),
        }
      } catch (err) {
        console.warn('[ElectionDetailPage] Error reading contract state:', err)
        return null
      }
    },
    enabled: isContractConfigured && typeof window !== 'undefined' && !!window.ethereum && import.meta.env.MODE !== 'test',
  })

  const handleSyncBlockchainAllowlist = async () => {
    if (!isContractConfigured) {
      toast.info('Blockchain contract address is not configured. Platform is operating in Cryptographic Database Mode.')
      return
    }
    if (election?.status !== 'draft') {
      toast.error('The on-chain smart contract only permits allowlist modifications in DRAFT state.')
      return
    }
    const voterWallets = voters
      ?.filter(v => (!v.status || v.status === 'approved') && v.user_profile?.wallet_address)
      .map(v => v.user_profile!.wallet_address!) ?? []

    if (voterWallets.length === 0) {
      toast.warning('No approved voters with linked wallet addresses found to synchronize.')
      return
    }

    try {
      setIsSyncingBlockchain(true)
      const ethereum = (window as any).ethereum
      if (!ethereum) throw new Error('MetaMask is required to submit on-chain transactions.')
      const provider = new ethers.BrowserProvider(ethereum)
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(
        contractAddress,
        [
          'function setVoterEligibilityBatch(address[] calldata voters, bool eligible) external',
          'function enableVoterEligibility(bool enabled) external',
          'function owner() external view returns (address)'
        ],
        signer
      ) as unknown as {
        owner: () => Promise<string>
        setVoterEligibilityBatch: (voters: string[], eligible: boolean) => Promise<ethers.ContractTransactionResponse>
      }
      const network = await provider.getNetwork()
      if (Number(network.chainId) !== 11155111) {
        throw new Error('Connected network is not Ethereum Sepolia. Please switch to Sepolia (Chain ID 11155111) in MetaMask.')
      }

      const contractOwner = await contract.owner()
      const signerAddress = await signer.getAddress()
      if (contractOwner.toLowerCase() !== signerAddress.toLowerCase()) {
        throw new Error(`Connected wallet (${signerAddress.slice(0, 6)}...) is not the contract deployer owner (${contractOwner.slice(0, 6)}...). Please switch to the deployer wallet in MetaMask.`)
      }

      toast.info('Submitting allowlist batch to Sepolia testnet...')
      const tx = await contract.setVoterEligibilityBatch(voterWallets, true)
      toast.info(`Transaction broadcasted: ${tx.hash.slice(0, 10)}... Awaiting Sepolia block confirmation...`)
      const receipt = await tx.wait()
      if (receipt && receipt.status === 0) {
        throw new Error('Allowlist transaction reverted on Sepolia.')
      }
      toast.success(`Successfully synchronized ${voterWallets.length} voter addresses to Sepolia! (Block #${receipt?.blockNumber})`)
      refetchOnChainContractState()
    } catch (err: any) {
      toast.error(err.message || 'Failed to synchronize allowlist to blockchain.')
    } finally {
      setIsSyncingBlockchain(false)
    }
  }

  const handleOpenBlockchainElection = async () => {
    if (!isContractConfigured) return
    try {
      setIsSyncingBlockchain(true)
      const ethereum = (window as any).ethereum
      if (!ethereum) throw new Error('MetaMask is required.')
      const provider = new ethers.BrowserProvider(ethereum)
      const network = await provider.getNetwork()
      if (Number(network.chainId) !== 11155111) {
        throw new Error('Please switch MetaMask to Ethereum Sepolia Testnet (Chain ID 11155111).')
      }
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(
        contractAddress,
        [
          'function openElection() external',
          'function owner() external view returns (address)'
        ],
        signer
      ) as any
      const contractOwner = await contract.owner()
      const signerAddress = await signer.getAddress()
      if (contractOwner.toLowerCase() !== signerAddress.toLowerCase()) {
        throw new Error(`Connected wallet (${signerAddress.slice(0, 6)}...) is not the contract deployer owner (${contractOwner.slice(0, 6)}...). Please switch to the deployer account in MetaMask.`)
      }
      toast.info('Submitting openElection transaction to Sepolia testnet...')
      const tx = await contract.openElection()
      toast.info(`Broadcasted tx: ${tx.hash.slice(0, 10)}... Waiting for block confirmation...`)
      const receipt = await tx.wait()
      if (receipt && receipt.status === 0) throw new Error('openElection transaction reverted on Sepolia.')
      toast.success(`Smart contract transitioned to OPEN on Sepolia! (Block #${receipt?.blockNumber})`)
      await transitionMutation.mutateAsync('open')
      refetchOnChainContractState()
    } catch (err: any) {
      toast.error(err.message || 'Failed to open election on blockchain.')
    } finally {
      setIsSyncingBlockchain(false)
    }
  }

  const handleCloseBlockchainElection = async () => {
    if (!isContractConfigured) return
    try {
      setIsSyncingBlockchain(true)
      const ethereum = (window as any).ethereum
      if (!ethereum) throw new Error('MetaMask is required.')
      const provider = new ethers.BrowserProvider(ethereum)
      const network = await provider.getNetwork()
      if (Number(network.chainId) !== 11155111) {
        throw new Error('Please switch MetaMask to Ethereum Sepolia Testnet (Chain ID 11155111).')
      }
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(
        contractAddress,
        [
          'function closeElection() external',
          'function owner() external view returns (address)'
        ],
        signer
      ) as any
      const contractOwner = await contract.owner()
      const signerAddress = await signer.getAddress()
      if (contractOwner.toLowerCase() !== signerAddress.toLowerCase()) {
        throw new Error(`Connected wallet (${signerAddress.slice(0, 6)}...) is not the contract deployer owner (${contractOwner.slice(0, 6)}...). Please switch to the deployer account in MetaMask.`)
      }
      toast.info('Submitting closeElection transaction to Sepolia testnet...')
      const tx = await contract.closeElection()
      toast.info(`Broadcasted tx: ${tx.hash.slice(0, 10)}... Waiting for block confirmation...`)
      const receipt = await tx.wait()
      if (receipt && receipt.status === 0) throw new Error('closeElection transaction reverted on Sepolia.')
      toast.success(`Smart contract transitioned to CLOSED on Sepolia! (Block #${receipt?.blockNumber})`)
      await transitionMutation.mutateAsync('closed')
      refetchOnChainContractState()
    } catch (err: any) {
      toast.error(err.message || 'Failed to close election on blockchain.')
    } finally {
      setIsSyncingBlockchain(false)
    }
  }

  const handlePublishBlockchainResults = async () => {
    if (!isContractConfigured) return
    try {
      setIsSyncingBlockchain(true)
      const ethereum = (window as any).ethereum
      if (!ethereum) throw new Error('MetaMask is required.')
      const provider = new ethers.BrowserProvider(ethereum)
      const network = await provider.getNetwork()
      if (Number(network.chainId) !== 11155111) {
        throw new Error('Please switch MetaMask to Ethereum Sepolia Testnet (Chain ID 11155111).')
      }
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(
        contractAddress,
        [
          'function publishResults() external',
          'function owner() external view returns (address)'
        ],
        signer
      ) as any
      const contractOwner = await contract.owner()
      const signerAddress = await signer.getAddress()
      if (contractOwner.toLowerCase() !== signerAddress.toLowerCase()) {
        throw new Error(`Connected wallet (${signerAddress.slice(0, 6)}...) is not the contract deployer owner (${contractOwner.slice(0, 6)}...). Please switch to the deployer account in MetaMask.`)
      }
      toast.info('Submitting publishResults transaction to Sepolia testnet...')
      const tx = await contract.publishResults()
      toast.info(`Broadcasted tx: ${tx.hash.slice(0, 10)}... Waiting for block confirmation...`)
      const receipt = await tx.wait()
      if (receipt && receipt.status === 0) throw new Error('publishResults transaction reverted on Sepolia.')
      toast.success(`Smart contract results published on Sepolia! (Block #${receipt?.blockNumber})`)
      await transitionMutation.mutateAsync('published')
      refetchOnChainContractState()
    } catch (err: any) {
      toast.error(err.message || 'Failed to publish results on blockchain.')
    } finally {
      setIsSyncingBlockchain(false)
    }
  }

  // Loading indicator
  if (isElectionLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-8 w-48 rounded bg-brand-900 animate-pulse" />
        <div className="h-40 rounded-xl bg-brand-900 border border-brand-700 animate-pulse" />
      </div>
    )
  }

  // Not found state
  if (!election) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <span className="text-4xl mb-3">🔍</span>
        <h2 className="text-lg font-bold text-neutral-100 mb-1">Election Not Found</h2>
        <p className="text-sm text-neutral-400">
          This election may have been removed or you don't have access.
        </p>
      </div>
    )
  }

  const statusColors: Record<ElectionStatus, string> = {
    draft: 'bg-neutral-700 text-neutral-300',
    open: 'bg-success-900/50 text-success-400 border border-success-700 shadow-[0_0_6px_rgba(34,197,94,0.1)]',
    closed: 'bg-brand-800 text-neutral-400 border border-brand-700',
    published: 'bg-accent-900/50 text-accent-400 border border-accent-700',
  }

  // Filter org members who are not yet on the voter allowlist
  const allowlistedUserIds = new Set(voters?.map(v => v.user_id) ?? [])
  const nonAllowlistedMembers = orgMembers?.filter(m => !allowlistedUserIds.has(m.user_id)) ?? []

  return (
    <div className="flex flex-col gap-8 max-w-4xl">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <Link to={isAdmin ? '/organizer' : '/elections'} className="hover:text-accent-400 transition-colors">
            {isAdmin ? 'Organizer Panel' : 'Elections'}
          </Link>
          <span>/</span>
          <span className="text-neutral-300 truncate max-w-[200px]" title={election.title}>
            {election.title}
          </span>
        </div>
      </div>

      {/* Main Title Banner */}
      <div className="rounded-xl bg-brand-900 border border-brand-700 p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-2xs font-semibold capitalize ${
                  statusColors[election.status] ?? 'bg-brand-800 text-neutral-400'
                }`}
              >
                {election.status}
              </span>
              <span className="text-3xs text-neutral-500 font-semibold uppercase tracking-wider">
                ID: {election.id.slice(0, 8)}...
              </span>
            </div>
            <h1 className="text-2xl font-bold text-neutral-100 tracking-tight mt-2">
              {election.title}
            </h1>
            {election.description && (
              <p className="text-sm text-neutral-400 mt-2 leading-relaxed">{election.description}</p>
            )}
          </div>
        </div>

        {/* Configuration Meta */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-4 border-t border-brand-700">
          <MetaItem
            label="Ballot Type"
            value={election.election_type === 'single_choice' ? 'Single Choice' : 'Multi Choice'}
          />
          <MetaItem label="Max Choices" value={String(election.max_votes_per_voter)} />
          <MetaItem
            label="Start Date"
            value={election.start_date ? new Date(election.start_date).toLocaleString() : 'TBD'}
          />
          <MetaItem
            label="End Date"
            value={election.end_date ? new Date(election.end_date).toLocaleString() : 'TBD'}
          />
        </div>
      </div>

      {/* Administrative Tabs Navigation */}
      {isAdmin && (
        <div className="border-b border-brand-700 flex gap-4">
          <TabButton
            active={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
            label="Overview & Status"
            icon="📊"
          />
          <TabButton
            active={activeTab === 'candidates'}
            onClick={() => setActiveTab('candidates')}
            label="Manage Candidates"
            icon="👥"
          />
          <TabButton
            active={activeTab === 'voters'}
            onClick={() => setActiveTab('voters')}
            label="Voter Allowlist"
            icon="📜"
          />
        </div>
      )}

      {/* =========================================================================
          TAB: OVERVIEW (Available to both Voters and Admins)
          ========================================================================= */}
      {(!isAdmin || activeTab === 'overview') && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Content Column */}
          <div className="md:col-span-2 flex flex-col gap-6">
            {/* Approved Candidates List (Voter facing) */}
            <section className="rounded-xl bg-brand-900 border border-brand-700 p-5">
              <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider mb-4">
                Approved Candidates ({candidates?.filter(c => c.status === 'approved').length ?? 0})
              </h2>
              {!candidates || candidates.filter(c => c.status === 'approved').length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-brand-700 bg-brand-900/40 py-10 px-6 text-center">
                  <span className="text-3xl mb-2">👤</span>
                  <p className="text-xs text-neutral-500">No approved candidates listed on the ballot.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {candidates
                    .filter(c => c.status === 'approved')
                    .map(c => (
                      <div
                        key={c.id}
                        className="rounded-lg bg-brand-950 border border-brand-700/60 p-4 flex gap-4 hover:border-brand-600 transition-colors"
                      >
                        <div className="w-12 h-12 rounded-full bg-brand-800 border border-brand-600 flex items-center justify-center text-sm font-bold text-neutral-400 shrink-0 overflow-hidden">
                          {c.photo_url ? (
                            <img src={c.photo_url} alt={c.name} className="w-full h-full object-cover" />
                          ) : (
                            c.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-neutral-100">{c.name}</p>
                          {c.bio && <p className="text-xs text-neutral-400 mt-1 leading-relaxed">{c.bio}</p>}
                          {c.ai_summary && (
                            <div className="mt-2.5 p-2 rounded bg-brand-900 border border-brand-800 text-3xs text-accent-400 leading-normal flex items-start gap-1">
                              <span>🤖</span>
                              <p className="italic">AI Summary: {c.ai_summary}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </section>
          </div>

          {/* Sidebar Panel Column */}
          <div className="flex flex-col gap-6">
            {/* Admin Control Actions Card */}
            {isAdmin && (
              <section className="rounded-xl bg-brand-900 border border-brand-700 p-5 flex flex-col gap-4">
                <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">
                  Admin Lifecycle
                </h2>

                {isContractConfigured && onChainContractState && (
                  <div className="p-3 rounded-lg bg-brand-950 border border-brand-800 flex flex-col gap-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400">Sepolia State:</span>
                      <span className={`px-2 py-0.5 rounded text-3xs font-bold uppercase tracking-wider ${
                        onChainContractState.state === 1
                          ? 'bg-success-950 text-success-400 border border-success-800'
                          : onChainContractState.state === 0
                          ? 'bg-warning-950 text-warning-400 border border-warning-800'
                          : 'bg-brand-900 text-neutral-300 border border-brand-700'
                      }`}>
                        {onChainContractState.state === 0 && 'DRAFT'}
                        {onChainContractState.state === 1 && 'OPEN'}
                        {onChainContractState.state === 2 && 'CLOSED'}
                        {onChainContractState.state === 3 && 'PUBLISHED'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-3xs text-neutral-500">
                      <span>On-Chain Votes:</span>
                      <span className="font-mono text-neutral-300">{onChainContractState.totalVotes}</span>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  {election.status === 'draft' && (
                    <div className="flex flex-col gap-2">
                      {isContractConfigured && (
                        <button
                          onClick={handleOpenBlockchainElection}
                          disabled={isSyncingBlockchain || transitionMutation.isPending}
                          className="w-full py-2.5 rounded-lg bg-accent-600 hover:bg-accent-500 disabled:bg-brand-800 text-xs font-bold text-white transition-all shadow-md flex items-center justify-center gap-1.5"
                        >
                          ⚡ Open On-Chain via Sepolia
                        </button>
                      )}
                      <button
                        onClick={() => transitionMutation.mutate('open')}
                        disabled={transitionMutation.isPending || isSyncingBlockchain}
                        className="w-full py-2 rounded-lg bg-success-600/90 hover:bg-success-500 disabled:bg-brand-800 text-xs font-bold text-neutral-100 transition-all shadow-sm"
                      >
                        🚀 Open in App Database
                      </button>
                    </div>
                  )}
                  {election.status === 'open' && (
                    <div className="flex flex-col gap-2">
                      {isContractConfigured && (
                        <button
                          onClick={handleCloseBlockchainElection}
                          disabled={isSyncingBlockchain || transitionMutation.isPending}
                          className="w-full py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:bg-brand-800 text-xs font-bold text-white transition-all shadow-md flex items-center justify-center gap-1.5"
                        >
                          🔒 Close On-Chain via Sepolia
                        </button>
                      )}
                      <button
                        onClick={() => transitionMutation.mutate('closed')}
                        disabled={transitionMutation.isPending || isSyncingBlockchain}
                        className="w-full py-2 rounded-lg bg-danger-600/90 hover:bg-danger-500 disabled:bg-brand-800 text-xs font-bold text-neutral-100 transition-all shadow-sm"
                      >
                        🔒 Close in App Database
                      </button>
                    </div>
                  )}
                  {election.status === 'closed' && (
                    <div className="flex flex-col gap-2">
                      {isContractConfigured && (
                        <button
                          onClick={handlePublishBlockchainResults}
                          disabled={isSyncingBlockchain || transitionMutation.isPending}
                          className="w-full py-2.5 rounded-lg bg-accent-600 hover:bg-accent-500 disabled:bg-brand-800 text-xs font-bold text-white transition-all shadow-md flex items-center justify-center gap-1.5"
                        >
                          📢 Publish On-Chain via Sepolia
                        </button>
                      )}
                      <button
                        onClick={() => transitionMutation.mutate('published')}
                        disabled={transitionMutation.isPending || isSyncingBlockchain}
                        className="w-full py-2 rounded-lg bg-accent-600/80 hover:bg-accent-500 disabled:bg-brand-800 text-xs font-bold text-neutral-100 transition-all shadow-sm"
                      >
                        📢 Publish in App Database
                      </button>
                    </div>
                  )}
                  {election.status === 'published' && !election.is_archived && (
                    <button
                      onClick={() => archiveMutation.mutate()}
                      disabled={archiveMutation.isPending}
                      className="w-full py-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:bg-brand-800 text-xs font-bold text-neutral-100 transition-all shadow-md mt-2"
                    >
                      📦 Archive Election
                    </button>
                  )}
                  {election.status === 'published' && election.is_archived && (
                    <div className="p-3 text-center rounded-lg bg-neutral-950/40 border border-neutral-900/60 text-2xs text-neutral-400 mt-2">
                      📦 This election is archived.
                    </div>
                  )}
                  {election.status === 'published' && !election.is_archived && (
                    <div className="p-3 text-center rounded-lg bg-accent-950/40 border border-accent-900/60 text-2xs text-accent-400">
                      ✅ Results are fully published on the platform and ledger.
                    </div>
                  )}
                </div>

                <p className="text-3xs text-neutral-500 leading-normal">
                  Elections must progress strictly through: Draft ➔ Open ➔ Closed ➔ Published. Configuration is locked once voting opens.
                </p>
              </section>
            )}

            {/* IPFS Decentralized Manifest Card */}
            <section className="rounded-xl bg-brand-900 border border-brand-700 p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-2xs font-bold text-accent-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Globe className="h-4 w-4" />
                  IPFS Storage
                </span>
                <span className="px-2 py-0.5 text-3xs font-semibold rounded-full bg-accent-950 text-accent-400 border border-accent-900/60">
                  Decentralized
                </span>
              </div>
              <p className="text-3xs text-neutral-400 leading-normal">
                Public ballot manifest, candidate biographies, and rules are cryptographically pinned to IPFS.
              </p>

              {election.ipfs_cid ? (
                <div className="flex flex-col gap-2">
                  <div className="p-2.5 rounded-lg bg-brand-950 border border-brand-700/60 flex items-center justify-between gap-2">
                    <span className="font-mono text-3xs text-neutral-300 truncate" title={election.ipfs_cid}>
                      CID: {election.ipfs_cid.slice(0, 16)}...{election.ipfs_cid.slice(-6)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(election.ipfs_cid!)
                        setCopiedCid(true)
                        setTimeout(() => setCopiedCid(false), 2000)
                        toast.success('IPFS CID copied to clipboard!')
                      }}
                      className="p-1 text-neutral-400 hover:text-neutral-200 transition-colors"
                      title="Copy CID"
                    >
                      {copiedCid ? <Check className="h-3.5 w-3.5 text-success-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <a
                    href={ipfsService.getGatewayUrl(election.ipfs_cid)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-brand-850 hover:bg-brand-800 border border-brand-700 text-3xs font-semibold text-accent-400 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    View on IPFS Gateway
                  </a>
                </div>
              ) : (
                <div className="p-3 text-center rounded-lg bg-brand-950 border border-brand-800 text-3xs text-neutral-500">
                  No manifest pinned yet.
                </div>
              )}

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => syncIpfsMutation.mutate()}
                  disabled={syncIpfsMutation.isPending}
                  className="mt-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-accent-950/60 hover:bg-accent-900/60 border border-accent-800/60 text-2xs font-semibold text-accent-300 transition-colors"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${syncIpfsMutation.isPending ? 'animate-spin' : ''}`} />
                  {syncIpfsMutation.isPending ? 'Pinning to IPFS...' : (election.ipfs_cid ? 'Sync Manifest with IPFS' : 'Pin Manifest to IPFS')}
                </button>
              )}
            </section>

            {/* Voter Actions Card (Ballot active) */}
            {!isAdmin && election.status === 'open' && (
              <section className="rounded-xl bg-brand-900 border border-brand-700 p-5 flex flex-col gap-3 text-center">
                <span className="text-3xl">🗳️</span>
                <h3 className="text-sm font-semibold text-neutral-200">Voting is Active</h3>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  You are registered on the allowlist for this election. Go to the ballot to cast your secure cryptographically signed vote.
                </p>
                <Link
                  to={`/elections/${electionId}/vote`}
                  className="mt-2 w-full py-2.5 rounded-lg bg-accent-600 hover:bg-accent-500 text-xs font-semibold text-neutral-100 transition-all shadow-md shadow-accent-600/20"
                >
                  Cast Your Ballot
                </Link>
              </section>
            )}

            {/* Voter Results Link */}
            {election.status === 'published' && (
              <section className="rounded-xl bg-brand-900 border border-brand-700 p-5 flex flex-col gap-3 text-center">
                <span className="text-3xl">📊</span>
                <h3 className="text-sm font-semibold text-neutral-200">Results Published</h3>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Tally calculations are complete and verified against the blockchain record.
                </p>
                <Link
                  to={`/elections/${electionId}/results`}
                  className="mt-2 w-full py-2.5 rounded-lg bg-brand-800 hover:bg-brand-750 text-xs font-semibold text-neutral-200 border border-brand-600 transition-all"
                >
                  View Results Summary
                </Link>
              </section>
            )}

            {/* Turnout Stats Card (Admin only) */}
            {isAdmin && election.status !== 'draft' && turnoutMetrics && (
              <section className="rounded-xl bg-brand-900 border border-brand-700 p-5 flex flex-col gap-3">
                <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">
                  Live Participation
                </h2>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-neutral-100">
                    {turnoutMetrics.turnout_percent}%
                  </span>
                  <span className="text-xs text-neutral-500">turnout</span>
                </div>
                <div className="w-full bg-brand-950 rounded-full h-1.5 border border-brand-800">
                  <div
                    className="bg-accent-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(turnoutMetrics.turnout_percent, 100)}%` }}
                  />
                </div>
                <p className="text-3xs text-neutral-500 mt-1">
                  Voted: <span className="text-neutral-300 font-medium">{turnoutMetrics.total_voted}</span> / {turnoutMetrics.total_eligible} eligible users.
                </p>
              </section>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB: MANAGE CANDIDATES (Admin Only)
          ========================================================================= */}
      {isAdmin && activeTab === 'candidates' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Candidates List/Approval Queue */}
          <div className="md:col-span-2 flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider">
              Election Candidates ({candidates?.length ?? 0})
            </h2>

            {!candidates || candidates.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-brand-700 bg-brand-900/40 py-12 px-6 text-center">
                <span className="text-4xl mb-2">👥</span>
                <h3 className="text-sm font-semibold text-neutral-200 mb-1">No candidates</h3>
                <p className="text-xs text-neutral-500">Create the first candidate using the sidebar form.</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {candidates.map(c => {
                  const statusColors: Record<string, string> = {
                    pending: 'bg-warning-900/40 text-warning-400 border border-warning-800/60',
                    approved: 'bg-success-900/40 text-success-400 border border-success-800/60',
                    rejected: 'bg-danger-900/40 text-danger-400 border border-danger-800/60',
                    withdrawn: 'bg-neutral-800 text-neutral-500 border border-neutral-700',
                  }

                  return (
                    <li
                      key={c.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg bg-brand-900 border border-brand-700 px-4 py-4 gap-4"
                    >
                      <div className="flex gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-brand-800 border border-brand-600 flex items-center justify-center text-sm font-bold text-neutral-400 shrink-0 overflow-hidden">
                          {c.photo_url ? (
                            <img src={c.photo_url} alt={c.name} className="w-full h-full object-cover" />
                          ) : (
                            c.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-neutral-100 truncate">{c.name}</span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-3xs font-semibold capitalize ${
                                statusColors[c.status] ?? 'bg-brand-800 text-neutral-400'
                              }`}
                            >
                              {c.status}
                            </span>
                          </div>
                          {c.bio && <p className="text-xs text-neutral-500 mt-1 leading-normal line-clamp-2">{c.bio}</p>}
                        </div>
                      </div>

                      {/* Candidate Actions */}
                      <div className="flex gap-2 self-end sm:self-center shrink-0">
                        {c.status === 'pending' && (
                          <>
                            <button
                              onClick={() => approveCandidateMutation.mutate(c.id)}
                              className="px-2.5 py-1 text-2xs font-semibold rounded bg-success-900/50 text-success-400 hover:bg-success-900 border border-success-800 transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => rejectCandidateMutation.mutate(c.id)}
                              className="px-2.5 py-1 text-2xs font-semibold rounded bg-danger-900/50 text-danger-400 hover:bg-danger-900 border border-danger-800 transition-colors"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {election.status === 'draft' && (
                          <div className="flex gap-1 mr-2">
                            <button
                              title="Move Up"
                              onClick={() => reorderCandidateMutation.mutate({ candidateId: c.id, direction: 'up' })}
                              className="px-2 py-1 text-3xs font-bold rounded bg-brand-950 text-neutral-400 hover:text-neutral-200 border border-brand-800 disabled:opacity-30"
                              disabled={candidates.indexOf(c) === 0}
                            >
                              ▲
                            </button>
                            <button
                              title="Move Down"
                              onClick={() => reorderCandidateMutation.mutate({ candidateId: c.id, direction: 'down' })}
                              className="px-2 py-1 text-3xs font-bold rounded bg-brand-950 text-neutral-400 hover:text-neutral-200 border border-brand-800 disabled:opacity-30"
                              disabled={candidates.indexOf(c) === candidates.length - 1}
                            >
                              ▼
                            </button>
                          </div>
                        )}
                        {election.status === 'draft' && (
                          <button
                            onClick={() => deleteCandidateMutation.mutate(c.id)}
                            className="px-2.5 py-1 text-2xs font-semibold rounded bg-brand-950 text-neutral-500 hover:text-danger-400 hover:bg-brand-950/60 border border-brand-800 transition-all"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Add Candidate Form Sidebar */}
          <div>
            <section className="rounded-xl bg-brand-900 border border-brand-700 p-5 flex flex-col gap-4">
              <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">
                Add Candidate
              </h2>

              <form onSubmit={handleCreateCandidate} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-2xs font-bold text-neutral-500 uppercase">Display Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alice Smith"
                    value={candName}
                    onChange={e => setCandName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-brand-950 border border-brand-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-1 focus:ring-accent-500"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-2xs font-bold text-neutral-500 uppercase">Candidate Bio</label>
                  <textarea
                    rows={3}
                    placeholder="Short campaign biography..."
                    value={candBio}
                    onChange={e => setCandBio(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-brand-950 border border-brand-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-1 focus:ring-accent-500"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-2xs font-bold text-neutral-500 uppercase">Photo URL</label>
                  <input
                    type="url"
                    placeholder="https://example.com/photo.jpg"
                    value={candPhoto}
                    onChange={e => setCandPhoto(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-brand-950 border border-brand-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-1 focus:ring-accent-500"
                  />
                </div>

                {candError && <p className="text-2xs text-danger-400">⚠️ {candError}</p>}

                <button
                  type="submit"
                  disabled={addCandidateMutation.isPending}
                  className="w-full py-2.5 rounded-lg bg-accent-600 hover:bg-accent-500 text-xs font-semibold text-neutral-100 transition-all shadow-md"
                >
                  {addCandidateMutation.isPending ? 'Adding...' : 'Add Candidate'}
                </button>
              </form>
            </section>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB: MANAGE VOTERS (Admin Only)
          ========================================================================= */}
      {isAdmin && activeTab === 'voters' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Allowlist Voter List */}
          <div className="md:col-span-2 flex flex-col gap-4">
            {/* Pending Election Requests */}
            {voters?.some(v => v.status === 'pending') && (
              <div className="flex flex-col gap-2 p-4 rounded-xl bg-warning-950/30 border border-warning-900/60 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-warning-400 font-bold text-xs uppercase tracking-wider">
                    Pending Participation Requests ({voters.filter(v => v.status === 'pending').length})
                  </span>
                </div>
                <ul className="flex flex-col gap-2 mt-1">
                  {voters
                    .filter(v => v.status === 'pending')
                    .map(v => (
                      <li
                        key={v.id}
                        className="flex items-center justify-between rounded-lg bg-brand-900 border border-warning-800/40 px-3.5 py-2.5"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-brand-800 border border-brand-600 flex items-center justify-center text-xs font-bold text-neutral-300 shrink-0">
                            {v.user_profile?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-neutral-100 block truncate">
                              {v.user_profile?.full_name ?? 'Anonymous User'}
                            </span>
                            {v.user_profile?.wallet_address && (
                              <span className="font-mono text-[9px] text-accent-400 block truncate">
                                {v.user_profile.wallet_address.slice(0, 6)}...{v.user_profile.wallet_address.slice(-4)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => rejectElectionVoterMutation.mutate(v.user_id)}
                            disabled={rejectElectionVoterMutation.isPending}
                            className="px-2.5 py-1 text-3xs font-semibold rounded bg-danger-900/30 text-danger-400 hover:bg-danger-900/60 border border-danger-800 transition-colors"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => approveElectionVoterMutation.mutate(v.user_id)}
                            disabled={approveElectionVoterMutation.isPending}
                            className="px-3 py-1 text-3xs font-bold rounded bg-success-600 hover:bg-success-500 text-white transition-colors shadow-sm"
                          >
                            Accept
                          </button>
                        </div>
                      </li>
                    ))}
                </ul>
              </div>
            )}

            <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider">
              Approved Voters ({voters?.filter(v => !v.status || v.status === 'approved').length ?? 0})
            </h2>

            {!voters || voters.filter(v => !v.status || v.status === 'approved').length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-brand-700 bg-brand-900/40 py-12 px-6 text-center">
                <span className="text-4xl mb-2">📜</span>
                <h3 className="text-sm font-semibold text-neutral-200 mb-1">No voters allowlisted</h3>
                <p className="text-xs text-neutral-500">Add organization members using the form on the right.</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-1">
                {voters
                  .filter(v => !v.status || v.status === 'approved')
                  .map(v => (
                    <li
                      key={v.id}
                      className="flex items-center justify-between rounded-lg bg-brand-900 border border-brand-700 px-4 py-3 hover:border-brand-600 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-brand-800 border border-brand-600 flex items-center justify-center text-xs font-bold text-neutral-400 shrink-0">
                          {v.user_profile?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-neutral-100 truncate block">
                            {v.user_profile?.full_name ?? 'Anonymous User'}
                          </span>
                          {v.user_profile?.wallet_address ? (
                            <span className="font-mono text-[10px] text-accent-400/80 block truncate">
                              {v.user_profile.wallet_address.slice(0, 6)}...{v.user_profile.wallet_address.slice(-4)}
                            </span>
                          ) : (
                            <span className="text-[10px] text-neutral-500 block">No wallet linked</span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => removeVoterMutation.mutate(v.id)}
                        disabled={removeVoterMutation.isPending}
                        className="px-2 py-1 text-3xs font-semibold rounded bg-danger-900/30 text-danger-400 hover:bg-danger-900/60 border border-danger-800 transition-colors"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </div>

          {/* Add Voter Form/Bulk Actions Sidebar */}
          <div className="flex flex-col gap-6">
            {/* Add Member Card */}
            <section className="rounded-xl bg-brand-900 border border-brand-700 p-5 flex flex-col gap-4">
              <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">
                Add Voter
              </h2>

              <form onSubmit={handleAddVoter} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-2xs font-bold text-neutral-500 uppercase">Org Member</label>
                  {nonAllowlistedMembers.length === 0 ? (
                    <p className="text-xs text-neutral-500 italic">All organization members are already on the allowlist.</p>
                  ) : (
                    <select
                      value={selectedMemberId}
                      onChange={e => setSelectedMemberId(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-brand-950 border border-brand-700 rounded-lg text-neutral-300 focus:outline-none focus:ring-1 focus:ring-accent-500"
                    >
                      <option value="">-- Select Member --</option>
                      {nonAllowlistedMembers.map(m => (
                        <option key={m.user_id} value={m.user_id}>
                          {m.user_profile?.full_name ?? 'Anonymous member'}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!selectedMemberId || addVoterMutation.isPending}
                  className="w-full py-2.5 rounded-lg bg-accent-600 hover:bg-accent-500 disabled:bg-brand-800 disabled:text-neutral-500 text-xs font-semibold text-neutral-100 transition-all shadow-md"
                >
                  {addVoterMutation.isPending ? 'Adding...' : 'Add to Election'}
                </button>
              </form>
            </section>

            {/* Bulk Add Card */}
            <section className="rounded-xl bg-brand-900 border border-brand-700 p-5 flex flex-col gap-4">
              <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">
                Bulk Add
              </h2>
              <p className="text-xs text-neutral-500 leading-relaxed">
                Add all members of the organization to this election's allowlist with a single click.
              </p>
              <button
                onClick={() => addAllVotersMutation.mutate()}
                disabled={addAllVotersMutation.isPending || !orgMembers || orgMembers.length === 0}
                className="w-full py-2.5 rounded-lg bg-brand-850 hover:bg-brand-800 text-xs font-semibold text-neutral-300 hover:text-neutral-100 border border-brand-700 transition-all"
              >
                {addAllVotersMutation.isPending ? 'Allowlisting...' : 'Add All Org Members'}
              </button>
            </section>

            {/* Blockchain Allowlist Synchronization Card */}
            <section className="rounded-xl bg-brand-900 border border-brand-700 p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-2xs font-bold text-accent-400 uppercase tracking-widest flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4" />
                  Ledger Sync
                </span>
                <span className={`px-2 py-0.5 text-3xs font-semibold rounded-full ${
                  isContractConfigured
                    ? 'bg-accent-950 text-accent-400 border border-accent-800'
                    : 'bg-brand-950 text-neutral-400 border border-brand-800'
                }`}>
                  {isContractConfigured ? 'Sepolia Connected' : 'Cryptographic DB Mode'}
                </span>
              </div>
              <p className="text-3xs text-neutral-400 leading-normal">
                {isContractConfigured
                  ? 'Synchronize verified voter wallet addresses to the smart contract eligibility mapping on Sepolia.'
                  : 'Platform is operating in Database-Backed Cryptographic Ledger Mode (VITE_ELECTION_CONTRACT_ADDRESS unset). Verified voters vote via cryptographic Keccak-256 signatures.'}
              </p>
              {isContractConfigured && (
                <div className="flex flex-col gap-2 pt-2 border-t border-brand-800">
                  <div className="flex items-center justify-between text-[10px] text-neutral-400">
                    <span>Sepolia Contract State:</span>
                    <span className="font-bold text-accent-400">
                      {onChainContractState
                        ? onChainContractState.state === 0
                          ? 'DRAFT (Modifiable)'
                          : onChainContractState.state === 1
                          ? 'OPEN (Locked)'
                          : onChainContractState.state === 2
                          ? 'CLOSED'
                          : 'PUBLISHED'
                        : 'Querying Sepolia...'}
                    </span>
                  </div>
                  {(!onChainContractState || onChainContractState.state === 0) ? (
                    <button
                      type="button"
                      onClick={() => handleSyncBlockchainAllowlist()}
                      disabled={isSyncingBlockchain}
                      className="w-full py-2 px-3 rounded-lg bg-accent-600 hover:bg-accent-500 disabled:bg-brand-800 text-xs font-bold text-white transition-all shadow-md"
                    >
                      {isSyncingBlockchain ? 'Syncing to Sepolia...' : 'Sync Allowlist to Sepolia'}
                    </button>
                  ) : (
                    <div className="p-2 rounded bg-brand-950 text-3xs text-neutral-500 text-center border border-brand-800">
                      🔒 Smart contract eligibility roster is immutable once contract is OPEN.
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers & Sub-components
// ---------------------------------------------------------------------------

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-3xs text-neutral-500 uppercase tracking-wider font-semibold">{label}</p>
      <p className="text-sm font-semibold text-neutral-200 mt-1">{value}</p>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean
  onClick: () => void
  label: string
  icon: string
}) {
  return (
    <button
      onClick={onClick}
      className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-1.5 px-1 ${
        active ? 'text-accent-400' : 'text-neutral-500 hover:text-neutral-300'
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
      {active && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-500 rounded-full" />
      )}
    </button>
  )
}
