import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Partner } from '../types/partner'
import { resolveLookupHost, isLocalDevHost, normalizeHostname } from '../tenant/hostname'
import { getPartnerDomain, getPartner } from '../firebase/partners'
import { isFirebaseConfigured } from '../firebase/config'
import seed from '../tenant/partners.seed.json'
import { applyPartnerTheme } from '../tenant/theme'
import { brandingFor, type Branding } from '../tenant/branding'
import { setActivePartnerProfile } from '../tenant/session'

// ── Types ───────────────────────────────────────────────────────────────────

export type PartnerResolutionStatus =
  | 'loading'
  | 'ready'
  | 'unknown-domain'   // hostname not mapped (or invalid) → fail closed
  | 'inactive'         // Partner or domain deactivated
  | 'error'            // could not reach Firestore → fail closed

interface PartnerContextValue {
  status: PartnerResolutionStatus
  /** Resolved Partner — non-null only when status === 'ready'. */
  partner: Partner | null
  /** Convenience: partner?.id ?? null. The ONLY value to use for tenant checks. */
  partnerId: string | null
  /** Hostname used for the lookup (after dev override on localhost). */
  lookupHost: string | null
  /** True when a localhost dev override chose the Partner. */
  isDevOverride: boolean
}

const PartnerContext = createContext<PartnerContextValue | null>(null)

const DEV_OVERRIDE_SESSION_KEY = 'dev_partner_host'

// ── Dev fallback (localhost + Firebase not configured only) ────────────────

function seedPartnerForHost(hostname: string): Partner | null {
  const domain = seed.domains.find(d => d.hostname === hostname && d.status === 'Active')
  if (!domain) return null
  const p = seed.partners.find(x => x.id === domain.partnerId)
  if (!p) return null
  const now = new Date(0).toISOString()
  return { ...(p as Omit<Partner, 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>),
    status: p.status as Partner['status'],
    createdAt: now, updatedAt: now, createdBy: 'seed', updatedBy: 'seed' }
}

// ── Resolution ──────────────────────────────────────────────────────────────

async function resolvePartner(): Promise<Omit<PartnerContextValue, 'partnerId'>> {
  const actual = normalizeHostname(window.location.host)
  const onLocalhost = isLocalDevHost(actual)

  // Dev overrides are read ONLY on loopback hosts. On a real domain these
  // sources are never consulted, so query/storage tampering is inert.
  const overrides: Array<string | null> = []
  if (onLocalhost) {
    const fromQuery = new URLSearchParams(window.location.search).get('partnerHost')
    if (fromQuery) {
      try { sessionStorage.setItem(DEV_OVERRIDE_SESSION_KEY, fromQuery) } catch { /* ignore */ }
    }
    let fromSession: string | null = null
    try { fromSession = sessionStorage.getItem(DEV_OVERRIDE_SESSION_KEY) } catch { /* ignore */ }
    overrides.push(fromQuery, fromSession, import.meta.env.VITE_DEV_PARTNER_HOST ?? null)
  }

  const res = resolveLookupHost({ actualHost: window.location.host, devOverrides: overrides })
  if (res.kind === 'unknown') {
    return { status: 'unknown-domain', partner: null, lookupHost: actual, isDevOverride: false }
  }
  const isDevOverride = res.source === 'dev-override'

  if (!isFirebaseConfigured) {
    // Only localhost may run without Firebase, using the bundled seed.
    if (!onLocalhost) return { status: 'error', partner: null, lookupHost: res.hostname, isDevOverride }
    const p = seedPartnerForHost(res.hostname)
    return p
      ? { status: 'ready', partner: p, lookupHost: res.hostname, isDevOverride }
      : { status: 'unknown-domain', partner: null, lookupHost: res.hostname, isDevOverride }
  }

  try {
    const domain = await getPartnerDomain(res.hostname)
    if (!domain) return { status: 'unknown-domain', partner: null, lookupHost: res.hostname, isDevOverride }
    if (domain.status !== 'Active') return { status: 'inactive', partner: null, lookupHost: res.hostname, isDevOverride }

    const partner = await getPartner(domain.partnerId)
    if (!partner) return { status: 'unknown-domain', partner: null, lookupHost: res.hostname, isDevOverride }
    if (partner.status !== 'Active') return { status: 'inactive', partner: null, lookupHost: res.hostname, isDevOverride }

    return { status: 'ready', partner, lookupHost: res.hostname, isDevOverride }
  } catch (e) {
    console.warn('[partner] resolution failed', { host: res.hostname, error: (e as Error).message })
    return { status: 'error', partner: null, lookupHost: res.hostname, isDevOverride }
  }
}

// ── Provider ────────────────────────────────────────────────────────────────

export function PartnerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<PartnerContextValue, 'partnerId'>>({
    status: 'loading', partner: null, lookupHost: null, isDevOverride: false,
  })

  useEffect(() => {
    let cancelled = false
    resolvePartner().then(r => { if (!cancelled) setState(r) })
    return () => { cancelled = true }
  }, [])

  // PartnerTheme: colours, title, favicon. Public profile for non-React modules.
  useEffect(() => {
    const p = state.status === 'ready' ? state.partner : null
    applyPartnerTheme(p)
    setActivePartnerProfile(p)
  }, [state.status, state.partner])

  return (
    <PartnerContext.Provider value={{ ...state, partnerId: state.partner?.id ?? null }}>
      {children}
    </PartnerContext.Provider>
  )
}

export function usePartner(): PartnerContextValue {
  const ctx = useContext(PartnerContext)
  if (!ctx) throw new Error('usePartner must be used inside PartnerProvider')
  return ctx
}

/** Configuration-driven branding for the hostname's Partner (neutral when unresolved). */
export function useBranding(): Branding {
  const { partner } = usePartner()
  return brandingFor(partner)
}

/** Clear a localhost dev override (no-op elsewhere). */
export function clearDevPartnerOverride(): void {
  try { sessionStorage.removeItem(DEV_OVERRIDE_SESSION_KEY) } catch { /* ignore */ }
}
