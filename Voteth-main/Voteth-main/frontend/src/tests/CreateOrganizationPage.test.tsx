import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { CreateOrganizationPage } from '@/components/pages/CreateOrganizationPage'
import { organizationService, OrganizationServiceError } from '@/services/organizationService'
import * as AuthContext from '@/contexts/AuthContext'

vi.mock('@/services/organizationService', () => {
  class MockOrgServiceError extends Error {
    code?: string
    details?: string | null
    hint?: string | null
    status?: number
    constructor(message: string, options?: any) {
      super(message)
      this.name = 'OrganizationServiceError'
      this.code = options?.code
      this.details = options?.details
      this.hint = options?.hint
      this.status = options?.status
    }
  }

  return {
    OrganizationServiceError: MockOrgServiceError,
    organizationService: {
      create: vi.fn(),
    },
  }
})

describe('CreateOrganizationPage Error Handling & Submission', () => {
  const mockRefreshProfile = vi.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { id: 'user-001', email: 'organizer@voteth.io' } as any,
      profile: { id: 'user-001', platform_role: 'organizer' } as any,
      activeMembership: null,
      memberships: [],
      session: { user: { id: 'user-001' } } as any,
      loading: false,
      isPlatformOwner: false,
      isOrgAdmin: false,
      isOrganizer: true,
      isVoterOnly: false,
      signOut: vi.fn(),
      refreshProfile: mockRefreshProfile,
      switchOrganization: vi.fn(),
    })
  })

  it('renders form and auto-generates slug from organization name', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <CreateOrganizationPage />
      </MemoryRouter>
    )

    const nameInput = screen.getByPlaceholderText(/e\.g\. Riverside University/i)
    const slugInput = screen.getByPlaceholderText(/riverside-university/i)

    await user.type(nameInput, 'GCET College')
    expect(slugInput).toHaveValue('gcet-college')
  })

  it('displays detailed error banner with code, details, and hint when RLS denies creation (never generic unexpected error)', async () => {
    const user = userEvent.setup()
    vi.mocked(organizationService.create).mockRejectedValueOnce(
      new OrganizationServiceError(
        'Permission denied: Only organizers and platform owners can create organizations under current Supabase RLS policies.',
        {
          code: '42501',
          details: 'Failing row contains (gcet, GCET).',
          hint: 'Apply migration 029 in Supabase SQL editor.',
        }
      )
    )

    render(
      <MemoryRouter>
        <CreateOrganizationPage />
      </MemoryRouter>
    )

    const nameInput = screen.getByPlaceholderText(/e\.g\. Riverside University/i)
    const slugInput = screen.getByPlaceholderText(/riverside-university/i)
    const submitBtn = screen.getByRole('button', { name: /Create Organization/i })

    await user.clear(nameInput)
    await user.type(nameInput, 'GCET')
    await user.clear(slugInput)
    await user.type(slugInput, 'gcet')
    await user.click(submitBtn)

    await waitFor(() => {
      // Must NOT display generic unexpected error
      expect(screen.queryByText(/An unexpected error occurred/i)).not.toBeInTheDocument()
      // Must display specific message and exact Supabase metadata
      expect(screen.getByText(/Permission denied: Only organizers and platform owners/i)).toBeInTheDocument()
      expect(screen.getByText(/42501/)).toBeInTheDocument()
      expect(screen.getByText(/Failing row contains/i)).toBeInTheDocument()
      expect(screen.getByText(/Apply migration 029/i)).toBeInTheDocument()
    })
  })

  it('handles duplicate slug error and surfaces 23505 code in UI', async () => {
    const user = userEvent.setup()
    vi.mocked(organizationService.create).mockRejectedValueOnce(
      new OrganizationServiceError(
        'The URL slug "gcet" is already in use by another organization. Please choose a different slug.',
        {
          code: '23505',
          details: 'Key (slug)=(gcet) already exists.',
          hint: 'Choose a different slug.',
        }
      )
    )

    render(
      <MemoryRouter>
        <CreateOrganizationPage />
      </MemoryRouter>
    )

    const nameInput = screen.getByPlaceholderText(/e\.g\. Riverside University/i)
    const slugInput = screen.getByPlaceholderText(/riverside-university/i)
    const submitBtn = screen.getByRole('button', { name: /Create Organization/i })

    await user.type(nameInput, 'GCET')
    await user.clear(slugInput)
    await user.type(slugInput, 'gcet')
    await user.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText(/already in use by another organization/i)).toBeInTheDocument()
      expect(screen.getByText(/23505/)).toBeInTheDocument()
    })
  })

  it('handles nested raw Supabase error objects safely without falling back to unexpected error', async () => {
    const user = userEvent.setup()
    vi.mocked(organizationService.create).mockRejectedValueOnce({
      error: {
        code: 'P0001',
        message: 'Unauthorized: Only organizers and platform owners can create organizations',
        details: 'Postgres trigger exception',
        hint: 'Promote account or run migration 029',
      },
    })

    render(
      <MemoryRouter>
        <CreateOrganizationPage />
      </MemoryRouter>
    )

    const nameInput = screen.getByPlaceholderText(/e\.g\. Riverside University/i)
    const slugInput = screen.getByPlaceholderText(/riverside-university/i)
    const submitBtn = screen.getByRole('button', { name: /Create Organization/i })

    await user.type(nameInput, 'GCET')
    await user.clear(slugInput)
    await user.type(slugInput, 'gcet')
    await user.click(submitBtn)

    await waitFor(() => {
      expect(screen.queryByText(/An unexpected error occurred/i)).not.toBeInTheDocument()
      expect(screen.getByText(/Unauthorized: Only organizers and platform owners/i)).toBeInTheDocument()
      expect(screen.getByText(/P0001/)).toBeInTheDocument()
    })
  })
})
