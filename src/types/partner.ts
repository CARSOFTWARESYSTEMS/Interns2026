// ── Multi-tenant Partner model ──────────────────────────────────────────────
//
// Canonical tenant term: `partnerId`.
//   Partner           = business organisation / tenant (security boundary)
//   PartnerDomain     = hostname → Partner mapping (doc id = normalised hostname)
//   PartnerMembership = one user's role inside one Partner
//
// `partnerId` is an immutable slug (e.g. "gamyaa"). It is the ONLY value used
// for authorization. Display names / labels are for UI only and must never be
// compared in security checks.
//
// Firestore layout:
//   partners/{partnerId}                         public branding (readable pre-login)
//   partnerSettings/{partnerId}                  modules, auth policy, operational config
//   partnerDomains/{hostname}                    hostname → partnerId
//   partnerMemberships/{partnerId}_{uid}         membership (deterministic id, rules use get())
//   platformAdmins/{uid}                         global Platform Admin grants
//
// The legacy `orgId` field on users/invitations/audit logs is read only for
// migration; new code must not use it.

import type { UserRole } from './auth'

export type PartnerStatus = 'Active' | 'Inactive'
export type PartnerDomainStatus = 'Active' | 'Inactive'
export type MembershipStatus = 'Pending' | 'Active' | 'Suspended' | 'Blocked'

/** Roles that can be held inside a Partner. Platform Admin is global, never a membership role. */
export type PartnerRole = Exclude<UserRole, 'Platform Admin'>

export const PARTNER_ROLES: readonly PartnerRole[] = [
  'Admin',
  'Engineering Manager',
  'HR Manager',
  'Architect',
  'QA Engineer',
  'Developer',
  'Viewer',
] as const

/** Roles a non-Platform-Admin is never allowed to grant. */
export const PLATFORM_ONLY_GRANTS: readonly UserRole[] = ['Platform Admin', 'Admin']

/** Legacy tenant: every record that predates multi-tenancy belongs here. */
export const LEGACY_PARTNER_ID = 'ev-engineer'

export const PARTNER_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/

export interface PartnerBranding {
  logoUrl: string
  logoDarkUrl: string
  faviconUrl: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
}

export interface PartnerLoginCopy {
  title: string
  subtitle: string
  restrictedNotice: string
}

export interface PartnerPlatformCopy {
  title: string
  subtitle: string
  tagline: string
  footer: string
  versionLabel: string
}

export interface PartnerContact {
  supportEmail: string
  supportPhone: string
  whatsappUrl: string
  websiteUrl: string
  supportUrl: string
}

/** Public, pre-login-readable Partner record: identity + branding only. */
export interface Partner {
  id: string
  slug: string
  status: PartnerStatus
  displayName: string
  shortName: string
  legalName: string
  description: string
  defaultDomain: string
  branding: PartnerBranding
  login: PartnerLoginCopy
  platform: PartnerPlatformCopy
  contact: PartnerContact
  /** Prefix for generated document numbers, e.g. offer letters ("ITEL-EV-INT" → ITEL-EV-INT-OFFER-2026-001). */
  documentPrefix: string
  city: string
  country: string
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
}

// ── Modules (extensible; not every switch is wired yet) ─────────────────────

export const PARTNER_MODULE_KEYS = [
  'engineering',
  'peopleOperations',
  'quality',
  'cybersecurity',
  'fai',
  'digitalTwin',
  'internships',
  'reports',
] as const

export type PartnerModuleKey = (typeof PARTNER_MODULE_KEYS)[number]

export interface PartnerModuleConfig {
  enabled: boolean
  /** Free-form per-module options for future use. */
  options?: Record<string, unknown>
}

export interface PartnerAuthPolicy {
  /** If true, signed-in users without a membership may request access (creates a Pending Viewer membership). */
  allowAccessRequests: boolean
}

/** Private Partner configuration — members can read; Platform Admin writes. */
export interface PartnerSettings {
  partnerId: string
  modules: Record<PartnerModuleKey, PartnerModuleConfig>
  authPolicy: PartnerAuthPolicy
  /** Operational settings a Partner Admin may change (reserved for Phase E). */
  operational: Record<string, unknown>
  updatedAt: string
  updatedBy: string
}

export interface PartnerDomain {
  hostname: string
  partnerId: string
  isPrimary: boolean
  status: PartnerDomainStatus
  createdAt: string
  updatedAt: string
}

/**
 * A user's membership in one Partner. Global identity (name, education,
 * skills…) stays on users/{uid}; anything Partner-specific lives here.
 * displayName/email/photoURL are denormalised so Partner Admins can manage
 * members without reading global profiles.
 */
export interface PartnerMembership {
  id: string                // `${partnerId}_${uid}`
  partnerId: string
  uid: string
  email: string             // lowercase
  displayName: string
  photoURL: string
  role: PartnerRole
  status: MembershipStatus
  // Partner-specific employment data
  employeeId: string
  designation: string
  team: string
  managerId: string
  architectId: string
  // Provenance
  inviteId: string
  invitedBy: string
  approvedBy: string
  createdAt: string
  updatedAt: string
  updatedBy: string
}

export function membershipId(partnerId: string, uid: string): string {
  return `${partnerId}_${uid}`
}

export function isPartnerRole(value: unknown): value is PartnerRole {
  return typeof value === 'string' && (PARTNER_ROLES as readonly string[]).includes(value)
}
