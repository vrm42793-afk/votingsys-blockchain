/**
 * VotEth 2.0 — Focused Component Tests: VotingInterface
 *
 * Verifies single-choice candidate selection, single transaction dispatch,
 * prevention of duplicate submissions, and error handling.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { VotingInterface } from '@/components/features/VotingInterface'
import { votingService } from '@/services/votingService'
import * as AuthContext from '@/contexts/AuthContext'
import * as WalletContext from '@/contexts/WalletContext'
import { toast } from 'sonner'
import type { Candidate } from '@/types/domain'

// Shared mock functions for ethers
const mockCastVote = vi.fn()
const mockWait = vi.fn()
const mockGetSigner = vi.fn()

vi.mock('ethers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ethers')>()
  class MockBrowserProvider {
    getSigner = mockGetSigner
  }
  class MockContract {
    castVote = mockCastVote
    hasVoted = vi.fn().mockResolvedValue(false)
  }
  return {
    ...actual,
    ethers: {
      ...actual.ethers,
      BrowserProvider: MockBrowserProvider,
      Contract: MockContract,
    },
  }
})

// Mock toast notifications
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock votingService
vi.mock('@/services/votingService', () => ({
  votingService: {
    hasVoted: vi.fn().mockResolvedValue(false),
    castVote: vi.fn().mockResolvedValue({ id: 'vote-123' }),
  },
}))

describe('VotingInterface — Single-Choice Enforcement', () => {
  let queryClient: QueryClient
  let mockRefreshBalance: ReturnType<typeof vi.fn>

  const mockCandidates: Candidate[] = [
    {
      id: 'cand-1',
      election_id: 'elec-1',
      user_id: null,
      name: 'Alice Johnson',
      bio: 'Alice manifesto',
      photo_url: null,
      status: 'approved',
      display_order: 0,
      ai_summary: 'Experienced leader',
      on_chain_candidate_id: 1,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
    {
      id: 'cand-2',
      election_id: 'elec-1',
      user_id: null,
      name: 'Bob Smith',
      bio: 'Bob manifesto',
      photo_url: null,
      status: 'approved',
      display_order: 1,
      ai_summary: 'Community builder',
      on_chain_candidate_id: 2,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })

    mockRefreshBalance = vi.fn().mockResolvedValue(undefined)
    mockWait.mockResolvedValue({
      hash: '0xconfirmedtxhash',
      blockNumber: 7123456,
      status: 1,
    })
    mockCastVote.mockResolvedValue({
      hash: '0xtxhash123',
      wait: mockWait,
    })
    mockGetSigner.mockResolvedValue({
      getAddress: vi.fn().mockResolvedValue('0x171134414a74101c2a339cfde6f17ccb5c87b38b'),
    })

    // Mock useAuth
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { id: 'user-001', email: 'voter@voteth.io' },
    } as any)

    // Mock useWallet
    vi.spyOn(WalletContext, 'useWallet').mockReturnValue({
      address: '0x171134414a74101c2a339cfde6f17ccb5c87b38b',
      balance: '1.5000',
      isConnected: true,
      isCorrectNetwork: true,
      status: 'connected',
      connect: vi.fn(),
      disconnect: vi.fn(),
      refreshBalance: mockRefreshBalance,
    })

    // Setup window.ethereum
    ;(window as any).ethereum = {
      request: vi.fn(),
    }
  })

  function renderComponent() {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <VotingInterface
            electionId="elec-1"
            electionType="single_choice"
            maxVotesPerVoter={1}
            candidates={mockCandidates}
          />
        </MemoryRouter>
      </QueryClientProvider>
    )
  }

  it('blocks submission until a candidate is selected', async () => {
    renderComponent()
    await screen.findByRole('radiogroup')

    const submitBtn = screen.getByRole('button', { name: /Submit Ballot/i })
    expect(submitBtn).toBeDisabled()
    expect(screen.getByText(/Selected: 0 \/ 1/i)).toBeInTheDocument()
  })

  it('selecting another candidate replaces the previous selection', async () => {
    renderComponent()
    await screen.findByRole('radiogroup')

    const candidateButtons = screen.getAllByRole('radio')
    expect(candidateButtons).toHaveLength(2)

    // Select Alice
    fireEvent.click(candidateButtons[0]!)
    expect(candidateButtons[0]).toHaveAttribute('aria-checked', 'true')
    expect(candidateButtons[1]).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText(/Selected: 1 \/ 1/i)).toBeInTheDocument()

    // Select Bob -> Alice should be deselected
    fireEvent.click(candidateButtons[1]!)
    expect(candidateButtons[0]).toHaveAttribute('aria-checked', 'false')
    expect(candidateButtons[1]).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText(/Selected: 1 \/ 1/i)).toBeInTheDocument()

    const submitBtn = screen.getByRole('button', { name: /Submit Ballot/i })
    expect(submitBtn).not.toBeDisabled()
  })

  it('triggers exactly ONE castVote call on submission', async () => {
    renderComponent()
    await screen.findByRole('radiogroup')

    const candidateButtons = screen.getAllByRole('radio')
    fireEvent.click(candidateButtons[0]!) // Select Alice

    const submitBtn = screen.getByRole('button', { name: /Submit Ballot/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockCastVote).toHaveBeenCalledTimes(1)
      expect(mockWait).toHaveBeenCalledTimes(1)
      expect(votingService.castVote).toHaveBeenCalledTimes(1)
      expect(votingService.castVote).toHaveBeenCalledWith(
        expect.objectContaining({
          election_id: 'elec-1',
          candidate_id: 'cand-1',
          chain_tx_hash: '0xconfirmedtxhash',
          chain_block_number: 7123456,
          is_chain_confirmed: true,
        })
      )
      expect(mockRefreshBalance).toHaveBeenCalledTimes(1)
      expect(toast.success).toHaveBeenCalledWith('Vote recorded on the blockchain!')
    })
  })

  it('does not dispatch duplicate transactions on repeated clicks while submitting', async () => {
    // Delay tx.wait to keep the mutation in pending state
    let resolveWait: (value: any) => void
    mockWait.mockReturnValue(
      new Promise((resolve) => {
        resolveWait = resolve
      })
    )

    renderComponent()
    await screen.findByRole('radiogroup')

    const candidateButtons = screen.getAllByRole('radio')
    fireEvent.click(candidateButtons[1]!) // Select Bob

    const submitBtn = screen.getByRole('button', { name: /Submit Ballot/i })
    fireEvent.click(submitBtn)

    // Rapid secondary clicks while pending
    fireEvent.click(submitBtn)
    fireEvent.click(submitBtn)

    // Verify it was only dispatched once
    await waitFor(() => {
      expect(mockCastVote).toHaveBeenCalledTimes(1)
    })

    // Complete transaction
    await waitFor(() => {
      resolveWait!({
        hash: '0xconfirmedtxhash',
        blockNumber: 7123456,
        status: 1,
      })
    })

    await waitFor(() => {
      expect(mockCastVote).toHaveBeenCalledTimes(1)
    })
  })

  it('handles wallet rejection (error code 4001) properly', async () => {
    const rejectionError = new Error('MetaMask Tx Signature: User denied transaction signature.')
    ;(rejectionError as any).code = 4001
    mockCastVote.mockRejectedValueOnce(rejectionError)

    renderComponent()
    await screen.findByRole('radiogroup')

    const candidateButtons = screen.getAllByRole('radio')
    fireEvent.click(candidateButtons[0]!)

    const submitBtn = screen.getByRole('button', { name: /Submit Ballot/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Transaction was rejected in MetaMask.')
    })
  })

  it('handles smart contract AlreadyVoted revert properly', async () => {
    const revertError = new Error('execution reverted: custom error 0xdbbe989a: AlreadyVoted()')
    mockCastVote.mockRejectedValueOnce(revertError)

    renderComponent()
    await screen.findByRole('radiogroup')

    const candidateButtons = screen.getAllByRole('radio')
    fireEvent.click(candidateButtons[0]!)

    const submitBtn = screen.getByRole('button', { name: /Submit Ballot/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Duplicate vote rejected by smart contract.')
    })
  })
})
