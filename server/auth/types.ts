import type { AuthProviderId } from '../../src/auth/providers.js'
import type { AccessResult, CoarseLocation, UserActivation } from '../../src/types/activation.js'
import type { ProfileLocation } from './location.js'

// ── Records ────────────────────────────────────────────────────────────────
//
// Secrets (session tokens, authorization codes) never reach storage: a
// record's id is the SHA-256 of its secret, and the secret itself exists only
// in the cookie or URL that carries it. Timestamps are epoch milliseconds.

/** `central` lives on a login host and enables SSO; `app` lives on one application host. */
export type SessionKind = 'central' | 'app'

export interface SessionRecord {
  kind: SessionKind
  uid: string
  email: string
  emailVerified: boolean
  name: string
  providerId: AuthProviderId
  /** Partner whose memberships decide this session's roles. */
  partnerId: string
  /** The only host whose cookie carries this session (login host for central, app host for app). */
  host: string
  createdAt: number
  lastSeenAt: number
  /** Absolute expiry; idle expiry is lastSeenAt + policy.idleTimeoutMs. */
  expiresAt: number
  revokedAt: number | null
  revokeReason: string | null
  /** App sessions: the central session that authorised the code (storage id prefix). */
  centralRef: string | null
}

export interface CodeRecord {
  providerId: AuthProviderId
  partnerId: string
  uid: string
  email: string
  emailVerified: boolean
  name: string
  /** The only application host that may redeem this code. */
  host: string
  /** PKCE S256 challenge; the verifier sits in the app host's HttpOnly transaction cookie. */
  challenge: string
  /** Nonce of the state this code was issued for. */
  nonce: string
  centralRef: string
  createdAt: number
  expiresAt: number
  usedAt: number | null
  /** Storage id of the app session created by redeeming it (revoked if the code is replayed). */
  sessionId: string | null
  /**
   * Approximate location of the browser that asked for the code. Read at
   * authorize, the one step the browser sends straight to the login host.
   * Absent on codes issued before activation tracking.
   */
  location?: CoarseLocation | null
}

// ── Audit ──────────────────────────────────────────────────────────────────

export type AuthEventName =
  | 'login_started'
  | 'login_success'
  | 'login_failed'
  | 'authorization_code_issued'
  | 'authorization_code_exchanged'
  | 'session_created'
  | 'session_refreshed'
  | 'logout'
  | 'session_revoked'
  /** First sign-in of a user to a Partner's sites (details on userActivations). */
  | 'user_activation'

export interface AuthEvent {
  event: AuthEventName
  result: 'success' | 'failure'
  /** Machine-readable reason on failure or revocation (an AuthErrorCode or revoke reason). */
  reason: string | null
  uid: string | null
  providerId: AuthProviderId | null
  partnerId: string | null
  /** The application or login host the event concerns. */
  host: string | null
  /** Prefix of the session's storage id (itself a hash) — never a cookie value. */
  sessionRef: string | null
  sessionKind: SessionKind | null
  at: number
  ip: string | null
  userAgent: string | null
}

// ── Ports ──────────────────────────────────────────────────────────────────

export interface AuthStore {
  /** Creates a session; never overwrites an existing id. */
  putSession(id: string, s: SessionRecord): Promise<void>
  getSession(id: string): Promise<SessionRecord | null>
  updateSession(id: string, patch: Partial<SessionRecord>): Promise<void>
  /** Revokes every unrevoked session of a user; returns the revoked ids. */
  revokeUserSessions(uid: string, reason: string, at: number): Promise<string[]>
  /** Creates a code; never overwrites an existing id. */
  putCode(id: string, c: CodeRecord): Promise<void>
  /**
   * Atomic read-modify-write of one code (a transaction in Firestore), so two
   * concurrent redemptions can't both succeed. `fn` returns the record to
   * write back (or null to leave it) and the caller's result.
   */
  updateCode<T>(id: string, fn: (c: CodeRecord | null) => { next: CodeRecord | null; result: T }): Promise<T>
  /** Fixed-window counter: counts this hit and returns the window's total. */
  hit(key: string, windowMs: number, now: number): Promise<number>
  recordEvent(e: AuthEvent): Promise<void>
  /**
   * Atomic read-modify-write of userActivations/{id} (a transaction in
   * Firestore), so concurrent sign-ins agree on which one was first. `fn`
   * returns the record to write (or null to leave it) and the caller's result.
   */
  updateActivation<T>(id: string, fn: (a: UserActivation | null) => { next: UserActivation | null; result: T }): Promise<T>
}

export interface VerifiedSignIn {
  uid: string
  email: string
  emailVerified: boolean
  name: string
  /** When the user last presented credentials (epoch ms). */
  authTime: number
}

/** Intern2026's identity authority: Firebase Auth + Firestore memberships. */
export interface Directory {
  /** Verifies a Firebase ID token (signature, expiry, revocation, disabled account). Throws if invalid. */
  verifyIdToken(idToken: string): Promise<VerifiedSignIn>
  /** False if the account no longer exists or is disabled. */
  isUserEnabled(uid: string): Promise<boolean>
  /** The roles the user holds for this Partner right now. */
  rolesFor(user: { uid: string; email: string; emailVerified: boolean }, partnerId: string): Promise<string[]>
  /** Whether those roles open the Partner's protected areas, and if not, why (membership state). */
  accessFor(user: { uid: string; email: string; emailVerified: boolean }, partnerId: string): Promise<AccessResult>
  /** Location the user entered on their profile (users/{uid}), or null. */
  profileLocation(uid: string): Promise<ProfileLocation | null>
}
