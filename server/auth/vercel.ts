import { applicationDefault, cert, getApps, initializeApp, type Credential } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { createFirebaseDirectory } from './firebaseDirectory.js'
import { createFirestoreAuthStore } from './firestoreStore.js'
import { createAuthHandler, fail, wantsHtml } from './handler.js'
import { policyFromEnv } from './policy.js'

// ── Production wiring (Vercel Function) ────────────────────────────────────
//
// Server-only environment variables (never VITE_-prefixed — those are
// compiled into the browser bundle):
//   AUTH_STATE_SECRET          32+ random characters; signs state and transaction tokens
//   FIREBASE_SERVICE_ACCOUNT   service-account JSON (raw or base64) for the Firebase project
//   AUTH_SESSION_IDLE_HOURS    optional, default 12
//   AUTH_SESSION_MAX_HOURS     optional, default 168
// Missing configuration fails closed: every request gets "temporarily unavailable".

function credential(): { credential: Credential; projectId?: string } {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim()
  if (raw) {
    const text = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')
    const account = JSON.parse(text) as { project_id?: string }
    return { credential: cert(account as Parameters<typeof cert>[0]), projectId: account.project_id }
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return { credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID }
  }
  throw new Error('FIREBASE_SERVICE_ACCOUNT is not set')
}

let handler: ((req: Request) => Promise<Response>) | null = null

function build(): (req: Request) => Promise<Response> {
  const secret = process.env.AUTH_STATE_SECRET ?? ''
  if (secret.length < 32) throw new Error('AUTH_STATE_SECRET is missing or shorter than 32 characters')
  const app = getApps()[0] ?? initializeApp(credential())
  const db = getFirestore(app)
  return createAuthHandler({
    store: createFirestoreAuthStore(db),
    directory: createFirebaseDirectory(getAuth(app), db),
    secret,
    policy: policyFromEnv(process.env),
  })
}

export async function handleAuthRequest(req: Request): Promise<Response> {
  if (!handler) {
    try {
      handler = build()
    } catch (err) {
      console.error('[auth] not configured:', (err as Error).message)
      return fail('unavailable', { html: wantsHtml(req) })
    }
  }
  return handler(req)
}
