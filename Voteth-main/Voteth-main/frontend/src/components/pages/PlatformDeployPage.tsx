import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useWallet } from '@/contexts/WalletContext'
import { 
  VOTETH_CONTRACT_ARTIFACTS, 
  validateContractArtifacts 
} from '@/contracts/artifacts'
import { 
  ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2, 
  Layers, Cpu, FileCode, RefreshCw, ArrowLeft,
  KeyRound, Terminal
} from 'lucide-react'
import { toast } from 'sonner'

const TARGET_CHAIN_ID = 11155111
const TARGET_CHAIN_NAME = 'Ethereum Sepolia'
const TARGET_CHAIN_HEX = '0xaa36a7'

/**
 * PlatformDeployPage — Administrator-Only Browser Deployment Preparation
 *
 * Requirements:
 * - Strictly restricted to authenticated users with platform_role === 'owner'
 * - Fails closed if session or role is missing/unverifiable
 * - Enforces preview-only mode with zero transaction dispatch capabilities
 * - Visualizes deployment sequence, constructor requirements, and bytecode metrics
 */
export function PlatformDeployPage() {
  const { user, profile } = useAuth()
  const { 
    address, 
    balance, 
    isConnected, 
    isCorrectNetwork, 
    connect, 
    refreshBalance 
  } = useWallet()

  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false)

  // 1. Authorization: Fail closed if not authenticated as platform owner
  const isAuthorizedOwner = user && profile?.platform_role === 'owner'

  // 2. Validate contract artifacts
  const validationResult = useMemo(() => {
    try {
      return validateContractArtifacts(VOTETH_CONTRACT_ARTIFACTS)
    } catch (err: any) {
      return {
        isValid: false,
        errors: [err?.message || 'Artifact validation threw an unexpected error'],
        details: {},
      }
    }
  }, [])

  // Handle balance refresh
  const handleRefreshBalance = async () => {
    if (!refreshBalance) return
    setIsRefreshingBalance(true)
    try {
      await refreshBalance()
      toast.success('Wallet balance refreshed')
    } catch (err: any) {
      toast.error('Failed to refresh balance')
    } finally {
      setIsRefreshingBalance(false)
    }
  }

  // ---------------------------------------------------------------------------
  // FAIL CLOSED ACCESS CONTROL: Non-owners are completely blocked
  // ---------------------------------------------------------------------------
  if (!isAuthorizedOwner) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-lg mx-auto text-center px-4">
        <div className="p-4 bg-danger-950/40 border border-danger-900/60 rounded-2xl mb-4 text-danger-400">
          <ShieldAlert className="h-10 w-10 mx-auto" />
        </div>
        <h1 className="text-xl font-bold text-neutral-100 mb-2">
          Access Denied: Platform Owner Clearance Required
        </h1>
        <p className="text-xs text-neutral-400 leading-relaxed mb-6">
          This deployment control module is strictly restricted to authenticated platform owners.
          Your current session role ({profile?.platform_role || 'unauthenticated'}) does not have
          clearance to view smart contract deployment facilities.
        </p>
        <Link
          to="/dashboard"
          className="px-5 py-2.5 rounded-lg bg-brand-800 hover:bg-brand-700 text-xs font-bold text-neutral-100 transition-all border border-brand-700/60"
        >
          Return to Dashboard
        </Link>
      </div>
    )
  }

  // Check if wallet matches registered profile wallet address (if one is registered)
  const isWalletLinked = !!profile?.wallet_address
  const isWalletMatched = isWalletLinked && address
    ? profile.wallet_address?.toLowerCase() === address.toLowerCase()
    : null

  const contractSequence = [
    {
      id: 'registry',
      step: 1,
      name: 'VotEthRegistry',
      artifact: VOTETH_CONTRACT_ARTIFACTS.VotEthRegistry,
      role: 'System Root & Directory',
      constructorDesc: '0 arguments (constructor())',
      postDeployDesc: 'Requires initial organization registration via registerOrganization()',
    },
    {
      id: 'election',
      step: 2,
      name: 'VotEthElection',
      artifact: VOTETH_CONTRACT_ARTIFACTS.VotEthElection,
      role: 'Ballot Ledger & State Machine',
      constructorDesc: '0 arguments (constructor())',
      postDeployDesc: 'Begins in DRAFT state. Must be linked in Registry, have candidates configured, and be opened via openElection()',
    },
    {
      id: 'verifier',
      step: 3,
      name: 'VotEthVerifier',
      artifact: VOTETH_CONTRACT_ARTIFACTS.VotEthVerifier,
      role: 'Cryptographic Proof Verifier',
      constructorDesc: '0 arguments (constructor())',
      postDeployDesc: 'Pure verification utilities require no setup; optional Merkle root recording on closure',
    },
  ]

  return (
    <div className="flex flex-col gap-6 max-w-5xl w-full mx-auto animate-fade-in pb-12">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-3xs font-semibold uppercase tracking-wider text-neutral-500">
          <Link to="/admin" className="hover:text-accent-400 transition-colors flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" /> Back to Platform Console
          </Link>
          <span>/</span>
          <span className="text-neutral-300">Contract Deployment</span>
        </div>
        <div className="px-2.5 py-1 rounded-full bg-brand-850 border border-brand-700/50 text-3xs font-bold text-neutral-400 flex items-center gap-1.5">
          <Terminal className="h-3 w-3 text-accent-400" />
          <span>Ethers v6 Browser Engine</span>
        </div>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-100 tracking-tight flex items-center gap-2.5">
          <Cpu className="h-7 w-7 text-accent-500" />
          Smart Contract Deployment
        </h1>
        <p className="text-xs sm:text-sm text-neutral-400 mt-1">
          Review compiled artifacts, verify deployer wallet readiness, and inspect the deployment sequence for Ethereum Sepolia.
        </p>
      </div>

      {/* PREVIEW-ONLY MODE NOTICE BANNER */}
      <div className="p-4 rounded-xl border border-warning-700/60 bg-warning-950/30 text-warning-300 flex items-start gap-3 shadow-lg">
        <AlertTriangle className="h-5 w-5 text-warning-400 shrink-0 mt-0.5" />
        <div className="flex flex-col gap-1 text-xs">
          <span className="font-bold uppercase tracking-wider text-warning-300">
            Preview-Only Mode Active (Phase 3)
          </span>
          <p className="text-neutral-300 leading-relaxed text-2xs">
            Smart contract transaction broadcasting is strictly disabled in this preparation phase.
            All deployment actions are locked to prevent unintended blockchain state alterations or gas consumption.
            Actual deployment will occur in an explicitly authorized subsequent phase with individual MetaMask signing approvals.
          </p>
        </div>
      </div>

      {/* Deployer Wallet & Network Status Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Network Panel */}
        <div className="p-5 rounded-2xl bg-brand-850 border border-brand-700/60 shadow-xl flex flex-col justify-between gap-4">
          <div>
            <div className="text-3xs font-bold uppercase tracking-widest text-neutral-500 mb-1 flex items-center justify-between">
              <span>Target Network</span>
              <span className="text-accent-400 font-mono">Chain ID {TARGET_CHAIN_ID} ({TARGET_CHAIN_HEX})</span>
            </div>
            <div className="text-base font-bold text-neutral-100 flex items-center gap-2 mt-1">
              <span className={`h-2.5 w-2.5 rounded-full ${isCorrectNetwork ? 'bg-success-500 shadow-[0_0_8px_#22C55E]' : 'bg-danger-500 shadow-[0_0_8px_#EF4444]'}`} />
              {TARGET_CHAIN_NAME}
            </div>
          </div>

          <div className="text-2xs text-neutral-400">
            {isConnected ? (
              isCorrectNetwork ? (
                <span className="text-success-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Wallet connected to correct testnet
                </span>
              ) : (
                <span className="text-danger-400 font-medium flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> Connected to wrong network. Switch to Sepolia in MetaMask.
                </span>
              )
            ) : (
              <span className="text-neutral-500">MetaMask wallet is not connected</span>
            )}
          </div>
        </div>

        {/* Deployer Account Panel */}
        <div className="p-5 rounded-2xl bg-brand-850 border border-brand-700/60 shadow-xl flex flex-col justify-between gap-4">
          <div>
            <div className="text-3xs font-bold uppercase tracking-widest text-neutral-500 mb-1 flex items-center justify-between">
              <span>Deployer Account</span>
              {isConnected && (
                <button
                  type="button"
                  onClick={handleRefreshBalance}
                  disabled={isRefreshingBalance}
                  className="text-3xs text-accent-400 hover:text-accent-300 font-bold flex items-center gap-1"
                >
                  <RefreshCw className={`h-3 w-3 ${isRefreshingBalance ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              )}
            </div>

            {isConnected && address ? (
              <div className="flex flex-col gap-1.5 mt-1">
                <span className="font-mono text-xs font-semibold text-neutral-200 select-all bg-brand-900/60 px-2.5 py-1 rounded-lg border border-brand-700/40 w-fit">
                  {address}
                </span>
                <span className="text-2xs text-neutral-400">
                  Balance: <span className="font-bold text-neutral-200">{balance ?? '0.0000'} ETH</span>
                </span>
              </div>
            ) : (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => connect()}
                  className="px-4 py-1.5 rounded-lg bg-accent-600 hover:bg-accent-500 text-xs font-bold text-neutral-100 transition-all shadow-md"
                >
                  Connect MetaMask
                </button>
              </div>
            )}
          </div>

          <div className="text-3xs text-neutral-500 border-t border-brand-700/40 pt-2 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span>Owner Authorization:</span>
              <span className="text-success-400 font-semibold flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> Verified (platform_role = owner)
              </span>
            </div>
            
            <div className="flex items-center justify-between text-3xs">
              <span>Deployer Wallet:</span>
              {!isWalletLinked ? (
                <span className="text-warning-400 font-medium">
                  Unregistered (Must register in profile before live deployment)
                </span>
              ) : isWalletMatched ? (
                <span className="text-success-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Matches Registered Owner Address
                </span>
              ) : (
                <span className="text-danger-400 font-semibold flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Mismatch (Blocks Live Deployment)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Artifact Validation Status */}
      <div className="p-4 rounded-xl bg-brand-900/40 border border-brand-700/50 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="h-4 w-4 text-accent-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
              Compiled Hardhat Artifacts Integrity & Checksums
            </h2>
          </div>
          <span className={`px-2 py-0.5 rounded text-3xs font-bold uppercase ${validationResult.isValid ? 'bg-success-950 text-success-400 border border-success-900/60' : 'bg-danger-950 text-danger-400 border border-danger-900/60'}`}>
            {validationResult.isValid ? 'Artifacts & Checksums Verified' : 'Validation Error'}
          </span>
        </div>

        {validationResult.isValid ? (
          <p className="text-2xs text-neutral-400 leading-normal">
            All 3 smart contract artifacts are synchronized with Solidity compiler 0.8.24 outputs and verified against trusted cryptographic SHA-256 checksums. Creation bytecodes and deployed runtime bytecodes are confirmed within EIP-170 limits.
          </p>
        ) : (
          <div className="text-2xs text-danger-400 flex flex-col gap-1">
            <span>The following artifact validation errors were detected:</span>
            <ul className="list-disc pl-4">
              {validationResult.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Deployment Sequence Cards */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
            <Layers className="h-4 w-4 text-accent-400" /> Planned Deployment Sequence
          </h2>
          <span className="text-3xs text-neutral-500">
            3 Independent Deployments • Sequential Execution Recommended
          </span>
        </div>

        <div className="flex flex-col gap-3">
          {contractSequence.map((item) => (
            <div
              key={item.id}
              className="p-5 rounded-2xl bg-brand-850 border border-brand-700/60 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-4">
                <div className="h-8 w-8 rounded-xl bg-brand-900 border border-brand-700/60 flex items-center justify-center text-xs font-bold text-accent-400 shrink-0">
                  {item.step}
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-neutral-100 font-mono">
                      {item.name}
                    </h3>
                    <span className="text-3xs px-2 py-0.5 rounded bg-brand-900 border border-brand-700/40 text-neutral-400">
                      {item.role}
                    </span>
                  </div>
                  <p className="text-2xs text-neutral-400">
                    <span className="text-neutral-500">Constructor:</span> {item.constructorDesc}
                  </p>
                  <p className="text-3xs text-neutral-500">
                    <span className="text-neutral-400 font-medium">Lifecycle / Post-Deploy:</span> {item.postDeployDesc}
                  </p>
                </div>
              </div>

              <div className="flex md:flex-col items-end justify-between md:justify-center gap-1 border-t md:border-t-0 md:border-l border-brand-700/40 pt-3 md:pt-0 md:pl-5 text-right shrink-0">
                <span className="text-3xs font-mono text-neutral-400">
                  Initcode: <span className="text-neutral-200 font-bold">{item.artifact.creationBytecodeBytes} B</span>
                </span>
                <span className="text-3xs font-mono text-neutral-400">
                  Runtime: <span className="text-neutral-200 font-bold">{item.artifact.deployedRuntimeBytes} B</span>
                </span>
                <span className="text-3xs font-mono text-neutral-500">
                  Limit: {Math.round((item.artifact.deployedRuntimeBytes / 24576) * 100)}% of 24KB
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Deployment Action Section — LOCKED IN PREVIEW MODE */}
      <div className="p-6 rounded-2xl bg-brand-850 border border-brand-700/60 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 mt-2">
        <div className="flex flex-col gap-1 text-center sm:text-left">
          <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2 justify-center sm:justify-start">
            <KeyRound className="h-4 w-4 text-accent-500" />
            MetaMask Deployment Execution
          </h3>
          <p className="text-xs text-neutral-400 max-w-lg leading-normal">
            Contract deployment requires separate MetaMask signature confirmation for each contract.
            This action is disabled in Phase 3 preview mode.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            to="/admin"
            className="px-4 py-2.5 rounded-lg border border-brand-700 bg-brand-800 hover:bg-brand-750 text-xs font-semibold text-neutral-300 transition-all"
          >
            Cancel
          </Link>

          {/* VISIBLY DISABLED BUTTON WITH NO TRANSACTION HANDLER */}
          <button
            type="button"
            disabled={true}
            title="Deployment execution is disabled in preview-only mode"
            className="px-6 py-2.5 rounded-lg bg-brand-800 text-neutral-500 text-xs font-bold border border-brand-700/40 cursor-not-allowed shadow-none flex items-center gap-2 select-none"
          >
            <span>Deploy Sequence</span>
            <span className="text-3xs bg-brand-900 px-1.5 py-0.5 rounded text-neutral-500 font-normal uppercase">
              Preview Mode
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
