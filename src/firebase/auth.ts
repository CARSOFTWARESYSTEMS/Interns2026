import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { auth } from './config'

const googleProvider = new GoogleAuthProvider()
googleProvider.addScope('email')
googleProvider.addScope('profile')
// Google is only reached for a fresh sign-in (a valid central session is reused
// by /api/auth/authorize without coming here), so always offer the account
// chooser: after a logout the user can pick a different account. No login_hint.
googleProvider.setCustomParameters({ prompt: 'select_account' })

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider)
  return result.user
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth)
}

/**
 * Signs `uid` out of Firebase on this origin once the persisted sign-in has
 * loaded; anyone else signed in here stays signed in. True if it signed out.
 */
export async function signOutUser(uid: string): Promise<boolean> {
  await auth.authStateReady()
  if (auth.currentUser?.uid !== uid) return false
  await firebaseSignOut(auth)
  return true
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback)
}

export function getBrowserInfo(): { browser: string; device: string } {
  const ua = navigator.userAgent
  const browser =
    /Chrome/.test(ua) ? 'Chrome' :
    /Firefox/.test(ua) ? 'Firefox' :
    /Safari/.test(ua) ? 'Safari' :
    /Edge/.test(ua) ? 'Edge' : 'Unknown'
  const device =
    /Mobile/.test(ua) ? 'Mobile' :
    /Tablet/.test(ua) ? 'Tablet' : 'Desktop'
  return { browser, device }
}
