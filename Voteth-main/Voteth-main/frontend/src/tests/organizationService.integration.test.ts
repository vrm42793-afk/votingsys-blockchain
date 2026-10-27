/**
 * VotEth 2.0 — Integration Tests: Organization Service
 *
 * Tests CRUD, membership management, and invitation flows
 * using mocked Supabase calls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { organizationService } from '@/services/organizationService'
import { supabase } from '@services/supabase/client'

// ---------------------------------------------------------------------------
// Mock chain builder
// ---------------------------------------------------------------------------
function mockChain(resolvedValue: { data: unknown; error: unknown }) {
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

function mockAuthUser(userId = 'user-001', email = 'admin@test.edu') {
  ;(supabase.auth as any).getUser = vi.fn().mockResolvedValue({
    data: { user: { id: userId, email } },
    error: null,
  })
}

describe('organizationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthUser()
  })

  // =========================================================================
  // CREATE
  // =========================================================================
  describe('create', () => {
    it('creates an organization and returns it', async () => {
      const org = {
        id: 'org-001',
        name: 'Apex Corp',
        slug: 'apex-corp',
        created_at: '2026-07-01T00:00:00Z',
        updated_at: '2026-07-01T00:00:00Z',
      }

      const chain = mockChain({ data: org, error: null })
      vi.mocked(supabase.from).mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)

      const result = await organizationService.create({
        name: 'Apex Corp',
        slug: 'apex-corp',
      })

      expect(supabase.from).toHaveBeenCalledWith('organizations')
      expect(chain.insert).toHaveBeenCalled()
      expect(result.id).toBe('org-001')
      expect(result.name).toBe('Apex Corp')
    })

    it('throws on duplicate slug', async () => {
      const chain = mockChain({
        data: null,
        error: { message: 'duplicate key value violates unique constraint', code: '23505' },
      })
      vi.mocked(supabase.from).mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)

      await expect(
        organizationService.create({ name: 'Dup', slug: 'apex-corp' })
      ).rejects.toBeTruthy()
    })
  })

  // =========================================================================
  // LIST USER ORGANIZATIONS
  // =========================================================================
  describe('listUserOrganizations', () => {
    it('returns organizations the user belongs to', async () => {
      const membershipData = [
        { organization: { id: 'org-001', name: 'Apex', slug: 'apex' } },
        { organization: { id: 'org-002', name: 'Beta', slug: 'beta' } },
      ]

      const chain = mockChain({ data: membershipData, error: null })
      Object.defineProperty(chain, 'then', {
        value: (resolve: (val: unknown) => void) =>
          Promise.resolve({ data: membershipData, error: null }).then(resolve),
        configurable: true,
      })
      vi.mocked(supabase.from).mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)

      const result = await organizationService.listUserOrganizations()

      expect(result).toHaveLength(2)
      expect(result[0]!.name).toBe('Apex')
      expect(result[1]!.name).toBe('Beta')
    })

    it('throws when user is not authenticated', async () => {
      ;(supabase.auth as any).getUser = vi.fn().mockResolvedValue({
        data: { user: null },
        error: null,
      })

      await expect(
        organizationService.listUserOrganizations()
      ).rejects.toThrow('Not authenticated')
    })
  })

  // =========================================================================
  // GET MEMBERS
  // =========================================================================
  describe('getMembers', () => {
    it('returns members with profile data', async () => {
      const members = [
        {
          id: 'mem-001',
          org_id: 'org-001',
          user_id: 'user-001',
          role: 'admin',
          joined_at: '2026-07-01T00:00:00Z',
          user_profile: { full_name: 'Admin User', avatar_url: null, wallet_address: null },
        },
        {
          id: 'mem-002',
          org_id: 'org-001',
          user_id: 'user-002',
          role: 'viewer',
          joined_at: '2026-07-01T01:00:00Z',
          user_profile: { full_name: 'Voter User', avatar_url: null, wallet_address: '0xabc' },
        },
      ]

      const chain = mockChain({ data: members, error: null })
      Object.defineProperty(chain, 'then', {
        value: (resolve: (val: unknown) => void) =>
          Promise.resolve({ data: members, error: null }).then(resolve),
        configurable: true,
      })
      vi.mocked(supabase.from).mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)

      const result = await organizationService.getMembers('org-001')

      expect(result).toHaveLength(2)
      expect(result[0]!.role).toBe('admin')
      expect(result[1]!.user_profile?.wallet_address).toBe('0xabc')
    })
  })

  // =========================================================================
  // INVITE MEMBER
  // =========================================================================
  describe('inviteMember', () => {
    it('creates an invitation record', async () => {
      const invite = {
        id: 'inv-001',
        org_id: 'org-001',
        email: 'new@test.edu',
        role: 'viewer',
        status: 'pending',
      }

      const chain = mockChain({ data: invite, error: null })
      vi.mocked(supabase.from).mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)

      await expect(
        organizationService.inviteMember({
          org_id: 'org-001',
          email: 'new@test.edu',
          role: 'viewer',
        })
      ).resolves.not.toThrow()

      expect(supabase.from).toHaveBeenCalledWith('org_invitations')
    })
  })

  // =========================================================================
  // CREATE AND READ WORKFLOW
  // =========================================================================
  describe('create-and-read workflow', () => {
    it('creates an organization with owner_id and retrieves it in user organizations', async () => {
      const createdOrg = {
        id: 'org-001',
        name: 'Alpha University',
        slug: 'alpha-uni',
        owner_id: 'user-001',
        description: null,
        logo_url: null,
        accent_theme: 'purple',
        is_active: true,
        created_at: '2026-07-02T00:00:00Z',
        updated_at: '2026-07-02T00:00:00Z',
      }

      const insertChain = mockChain({ data: createdOrg, error: null })
      vi.mocked(supabase.from).mockReturnValueOnce(insertChain as unknown as ReturnType<typeof supabase.from>)

      const created = await organizationService.create({
        name: 'Alpha University',
        slug: 'alpha-uni',
      })

      expect(created.id).toBe('org-001')
      expect(created.owner_id).toBe('user-001')
      expect(insertChain.insert).toHaveBeenCalledWith({
        name: 'Alpha University',
        slug: 'alpha-uni',
        owner_id: 'user-001',
      })

      // Simulate listUserOrganizations read
      const listChain = mockChain({
        data: [{ organization: createdOrg }],
        error: null,
      })
      Object.defineProperty(listChain, 'then', {
        value: (resolve: (val: unknown) => void) =>
          Promise.resolve({ data: [{ organization: createdOrg }], error: null }).then(resolve),
        configurable: true,
      })
      vi.mocked(supabase.from).mockReturnValueOnce(listChain as unknown as ReturnType<typeof supabase.from>)

      const orgs = await organizationService.listUserOrganizations()
      expect(orgs).toHaveLength(1)
      expect(orgs[0]!.id).toBe('org-001')
      expect(orgs[0]!.name).toBe('Alpha University')
    })
  })

  // =========================================================================
  // UPDATE MEMBER ROLE
  // =========================================================================
  describe('updateMemberRole', () => {
    it('updates a member role using composite key (organization_id, user_id)', async () => {
      const chain = mockChain({ data: { organization_id: 'org-001', user_id: 'user-001', role: 'admin' }, error: null })
      Object.defineProperty(chain, 'then', {
        value: (resolve: (val: unknown) => void) =>
          Promise.resolve({ data: { organization_id: 'org-001', user_id: 'user-001', role: 'admin' }, error: null }).then(resolve),
        configurable: true,
      })
      vi.mocked(supabase.from).mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)

      await expect(
        organizationService.updateMemberRole('org-001', 'user-001', 'admin')
      ).resolves.not.toThrow()

      expect(supabase.from).toHaveBeenCalledWith('org_memberships')
      expect(chain.update).toHaveBeenCalledWith({ role: 'admin' })
      expect(chain.eq).toHaveBeenCalledWith('organization_id', 'org-001')
      expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-001')
    })
  })

  // =========================================================================
  // REMOVE MEMBER
  // =========================================================================
  describe('removeMember', () => {
    it('deletes a membership using composite key (organization_id, user_id)', async () => {
      const chain = mockChain({ data: null, error: null })
      Object.defineProperty(chain, 'then', {
        value: (resolve: (val: unknown) => void) =>
          Promise.resolve({ data: null, error: null }).then(resolve),
        configurable: true,
      })
      vi.mocked(supabase.from).mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>)

      await expect(
        organizationService.removeMember('org-001', 'user-001')
      ).resolves.not.toThrow()

      expect(supabase.from).toHaveBeenCalledWith('org_memberships')
      expect(chain.delete).toHaveBeenCalled()
      expect(chain.eq).toHaveBeenCalledWith('organization_id', 'org-001')
      expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-001')
    })
  })
})
