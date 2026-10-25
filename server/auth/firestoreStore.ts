import type { DocumentData, Firestore } from 'firebase-admin/firestore'
import type { UserActivation } from '../../src/types/activation.js'
import { sha256 } from './crypto.js'
import type { AuthStore, CodeRecord, SessionRecord } from './types.js'

// ── Firestore-backed AuthStore (server only, Admin SDK) ────────────────────
//
//   authSessions/{sha256(token)}   central + app sessions
//   authCodes/{sha256(code)}       one-time authorization codes
//   authEvents/{auto}              audit trail
//   authRateLimits/{sha256(key)}   fixed-window counters
//   userActivations/{partnerId}_{uid}  first/latest sign-in per user and Partner
//
// firestore.rules deny all client access to the auth* collections. Each of
// their documents carries `ttlAt` (a Timestamp) for a Firestore TTL policy to
// delete it once it is no longer useful — see docs/auth/multi-domain-sso.md.
// userActivations are Admin-readable user records with no TTL and nothing
// secret on them.

const DAY = 24 * 60 * 60_000
const RETAIN = {
  session: 30 * DAY,   // after expiry, for investigating a session
  code: 1 * DAY,       // after expiry, long enough to recognise a replay
  event: 400 * DAY,    // audit trail
}

function withoutTtl<T>(data: DocumentData | undefined): T | null {
  if (!data) return null
  const { ttlAt: _ttl, ...rest } = data
  return rest as T
}

export function createFirestoreAuthStore(db: Firestore): AuthStore {
  const sessions = db.collection('authSessions')
  const codes = db.collection('authCodes')
  const events = db.collection('authEvents')
  const limits = db.collection('authRateLimits')
  const activations = db.collection('userActivations')

  return {
    async putSession(id, s) {
      await sessions.doc(id).create({ ...s, ttlAt: new Date(s.expiresAt + RETAIN.session) })
    },
    async getSession(id) {
      return withoutTtl<SessionRecord>((await sessions.doc(id).get()).data())
    },
    async updateSession(id, patch) {
      await sessions.doc(id).update(patch)
    },
    async revokeUserSessions(uid, reason, at) {
      const snap = await sessions.where('uid', '==', uid).where('revokedAt', '==', null).get()
      const batch = db.batch()
      snap.docs.forEach(d => batch.update(d.ref, { revokedAt: at, revokeReason: reason }))
      if (!snap.empty) await batch.commit()
      return snap.docs.map(d => d.id)
    },
    async putCode(id, c) {
      await codes.doc(id).create({ ...c, ttlAt: new Date(c.expiresAt + RETAIN.code) })
    },
    async updateCode(id, fn) {
      const ref = codes.doc(id)
      return db.runTransaction(async tx => {
        const current = withoutTtl<CodeRecord>((await tx.get(ref)).data())
        const { next, result } = fn(current)
        if (next) tx.set(ref, { ...next, ttlAt: new Date(next.expiresAt + RETAIN.code) })
        return result
      })
    },
    async hit(key, windowMs, now) {
      const windowStart = Math.floor(now / windowMs) * windowMs
      const ref = limits.doc(sha256(`${key}|${windowStart}`))
      return db.runTransaction(async tx => {
        const snap = await tx.get(ref)
        const count = ((snap.get('count') as number | undefined) ?? 0) + 1
        tx.set(ref, { count, ttlAt: new Date(windowStart + 2 * windowMs) })
        return count
      })
    },
    async recordEvent(e) {
      await events.add({ ...e, ttlAt: new Date(e.at + RETAIN.event) })
    },
    async updateActivation(id, fn) {
      const ref = activations.doc(id)
      return db.runTransaction(async tx => {
        const snap = await tx.get(ref)
        const { next, result } = fn(snap.exists ? (snap.data() as UserActivation) : null)
        if (next) tx.set(ref, next)
        return result
      })
    },
  }
}
