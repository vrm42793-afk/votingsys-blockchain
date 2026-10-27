import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppRouter } from '@/routes/AppRouter'
import * as AuthContext from '@/contexts/AuthContext'

vi.mock('@/contexts/WalletContext', () => ({
  useWallet: vi.fn().mockReturnValue({
    address: '0x171120240000000000000000000000000000b38b',
    balance: '0.5',
    isConnected: true,
    status: 'connected',
    connect: vi.fn(),
    disconnect: vi.fn(),
    refreshBalance: vi.fn(),
    isConnecting: false,
    error: null,
    chainId: 11155111,
  }),
  WalletProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: vi.fn().mockReturnValue({
    theme: 'dark',
    toggleTheme: vi.fn(),
    setTheme: vi.fn(),
  }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })
}

function renderRoute(initialEntry: string) {
  const queryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AppRouter />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Role-Based Dashboards & Separation (Voter vs Organizer)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('Scenario 1: Voter login renders voter dashboard and hides organizer panels', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { id: 'voter-1', email: 'voter@voteth.io', user_metadata: {} } as any,
      profile: {
        id: 'voter-1',
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
      session: { user: { id: 'voter-1' } } as any,
      loading: false,
      isPlatformOwner: false,
      isOrgAdmin: false,
      isOrganizer: false,
      isVoterOnly: true,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
      switchOrganization: vi.fn(),
    })

    renderRoute('/dashboard')

    // Voter sees greeting and voter actions
    expect(screen.getByRole('heading', { name: /Hello Regular/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Available Ballots/i })).toBeInTheDocument()
    // Voter must NOT see organizer controls
    expect(screen.queryByText(/Organizer Panel/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Platform Admin Panel/i)).not.toBeInTheDocument()
  })

  it('Scenario 2: Organizer login (platform_role = voter, role = admin in org_memberships) displays organizer panel', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { id: 'org-admin-1', email: 'organizer@gcet.edu', user_metadata: {} } as any,
      profile: {
        id: 'org-admin-1',
        email: 'organizer@gcet.edu',
        full_name: 'GCET Organizer',
        platform_role: 'voter', // In schema, creators stay platform_role = voter
        is_suspended: false,
        avatar_url: null,
        wallet_address: null,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      activeMembership: {
        organization_id: 'org-gcet',
        org_id: 'org-gcet',
        user_id: 'org-admin-1',
        role: 'admin',
        organization: { id: 'org-gcet', name: 'GCET', slug: 'gcet' } as any,
      },
      memberships: [
        {
          organization_id: 'org-gcet',
          org_id: 'org-gcet',
          user_id: 'org-admin-1',
          role: 'admin',
          organization: { id: 'org-gcet', name: 'GCET', slug: 'gcet' } as any,
        },
      ],
      session: { user: { id: 'org-admin-1' } } as any,
      loading: false,
      isPlatformOwner: false,
      isOrgAdmin: true,
      isOrganizer: true, // Recognized as organizer via organization admin membership
      isVoterOnly: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
      switchOrganization: vi.fn(),
    })

    renderRoute('/organizer')

    // Organizer sees governance panel
    expect(screen.getByRole('heading', { name: /Organizer Panel/i })).toBeInTheDocument()
    expect(screen.getAllByText(/GCET/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Create Election/i })).toBeInTheDocument()
  })

  it('Scenario 3: Organizer without active organization sees organizer onboarding to create organization', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: {
        id: 'new-org-user',
        email: 'neworg@voteth.io',
        user_metadata: { platform_role: 'organizer', org_name: 'New Campus' },
      } as any,
      profile: {
        id: 'new-org-user',
        email: 'neworg@voteth.io',
        full_name: 'New Organizer',
        platform_role: 'voter',
        is_suspended: false,
        avatar_url: null,
        wallet_address: null,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      activeMembership: null,
      memberships: [],
      session: { user: { id: 'new-org-user' } } as any,
      loading: false,
      isPlatformOwner: false,
      isOrgAdmin: false,
      isOrganizer: true, // Recognized via registration metadata
      isVoterOnly: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
      switchOrganization: vi.fn(),
    })

    renderRoute('/organizer')

    // Organizer with no org yet sees onboarding to create their organization
    expect(screen.getByRole('heading', { name: /Organizer Workspace/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Create Organization/i })).toBeInTheDocument()
  })

  it('Scenario 4: Voter cannot access /organizer route and is redirected to /dashboard', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { id: 'voter-1', email: 'voter@voteth.io', user_metadata: {} } as any,
      profile: {
        id: 'voter-1',
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
      session: { user: { id: 'voter-1' } } as any,
      loading: false,
      isPlatformOwner: false,
      isOrgAdmin: false,
      isOrganizer: false,
      isVoterOnly: true,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
      switchOrganization: vi.fn(),
    })

    renderRoute('/organizer')

    // Voter must NOT see organizer panel; redirected to /dashboard
    expect(screen.queryByRole('heading', { name: /Organizer Panel/i })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Hello Regular/i })).toBeInTheDocument()
  })

  it('Scenario 5: Organizer cannot access platform owner /admin route and platform owner is separated', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { id: 'org-admin-1', email: 'organizer@gcet.edu', user_metadata: {} } as any,
      profile: {
        id: 'org-admin-1',
        email: 'organizer@gcet.edu',
        full_name: 'GCET Organizer',
        platform_role: 'voter',
        is_suspended: false,
        avatar_url: null,
        wallet_address: null,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      activeMembership: {
        organization_id: 'org-gcet',
        org_id: 'org-gcet',
        user_id: 'org-admin-1',
        role: 'admin',
        organization: { id: 'org-gcet', name: 'GCET' } as any,
      },
      memberships: [],
      session: { user: { id: 'org-admin-1' } } as any,
      loading: false,
      isPlatformOwner: false,
      isOrgAdmin: true,
      isOrganizer: true,
      isVoterOnly: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
      switchOrganization: vi.fn(),
    })

    renderRoute('/admin')

    // Organizer must NOT see platform owner controls
    expect(screen.queryByText(/Platform Console/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Contract Deployment/i)).not.toBeInTheDocument()
  })
})
