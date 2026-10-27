/**
 * VotEth 2.0 — Integration Tests: Election Service
 *
 * Tests the election lifecycle state machine and CRUD operations
 * using mocked Supabase calls to verify service-level logic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { electionService } from '@/services/electionService'
import { supabase } from '@services/supabase/client'

// ---------------------------------------------------------------------------
// Helper to build a mock election object
// ---------------------------------------------------------------------------
function mockElection(overrides: Record<string, unknown> = {}) {
  return {
    id: 'elec-001',
    org_id: 'org-001',
    title: 'Student Council 2026',
    description: 'Annual student council elections',
    election_type: 'single_choice',
    max_votes_per_voter: 1,
    start_date: '2026-08-01T00:00:00Z',
    end_date: '2026-08-15T00:00:00Z',
    status: 'draft',
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Mock chain builder (simulates Supabase PostgREST fluent API)
// ---------------------------------------------------------------------------
function mockChain(resolvedValue: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolvedValue),
    maybeSingle: vi.fn().mockResolvedValue(resolvedValue),
    then: vi.fn((resolve) => resolve(resolvedValue)),
  }
  // Allow chain to be awaitable
  Object.defineProperty(chain, 'then', {
    value: (resolve: (val: unknown) => void) => Promise.resolve(resolvedValue).then(resolve),
  })
  return chain
}

describe('electionService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // =========================================================================
  // CREATE
  // =========================================================================
  describe('create', () => {
    it('inserts an election and returns the created record', async () => {
      const created = mockElection()
      const chain = mockChain({ data: created, error: null })
      vi.mocked(supabase.from).mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)

      const result = await electionService.create({
        org_id: 'org-001',
        title: 'Student Council 2026',
        description: 'Annual student council elections',
        election_type: 'single_choice',
        max_votes_per_voter: 1,
        start_date: '2026-08-01T00:00:00Z',
        end_date: '2026-08-15T00:00:00Z',
        status: 'draft',
      })

      expect(supabase.from).toHaveBeenCalledWith('elections')
      expect(chain.insert).toHaveBeenCalled()
      expect(result.id).toBe('elec-001')
      expect(result.title).toBe('Student Council 2026')
    })

    it('throws when Supabase returns an error', async () => {
      const chain = mockChain({ data: null, error: { message: 'RLS violation', code: '42501' } })
      vi.mocked(supabase.from).mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)

      await expect(
        electionService.create({
          org_id: 'org-001',
          title: 'Fail',
          description: '',
          election_type: 'single_choice',
          max_votes_per_voter: 1,
          start_date: '2026-08-01T00:00:00Z',
          end_date: '2026-08-15T00:00:00Z',
          status: 'draft',
        })
      ).rejects.toBeTruthy()
    })
  })

  // =========================================================================
  // GET BY ID
  // =========================================================================
  describe('getById', () => {
    it('fetches a single election by ID', async () => {
      const election = mockElection()
      const chain = mockChain({ data: election, error: null })
      vi.mocked(supabase.from).mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)

      const result = await electionService.getById('elec-001')

      expect(supabase.from).toHaveBeenCalledWith('elections')
      expect(chain.eq).toHaveBeenCalledWith('id', 'elec-001')
      expect(result.id).toBe('elec-001')
    })

    it('throws when election not found', async () => {
      const chain = mockChain({ data: null, error: { message: 'Not found', code: 'PGRST116' } })
      vi.mocked(supabase.from).mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)

      await expect(electionService.getById('bad-id')).rejects.toBeTruthy()
    })
  })

  // =========================================================================
  // LIST BY ORG
  // =========================================================================
  describe('listByOrg', () => {
    it('returns elections for a given org', async () => {
      const elections = [mockElection({ id: 'e1' }), mockElection({ id: 'e2' })]
      const chain = mockChain({ data: elections, error: null })

      // Override then to resolve directly (no single())
      Object.defineProperty(chain, 'then', {
        value: (resolve: (val: unknown) => void) =>
          Promise.resolve({ data: elections, error: null }).then(resolve),
      })

      vi.mocked(supabase.from).mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)

      const result = await electionService.listByOrg('org-001')

      expect(result).toHaveLength(2)
      expect(result[0]!.id).toBe('e1')
    })
  })

  // =========================================================================
  // LIFECYCLE STATE MACHINE
  // =========================================================================
  describe('transitionStatus', () => {
    it('allows draft → open transition', async () => {
      const draftElection = mockElection({ status: 'draft' })
      const openElection = mockElection({ status: 'open' })

      // First call: getById returns draft
      // Second call: update returns open
      const getChain = mockChain({ data: draftElection, error: null })
      const updateChain = mockChain({ data: openElection, error: null })

      let callCount = 0
      vi.mocked(supabase.from).mockImplementation(() => {
        callCount++
        if (callCount === 1) return getChain as unknown as ReturnType<typeof supabase.from>
        return updateChain as unknown as ReturnType<typeof supabase.from>
      })

      const result = await electionService.transitionStatus('elec-001', 'open')

      expect(result.status).toBe('open')
    })

    it('allows open → closed transition', async () => {
      const openElection = mockElection({ status: 'open' })
      const closedElection = mockElection({ status: 'closed' })

      const getChain = mockChain({ data: openElection, error: null })
      const updateChain = mockChain({ data: closedElection, error: null })

      let callCount = 0
      vi.mocked(supabase.from).mockImplementation(() => {
        callCount++
        if (callCount === 1) return getChain as unknown as ReturnType<typeof supabase.from>
        return updateChain as unknown as ReturnType<typeof supabase.from>
      })

      const result = await electionService.transitionStatus('elec-001', 'closed')
      expect(result.status).toBe('closed')
    })

    it('allows closed → published transition', async () => {
      const closedElection = mockElection({ status: 'closed' })
      const publishedElection = mockElection({ status: 'published' })

      const getChain = mockChain({ data: closedElection, error: null })
      const updateChain = mockChain({ data: publishedElection, error: null })

      let callCount = 0
      vi.mocked(supabase.from).mockImplementation(() => {
        callCount++
        if (callCount === 1) return getChain as unknown as ReturnType<typeof supabase.from>
        return updateChain as unknown as ReturnType<typeof supabase.from>
      })

      const result = await electionService.transitionStatus('elec-001', 'published')
      expect(result.status).toBe('published')
    })

    it('rejects draft → closed (skipping open)', async () => {
      const draftElection = mockElection({ status: 'draft' })
      const getChain = mockChain({ data: draftElection, error: null })
      vi.mocked(supabase.from).mockReturnValue(getChain as unknown as ReturnType<typeof supabase.from>)

      await expect(
        electionService.transitionStatus('elec-001', 'closed')
      ).rejects.toThrow(/Invalid transition/)
    })

    it('rejects draft → published (skipping open + closed)', async () => {
      const draftElection = mockElection({ status: 'draft' })
      const getChain = mockChain({ data: draftElection, error: null })
      vi.mocked(supabase.from).mockReturnValue(getChain as unknown as ReturnType<typeof supabase.from>)

      await expect(
        electionService.transitionStatus('elec-001', 'published')
      ).rejects.toThrow(/Invalid transition/)
    })

    it('rejects open → draft (backward transition)', async () => {
      const openElection = mockElection({ status: 'open' })
      const getChain = mockChain({ data: openElection, error: null })
      vi.mocked(supabase.from).mockReturnValue(getChain as unknown as ReturnType<typeof supabase.from>)

      await expect(
        electionService.transitionStatus('elec-001', 'draft')
      ).rejects.toThrow(/Invalid transition/)
    })

    it('rejects published → anything (terminal state)', async () => {
      const publishedElection = mockElection({ status: 'published' })
      const getChain = mockChain({ data: publishedElection, error: null })
      vi.mocked(supabase.from).mockReturnValue(getChain as unknown as ReturnType<typeof supabase.from>)

      await expect(
        electionService.transitionStatus('elec-001', 'open')
      ).rejects.toThrow(/terminal state/)
    })
  })

  // =========================================================================
  // CONVENIENCE METHODS
  // =========================================================================
  describe('convenience methods', () => {
    it('open() calls transitionStatus with "open"', async () => {
      const draftElection = mockElection({ status: 'draft' })
      const openElection = mockElection({ status: 'open' })

      const getChain = mockChain({ data: draftElection, error: null })
      const updateChain = mockChain({ data: openElection, error: null })

      let callCount = 0
      vi.mocked(supabase.from).mockImplementation(() => {
        callCount++
        if (callCount === 1) return getChain as unknown as ReturnType<typeof supabase.from>
        return updateChain as unknown as ReturnType<typeof supabase.from>
      })

      const result = await electionService.open('elec-001')
      expect(result.status).toBe('open')
    })

    it('close() calls transitionStatus with "closed"', async () => {
      const openElection = mockElection({ status: 'open' })
      const closedElection = mockElection({ status: 'closed' })

      const getChain = mockChain({ data: openElection, error: null })
      const updateChain = mockChain({ data: closedElection, error: null })

      let callCount = 0
      vi.mocked(supabase.from).mockImplementation(() => {
        callCount++
        if (callCount === 1) return getChain as unknown as ReturnType<typeof supabase.from>
        return updateChain as unknown as ReturnType<typeof supabase.from>
      })

      const result = await electionService.close('elec-001')
      expect(result.status).toBe('closed')
    })

    it('publish() calls transitionStatus with "published"', async () => {
      const closedElection = mockElection({ status: 'closed' })
      const publishedElection = mockElection({ status: 'published' })

      const getChain = mockChain({ data: closedElection, error: null })
      const updateChain = mockChain({ data: publishedElection, error: null })

      let callCount = 0
      vi.mocked(supabase.from).mockImplementation(() => {
        callCount++
        if (callCount === 1) return getChain as unknown as ReturnType<typeof supabase.from>
        return updateChain as unknown as ReturnType<typeof supabase.from>
      })

      const result = await electionService.publish('elec-001')
      expect(result.status).toBe('published')
    })
  })

  // =========================================================================
  // DELETE
  // =========================================================================
  describe('delete', () => {
    it('deletes an election by ID', async () => {
      const chain = mockChain({ data: null, error: null })
      // delete doesn't call single(), so we override then
      Object.defineProperty(chain, 'then', {
        value: (resolve: (val: unknown) => void) =>
          Promise.resolve({ data: null, error: null }).then(resolve),
      })
      vi.mocked(supabase.from).mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)

      await expect(electionService.delete('elec-001')).resolves.toBeUndefined()
      expect(chain.delete).toHaveBeenCalled()
      expect(chain.eq).toHaveBeenCalledWith('id', 'elec-001')
    })
  })
})
