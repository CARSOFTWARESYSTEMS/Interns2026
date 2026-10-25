// ── Multi-domain sign-in: one handler for login hosts and application hosts ──
//
//   app host                       login host                      app host
//   GET /api/auth/login ─────────▶ GET /api/auth/authorize ──────▶ GET /api/auth/callback
//   (state + PKCE; txn cookie)     central session? issue code      (redeem code; own session)
//                                  else → /sso (Google sign-in,
//                                  POST /api/auth/session) → back
//
// Routes (`__route` from vercel.json, or the path after /api/auth/):
//   Login host (Host header is a configured loginHost)
//     GET  authorize   — issue a one-time code for a signed state, or send to /sso
//     POST session     — Firebase ID token → central session (HttpOnly cookie)
//     GET  session     — central session status
//     POST logout      — end the central session
//   Application host: `app/<host>/<action>` (rewrite from the app's project), or
//   `<action>` with the app host in the Host header (handler mounted natively)
//     GET  login       — start sign-in; ?return=<same-host path>[&trigger=…&label=…]
//     GET  callback    — redeem the code, create this host's session, return
//     GET  session     — { authenticated, user, roles, domain }
//     POST logout      — end this host's session
//
// The browser never sees a token it could reuse elsewhere: the code is
// single-use, expires in seconds, is bound to one host, to the state nonce
// and to a PKCE verifier held in that host's HttpOnly cookie; sessions are
// opaque random ids whose SHA-256 is the only thing stored.
//
// Every completed sign-in also updates the user's activation record for the
// Partner (userActivations/{partnerId}_{uid}): first activation kept once,
// latest sign-in, coarse location, recent events. Best effort — a failure
// there is logged and never blocks the sign-in.

import { parseLoginTrigger, sanitizePageLabel, type LoginTrigger } from '../../src/auth/loginContext.js'
import { isAllowedAppHost, providerForAppHost, providerForLoginHost, type AuthProvider } from '../../src/auth/providers.js'
import { returnUrl, sanitizeReturnPath } from '../../src/auth/returnPath.js'
import type { CoarseLocation } from '../../src/types/activation.js'
import { normalizeHostname } from '../../src/tenant/hostname.js'
import { activationId, applySignIn, applySignOut } from './activation.js'
import { COOKIE, clearCookie, readCookie, setCookie } from './cookies.js'
import { pkceChallenge, randomToken, safeEqual, seal, sha256, unseal } from './crypto.js'
import { errorInfo, renderErrorPage, type AuthErrorCode, type ErrorAction } from './errors.js'
import { locationFromHeaders, resolveLocation } from './location.js'
import type { AuthPolicy } from './policy.js'
import type {
  AuthEvent, AuthStore, CodeRecord, Directory, SessionKind, SessionRecord, VerifiedSignIn,
} from './types.js'

export interface AuthDeps {
  store: AuthStore
  directory: Directory
  /** HMAC key for state and transaction tokens (32+ characters). */
  secret: string
  policy: AuthPolicy
  now?: () => number
}

/**
 * Signed state carried through the login host: origin host, return path,
 * nonce, timestamp (+ PKCE challenge), and why the sign-in started: trigger
 * and page label (absent on states minted before they existed).
 */
export interface LoginState {
  h: string
  p: string
  n: string
  c: string
  t: number
  g?: string
  l?: string
}

/** The application host's own record of a sign-in in progress (HttpOnly cookie). */
interface LoginTxn {
  h: string
  n: string
  v: string
  t: number
}

export const STATE_PURPOSE = 'i26.state'
export const TXN_PURPOSE = 'i26.txn'

export type SessionStatus = 'active' | 'revoked' | 'expired' | 'idle'

export function sessionStatus(rec: SessionRecord, at: number, policy: AuthPolicy): SessionStatus {
  if (rec.revokedAt !== null) return 'revoked'
  if (at >= rec.expiresAt) return 'expired'
  if (at - rec.lastSeenAt >= policy.idleTimeoutMs) return 'idle'
  return 'active'
}

/** Short, non-secret handle for logs: a prefix of the storage id (which is already a hash). */
export function sessionRef(id: string): string {
  return id.slice(0, 12)
}

// ── Requests and responses ─────────────────────────────────────────────────

type Context =
  | { ok: true; side: 'login' | 'app'; provider: AuthProvider; host: string; action: string }
  | { ok: false; error: AuthErrorCode }

function resolveContext(req: Request): Context {
  const url = new URL(req.url)
  const route = url.searchParams.get('__route') ?? url.pathname.replace(/^\/api\/auth\/?/, '')
  const parts = route.split('/').filter(Boolean)

  if (parts.length === 3 && parts[0] === 'app') {
    const host = normalizeHostname(parts[1])
    const provider = providerForAppHost(host)
    return host && provider
      ? { ok: true, side: 'app', provider, host, action: parts[2] }
      : { ok: false, error: 'unauthorized_domain' }
  }
  if (parts.length !== 1) return { ok: false, error: 'not_found' }

  const host = normalizeHostname(req.headers.get('host'))
  const login = providerForLoginHost(host)
  if (host && login) return { ok: true, side: 'login', provider: login, host, action: parts[0] }
  const app = providerForAppHost(host)
  if (host && app) return { ok: true, side: 'app', provider: app, host, action: parts[0] }
  return { ok: false, error: 'not_found' }
}

const SECURITY_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store',
  Pragma: 'no-cache',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
}

const ERROR_PAGE_CSP = "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"

function respond(status: number, body: string | null, contentType: string | null, cookies: string[], extra: Record<string, string> = {}): Response {
  const headers = new Headers(SECURITY_HEADERS)
  if (contentType) headers.set('Content-Type', contentType)
  for (const [k, v] of Object.entries(extra)) headers.set(k, v)
  for (const c of cookies) headers.append('Set-Cookie', c)
  return new Response(body, { status, headers })
}

function redirect(location: string, cookies: string[] = [], status = 302): Response {
  return respond(status, null, null, cookies, { Location: location })
}

function json(body: unknown, status = 200, cookies: string[] = []): Response {
  return respond(status, JSON.stringify(body), 'application/json; charset=utf-8', cookies)
}

interface FailOptions {
  html: boolean
  action?: ErrorAction | null
  cookies?: string[]
}

export function fail(code: AuthErrorCode, { html, action = null, cookies = [] }: FailOptions): Response {
  const { status } = errorInfo(code)
  const extra: Record<string, string> = code === 'rate_limited' ? { 'Retry-After': '60' } : {}
  if (html) {
    return respond(status, renderErrorPage(code, action), 'text/html; charset=utf-8', cookies,
      { ...extra, 'Content-Security-Policy': ERROR_PAGE_CSP })
  }
  return respond(status, JSON.stringify({ error: code }), 'application/json; charset=utf-8', cookies, extra)
}

export function wantsHtml(req: Request): boolean {
  return (req.headers.get('accept') ?? '').includes('text/html')
}

/** CSRF guard for state-changing POSTs: the browser's Origin must be this exact https host. */
function sameOrigin(req: Request, host: string): boolean {
  return req.headers.get('origin') === `https://${host}`
}

function isFormPost(req: Request): boolean {
  const type = (req.headers.get('content-type') ?? '').toLowerCase()
  return type.startsWith('application/x-www-form-urlencoded') || type.startsWith('multipart/form-data') || wantsHtml(req)
}

async function readJson(req: Request, maxBytes: number): Promise<Record<string, unknown> | null> {
  if (Number(req.headers.get('content-length') ?? 0) > maxBytes) return null
  const text = await req.text()
  if (text.length > maxBytes) return null
  try {
    const value: unknown = JSON.parse(text)
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function clientMeta(req: Request): { ip: string | null; userAgent: string | null } {
  const ip = req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  return { ip: ip || null, userAgent: req.headers.get('user-agent')?.slice(0, 256) ?? null }
}

/** Logs an error by kind only: never a request, header, body, token or code. */
function logError(where: string, err: unknown): void {
  const e = err as { code?: unknown; name?: unknown; message?: unknown }
  console.error(`[auth] ${where}`, { code: e?.code ?? e?.name ?? 'unknown', message: String(e?.message ?? '').slice(0, 200) })
}

function homeAction(host: string): ErrorAction {
  return { label: `Go to ${host}`, href: `https://${host}/` }
}

/** Restart sign-in at the app, returning to the same page with the same trigger (state is already verified). */
function signInAgainAction(state: LoginState): ErrorAction {
  const path = sanitizeReturnPath(state.p, state.h) ?? '/'
  const context = new URLSearchParams({ return: path, trigger: parseLoginTrigger(state.g) })
  const label = sanitizePageLabel(state.l)
  if (label) context.set('label', label)
  return { label: 'Sign in again', href: `https://${state.h}/api/auth/login?${context}` }
}

/** The dashboard's own sign-in, recorded as an activation on the login host. */
const WORKSPACE_LABEL = 'Engineering Command Center'

// ── Handler ────────────────────────────────────────────────────────────────

export function createAuthHandler(deps: AuthDeps): (req: Request) => Promise<Response> {
  const { store, directory, secret, policy } = deps
  const now = deps.now ?? Date.now

  if (typeof secret !== 'string' || secret.length < 32) throw new Error('Auth secret must be at least 32 characters')

  interface Loaded { id: string; rec: SessionRecord }

  function readState(token: string | null): LoginState | null {
    const s = unseal<LoginState>(secret, STATE_PURPOSE, token)
    if (!s || typeof s.p !== 'string' || typeof s.n !== 'string' || typeof s.c !== 'string' || typeof s.t !== 'number') return null
    const h = normalizeHostname(s.h)
    return h && h === s.h ? s : null
  }

  async function loadSession(req: Request, kind: SessionKind, host: string): Promise<{ present: boolean; session: Loaded | null }> {
    const token = readCookie(req, kind === 'central' ? COOKIE.central : COOKIE.session)
    if (!token) return { present: false, session: null }
    if (token.length > 128) return { present: true, session: null }
    const id = sha256(token)
    const rec = await store.getSession(id)
    if (!rec || rec.kind !== kind || rec.host !== host || sessionStatus(rec, now(), policy) !== 'active') {
      return { present: true, session: null }
    }
    return { present: true, session: { id, rec } }
  }

  function newSession(): { token: string; id: string } {
    const token = randomToken()
    return { token, id: sha256(token) }
  }

  function sessionRecord(kind: SessionKind, who: Omit<VerifiedSignIn, 'authTime'>, provider: AuthProvider, host: string, centralRef: string | null): SessionRecord {
    const t = now()
    return {
      kind,
      uid: who.uid, email: who.email, emailVerified: who.emailVerified, name: who.name,
      providerId: provider.id, partnerId: provider.partnerId, host,
      createdAt: t, lastSeenAt: t, expiresAt: t + policy.absoluteLifetimeMs,
      revokedAt: null, revokeReason: null, centralRef,
    }
  }

  return async function handle(req: Request): Promise<Response> {
    const ctx = resolveContext(req)
    if (!ctx.ok) return fail(ctx.error, { html: wantsHtml(req) })
    const { provider, host, action } = ctx
    const meta = clientMeta(req)

    function audit(e: Partial<AuthEvent> & Pick<AuthEvent, 'event' | 'result'>): Promise<void> {
      const event: AuthEvent = {
        reason: null, uid: null, sessionRef: null, sessionKind: null,
        providerId: provider.id, partnerId: provider.partnerId, host,
        ...e, at: now(), ip: meta.ip, userAgent: meta.userAgent,
      }
      return store.recordEvent(event).catch(err => logError('audit write failed', err))
    }

    function aboutSession(s: Loaded): Partial<AuthEvent> {
      return { uid: s.rec.uid, host: s.rec.host, sessionRef: sessionRef(s.id), sessionKind: s.rec.kind }
    }

    async function limited(bucket: keyof AuthPolicy['rateLimits']): Promise<boolean> {
      const { limit, windowMs } = policy.rateLimits[bucket]
      return (await store.hit(`${bucket}:${meta.ip ?? 'unknown'}`, windowMs, now())) > limit
    }

    async function revoke(s: Loaded, reason: string, event: 'session_revoked' | 'logout'): Promise<void> {
      await store.updateSession(s.id, { revokedAt: now(), revokeReason: reason })
      await audit({ event, result: 'success', reason, ...aboutSession(s) })
    }

    /**
     * Records a completed sign-in on the user's activation record for this
     * Partner. Never throws: the user is signed in either way.
     */
    async function recordSignIn(
      who: { uid: string; email: string; emailVerified: boolean; name: string },
      where: { host: string; path: string; pageLabel: string; trigger: LoginTrigger },
      approximate: CoarseLocation | null,
    ): Promise<void> {
      try {
        const [access, profile] = await Promise.all([
          directory.accessFor(who, provider.partnerId),
          directory.profileLocation(who.uid).catch(err => {
            logError('profile location read failed', err)
            return null
          }),
        ])
        // Named fields only: `who` may be a code record, whose nonce and challenge stay out of it.
        const facts = {
          uid: who.uid, email: who.email, emailVerified: who.emailVerified, name: who.name,
          ...where, access, at: now(),
          providerId: provider.id, partnerId: provider.partnerId, loginProvider: provider.loginHost,
        }
        const location = resolveLocation(profile, approximate)
        const first = await store.updateActivation(activationId(provider.partnerId, who.uid), prev => ({
          next: applySignIn(prev, facts, location),
          result: prev === null,
        }))
        if (first) await audit({ event: 'user_activation', result: 'success', uid: who.uid, host: where.host })
      } catch (err) {
        logError('activation record failed', err)
      }
    }

    async function recordSignOut(s: Loaded): Promise<void> {
      try {
        await store.updateActivation(activationId(s.rec.partnerId, s.rec.uid), prev => ({
          next: applySignOut(prev, s.rec.host, now()),
          result: undefined,
        }))
      } catch (err) {
        logError('activation sign-out record failed', err)
      }
    }

    async function touch(s: Loaded): Promise<void> {
      if (now() - s.rec.lastSeenAt < policy.touchIntervalMs) return
      try {
        await store.updateSession(s.id, { lastSeenAt: now() })
        await audit({ event: 'session_refreshed', result: 'success', ...aboutSession(s) })
      } catch (err) {
        logError('session refresh failed', err)
      }
    }

    // ── Application host ────────────────────────────────────────────────

    async function startLogin(): Promise<Response> {
      if (await limited('login')) return fail('rate_limited', { html: true })
      const params = new URL(req.url).searchParams
      const raw = params.get('return')
      const path = raw ? sanitizeReturnPath(raw, host) : '/'
      if (path === null) {
        await audit({ event: 'login_started', result: 'failure', reason: 'invalid_return' })
        return fail('invalid_return', { html: true, action: homeAction(host) })
      }
      const nonce = randomToken()
      const verifier = randomToken()
      const t = now()
      const state = seal(secret, STATE_PURPOSE, {
        h: host, p: path, n: nonce, c: pkceChallenge(verifier), t,
        g: parseLoginTrigger(params.get('trigger')), l: sanitizePageLabel(params.get('label')),
      } satisfies LoginState)
      const txn = seal(secret, TXN_PURPOSE, { h: host, n: nonce, v: verifier, t } satisfies LoginTxn)
      await audit({ event: 'login_started', result: 'success' })
      return redirect(
        `https://${provider.loginHost}/api/auth/authorize?state=${encodeURIComponent(state)}`,
        [setCookie(COOKIE.txn, txn, policy.stateTtlMs)],
      )
    }

    async function completeLogin(): Promise<Response> {
      const url = new URL(req.url)
      const code = url.searchParams.get('code')
      const stateToken = url.searchParams.get('state')
      const clearTxn = clearCookie(COOKIE.txn)

      async function reject(reason: AuthErrorCode, action: ErrorAction | null, uid: string | null = null): Promise<Response> {
        await audit({ event: 'authorization_code_exchanged', result: 'failure', reason, uid })
        return fail(reason, { html: true, action, cookies: [clearTxn] })
      }

      const state = readState(stateToken)
      if (!state || state.h !== host) return reject('invalid_state', homeAction(host))
      const again = signInAgainAction(state)
      if (now() - state.t > policy.stateTtlMs) return reject('expired_login', again)

      const txn = unseal<LoginTxn>(secret, TXN_PURPOSE, readCookie(req, COOKIE.txn))
      if (!txn || txn.h !== host || typeof txn.n !== 'string' || typeof txn.v !== 'string' || !safeEqual(txn.n, state.n)) {
        return reject('invalid_state', again)
      }
      const path = sanitizeReturnPath(state.p, host)
      if (path === null) return reject('invalid_return', homeAction(host))
      if (!code || code.length > 128) return reject('invalid_code', again)

      // Redeem atomically: the first valid redemption wins, every later one is a replay.
      const { token, id: sessionId } = newSession()
      const t = now()
      const challenge = pkceChallenge(txn.v)
      type Outcome = { code: CodeRecord } | { error: AuthErrorCode; record: CodeRecord | null }
      const outcome = await store.updateCode<Outcome>(sha256(code), c => {
        if (!c) return { next: null, result: { error: 'invalid_code', record: null } }
        if (c.usedAt !== null) return { next: null, result: { error: 'code_used', record: c } }
        const burned: CodeRecord = { ...c, usedAt: t }
        if (t >= c.expiresAt) return { next: burned, result: { error: 'expired_code', record: c } }
        if (c.host !== host) return { next: burned, result: { error: 'invalid_code', record: c } }
        if (!safeEqual(c.nonce, state.n) || !safeEqual(c.challenge, challenge)) {
          return { next: burned, result: { error: 'invalid_state', record: c } }
        }
        return { next: { ...burned, sessionId }, result: { code: c } }
      })

      if ('error' in outcome) {
        // A replayed code also kills the session its first redemption created.
        if (outcome.error === 'code_used' && outcome.record?.sessionId) {
          const id = outcome.record.sessionId
          const rec = await store.getSession(id)
          if (rec && rec.revokedAt === null) await revoke({ id, rec }, 'code_replay', 'session_revoked')
        }
        return reject(outcome.error, again, outcome.record?.uid ?? null)
      }

      const c = outcome.code
      await audit({ event: 'authorization_code_exchanged', result: 'success', uid: c.uid })

      // Session rotation: a sign-in never keeps a session id this browser already had.
      const previous = await loadSession(req, 'app', host)
      if (previous.session) await revoke(previous.session, 'rotated', 'session_revoked')

      const rec = sessionRecord('app', c, provider, host, c.centralRef)
      try {
        await store.putSession(sessionId, rec)
      } catch (err) {
        logError('app session create failed', err)
        await audit({ event: 'session_created', result: 'failure', reason: 'session_failed', uid: c.uid, sessionKind: 'app' })
        return fail('session_failed', { html: true, action: again, cookies: [clearTxn] })
      }
      await audit({ event: 'session_created', result: 'success', uid: c.uid, sessionRef: sessionRef(sessionId), sessionKind: 'app' })
      await recordSignIn(c, {
        host, path, pageLabel: sanitizePageLabel(state.l), trigger: parseLoginTrigger(state.g),
      }, c.location ?? null)
      return redirect(returnUrl(host, path), [setCookie(COOKIE.session, token, policy.absoluteLifetimeMs), clearTxn])
    }

    // ── Login host ──────────────────────────────────────────────────────

    async function authorize(): Promise<Response> {
      if (await limited('authorize')) return fail('rate_limited', { html: true })
      const stateToken = new URL(req.url).searchParams.get('state')
      const state = readState(stateToken)
      if (!state || !stateToken) return fail('invalid_state', { html: true })
      if (!isAllowedAppHost(provider, state.h)) {
        await audit({ event: 'login_failed', result: 'failure', reason: 'unauthorized_domain', host: state.h })
        return fail('unauthorized_domain', { html: true })
      }
      if (now() - state.t > policy.stateTtlMs) return fail('expired_login', { html: true, action: signInAgainAction(state) })

      const toSignIn = (cookies: string[]) => redirect(`https://${host}/sso?state=${encodeURIComponent(stateToken)}`, cookies)
      const { present, session } = await loadSession(req, 'central', host)
      if (!session) return toSignIn(present ? [clearCookie(COOKIE.central)] : [])
      if (!(await directory.isUserEnabled(session.rec.uid))) {
        await revoke(session, 'account_disabled', 'session_revoked')
        return toSignIn([clearCookie(COOKIE.central)])
      }
      await touch(session)

      const code = randomToken()
      const t = now()
      const { uid, email, emailVerified, name } = session.rec
      await store.putCode(sha256(code), {
        providerId: provider.id, partnerId: provider.partnerId,
        uid, email, emailVerified, name,
        host: state.h, challenge: state.c, nonce: state.n,
        centralRef: sessionRef(session.id),
        createdAt: t, expiresAt: t + policy.codeTtlMs, usedAt: null, sessionId: null,
        // This request comes straight from the browser, so its geo headers are the visitor's.
        location: locationFromHeaders(req.headers),
      })
      await audit({ event: 'authorization_code_issued', result: 'success', uid, host: state.h, sessionRef: sessionRef(session.id), sessionKind: 'central' })
      return redirect(`https://${state.h}/api/auth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(stateToken)}`)
    }

    async function signIn(): Promise<Response> {
      if (!sameOrigin(req, host)) return fail('forbidden_origin', { html: false })
      if (await limited('signIn')) return fail('rate_limited', { html: false })
      if (!(req.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) return fail('bad_request', { html: false })
      const body = await readJson(req, 16_384)
      const idToken = typeof body?.idToken === 'string' && body.idToken.length <= 8192 ? body.idToken : null
      if (!idToken) return fail('bad_request', { html: false })

      let who: VerifiedSignIn
      try {
        who = await directory.verifyIdToken(idToken)
      } catch (err) {
        logError('ID token rejected', err)
        await audit({ event: 'login_failed', result: 'failure', reason: 'invalid_credentials' })
        return fail('invalid_credentials', { html: false })
      }
      if (now() - who.authTime > policy.freshSignInMs) {
        await audit({ event: 'login_failed', result: 'failure', reason: 'stale_sign_in', uid: who.uid })
        return fail('stale_sign_in', { html: false })
      }

      const previous = await loadSession(req, 'central', host)
      if (previous.session) await revoke(previous.session, 'rotated', 'session_revoked')

      const { token, id } = newSession()
      await store.putSession(id, sessionRecord('central', who, provider, host, null))
      await audit({ event: 'login_success', result: 'success', uid: who.uid })
      await audit({ event: 'session_created', result: 'success', uid: who.uid, sessionRef: sessionRef(id), sessionKind: 'central' })
      // The dashboard's sign-in is an activation in its own right. The /sso page's is not:
      // the application sign-in it is part of is recorded when its code is redeemed.
      if (body?.purpose === 'workspace') {
        await recordSignIn(who, { host, path: '/', pageLabel: WORKSPACE_LABEL, trigger: 'workspace_access' }, locationFromHeaders(req.headers))
      }
      return json({ authenticated: true }, 200, [setCookie(COOKIE.central, token, policy.absoluteLifetimeMs)])
    }

    // ── Both ────────────────────────────────────────────────────────────

    async function sessionInfo(kind: SessionKind): Promise<Response> {
      const cookie = kind === 'central' ? COOKIE.central : COOKIE.session
      const { present, session } = await loadSession(req, kind, host)
      if (!session) return json({ authenticated: false }, 200, present ? [clearCookie(cookie)] : [])
      await touch(session)
      const { uid, name, email } = session.rec
      const roles = await directory.rolesFor(session.rec, session.rec.partnerId)
      return json({ authenticated: true, user: { id: uid, name, email }, roles, domain: host })
    }

    async function logout(kind: SessionKind): Promise<Response> {
      const form = isFormPost(req)
      if (!sameOrigin(req, host)) return fail('forbidden_origin', { html: form })
      const { session } = await loadSession(req, kind, host)
      if (session) {
        await revoke(session, 'logout', 'logout')
        await recordSignOut(session)
      }
      const cookies = [clearCookie(kind === 'central' ? COOKIE.central : COOKIE.session)]
      if (form) {
        const raw = new URL(req.url).searchParams.get('return')
        const path = (raw && sanitizeReturnPath(raw, host)) || '/'
        return redirect(returnUrl(host, path), cookies, 303)
      }
      return json({ authenticated: false }, 200, cookies)
    }

    // ── Routing ─────────────────────────────────────────────────────────

    const navigation = action === 'login' || action === 'callback' || action === 'authorize'
    const only = (m: string) => (req.method === m ? null : fail('method_not_allowed', { html: navigation }))
    try {
      if (ctx.side === 'login') {
        switch (action) {
          case 'authorize': return only('GET') ?? await authorize()
          case 'session':
            if (req.method === 'POST') return await signIn()
            return only('GET') ?? await sessionInfo('central')
          case 'logout': return only('POST') ?? await logout('central')
        }
      } else {
        switch (action) {
          case 'login': return only('GET') ?? await startLogin()
          case 'callback': return only('GET') ?? await completeLogin()
          case 'session': return only('GET') ?? await sessionInfo('app')
          case 'logout': return only('POST') ?? await logout('app')
        }
      }
      return fail('not_found', { html: wantsHtml(req) })
    } catch (err) {
      logError(`${ctx.side}/${action} failed`, err)
      return fail('unavailable', { html: navigation || wantsHtml(req) })
    }
  }
}
