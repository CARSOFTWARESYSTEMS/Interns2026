import { describe, it, expect } from 'vitest'
import { brandingFor, safeUrl, safeEmail, escapeHtml } from './branding'
import { paletteFor, parseHex } from './theme'
import seed from './partners.seed.json'
import type { Partner } from '../types/partner'

const partner = (id: string) => seed.partners.find(p => p.id === id) as unknown as Partner

describe('Partner branding (spec §30 UI)', () => {
  it.each([
    ['gamyaa', 'GAMYAA™ AeroSystems', 'Aerospace Engineering Intelligence Platform', 'GAMYAA-INT'],
    ['uflight', 'UFlight™', 'Aerospace Intelligence & Cybersecurity Platform', 'UFLIGHT-INT'],
    ['itelematics', 'iTelematics®', 'Engineering Intelligence Platform', 'ITEL-INT'],
    ['ev-engineer', 'EV.ENGINEER™', 'Aerospace Intelligence & Cybersecurity Platform', 'ITEL-EV-INT'],
  ])('%s → its own name, login copy and document prefix', (id, name, subtitle, prefix) => {
    const b = brandingFor(partner(id))
    expect(b.name).toBe(name)
    expect(b.login.title).toBe(name)
    expect(b.login.subtitle).toBe(subtitle)
    expect(b.documentPrefix).toBe(prefix)
    expect(b.footer).toBeTruthy()
    expect(b.location).toBe('Bangalore, India')
  })

  it('never shows combined branding for a single Partner', () => {
    for (const p of seed.partners) {
      const b = brandingFor(p as unknown as Partner)
      expect(`${b.name} ${b.title} ${b.login.title}`).not.toMatch(/UFlight™ \| EV\.ENGINEER™/)
    }
  })

  it('is neutral when no Partner is resolved (no real Partner leaks into gate screens)', () => {
    const b = brandingFor(null)
    expect(b.name).toBe('Engineering Command Center')
    expect(b.contact.email).toBe('')
  })

  it('builds a tel: link from a formatted phone number', () => {
    expect(brandingFor(partner('gamyaa')).contact.phoneHref).toBe('tel:+919108206147')
  })
})

describe('configuration safety', () => {
  it('only allows https or same-origin URLs from Partner config', () => {
    expect(safeUrl('https://cdn.example.com/logo.svg')).toBe('https://cdn.example.com/logo.svg')
    expect(safeUrl('/logos/gamyaa.svg')).toBe('/logos/gamyaa.svg')
    expect(safeUrl('javascript:alert(1)')).toBe('')
    expect(safeUrl('data:image/svg+xml,<svg onload=alert(1)>')).toBe('')
    expect(safeUrl('http://insecure.example.com/logo.png')).toBe('')
    expect(safeUrl('//evil.example.com/x')).toBe('')
  })

  it('validates emails and escapes HTML', () => {
    expect(safeEmail('info@example.com')).toBe('info@example.com')
    expect(safeEmail('x" onmouseover="alert(1)')).toBe('')
    expect(escapeHtml('<b>"A&B"</b>')).toBe('&lt;b&gt;&quot;A&amp;B&quot;&lt;/b&gt;')
  })
})

describe('PartnerTheme palette', () => {
  it('anchors the primary colour at shade 600 and stays light→dark', () => {
    const p = paletteFor('#0d9488')!
    expect(p[600]).toEqual(parseHex('#0d9488'))
    const lum = (c: number[]) => c[0] + c[1] + c[2]
    const order = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const
    for (let i = 1; i < order.length; i++) expect(lum(p[order[i]])).toBeLessThan(lum(p[order[i - 1]]))
  })

  it('rejects malformed colours', () => {
    expect(paletteFor('teal')).toBeNull()
    expect(paletteFor('#12')).toBeNull()
  })
})
