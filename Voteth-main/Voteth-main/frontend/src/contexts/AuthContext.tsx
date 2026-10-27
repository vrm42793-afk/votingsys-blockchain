/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '@services/supabase/client'
import { UserProfile, OrgMembership, Organization } from '@/types/domain'

interface MembershipJoinResponse extends Omit<OrgMembership, 'organization'> {
  organization: Organization | Organization[] | null
}

export interface ActiveMembership extends OrgMembership {
  org_id: string
  organization: Organization | null
}

export interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  activeMembership: ActiveMembership | null
  memberships: ActiveMembership[]
  session: Session | null
  loading: boolean
  isPlatformOwner: boolean
  isOrgAdmin: boolean
  isOrganizer: boolean
  isVoterOnly: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  switchOrganization: (orgId: string) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [memberships, setMemberships] = useState<ActiveMembership[]>([])
  const [activeMembership, setActiveMembership] = useState<ActiveMembership | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch profile, memberships, and organizations owned by this user
      const [profileRes, membershipsRes, ownedOrgsRes] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('id', userId).maybeSingle(),
        supabase
          .from('org_memberships')
          .select('*, organization:organizations(*)')
          .eq('user_id', userId),
        supabase
          .from('organizations')
          .select('*')
          .eq('owner_id', userId)
      ])

      if (profileRes.error) {
        console.error('[AuthContext] Error fetching profile:', profileRes.error.message)
        setProfile(null)
      } else if (profileRes.data) {
        setProfile(profileRes.data as UserProfile)
      } else {
        // Self-heal missing profile with least-privileged default role 'voter'
        try {
          const { data: newProfile } = await supabase
            .from('user_profiles')
            .insert({
              id: userId,
              email: user?.email,
              full_name: (user?.user_metadata?.full_name as string) || '',
              platform_role: 'voter',
            })
            .select()
            .maybeSingle()
          if (newProfile) {
            setProfile(newProfile as UserProfile)
          }
        } catch (selfHealErr) {
          console.warn('[AuthContext] Profile self-heal notice:', selfHealErr)
        }
      }

      const rawMemberships = (membershipsRes.data ?? []) as unknown as MembershipJoinResponse[]
      const formattedMemberships = rawMemberships.map(m => ({
        ...m,
        org_id: m.organization_id,
        organization: Array.isArray(m.organization) ? m.organization[0] ?? null : m.organization
      })) as ActiveMembership[]

      // Safe repair: if user owns organizations not in org_memberships, auto-link as admin
      if (ownedOrgsRes.data && ownedOrgsRes.data.length > 0) {
        for (const org of ownedOrgsRes.data) {
          if (!formattedMemberships.some(m => m.org_id === org.id)) {
            const adminMem: ActiveMembership = {
              organization_id: org.id,
              org_id: org.id,
              user_id: userId,
              role: 'admin',
              organization: org,
            }
            formattedMemberships.push(adminMem)

            // Self-heal the missing row in org_memberships
            supabase
              .from('org_memberships')
              .upsert(
                { organization_id: org.id, user_id: userId, role: 'admin' },
                { onConflict: 'organization_id,user_id' }
              )
              .then(() => {})
          }
        }
      }

      setMemberships(formattedMemberships)

      if (formattedMemberships.length > 0) {
        const savedOrgId = localStorage.getItem('voteth:auth:active_org_id')
        const found = formattedMemberships.find(m => m.org_id === savedOrgId)
        if (found) {
          setActiveMembership(found)
        } else {
          // If user has an admin membership, prioritize it as active
          const adminMem = formattedMemberships.find(m => m.role === 'admin')
          const chosen = adminMem || formattedMemberships[0] || null
          setActiveMembership(chosen)
          if (chosen) {
            localStorage.setItem('voteth:auth:active_org_id', chosen.org_id)
          }
        }
      } else {
        setActiveMembership(null)
      }
    } catch (err) {
      console.error('[AuthContext] Unexpected error fetching user data:', err)
      setProfile(null)
      setMemberships([])
      setActiveMembership(null)
    }
  }

  const refreshProfile = async () => {
    if (user) {
      await fetchUserData(user.id)
    }
  }

  const switchOrganization = (orgId: string) => {
    if (!orgId && profile?.platform_role === 'owner') {
      setActiveMembership(null)
      localStorage.removeItem('voteth:auth:active_org_id')
      return
    }
    const found = memberships.find(m => m.org_id === orgId)
    if (found) {
      setActiveMembership(found)
      localStorage.setItem('voteth:auth:active_org_id', orgId)
    }
  }

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
      localStorage.removeItem('voteth:auth:active_org_id')
      setUser(null)
      setProfile(null)
      setMemberships([])
      setActiveMembership(null)
      setSession(null)
    } catch (err) {
      console.error('[AuthContext] Error signing out:', err)
    }
  }

  // Derived role status distinguishing platform roles from organization roles
  // Never trusts editable user_metadata — only verified database table values
  const isPlatformOwner = profile?.platform_role === 'owner'

  const isOrgAdmin = Boolean(
    activeMembership?.role === 'admin' ||
    memberships.some(m => m.role === 'admin')
  )

  const isOrganizer = Boolean(
    isPlatformOwner ||
    isOrgAdmin ||
    profile?.platform_role === 'organizer'
  )

  const isVoterOnly = !isPlatformOwner && !isOrganizer

  useEffect(() => {
    let accent = 'purple'
    if (activeMembership?.organization) {
      accent = (activeMembership.organization as any).accent_theme || 'purple'
    } else if (profile?.platform_role === 'owner') {
      accent = localStorage.getItem('voteth:admin:accent_theme') || 'purple'
    }

    const root = document.documentElement
    
    // Remove other theme classes
    root.classList.remove('theme-purple', 'theme-blue', 'theme-emerald', 'theme-rose')
    // Add current theme class
    root.classList.add(`theme-${accent}`)
  }, [activeMembership, profile])

  useEffect(() => {
    let mounted = true

    const initSession = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession()
        if (mounted) {
          setSession(initialSession)
          setUser(initialSession?.user ?? null)
          if (initialSession?.user) {
            await fetchUserData(initialSession.user.id)
          }
        }
      } catch (err) {
        console.error('[AuthContext] Error initializing session:', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    initSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!mounted) return
      if (event === 'INITIAL_SESSION') return

      setSession(currentSession)

      if (currentSession?.user) {
        setLoading(true)
        setUser(currentSession.user)
        await fetchUserData(currentSession.user.id)
        setLoading(false)
      } else {
        setUser(null)
        setProfile(null)
        setMemberships([])
        setActiveMembership(null)
        localStorage.removeItem('voteth:auth:active_org_id')
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        activeMembership,
        memberships,
        session,
        loading,
        isPlatformOwner,
        isOrgAdmin,
        isOrganizer,
        isVoterOnly,
        signOut,
        refreshProfile,
        switchOrganization,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
