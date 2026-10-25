// ── Login domains → application hosts (single source of truth) ─────────────
//
// Every login host signs users in for a fixed set of application hosts.
// Nothing else in the codebase may hard-code these mappings: the auth server
// (server/auth), the /sso page and the tests all read them from here.
//
// Shared by the browser bundle and the Vercel function, so: pure, no
// Firebase, no window, and relative imports carry a .js extension (Node ESM).
//
// Security boundaries: each host below gets its OWN host-only session cookie.
// No cookie is ever shared between hosts, even within one provider —
// ev.engineer, autonomous.ev.engineer and aerospace.ev.engineer each hold a
// separate session. What a provider shares is the central session on its
// login host, which lets a second app sign in without asking again.

import { normalizeHostname } from '../tenant/hostname.js'

export type AuthProviderId = 'itelematics' | 'ev_engineer' | 'gamyaa' | 'uflight'

export interface AuthProvider {
  id: AuthProviderId
  /** Partner whose memberships carry this provider's roles (partnerMemberships/{partnerId}_{uid}). */
  partnerId: string
  loginHost: string
  /** Application hosts this login host may sign users in to. Exact hostnames, no wildcards. */
  allowedHosts: readonly string[]
}

export const AUTH_PROVIDERS: Readonly<Record<AuthProviderId, AuthProvider>> = {
  itelematics: {
    id: 'itelematics',
    partnerId: 'itelematics',
    loginHost: 'login.itelematics.com',
    allowedHosts: ['itelematics.com', 'www.itelematics.com'],
  },
  ev_engineer: {
    id: 'ev_engineer',
    partnerId: 'ev-engineer',
    loginHost: 'login.autonomous.ev.engineer',
    // aerospace.ishavasyam.org serves Space, built and hosted on EV.ENGINEER, so it signs in here.
    allowedHosts: ['ev.engineer', 'www.ev.engineer', 'autonomous.ev.engineer', 'aerospace.ev.engineer', 'aerospace.ishavasyam.org'],
  },
  gamyaa: {
    id: 'gamyaa',
    partnerId: 'gamyaa',
    loginHost: 'login.gamyaa.in',
    allowedHosts: ['gamyaa.in', 'www.gamyaa.in', 'aerospace.gamyaa.in', 'aerosystems.gamyaa.in'],
  },
  uflight: {
    id: 'uflight',
    partnerId: 'uflight',
    loginHost: 'login.uflight.in',
    allowedHosts: ['uflight.in', 'www.uflight.in', 'cybersecurity.uflight.in'],
  },
}

export const AUTH_PROVIDER_LIST: readonly AuthProvider[] = Object.values(AUTH_PROVIDERS)

/** The provider whose login host this is, or null. */
export function providerForLoginHost(host: string | null | undefined): AuthProvider | null {
  const h = normalizeHostname(host)
  return (h && AUTH_PROVIDER_LIST.find(p => p.loginHost === h)) || null
}

/** The provider that signs users in to this application host, or null. */
export function providerForAppHost(host: string | null | undefined): AuthProvider | null {
  const h = normalizeHostname(host)
  return (h && AUTH_PROVIDER_LIST.find(p => p.allowedHosts.includes(h))) || null
}

/** True only if `host` is one of this provider's application hosts (exact match after normalising). */
export function isAllowedAppHost(provider: AuthProvider, host: string | null | undefined): boolean {
  const h = normalizeHostname(host)
  return h !== null && provider.allowedHosts.includes(h)
}
