import { describe, it, expect, vi } from 'vitest'
import { authDomainFrom, firebaseConfigFrom } from './webConfig'

const ENV = {
  VITE_FIREBASE_API_KEY: 'api-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'ev2027.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'ev2027',
  VITE_FIREBASE_STORAGE_BUCKET: 'ev2027.appspot.com',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '1234567890',
  VITE_FIREBASE_APP_ID: '1:1234567890:web:abc',
}

describe('firebaseConfigFrom', () => {
  it('keeps the current production auth domain while it is configured', () => {
    expect(firebaseConfigFrom(ENV).authDomain).toBe('ev2027.firebaseapp.com')
  })

  it('reads the custom auth domain, changing nothing else', () => {
    expect(firebaseConfigFrom({ ...ENV, VITE_FIREBASE_AUTH_DOMAIN: 'auth.ev.engineer' })).toEqual({
      apiKey: 'api-key',
      authDomain: 'auth.ev.engineer',
      projectId: 'ev2027',
      storageBucket: 'ev2027.appspot.com',
      messagingSenderId: '1234567890',
      appId: '1:1234567890:web:abc',
    })
  })
})

describe('authDomainFrom', () => {
  it('tolerates the whitespace and case a pasted environment value picks up', () => {
    expect(authDomainFrom(' Auth.EV.Engineer\n', 'ev2027')).toBe('auth.ev.engineer')
  })

  it.each(['https://auth.ev.engineer', 'auth.ev.engineer/__/auth/handler', 'auth.ev.engineer:443', 'localhost'])(
    'falls back to the project default domain for %j, which is not a bare hostname', raw => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      expect(authDomainFrom(raw, 'ev2027')).toBe('ev2027.firebaseapp.com')
      expect(warn).toHaveBeenCalledOnce()
      warn.mockRestore()
    },
  )

  it('uses the project default domain when unset, and nothing without a project', () => {
    expect(authDomainFrom(undefined, 'ev2027')).toBe('ev2027.firebaseapp.com')
    expect(authDomainFrom('', 'ev2027')).toBe('ev2027.firebaseapp.com')
    expect(authDomainFrom(undefined, undefined)).toBeUndefined()
  })
})
