import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { firebaseConfigFrom } from './webConfig'

// Key by key: Vite then inlines only these, not every VITE_ variable.
const firebaseConfig = firebaseConfigFrom({
  VITE_FIREBASE_API_KEY:             import.meta.env.VITE_FIREBASE_API_KEY,
  VITE_FIREBASE_AUTH_DOMAIN:         import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  VITE_FIREBASE_PROJECT_ID:          import.meta.env.VITE_FIREBASE_PROJECT_ID,
  VITE_FIREBASE_STORAGE_BUCKET:      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  VITE_FIREBASE_MESSAGING_SENDER_ID: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  VITE_FIREBASE_APP_ID:              import.meta.env.VITE_FIREBASE_APP_ID,
})

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
)

// Unconfigured (local dev without .env): initialise with inert placeholders so
// getAuth() doesn't throw at import time. The UI shows "Firebase is not
// configured" and the Partner resolver uses the bundled seed on localhost only.
const effectiveConfig = isFirebaseConfigured
  ? firebaseConfig
  : { ...firebaseConfig, apiKey: 'not-configured', projectId: 'not-configured' }

// Avoid duplicate app initialization during HMR
const app = getApps().length === 0 ? initializeApp(effectiveConfig) : getApps()[0]

export const auth = getAuth(app)
export const db   = getFirestore(app)
export const storage = getStorage(app)

export default app
