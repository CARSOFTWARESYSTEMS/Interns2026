import { describe, it, expect } from 'vitest'
import {
  AUTH_PROVIDER_LIST, AUTH_PROVIDERS, isAllowedAppHost, providerForAppHost, providerForLoginHost,
} from './providers'
import seed from '../tenant/partners.seed.json'

const SPEC: Record<string, string[]> = {
  'login.itelematics.com': ['itelematics.com', 'www.itelematics.com'],
  'login.autonomous.ev.engineer': ['ev.engineer', 'www.ev.engineer', 'autonomous.ev.engineer', 'aerospace.ev.engineer'],
  'login.gamyaa.in': ['gamyaa.in', 'www.gamyaa.in', 'aerospace.gamyaa.in', 'aerosystems.gamyaa.in'],
  'login.uflight.in': ['uflight.in', 'www.uflight.in'],
}

const allowed = AUTH_PROVIDER_LIST.flatMap(p => p.allowedHosts.map(h => [p.loginHost, h] as const))
const crossed = AUTH_PROVIDER_LIST.flatMap(p =>
  AUTH_PROVIDER_LIST.filter(q => q !== p).flatMap(q => q.allowedHosts.map(h => [p.loginHost, h] as const)))

describe('AUTH_PROVIDERS', () => {
  it('is exactly the login-domain → application-host table', () => {
    expect(Object.fromEntries(AUTH_PROVIDER_LIST.map(p => [p.loginHost, [...p.allowedHosts]]))).toEqual(SPEC)
  })

  it.each(allowed)('%s signs users in to %s', (login, app) => {
    const provider = providerForLoginHost(login)!
    expect(provider).not.toBeNull()
    expect(isAllowedAppHost(provider, app)).toBe(true)
    expect(providerForAppHost(app)).toBe(provider)
  })

  it.each(crossed)('%s does not sign users in to %s', (login, app) => {
    expect(isAllowedAppHost(providerForLoginHost(login)!, app)).toBe(false)
  })

  it('maps every host to exactly one provider', () => {
    const hosts = AUTH_PROVIDER_LIST.flatMap(p => [p.loginHost, ...p.allowedHosts])
    expect(new Set(hosts).size).toBe(hosts.length)
  })

  it('keeps login hosts and application hosts apart', () => {
    for (const p of AUTH_PROVIDER_LIST) {
      expect(providerForAppHost(p.loginHost)).toBeNull()
      for (const h of p.allowedHosts) expect(providerForLoginHost(h)).toBeNull()
    }
  })

  it("uses each login host's Partner from the tenant seed for roles", () => {
    for (const p of AUTH_PROVIDER_LIST) {
      const domain = seed.domains.find(d => d.hostname === p.loginHost)
      expect(domain?.partnerId, p.loginHost).toBe(p.partnerId)
    }
  })

  it('ids match their keys', () => {
    for (const [key, p] of Object.entries(AUTH_PROVIDERS)) expect(p.id).toBe(key)
  })

  it('normalises case, a port and a trailing dot', () => {
    expect(providerForAppHost('AeroSpace.EV.Engineer')?.id).toBe('ev_engineer')
    expect(providerForAppHost('www.uflight.in.')?.id).toBe('uflight')
    expect(providerForLoginHost('LOGIN.GAMYAA.IN:443')?.id).toBe('gamyaa')
  })

  it.each([
    'evil.example', 'ev.engineer.evil.example', 'evil-ev.engineer', 'xaerospace.ev.engineer',
    'deep.aerospace.ev.engineer', 'login.ev.engineer', 'itelematics.co', 'uflight.in.evil.example',
    '', 'javascript:alert(1)', 'https://ev.engineer', 'ev.engineer/path',
  ])('rejects %j', host => {
    expect(providerForAppHost(host)).toBeNull()
    expect(providerForLoginHost(host)).toBeNull()
  })
})
