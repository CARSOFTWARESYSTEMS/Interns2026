import { describe, it, expect } from 'vitest'
import { peekLoginState } from './loginState'
import { seal } from '../../server/auth/crypto.js'
import { STATE_PURPOSE } from '../../server/auth/handler.js'

describe('peekLoginState', () => {
  it('reads the host and path the server sealed', () => {
    const token = seal('x'.repeat(32), STATE_PURPOSE, { h: 'aerospace.ev.engineer', p: '/aerospace/uflight-3d?a=1#b', n: 'n', c: 'c', t: 1 })
    expect(peekLoginState(token)).toEqual({ host: 'aerospace.ev.engineer', path: '/aerospace/uflight-3d?a=1#b' })
  })

  it.each([null, undefined, '', 'garbage', '.sig', 'e30.sig', '!!!.sig'])('returns null for %j', token => {
    expect(peekLoginState(token)).toBeNull()
  })
})
