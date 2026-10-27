import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ManageMembersPage } from '@/components/pages/ManageMembersPage'
import { VotingInterface } from '@/components/features/VotingInterface'
import { organizationService } from '@/services/organizationService'
import { electionService } from '@/services/electionService'
import * as AuthContext from '@/contexts/AuthContext'
import * as WalletContext from '@/contexts/WalletContext'
import { toast } from 'sonner'
import type { Candidate } from '@/types/domain'

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock organizationService
vi.mock('@/services/organizationService', () => ({
  organizationService: {
    getMembers: vi.fn(),
    approveMember: vi.fn().mockResolvedValue(undefined),
    rejectMember: vi.fn().mockResolvedValue(undefined),
    removeMember: vi.fn().mockResolvedValue(undefined),
    inviteMember: vi.fn().mockResolvedValue(undefined),
    updateMemberRole: vi.fn().mockResolvedValue({}),
    requestMembership: vi.fn().mockResolvedValue(undefined),
  },
}))

// Mock votingService
vi.mock('@/services/votingService', () => ({
  votingService: {
    hasVoted: vi.fn().mockResolvedValue(false),
    castVote: vi.fn().mockResolvedValue({ id: 'vote-123' }),
  },
}))

const mockCandidates: Candidate[] = [
  {
    id: 'cand-1',
    election_id: 'elec-123',
    user_id: 'user-cand-1',
    name: 'Alice Johnson',
    bio: 'Dedicated student leader',
    photo_url: null,
    status: 'approved',
    display_order: 1,
    ai_summary: null,
    on_chain_candidate_id: null,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
  },
]

describe('Voter Approval & Management System Integration Tests', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
  })

  it('renders tabs with accurate real database counts for Pending, Approved, and Rejected', async () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { id: 'admin-1', email: 'admin@gcet.edu' } as any,
      profile: { id: 'admin-1', full_name: 'Admin User', platform_role: 'organizer' } as any,
      activeMembership: {
        organization_id: 'org-gcet',
        org_id: 'org-gcet',
        user_id: 'admin-1',
        role: 'admin',
        organization: { id: 'org-gcet', name: 'GCET University', slug: 'gcet' } as any,
      },
      memberships: [],
      session: null,
      loading: false,
      isPlatformOwner: false,
      isOrgAdmin: true,
      isOrganizer: true,
      isVoterOnly: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
      switchOrganization: vi.fn(),
    })

    vi.mocked(organizationService.getMembers).mockResolvedValue([
      {
        organization_id: 'org-gcet',
        user_id: 'voter-pending-1',
        role: 'viewer',
        status: 'pending',
        joined_at: '2026-07-01T10:00:00Z',
        created_at: '2026-07-01T10:00:00Z',
        user_profile: {
          id: 'voter-pending-1',
          full_name: 'John Pending',
          email: 'john@student.gcet.edu',
          avatar_url: null,
          wallet_address: '0x1111111111111111111111111111111111111111',
          created_at: '2026-07-01T10:00:00Z',
        },
      },
      {
        organization_id: 'org-gcet',
        user_id: 'voter-approved-1',
        role: 'viewer',
        status: 'approved',
        joined_at: '2026-06-28T12:00:00Z',
        created_at: '2026-06-28T12:00:00Z',
        user_profile: {
          id: 'voter-approved-1',
          full_name: 'Jane Approved',
          email: 'jane@student.gcet.edu',
          avatar_url: null,
          wallet_address: '0x2222222222222222222222222222222222222222',
          created_at: '2026-06-28T12:00:00Z',
        },
      },
      {
        organization_id: 'org-gcet',
        user_id: 'voter-rejected-1',
        role: 'viewer',
        status: 'rejected',
        joined_at: '2026-06-29T12:00:00Z',
        created_at: '2026-06-29T12:00:00Z',
        user_profile: {
          id: 'voter-rejected-1',
          full_name: 'Bob Rejected',
          email: 'bob@student.gcet.edu',
          avatar_url: null,
          wallet_address: null,
          created_at: '2026-06-29T12:00:00Z',
        },
      },
    ])

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ManageMembersPage />
        </MemoryRouter>
      </QueryClientProvider>
    )

    // Wait for members query
    await waitFor(() => {
      expect(screen.getByText('John Pending')).toBeInTheDocument()
    })

    // Verify tabs have accurate counts
    expect(screen.getByRole('button', { name: /pending requests/i })).toHaveTextContent('1')
    expect(screen.getByRole('button', { name: /approved voters/i })).toHaveTextContent('1')
    expect(screen.getByRole('button', { name: /removed \/ rejected/i })).toHaveTextContent('1')

    // On Pending tab, John Pending has Accept and Reject buttons
    expect(screen.getByRole('button', { name: /^accept$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^reject$/i })).toBeInTheDocument()
  })

  it('organizer clicking Accept calls organizationService.approveMember and shows success toast', async () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { id: 'admin-1', email: 'admin@gcet.edu' } as any,
      profile: { id: 'admin-1', full_name: 'Admin User', platform_role: 'organizer' } as any,
      activeMembership: {
        organization_id: 'org-gcet',
        org_id: 'org-gcet',
        user_id: 'admin-1',
        role: 'admin',
        organization: { id: 'org-gcet', name: 'GCET University', slug: 'gcet' } as any,
      },
      memberships: [],
      session: null,
      loading: false,
      isPlatformOwner: false,
      isOrgAdmin: true,
      isOrganizer: true,
      isVoterOnly: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
      switchOrganization: vi.fn(),
    })

    vi.mocked(organizationService.getMembers).mockResolvedValue([
      {
        organization_id: 'org-gcet',
        user_id: 'voter-pending-1',
        role: 'viewer',
        status: 'pending',
        joined_at: '2026-07-01T10:00:00Z',
        user_profile: {
          id: 'voter-pending-1',
          full_name: 'John Pending',
          email: 'john@student.gcet.edu',
          avatar_url: null,
          wallet_address: null,
        },
      },
    ])

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ManageMembersPage />
        </MemoryRouter>
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('John Pending')).toBeInTheDocument()
    })

    const acceptBtn = screen.getByRole('button', { name: /accept/i })
    fireEvent.click(acceptBtn)

    await waitFor(() => {
      expect(organizationService.approveMember).toHaveBeenCalledWith('org-gcet', 'voter-pending-1')
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('approved'))
    })
  })

  it('organizer clicking Remove opens confirmation modal and confirms removal', async () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { id: 'admin-1', email: 'admin@gcet.edu' } as any,
      profile: { id: 'admin-1', full_name: 'Admin User', platform_role: 'organizer' } as any,
      activeMembership: {
        organization_id: 'org-gcet',
        org_id: 'org-gcet',
        user_id: 'admin-1',
        role: 'admin',
        organization: { id: 'org-gcet', name: 'GCET University', slug: 'gcet' } as any,
      },
      memberships: [],
      session: null,
      loading: false,
      isPlatformOwner: false,
      isOrgAdmin: true,
      isOrganizer: true,
      isVoterOnly: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
      switchOrganization: vi.fn(),
    })

    vi.mocked(organizationService.getMembers).mockResolvedValue([
      {
        organization_id: 'org-gcet',
        user_id: 'voter-approved-1',
        role: 'viewer',
        status: 'approved',
        joined_at: '2026-06-28T12:00:00Z',
        user_profile: {
          id: 'voter-approved-1',
          full_name: 'Jane Approved',
          email: 'jane@student.gcet.edu',
          avatar_url: null,
          wallet_address: null,
        },
      },
    ])

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ManageMembersPage />
        </MemoryRouter>
      </QueryClientProvider>
    )

    // Switch to Approved tab
    const approvedTab = screen.getByRole('button', { name: /approved voters/i })
    fireEvent.click(approvedTab)

    await waitFor(() => {
      expect(screen.getByText('Jane Approved')).toBeInTheDocument()
    })

    // Click Remove button
    const removeBtn = screen.getByRole('button', { name: /^remove$/i })
    fireEvent.click(removeBtn)

    // Confirmation modal should be visible
    expect(screen.getByText('Remove Voter from Organization')).toBeInTheDocument()
    expect(screen.getByText(/Are you sure you want to remove/i)).toBeInTheDocument()

    // Click Confirm Removal
    const confirmBtn = screen.getByRole('button', { name: /confirm removal/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(organizationService.removeMember).toHaveBeenCalledWith('org-gcet', 'voter-approved-1')
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('removed'))
    })
  })

  it('displays wallet mismatch warning in VotingInterface when connected wallet does not match registered profile', async () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { id: 'voter-1', email: 'voter@gcet.edu' } as any,
      profile: {
        id: 'voter-1',
        full_name: 'Voter User',
        platform_role: 'voter',
        wallet_address: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      } as any,
      activeMembership: null,
      memberships: [],
      session: null,
      loading: false,
      isPlatformOwner: false,
      isOrgAdmin: false,
      isOrganizer: false,
      isVoterOnly: true,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
      switchOrganization: vi.fn(),
    })

    vi.spyOn(WalletContext, 'useWallet').mockReturnValue({
      address: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', // Different address!
      balance: '0.5',
      isConnected: true,
      isCorrectNetwork: true,
      status: 'connected',
      connect: vi.fn(),
      disconnect: vi.fn(),
      refreshBalance: vi.fn(),
    })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <VotingInterface
            electionId="elec-123"
            electionType="single_choice"
            maxVotesPerVoter={1}
            candidates={mockCandidates}
          />
        </MemoryRouter>
      </QueryClientProvider>
    )

    // Wallet mismatch banner should be visible after component loads
    await waitFor(() => {
      expect(screen.getByText('Wallet Mismatch Detected')).toBeInTheDocument()
    })
    expect(screen.getByText(/does not match your registered voter wallet/i)).toBeInTheDocument()
  })

  describe('electionService.checkEligibility allowlist logic', () => {
    it('returns true when voter is explicitly present on election_voters allowlist', async () => {
      const mockSupabase = await import('@services/supabase/client')
      vi.spyOn(mockSupabase.supabase.auth, 'getUser').mockResolvedValue({
        data: { user: { id: 'voter-allowlisted' } as any },
        error: null,
      })

      vi.spyOn(electionService, 'getById').mockResolvedValue({
        id: 'elec-1',
        org_id: 'org-1',
        title: 'Student Council',
        is_active_eligibility: 'voter_list',
        status: 'open',
      } as any)

      vi.spyOn(mockSupabase.supabase, 'from').mockImplementation((table: string) => {
        if (table === 'election_voters') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'ev-1' }, error: null }),
          } as any
        }
        return {} as any
      })

      const isEligible = await electionService.checkEligibility('elec-1')
      expect(isEligible).toBe(true)
    })

    it('returns true when election is entire_org and voter is an approved member of the host org', async () => {
      const mockSupabase = await import('@services/supabase/client')
      vi.spyOn(mockSupabase.supabase.auth, 'getUser').mockResolvedValue({
        data: { user: { id: 'voter-approved' } as any },
        error: null,
      })

      vi.spyOn(electionService, 'getById').mockResolvedValue({
        id: 'elec-2',
        org_id: 'org-1',
        title: 'Campus Election',
        is_active_eligibility: 'entire_org',
        status: 'open',
      } as any)

      vi.spyOn(mockSupabase.supabase, 'from').mockImplementation((table: string) => {
        if (table === 'election_voters') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          } as any
        }
        if (table === 'org_memberships') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { role: 'viewer', status: 'approved' },
              error: null,
            }),
          } as any
        }
        return {} as any
      })

      const isEligible = await electionService.checkEligibility('elec-2')
      expect(isEligible).toBe(true)
    })

    it('returns false when voter is in pending status and not explicitly allowlisted', async () => {
      const mockSupabase = await import('@services/supabase/client')
      vi.spyOn(mockSupabase.supabase.auth, 'getUser').mockResolvedValue({
        data: { user: { id: 'voter-pending' } as any },
        error: null,
      })

      vi.spyOn(electionService, 'getById').mockResolvedValue({
        id: 'elec-3',
        org_id: 'org-1',
        title: 'Campus Election',
        is_active_eligibility: 'entire_org',
        status: 'open',
      } as any)

      vi.spyOn(mockSupabase.supabase, 'from').mockImplementation((table: string) => {
        if (table === 'election_voters') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          } as any
        }
        if (table === 'org_memberships') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { role: 'viewer', status: 'pending' },
              error: null,
            }),
          } as any
        }
        return {} as any
      })

      const isEligible = await electionService.checkEligibility('elec-3')
      expect(isEligible).toBe(false)
    })

    it('submits a persistent election participation request in pending status', async () => {
      const mockSupabase = await import('@services/supabase/client')
      vi.spyOn(mockSupabase.supabase.auth, 'getUser').mockResolvedValue({
        data: { user: { id: 'voter-req-1' } as any },
        error: null,
      })

      const insertMock = vi.fn().mockResolvedValue({ error: null })
      vi.spyOn(mockSupabase.supabase, 'from').mockImplementation((table: string) => {
        if (table === 'election_voters') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            insert: insertMock,
          } as any
        }
        return {} as any
      })

      await electionService.requestElectionAccess('elec-4')
      expect(insertMock).toHaveBeenCalledWith({
        election_id: 'elec-4',
        user_id: 'voter-req-1',
        status: 'pending',
      })
    })

    it('approves a voter for an election and updates status to approved', async () => {
      const mockSupabase = await import('@services/supabase/client')
      vi.spyOn(mockSupabase.supabase.auth, 'getUser').mockResolvedValue({
        data: { user: { id: 'admin-1' } as any },
        error: null,
      })

      const upsertMock = vi.fn().mockResolvedValue({ error: null })
      vi.spyOn(mockSupabase.supabase, 'from').mockImplementation((table: string) => {
        if (table === 'election_voters') {
          return {
            upsert: upsertMock,
          } as any
        }
        return {} as any
      })

      await electionService.approveElectionVoter('elec-4', 'voter-req-1')
      expect(upsertMock).toHaveBeenCalledWith(
        {
          election_id: 'elec-4',
          user_id: 'voter-req-1',
          status: 'approved',
          added_by: 'admin-1',
        },
        { onConflict: 'election_id,user_id' }
      )
    })
  })
})

