import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  NEUTRAL_SOCIAL_META, OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH, SOCIAL_META_END, SOCIAL_META_START,
  partnerAssetDir, renderSocialMeta, socialMetaFor, withSocialMeta,
} from './socialMeta'
import seed from './partners.seed.json'
import type { Partner } from '../types/partner'

const repoFile = (path: string) => new URL(`../../${path}`, import.meta.url)
const indexHtml = readFileSync(repoFile('index.html'), 'utf8')
const partners = seed.partners as unknown as Partner[]
const partner = (id: string) => partners.find(p => p.id === id)!
const htmlFor = (p: Partner) => withSocialMeta(indexHtml, renderSocialMeta(socialMetaFor(p)))
const tag = (html: string, attr: string, key: string) =>
  new RegExp(`<meta ${attr}="${key.replace(/[.:]/g, '\\$&')}" content="([^"]*)"`).exec(html)?.[1]

/** Width and height from a PNG's IHDR chunk. */
function pngSize(path: string): [number, number] {
  const buf = readFileSync(repoFile(path))
  expect(buf.subarray(1, 4).toString('ascii')).toBe('PNG')
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)]
}

describe('link-preview metadata per login domain', () => {
  it.each([
    ['itelematics', 'login.itelematics.com', 'iTelematics® · Engineering Command Center', 'Engineering Intelligence Platform'],
    ['gamyaa', 'login.gamyaa.in', 'GAMYAA™ AeroSystems · Engineering Command Center', 'Aerospace Engineering Intelligence Platform'],
    ['uflight', 'login.uflight.in', 'UFlight™ · Engineering Command Center', 'Aerospace Intelligence & Cybersecurity Platform'],
    ['ev-engineer', 'login.autonomous.ev.engineer', 'EV.ENGINEER™ · Engineering Command Center', 'Aerospace Intelligence & Cybersecurity Platform'],
  ])('%s → its own title, description, image and canonical URL on %s', (id, host, title, subtitle) => {
    const html = htmlFor(partner(id))
    expect(html).toContain(`<title>${title.replace('&', '&amp;')}</title>`)
    expect(tag(html, 'property', 'og:title')).toBe(title.replace('&', '&amp;'))
    expect(tag(html, 'name', 'twitter:title')).toBe(title.replace('&', '&amp;'))
    expect(tag(html, 'property', 'og:description')).toContain(subtitle.replace('&', '&amp;'))
    expect(tag(html, 'name', 'description')).toBe(tag(html, 'property', 'og:description'))
    expect(tag(html, 'property', 'og:url')).toBe(`https://${host}/`)
    expect(html).toContain(`<link rel="canonical" href="https://${host}/" />`)
    expect(tag(html, 'property', 'og:image')).toBe(`https://${host}/partners/${id}/og-image.png`)
    expect(tag(html, 'name', 'twitter:image')).toBe(tag(html, 'property', 'og:image'))
    expect(html).toContain(`<link rel="icon" sizes="96x96" href="/partners/${id}/icon-96.png" />`)
  })

  it('never names another Partner in a Partner page', () => {
    for (const p of partners) {
      const head = htmlFor(p).split('</head>')[0]
      for (const other of partners.filter(o => o.id !== p.id)) {
        expect(head).not.toContain(other.displayName)
        expect(head).not.toContain(other.defaultDomain)
      }
    }
  })

  it('ships every image a Partner page points at, at the size it declares', () => {
    for (const p of partners) {
      const dir = `public${partnerAssetDir(p.id)}`
      expect(pngSize(`${dir}/og-image.png`)).toEqual([OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT])
      expect(pngSize(`${dir}/icon-96.png`)).toEqual([96, 96])
      expect(pngSize(`${dir}/apple-touch-icon.png`)).toEqual([180, 180])
    }
    expect(pngSize('public/og-image.png')).toEqual([OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT])
  })

  it('escapes Partner copy', () => {
    const p = { ...partner('gamyaa'), displayName: 'A "B" <C>', login: { ...partner('gamyaa').login, subtitle: '<script>' } }
    const html = renderSocialMeta(socialMetaFor({ ...p, platform: { ...p.platform, title: '' } }))
    expect(html).not.toMatch(/<script|"B"|<C>/)
    expect(html).toContain('A &quot;B&quot; &lt;C&gt;')
  })
})

describe('index.html (neutral, unknown hosts)', () => {
  it('holds exactly the neutral tags between the markers', () => {
    expect(withSocialMeta(indexHtml, renderSocialMeta(NEUTRAL_SOCIAL_META))).toBe(indexHtml)
  })

  it('names no Partner', () => {
    const head = indexHtml.split('</head>')[0]
    for (const p of partners) expect(head).not.toContain(p.displayName)
  })

  it('refuses HTML without exactly one marker block', () => {
    expect(() => withSocialMeta('<head></head>', '')).toThrow(/social-meta/)
    const twice = indexHtml.replace(SOCIAL_META_END, `${SOCIAL_META_END}\n${SOCIAL_META_START}\n${SOCIAL_META_END}`)
    expect(() => withSocialMeta(twice, '')).toThrow(/social-meta/)
  })
})
