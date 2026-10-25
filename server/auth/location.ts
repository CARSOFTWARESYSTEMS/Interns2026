import type { CoarseLocation, LocationSource } from '../../src/types/activation.js'

// ── Coarse location for activation records ─────────────────────────────────
//
// Priority: what the user entered on their profile, else the approximate
// location Vercel derives from the request's IP address. Precision stops at
// country, state/region, city and time zone: x-vercel-ip-latitude,
// -longitude and -postal-code are never read, and the IP address itself is
// not stored on the record. No browser geolocation is ever requested.
//
// Read on requests the browser sends straight to the login host
// (/api/auth/authorize, POST /api/auth/session). Requests that reach the
// login host through an application site's rewrite carry the site's proxy
// address, not the visitor's, so their geo headers are not used.

export interface ProfileLocation {
  country?: unknown
  stateOrRegion?: unknown
  city?: unknown
}

export interface ResolvedLocation {
  location: CoarseLocation
  source: LocationSource
}

const MAX_TEXT = 80

function cleanText(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const text = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  return Array.from(text).slice(0, MAX_TEXT).join('').trim()
}

// First-level subdivisions (ISO 3166-2) for the countries most visitors come
// from; elsewhere the region code is shown as Vercel sends it. India lists
// both the pre- and post-2023 codes, since IP databases use either.
const SUBDIVISIONS: Record<string, Record<string, string>> = {
  IN: {
    AN: 'Andaman and Nicobar Islands', AP: 'Andhra Pradesh', AR: 'Arunachal Pradesh', AS: 'Assam', BR: 'Bihar',
    CH: 'Chandigarh', CG: 'Chhattisgarh', CT: 'Chhattisgarh', DH: 'Dadra and Nagar Haveli and Daman and Diu',
    DN: 'Dadra and Nagar Haveli and Daman and Diu', DD: 'Dadra and Nagar Haveli and Daman and Diu', DL: 'Delhi',
    GA: 'Goa', GJ: 'Gujarat', HP: 'Himachal Pradesh', HR: 'Haryana', JH: 'Jharkhand', JK: 'Jammu and Kashmir',
    KA: 'Karnataka', KL: 'Kerala', LA: 'Ladakh', LD: 'Lakshadweep', MH: 'Maharashtra', ML: 'Meghalaya',
    MN: 'Manipur', MP: 'Madhya Pradesh', MZ: 'Mizoram', NL: 'Nagaland', OD: 'Odisha', OR: 'Odisha', PB: 'Punjab',
    PY: 'Puducherry', RJ: 'Rajasthan', SK: 'Sikkim', TG: 'Telangana', TS: 'Telangana', TN: 'Tamil Nadu',
    TR: 'Tripura', UP: 'Uttar Pradesh', UK: 'Uttarakhand', UT: 'Uttarakhand', WB: 'West Bengal',
  },
  US: {
    AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
    DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
    IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine',
    MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
    MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico',
    NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
    PA: 'Pennsylvania', PR: 'Puerto Rico', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
    TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
    WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  },
  GB: { ENG: 'England', SCT: 'Scotland', WLS: 'Wales', NIR: 'Northern Ireland' },
  AE: { AZ: 'Abu Dhabi', AJ: 'Ajman', DU: 'Dubai', FU: 'Fujairah', RK: 'Ras Al Khaimah', SH: 'Sharjah', UQ: 'Umm Al Quwain' },
  CA: {
    AB: 'Alberta', BC: 'British Columbia', MB: 'Manitoba', NB: 'New Brunswick', NL: 'Newfoundland and Labrador',
    NS: 'Nova Scotia', NT: 'Northwest Territories', NU: 'Nunavut', ON: 'Ontario', PE: 'Prince Edward Island',
    QC: 'Quebec', SK: 'Saskatchewan', YT: 'Yukon',
  },
  AU: {
    ACT: 'Australian Capital Territory', NSW: 'New South Wales', NT: 'Northern Territory', QLD: 'Queensland',
    SA: 'South Australia', TAS: 'Tasmania', VIC: 'Victoria', WA: 'Western Australia',
  },
}

let regionNames: Intl.DisplayNames | null | undefined

function displayNames(): Intl.DisplayNames | null {
  if (regionNames === undefined) {
    try {
      regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
    } catch {
      regionNames = null
    }
  }
  return regionNames
}

/** "India" for "IN"; the code itself when the runtime has no name for it. */
export function countryName(code: string): string {
  try {
    return displayNames()?.of(code) ?? code
  } catch {
    return code
  }
}

const COUNTRY_ALIASES: Record<string, string> = {
  usa: 'US', 'united states of america': 'US', america: 'US', uk: 'GB', 'great britain': 'GB',
  england: 'GB', uae: 'AE', bharat: 'IN',
}

let countryCodes: Map<string, string> | null = null

/** ISO code for a country name a user typed ("India", "india", "IN", "UAE"); '' when unknown. */
export function countryCodeFor(name: string): string {
  const key = name.trim().toLowerCase()
  if (!key) return ''
  if (COUNTRY_ALIASES[key]) return COUNTRY_ALIASES[key]
  if (!countryCodes) {
    countryCodes = new Map()
    const A = 'A'.charCodeAt(0)
    for (let i = 0; i < 26; i++) {
      for (let j = 0; j < 26; j++) {
        const code = String.fromCharCode(A + i, A + j)
        const label = countryName(code)
        if (label !== code && !countryCodes.has(label.toLowerCase())) countryCodes.set(label.toLowerCase(), code)
      }
    }
  }
  if (/^[a-z]{2}$/.test(key) && countryName(key.toUpperCase()) !== key.toUpperCase()) return key.toUpperCase()
  return countryCodes.get(key) ?? ''
}

export function subdivisionName(countryCode: string, regionCode: string): string {
  return SUBDIVISIONS[countryCode]?.[regionCode] ?? regionCode
}

function decodeHeader(raw: string | null): string {
  if (!raw) return ''
  try {
    return cleanText(decodeURIComponent(raw))
  } catch {
    return cleanText(raw)
  }
}

/** Approximate location from Vercel's geo headers, or null without a usable country. */
export function locationFromHeaders(headers: Headers): CoarseLocation | null {
  const countryCode = (headers.get('x-vercel-ip-country') ?? '').trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(countryCode) || countryCode === 'XX' || countryCode === 'ZZ') return null
  const region = (headers.get('x-vercel-ip-country-region') ?? '').trim().toUpperCase()
  const timezone = (headers.get('x-vercel-ip-timezone') ?? '').trim()
  return {
    country: countryName(countryCode),
    countryCode,
    stateOrRegion: /^[A-Z0-9]{1,3}$/.test(region) ? subdivisionName(countryCode, region) : '',
    city: decodeHeader(headers.get('x-vercel-ip-city')),
    timezone: /^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+){0,2}$/.test(timezone) && timezone.length <= 64 ? timezone : '',
  }
}

/**
 * The location to record: the user's profile when it names a country (it
 * overrides the network's guess), else the approximate one, else null.
 */
export function resolveLocation(profile: ProfileLocation | null, approximate: CoarseLocation | null): ResolvedLocation | null {
  const country = cleanText(profile?.country)
  if (country) {
    const countryCode = countryCodeFor(country)
    return {
      source: 'user_profile',
      location: {
        country,
        countryCode,
        stateOrRegion: cleanText(profile?.stateOrRegion),
        city: cleanText(profile?.city),
        // A profile has no time zone; the network's is kept only when it agrees on the country.
        timezone: approximate && countryCode && approximate.countryCode === countryCode ? approximate.timezone : '',
      },
    }
  }
  return approximate ? { source: 'ip_approximate', location: approximate } : null
}
