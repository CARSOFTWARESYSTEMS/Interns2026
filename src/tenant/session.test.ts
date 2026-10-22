import { describe, it, expect, beforeEach } from 'vitest'
import {
  setActivePartnerId, requirePartnerId, inActivePartner, scopedId, TenantContextError, onActivePartnerChange,
} from './session'

beforeEach(() => setActivePartnerId(null))

describe('tenant session', () => {
  it('refuses to act without an active Partner (no default Partner fallback)', () => {
    expect(() => requirePartnerId()).toThrow(TenantContextError)
    expect(() => scopedId('dev1')).toThrow(TenantContextError)
  })

  it('stamps and scopes with the active Partner', () => {
    setActivePartnerId('gamyaa')
    expect(requirePartnerId()).toBe('gamyaa')
    expect(scopedId('dev1', '2026-10-22')).toBe('gamyaa_dev1_2026-10-22')
  })

  it('single reads from another Partner resolve to null (/project/123 → not found)', () => {
    setActivePartnerId('gamyaa')
    expect(inActivePartner({ partnerId: 'gamyaa', id: 'p1' })).toEqual({ partnerId: 'gamyaa', id: 'p1' })
    expect(inActivePartner({ partnerId: 'uflight', id: 'p2' })).toBeNull()
    expect(inActivePartner({ id: 'legacy' })).toBeNull()
    expect(inActivePartner(null)).toBeNull()
  })

  it('notifies listeners when the Partner changes (data is cleared and reloaded)', () => {
    const seen: Array<string | null> = []
    const off = onActivePartnerChange(p => seen.push(p))
    setActivePartnerId('gamyaa')
    setActivePartnerId('gamyaa')   // no duplicate event
    setActivePartnerId('uflight')
    setActivePartnerId(null)
    off()
    setActivePartnerId('ev-engineer')
    expect(seen).toEqual(['gamyaa', 'uflight', null])
  })
})
