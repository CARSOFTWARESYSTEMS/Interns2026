import type { User } from 'firebase/auth'
import { providerForLoginHost } from './providers'

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
