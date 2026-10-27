/**
 * VotEth 2.0 — Integration Tests: Voting Service
 *
 * Tests the voting service: castVote, hasVoted, getVoteReceipt, getResults,
 * and getCandidateVoteCount using mocked Supabase calls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { votingService } from '@/services/votingService'
import { supabase } from '@services/supabase/client'

// ---------------------------------------------------------------------------
// Mock chain builder
// ---------------------------------------------------------------------------
function mockChain(resolvedValue: { data: unknown; error: unknown; count?: number | null }) {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolvedValue),
    maybeSingle: vi.fn().mockResolvedValue(resolvedValue),
  }

  Object.defineProperty(chain, 'then', {
    value: (resolve: (val: unknown) => void) => Promise.resolve(resolvedValue).then(resolve),
    configurable: true,
  })

  return chain
}

// Mock getUser() to return a consistent test user
function mockAuthUser(userId = 'user-001', email = 'voter@test.edu') {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: { user: { id: userId, email } } },
    error: null,
  } as never)

  // getUser is used by votingService
  ;(supabase.auth as any).getUser = vi.fn().mockResolvedValue({
    data: { user: { id: userId, email } },
    error: null,
  })
}

describe('votingService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthUser()
  })

  // =========================================================================
  // CAST VOTE
  // =========================================================================
  describe('castVote', () => {
    it('inserts a vote record and returns it', async () => {
      const voteData = {
        id: 'vote-001',
        election_id: 'elec-001',
        voter_id: 'user-001',
        candidate_id: 'cand-001',
        vote_hash: '0xabc123',
        chain_tx_hash: '0xtx123',
        is_chain_confirmed: false,
        created_at: '2026-07-01T10:00:00Z',
      }

      const chain = mockChain({ data: voteData, error: null })
      vi.mocked(supabase.from).mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)

      const result = await votingService.castVote({
        election_id: 'elec-001',
        candidate_id: 'cand-001',
        vote_hash: '0xabc123',
        chain_tx_hash: '0xtx123',
      })

      expect(supabase.from).toHaveBeenCalledWith('votes')
      expect(chain.insert).toHaveBeenCalled()
      expect(result.id).toBe('vote-001')
      expect(result.vote_hash).toBe('0xabc123')
    })

    it('persists real chain_block_number and confirmed status on successful receipt', async () => {
      const voteData = {
        id: 'vote-002',
        election_id: 'elec-001',
        voter_id: 'user-001',
        candidate_id: 'cand-001',
        vote_hash: '0xabc999',
        chain_tx_hash: '0xtx999',
        chain_block_number: 7123456,
        is_chain_confirmed: true,
        created_at: '2026-07-01T10:00:00Z',
      }

      const chain = mockChain({ data: voteData, error: null })
      vi.mocked(supabase.from).mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)

      const result = await votingService.castVote({
        election_id: 'elec-001',
        candidate_id: 'cand-001',
        vote_hash: '0xabc999',
        chain_tx_hash: '0xtx999',
        chain_block_number: 7123456,
        is_chain_confirmed: true,
      })

      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          chain_tx_hash: '0xtx999',
          chain_block_number: 7123456,
          is_chain_confirmed: true,
        })
      )
      expect(result.chain_block_number).toBe(7123456)
      expect(result.is_chain_confirmed).toBe(true)
    })

    it('throws when not authenticated', async () => {
      ;(supabase.auth as any).getUser = vi.fn().mockResolvedValue({
        data: { user: null },
        error: null,
      })

      await expect(
        votingService.castVote({
          election_id: 'elec-001',
          candidate_id: 'cand-001',
          vote_hash: '0xabc123',
        })
      ).rejects.toThrow('Not authenticated')
    })

    it('throws on duplicate vote (DB constraint)', async () => {
      const chain = mockChain({
        data: null,
        error: { message: 'duplicate key value', code: '23505' },
      })
      vi.mocked(supabase.from).mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)

      await expect(
        votingService.castVote({
          election_id: 'elec-001',
          candidate_id: 'cand-001',
          vote_hash: '0xabc123',
        })
      ).rejects.toBeTruthy()
    })
  })

  // =========================================================================
  // HAS VOTED
  // =========================================================================
  describe('hasVoted', () => {
    it('returns true when user has voted', async () => {
      const chain = mockChain({ data: null, error: null, count: 1 })
      // Override to resolve with count
      Object.defineProperty(chain, 'then', {
        value: (resolve: (val: unknown) => void) =>
          Promise.resolve({ data: null, error: null, count: 1 }).then(resolve),
        configurable: true,
      })
      vi.mocked(supabase.from).mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)

      const result = await votingService.hasVoted('elec-001')
      expect(result).toBe(true)
    })

    it('returns false when user has not voted', async () => {
      const chain = mockChain({ data: null, error: null, count: 0 })
      Object.defineProperty(chain, 'then', {
        value: (resolve: (val: unknown) => void) =>
          Promise.resolve({ data: null, error: null, count: 0 }).then(resolve),
        configurable: true,
      })
      vi.mocked(supabase.from).mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)

      const result = await votingService.hasVoted('elec-001')
      expect(result).toBe(false)
    })

    it('returns false when user is not authenticated', async () => {
      ;(supabase.auth as any).getUser = vi.fn().mockResolvedValue({
        data: { user: null },
        error: null,
      })

      const result = await votingService.hasVoted('elec-001')
      expect(result).toBe(false)
    })
  })

  // =========================================================================
  // GET VOTE RECEIPT
  // =========================================================================
  describe('getVoteReceipt', () => {
    it('returns receipt data when vote exists', async () => {
      const receiptData = {
        vote_hash: '0xabc123',
        chain_tx_hash: '0xtx456',
        created_at: '2026-07-01T10:00:00Z',
      }

      const chain = mockChain({ data: receiptData, error: null })
      vi.mocked(supabase.from).mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)

      const result = await votingService.getVoteReceipt('elec-001')

      expect(result).not.toBeNull()
      expect(result?.vote_hash).toBe('0xabc123')
      expect(result?.chain_tx_hash).toBe('0xtx456')
      expect(result?.timestamp).toBe('2026-07-01T10:00:00Z')
    })

    it('returns null when no vote exists', async () => {
      const chain = mockChain({ data: null, error: null })
      vi.mocked(supabase.from).mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)

      const result = await votingService.getVoteReceipt('elec-001')
      expect(result).toBeNull()
    })
  })

  // =========================================================================
  // GET CANDIDATE VOTE COUNT
  // =========================================================================
  describe('getCandidateVoteCount', () => {
    it('returns the correct count', async () => {
      const chain = mockChain({ data: null, error: null, count: 42 })
      Object.defineProperty(chain, 'then', {
        value: (resolve: (val: unknown) => void) =>
          Promise.resolve({ data: null, error: null, count: 42 }).then(resolve),
        configurable: true,
      })
      vi.mocked(supabase.from).mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)

      const result = await votingService.getCandidateVoteCount('elec-001', 'cand-001')
      expect(result).toBe(42)
    })

    it('returns 0 when no votes', async () => {
      const chain = mockChain({ data: null, error: null, count: 0 })
      Object.defineProperty(chain, 'then', {
        value: (resolve: (val: unknown) => void) =>
          Promise.resolve({ data: null, error: null, count: 0 }).then(resolve),
        configurable: true,
      })
      vi.mocked(supabase.from).mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)

      const result = await votingService.getCandidateVoteCount('elec-001', 'cand-001')
      expect(result).toBe(0)
    })
  })
})
