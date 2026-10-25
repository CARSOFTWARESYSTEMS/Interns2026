import type { AuthEvent, AuthStore, CodeRecord, SessionRecord } from './types.js'

export interface MemoryAuthStore extends AuthStore {
  readonly sessions: Map<string, SessionRecord>
  readonly codes: Map<string, CodeRecord>
  readonly events: AuthEvent[]
}

/** In-process AuthStore for tests and local development. Same contract as the Firestore store. */
export function createMemoryAuthStore(): MemoryAuthStore {
  const sessions = new Map<string, SessionRecord>()
  const codes = new Map<string, CodeRecord>()
  const events: AuthEvent[] = []
  const counters = new Map<string, number>()

  return {
    sessions, codes, events,

    async putSession(id, s) {
      if (sessions.has(id)) throw new Error('Session id already exists')
      sessions.set(id, structuredClone(s))
    },
    async getSession(id) {
      const s = sessions.get(id)
      return s ? structuredClone(s) : null
    },
    async updateSession(id, patch) {
      const s = sessions.get(id)
      if (!s) throw new Error('No such session')
      sessions.set(id, { ...s, ...patch })
    },
    async revokeUserSessions(uid, reason, at) {
      const revoked: string[] = []
      for (const [id, s] of sessions) {
        if (s.uid === uid && s.revokedAt === null) {
          sessions.set(id, { ...s, revokedAt: at, revokeReason: reason })
          revoked.push(id)
        }
      }
      return revoked
    },
    async putCode(id, c) {
      if (codes.has(id)) throw new Error('Code id already exists')
      codes.set(id, structuredClone(c))
    },
    async updateCode(id, fn) {
      const current = codes.get(id)
      const { next, result } = fn(current ? structuredClone(current) : null)
      if (next) codes.set(id, structuredClone(next))
      return result
    },
    async hit(key, windowMs, now) {
      const k = `${key}|${Math.floor(now / windowMs)}`
      const n = (counters.get(k) ?? 0) + 1
      counters.set(k, n)
      return n
    },
    async recordEvent(e) {
      events.push(structuredClone(e))
    },
  }
}
