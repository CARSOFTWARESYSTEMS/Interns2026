// ── Hostname → Partner lookup key ──────────────────────────────────────────
//
// Pure functions (no Firebase, no window) so they can be unit-tested.
//
// Security model:
//   • The browser's own `window.location.hostname` is the input. In a browser
//     this cannot be spoofed by page script; it is what the user navigated to.
//   • The returned hostname is only a LOOKUP KEY into partnerDomains/{hostname}.
//     It never grants anything by itself: Firestore rules authorize every read
//     and write against the user's membership in the record's partnerId.
//   • Unknown hosts resolve to `{ kind: 'unknown' }` — the caller must render a
//     closed "unknown domain" state, never fall back to a real Partner.
//   • Dev overrides (env / ?partnerHost=) are honoured ONLY when the actual
//     hostname is a loopback/localhost name. On any real domain they are
//     ignored, so changing a query string or storage cannot switch tenants.

const MAX_HOSTNAME_LENGTH = 253
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

/**
 * Lowercases, trims, strips a port and a trailing dot, and validates the
 * result as a DNS hostname (or loopback IP). Returns null for anything that
 * is not a well-formed hostname — callers must treat null as "unknown".
 */
export function normalizeHostname(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null
  let h = raw.trim().toLowerCase()
  if (!h) return null

  // IPv6 loopback in URL form: "[::1]" or "[::1]:5173"
  if (h.startsWith('[')) {
    const end = h.indexOf(']')
    if (end === -1) return null
    const inner = h.slice(1, end)
    return inner === '::1' ? '[::1]' : null
  }
  if (h === '::1') return '[::1]'

  // Strip port
  const colon = h.indexOf(':')
  if (colon !== -1) {
    const port = h.slice(colon + 1)
    if (!/^\d{1,5}$/.test(port)) return null
    h = h.slice(0, colon)
  }

  // Strip a single trailing dot (FQDN form)
  if (h.endsWith('.')) h = h.slice(0, -1)

  if (!h || h.length > MAX_HOSTNAME_LENGTH) return null
  const labels = h.split('.')
  if (!labels.every(l => LABEL.test(l))) return null
  return h
}

export function isLocalDevHost(normalized: string | null): boolean {
  if (!normalized) return false
  return (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized === '127.0.0.1' ||
    normalized === '[::1]'
  )
}

export type HostResolution =
  | { kind: 'lookup'; hostname: string; source: 'host' | 'dev-override' }
  | { kind: 'unknown'; reason: 'invalid-hostname' | 'dev-host-without-override' }

export interface ResolveHostInput {
  /** window.location.host or hostname */
  actualHost: string | null | undefined
  /** Candidate override hostnames, in priority order (query param, session, env). Ignored off-localhost. */
  devOverrides?: Array<string | null | undefined>
}

/**
 * Decide which partnerDomains/{hostname} key to look up.
 * Fail-closed: anything unexpected returns `unknown`.
 */
export function resolveLookupHost({ actualHost, devOverrides = [] }: ResolveHostInput): HostResolution {
  const actual = normalizeHostname(actualHost)
  if (!actual) return { kind: 'unknown', reason: 'invalid-hostname' }

  if (isLocalDevHost(actual)) {
    for (const candidate of devOverrides) {
      const o = normalizeHostname(candidate)
      // An override must itself be a real hostname, not another loopback name.
      if (o && !isLocalDevHost(o)) return { kind: 'lookup', hostname: o, source: 'dev-override' }
    }
    return { kind: 'unknown', reason: 'dev-host-without-override' }
  }

  return { kind: 'lookup', hostname: actual, source: 'host' }
}

/**
 * Firestore document ids cannot contain "/" — normalizeHostname already
 * guarantees [a-z0-9.-] only, so the hostname is safe to use as a doc id.
 */
export function domainDocId(normalizedHostname: string): string {
  return normalizedHostname
}
