import { describe, it, expect, vi, beforeEach } from 'vitest'

// The real GoogleAuthProvider; only the calls that would reach Google or the browser are faked.
const fakeAuth = vi.hoisted(() => ({
  currentUser: null as { uid: string } | null,
  restored: null as { uid: string } | null,
  authStateReady: vi.fn(),
}))
vi.mock('./config', () => ({ auth: fakeAuth }))
vi.mock('firebase/auth', async importOriginal => ({
  ...await importOriginal<typeof import('firebase/auth')>(),
  signInWithPopup: vi.fn(async () => ({ user: { uid: 'chosen-account' } })),
  signOut: vi.fn(async () => { fakeAuth.currentUser = null }),
}))

import { GoogleAuthProvider, signInWithPopup, signOut, type AuthProvider } from 'firebase/auth'
import { signInWithGoogle, signOutUser } from './auth'

beforeEach(() => {
  vi.clearAllMocks()
  fakeAuth.currentUser = null
  fakeAuth.restored = null
  // Like Firebase: the persisted sign-in is only known once auth state is ready.
  fakeAuth.authStateReady.mockImplementation(async () => { fakeAuth.currentUser = fakeAuth.restored })
})

describe('signInWithGoogle', () => {
  it('asks Google to show the account chooser on every fresh sign-in, with no login_hint', async () => {
    expect((await signInWithGoogle()).uid).toBe('chosen-account')
    await signInWithGoogle()

    expect(signInWithPopup).toHaveBeenCalledTimes(2)
    for (const [auth, provider] of vi.mocked(signInWithPopup).mock.calls) {
      expect(auth).toBe(fakeAuth)
      const google = provider as AuthProvider as GoogleAuthProvider
      expect(google).toBeInstanceOf(GoogleAuthProvider)
      expect(google.getCustomParameters()).toEqual({ prompt: 'select_account' })
      expect([...google.getScopes()].sort()).toEqual(['email', 'profile'])
    }
  })
})

describe('signOutUser', () => {
  it('waits for the persisted sign-in, then signs that user out', async () => {
    fakeAuth.restored = { uid: 'u1' }
    expect(await signOutUser('u1')).toBe(true)
    expect(fakeAuth.authStateReady.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(signOut).mock.invocationCallOrder[0])
    expect(signOut).toHaveBeenCalledWith(fakeAuth)
    expect(fakeAuth.currentUser).toBeNull()
  })

  it('leaves anyone else signed in, and does nothing when no one is', async () => {
    fakeAuth.restored = { uid: 'u2' }
    expect(await signOutUser('u1')).toBe(false)
    fakeAuth.restored = null
    expect(await signOutUser('u1')).toBe(false)
    expect(signOut).not.toHaveBeenCalled()
  })
})
