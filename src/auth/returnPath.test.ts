import { describe, it, expect } from 'vitest'
import { returnUrl, sanitizeReturnPath } from './returnPath'

const HOST = 'aerospace.ev.engineer'

describe('sanitizeReturnPath', () => {
  it.each([
    '/',
    '/aerospace/uflight-3d',
    '/aerospace/uflight-3d?view=orbit&lang=en#telemetry',
    '/search?q=a%2Fb&page=2',
    '/a/b/?x=1',
    '/path/with%20space',
  ])('keeps %s exactly', path => {
    expect(sanitizeReturnPath(path, HOST)).toBe(path)
  })

  it('normalises what the URL parser would anyway', () => {
    expect(sanitizeReturnPath('/a/../b/./c', HOST)).toBe('/b/c')
    expect(sanitizeReturnPath('/a b', HOST)).toBe('/a%20b')
    expect(sanitizeReturnPath('/a?x=1#', HOST)).toBe('/a?x=1')
  })

  it.each([
    'https://evil.example/',
    'http://aerospace.ev.engineer/',        // even the same host, as a full URL
    '//evil.example/path',
    '/\\evil.example',
    '\\\\evil.example',
    '/x\\y',
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'evil.example',
    'relative/path',
    ' /leading-space',
    '/x\r\nLocation: https://evil.example',
    '/\t/evil.example',
    '/x\u0000',
    '',
    `/${'a'.repeat(2048)}`,
  ])('rejects %j', raw => {
    expect(sanitizeReturnPath(raw, HOST)).toBeNull()
  })

  it('rejects non-strings', () => {
    expect(sanitizeReturnPath(null, HOST)).toBeNull()
    expect(sanitizeReturnPath(undefined, HOST)).toBeNull()
  })
})

describe('returnUrl', () => {
  it('builds an absolute https URL on the host', () => {
    expect(returnUrl(HOST, '/aerospace/uflight-3d?view=orbit#telemetry'))
      .toBe('https://aerospace.ev.engineer/aerospace/uflight-3d?view=orbit#telemetry')
  })

  it('refuses a path that would leave the host', () => {
    expect(() => returnUrl(HOST, '//evil.example/')).toThrow()
  })
})
