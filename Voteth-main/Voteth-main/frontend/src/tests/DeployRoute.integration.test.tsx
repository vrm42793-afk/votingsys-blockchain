/**
 * VotEth 2.0 — Route Integration Tests: /admin/deploy
 *
 * Verifies that the actual /admin/deploy route through AppRouter and ProtectedRoute:
 * - Redirects unauthenticated visitors to /auth/login
 * - Blocks and redirects authenticated voters to /dashboard
 * - Blocks and redirects workspace organizers to /dashboard
 * - Blocks and redirects sessions with missing/null profiles
 * - Displays loading screen during session authentication
 * - Only renders deployment controls for verified platform owners (platform_role === 'owner')
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { AppRouter } from '@/routes/AppRouter'
import { ThemeProvider } from '@/contexts/ThemeContext'
import * as AuthContext from '@/contexts/AuthContext'
import * as WalletContext from '@/contexts/WalletContext'

// Mock supabase client to prevent network requests during route redirection
vi.mock('@services/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    }),
    removeChannel: vi.fn(),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { status: 'healthy' }, error: null }),
    },
  },
}))

describe('AppRouter — /admin/deploy Protected Route Integration', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, enabled: false },
        mutations: { retry: false },
      },
    })

    // Default wallet mock
    vi.spyOn(WalletContext, 'useWallet').mockReturnValue({
      address: '0x171134414a74101c2a339cfde6f17ccb5c87b38b',
      balance: '0.1196',
      isConnected: true,
      isCorrectNetwork: true,
      status: 'connected',
      connect: vi.fn(),
      disconnect: vi.fn(),
      refreshBalance: vi.fn(),
    } as any)
  })

  function renderRoute(initialPath = '/admin/deploy') {
    return render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <MemoryRouter initialEntries={[initialPath]}>
            <AppRouter />
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>
    )
  }

  function mockAuth(overrides: Partial<AuthContext.AuthContextType> = {}) {
    const isOwner = overrides.profile?.platform_role === 'owner'
    const isOrganizer = isOwner || overrides.profile?.platform_role === 'organizer' || overrides.activeMembership?.role === 'admin'
    return vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: null,
      profile: null,
      activeMembership: null,
      memberships: [],
      session: null,
      loading: false,
      isPlatformOwner: isOwner,
      isOrgAdmin: overrides.activeMembership?.role === 'admin',
      isOrganizer: isOrganizer,
      isVoterOnly: !isOwner && !isOrganizer,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
      switchOrganization: vi.fn(),
      ...overrides,
    })
  }

  it('redirects unauthenticated visitor to /auth/login and denies deployment controls', () => {
    mockAuth({
      user: null,
      profile: null,
      activeMembership: null,
      memberships: [],
      session: null,
      loading: false,
    })

    renderRoute('/admin/deploy')

    // Must NOT render deployment controls
    expect(screen.queryByRole('heading', { name: /Smart Contract Deployment/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/Preview-Only Mode Active/i)).not.toBeInTheDocument()
    // Should render login interface
    expect(screen.getByRole('heading', { name: /Welcome back/i })).toBeInTheDocument()
  })

  it('blocks authenticated voter and redirects to /dashboard', () => {
    mockAuth({
      user: { id: 'voter-123', email: 'voter@voteth.io' } as any,
      profile: {
        id: 'voter-123',
        email: 'voter@voteth.io',
        full_name: 'Regular Voter',
        platform_role: 'voter',
        is_suspended: false,
        avatar_url: null,
        wallet_address: null,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      activeMembership: null,
      memberships: [],
      session: { user: { id: 'voter-123' } } as any,
      loading: false,
    })

    renderRoute('/admin/deploy')

    // Must NOT render deployment controls
    expect(screen.queryByRole('heading', { name: /Smart Contract Deployment/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/Preview-Only Mode Active/i)).not.toBeInTheDocument()
    // Should be on dashboard
    expect(screen.getByRole('heading', { name: /Hello Regular/i })).toBeInTheDocument()
  })

  it('blocks workspace organizer and redirects to /dashboard', () => {
    mockAuth({
      user: { id: 'org-admin-1', email: 'organizer@voteth.io' } as any,
      profile: {
        id: 'org-admin-1',
        email: 'organizer@voteth.io',
        full_name: 'Org Admin',
        platform_role: 'organizer',
        is_suspended: false,
        avatar_url: null,
        wallet_address: null,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      activeMembership: {
        organization_id: 'org-1',
        user_id: 'org-admin-1',
        role: 'admin',
        org_id: 'org-1',
        organization: { id: 'org-1', name: 'Test Org' } as any,
      },
      memberships: [],
      session: { user: { id: 'org-admin-1' } } as any,
      loading: false,
    })

    renderRoute('/admin/deploy')

    // Must NOT render deployment controls
    expect(screen.queryByRole('heading', { name: /Smart Contract Deployment/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/Preview-Only Mode Active/i)).not.toBeInTheDocument()
    // Should be on dashboard
    expect(screen.getByText(/Quick Actions/i)).toBeInTheDocument()
  })

  it('blocks user with missing/unverifiable profile and redirects to /dashboard', () => {
    mockAuth({
      user: { id: 'user-no-profile', email: 'noprofile@voteth.io' } as any,
      profile: null,
      activeMembership: null,
      memberships: [],
      session: { user: { id: 'user-no-profile' } } as any,
      loading: false,
    })

    renderRoute('/admin/deploy')

    expect(screen.queryByRole('heading', { name: /Smart Contract Deployment/i })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Hello Voter/i })).toBeInTheDocument()
  })

  it('displays loading indicator during authentication and does not render deployment controls', () => {
    mockAuth({
      user: null,
      profile: null,
      activeMembership: null,
      memberships: [],
      session: null,
      loading: true,
    })

    renderRoute('/admin/deploy')

    expect(screen.getByText(/Authenticating Session\.\.\./i)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Smart Contract Deployment/i })).not.toBeInTheDocument()
  })

  it('allows authorized platform owner to access /admin/deploy in preview mode', () => {
    mockAuth({
      user: { id: 'owner-super', email: 'owner@voteth.io' } as any,
      profile: {
        id: 'owner-super',
        email: 'owner@voteth.io',
        full_name: 'Platform Superadmin',
        platform_role: 'owner',
        is_suspended: false,
        avatar_url: null,
        wallet_address: '0x171134414a74101c2a339cfde6f17ccb5c87b38b',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      activeMembership: null,
      memberships: [],
      session: { user: { id: 'owner-super' } } as any,
      loading: false,
    })

    renderRoute('/admin/deploy')

    // Must render deployment controls and preview-only notice
    expect(screen.getByRole('heading', { name: /Smart Contract Deployment/i })).toBeInTheDocument()
    expect(screen.getByText(/Preview-Only Mode Active \(Phase 3\)/i)).toBeInTheDocument()
    expect(screen.getByText('VotEthRegistry')).toBeInTheDocument()
    expect(screen.getByText('VotEthElection')).toBeInTheDocument()
    expect(screen.getByText('VotEthVerifier')).toBeInTheDocument()
  })
})
