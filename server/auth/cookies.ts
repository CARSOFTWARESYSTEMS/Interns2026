// ── Cookies ────────────────────────────────────────────────────────────────
//
// Every auth cookie is host-only: the __Host- prefix makes the browser refuse
// it unless it is Secure, Path=/ and has NO Domain attribute, so a sibling
// subdomain can neither read nor plant it. HttpOnly keeps it from page
// script; SameSite=Lax still sends it on the top-level redirects of the
// sign-in flow but not on cross-site POSTs.

export const COOKIE = {
  /** Login host: central session (SSO). */
  central: '__Host-i26_central',
  /** Application host: that host's own session. */
  session: '__Host-i26_session',
  /** Application host: one sign-in in progress (nonce + PKCE verifier). */
  txn: '__Host-i26_txn',
} as const

export type CookieName = (typeof COOKIE)[keyof typeof COOKIE]

export function readCookie(req: Request, name: CookieName): string | null {
  const header = req.headers.get('cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq !== -1 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim() || null
  }
  return null
}

export function setCookie(name: CookieName, value: string, maxAgeMs: number): string {
  return `${name}=${value}; Max-Age=${Math.max(0, Math.floor(maxAgeMs / 1000))}; Path=/; HttpOnly; Secure; SameSite=Lax`
}

export function clearCookie(name: CookieName): string {
  return `${name}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`
}
