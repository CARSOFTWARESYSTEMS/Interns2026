// ── User activation records ────────────────────────────────────────────────
//
//   userActivations/{partnerId}_{uid}
//
// One user in one Partner's ecosystem: where they first signed in (kept
// once), where they last signed in, their coarse location, and their recent
// sign-in events. Written only by the /api/auth function (Admin SDK) when a
// sign-in completes; read by Platform Admin (every Partner) and by a
// Partner's Admins (that Partner only) — see firestore.rules.
//
// Never on a record: tokens, authorization codes, session ids, cookies, IP
// addresses, precise coordinates, or pages visited after signing in.
// Timestamps are epoch milliseconds.

import type { LoginPromptType, LoginTrigger } from '../auth/loginContext.js'
import type { AuthProviderId } from '../auth/providers.js'

/** Whether the user could use the Partner's protected areas when they signed in. */
export type AccessResult = 'granted' | 'platform_admin' | 'no_membership' | 'pending' | 'suspended' | 'blocked'

export const ACCESS_RESULT_LABELS: Record<AccessResult, string> = {
  granted: 'Access granted',
  platform_admin: 'Platform Admin',
  no_membership: 'No membership',
  pending: 'Membership pending',
  suspended: 'Membership suspended',
  blocked: 'Membership blocked',
}

export type LocationSource = 'user_profile' | 'ip_approximate'

export const LOCATION_SOURCE_LABELS: Record<LocationSource, string> = {
  user_profile: 'User profile',
  ip_approximate: 'Approximate (network)',
}

/** Country, state and city at most — never coordinates, street or postal code. */
export interface CoarseLocation {
  country: string
  /** ISO 3166-1 alpha-2, '' when unknown. */
  countryCode: string
  stateOrRegion: string
  city: string
  /** IANA name, e.g. Asia/Kolkata; '' when unknown. */
  timezone: string
}

export type ActivationEventName = 'user_activation' | 'login_success' | 'logout'

export const ACTIVATION_EVENT_LABELS: Record<ActivationEventName, string> = {
  user_activation: 'First Activation',
  login_success: 'Login Success',
  logout: 'Logout',
}

export interface ActivationEvent {
  event: ActivationEventName
  at: number
  host: string
  /** Path only, no query or hash. */
  path: string
  pageLabel: string
  /** Sign-ins only. */
  trigger: LoginTrigger | null
  promptType: LoginPromptType | null
  access: AccessResult | null
}

/** Newest first, capped: an audit summary, not a browsing history. */
export const MAX_RECENT_EVENTS = 15

export interface UserActivation extends CoarseLocation {
  /** `${partnerId}_${uid}` */
  id: string
  uid: string
  email: string
  emailVerified: boolean
  displayName: string

  /** The tenant (the platform's partnerId). */
  partnerId: string
  /** The sign-in provider the Partner's sites use. */
  ecosystem: AuthProviderId
  /** Login host that signed the user in, e.g. login.autonomous.ev.engineer. */
  loginProvider: string

  firstActivatedAt: number
  /** Host without "www.", e.g. autonomous.ev.engineer. */
  firstSourceDomain: string
  firstSourceHost: string
  firstSourcePath: string
  firstSourcePageLabel: string
  firstLoginTrigger: LoginTrigger
  firstLoginPromptType: LoginPromptType | null

  lastLoginAt: number
  lastSourceDomain: string
  lastSourceHost: string
  lastSourcePath: string
  lastSourcePageLabel: string
  lastLoginTrigger: LoginTrigger
  lastLoginPromptType: LoginPromptType | null
  /** Access at the latest sign-in. Live access is the membership itself. */
  lastAccess: AccessResult
  loginCount: number

  locationSource: LocationSource | null
  locationCapturedAt: number | null

  recentEvents: ActivationEvent[]
  updatedAt: number
}

export function activationId(partnerId: string, uid: string): string {
  return `${partnerId}_${uid}`
}
