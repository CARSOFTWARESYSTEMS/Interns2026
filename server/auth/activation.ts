import { pathOnly, promptTypeFor, siteDomain, type LoginTrigger } from '../../src/auth/loginContext.js'
import type { AuthProviderId } from '../../src/auth/providers.js'
import {
  activationId, MAX_RECENT_EVENTS,
  type AccessResult, type ActivationEvent, type UserActivation,
} from '../../src/types/activation.js'
import type { ResolvedLocation } from './location.js'

// ── Activation records: pure updates ───────────────────────────────────────
//
// The store runs these inside a transaction on userActivations/{id}, so two
// sign-ins at once can't both believe they were the first.

/** One completed sign-in, as the handler knows it. Nothing secret. */
export interface SignInFacts {
  uid: string
  email: string
  emailVerified: boolean
  name: string
  providerId: AuthProviderId
  partnerId: string
  loginProvider: string
  /** The host the user signed in on (an application host, or the login host for the dashboard). */
  host: string
  /** Return path; only its path part is kept. */
  path: string
  pageLabel: string
  trigger: LoginTrigger
  access: AccessResult
  at: number
}

export { activationId }

function source(f: SignInFacts) {
  return {
    domain: siteDomain(f.host),
    host: f.host,
    path: pathOnly(f.path),
    pageLabel: f.pageLabel,
    trigger: f.trigger,
    promptType: promptTypeFor(f.trigger),
  }
}

function withEvent(events: unknown, event: ActivationEvent): ActivationEvent[] {
  const previous = Array.isArray(events) ? (events as ActivationEvent[]) : []
  return [event, ...previous].slice(0, MAX_RECENT_EVENTS)
}

/**
 * The record after a successful sign-in. A new record takes this sign-in as
 * its first activation; an existing one keeps its first-activation fields and
 * gets new latest-login fields. A sign-in without a location keeps the
 * location already on the record.
 */
export function applySignIn(prev: UserActivation | null, f: SignInFacts, location: ResolvedLocation | null): UserActivation {
  const s = source(f)
  const event: ActivationEvent = {
    event: prev ? 'login_success' : 'user_activation',
    at: f.at, host: s.host, path: s.path, pageLabel: s.pageLabel,
    trigger: s.trigger, promptType: s.promptType, access: f.access,
  }
  const first = prev
    ? {
        firstActivatedAt: prev.firstActivatedAt,
        firstSourceDomain: prev.firstSourceDomain,
        firstSourceHost: prev.firstSourceHost,
        firstSourcePath: prev.firstSourcePath,
        firstSourcePageLabel: prev.firstSourcePageLabel,
        firstLoginTrigger: prev.firstLoginTrigger,
        firstLoginPromptType: prev.firstLoginPromptType,
      }
    : {
        firstActivatedAt: f.at,
        firstSourceDomain: s.domain,
        firstSourceHost: s.host,
        firstSourcePath: s.path,
        firstSourcePageLabel: s.pageLabel,
        firstLoginTrigger: s.trigger,
        firstLoginPromptType: s.promptType,
      }
  const place = location
    ? { ...location.location, locationSource: location.source, locationCapturedAt: f.at }
    : {
        country: prev?.country ?? '',
        countryCode: prev?.countryCode ?? '',
        stateOrRegion: prev?.stateOrRegion ?? '',
        city: prev?.city ?? '',
        timezone: prev?.timezone ?? '',
        locationSource: prev?.locationSource ?? null,
        locationCapturedAt: prev?.locationCapturedAt ?? null,
      }
  return {
    id: activationId(f.partnerId, f.uid),
    uid: f.uid,
    // Identity as the identity provider reports it now.
    email: f.email,
    emailVerified: f.emailVerified,
    displayName: f.name,
    partnerId: f.partnerId,
    ecosystem: f.providerId,
    loginProvider: f.loginProvider,
    ...first,
    lastLoginAt: f.at,
    lastSourceDomain: s.domain,
    lastSourceHost: s.host,
    lastSourcePath: s.path,
    lastSourcePageLabel: s.pageLabel,
    lastLoginTrigger: s.trigger,
    lastLoginPromptType: s.promptType,
    lastAccess: f.access,
    loginCount: (typeof prev?.loginCount === 'number' ? prev.loginCount : 0) + 1,
    ...place,
    recentEvents: withEvent(prev?.recentEvents, event),
    updatedAt: f.at,
  }
}

/** The record after a sign-out on `host`; null (nothing to write) when the user has no record. */
export function applySignOut(prev: UserActivation | null, host: string, at: number): UserActivation | null {
  if (!prev) return null
  const event: ActivationEvent = { event: 'logout', at, host, path: '', pageLabel: '', trigger: null, promptType: null, access: null }
  return { ...prev, recentEvents: withEvent(prev.recentEvents, event), updatedAt: at }
}
