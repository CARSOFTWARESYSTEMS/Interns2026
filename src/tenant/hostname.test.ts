import { describe, it, expect } from 'vitest'
import { normalizeHostname, isLocalDevHost, resolveLookupHost } from './hostname'
import seed from './partners.seed.json'

/** Same lookup the PartnerContext performs against partnerDomains, using the seed table. */
function partnerFor(host: string, devOverrides: string[] = []): string | null {
  const r = resolveLookupHost({ actualHost: host, devOverrides })
  if (r.kind !== 'lookup') return null
  const d = seed.domains.find(x => x.hostname === r.hostname && x.status === 'Active')
  return d?.partnerId ?? null
}

describe('normalizeHostname', () => {
  it('lowercases, trims, strips port and trailing dot', () => {
    expect(normalizeHostname('  LOGIN.Gamyaa.IN  ')).toBe('login.gamyaa.in')
    expect(normalizeHostname('login.uflight.in:443')).toBe('login.uflight.in')
    expect(normalizeHostname('login.itelematics.com.')).toBe('login.itelematics.com')
    expect(normalizeHostname('localhost:5173')).toBe('localhost')
    expect(normalizeHostname('[::1]:5173')).toBe('[::1]')
  })

  it('rejects malformed or hostile input', () => {
    for (const bad of [
      '', '   ', null, undefined, 'login.gamyaa.in/evil', 'a..b', '-bad.com', 'bad-.com',
      'login.gamyaa.in:abc', 'login.gamyaa.in:99999999', 'user@login.gamyaa.in',
      'login gamyaa.in', 'xn--$$$.com', '[fe80::1]', 'a'.repeat(300) + '.com',
    ]) {
      expect(normalizeHostname(bad as string)).toBeNull()
    }
  })
})

describe('isLocalDevHost', () => {
  it('accepts only loopback names', () => {
    expect(isLocalDevHost('localhost')).toBe(true)
    expect(isLocalDevHost('app.localhost')).toBe(true)
    expect(isLocalDevHost('127.0.0.1')).toBe(true)
    expect(isLocalDevHost('[::1]')).toBe(true)
    expect(isLocalDevHost('login.gamyaa.in')).toBe(false)
    expect(isLocalDevHost('localhost.evil.com')).toBe(false)
    expect(isLocalDevHost(null)).toBe(false)
  })
})

describe('domain resolution (spec §30)', () => {
  it('gamyaa domain → GAMYAA', () => expect(partnerFor('login.gamyaa.in')).toBe('gamyaa'))
  it('uflight domain → UFlight', () => expect(partnerFor('login.uflight.in')).toBe('uflight'))
  it('itelematics domain → iTelematics', () => expect(partnerFor('login.itelematics.com')).toBe('itelematics'))
  it('EV.ENGINEER domain → EV.ENGINEER', () => expect(partnerFor('login.autonomous.ev.engineer')).toBe('ev-engineer'))

  it('is case- and port-insensitive', () => {
    expect(partnerFor('LOGIN.GAMYAA.IN:443')).toBe('gamyaa')
  })

  it('unknown production domain → rejected (no fallback to a real Partner)', () => {
    expect(partnerFor('login.example.com')).toBeNull()
    expect(partnerFor('gamyaa.in')).toBeNull()                 // apex is not mapped
    expect(partnerFor('login.gamyaa.in.evil.com')).toBeNull()  // suffix trick
    expect(partnerFor('evil-login.gamyaa.in')).toBeNull()
    expect(partnerFor('interns2026.web.app')).toBeNull()       // default hosting domain not mapped
  })

  it('invalid host strings resolve to unknown', () => {
    expect(resolveLookupHost({ actualHost: 'login.gamyaa.in/../x' })).toEqual({ kind: 'unknown', reason: 'invalid-hostname' })
  })
})

describe('dev overrides', () => {
  it('are honoured on localhost', () => {
    expect(partnerFor('localhost:5173', ['login.uflight.in'])).toBe('uflight')
    expect(resolveLookupHost({ actualHost: '127.0.0.1:5173', devOverrides: [null as unknown as string, 'login.gamyaa.in'] }))
      .toEqual({ kind: 'lookup', hostname: 'login.gamyaa.in', source: 'dev-override' })
  })

  it('are IGNORED on real domains (query/storage tampering cannot switch tenant)', () => {
    expect(partnerFor('login.gamyaa.in', ['login.uflight.in'])).toBe('gamyaa')
    expect(resolveLookupHost({ actualHost: 'login.gamyaa.in', devOverrides: ['login.uflight.in'] }))
      .toEqual({ kind: 'lookup', hostname: 'login.gamyaa.in', source: 'host' })
  })

  it('localhost without an override fails closed', () => {
    expect(resolveLookupHost({ actualHost: 'localhost:5173' }))
      .toEqual({ kind: 'unknown', reason: 'dev-host-without-override' })
  })

  it('an override cannot point at another loopback name', () => {
    expect(resolveLookupHost({ actualHost: 'localhost', devOverrides: ['127.0.0.1'] }).kind).toBe('unknown')
  })
})
