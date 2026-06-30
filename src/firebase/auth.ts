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

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider)
  return result.user
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth)
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
