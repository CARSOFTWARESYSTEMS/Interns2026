// ── PartnerTheme: colours + document metadata from configuration ───────────
//
// Tailwind's `brand-*` palette reads CSS variables (tailwind.config.js), so
// every existing `bg-brand-600`, `text-brand-400`… recolours per Partner
// without touching a component. Defaults in index.css are the original blue.

import type { Partner } from '../types/partner'
import { brandingFor, safeUrl } from './branding'

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const
/** Original hand-tuned palette's anchor; when a Partner keeps it, the CSS defaults are used as-is. */
const DEFAULT_PRIMARY = '#2563eb'

type RGB = [number, number, number]

export function parseHex(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex ?? '').trim())
  if (!m) return null
  const h = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1]
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB
}

/** 50…900 palette with the Partner's primary colour at 600 (the app's main brand shade). */
export function paletteFor(primary: string): Record<(typeof SHADES)[number], RGB> | null {
  const base = parseHex(primary)
  if (!base) return null
  const white: RGB = [255, 255, 255]
  const black: RGB = [0, 0, 0]
  return {
    50:  mix(base, white, 0.93),
    100: mix(base, white, 0.86),
    200: mix(base, white, 0.74),
    300: mix(base, white, 0.56),
    400: mix(base, white, 0.36),
    500: mix(base, white, 0.16),
    600: base,
    700: mix(base, black, 0.14),
    800: mix(base, black, 0.28),
    900: mix(base, black, 0.42),
  }
}

function setFavicon(href: string) {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (!href) { link?.remove(); return }
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.href = href
}

function setMeta(name: string, content: string) {
  const el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (el) el.content = content
}

/** Apply (or, with null, reset) the Partner's theme and document metadata. */
export function applyPartnerTheme(partner: Partner | null): void {
  const root = document.documentElement
  const b = brandingFor(partner)

  const primary = partner?.branding?.primaryColor ?? ''
  const palette = primary && primary.toLowerCase() !== DEFAULT_PRIMARY ? paletteFor(primary) : null
  for (const shade of SHADES) {
    if (palette) root.style.setProperty(`--brand-${shade}`, palette[shade].join(' '))
    else root.style.removeProperty(`--brand-${shade}`)
  }

  document.title = partner ? `${b.title} · ${b.tagline}` : b.title
  setMeta('application-name', b.title)
  setMeta('apple-mobile-web-app-title', b.title)
  const secondary = parseHex(partner?.branding?.secondaryColor ?? '')
  setMeta('theme-color', secondary ? partner!.branding.secondaryColor : '#0f172a')
  setFavicon(safeUrl(partner?.branding?.faviconUrl))
  root.dataset.partner = partner?.id ?? ''
}
