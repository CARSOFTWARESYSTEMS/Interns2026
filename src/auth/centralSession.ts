import type { User } from 'firebase/auth'
import { isAllowedAppHost, providerForLoginHost } from './providers'

// ── Central (single sign-on) session, browser side ─────────────────────────
//
// On a login host, a fresh Firebase sign-in is exchanged once for a central
// session: POST /api/auth/session verifies the ID token server-side and sets
// an HttpOnly cookie. Page script never sees that cookie, and nothing here is
// stored in localStorage or sessionStorage.

export class CentralSessionError extends Error {
  constructor(readonly code: string) {
    super(code)
    this.name = 'CentralSessionError'
  }
}

/** True on the login hosts — the only hosts that serve /api/auth. */
export function isLoginHost(hostname: string = window.location.hostname): boolean {
  return providerForLoginHost(hostname) !== null
}

/**
 * `workspace`: the dashboard's own sign-in, recorded as the user's workspace
 * access. `sso`: the /sso page, part of an application sign-in that is
 * recorded when it completes.
 */
export async function startCentralSession(user: User, purpose: 'workspace' | 'sso'): Promise<void> {
  const idToken = await user.getIdToken()
  let res: Response
  try {
    res = await fetch('/api/auth/session', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, purpose }),
    })
  } catch {
    throw new CentralSessionError('network')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: unknown } | null
    throw new CentralSessionError(typeof body?.error === 'string' ? body.error : 'unavailable')
  }
}

/** Bounded, so a slow network can never hold up signing out of the dashboard. */
export async function endCentralSession(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', signal: AbortSignal.timeout(3000) })
}

/**
 * /signout: finishes an application's logout on this login host. The server
 * checks the ticket, ends this browser's central session if it is the
 * logged-out user's and clears its cookie; then that user's Firebase sign-in
 * here ends too, so nothing on the login host can sign them back in. Resolves
 * with the application page to return to, only once both are done.
 */
export async function finishSignOut(
  ticket: string,
  signOutFirebaseUser: (uid: string) => Promise<unknown>,
  loginHost: string = window.location.hostname,
): Promise<string> {
  let res: Response
  try {
    res = await fetch('/api/auth/end-session', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw new CentralSessionError('network')
  }
  const body = await res.json().catch(() => null) as { uid?: unknown; returnTo?: unknown; error?: unknown } | null
  if (!res.ok || typeof body?.returnTo !== 'string') {
    throw new CentralSessionError(typeof body?.error === 'string' ? body.error : 'unavailable')
  }
  // The server built it from the signed ticket; still, only ever leave for one of this login host's sites.
  const provider = providerForLoginHost(loginHost)
  let target: URL | null = null
  try { target = new URL(body.returnTo) } catch { /* refused below */ }
  if (!provider || target?.protocol !== 'https:' || !isAllowedAppHost(provider, target.hostname)) {
    throw new CentralSessionError('invalid_logout')
  }
  if (typeof body.uid === 'string') await signOutFirebaseUser(body.uid)
  return target.href
}
