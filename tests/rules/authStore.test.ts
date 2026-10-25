// ════════════════════════════════════════════════════════════════════════════
//  The Firestore AuthStore (server/auth/firestoreStore.ts) against the
//  Firestore emulator, through the Admin SDK — the same code the /api/auth
//  function runs in production. Part of `npm run test:rules`.
// ════════════════════════════════════════════════════════════════════════════

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { deleteApp, initializeApp, type App } from 'firebase-admin/app'
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore'
import { applySignIn, type SignInFacts } from '../../server/auth/activation.js'
import { createFirestoreAuthStore } from '../../server/auth/firestoreStore.js'
import { createAuthHandler } from '../../server/auth/handler.js'
import { DEFAULT_AUTH_POLICY } from '../../server/auth/policy.js'
import type { AuthStore, CodeRecord, Directory, SessionRecord } from '../../server/auth/types.js'

let app: App
let db: Firestore
let store: AuthStore
const run = `t${Date.now()}`
const NOW = Date.UTC(2026, 9, 25, 9, 0, 0)

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Run with the Firestore emulator: npm run test:rules')
  app = initializeApp({ projectId: 'demo-tenant-rules' }, `auth-store-${run}`)
  db = getFirestore(app)
  store = createFirestoreAuthStore(db)
})

afterAll(async () => { if (app) await deleteApp(app) })

function session(over: Partial<SessionRecord> = {}): SessionRecord {
  return {
    kind: 'app', uid: `${run}-u1`, email: 'a@example.com', emailVerified: true, name: 'A',
    providerId: 'uflight', partnerId: 'uflight', host: 'uflight.in',
    createdAt: NOW, lastSeenAt: NOW, expiresAt: NOW + 1000, revokedAt: null, revokeReason: null, centralRef: null, ...over,
  }
}

function code(over: Partial<CodeRecord> = {}): CodeRecord {
  return {
    providerId: 'uflight', partnerId: 'uflight', uid: `${run}-u1`, email: 'a@example.com', emailVerified: true, name: 'A',
    host: 'uflight.in', challenge: 'c', nonce: 'n', centralRef: 'r',
    createdAt: NOW, expiresAt: NOW + 60_000, usedAt: null, sessionId: null, ...over,
  }
}

describe('Firestore AuthStore', () => {
  it('stores sessions with a TTL timestamp and returns them without it', async () => {
    await store.putSession(`${run}-s1`, session())
    expect(await store.getSession(`${run}-s1`)).toEqual(session())
    const raw = (await db.doc(`authSessions/${run}-s1`).get()).data()!
    expect(raw.ttlAt).toBeInstanceOf(Timestamp)
    expect(await store.getSession(`${run}-missing`)).toBeNull()
  })

  it('never overwrites an existing session', async () => {
    await store.putSession(`${run}-s2`, session())
    await expect(store.putSession(`${run}-s2`, session({ uid: 'attacker' }))).rejects.toThrow()
    expect((await store.getSession(`${run}-s2`))!.uid).toBe(`${run}-u1`)
  })

  it('updates and revokes per user', async () => {
    await store.putSession(`${run}-s3`, session({ uid: `${run}-u3` }))
    await store.putSession(`${run}-s4`, session({ uid: `${run}-u3` }))
    await store.putSession(`${run}-s5`, session({ uid: `${run}-u4` }))
    await store.updateSession(`${run}-s3`, { lastSeenAt: NOW + 5 })
    expect((await store.getSession(`${run}-s3`))!.lastSeenAt).toBe(NOW + 5)

    expect((await store.revokeUserSessions(`${run}-u3`, 'admin', NOW + 9)).sort()).toEqual([`${run}-s3`, `${run}-s4`])
    expect(await store.getSession(`${run}-s4`)).toMatchObject({ revokedAt: NOW + 9, revokeReason: 'admin' })
    expect((await store.getSession(`${run}-s5`))!.revokedAt).toBeNull()
    expect(await store.revokeUserSessions(`${run}-u3`, 'admin', NOW + 10)).toEqual([])
  })

  it('lets exactly one of many concurrent redemptions win', async () => {
    await store.putCode(`${run}-c1`, code())
    const results = await Promise.all(Array.from({ length: 6 }, (_, i) => store.updateCode(`${run}-c1`, c => {
      if (!c || c.usedAt !== null) return { next: null, result: 'lost' }
      return { next: { ...c, usedAt: NOW + i, sessionId: `s${i}` }, result: 'won' }
    })))
    expect(results.filter(r => r === 'won')).toHaveLength(1)
    const raw = (await db.doc(`authCodes/${run}-c1`).get()).data()!
    expect(raw.usedAt).not.toBeNull()
    expect(raw.ttlAt).toBeInstanceOf(Timestamp)
  })

  it('counts rate-limit hits per window', async () => {
    const key = `${run}-ip`
    expect(await store.hit(key, 60_000, NOW)).toBe(1)
    expect(await store.hit(key, 60_000, NOW + 1)).toBe(2)
    expect(await Promise.all([store.hit(key, 60_000, NOW + 2), store.hit(key, 60_000, NOW + 3)]).then(r => r.sort())).toEqual([3, 4])
    expect(await store.hit(key, 60_000, NOW + 60_000)).toBe(1)
  })

  it('agrees on exactly one first activation when sign-ins race, and keeps it', async () => {
    const id = `uflight_${run}-a1`
    const facts = (i: number): SignInFacts => ({
      uid: `${run}-a1`, email: 'a@example.com', emailVerified: true, name: 'A', providerId: 'uflight', partnerId: 'uflight',
      loginProvider: 'login.uflight.in', host: 'uflight.in', path: `/page-${i}`, pageLabel: `Page ${i}`,
      trigger: 'header_login', access: 'granted', at: NOW + i,
    })
    const firsts = await Promise.all(Array.from({ length: 5 }, (_, i) => store.updateActivation(id, prev => ({
      next: applySignIn(prev, facts(i), null), result: prev === null,
    }))))
    expect(firsts.filter(Boolean)).toHaveLength(1)
    const saved = (await db.doc(`userActivations/${id}`).get()).data()!
    expect(saved.loginCount).toBe(5)
    expect(saved.recentEvents).toHaveLength(5)
    expect(saved.ttlAt).toBeUndefined()

    const first = saved.firstSourcePath
    await store.updateActivation(id, prev => ({ next: applySignIn(prev, facts(9), null), result: null }))
    const after = (await db.doc(`userActivations/${id}`).get()).data()!
    expect(after.firstSourcePath).toBe(first)
    expect(after.lastSourcePath).toBe('/page-9')
  })

  it('records audit events', async () => {
    await store.recordEvent({
      event: 'logout', result: 'success', reason: 'logout', uid: `${run}-u9`, providerId: 'uflight', partnerId: 'uflight',
      host: 'uflight.in', sessionRef: 'abc', sessionKind: 'app', at: NOW, ip: '203.0.113.1', userAgent: 'test',
    })
    const snap = await db.collection('authEvents').where('uid', '==', `${run}-u9`).get()
    expect(snap.size).toBe(1)
    expect(snap.docs[0].get('ttlAt')).toBeInstanceOf(Timestamp)
  })
})

describe('Sign-in flow on the Firestore store', () => {
  it('signs in, reads the session, and rejects a replayed code', async () => {
    let t = Date.now()
    const uid = `${run}-flow`
    const directory: Directory = {
      verifyIdToken: async () => ({ uid, email: 'flow@example.com', emailVerified: true, name: 'Flow', authTime: t }),
      isUserEnabled: async () => true,
      rolesFor: async () => ['Viewer'],
      accessFor: async () => 'granted',
      profileLocation: async () => ({ country: 'India', stateOrRegion: 'Karnataka', city: 'Mangaluru' }),
    }
    const handle = createAuthHandler({ store, directory, secret: 'emulator-test-secret-0123456789abcdef', policy: DEFAULT_AUTH_POLICY, now: () => t })
    const jars: Record<string, string[]> = {}
    const go = async (url: string, init: RequestInit & { host?: string } = {}) => {
      const u = new URL(url)
      const proxied = u.hostname === 'uflight.in' ? new URL(`https://login.uflight.in/api/auth/app/uflight.in${u.pathname.slice('/api/auth'.length)}${u.search}`) : u
      const headers = new Headers(init.headers)
      headers.set('host', proxied.host)
      if (jars[u.hostname]?.length) headers.set('cookie', jars[u.hostname].join('; '))
      const res = await handle(new Request(proxied, { ...init, headers }))
      for (const c of res.headers.getSetCookie()) {
        const pair = c.split(';')[0]
        const name = pair.split('=')[0]
        jars[u.hostname] = (jars[u.hostname] ?? []).filter(p => !p.startsWith(`${name}=`))
        if (!c.includes('Max-Age=0')) jars[u.hostname].push(pair)
      }
      return res
    }

    const authorize = (await go('https://uflight.in/api/auth/login?return=%2Fdocs%3Fp%3D1&trigger=premium_route_required&label=Docs')).headers.get('location')!
    expect((await go(authorize)).headers.get('location')).toMatch(/^https:\/\/login\.uflight\.in\/sso\?state=/)
    const signIn = await go('https://login.uflight.in/api/auth/session', {
      method: 'POST', headers: { origin: 'https://login.uflight.in', 'content-type': 'application/json' }, body: '{"idToken":"x"}',
    })
    expect(signIn.status).toBe(200)
    const callback = (await go(authorize)).headers.get('location')!
    const txn = jars['uflight.in'].find(p => p.startsWith('__Host-i26_txn='))!
    expect((await go(callback)).headers.get('location')).toBe('https://uflight.in/docs?p=1')

    const me = await (await go('https://uflight.in/api/auth/session')).json()
    expect(me).toEqual({ authenticated: true, user: { id: uid, name: 'Flow', email: 'flow@example.com' }, roles: ['Viewer'], domain: 'uflight.in' })

    // Without this browser's transaction cookie a stolen callback URL is refused before the code is even looked at…
    expect((await go(callback)).status).toBe(400)
    expect((await (await go('https://uflight.in/api/auth/session')).json()).authenticated).toBe(true)

    // …and replayed with it, the code is spent and the session it created is revoked.
    jars['uflight.in'].push(txn)
    const replay = await go(callback)
    expect(replay.status).toBe(400)
    expect(await replay.text()).toContain('Reference: code_used')
    expect(await (await go('https://uflight.in/api/auth/session')).json()).toEqual({ authenticated: false })

    const activation = (await db.doc(`userActivations/uflight_${uid}`).get()).data()!
    expect(activation).toMatchObject({
      uid, partnerId: 'uflight', firstSourceHost: 'uflight.in', firstSourcePath: '/docs', firstSourcePageLabel: 'Docs',
      firstLoginTrigger: 'premium_route_required', firstLoginPromptType: 'required', lastAccess: 'granted',
      country: 'India', stateOrRegion: 'Karnataka', locationSource: 'user_profile',
    })

    const events = await db.collection('authEvents').where('uid', '==', uid).get()
    expect(events.docs.map(d => d.get('event'))).toEqual(expect.arrayContaining([
      'login_success', 'session_created', 'authorization_code_issued', 'authorization_code_exchanged', 'session_revoked',
      'user_activation',
    ]))
  })
})
