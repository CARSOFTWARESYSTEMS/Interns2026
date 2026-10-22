// ── Partner branding (configuration-driven, never per-Partner components) ──
//
// One place turns a Partner record into every string, link and colour the UI
// shows. Screens call useBranding(); non-React modules (exports, emails,
// letters) call brandingFor(getActivePartnerProfile()).

import type { Partner } from '../types/partner'

export interface Branding {
  /** Partner display name, e.g. "GAMYAA™ AeroSystems". */
  name: string
  shortName: string
  legalName: string
  title: string
  subtitle: string
  tagline: string
  /** Company line shown in footers. */
  footer: string
  /** "City, Country" ('' when unknown). */
  location: string
  versionLabel: string
  login: { title: string; subtitle: string; restrictedNotice: string }
  contact: {
    email: string
    phone: string
    /** tel: href ('' when no phone). */
    phoneHref: string
    whatsappUrl: string
    websiteUrl: string
    supportUrl: string
  }
  logoUrl: string
  logoDarkUrl: string
  faviconUrl: string
  documentPrefix: string
}

const NEUTRAL: Branding = {
  name: 'Engineering Command Center',
  shortName: '',
  legalName: '',
  title: 'Engineering Command Center',
  subtitle: '',
  tagline: 'Engineering Command Center',
  footer: '',
  location: '',
  versionLabel: '',
  login: { title: 'Engineering Command Center', subtitle: '', restrictedNotice: '' },
  contact: { email: '', phone: '', phoneHref: '', whatsappUrl: '', websiteUrl: '', supportUrl: '' },
  logoUrl: '', logoDarkUrl: '', faviconUrl: '',
  documentPrefix: 'DOC',
}

/**
 * Only https: URLs (or same-origin absolute paths) are used for links and
 * images that come from Partner configuration — never javascript:, data: etc.
 */
export function safeUrl(raw: string | undefined | null): string {
  const v = (raw ?? '').trim()
  if (!v) return ''
  if (v.startsWith('/') && !v.startsWith('//')) return v
  try {
    const u = new URL(v)
    return u.protocol === 'https:' ? u.toString() : ''
  } catch {
    return ''
  }
}

export function safeEmail(raw: string | undefined | null): string {
  const v = (raw ?? '').trim()
  return /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(v) ? v : ''
}

function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '')
  return digits.length >= 6 ? `tel:${digits}` : ''
}

export function brandingFor(p: Partner | null | undefined): Branding {
  if (!p) return NEUTRAL
  const location = [p.city, p.country].filter(Boolean).join(', ')
  const phone = p.contact?.supportPhone ?? ''
  return {
    name: p.displayName || NEUTRAL.name,
    shortName: p.shortName || p.displayName,
    legalName: p.legalName || p.displayName,
    title: p.platform?.title || p.displayName,
    subtitle: p.platform?.subtitle ?? '',
    tagline: p.platform?.tagline || NEUTRAL.tagline,
    footer: p.platform?.footer || p.legalName || '',
    location,
    versionLabel: p.platform?.versionLabel ?? '',
    login: {
      title: p.login?.title || p.displayName,
      subtitle: p.login?.subtitle ?? '',
      restrictedNotice: p.login?.restrictedNotice || `Access is restricted to authorized ${p.displayName} team members.`,
    },
    contact: {
      email: safeEmail(p.contact?.supportEmail),
      phone,
      phoneHref: telHref(phone),
      whatsappUrl: safeUrl(p.contact?.whatsappUrl),
      websiteUrl: safeUrl(p.contact?.websiteUrl),
      supportUrl: safeUrl(p.contact?.supportUrl),
    },
    logoUrl: safeUrl(p.branding?.logoUrl),
    logoDarkUrl: safeUrl(p.branding?.logoDarkUrl),
    faviconUrl: safeUrl(p.branding?.faviconUrl),
    documentPrefix: (p.documentPrefix || p.shortName || 'DOC').toUpperCase().replace(/[^A-Z0-9-]/g, '') || 'DOC',
  }
}

/** Escape for interpolation into generated HTML (exports, email previews). */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
