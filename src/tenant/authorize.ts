// ── Tenant authorization model ─────────────────────────────────────────────
//
// Pure, framework-free mirror of the decisions enforced by firestore.rules.
// The UI uses it to decide what to show; unit tests use it to pin the RBAC
// matrix. It is NOT the security boundary — Firestore rules are. Keep the two
// in sync: every rule helper named here has a same-named function in
// firestore.rules.

import type { UserRole } from '../types/auth'
import {
  PARTNER_ROLES, PLATFORM_ONLY_GRANTS,
  type MembershipStatus, type PartnerRole,
} from '../types/partner'

export interface MembershipFacts {
  role: PartnerRole
  status: MembershipStatus
}

export interface Principal {
  uid: string
  isPlatformAdmin: boolean
  /** Memberships keyed by partnerId. Only what the caller can legitimately know about themself. */
  memberships: Readonly<Record<string, MembershipFacts | undefined>>
}

export type AccessState =
  | 'platform-admin'
  | 'active'
  | 'no-membership'
  | 'pending'
  | 'suspended'
  | 'blocked'

/** Access state for the Partner resolved from the current hostname. */
export function accessStateFor(p: Principal, activePartnerId: string): AccessState {
  if (p.isPlatformAdmin) return 'platform-admin'
  const m = p.memberships[activePartnerId]
  if (!m) return 'no-membership'
  switch (m.status) {
    case 'Active':    return 'active'
    case 'Pending':   return 'pending'
    case 'Suspended': return 'suspended'
    case 'Blocked':   return 'blocked'
    default:          return 'blocked' // unknown status → fail closed
  }
}

/** Role in the active Partner; Platform Admin overrides. null = no access. */
export function effectiveRole(p: Principal, activePartnerId: string): UserRole | null {
  if (p.isPlatformAdmin) return 'Platform Admin'
  const m = p.memberships[activePartnerId]
  if (!m || m.status !== 'Active') return null
  return (PARTNER_ROLES as readonly string[]).includes(m.role) ? m.role : null
}

/**
 * Core tenant check (spec §4/§12):
 *   resource.partnerId === activePartnerId, with an ACTIVE membership,
 *   unless the caller is a Platform Admin.
 * Labels / display names are never inputs.
 */
export function authorize(p: Principal, activePartnerId: string, resourcePartnerId: string): boolean {
  if (!resourcePartnerId) return false
  if (p.isPlatformAdmin) return true
  if (resourcePartnerId !== activePartnerId) return false
  return effectiveRole(p, activePartnerId) !== null
}

const WRITE_ROLES: readonly UserRole[] = [
  'Platform Admin', 'Admin', 'Engineering Manager', 'HR Manager', 'Architect', 'QA Engineer', 'Developer',
]

/** Viewer is read-only everywhere. Finer per-collection rules still apply on top. */
export function canWriteIn(p: Principal, activePartnerId: string, resourcePartnerId: string): boolean {
  if (!authorize(p, activePartnerId, resourcePartnerId)) return false
  // authorize() guarantees resourcePartnerId === activePartnerId unless Platform Admin.
  const role = effectiveRole(p, activePartnerId)
  return role !== null && WRITE_ROLES.includes(role)
}

export function isPartnerAdmin(p: Principal, partnerId: string): boolean {
  return effectiveRole(p, partnerId) === 'Admin'
}

/** Platform Admin anywhere; Admin only in their own Partner. */
export function canAdministerPartner(p: Principal, partnerId: string): boolean {
  return p.isPlatformAdmin || isPartnerAdmin(p, partnerId)
}

/** Security-sensitive Partner configuration (create Partner, domains, auth policy, branding). */
export function canManagePartnerRegistry(p: Principal): boolean {
  return p.isPlatformAdmin
}

/** Who may grant a role through an invitation. */
export function canInviteWithRole(p: Principal, partnerId: string, role: UserRole): boolean {
  if (role === 'Platform Admin') return false            // never via a Partner invitation
  if (p.isPlatformAdmin) return true
  const actor = effectiveRole(p, partnerId)
  if (actor !== 'Admin' && actor !== 'Engineering Manager') return false
  return !PLATFORM_ONLY_GRANTS.includes(role)
}

export interface MembershipChange {
  targetUid: string
  partnerId: string
  beforeRole: PartnerRole | null   // null when creating
  afterRole: PartnerRole
}

/**
 * Membership create/update by an administrator.
 *   • Platform Admin: anything.
 *   • Partner Admin: only inside their Partner; never their own membership;
 *     never grants Admin and never edits an existing Admin.
 *   • Everyone else: no.
 */
export function canChangeMembership(p: Principal, c: MembershipChange): boolean {
  if (p.isPlatformAdmin) return true
  if (!isPartnerAdmin(p, c.partnerId)) return false
  if (c.targetUid === p.uid) return false
  if (c.beforeRole === 'Admin') return false
  if (PLATFORM_ONLY_GRANTS.includes(c.afterRole)) return false
  return true
}

export function canGrantPlatformAdmin(p: Principal): boolean {
  return p.isPlatformAdmin
}
