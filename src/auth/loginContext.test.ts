import { describe, expect, it } from 'vitest'
import { LOGIN_TRIGGERS, parseLoginTrigger, pathOnly, promptTypeFor, sanitizePageLabel, siteDomain } from './loginContext'

describe('login triggers', () => {
  it('accepts exactly the controlled values', () => {
    for (const t of LOGIN_TRIGGERS) expect(parseLoginTrigger(t)).toBe(t)
    expect(LOGIN_TRIGGERS).toEqual(['header_login', 'five_minute_prompt', 'premium_route_required', 'workspace_access', 'manual_login'])
  })

  it.each([undefined, null, '', 'HEADER_LOGIN', 'admin', ' header_login', 42, {}])('reads %j as manual_login', raw => {
    expect(parseLoginTrigger(raw)).toBe('manual_login')
  })

  it('maps the five-minute prompt to optional and premium routes to required', () => {
    expect(promptTypeFor('five_minute_prompt')).toBe('optional')
    expect(promptTypeFor('premium_route_required')).toBe('required')
    expect(promptTypeFor('header_login')).toBeNull()
    expect(promptTypeFor('workspace_access')).toBeNull()
    expect(promptTypeFor('manual_login')).toBeNull()
  })
})

describe('page labels', () => {
  it('keeps plain text on one line, at most 80 characters', () => {
    expect(sanitizePageLabel('  CubeSat /\n CubeTwin\t')).toBe('CubeSat / CubeTwin')
    expect(sanitizePageLabel('a'.repeat(200))).toHaveLength(80)
    expect(sanitizePageLabel('🚀'.repeat(100))).toBe('🚀'.repeat(80))
    expect(sanitizePageLabel(null)).toBe('')
    expect(sanitizePageLabel(['x'])).toBe('')
  })
})

describe('sources', () => {
  it('drops the query and hash from a path', () => {
    expect(pathOnly('/space/cubesat?mode=advanced#energy')).toBe('/space/cubesat')
    expect(pathOnly('/?email=a@b.c')).toBe('/')
    expect(pathOnly('relative')).toBe('/')
  })

  it('names the site without www', () => {
    expect(siteDomain('www.ev.engineer')).toBe('ev.engineer')
    expect(siteDomain('autonomous.ev.engineer')).toBe('autonomous.ev.engineer')
  })
})
