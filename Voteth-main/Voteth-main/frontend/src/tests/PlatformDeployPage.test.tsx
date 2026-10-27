/**
 * VotEth 2.0 — Focused Component Tests: PlatformDeployPage
 *
 * Verifies platform-owner access control, network status detection,
 * artifact integrity checks, preview-only mode enforcement,
 * and confirms zero transaction methods are triggered.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { PlatformDeployPage } from '@/components/pages/PlatformDeployPage'
import { 
  VOTETH_CONTRACT_ARTIFACTS, 
  validateContractArtifacts 
} from '@/contracts/artifacts'
import * as AuthContext from '@/contexts/AuthContext'
import * as WalletContext from '@/contexts/WalletContext'

// Mock toast notifications
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('PlatformDeployPage — Administrator Deployment Preparation', () => {
  let queryClient: QueryClient
  let mockEthereumRequest: ReturnType<typeof vi.fn>
  let mockRefreshBalance: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })

    mockEthereumRequest = vi.fn().mockResolvedValue('0x0')
    mockRefreshBalance = vi.fn().mockResolvedValue(undefined)

    // Setup window.ethereum
    ;(window as any).ethereum = {
      request: mockEthereumRequest,
    }
  })

  function renderPage() {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <PlatformDeployPage />
        </MemoryRouter>
      </QueryClientProvider>
    )
  }

  // ---------------------------------------------------------------------------
  // 1. ACCESS CONTROL TESTS
  // ---------------------------------------------------------------------------
  it('denies access to unauthenticated visitor (no user session)', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: null,
      profile: null,
    } as any)

    vi.spyOn(WalletContext, 'useWallet').mockReturnValue({
      isConnected: false,
      isCorrectNetwork: false,
    } as any)

    renderPage()

    expect(screen.getByText(/Access Denied: Platform Owner Clearance Required/i)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Smart Contract Deployment/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Return to Dashboard/i })).toBeInTheDocument()
  })

  it('denies access to non-platform-owner authenticated user (voter role)', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { id: 'voter-1', email: 'voter@voteth.io' },
      profile: { platform_role: 'voter' },
    } as any)

    vi.spyOn(WalletContext, 'useWallet').mockReturnValue({
      isConnected: true,
      address: '0x171134414a74101c2a339cfde6f17ccb5c87b38b',
    } as any)

    renderPage()

    expect(screen.getByText(/Access Denied: Platform Owner Clearance Required/i)).toBeInTheDocument()
    expect(screen.getByText(/Your current session role \(voter\) does not have clearance/i)).toBeInTheDocument()
  })

  it('denies access to non-platform-owner organizer role', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { id: 'organizer-1', email: 'organizer@voteth.io' },
      profile: { platform_role: 'organizer' },
    } as any)

    vi.spyOn(WalletContext, 'useWallet').mockReturnValue({
      isConnected: true,
      address: '0x171134414a74101c2a339cfde6f17ccb5c87b38b',
    } as any)

    renderPage()

    expect(screen.getByText(/Access Denied: Platform Owner Clearance Required/i)).toBeInTheDocument()
    expect(screen.getByText(/Your current session role \(organizer\) does not have clearance/i)).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // 2. AUTHORIZED PLATFORM OWNER RENDERING
  // ---------------------------------------------------------------------------
  it('renders deployment control panel for authenticated platform owner', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { id: 'owner-1', email: 'owner@voteth.io' },
      profile: { platform_role: 'owner', wallet_address: '0x171134414a74101c2a339cfde6f17ccb5c87b38b' },
    } as any)

    vi.spyOn(WalletContext, 'useWallet').mockReturnValue({
      isConnected: true,
      address: '0x171134414a74101c2a339cfde6f17ccb5c87b38b',
      balance: '0.1196',
      isCorrectNetwork: true,
      status: 'connected',
      refreshBalance: mockRefreshBalance,
    } as any)

    renderPage()

    expect(screen.getByRole('heading', { name: /Smart Contract Deployment/i })).toBeInTheDocument()
    expect(screen.getByText(/Preview-Only Mode Active \(Phase 3\)/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Ethereum Sepolia/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/0x171134414a74101c2a339cfde6f17ccb5c87b38b/i)).toBeInTheDocument()
    expect(screen.getByText(/0.1196 ETH/i)).toBeInTheDocument()

    // All three contracts are listed
    expect(screen.getByText('VotEthRegistry')).toBeInTheDocument()
    expect(screen.getByText('VotEthElection')).toBeInTheDocument()
    expect(screen.getByText('VotEthVerifier')).toBeInTheDocument()

    // Constructor descriptions verified
    const constructorDescs = screen.getAllByText(/0 arguments \(constructor\(\)\)/i)
    expect(constructorDescs).toHaveLength(3)
  })

  // ---------------------------------------------------------------------------
  // 3. NETWORK DETECTION
  // ---------------------------------------------------------------------------
  it('detects and displays warning when wallet is on wrong network', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { id: 'owner-1', email: 'owner@voteth.io' },
      profile: { platform_role: 'owner' },
    } as any)

    vi.spyOn(WalletContext, 'useWallet').mockReturnValue({
      isConnected: true,
      address: '0x171134414a74101c2a339cfde6f17ccb5c87b38b',
      balance: '1.0000',
      isCorrectNetwork: false,
      status: 'wrong_network',
      refreshBalance: mockRefreshBalance,
    } as any)

    renderPage()

    expect(screen.getByText(/Connected to wrong network\. Switch to Sepolia in MetaMask\./i)).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // 4. ARTIFACT INTEGRITY VALIDATION
  // ---------------------------------------------------------------------------
  it('validates current contract artifacts as intact and within EVM limits', () => {
    const result = validateContractArtifacts(VOTETH_CONTRACT_ARTIFACTS)
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.details.VotEthRegistry!.runtimeBytes).toBeLessThan(24576)
    expect(result.details.VotEthElection!.runtimeBytes).toBeLessThan(24576)
    expect(result.details.VotEthVerifier!.runtimeBytes).toBeLessThan(24576)
  })

  it('detects missing or invalid artifacts during validation', () => {
    const corruptedArtifacts = {
      ...VOTETH_CONTRACT_ARTIFACTS,
      VotEthRegistry: {
        ...VOTETH_CONTRACT_ARTIFACTS.VotEthRegistry,
        abi: [], // Empty ABI
        bytecode: '0x12', // Too short
      },
    }

    const result = validateContractArtifacts(corruptedArtifacts as any)
    expect(result.isValid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors.some(e => e.includes('ABI is missing or empty array'))).toBe(true)
  })

  it('detects bytecode checksum mismatch during validation', () => {
    const tamperedArtifacts = {
      ...VOTETH_CONTRACT_ARTIFACTS,
      VotEthRegistry: {
        ...VOTETH_CONTRACT_ARTIFACTS.VotEthRegistry,
        sha256: '0000000000000000000000000000000000000000000000000000000000000000',
      },
    }

    const result = validateContractArtifacts(tamperedArtifacts as any)
    expect(result.isValid).toBe(false)
    expect(result.errors.some(e => e.includes('does not match trusted checksum'))).toBe(true)
  })

  it('displays mismatch warning when connected wallet differs from registered owner wallet', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { id: 'owner-1', email: 'owner@voteth.io' },
      profile: { platform_role: 'owner', wallet_address: '0x171134414a74101c2a339cfde6f17ccb5c87b38b' },
    } as any)

    vi.spyOn(WalletContext, 'useWallet').mockReturnValue({
      isConnected: true,
      address: '0x9999999999999999999999999999999999999999',
      balance: '1.0000',
      isCorrectNetwork: true,
      status: 'connected',
      refreshBalance: mockRefreshBalance,
    } as any)

    renderPage()

    expect(screen.getByText(/Mismatch \(Blocks Live Deployment\)/i)).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // 5. PREVIEW-ONLY ENFORCEMENT & ZERO TRANSACTION BROADCAST
  // ---------------------------------------------------------------------------
  it('enforces preview-only mode with disabled deployment button and zero transaction calls', async () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { id: 'owner-1', email: 'owner@voteth.io' },
      profile: { platform_role: 'owner', wallet_address: '0x171134414a74101c2a339cfde6f17ccb5c87b38b' },
    } as any)

    vi.spyOn(WalletContext, 'useWallet').mockReturnValue({
      isConnected: true,
      address: '0x171134414a74101c2a339cfde6f17ccb5c87b38b',
      balance: '0.1196',
      isCorrectNetwork: true,
      status: 'connected',
      refreshBalance: mockRefreshBalance,
    } as any)

    renderPage()

    // Find the deployment button
    const deployBtn = screen.getByRole('button', { name: /Deploy Sequence/i })
    expect(deployBtn).toBeDisabled()

    // Attempting to click the disabled button does nothing
    fireEvent.click(deployBtn)

    // Click refresh balance
    const refreshBtn = screen.getByRole('button', { name: /Refresh/i })
    fireEvent.click(refreshBtn)

    await waitFor(() => {
      expect(mockRefreshBalance).toHaveBeenCalledTimes(1)
    })

    // Confirm that NO Ethereum transaction request was ever dispatched
    expect(mockEthereumRequest).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: 'eth_sendTransaction' })
    )
    expect(mockEthereumRequest).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: 'eth_sendRawTransaction' })
    )
  })
})
