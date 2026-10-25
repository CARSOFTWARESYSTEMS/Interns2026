import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import type { User } from 'firebase/auth'
import { onAuthChange, signOut as fbSignOut, getBrowserInfo } from '../firebase/auth'
import {
  getUserProfile, createUserProfile, updateUserProfile,
  writeAuditLog, writeLoginHistory,
} from '../firebase/firestore'
import { getMembership, hasPlatformAdminGrant, getPartner } from '../firebase/partners'
import {
  buildEmptyProfile, SUPER_ADMIN_EMAILS,
  type UserProfile, type UserRole,
} from '../types/auth'
import type { Partner, PartnerMembership } from '../types/partner'
import { accessStateFor, effectiveRole, type AccessState, type Principal } from '../tenant/authorize'
import { usePartner } from './PartnerContext'
import { setActivePartnerId } from '../tenant/session'
import { endCentralSession, isLoginHost } from '../auth/centralSession'

// Fields a user may never write on their own global profile (also enforced by rules).
const PRIVILEGED_PROFILE_FIELDS = ['role', 'status', 'orgId', 'managerId', 'architectId', 'uid', 'email', 'createdAt'] as const

interface AuthContextType {
  // State
  firebaseUser: User | null
  userProfile: UserProfile | null
  /** Membership in the Partner resolved from the hostname (any status), or null. */
  membership: PartnerMembership | null
  isPlatformAdmin: boolean
  /**
   * The Partner whose DATA is in view: the hostname's Partner, or — for a
   * Platform Admin only — the Partner chosen in the switcher.
   */
  activePartner: Partner | null
  activePartnerId: string | null
  /** True when a Platform Admin is viewing a Partner other than the hostname's. */
  isViewingOtherPartner: boolean
  loading: boolean
  /** Non-null if loading the profile/membership failed — UI must fail closed. */
  authError: string | null

  // Derived
  isAuthenticated: boolean
  isProfileComplete: boolean
  /** Access to the active Partner. Only 'active' and 'platform-admin' may see Partner data. */
  accessState: AccessState | null
  /**
   * Effective role in the ACTIVE Partner ('Platform Admin' for platform admins).
   * null when the user has no active membership. Derived from
   * partnerMemberships — never from users/{uid}.role.
   */
  role: UserRole | null
  uid: string | null
  principal: Principal | null

  // Actions
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  refreshMembership: () => Promise<void>
  updateProfile: (data: Partial<UserProfile>) => Promise<void>
  setProfileAfterComplete: (p: UserProfile) => void
  setMembership: (m: PartnerMembership | null) => void
  /** Platform Admin only; null returns to the hostname's Partner. Ignored for everyone else. */
  setViewingPartner: (p: Partner | null) => void
}

const AuthContext = createContext<AuthContextType | null>(null)

// Per-tab (sessionStorage): a Platform Admin's switcher choice. Only ever read
// for a verified Platform Admin; for anyone else it is ignored, and rules
// would deny the data regardless.
const VIEWING_KEY = 'pa_viewing_partner'

function isSuperAdminEmail(email: string): boolean {
  return SUPER_ADMIN_EMAILS.has(email.trim().toLowerCase())
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { partnerId, partner: hostPartner, status: partnerStatus } = usePartner()

  const [firebaseUser, setFirebaseUser]   = useState<User | null>(null)
  const [authResolved, setAuthResolved]   = useState(false)
  const [userProfile, setUserProfile]     = useState<UserProfile | null>(null)
  const [membership, setMembership]       = useState<PartnerMembership | null>(null)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [sessionLoading, setSessionLoading]   = useState(false)
  const [authError, setAuthError]         = useState<string | null>(null)
  const [viewingPartner, setViewingPartnerState] = useState<Partner | null>(null)

  // ── Firebase auth state ──────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthChange(user => {
      setFirebaseUser(user)
      setAuthResolved(true)
    })
    return unsubscribe
  }, [])

  // ── Global profile + tenant context for (user, partner) ─────────────────
  // Re-runs whenever the user OR the active Partner changes, and clears all
  // tenant state first so nothing from a previous Partner context survives.
  useEffect(() => {
    let cancelled = false
    setMembership(null)
    setIsPlatformAdmin(false)
    setAuthError(null)
    setViewingPartnerState(null)

    if (!firebaseUser) { setUserProfile(null); setSessionLoading(false); return }
    if (partnerStatus === 'loading') { setSessionLoading(true); return }

    const user = firebaseUser
    setSessionLoading(true)

    ;(async () => {
      const email = (user.email ?? '').toLowerCase()
      const now = new Date().toISOString()

      // 1. Global identity — one users/{uid} per auth identity, never per Partner.
      let profile = await getUserProfile(user.uid)
      const firstLogin = !profile
      if (!profile) {
        profile = buildEmptyProfile(user.uid, user.displayName ?? '', email, user.photoURL ?? '')
        await createUserProfile(profile)
      } else {
        await updateUserProfile(user.uid, { lastLogin: now })
        profile = { ...profile, lastLogin: now }
      }

      // 2. Platform Admin (global).
      const platformAdmin = isSuperAdminEmail(email) || await hasPlatformAdminGrant(user.uid)

      // 3. Membership in the Partner resolved from the hostname.
      const m = partnerStatus === 'ready' && partnerId ? await getMembership(partnerId, user.uid) : null

      if (cancelled) return

      // Super admins skip the profile wizard (preserves previous behaviour).
      if (isSuperAdminEmail(email) && !profile.profileCompleted) {
        const completed = { profileComplete: true, profileCompleted: true, profileCompletedAt: now }
        await updateUserProfile(user.uid, completed)
        profile = { ...profile, ...completed }
      }

      // Restore a Platform Admin's switcher choice for this tab.
      let viewing: Partner | null = null
      if (platformAdmin) {
        let stored: string | null = null
        try { stored = sessionStorage.getItem(VIEWING_KEY) } catch { /* ignore */ }
        if (stored && stored !== partnerId) viewing = await getPartner(stored).catch(() => null)
      } else {
        try { sessionStorage.removeItem(VIEWING_KEY) } catch { /* ignore */ }
      }
      if (cancelled) return

      setUserProfile(profile)
      setIsPlatformAdmin(platformAdmin)
      setMembership(m)
      setViewingPartnerState(viewing)

      // 4. Audit + login history. partnerId is attached only where the rules
      //    accept it (caller has a membership doc there, or is Platform Admin).
      const auditPartner = partnerId && (m || platformAdmin) ? partnerId : ''
      await writeAuditLog({
        uid: user.uid, userEmail: email,
        action: 'login', resource: 'auth',
        details: firstLogin ? 'First login — profile created' : 'Signed in with Google',
        partnerId: auditPartner,
        host: window.location.hostname,
      }).catch(() => { /* audit must not block sign-in */ })
      const { browser, device } = getBrowserInfo()
      await writeLoginHistory({
        uid: user.uid, loginAt: now, logoutAt: '', browser, device, success: true,
      }).catch(() => {})
    })()
      .catch(e => {
        if (cancelled) return
        console.warn('[auth] session load failed', { partnerId, error: (e as Error).message })
        setAuthError((e as Error).message)
        setUserProfile(null)
        setMembership(null)
        setIsPlatformAdmin(false)
      })
      .finally(() => { if (!cancelled) setSessionLoading(false) })

    return () => { cancelled = true }
  }, [firebaseUser, partnerId, partnerStatus])

  // ── Actions ──────────────────────────────────────────────────────────────

  const signOut = useCallback(async () => {
    if (userProfile) {
      await writeAuditLog({
        uid: userProfile.uid, userEmail: userProfile.email,
        action: 'logout', resource: 'auth',
        details: 'Signed out',
        partnerId: partnerId && (membership || isPlatformAdmin) ? partnerId : '',
        host: window.location.hostname,
      }).catch(() => {})
    }
    // End single sign-on for this login host's applications too (their own sessions stay).
    if (isLoginHost()) await endCentralSession().catch(() => {})
    await fbSignOut()
    setUserProfile(null)
    setMembership(null)
    setIsPlatformAdmin(false)
  }, [userProfile, partnerId, membership, isPlatformAdmin])

  const refreshProfile = useCallback(async () => {
    if (!firebaseUser) return
    const profile = await getUserProfile(firebaseUser.uid)
    if (profile) setUserProfile(profile)
  }, [firebaseUser])

  const refreshMembership = useCallback(async () => {
    if (!firebaseUser || !partnerId) return
    setMembership(await getMembership(partnerId, firebaseUser.uid))
  }, [firebaseUser, partnerId])

  const updateProfile = useCallback(async (data: Partial<UserProfile>) => {
    if (!userProfile) return
    const safe = { ...data } as Record<string, unknown>
    PRIVILEGED_PROFILE_FIELDS.forEach(k => { delete safe[k] })
    await updateUserProfile(userProfile.uid, safe as Partial<UserProfile>)
    setUserProfile(prev => prev ? { ...prev, ...safe } : prev)
    await writeAuditLog({
      uid: userProfile.uid, userEmail: userProfile.email,
      action: 'profile_updated', resource: 'users/' + userProfile.uid,
      details: `Updated fields: ${Object.keys(safe).join(', ')}`,
      partnerId: partnerId && (membership || isPlatformAdmin) ? partnerId : '',
      host: window.location.hostname,
    }).catch(() => {})
  }, [userProfile, partnerId, membership, isPlatformAdmin])

  const setViewingPartner = useCallback((p: Partner | null) => {
    if (!isPlatformAdmin) return
    const next = p && p.id !== partnerId ? p : null
    try {
      if (next) sessionStorage.setItem(VIEWING_KEY, next.id)
      else sessionStorage.removeItem(VIEWING_KEY)
    } catch { /* ignore */ }
    setViewingPartnerState(next)
  }, [isPlatformAdmin, partnerId])

  const setProfileAfterComplete = useCallback((p: UserProfile) => {
    setUserProfile(p)
  }, [])

  // ── Derived ──────────────────────────────────────────────────────────────

  const principal = useMemo<Principal | null>(() => {
    if (!firebaseUser || !userProfile) return null
    return {
      uid: firebaseUser.uid,
      isPlatformAdmin,
      memberships: membership ? { [membership.partnerId]: { role: membership.role, status: membership.status } } : {},
    }
  }, [firebaseUser, userProfile, isPlatformAdmin, membership])

  const accessState = principal && partnerId ? accessStateFor(principal, partnerId) : null
  const role = principal && partnerId ? effectiveRole(principal, partnerId) : null

  // Publish the tenant session for data services. Done during render (not in
  // an effect) because child effects run BEFORE parent effects: a page's first
  // data load must already see the active Partner. Idempotent assignment.
  const activePartner = isPlatformAdmin && viewingPartner ? viewingPartner : hostPartner
  const activePartnerId = activePartner?.id ?? null
  setActivePartnerId(
    !sessionLoading && (accessState === 'active' || accessState === 'platform-admin') ? activePartnerId : null,
  )

  const isProfileComplete =
    userProfile?.profileCompleted === true ||
    userProfile?.profileComplete === true

  // Also "loading" in the gap between a sign-in and the session effect running,
  // so guards never act on a half-loaded (user without profile) state.
  const loading =
    !authResolved || partnerStatus === 'loading' || sessionLoading ||
    (Boolean(firebaseUser) && !userProfile && !authError)

  return (
    <AuthContext.Provider value={{
      firebaseUser,
      userProfile,
      membership,
      isPlatformAdmin,
      activePartner,
      activePartnerId,
      isViewingOtherPartner: Boolean(isPlatformAdmin && viewingPartner),
      loading,
      authError,
      isAuthenticated: Boolean(firebaseUser),
      isProfileComplete,
      accessState,
      role,
      uid: firebaseUser?.uid ?? null,
      principal,
      signOut,
      refreshProfile,
      refreshMembership,
      updateProfile,
      setProfileAfterComplete,
      setMembership,
      setViewingPartner,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used inside AuthProvider')
  return ctx
}
