import { describe, expect, it } from 'vitest'
import type { UserActivation } from '../types/activation'
import type { PartnerMembership } from '../types/partner'
import {
  activeFilterCount, buildRows, EMPTY_FILTERS, filterOptions, filterRows, formatDate, formatDateTime, labelOf, paginate,
  readViewState, sortRows, writeViewState, type DirectoryFilters,
} from './userDirectory'

const NOW = Date.UTC(2026, 9, 25, 12, 44)   // 25 Oct 2026 18:14 IST
const DAY = 24 * 60 * 60_000

function membership(partnerId: string, uid: string, over: Partial<PartnerMembership> = {}): PartnerMembership {
  return {
    id: `${partnerId}_${uid}`, partnerId, uid, email: `${uid}@example.com`, displayName: `Member ${uid}`, photoURL: '',
    role: 'Viewer', status: 'Active', employeeId: '', designation: '', team: '', managerId: '', architectId: '',
    inviteId: '', invitedBy: '', approvedBy: '', createdAt: '', updatedAt: '', updatedBy: '', ...over,
  }
}

function activation(partnerId: string, uid: string, over: Partial<UserActivation> = {}): UserActivation {
  return {
    id: `${partnerId}_${uid}`, uid, email: `${uid}@example.com`, emailVerified: true, displayName: `User ${uid}`,
    partnerId, ecosystem: 'ev_engineer', loginProvider: 'login.autonomous.ev.engineer',
    firstActivatedAt: NOW - 10 * DAY, firstSourceDomain: 'autonomous.ev.engineer', firstSourceHost: 'autonomous.ev.engineer',
    firstSourcePath: '/space/satellite-engineering', firstSourcePageLabel: 'Satellite Engineering',
    firstLoginTrigger: 'premium_route_required', firstLoginPromptType: 'required',
    lastLoginAt: NOW - DAY, lastSourceDomain: 'ev.engineer', lastSourceHost: 'www.ev.engineer', lastSourcePath: '/',
    lastSourcePageLabel: 'Home', lastLoginTrigger: 'header_login', lastLoginPromptType: null, lastAccess: 'granted', loginCount: 3,
    country: 'India', countryCode: 'IN', stateOrRegion: 'Karnataka', city: 'Bengaluru', timezone: 'Asia/Kolkata',
    locationSource: 'ip_approximate', locationCapturedAt: NOW - DAY, recentEvents: [], updatedAt: NOW - DAY, ...over,
  }
}

const f = (over: Partial<DirectoryFilters>): DirectoryFilters => ({ ...EMPTY_FILTERS, ...over })

describe('rows', () => {
  const rows = buildRows(
    [membership('ev-engineer', 'a'), membership('gamyaa', 'a', { role: 'Admin' }), membership('ev-engineer', 'b', { status: 'Suspended' })],
    [
      activation('ev-engineer', 'a', { displayName: 'Rahul Rao' }),
      activation('ev-engineer', 'c', { lastAccess: 'no_membership', displayName: '', email: 'c@example.com' }),
      activation('uflight', 'p', { lastAccess: 'platform_admin' }),
    ],
  )
  const row = (key: string) => rows.find(r => r.key === key)!

  it('joins each membership with its activation, one row per user per Partner', () => {
    expect(rows.map(r => r.key).sort()).toEqual(['ev-engineer_a', 'ev-engineer_b', 'ev-engineer_c', 'gamyaa_a', 'uflight_p'])
    expect(row('ev-engineer_a')).toMatchObject({ name: 'Rahul Rao', role: 'Viewer', status: 'Active' })
    expect(row('ev-engineer_a').activation).not.toBeNull()
    expect(row('gamyaa_a')).toMatchObject({ name: 'Member a', role: 'Admin', activation: null })
  })

  it('shows signed-in people without a membership as Authenticated · No Membership', () => {
    expect(row('ev-engineer_c')).toMatchObject({ role: 'No Membership', status: 'Authenticated', membership: null })
    expect(labelOf(row('ev-engineer_c'))).toBe('c@example.com')
    expect(row('uflight_p')).toMatchObject({ role: 'Platform Admin', status: 'Active' })
  })

  it('keeps the membership status, not the access at the last sign-in', () => {
    expect(row('ev-engineer_b').status).toBe('Suspended')
  })
})

describe('filters', () => {
  const rows = buildRows([membership('gamyaa', 'm', { role: 'Developer' })], [
    activation('ev-engineer', 'a', { displayName: 'Rahul Rao', email: 'rahul@example.com' }),
    activation('ev-engineer', 'b', { country: 'Singapore', countryCode: 'SG', stateOrRegion: '', firstLoginTrigger: 'five_minute_prompt', firstActivatedAt: NOW - 2 * DAY, lastLoginAt: NOW - 3600_000 }),
    activation('gamyaa', 'g', { firstSourceDomain: 'aerospace.gamyaa.in', lastSourceDomain: 'aerospace.gamyaa.in', stateOrRegion: 'Tamil Nadu', lastAccess: 'no_membership' }),
  ])
  const keys = (filters: Partial<DirectoryFilters>) => filterRows(rows, f(filters), NOW).map(r => r.key).sort()

  it('searches names and email addresses only', () => {
    expect(keys({ search: 'rahul' })).toEqual(['ev-engineer_a'])
    expect(keys({ search: 'RAHUL@EXAMPLE' })).toEqual(['ev-engineer_a'])
    expect(keys({ search: 'karnataka' })).toEqual([])
  })

  it('filters by ecosystem, domain (first or latest), role, status, country, state and trigger', () => {
    expect(keys({ partnerId: 'gamyaa' })).toEqual(['gamyaa_g', 'gamyaa_m'])
    expect(keys({ domain: 'ev.engineer' })).toEqual(['ev-engineer_a', 'ev-engineer_b'])
    expect(keys({ domain: 'aerospace.gamyaa.in' })).toEqual(['gamyaa_g'])
    expect(keys({ role: 'No Membership' })).toEqual(['ev-engineer_a', 'ev-engineer_b', 'gamyaa_g'])
    expect(keys({ role: 'Developer' })).toEqual(['gamyaa_m'])
    expect(keys({ status: 'Authenticated' })).toEqual(['ev-engineer_a', 'ev-engineer_b', 'gamyaa_g'])
    expect(keys({ country: 'Singapore' })).toEqual(['ev-engineer_b'])
    expect(keys({ country: 'India', stateOrRegion: 'Tamil Nadu' })).toEqual(['gamyaa_g'])
    expect(keys({ trigger: 'five_minute_prompt' })).toEqual(['ev-engineer_b'])
  })

  it('filters by first activation and last login date', () => {
    expect(keys({ firstActivated: '7' })).toEqual(['ev-engineer_b'])
    expect(keys({ lastLogin: '1' })).toEqual(['ev-engineer_b'])
    expect(keys({ lastLogin: '30' })).toEqual(['ev-engineer_a', 'ev-engineer_b', 'gamyaa_g'])
  })

  it('offers only choices that exist, states following the country', () => {
    const o = filterOptions(rows, 'India')
    expect(o.countries).toEqual(['India', 'Singapore'])
    expect(o.states).toEqual(['Karnataka', 'Tamil Nadu'])
    expect(o.domains).toEqual(['aerospace.gamyaa.in', 'autonomous.ev.engineer', 'ev.engineer'])
    expect(o.triggers).toEqual(['five_minute_prompt', 'premium_route_required'])
    expect(o.roles).toEqual(['Developer', 'No Membership'])
    expect(activeFilterCount(f({ search: 'x', country: 'India', lastLogin: '7' }))).toBe(2)
  })
})

describe('sorting and pages', () => {
  const rows = buildRows([membership('ev-engineer', 'z', { displayName: 'Zed' })], [
    activation('ev-engineer', 'a', { displayName: 'Anu', lastLoginAt: NOW - 5 * DAY, country: 'India' }),
    activation('ev-engineer', 'b', { displayName: 'Bala', lastLoginAt: NOW - DAY, country: 'Australia' }),
  ])
  const names = (key: Parameters<typeof sortRows>[1]['key'], dir: 'asc' | 'desc') => sortRows(rows, { key, dir }).map(r => r.name)

  it('sorts by each column, rows without a value last in both directions', () => {
    expect(names('lastLogin', 'desc')).toEqual(['Bala', 'Anu', 'Zed'])
    expect(names('lastLogin', 'asc')).toEqual(['Anu', 'Bala', 'Zed'])
    expect(names('name', 'asc')).toEqual(['Anu', 'Bala', 'Zed'])
    expect(names('name', 'desc')).toEqual(['Zed', 'Bala', 'Anu'])
    expect(names('country', 'asc')).toEqual(['Bala', 'Anu', 'Zed'])
    expect(names('email', 'asc')).toEqual(['Anu', 'Bala', 'Zed'])
  })

  it('pages through rows and clamps the page', () => {
    const list = Array.from({ length: 60 }, (_, i) => i)
    expect(paginate(list, 1)).toMatchObject({ items: list.slice(0, 25), page: 1, pages: 3, from: 1, to: 25, total: 60 })
    expect(paginate(list, 3)).toMatchObject({ page: 3, from: 51, to: 60 })
    expect(paginate(list, 9).page).toBe(3)
    expect(paginate([], 1)).toMatchObject({ items: [], page: 1, pages: 1, from: 0, to: 0 })
  })
})

describe('view state in the URL', () => {
  it('round-trips filters, sort and page, and ignores anything invalid', () => {
    const filters = f({ search: 'rao', country: 'India', trigger: 'premium_route_required', firstActivated: '30' })
    const params = writeViewState(filters, { key: 'name', dir: 'asc' }, 2)
    expect(params.toString()).toBe('q=rao&country=India&trigger=premium_route_required&activated=30&sort=name%3Aasc&page=2')
    expect(readViewState(params)).toEqual({ filters, sort: { key: 'name', dir: 'asc' }, page: 2 })
    expect(readViewState(new URLSearchParams('sort=evil:asc&activated=365&page=-4'))).toEqual({
      filters: EMPTY_FILTERS, sort: { key: 'lastLogin', dir: 'desc' }, page: 1,
    })
  })
})

describe('dates', () => {
  it('read as the specification shows them', () => {
    expect(formatDate(NOW, 'Asia/Kolkata')).toBe('25 Oct 2026')
    expect(formatDateTime(NOW, 'Asia/Kolkata')).toBe('25 Oct 2026 · 18:14')
    expect(formatDateTime(null)).toBe('—')
  })
})
