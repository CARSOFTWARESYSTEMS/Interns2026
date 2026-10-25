import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/** 256-bit (by default) cryptographically random token, base64url. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

/** SHA-256, base64url. Storage ids for session tokens and codes (high-entropy inputs, so no salt is needed). */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('base64url')
}

/** PKCE S256 code challenge for a verifier. */
export function pkceChallenge(verifier: string): string {
  return sha256(verifier)
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

function mac(secret: string, purpose: string, body: string): string {
  return createHmac('sha256', secret).update(`${purpose}.${body}`).digest('base64url')
}

/**
 * Integrity-protected (not encrypted) token: base64url(JSON) + "." + HMAC.
 * `purpose` is bound into the MAC so a token minted for one use (e.g. the
 * state) is rejected for another (e.g. the transaction cookie).
 */
export function seal(secret: string, purpose: string, payload: object): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${mac(secret, purpose, body)}`
}

/** The payload if `token` was sealed with this secret and purpose, else null. */
export function unseal<T>(secret: string, purpose: string, token: string | null | undefined): T | null {
  if (typeof token !== 'string' || token.length > 4096) return null
  const dot = token.indexOf('.')
  if (dot <= 0 || dot !== token.lastIndexOf('.')) return null
  const body = token.slice(0, dot)
  if (!safeEqual(token.slice(dot + 1), mac(secret, purpose, body))) return null
  try {
    const value: unknown = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    return value && typeof value === 'object' ? (value as T) : null
  } catch {
    return null
  }
}
