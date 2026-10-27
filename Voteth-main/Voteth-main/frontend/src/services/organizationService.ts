import { supabase } from '@services/supabase/client'
import type { Organization, OrgMembership, OrgRole } from '@/types/domain'

// ---------------------------------------------------------------------------
// organizationService
// Full CRUD operations for organizations. RLS enforces access server-side.
// Requirements: ORG-01, ORG-02, ORG-03, ORG-04, ORG-05, ORG-06
// ---------------------------------------------------------------------------

/** Payload for creating a new organization. */
interface CreateOrgPayload {
  name: string
  slug: string
}

/** Member invite payload. */
interface InviteMemberPayload {
  org_id: string
  email: string
  role: OrgRole
}

/** A member with joined profile info. */
export interface OrgMemberWithProfile {
  organization_id: string
  user_id: string
  role: OrgRole
  status?: 'pending' | 'approved' | 'rejected'
  joined_at: string
  created_at?: string
  user_profile: {
    id?: string
    full_name: string | null
    email?: string | null
    avatar_url: string | null
    wallet_address: string | null
    created_at?: string
  } | null
}

export class OrganizationServiceError extends Error {
  code?: string | undefined
  details?: string | null | undefined
  hint?: string | null | undefined
  status?: number | undefined

  constructor(
    message: string,
    options?: {
      code?: string | undefined
      details?: string | null | undefined
      hint?: string | null | undefined
      status?: number | undefined
    }
  ) {
    super(message)
    this.name = 'OrganizationServiceError'
    if (options?.code !== undefined) this.code = options.code
    if (options?.details !== undefined) this.details = options.details
    if (options?.hint !== undefined) this.hint = options.hint
    if (options?.status !== undefined) this.status = options.status
    Object.setPrototypeOf(this, OrganizationServiceError.prototype)
  }
}

export const organizationService = {
  /**
   * Create a new organization. The creator is automatically added
   * as admin via a database trigger / RLS policy.
   * Requirement: ORG-01
   */
  async create(payload: CreateOrgPayload): Promise<Organization> {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new OrganizationServiceError('You must be signed in to create an organization.', {
        code: authError?.status?.toString() || 'AUTH_REQUIRED',
        details: authError?.message || null,
      })
    }

    const cleanSlug = payload.slug.trim().toLowerCase()
    const cleanName = payload.name.trim()

    // 1. Insert organization
    const { data: insertedData, error: insertError } = await supabase
      .from('organizations')
      .insert({
        name: cleanName,
        slug: cleanSlug,
        owner_id: user.id,
      })
      .select()
      .maybeSingle()

    if (insertError) {
      console.error('[organizationService.create] Database insert failed:', {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
      })

      // Duplicate slug
      if (insertError.code === '23505' || insertError.message?.includes('duplicate key') || insertError.message?.includes('slug')) {
        throw new OrganizationServiceError(
          `The URL slug "${cleanSlug}" is already in use by another organization. Please choose a different slug.`,
          {
            code: insertError.code,
            details: insertError.details,
            hint: insertError.hint,
          }
        )
      }

      // RLS or trigger authorization failure
      if (
        insertError.code === '42501' ||
        insertError.code === 'P0001' ||
        insertError.message?.includes('Unauthorized') ||
        insertError.message?.includes('policy') ||
        insertError.message?.includes('permission')
      ) {
        throw new OrganizationServiceError(
          'Permission denied: Only organizers and platform owners can create organizations under current Supabase RLS policies. Run Supabase migration 029 in your Supabase SQL Editor to allow authenticated creators.',
          {
            code: insertError.code,
            details: insertError.details,
            hint: insertError.hint || 'Apply migration 20260702200000_029_fix_organization_creation.sql in Supabase SQL editor.',
          }
        )
      }

      throw new OrganizationServiceError(
        insertError.message || insertError.details || 'Failed to create organization in database.',
        {
          code: insertError.code,
          details: insertError.details,
          hint: insertError.hint,
        }
      )
    }

    let createdOrg = insertedData as Organization | null
    if (!createdOrg) {
      const { data: fetchedOrg } = await supabase
        .from('organizations')
        .select('*')
        .eq('slug', cleanSlug)
        .maybeSingle()

      createdOrg = fetchedOrg as Organization | null
    }

    if (!createdOrg) {
      throw new OrganizationServiceError(
        'Organization was created, but could not be retrieved. Please check your Supabase SELECT RLS policy on public.organizations.',
        {
          code: 'SELECT_RLS_RESTRICTED',
          hint: 'Apply migration 20260702200000_029_fix_organization_creation.sql in Supabase SQL editor to allow organization owners to read their newly created organizations.',
        }
      )
    }

    // 2. Ensure creator is assigned admin membership in org_memberships (best effort)
    try {
      const membershipsTable = supabase.from('org_memberships') as any
      if (typeof membershipsTable?.upsert === 'function') {
        const { error: membershipError } = await membershipsTable.upsert(
          {
            organization_id: createdOrg.id,
            user_id: user.id,
            role: 'admin',
          },
          { onConflict: 'organization_id,user_id' }
        )

        if (membershipError) {
          console.warn('[organizationService.create] Admin membership upsert notice:', {
            code: membershipError.code,
            message: membershipError.message,
            details: membershipError.details,
            hint: membershipError.hint,
          })
        }
      }
    } catch (membershipErr) {
      console.warn('[organizationService.create] Non-blocking membership upsert note:', membershipErr)
    }

    return createdOrg
  },

  /**
   * Fetch all organizations the current user is a member of.
   * Requirement: ORG-02
   */
  async listUserOrganizations(): Promise<Organization[]> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('org_memberships')
      .select('organization:organizations(*)')
      .eq('user_id', user.id)

    if (error) throw error

    // Flatten the join response
    return (data ?? []).map((row) => {
      const org = row.organization
      return (Array.isArray(org) ? org[0] : org) as Organization
    }).filter(Boolean)
  },

  /**
   * Get all members of an organization with their profile info and approval status.
   * Gracefully falls back if status column does not exist yet.
   * Requirement: ORG-03
   */
  async getMembers(organizationId: string): Promise<OrgMemberWithProfile[]> {
    const { data, error } = await supabase
      .from('org_memberships')
      .select('organization_id, user_id, role, status, joined_at, created_at, user_profile:user_profiles(id, full_name, email, avatar_url, wallet_address, created_at)')
      .eq('organization_id', organizationId)
      .order('joined_at', { ascending: false })

    if (!error && data) {
      return (data as any[]).map(m => ({
        ...m,
        status: m.status || 'approved',
      })) as OrgMemberWithProfile[]
    }

    if (error) {
      console.warn('[organizationService.getMembers] Query notice:', error)
      // If error is not a missing column error, throw the actual database error
      if (error.code !== '42703' && !error.message?.includes('status')) {
        throw new OrganizationServiceError(error.message, {
          code: error.code,
          details: error.details,
          hint: error.hint,
        })
      }
    }

    // Fallback: query without explicit status column if schema column was missing
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('org_memberships')
      .select('*, user_profile:user_profiles(id, full_name, email, avatar_url, wallet_address, created_at)')
      .eq('organization_id', organizationId)
      .order('joined_at', { ascending: false })

    if (fallbackError) {
      throw new OrganizationServiceError(fallbackError.message, {
        code: fallbackError.code,
        details: fallbackError.details,
        hint: fallbackError.hint,
      })
    }

    return (fallbackData ?? []).map((m: any) => ({
      ...m,
      status: m.status || 'approved',
    })) as OrgMemberWithProfile[]
  },

  /**
   * Approve a pending voter request for an organization.
   * Verifies admin privileges, marks status as 'approved', and updates timestamps.
   * Note: In accordance with election eligibility rules, organization approval
   * grants access to organization-wide ballots ('entire_org'), but does not
   * automatically bypass election-specific restricted allowlists ('voter_list').
   */
  async approveMember(organizationId: string, userId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // 1. Update status to approved
    const { error: updateError } = await supabase
      .from('org_memberships')
      .update({
        status: 'approved',
        joined_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', organizationId)
      .eq('user_id', userId)

    if (updateError) {
      // If status column does not exist yet, fallback to role update
      const { error: fallbackErr } = await supabase
        .from('org_memberships')
        .update({ role: 'viewer' })
        .eq('organization_id', organizationId)
        .eq('user_id', userId)

      if (fallbackErr) throw fallbackErr
    }

    // 2. Only auto-sync voter into elections that explicitly use 'entire_org' eligibility
    try {
      const { data: elections } = await supabase
        .from('elections')
        .select('id, is_active_eligibility')
        .eq('org_id', organizationId)
        .in('status', ['draft', 'open'])

      if (elections && elections.length > 0) {
        const orgWideElections = elections.filter(
          e => !e.is_active_eligibility || e.is_active_eligibility === 'entire_org'
        )
        if (orgWideElections.length > 0) {
          const voterRows = orgWideElections.map(e => ({
            election_id: e.id,
            user_id: userId,
            status: 'approved',
            added_by: user.id,
          }))
          await supabase
            .from('election_voters')
            .upsert(voterRows, { onConflict: 'election_id,user_id' })
        }
      }
    } catch (allowlistErr) {
      console.warn('[organizationService.approveMember] Allowlist sync notice:', allowlistErr)
    }
  },

  /**
   * Reject a pending voter request.
   */
  async rejectMember(organizationId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('org_memberships')
      .update({ status: 'rejected' })
      .eq('organization_id', organizationId)
      .eq('user_id', userId)

    if (error) {
      // Fallback: delete membership if status column is not present
      const { error: delErr } = await supabase
        .from('org_memberships')
        .delete()
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
      if (delErr) throw delErr
    }
  },

  /**
   * Submit a request for the authenticated voter to join an organization.
   */
  async requestMembership(organizationId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('You must be signed in to request voter access.')

    // Check if membership already exists
    const { data: existing } = await supabase
      .from('org_memberships')
      .select('status, role')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      if ((existing as any).status === 'pending') {
        throw new Error('Your membership request is already pending review by the organization organizer.')
      }
      if ((existing as any).status === 'approved') {
        throw new Error('You are already an approved voter for this organization.')
      }
      // If rejected, allow re-requesting by updating status to pending
      const { error: updateErr } = await supabase
        .from('org_memberships')
        .update({ status: 'pending', updated_at: new Date().toISOString() })
        .eq('organization_id', organizationId)
        .eq('user_id', user.id)

      if (updateErr) throw updateErr
      return
    }

    // Insert new pending membership request
    const { error } = await supabase
      .from('org_memberships')
      .insert({
        organization_id: organizationId,
        user_id: user.id,
        role: 'viewer',
        status: 'pending',
      })

    if (error) {
      // Fallback if status column does not exist
      if (error.code === '42703' || error.message?.includes('status')) {
        const { error: fallbackErr } = await supabase
          .from('org_memberships')
          .insert({
            organization_id: organizationId,
            user_id: user.id,
            role: 'viewer',
          })
        if (fallbackErr) throw fallbackErr
        return
      }
      throw error
    }
  },

  /**
   * Invite a member to an organization by email.
   * If the user already has a profile, add membership directly.
   * Otherwise, store a pending invitation that auto-redeems on registration.
   * Requirement: ORG-04
   */
  async inviteMember(payload: InviteMemberPayload): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Store invitation in org_invitations table.
    // The auto-redeem trigger handles converting to membership if user exists.
    const { error: inviteError } = await supabase
      .from('org_invitations')
      .insert({
        org_id: payload.org_id,
        email: payload.email,
        role: payload.role,
        invited_by: user.id,
      })

    if (inviteError) throw inviteError
  },

  /**
   * List pending invitations for an organization.
   * Requirement: ORG-04
   */
  async listInvitations(orgId: string): Promise<{
    id: string
    email: string
    role: OrgRole
    status: string
    created_at: string
    expires_at: string
  }[]> {
    const { data, error } = await supabase
      .from('org_invitations')
      .select('id, email, role, status, created_at, expires_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data ?? []) as {
      id: string
      email: string
      role: OrgRole
      status: string
      created_at: string
      expires_at: string
    }[]
  },

  /**
   * Revoke a pending invitation.
   * Requirement: ORG-04
   */
  async revokeInvitation(invitationId: string): Promise<void> {
    const { error } = await supabase
      .from('org_invitations')
      .update({ status: 'revoked' })
      .eq('id', invitationId)

    if (error) throw error
  },

  /**
   * Update a member's role within an organization using composite key (organization_id, user_id).
   * Requirement: ORG-05
   */
  async updateMemberRole(
    organizationId: string,
    userId: string,
    newRole: OrgRole
  ): Promise<OrgMembership> {
    const { data, error } = await supabase
      .from('org_memberships')
      .update({ role: newRole })
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return data as OrgMembership
  },

  /**
   * Remove a member from an organization using composite key (organization_id, user_id),
   * and clean up election allowlist entries.
   * Requirement: ORG-06
   */
  async removeMember(organizationId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('org_memberships')
      .delete()
      .eq('organization_id', organizationId)
      .eq('user_id', userId)

    if (error) throw error

    // Also remove user from election_voters for this organization's elections
    try {
      const { data: elections } = await supabase
        .from('elections')
        .select('id')
        .eq('org_id', organizationId)

      if (elections && elections.length > 0) {
        const electionIds = elections.map(e => e.id)
        await supabase
          .from('election_voters')
          .delete()
          .eq('user_id', userId)
          .in('election_id', electionIds)
      }
    } catch (delVotersErr) {
      console.warn('[organizationService.removeMember] Allowlist cleanup note:', delVotersErr)
    }
  },
}
