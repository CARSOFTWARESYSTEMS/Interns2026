// The /sso page shows which site the user is signing in to. It reads that
// from the state the server signed — WITHOUT checking the signature, which
// only the server can do. Display only: the page also checks the host
// against AUTH_PROVIDERS, and /api/auth/authorize verifies everything again.

export interface LoginStatePreview {
  host: string
  path: string
}

export function peekLoginState(token: string | null | undefined): LoginStatePreview | null {
  if (typeof token !== 'string') return null
  const body = token.split('.')[0]
  if (!body) return null
  try {
    const bytes = Uint8Array.from(atob(body.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
    const value = JSON.parse(new TextDecoder().decode(bytes)) as { h?: unknown; p?: unknown }
    return typeof value.h === 'string' && typeof value.p === 'string' ? { host: value.h, path: value.p } : null
  } catch {
    return null
  }
}
