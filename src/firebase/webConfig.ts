// ── Firebase web configuration from VITE_FIREBASE_* variables ─────────────
//
// Pure (no Firebase, no window) so it can be unit-tested. Values are public:
// they are compiled into the browser bundle.
//
// authDomain is where Google sign-in's popup runs (/__/auth/handler) — the
// domain Google shows the user. Production moves from the project's default
// <project>.firebaseapp.com to auth.ev.engineer by changing only
// VITE_FIREBASE_AUTH_DOMAIN, once that domain serves the handler
// (docs/auth/multi-domain-sso.md, "Firebase auth domain").

export interface FirebaseWebConfig {
  apiKey: string | undefined
  authDomain: string | undefined
  projectId: string | undefined
  storageBucket: string | undefined
  messagingSenderId: string | undefined
  appId: string | undefined
}

type Env = Partial<Record<
  | 'VITE_FIREBASE_API_KEY' | 'VITE_FIREBASE_AUTH_DOMAIN' | 'VITE_FIREBASE_PROJECT_ID'
  | 'VITE_FIREBASE_STORAGE_BUCKET' | 'VITE_FIREBASE_MESSAGING_SENDER_ID' | 'VITE_FIREBASE_APP_ID',
  string | undefined
>>

const HOSTNAME = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/

/**
 * The auth domain is a bare hostname. Unset, or not a hostname (a pasted
 * `https://…/` URL), it falls back to the project's default domain, which
 * always serves the handler — a bad value must never break sign-in.
 */
export function authDomainFrom(raw: string | undefined, projectId: string | undefined): string | undefined {
  const value = raw?.trim().toLowerCase()
  if (value && HOSTNAME.test(value)) return value
  const fallback = projectId ? `${projectId}.firebaseapp.com` : undefined
  if (value) console.warn(`[firebase] VITE_FIREBASE_AUTH_DOMAIN is not a hostname; using ${fallback}`)
  return fallback
}

export function firebaseConfigFrom(env: Env): FirebaseWebConfig {
  return {
    apiKey:            env.VITE_FIREBASE_API_KEY,
    authDomain:        authDomainFrom(env.VITE_FIREBASE_AUTH_DOMAIN, env.VITE_FIREBASE_PROJECT_ID),
    projectId:         env.VITE_FIREBASE_PROJECT_ID,
    storageBucket:     env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId:             env.VITE_FIREBASE_APP_ID,
  }
}
