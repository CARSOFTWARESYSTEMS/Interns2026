import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { User } from 'firebase/auth'
import { onAuthChange, signOut as fbSignOut, getBrowserInfo } from '../firebase/auth'
import {
  getUserProfile, createUserProfile, updateUserProfile,
  writeAuditLog, writeLoginHistory,
} from '../firebase/firestore'
import {
  buildEmptyProfile, calcProfileCompletion,
  type UserProfile, type UserRole,
} from '../types/auth'

interface AuthContextType {
  // State
  firebaseUser: User | null
  userProfile: UserProfile | null
  loading: boolean

  // Derived
  isAuthenticated: boolean
  isProfileComplete: boolean
  role: UserRole | null
  uid: string | null

  // Actions
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  updateProfile: (data: Partial<UserProfile>) => Promise<void>
  setProfileAfterComplete: (p: UserProfile) => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null)
  const [userProfile, setUserProfile]   = useState<UserProfile | null>(null)
  const [loading, setLoading]           = useState(true)

  const loadProfile = useCallback(async (user: User) => {
    let profile = await getUserProfile(user.uid)
    if (!profile) {
      // First login — create skeleton profile
      profile = buildEmptyProfile(user.uid, user.displayName ?? '', user.email ?? '', user.photoURL ?? '')
      await createUserProfile(profile)
      await writeAuditLog({
        uid: user.uid, userEmail: user.email ?? '',
        action: 'login', resource: 'auth',
        details: 'First login — profile created',
        orgId: 'ev-engineer',
      })
    } else {
      // Existing user — update lastLogin
      const now = new Date().toISOString()
      await updateUserProfile(user.uid, { lastLogin: now })
      profile = { ...profile, lastLogin: now }
      await writeAuditLog({
        uid: user.uid, userEmail: user.email ?? '',
        action: 'login', resource: 'auth',
        details: 'Signed in with Google',
        orgId: profile.orgId,
      })
    }
    const { browser, device } = getBrowserInfo()
    await writeLoginHistory({
      uid: user.uid, loginAt: new Date().toISOString(),
      logoutAt: '', browser, device, success: true,
    })
    setUserProfile(profile)
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthChange(async (user) => {
      setFirebaseUser(user)
      if (user) {
        await loadProfile(user)
      } else {
        setUserProfile(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [loadProfile])

  const signOut = useCallback(async () => {
    if (userProfile) {
      await writeAuditLog({
        uid: userProfile.uid, userEmail: userProfile.email,
        action: 'logout', resource: 'auth',
        details: 'Signed out', orgId: userProfile.orgId,
      })
    }
    await fbSignOut()
    setUserProfile(null)
  }, [userProfile])

  const refreshProfile = useCallback(async () => {
    if (!firebaseUser) return
    const profile = await getUserProfile(firebaseUser.uid)
    if (profile) setUserProfile(profile)
  }, [firebaseUser])

  const updateProfile = useCallback(async (data: Partial<UserProfile>) => {
    if (!userProfile) return
    await updateUserProfile(userProfile.uid, data)
    setUserProfile(prev => prev ? { ...prev, ...data } : prev)
    await writeAuditLog({
      uid: userProfile.uid, userEmail: userProfile.email,
      action: 'profile_updated', resource: 'users/' + userProfile.uid,
      details: `Updated fields: ${Object.keys(data).join(', ')}`,
      orgId: userProfile.orgId,
    })
  }, [userProfile])

  const setProfileAfterComplete = useCallback((p: UserProfile) => {
    setUserProfile(p)
  }, [])

  const isProfileComplete = Boolean(userProfile?.profileComplete)

  return (
    <AuthContext.Provider value={{
      firebaseUser,
      userProfile,
      loading,
      isAuthenticated: Boolean(firebaseUser),
      isProfileComplete,
      role: userProfile?.role ?? null,
      uid: firebaseUser?.uid ?? null,
      signOut,
      refreshProfile,
      updateProfile,
      setProfileAfterComplete,
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
