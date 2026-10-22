import type { Partner } from '../types/partner'

// ── Active tenant session ──────────────────────────────────────────────────
//
// Holds the partnerId the signed-in user is CURRENTLY authorised in (set by
// AuthContext once the hostname's Partner is resolved and access is Active,
// or the user is a Platform Admin). Data services read it to:
//   • stamp `partnerId` on every record they create,
//   • add `where('partnerId', '==', …)` to every query,
//   • refuse a single-document read whose partnerId is not the active one
//     (so a record id from another Partner shows "not found", even for a
//     Platform Admin browsing a Partner's domain).
//
// This is NOT the security boundary — firestore.rules re-check membership in
// the record's partnerId on every read and write. It makes the client
// tenant-correct so it never even asks for another Partner's data.

export class TenantContextError extends Error {
  constructor() {
    super('No active Partner context')
    this.name = 'TenantContextError'
  }
}

let activePartnerId: string | null = null
/** Public profile (branding) of the hostname's Partner, for non-React modules (exports, letters). */
let activePartnerProfile: Partner | null = null

export function setActivePartnerProfile(p: Partner | null): void { activePartnerProfile = p }
export function getActivePartnerProfile(): Partner | null { return activePartnerProfile }

const listeners = new Set<(pid: string | null) => void>()

export function setActivePartnerId(pid: string | null): void {
  if (pid === activePartnerId) return
  activePartnerId = pid
  listeners.forEach(fn => fn(pid))
}

export function getActivePartnerId(): string | null {
  return activePartnerId
}

/** The active partnerId, or throws — never falls back to a default Partner. */
export function requirePartnerId(): string {
  if (!activePartnerId) throw new TenantContextError()
  return activePartnerId
}

export function onActivePartnerChange(fn: (pid: string | null) => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

/** Returns the record only if it belongs to the active Partner (tenant-safe single read). */
export function inActivePartner<T extends { partnerId?: string }>(data: T | null | undefined): T | null {
  if (!data) return null
  return data.partnerId && data.partnerId === activePartnerId ? data : null
}

/** Deterministic, Partner-qualified document id (so one person in two Partners never collides). */
export function scopedId(...parts: string[]): string {
  return [requirePartnerId(), ...parts].join('_')
}
