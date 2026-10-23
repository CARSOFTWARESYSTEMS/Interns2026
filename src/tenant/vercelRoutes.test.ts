import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { partnerAssetDir, partnerHtmlFile } from './socialMeta'
import seed from './partners.seed.json'
import vercel from '../../vercel.json'
import viteConfig from '../../vite.config'

interface Route { src: string; dest: string; has?: Array<{ type: string; value: { eq: string } }> }
const routes = vercel.routes as Route[]
const partnerIds = seed.partners.map(p => p.id)

// A deployment's files, by kind (names as Vite and public/ produce them).
const PAGES = ['/index.html', ...partnerIds.map(id => `/${partnerHtmlFile(id)}`)]
const ASSETS = [
  '/assets/index-Ab12Cd34.js', '/assets/index-Ab12Cd34.css', '/og-image.png', '/fonts/Inter-Bold.ttf',
  ...partnerIds.flatMap(id => ['og-image.png', 'icon-96.png', 'apple-touch-icon.png'].map(f => `${partnerAssetDir(id)}/${f}`)),
]
const FILES = new Set([...PAGES, ...ASSETS])

/**
 * The file Vercel serves for a request: `routes` in order (they run before
 * the filesystem; `has` host must match exactly), then the filesystem, else 404.
 */
function served(host: string, url: string): string | 404 {
  let path = new URL(url, 'https://example.test').pathname
  const route = routes.find(r =>
    new RegExp(r.src).test(path) && (r.has ?? []).every(h => h.type === 'host' && h.value.eq === host))
  if (route) path = route.dest
  if (path.endsWith('/')) path += 'index.html'
  return FILES.has(path) ? path : 404
}

const DEEP_LINKS = ['/', '/index.html', '/offer', '/people/my-offer', '/admin/users', '/join?token=x', '/login', '/people/']
const OTHER_HOSTS = ['ev2027.web.app', 'ev2027.firebaseapp.com', 'interns2026.vercel.app', 'unknown.example.com']

/** Every path declared in App.tsx, with params and splats filled in. */
const appPaths = [...readFileSync(new URL('../App.tsx', import.meta.url), 'utf8').matchAll(/\bpath="([^"]+)"/g)]
  .map(m => `/${m[1].replace(/^\//, '')}`.replace(/:\w+/g, 'WP-001-S1').replace('*', 'no/such/page'))

describe('vercel.json: every page route serves the app', () => {
  it.each(seed.domains.map(d => [d.hostname, d.partnerId]))('%s → its Partner page on deep links', (host, partnerId) => {
    for (const url of DEEP_LINKS) expect(served(host, url), url).toBe(`/${partnerHtmlFile(partnerId)}`)
  })

  it.each(OTHER_HOSTS)('%s → the neutral page on deep links', host => {
    for (const url of DEEP_LINKS) expect(served(host, url), url).toBe('/index.html')
  })

  it('covers every route declared in App.tsx', () => {
    expect(appPaths).toContain('/offer')
    expect(appPaths).toContain('/people/my-offer')
    for (const path of appPaths) {
      expect(served('login.gamyaa.in', path), path).toBe('/index.gamyaa.html')
      expect(served('ev2027.web.app', path), path).toBe('/index.html')
    }
  })
})

describe('vercel.json: files are served as they are', () => {
  it.each([...seed.domains.map(d => d.hostname), ...OTHER_HOSTS])('%s', host => {
    for (const file of ASSETS) expect(served(host, file), file).toBe(file)
    for (const page of PAGES.filter(p => p !== '/index.html')) expect(served(host, page), page).toBe(page)
  })

  it('answers a missing file with 404, not the app page', () => {
    for (const url of ['/assets/index-OldHash1.js', '/partners/gamyaa/missing.png', '/favicon.ico', '/robots.txt']) {
      expect(served('login.gamyaa.in', url), url).toBe(404)
      expect(served('ev2027.web.app', url), url).toBe(404)
    }
  })
})

describe('vercel.json: route table', () => {
  it.each(seed.domains.map(d => [d.hostname, d.partnerId]))('%s has exactly one route, to index.%s.html', (host, partnerId) => {
    const matching = routes.filter(r => r.has?.some(h => h.type === 'host' && h.value.eq === host))
    expect(matching).toHaveLength(1)
    expect(matching[0].dest).toBe(`/${partnerHtmlFile(partnerId)}`)
  })

  it('ends with the neutral fallback, after every host route', () => {
    expect(routes).toHaveLength(seed.domains.length + 1)
    expect(routes.at(-1)).toEqual({ src: routes[0].src, dest: '/index.html' })
    for (const r of routes) expect(r.src).toBe(routes[0].src)
  })
})

describe('vite build', () => {
  it('uses an absolute base so nested routes load /assets/…', () => {
    expect(viteConfig).toMatchObject({ base: '/' })
  })
})
