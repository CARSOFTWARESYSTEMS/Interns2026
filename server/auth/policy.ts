// ── Expiry and rate-limit policy ───────────────────────────────────────────
//
// The platform had no session policy before (the dashboard keeps Firebase's
// persistent sign-in), so these are the defaults for SSO sessions. Session
// lifetimes can be tuned per deployment with environment variables.

export interface RateLimit {
  limit: number
  windowMs: number
}

export interface AuthPolicy {
  /** Authorization code lifetime. */
  codeTtlMs: number
  /** How long a login may take from the app's Login click to the callback. */
  stateTtlMs: number
  /** A session not used for this long expires. */
  idleTimeoutMs: number
  /** A session expires this long after sign-in, however active. */
  absoluteLifetimeMs: number
  /** lastSeenAt is written at most this often (bounds writes; idle expiry is accurate to this). */
  touchIntervalMs: number
  /** A Firebase sign-in older than this can't start a central session; the user signs in again. */
  freshSignInMs: number
  rateLimits: {
    /** App host: Login clicks per IP. */
    login: RateLimit
    /** Login host: authorization requests per IP. */
    authorize: RateLimit
    /** Login host: ID-token sign-ins per IP. */
    signIn: RateLimit
  }
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE

export const DEFAULT_AUTH_POLICY: AuthPolicy = {
  codeTtlMs: 60_000,
  stateTtlMs: 10 * MINUTE,
  idleTimeoutMs: 12 * HOUR,
  absoluteLifetimeMs: 7 * 24 * HOUR,
  touchIntervalMs: 15 * MINUTE,
  freshSignInMs: 5 * MINUTE,
  rateLimits: {
    login: { limit: 30, windowMs: MINUTE },
    authorize: { limit: 30, windowMs: MINUTE },
    signIn: { limit: 10, windowMs: MINUTE },
  },
}

function hours(raw: string | undefined, min: number, max: number): number | null {
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  return Math.min(max, Math.max(min, n)) * HOUR
}

/**
 * AUTH_SESSION_IDLE_HOURS (1–24, default 12) and AUTH_SESSION_MAX_HOURS
 * (1–720, default 168) override the session lifetimes. The absolute lifetime
 * is never shorter than the idle timeout.
 */
export function policyFromEnv(env: Record<string, string | undefined>): AuthPolicy {
  const idle = hours(env.AUTH_SESSION_IDLE_HOURS, 1, 24) ?? DEFAULT_AUTH_POLICY.idleTimeoutMs
  const max = hours(env.AUTH_SESSION_MAX_HOURS, 1, 720) ?? DEFAULT_AUTH_POLICY.absoluteLifetimeMs
  return { ...DEFAULT_AUTH_POLICY, idleTimeoutMs: idle, absoluteLifetimeMs: Math.max(idle, max) }
}
