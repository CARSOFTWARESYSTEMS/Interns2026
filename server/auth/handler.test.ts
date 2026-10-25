import { describe, it, expect, vi } from 'vitest'
import { createAuthHandler, sessionStatus, STATE_PURPOSE, TXN_PURPOSE, type LoginState } from './handler.js'
import { createMemoryAuthStore } from './memoryStore.js'
import { DEFAULT_AUTH_POLICY, policyFromEnv } from './policy.js'
import { seal, unseal } from './crypto.js'
import { COOKIE } from './cookies.js'
import { providerForAppHost } from '../../src/auth/providers.js'
import type { Directory, SessionRecord } from './types.js'

// ── Harness ────────────────────────────────────────────────────────────────

const SECRET = 'test-secret-for-state-signing-0123456789abcdef'
const START = Date.UTC(2026, 9, 25, 9, 0, 0)
const MIN = 60_000
const HOUR = 60 * MIN

const EV_LOGIN = 'login.autonomous.ev.engineer'
const PAGE = 'https://aerospace.ev.engineer/aerospace/uflight-3d?view=orbit&lang=en#telemetry'

interface TestUser { uid: string; email: string; emailVerified: boolean; name: string; enabled: boolean }

function setup() {
  let t = START
  const store = createMemoryAuthStore()
  const users = new Map<string, TestUser>([
    ['u1', { uid: 'u1', email: 'asha@example.com', emailVerified: true, name: 'Asha Rao', enabled: true }],
    ['u2', { uid: 'u2', email: 'ravi@example.com', emailVerified: true, name: 'Ravi K', enabled: true }],
  ])
  const memberships = new Map<string, { role: string; status: string }>([
    ['ev-engineer_u1', { role: 'Viewer', status: 'Active' }],
    ['gamyaa_u1', { role: 'Admin', status: 'Active' }],
    ['uflight_u1', { role: 'Developer', status: 'Active' }],
  ])
  const directory: Directory = {
    verifyIdToken: vi.fn(async (token: string) => {
      const m = /^idtoken:(\w+):(\d+)$/.exec(token)
      const u = m ? users.get(m[1]) : undefined
      if (!m || !u || !u.enabled) throw Object.assign(new Error('Firebase ID token has invalid signature'), { code: 'auth/argument-error' })
      return { uid: u.uid, email: u.email, emailVerified: u.emailVerified, name: u.name, authTime: Number(m[2]) }
    }),
    isUserEnabled: async uid => users.get(uid)?.enabled ?? false,
    rolesFor: async (u, partnerId) => {
      const m = memberships.get(`${partnerId}_${u.uid}`)
      return m?.status === 'Active' ? [m.role] : []
    },
  }
  const handler = createAuthHandler({ store, directory, secret: SECRET, policy: DEFAULT_AUTH_POLICY, now: () => t })
  return { store, users, memberships, directory, handler, now: () => t, advance: (ms: number) => { t += ms } }
}

type Env = ReturnType<typeof setup>

/** How a request reaches the function: the path itself, or vercel.json's `?__route=` rewrite. */
type Routing = 'path' | 'vercel-route'

interface FetchInit {
  method?: string
  body?: string
  contentType?: string
  accept?: string
  /** Origin header; defaults to the page's own origin on POST. null = omit. */
  origin?: string | null
}

/**
 * A browser with one cookie jar per host. Requests to an application host's
 * /api/auth/<action> are proxied to its login host the way the app's
 * vercel.json rewrite does; cookies stay with the host the browser sees.
 */
class Browser {
  readonly jars = new Map<string, Map<string, string>>()
  readonly setCookies: string[] = []

  constructor(private readonly env: Env, private readonly routing: Routing = 'path', private readonly ip = '203.0.113.7') {}

  jar(host: string): Map<string, string> {
    let jar = this.jars.get(host)
    if (!jar) this.jars.set(host, (jar = new Map()))
    return jar
  }

  async fetch(url: string, init: FetchInit = {}): Promise<Response> {
    const visible = new URL(url)
    const method = init.method ?? 'GET'
    let target = visible
    const app = providerForAppHost(visible.hostname)
    const action = /^\/api\/auth\/([a-z]+)$/.exec(visible.pathname)?.[1]
    if (app && action) target = new URL(`https://${app.loginHost}/api/auth/app/${visible.hostname}/${action}${visible.search}`)
    if (this.routing === 'vercel-route' && target.pathname.startsWith('/api/auth/')) {
      const rewritten = new URL(`https://${target.host}/api/auth${target.search}`)
      rewritten.searchParams.set('__route', target.pathname.slice('/api/auth/'.length))
      target = rewritten
    }

    const headers = new Headers({ host: target.host, 'user-agent': 'vitest-browser', 'x-real-ip': this.ip })
    if (target.host !== visible.host) headers.set('x-forwarded-host', visible.host)
    const jar = this.jar(visible.hostname)
    if (jar.size) headers.set('cookie', [...jar].map(([k, v]) => `${k}=${v}`).join('; '))
    const origin = init.origin === undefined ? (method === 'POST' ? visible.origin : null) : init.origin
    if (origin) headers.set('origin', origin)
    if (init.contentType) headers.set('content-type', init.contentType)
    if (init.accept) headers.set('accept', init.accept)

    const res = await this.env.handler(new Request(target, { method, headers, body: init.body }))
    for (const sc of res.headers.getSetCookie()) {
      this.setCookies.push(sc)
      const [pair, ...attrs] = sc.split(';').map(s => s.trim())
      const eq = pair.indexOf('=')
      const name = pair.slice(0, eq)
      const value = pair.slice(eq + 1)
      if (!value || attrs.includes('Max-Age=0')) jar.delete(name)
      else jar.set(name, value)
    }
    return res
  }
}

const location = (res: Response): string => {
  expect([302, 303], `expected a redirect, got ${res.status}`).toContain(res.status)
  return res.headers.get('location')!
}

function signIn(browser: Browser, env: Env, loginHost = EV_LOGIN, uid = 'u1', authTime = env.now()): Promise<Response> {
  return browser.fetch(`https://${loginHost}/api/auth/session`, {
    method: 'POST', contentType: 'application/json', body: JSON.stringify({ idToken: `idtoken:${uid}:${authTime}` }),
  })
}

function loginUrl(page: string): string {
  const u = new URL(page)
  return `https://${u.host}/api/auth/login?return=${encodeURIComponent(u.pathname + u.search + u.hash)}`
}

/** Click Login on `page` and follow the flow up to (not into) the app's callback. */
async function startLogin(env: Env, browser: Browser, page = PAGE, uid = 'u1'): Promise<{ callback: string; askedToSignIn: boolean; authorize: string }> {
  const authorize = location(await browser.fetch(loginUrl(page)))
  let res = await browser.fetch(authorize)
  let askedToSignIn = false
  if (new URL(location(res)).pathname === '/sso') {
    askedToSignIn = true
    expect((await signIn(browser, env, new URL(authorize).host, uid)).status).toBe(200)
    res = await browser.fetch(authorize)
  }
  return { callback: location(res), askedToSignIn, authorize }
}

/** The full flow: Login click → (sign in) → callback → back on the page. */
async function login(env: Env, browser: Browser, page = PAGE, uid = 'u1') {
  const started = await startLogin(env, browser, page, uid)
  const res = await browser.fetch(started.callback)
  return { ...started, res }
}

async function session(browser: Browser, host: string): Promise<Record<string, unknown>> {
  const res = await browser.fetch(`https://${host}/api/auth/session`)
  expect(res.status).toBe(200)
  return res.json()
}

async function errorOf(res: Response): Promise<string> {
  const type = res.headers.get('content-type') ?? ''
  if (type.includes('json')) return ((await res.json()) as { error: string }).error
  return /Reference: ([a-z_]+)/.exec(await res.text())?.[1] ?? ''
}

function forgeState(env: Env, s: Partial<LoginState> = {}): string {
  return seal(SECRET, STATE_PURPOSE, { h: 'aerospace.ev.engineer', p: '/', n: 'nonce', c: 'x'.repeat(43), t: env.now(), ...s })
}

// ── Flow ───────────────────────────────────────────────────────────────────

describe('sign-in flow', () => {
  it.each<Routing>(['path', 'vercel-route'])('returns to the exact page with its own session (%s routing)', async routing => {
    const env = setup()
    const browser = new Browser(env, routing)
    const { res, authorize, callback, askedToSignIn } = await login(env, browser)

    expect(new URL(authorize).host).toBe(EV_LOGIN)
    expect(new URL(authorize).pathname).toBe('/api/auth/authorize')
    expect(askedToSignIn).toBe(true)
    expect(new URL(callback).origin + new URL(callback).pathname).toBe('https://aerospace.ev.engineer/api/auth/callback')
    expect(location(res)).toBe(PAGE)

    expect(await session(browser, 'aerospace.ev.engineer')).toEqual({
      authenticated: true,
      user: { id: 'u1', name: 'Asha Rao', email: 'asha@example.com' },
      roles: ['Viewer'],
      domain: 'aerospace.ev.engineer',
    })
  })

  it('sends a signed-out visitor to the branded /sso page on the login host', async () => {
    const env = setup()
    const browser = new Browser(env)
    const authorize = location(await browser.fetch(loginUrl(PAGE)))
    const sso = new URL(location(await browser.fetch(authorize)))
    expect(sso.origin).toBe(`https://${EV_LOGIN}`)
    expect(sso.pathname).toBe('/sso')
    expect(sso.searchParams.get('state')).toBe(new URL(authorize).searchParams.get('state'))
  })

  it('preserves query parameters and the hash for every allowed host', async () => {
    const env = setup()
    const browser = new Browser(env)
    for (const host of ['ev.engineer', 'www.ev.engineer', 'autonomous.ev.engineer', 'aerospace.ev.engineer']) {
      const page = `https://${host}/deep/path/?a=1&b=two%20words&c=%2F#section-2`
      expect(location((await login(env, browser, page)).res)).toBe(page)
    }
  })

  it('sets only host-only, HttpOnly, Secure, SameSite=Lax cookies', async () => {
    const env = setup()
    const browser = new Browser(env)
    await login(env, browser)
    expect(browser.setCookies.length).toBeGreaterThan(0)
    for (const c of browser.setCookies) {
      expect(c).toMatch(/^__Host-i26_(central|session|txn)=/)
      expect(c).toContain('; HttpOnly')
      expect(c).toContain('; Secure')
      expect(c).toContain('; SameSite=Lax')
      expect(c).toContain('; Path=/')
      expect(c).not.toMatch(/domain=/i)
    }
  })

  it('gives each host its own session — none is shared, even within a provider', async () => {
    const env = setup()
    const browser = new Browser(env)
    await login(env, browser)
    expect([...browser.jar('aerospace.ev.engineer').keys()]).toEqual([COOKIE.session])
    expect([...browser.jar(EV_LOGIN).keys()]).toEqual([COOKIE.central])
    expect(browser.jar('ev.engineer').size).toBe(0)
    expect(await session(browser, 'ev.engineer')).toEqual({ authenticated: false })

    // A session cookie copied to another host is worthless there.
    browser.jar('ev.engineer').set(COOKIE.session, browser.jar('aerospace.ev.engineer').get(COOKIE.session)!)
    expect(await session(browser, 'ev.engineer')).toEqual({ authenticated: false })
  })

  it('signs in to a second app of the same provider without asking again', async () => {
    const env = setup()
    const browser = new Browser(env)
    await login(env, browser, 'https://www.ev.engineer/ev-engineer')
    expect(env.directory.verifyIdToken).toHaveBeenCalledTimes(1)

    env.advance(2 * HOUR)
    const second = await login(env, browser, PAGE)
    expect(second.askedToSignIn).toBe(false)
    expect(location(second.res)).toBe(PAGE)
    expect(env.directory.verifyIdToken).toHaveBeenCalledTimes(1)
    expect((await session(browser, 'aerospace.ev.engineer')).authenticated).toBe(true)
  })

  it("does not use one provider's central session for another provider", async () => {
    const env = setup()
    const browser = new Browser(env)
    await login(env, browser)
    const { askedToSignIn, authorize } = await startLogin(env, browser, 'https://www.gamyaa.in/')
    expect(new URL(authorize).host).toBe('login.gamyaa.in')
    expect(askedToSignIn).toBe(true)
  })

  it("reports roles from the provider's own Partner, read live from Intern2026", async () => {
    const env = setup()
    const browser = new Browser(env)
    await login(env, browser)
    await login(env, browser, 'https://www.gamyaa.in/dashboard')
    await login(env, browser, 'https://uflight.in/')
    expect((await session(browser, 'aerospace.ev.engineer')).roles).toEqual(['Viewer'])
    expect((await session(browser, 'www.gamyaa.in')).roles).toEqual(['Admin'])
    expect((await session(browser, 'uflight.in')).roles).toEqual(['Developer'])

    env.memberships.set('gamyaa_u1', { role: 'Admin', status: 'Suspended' })
    expect(await session(browser, 'www.gamyaa.in')).toMatchObject({ authenticated: true, roles: [] })
  })

  it('records the audit trail without secrets', async () => {
    const env = setup()
    const browser = new Browser(env)
    const { callback } = await login(env, browser)

    expect(env.store.events.map(e => `${e.event}:${e.result}${e.sessionKind ? `:${e.sessionKind}` : ''}`)).toEqual([
      'login_started:success',
      'login_success:success',
      'session_created:success:central',
      'authorization_code_issued:success:central',
      'authorization_code_exchanged:success',
      'session_created:success:app',
    ])
    for (const e of env.store.events) {
      expect(e).toMatchObject({ providerId: 'ev_engineer', partnerId: 'ev-engineer', at: env.now(), ip: '203.0.113.7', userAgent: 'vitest-browser' })
      expect(e.host).toBeTruthy()
    }

    const secrets = [
      new URL(callback).searchParams.get('code')!,
      browser.jar('aerospace.ev.engineer').get(COOKIE.session)!,
      browser.jar(EV_LOGIN).get(COOKIE.central)!,
    ]
    const stored = JSON.stringify([...env.store.sessions, ...env.store.codes, env.store.events])
    for (const s of secrets) expect(stored).not.toContain(s)
  })
})

// ── Return destinations ────────────────────────────────────────────────────

describe('return destinations', () => {
  it.each([
    'https://evil.example/',
    '//evil.example/',
    '/\\evil.example',
    'javascript:alert(document.cookie)',
    'data:text/html,<script>alert(1)</script>',
    'https://aerospace.ev.engineer.evil.example/',
  ])('refuses to start a sign-in that would return to %j', async ret => {
    const env = setup()
    const browser = new Browser(env)
    const res = await browser.fetch(`https://aerospace.ev.engineer/api/auth/login?return=${encodeURIComponent(ret)}`)
    expect(res.status).toBe(400)
    expect(await errorOf(res)).toBe('invalid_return')
    expect(res.headers.get('location')).toBeNull()
    expect(browser.jar('aerospace.ev.engineer').size).toBe(0)
    expect(env.store.events.at(-1)).toMatchObject({ event: 'login_started', result: 'failure', reason: 'invalid_return' })
  })

  it('returns to / when no page was given', async () => {
    const env = setup()
    const browser = new Browser(env)
    const authorize = location(await browser.fetch('https://uflight.in/api/auth/login'))
    location(await browser.fetch(authorize))
    await signIn(browser, env, 'login.uflight.in')
    const callback = location(await browser.fetch(authorize))
    expect(location(await browser.fetch(callback))).toBe('https://uflight.in/')
  })

  it('cannot be redirected by editing the state', async () => {
    const env = setup()
    const browser = new Browser(env)
    const { callback } = await startLogin(env, browser)
    const url = new URL(callback)
    const [body, sig] = url.searchParams.get('state')!.split('.')
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString())
    payload.p = '//evil.example/'
    url.searchParams.set('state', `${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${sig}`)
    const res = await browser.fetch(url.href)
    expect(res.status).toBe(400)
    expect(await errorOf(res)).toBe('invalid_state')
  })

  it('only issues codes to hosts this login host serves', async () => {
    const env = setup()
    const browser = new Browser(env)
    await signIn(browser, env)
    for (const h of ['evil.example', 'aerospace.gamyaa.in', 'uflight.in']) {
      const res = await browser.fetch(`https://${EV_LOGIN}/api/auth/authorize?state=${encodeURIComponent(forgeState(env, { h }))}`)
      expect(res.status, h).toBe(403)
      expect(await errorOf(res)).toBe('unauthorized_domain')
      expect(res.headers.get('location')).toBeNull()
    }
    expect(env.store.codes.size).toBe(0)
  })
})

// ── Authorization codes ────────────────────────────────────────────────────

describe('authorization codes', () => {
  it('expire after 60 seconds', async () => {
    const env = setup()
    const browser = new Browser(env)
    const { callback } = await startLogin(env, browser)
    env.advance(61_000)
    const res = await browser.fetch(callback)
    expect(res.status).toBe(400)
    expect(await errorOf(res)).toBe('expired_code')
    expect(await session(browser, 'aerospace.ev.engineer')).toEqual({ authenticated: false })
    expect(env.store.events.at(-1)).toMatchObject({ event: 'authorization_code_exchanged', result: 'failure', reason: 'expired_code', uid: 'u1' })
  })

  it('work once; a replay is rejected and revokes the session the first use created', async () => {
    const env = setup()
    const browser = new Browser(env)
    const { callback } = await startLogin(env, browser)
    const txn = browser.jar('aerospace.ev.engineer').get(COOKIE.txn)!
    expect(location(await browser.fetch(callback))).toBe(PAGE)
    expect((await session(browser, 'aerospace.ev.engineer')).authenticated).toBe(true)

    // An attacker holding the URL and the transaction cookie tries again.
    const attacker = new Browser(env, 'path', '198.51.100.9')
    attacker.jar('aerospace.ev.engineer').set(COOKIE.txn, txn)
    const replay = await attacker.fetch(callback)
    expect(replay.status).toBe(400)
    expect(await errorOf(replay)).toBe('code_used')
    expect(attacker.jar('aerospace.ev.engineer').has(COOKIE.session)).toBe(false)

    expect(await session(browser, 'aerospace.ev.engineer')).toEqual({ authenticated: false })
    expect(env.store.events).toContainEqual(expect.objectContaining({ event: 'session_revoked', reason: 'code_replay', uid: 'u1' }))
  })

  it('are bound to the host they were issued for', async () => {
    const env = setup()
    const browser = new Browser(env)
    const { callback } = await startLogin(env, browser) // for aerospace.ev.engineer
    const code = new URL(callback).searchParams.get('code')!

    // A genuine sign-in in progress on www.ev.engineer, redeemed with aerospace's code.
    const other = await startLogin(env, browser, 'https://www.ev.engineer/')
    const url = new URL(other.callback)
    url.searchParams.set('code', code)
    const res = await browser.fetch(url.href)
    expect(res.status).toBe(400)
    expect(await errorOf(res)).toBe('invalid_code')

    // …and the code is now burned for its own host too.
    expect(await errorOf(await browser.fetch(callback))).toBe('code_used')
  })

  it('only work in the browser that started the sign-in (state nonce)', async () => {
    const env = setup()
    const victim = new Browser(env)
    const { callback } = await startLogin(env, victim)

    const attacker = new Browser(env, 'path', '198.51.100.9')
    await attacker.fetch(loginUrl(PAGE)) // has its own, different transaction cookie
    const res = await attacker.fetch(callback)
    expect(res.status).toBe(400)
    expect(await errorOf(res)).toBe('invalid_state')

    const noTxn = new Browser(env)
    expect(await errorOf(await noTxn.fetch(callback))).toBe('invalid_state')
  })

  it('require the PKCE verifier the code was issued for', async () => {
    const env = setup()
    const browser = new Browser(env)
    const { callback } = await startLogin(env, browser)
    const jar = browser.jar('aerospace.ev.engineer')
    const txn = unseal<{ h: string; n: string; v: string; t: number }>(SECRET, TXN_PURPOSE, jar.get(COOKIE.txn))!
    jar.set(COOKIE.txn, seal(SECRET, TXN_PURPOSE, { ...txn, v: 'not-the-verifier' }))
    const res = await browser.fetch(callback)
    expect(await errorOf(res)).toBe('invalid_state')
    expect(await session(browser, 'aerospace.ev.engineer')).toEqual({ authenticated: false })
  })

  it('reject unknown codes', async () => {
    const env = setup()
    const browser = new Browser(env)
    const { callback } = await startLogin(env, browser)
    const url = new URL(callback)
    url.searchParams.set('code', 'made-up-code')
    expect(await errorOf(await browser.fetch(url.href))).toBe('invalid_code')
  })

  it('are only redeemed once even when two redemptions race', async () => {
    const env = setup()
    const browser = new Browser(env)
    const { callback } = await startLogin(env, browser)
    const txn = browser.jar('aerospace.ev.engineer').get(COOKIE.txn)!
    const twin = new Browser(env)
    twin.jar('aerospace.ev.engineer').set(COOKIE.txn, txn)
    const results = await Promise.all([browser.fetch(callback), twin.fetch(callback)])
    expect(results.map(r => r.status).sort()).toEqual([302, 400])
  })
})

// ── State ──────────────────────────────────────────────────────────────────

describe('state', () => {
  it('rejects altered, foreign-key and wrong-purpose tokens', async () => {
    const env = setup()
    const browser = new Browser(env)
    const good = forgeState(env)
    const [body, sig] = good.split('.')
    const tampered = `${Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url').toString()), h: 'ev.engineer' })).toString('base64url')}.${sig}`
    const otherKey = seal('another-secret-that-is-long-enough-000000', STATE_PURPOSE, { h: 'aerospace.ev.engineer', p: '/', n: 'n', c: 'c', t: env.now() })
    const wrongPurpose = seal(SECRET, TXN_PURPOSE, { h: 'aerospace.ev.engineer', p: '/', n: 'n', c: 'c', t: env.now() })
    for (const state of [tampered, otherKey, wrongPurpose, 'garbage', '']) {
      const res = await browser.fetch(`https://${EV_LOGIN}/api/auth/authorize?state=${encodeURIComponent(state)}`)
      expect(res.status).toBe(400)
      expect(await errorOf(res)).toBe('invalid_state')
    }
  })

  it('expires a sign-in that takes longer than 10 minutes, with a way to start again', async () => {
    const env = setup()
    const browser = new Browser(env)
    const authorize = location(await browser.fetch(loginUrl(PAGE)))
    env.advance(10 * MIN + 1)
    const res = await browser.fetch(authorize)
    expect(res.status).toBe(400)
    const html = await res.text()
    expect(html).toContain('Reference: expired_login')
    expect(html).toContain(`href="https://aerospace.ev.engineer/api/auth/login?return=${encodeURIComponent('/aerospace/uflight-3d?view=orbit&lang=en#telemetry')}"`)
  })
})

// ── Sessions ───────────────────────────────────────────────────────────────

describe('sessions', () => {
  it('expire after 12 idle hours', async () => {
    const env = setup()
    const browser = new Browser(env)
    await login(env, browser)
    env.advance(12 * HOUR)
    const res = await browser.fetch('https://aerospace.ev.engineer/api/auth/session')
    expect(await res.json()).toEqual({ authenticated: false })
    expect(res.headers.getSetCookie()).toEqual([expect.stringMatching(/^__Host-i26_session=; Max-Age=0/)])
  })

  it('stay alive with use, up to the absolute lifetime', async () => {
    const env = setup()
    const browser = new Browser(env)
    await login(env, browser)
    for (let h = 6; h < 7 * 24; h += 6) {
      env.advance(6 * HOUR)
      expect((await session(browser, 'aerospace.ev.engineer')).authenticated, `after ${h}h`).toBe(true)
    }
    env.advance(6 * HOUR)
    expect(await session(browser, 'aerospace.ev.engineer')).toEqual({ authenticated: false })
    expect(env.store.events.filter(e => e.event === 'session_refreshed').length).toBeGreaterThan(0)
  })

  it('logout invalidates the session server-side and clears the cookie', async () => {
    const env = setup()
    const browser = new Browser(env)
    await login(env, browser)
    const stolen = browser.jar('aerospace.ev.engineer').get(COOKIE.session)!

    const res = await browser.fetch('https://aerospace.ev.engineer/api/auth/logout', { method: 'POST' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ authenticated: false })
    expect(browser.jar('aerospace.ev.engineer').has(COOKIE.session)).toBe(false)

    browser.jar('aerospace.ev.engineer').set(COOKIE.session, stolen)
    expect(await session(browser, 'aerospace.ev.engineer')).toEqual({ authenticated: false })
    expect(env.store.events).toContainEqual(expect.objectContaining({ event: 'logout', uid: 'u1', host: 'aerospace.ev.engineer' }))
  })

  it('logout needs a same-origin request (CSRF)', async () => {
    const env = setup()
    const browser = new Browser(env)
    await login(env, browser)
    for (const origin of ['https://evil.example', 'https://ev.engineer', null]) {
      const res = await browser.fetch('https://aerospace.ev.engineer/api/auth/logout', { method: 'POST', origin })
      expect(res.status, String(origin)).toBe(403)
    }
    expect((await session(browser, 'aerospace.ev.engineer')).authenticated).toBe(true)
  })

  it('form logout returns to a page on the same site', async () => {
    const env = setup()
    const browser = new Browser(env)
    await login(env, browser)
    const form = { method: 'POST', contentType: 'application/x-www-form-urlencoded', body: '' }
    const back = await browser.fetch('https://aerospace.ev.engineer/api/auth/logout?return=%2Faerospace%3Fbye%3D1', form)
    expect(back.status).toBe(303)
    expect(back.headers.get('location')).toBe('https://aerospace.ev.engineer/aerospace?bye=1')
    const evil = await browser.fetch('https://aerospace.ev.engineer/api/auth/logout?return=https%3A%2F%2Fevil.example', form)
    expect(evil.headers.get('location')).toBe('https://aerospace.ev.engineer/')
  })

  it('logging out of an app keeps the central session (no global logout)', async () => {
    const env = setup()
    const browser = new Browser(env)
    await login(env, browser)
    await browser.fetch('https://aerospace.ev.engineer/api/auth/logout', { method: 'POST' })
    expect((await login(env, browser)).askedToSignIn).toBe(false)
  })

  it('logging out of the login host ends single sign-on', async () => {
    const env = setup()
    const browser = new Browser(env)
    await login(env, browser)
    expect((await browser.fetch(`https://${EV_LOGIN}/api/auth/logout`, { method: 'POST' })).status).toBe(200)
    expect((await startLogin(env, browser, 'https://ev.engineer/')).askedToSignIn).toBe(true)
  })

  it('signing in again rotates the session id', async () => {
    const env = setup()
    const browser = new Browser(env)
    await login(env, browser)
    const first = browser.jar('aerospace.ev.engineer').get(COOKIE.session)!
    await login(env, browser)
    const second = browser.jar('aerospace.ev.engineer').get(COOKIE.session)!
    expect(second).not.toBe(first)
    expect(env.store.events).toContainEqual(expect.objectContaining({ event: 'session_revoked', reason: 'rotated', sessionKind: 'app' }))

    browser.jar('aerospace.ev.engineer').set(COOKIE.session, first)
    expect(await session(browser, 'aerospace.ev.engineer')).toEqual({ authenticated: false })
  })

  it('a disabled account loses its central session at the next sign-in', async () => {
    const env = setup()
    const browser = new Browser(env)
    await login(env, browser)
    env.users.get('u1')!.enabled = false
    const authorize = location(await browser.fetch(loginUrl('https://ev.engineer/')))
    const res = await browser.fetch(authorize)
    expect(new URL(location(res)).pathname).toBe('/sso')
    expect(env.store.events).toContainEqual(expect.objectContaining({ event: 'session_revoked', reason: 'account_disabled' }))
    expect((await signIn(browser, env)).status).toBe(401)
  })

  it('central session status is readable on the login host', async () => {
    const env = setup()
    const browser = new Browser(env)
    expect(await session(browser, EV_LOGIN)).toEqual({ authenticated: false })
    await signIn(browser, env)
    expect(await session(browser, EV_LOGIN)).toEqual({
      authenticated: true, user: { id: 'u1', name: 'Asha Rao', email: 'asha@example.com' }, roles: ['Viewer'], domain: EV_LOGIN,
    })
  })

  it('sessionStatus covers every state', () => {
    const base: SessionRecord = {
      kind: 'app', uid: 'u1', email: '', emailVerified: true, name: '', providerId: 'uflight', partnerId: 'uflight', host: 'uflight.in',
      createdAt: START, lastSeenAt: START, expiresAt: START + 10 * HOUR, revokedAt: null, revokeReason: null, centralRef: null,
    }
    const p = DEFAULT_AUTH_POLICY
    expect(sessionStatus(base, START + HOUR, p)).toBe('active')
    expect(sessionStatus({ ...base, revokedAt: START }, START + 1, p)).toBe('revoked')
    expect(sessionStatus(base, START + 10 * HOUR, p)).toBe('expired')
    expect(sessionStatus({ ...base, expiresAt: START + 100 * HOUR }, START + 12 * HOUR, p)).toBe('idle')
  })
})

// ── Central sign-in ────────────────────────────────────────────────────────

describe('central sign-in (POST /api/auth/session on a login host)', () => {
  const post = (browser: Browser, init: Partial<FetchInit> = {}) => browser.fetch(`https://${EV_LOGIN}/api/auth/session`, {
    method: 'POST', contentType: 'application/json', body: JSON.stringify({ idToken: 'idtoken:u1:' + START }), ...init,
  })

  it('only accepts requests from the login page itself', async () => {
    const env = setup()
    const browser = new Browser(env)
    for (const origin of ['https://evil.example', 'https://aerospace.ev.engineer', 'http://login.autonomous.ev.engineer', null]) {
      const res = await post(browser, { origin })
      expect(res.status, String(origin)).toBe(403)
    }
    expect(browser.jar(EV_LOGIN).size).toBe(0)
  })

  it('needs a JSON body with an ID token', async () => {
    const env = setup()
    const browser = new Browser(env)
    expect((await post(browser, { contentType: 'application/x-www-form-urlencoded', body: 'idToken=x' })).status).toBe(400)
    expect((await post(browser, { body: '{}' })).status).toBe(400)
    expect((await post(browser, { body: 'not json' })).status).toBe(400)
  })

  it('rejects an invalid ID token and logs the failure', async () => {
    const env = setup()
    const browser = new Browser(env)
    const res = await post(browser, { body: JSON.stringify({ idToken: 'forged' }) })
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'invalid_credentials' })
    expect(env.store.events).toEqual([expect.objectContaining({ event: 'login_failed', reason: 'invalid_credentials', uid: null })])
  })

  it('asks for a fresh sign-in when the Firebase sign-in is older than 5 minutes', async () => {
    const env = setup()
    const browser = new Browser(env)
    env.advance(5 * MIN + 1)
    const res = await post(browser)
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'stale_sign_in' })
    expect(env.store.events.at(-1)).toMatchObject({ event: 'login_failed', reason: 'stale_sign_in', uid: 'u1' })
  })

  it('is rate limited per client', async () => {
    const env = setup()
    const browser = new Browser(env)
    for (let i = 0; i < 10; i++) expect((await post(browser)).status).toBe(200)
    const limited = await post(browser)
    expect(limited.status).toBe(429)
    expect(limited.headers.get('retry-after')).toBe('60')
    expect((await post(new Browser(env, 'path', '198.51.100.1'))).status).toBe(200)
    env.advance(MIN)
    expect((await post(browser)).status).toBe(200)
  })

  it('rotates the central session on every sign-in', async () => {
    const env = setup()
    const browser = new Browser(env)
    await post(browser)
    const first = browser.jar(EV_LOGIN).get(COOKIE.central)
    await post(browser)
    expect(browser.jar(EV_LOGIN).get(COOKIE.central)).not.toBe(first)
    expect(env.store.events).toContainEqual(expect.objectContaining({ event: 'session_revoked', reason: 'rotated', sessionKind: 'central' }))
  })
})

// ── Routing and responses ──────────────────────────────────────────────────

describe('routing and responses', () => {
  it('serves login-host endpoints only on configured login hosts', async () => {
    const env = setup()
    for (const host of ['interns2026.vercel.app', 'ev2027.web.app', 'evil.example']) {
      const res = await env.handler(new Request(`https://${host}/api/auth/authorize?state=x`, { headers: { host, accept: 'text/html' } }))
      expect(res.status, host).toBe(404)
    }
  })

  it('refuses application routes for hosts that are not configured', async () => {
    const env = setup()
    const res = await env.handler(new Request(`https://${EV_LOGIN}/api/auth/app/evil.example/login`, { headers: { host: EV_LOGIN } }))
    expect(res.status).toBe(403)
    expect(await errorOf(res)).toBe('unauthorized_domain')
  })

  it('works when mounted natively on an application host', async () => {
    const env = setup()
    const res = await env.handler(new Request('https://uflight.in/api/auth/login?return=%2Fx', { headers: { host: 'uflight.in' } }))
    expect(new URL(location(res)).host).toBe('login.uflight.in')
  })

  it('answers wrong methods and unknown routes', async () => {
    const env = setup()
    const browser = new Browser(env)
    expect((await browser.fetch('https://uflight.in/api/auth/logout')).status).toBe(405)
    expect((await browser.fetch('https://uflight.in/api/auth/callback', { method: 'POST' })).status).toBe(405)
    expect((await browser.fetch(`https://${EV_LOGIN}/api/auth/nope`)).status).toBe(404)
  })

  it('marks every response uncacheable and referrer-free', async () => {
    const env = setup()
    const browser = new Browser(env)
    const responses = [
      await browser.fetch(loginUrl(PAGE)),
      await browser.fetch('https://uflight.in/api/auth/session'),
      await browser.fetch(`https://${EV_LOGIN}/api/auth/authorize?state=bad`),
    ]
    for (const r of responses) {
      expect(r.headers.get('cache-control')).toBe('no-store')
      expect(r.headers.get('referrer-policy')).toBe('no-referrer')
    }
  })

  it('never exposes internal errors', async () => {
    const env = setup()
    env.store.getSession = async () => { throw new Error('boom: firestore stack trace at /var/task/x.js') }
    const browser = new Browser(env)
    await login(env, browser).catch(() => {})
    browser.jar('uflight.in').set(COOKIE.session, 'abc')
    const res = await browser.fetch('https://uflight.in/api/auth/session')
    expect(res.status).toBe(503)
    const body = await res.text()
    expect(body).toBe('{"error":"unavailable"}')
    expect(body).not.toContain('boom')
  })

  it('escapes the error page', async () => {
    const env = setup()
    const res = await env.handler(new Request(`https://${EV_LOGIN}/api/auth/authorize?state=%3Cscript%3E`, { headers: { host: EV_LOGIN } }))
    const html = await res.text()
    expect(html).not.toContain('<script')
    expect(res.headers.get('content-security-policy')).toContain("default-src 'none'")
  })

  it('refuses a short signing secret', () => {
    const env = setup()
    expect(() => createAuthHandler({ store: env.store, directory: env.directory, secret: 'short', policy: DEFAULT_AUTH_POLICY })).toThrow()
  })
})

describe('policyFromEnv', () => {
  it('defaults to 12 idle hours and 7 days absolute', () => {
    const p = policyFromEnv({})
    expect(p.idleTimeoutMs).toBe(12 * HOUR)
    expect(p.absoluteLifetimeMs).toBe(7 * 24 * HOUR)
    expect(p.codeTtlMs).toBe(60_000)
  })

  it('accepts overrides within bounds', () => {
    expect(policyFromEnv({ AUTH_SESSION_IDLE_HOURS: '8', AUTH_SESSION_MAX_HOURS: '24' })).toMatchObject({ idleTimeoutMs: 8 * HOUR, absoluteLifetimeMs: 24 * HOUR })
    expect(policyFromEnv({ AUTH_SESSION_IDLE_HOURS: '1000', AUTH_SESSION_MAX_HOURS: '0' })).toMatchObject({ idleTimeoutMs: 24 * HOUR, absoluteLifetimeMs: 24 * HOUR })
    expect(policyFromEnv({ AUTH_SESSION_IDLE_HOURS: 'abc' }).idleTimeoutMs).toBe(12 * HOUR)
  })
})
