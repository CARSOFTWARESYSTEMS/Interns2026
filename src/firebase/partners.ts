// ── Partner / tenant Firestore service ──────────────────────────────────────
//
// All functions here are thin wrappers. Authorization is enforced by
// firestore.rules; the client never decides partnerId for a security check —
// it passes the Partner resolved from the hostname, and rules verify the
// caller's membership in that Partner.

import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where,
  writeBatch, addDoc, orderBy,
} from 'firebase/firestore'
import { db } from './config'
import type {
  Partner, PartnerDomain, PartnerMembership, PartnerSettings,
  PartnerRole, MembershipStatus,
} from '../types/partner'
import { membershipId } from '../types/partner'
import type { AuditAction, Invitation, UserProfile } from '../types/auth'

// ── Domains & Partners (public reads) ───────────────────────────────────────

export async function getPartnerDomain(hostname: string): Promise<PartnerDomain | null> {
  const snap = await getDoc(doc(db, 'partnerDomains', hostname))
  return snap.exists() ? (snap.data() as PartnerDomain) : null
}

export async function getPartner(partnerId: string): Promise<Partner | null> {
  const snap = await getDoc(doc(db, 'partners', partnerId))
  return snap.exists() ? ({ ...(snap.data() as Partner), id: snap.id }) : null
}

/** Platform Admin only (rules deny list to everyone else). */
export async function listPartners(): Promise<Partner[]> {
  const snap = await getDocs(collection(db, 'partners'))
  return snap.docs.map(d => ({ ...(d.data() as Partner), id: d.id }))
}

export async function getPartnerSettings(partnerId: string): Promise<PartnerSettings | null> {
  const snap = await getDoc(doc(db, 'partnerSettings', partnerId))
  return snap.exists() ? (snap.data() as PartnerSettings) : null
}

// ── Partner registry administration (Platform Admin only — enforced by rules) ─

export type PartnerDraft = Omit<Partner, 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>

/** Create a Partner + default settings atomically. Fails if the id is taken. */
export async function createPartner(draft: PartnerDraft, settings: Omit<PartnerSettings, 'updatedAt' | 'updatedBy'>, actorUid: string): Promise<Partner> {
  const existing = await getDoc(doc(db, 'partners', draft.id))
  if (existing.exists()) throw new Error('A Partner with this id already exists')
  const now = new Date().toISOString()
  const partner: Partner = { ...draft, createdAt: now, updatedAt: now, createdBy: actorUid, updatedBy: actorUid }
  const batch = writeBatch(db)
  batch.set(doc(db, 'partners', draft.id), partner)
  batch.set(doc(db, 'partnerSettings', draft.id), { ...settings, partnerId: draft.id, updatedAt: now, updatedBy: actorUid })
  await batch.commit()
  return partner
}

export async function updatePartner(id: string, patch: Partial<PartnerDraft>, actorUid: string): Promise<void> {
  const { id: _id, createdAt: _c, createdBy: _cb, ...rest } = patch as Partial<Partner>
  await updateDoc(doc(db, 'partners', id), { ...rest, id, updatedAt: new Date().toISOString(), updatedBy: actorUid })
}

export async function updatePartnerSettings(id: string, patch: Partial<Omit<PartnerSettings, 'partnerId'>>, actorUid: string): Promise<void> {
  await setDoc(doc(db, 'partnerSettings', id),
    { ...patch, partnerId: id, updatedAt: new Date().toISOString(), updatedBy: actorUid }, { merge: true })
}

export async function listPartnerDomains(partnerId: string): Promise<PartnerDomain[]> {
  const snap = await getDocs(query(collection(db, 'partnerDomains'), where('partnerId', '==', partnerId)))
  return snap.docs.map(d => d.data() as PartnerDomain)
}

/** Adds a hostname. Refuses if the (normalised) hostname is mapped already — never silently re-points a domain. */
export async function addPartnerDomain(partnerId: string, hostname: string, isPrimary: boolean): Promise<PartnerDomain> {
  const existing = await getDoc(doc(db, 'partnerDomains', hostname))
  if (existing.exists()) throw new Error('This hostname is already mapped to a Partner')
  const now = new Date().toISOString()
  const d: PartnerDomain = { hostname, partnerId, isPrimary, status: 'Active', createdAt: now, updatedAt: now }
  await setDoc(doc(db, 'partnerDomains', hostname), d)
  return d
}

export async function updatePartnerDomain(hostname: string, patch: Partial<Pick<PartnerDomain, 'isPrimary' | 'status'>>): Promise<void> {
  await updateDoc(doc(db, 'partnerDomains', hostname), { ...patch, updatedAt: new Date().toISOString() })
}

export async function removePartnerDomain(hostname: string): Promise<void> {
  await deleteDoc(doc(db, 'partnerDomains', hostname))
}

// ── Platform Admin ──────────────────────────────────────────────────────────

/** True if platformAdmins/{uid} exists. Super-admin emails are checked separately. */
export async function hasPlatformAdminGrant(uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'platformAdmins', uid))
    return snap.exists()
  } catch {
    return false // rules deny reading other docs; own doc read failure = not admin
  }
}

// ── Memberships ─────────────────────────────────────────────────────────────

export async function getMembership(partnerId: string, uid: string): Promise<PartnerMembership | null> {
  const snap = await getDoc(doc(db, 'partnerMemberships', membershipId(partnerId, uid)))
  return snap.exists() ? (snap.data() as PartnerMembership) : null
}

/** Members of one Partner — Admin of that Partner or Platform Admin. */
export async function listPartnerMemberships(partnerId: string): Promise<PartnerMembership[]> {
  const q = query(collection(db, 'partnerMemberships'), where('partnerId', '==', partnerId))
  const snap = await getDocs(q)
  return snap.docs.map(d => d.data() as PartnerMembership)
}

/** One user's memberships in every Partner — Platform Admin only. */
export async function listMembershipsForUser(uid: string): Promise<PartnerMembership[]> {
  const snap = await getDocs(query(collection(db, 'partnerMemberships'), where('uid', '==', uid)))
  return snap.docs.map(d => d.data() as PartnerMembership)
}

/** All memberships across Partners — Platform Admin only. */
export async function listAllMemberships(): Promise<PartnerMembership[]> {
  const snap = await getDocs(collection(db, 'partnerMemberships'))
  return snap.docs.map(d => d.data() as PartnerMembership)
}

/** All global user identities — Platform Admin only. */
export async function listAllUsers(): Promise<UserProfile[]> {
  const snap = await getDocs(collection(db, 'users'))
  return snap.docs.map(d => d.data() as UserProfile)
}

function blankMembership(
  partnerId: string, user: Pick<UserProfile, 'uid' | 'email' | 'displayName' | 'photoURL'>,
  role: PartnerRole, status: MembershipStatus, actorUid: string,
): PartnerMembership {
  const now = new Date().toISOString()
  return {
    id: membershipId(partnerId, user.uid),
    partnerId,
    uid: user.uid,
    email: (user.email ?? '').toLowerCase(),
    displayName: user.displayName ?? '',
    photoURL: user.photoURL ?? '',
    role, status,
    employeeId: '', designation: '', team: '', managerId: '', architectId: '',
    inviteId: '', invitedBy: '', approvedBy: '',
    createdAt: now, updatedAt: now, updatedBy: actorUid,
  }
}

/**
 * Signed-in user without a membership asks for access. Rules only allow a
 * Pending Viewer membership for oneself, and only if the Partner's auth
 * policy allows access requests.
 */
export async function requestAccess(
  partnerId: string, user: Pick<UserProfile, 'uid' | 'email' | 'displayName' | 'photoURL'>,
): Promise<PartnerMembership> {
  const m = blankMembership(partnerId, user, 'Viewer', 'Pending', user.uid)
  await setDoc(doc(db, 'partnerMemberships', m.id), m)
  return m
}

/** Platform Admin: add an existing global user to a Partner. */
export async function createMembership(
  partnerId: string, user: Pick<UserProfile, 'uid' | 'email' | 'displayName' | 'photoURL'>,
  role: PartnerRole, actorUid: string,
): Promise<PartnerMembership> {
  const m = { ...blankMembership(partnerId, user, role, 'Active', actorUid), approvedBy: actorUid }
  await setDoc(doc(db, 'partnerMemberships', m.id), m)
  return m
}

/**
 * Removes a member from one Partner: deletes their membership and, in the
 * same batch, cancels any Pending invitations to their email for that
 * Partner, so an old invite link can't bring them back. Their global account
 * (users/{uid}) and their records in the Partner are kept; they can be added
 * or invited again. Rules: Platform Admin, or an Admin of that Partner for a
 * non-Admin member other than themselves.
 */
export async function removeMembership(
  m: Pick<PartnerMembership, 'partnerId' | 'uid' | 'email'>,
): Promise<{ cancelledInvites: number }> {
  const pending = await getDocs(query(
    collection(db, 'invitations'),
    where('partnerId', '==', m.partnerId),
    where('email', '==', m.email.toLowerCase()),
    where('status', '==', 'Pending'),
  ))
  const batch = writeBatch(db)
  pending.docs.forEach(d => batch.update(d.ref, { status: 'Cancelled' }))
  batch.delete(doc(db, 'partnerMemberships', membershipId(m.partnerId, m.uid)))
  await batch.commit()
  return { cancelledInvites: pending.size }
}

export type MembershipPatch = Partial<Pick<PartnerMembership,
  'role' | 'status' | 'employeeId' | 'designation' | 'team' | 'managerId' | 'architectId' | 'approvedBy'>>

export async function updateMembership(
  partnerId: string, uid: string, patch: MembershipPatch, actorUid: string,
): Promise<void> {
  await updateDoc(doc(db, 'partnerMemberships', membershipId(partnerId, uid)), {
    ...patch,
    updatedAt: new Date().toISOString(),
    updatedBy: actorUid,
  })
}

// ── Invitations ─────────────────────────────────────────────────────────────

/** 256-bit random token, base64url. Used as the invitation document id. */
export function generateInvitationToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let bin = ''
  bytes.forEach(b => { bin += String.fromCharCode(b) })
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export const INVITATION_TTL_DAYS = 7

export async function createPartnerInvitation(input: {
  partnerId: string
  email: string
  name: string
  role: Invitation['role']
  inviterUid: string
  inviterEmail: string
}): Promise<Invitation> {
  const token = generateInvitationToken()
  const now = new Date()
  const expires = new Date(now.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000)
  const inv: Invitation = {
    id: token,
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    role: input.role,
    partnerId: input.partnerId,
    invitedBy: input.inviterUid,
    invitedByEmail: input.inviterEmail,
    status: 'Pending',
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    expiresAtMs: expires.getTime(),
  }
  await setDoc(doc(db, 'invitations', token), inv)
  return inv
}

export async function listPartnerInvitations(partnerId: string): Promise<Invitation[]> {
  const q = query(
    collection(db, 'invitations'),
    where('partnerId', '==', partnerId),
    orderBy('createdAt', 'desc'),
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ ...(d.data() as Invitation), id: d.id }))
}

export async function cancelInvitation(token: string): Promise<void> {
  await updateDoc(doc(db, 'invitations', token), { status: 'Cancelled' })
}

/** Invitee reads their own invitation by token (rules require email match). */
export async function getInvitation(token: string): Promise<Invitation | null> {
  const snap = await getDoc(doc(db, 'invitations', token))
  return snap.exists() ? ({ ...(snap.data() as Invitation), id: snap.id }) : null
}

/**
 * Atomically: mark the invitation Accepted and create/upgrade the caller's
 * membership in the invitation's Partner with the invitation's role.
 * Rules verify every field against the invitation document, so a GAMYAA
 * invitation can only ever produce a GAMYAA membership.
 */
export async function redeemInvitation(
  inv: Invitation,
  user: Pick<UserProfile, 'uid' | 'email' | 'displayName' | 'photoURL'>,
  existing: PartnerMembership | null,
): Promise<PartnerMembership> {
  const now = new Date().toISOString()
  const batch = writeBatch(db)
  batch.update(doc(db, 'invitations', inv.id), {
    status: 'Accepted', acceptedBy: user.uid, acceptedAt: now,
  })

  const mRef = doc(db, 'partnerMemberships', membershipId(inv.partnerId, user.uid))
  let m: PartnerMembership
  if (existing) {
    // Only a Pending request may be upgraded by an invitation (rules enforce).
    const patch = {
      role: inv.role, status: 'Active' as const, inviteId: inv.id,
      invitedBy: inv.invitedBy, approvedBy: inv.invitedBy,
      updatedAt: now, updatedBy: user.uid,
    }
    batch.update(mRef, patch)
    m = { ...existing, ...patch }
  } else {
    m = {
      ...blankMembership(inv.partnerId, user, inv.role, 'Active', user.uid),
      inviteId: inv.id, invitedBy: inv.invitedBy, approvedBy: inv.invitedBy,
    }
    batch.set(mRef, m)
  }
  await batch.commit()
  return m
}

// ── Tenant audit ────────────────────────────────────────────────────────────

export async function writeTenantAudit(entry: {
  uid: string
  userEmail: string
  action: AuditAction
  partnerId: string
  targetType: string
  targetId: string
  details: string
  metadata?: Record<string, string | number | boolean>
}): Promise<void> {
  await addDoc(collection(db, 'auditLogs'), {
    ...entry,
    resource: `${entry.targetType}/${entry.targetId}`,
    host: typeof window !== 'undefined' ? window.location.hostname : '',
    timestamp: new Date().toISOString(),
  })
}
