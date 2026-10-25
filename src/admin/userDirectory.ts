// ── Users view: rows, filters, sorting, pages ───────────────────────────────
//
// Pure, so the Users table and its tests share one definition. One row is one
// user in one Partner: their membership (live access) joined with their
// activation record (where and when they signed in). Either may be missing —
// a member who has not signed in since activation tracking began, or a person
// who signed in with no membership ("Authenticated · No Membership": signed
// in, not authorized).

import { LOGIN_TRIGGER_LABELS, LOGIN_TRIGGERS, type LoginPromptType, type LoginTrigger } from '../auth/loginContext'
import type { UserActivation } from '../types/activation'
import { PARTNER_ROLES, type MembershipStatus, type PartnerMembership, type PartnerRole } from '../types/partner'

export type DirectoryStatus = MembershipStatus | 'Authenticated'
export type DirectoryRole = PartnerRole | 'Platform Admin' | 'No Membership'

export const DIRECTORY_STATUSES: readonly DirectoryStatus[] = ['Active', 'Pending', 'Suspended', 'Blocked', 'Authenticated']
export const DIRECTORY_ROLES: readonly DirectoryRole[] = ['Platform Admin', ...PARTNER_ROLES, 'No Membership']

export interface DirectoryRow {
  /** `${partnerId}_${uid}` */
  key: string
  uid: string
  partnerId: string
  /** '' when the identity provider had none; show `labelOf(row)`. */
  name: string
  email: string
  role: DirectoryRole
  status: DirectoryStatus
  membership: PartnerMembership | null
  activation: UserActivation | null
}

/** The person's name, or their email when they have none. */
export function labelOf(row: Pick<DirectoryRow, 'name' | 'email' | 'uid'>): string {
  return row.name || row.email || row.uid
}

export function buildRows(memberships: readonly PartnerMembership[], activations: readonly UserActivation[]): DirectoryRow[] {
  const joined = new Map<string, { m: PartnerMembership | null; a: UserActivation | null; uid: string; partnerId: string }>()
  for (const m of memberships) joined.set(`${m.partnerId}_${m.uid}`, { m, a: null, uid: m.uid, partnerId: m.partnerId })
  for (const a of activations) {
    const key = `${a.partnerId}_${a.uid}`
    const entry = joined.get(key)
    if (entry) entry.a = a
    else joined.set(key, { m: null, a, uid: a.uid, partnerId: a.partnerId })
  }
  return [...joined].map(([key, { m, a, uid, partnerId }]) => {
    const platformAdmin = !m && a?.lastAccess === 'platform_admin'
    return {
      key, uid, partnerId,
      // The identity provider's latest name and email, else what the membership recorded.
      name: a?.displayName || m?.displayName || '',
      email: a?.email || m?.email || '',
      role: m ? m.role : platformAdmin ? 'Platform Admin' : 'No Membership',
      status: m ? m.status : platformAdmin ? 'Active' : 'Authenticated',
      membership: m,
      activation: a,
    }
  })
}

// ── Filters ─────────────────────────────────────────────────────────────────

/** Days back from now; '' = any time. */
export type DateWindow = '' | '1' | '7' | '30' | '90'
export const DATE_WINDOWS: ReadonlyArray<{ value: DateWindow; label: string }> = [
  { value: '', label: 'Any time' },
  { value: '1', label: 'Last 24 hours' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
]

export interface DirectoryFilters {
  search: string
  /** Ecosystem / Partner. */
  partnerId: string
  /** Matches the first or the latest source domain. */
  domain: string
  role: string
  status: string
  country: string
  stateOrRegion: string
  /** The trigger of the first activation. */
  trigger: string
  firstActivated: DateWindow
  lastLogin: DateWindow
}

export const EMPTY_FILTERS: DirectoryFilters = {
  search: '', partnerId: '', domain: '', role: '', status: '', country: '', stateOrRegion: '', trigger: '',
  firstActivated: '', lastLogin: '',
}

const DAY = 24 * 60 * 60_000

function within(at: number | undefined, window: DateWindow, now: number): boolean {
  if (!window) return true
  return typeof at === 'number' && at <= now && now - at < Number(window) * DAY
}

export function filterRows(rows: readonly DirectoryRow[], f: DirectoryFilters, now: number): DirectoryRow[] {
  const q = f.search.trim().toLowerCase()
  return rows.filter(r => {
    const a = r.activation
    if (q && !r.name.toLowerCase().includes(q) && !r.email.toLowerCase().includes(q)) return false
    if (f.partnerId && r.partnerId !== f.partnerId) return false
    if (f.domain && a?.firstSourceDomain !== f.domain && a?.lastSourceDomain !== f.domain) return false
    if (f.role && r.role !== f.role) return false
    if (f.status && r.status !== f.status) return false
    if (f.country && a?.country !== f.country) return false
    if (f.stateOrRegion && a?.stateOrRegion !== f.stateOrRegion) return false
    if (f.trigger && a?.firstLoginTrigger !== f.trigger) return false
    if (!within(a?.firstActivatedAt, f.firstActivated, now)) return false
    if (!within(a?.lastLoginAt, f.lastLogin, now)) return false
    return true
  })
}

export function activeFilterCount(f: DirectoryFilters): number {
  return (Object.keys(EMPTY_FILTERS) as Array<keyof DirectoryFilters>).filter(k => k !== 'search' && f[k] !== '').length
}

const distinct = (values: Array<string | undefined>) =>
  [...new Set(values.filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b))

/** Choices for the filter menus, from the rows in view. States follow the chosen country. */
export function filterOptions(rows: readonly DirectoryRow[], country: string) {
  const activations = rows.map(r => r.activation).filter((a): a is UserActivation => a !== null)
  const roles = new Set(rows.map(r => r.role))
  const statuses = new Set(rows.map(r => r.status))
  const triggers = new Set(activations.map(a => a.firstLoginTrigger))
  return {
    domains: distinct(activations.flatMap(a => [a.firstSourceDomain, a.lastSourceDomain])),
    countries: distinct(activations.map(a => a.country)),
    states: distinct(activations.filter(a => !country || a.country === country).map(a => a.stateOrRegion)),
    roles: DIRECTORY_ROLES.filter(r => roles.has(r)),
    statuses: DIRECTORY_STATUSES.filter(s => statuses.has(s)),
    triggers: LOGIN_TRIGGERS.filter(t => triggers.has(t)),
  }
}

// ── Sorting and pages ───────────────────────────────────────────────────────

export type SortKey = 'name' | 'email' | 'firstActivated' | 'lastLogin' | 'country' | 'state'
export type SortDir = 'asc' | 'desc'
export interface DirectorySort { key: SortKey; dir: SortDir }

export const SORT_LABELS: Record<SortKey, string> = {
  name: 'Name', email: 'Email', firstActivated: 'First Activated', lastLogin: 'Last Login', country: 'Country', state: 'State / Region',
}

export const DEFAULT_SORT: DirectorySort = { key: 'lastLogin', dir: 'desc' }

function sortValue(r: DirectoryRow, key: SortKey): string | number | null {
  const a = r.activation
  switch (key) {
    case 'name': return labelOf(r).toLowerCase()
    case 'email': return r.email.toLowerCase() || null
    case 'firstActivated': return a?.firstActivatedAt ?? null
    case 'lastLogin': return a?.lastLoginAt ?? null
    case 'country': return a?.country.toLowerCase() || null
    case 'state': return a?.stateOrRegion.toLowerCase() || null
  }
}

/** Sorted copy. Rows without the value go last either way; ties fall back to the name. */
export function sortRows(rows: readonly DirectoryRow[], sort: DirectorySort): DirectoryRow[] {
  const sign = sort.dir === 'asc' ? 1 : -1
  return [...rows].sort((x, y) => {
    const a = sortValue(x, sort.key)
    const b = sortValue(y, sort.key)
    if (a === null && b !== null) return 1
    if (b === null && a !== null) return -1
    if (a !== null && b !== null && a !== b) return (a < b ? -1 : 1) * sign
    return labelOf(x).localeCompare(labelOf(y)) || x.key.localeCompare(y.key)
  })
}

export const PAGE_SIZE = 25

export function paginate<T>(rows: readonly T[], page: number, size = PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(rows.length / size))
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pages)
  const start = (current - 1) * size
  return {
    items: rows.slice(start, start + size),
    page: current,
    pages,
    from: rows.length === 0 ? 0 : start + 1,
    to: Math.min(rows.length, start + size),
    total: rows.length,
  }
}

// ── View state in the URL (survives opening a user and coming back) ─────────

const SORT_KEYS = Object.keys(SORT_LABELS) as SortKey[]
const WINDOWS = DATE_WINDOWS.map(w => w.value)

export function readViewState(params: URLSearchParams): { filters: DirectoryFilters; sort: DirectorySort; page: number } {
  const text = (k: string) => (params.get(k) ?? '').slice(0, 200)
  const win = (k: string): DateWindow => (WINDOWS as string[]).includes(text(k)) ? (text(k) as DateWindow) : ''
  const [key, dir] = text('sort').split(':')
  return {
    filters: {
      search: text('q'), partnerId: text('partner'), domain: text('domain'), role: text('role'), status: text('status'),
      country: text('country'), stateOrRegion: text('state'), trigger: text('trigger'),
      firstActivated: win('activated'), lastLogin: win('login'),
    },
    sort: (SORT_KEYS as string[]).includes(key) && (dir === 'asc' || dir === 'desc') ? { key: key as SortKey, dir } : DEFAULT_SORT,
    page: Math.max(1, Number(text('page')) || 1),
  }
}

export function writeViewState(filters: DirectoryFilters, sort: DirectorySort, page: number): URLSearchParams {
  const params = new URLSearchParams()
  const set = (k: string, v: string) => { if (v) params.set(k, v) }
  set('q', filters.search.trim())
  set('partner', filters.partnerId)
  set('domain', filters.domain)
  set('role', filters.role)
  set('status', filters.status)
  set('country', filters.country)
  set('state', filters.stateOrRegion)
  set('trigger', filters.trigger)
  set('activated', filters.firstActivated)
  set('login', filters.lastLogin)
  if (sort.key !== DEFAULT_SORT.key || sort.dir !== DEFAULT_SORT.dir) params.set('sort', `${sort.key}:${sort.dir}`)
  if (page > 1) params.set('page', String(page))
  return params
}

// ── Display ─────────────────────────────────────────────────────────────────

export function triggerLabel(trigger: LoginTrigger | null | undefined): string {
  return trigger ? LOGIN_TRIGGER_LABELS[trigger] ?? trigger : '—'
}

export function promptLabel(type: LoginPromptType | null | undefined): string {
  return type === 'required' ? 'Mandatory' : type === 'optional' ? 'Optional' : ''
}

/** "25 Oct 2026", in the viewer's time zone unless one is given. */
export function formatDate(at: number | null | undefined, timeZone?: string): string {
  if (typeof at !== 'number' || !Number.isFinite(at)) return '—'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone }).format(at)
}

/** "18:14" */
export function formatTime(at: number | null | undefined, timeZone?: string): string {
  if (typeof at !== 'number' || !Number.isFinite(at)) return ''
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone }).format(at)
}

/** "25 Oct 2026 · 18:14" */
export function formatDateTime(at: number | null | undefined, timeZone?: string): string {
  return typeof at === 'number' && Number.isFinite(at) ? `${formatDate(at, timeZone)} · ${formatTime(at, timeZone)}` : '—'
}
