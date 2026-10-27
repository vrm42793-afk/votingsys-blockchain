import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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

const mockOpenElection = {
  id: 'elec-gcet-2026',
  title: 'GCET Student Council Election 2026',
  description: 'Annual election for the GCET student representative committee.',
  status: 'open',
  start_date: '2026-07-01T00:00:00Z',
  end_date: '2026-07-15T23:59:59Z',
  created_at: '2026-06-25T10:00:00Z',
  org_id: 'org-gcet-123',
  organization: { name: 'GCET University' },
  candidates: [{ id: 'cand-1' }, { id: 'cand-2' }],
}

const mockPublishedElection = {
  id: 'elec-civic-2026',
  title: 'Community Green Energy Initiative',
  description: 'Civic referendum on municipal renewable energy.',
  status: 'published',
  start_date: '2026-05-01T00:00:00Z',
  end_date: '2026-05-10T23:59:59Z',
  created_at: '2026-04-20T10:00:00Z',
  org_id: 'org-civic-456',
  organization: { name: 'Civic Alliance' },
  candidates: [{ id: 'cand-3' }],
}

vi.mock('@services/supabase/client', () => {
  return {
    supabase: {
      from: vi.fn((table: string) => {
        if (table === 'elections') {
          const chain: any = {
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockImplementation((_col: string, values: string[]) => {
              const matched = [mockOpenElection, mockPublishedElection].filter(e =>
                values.includes(e.status)
              )
              return {
                then: (resolve: any) => resolve({ data: matched, error: null }),
                order: vi.fn().mockReturnThis(),
              }
            }),
            single: vi.fn().mockResolvedValue({ data: mockOpenElection, error: null }),
          }
          // Default query resolving all available elections
          chain.then = (resolve: any) => resolve({ data: [mockOpenElection, mockPublishedElection], error: null })
          return chain
        }

        if (table === 'votes') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ count: 2, error: null }),
          }
        }

        if (table === 'candidates') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: [
                { id: 'cand-1', name: 'Alice Walker', status: 'approved', bio: 'Leadership candidate' },
                { id: 'cand-2', name: 'Bob Roberts', status: 'approved', bio: 'Engineering rep' },
              ],
              error: null,
            }),
          }
        }

        if (table === 'election_voters') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: [{ id: 'ev-1' }], error: null }),
          }
        }

        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }),
      channel: vi.fn().mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnValue({
          unsubscribe: vi.fn(),
        }),
      }),
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'voter-uuid-1', email: 'voter@voteth.io' } },
        }),
      },
    },
  }
})

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

describe('Voter Election Visibility & Discovery Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    // Voter has NO active membership (activeMembership = null, memberships = [])
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { id: 'voter-uuid-1', email: 'voter@voteth.io', user_metadata: {} } as any,
      profile: {
        id: 'voter-uuid-1',
        email: 'voter@voteth.io',
        full_name: 'Priya Sharma',
        platform_role: 'voter',
        is_suspended: false,
        avatar_url: null,
        wallet_address: '0x171120240000000000000000000000000000b38b',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      activeMembership: null,
      memberships: [],
      session: { user: { id: 'voter-uuid-1' } } as any,
      loading: false,
      isPlatformOwner: false,
      isOrgAdmin: false,
      isOrganizer: false,
      isVoterOnly: true,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
      switchOrganization: vi.fn(),
    })
  })

  it('allows a voter with no active membership to see available elections on Dashboard', async () => {
    renderRoute('/dashboard')

    // Must NOT lock voter out with "No Active Organization"
    expect(screen.queryByRole('heading', { name: /No Active Organization/i })).not.toBeInTheDocument()

    // Greeting must display
    expect(screen.getByRole('heading', { name: /Hello Priya/i })).toBeInTheDocument()

    // Available Ballots section must display elections with organization names
    await waitFor(() => {
      expect(screen.getByText('GCET Student Council Election 2026')).toBeInTheDocument()
    })
    expect(screen.getByText(/GCET University/i)).toBeInTheDocument()
    expect(screen.getByText('Community Green Energy Initiative')).toBeInTheDocument()
    expect(screen.getByText(/Civic Alliance/i)).toBeInTheDocument()
  })

  it('allows a voter to browse all ballots on /elections without being blocked', async () => {
    renderRoute('/elections')

    // Must NOT show "No Active Organization" screen
    expect(screen.queryByRole('heading', { name: /No Active Organization/i })).not.toBeInTheDocument()

    // Header and filter tabs must render
    expect(screen.getByRole('heading', { name: /Elections Ballot/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /All Ballots/i })).toBeInTheDocument()

    // Elections and their host organization badges must render
    await waitFor(() => {
      expect(screen.getByText('GCET Student Council Election 2026')).toBeInTheDocument()
    })
    expect(screen.getByText('GCET University')).toBeInTheDocument()
    expect(screen.getByText('Community Green Energy Initiative')).toBeInTheDocument()
    expect(screen.getByText('Civic Alliance')).toBeInTheDocument()

    // Direct actions must be available: "Cast Vote" for open election, "View Results" for published
    expect(screen.getByRole('link', { name: /Cast Vote/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /View Results/i })).toBeInTheDocument()
  })
})
