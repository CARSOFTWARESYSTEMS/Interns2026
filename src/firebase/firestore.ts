import {
  doc, getDoc, setDoc, updateDoc, addDoc,
  collection, query, where, orderBy, limit,
  getDocs, serverTimestamp, Timestamp,
  type DocumentData,
} from 'firebase/firestore'
import { db } from './config'
import type {
  UserProfile, UserSkills, UserResume, Organization,
  OrganizationMember, AuditLog, AuditAction,
  LoginHistory,
} from '../types/auth'

// ── Users ──────────────────────────────────────────────────────────────────

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? (snap.data() as UserProfile) : null
}

export async function createUserProfile(profile: UserProfile): Promise<void> {
  await setDoc(doc(db, 'users', profile.uid), profile)
}

export async function updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    ...data,
    updatedAt: new Date().toISOString(),
  })
}

/** Platform Admin only (rules). Partner Admins list partnerMemberships instead. */
export async function getAllUsers(): Promise<UserProfile[]> {
  const snap = await getDocs(collection(db, 'users'))
  return snap.docs.map(d => d.data() as UserProfile)
}

// ── Skills ─────────────────────────────────────────────────────────────────

export async function getUserSkills(uid: string): Promise<UserSkills | null> {
  const snap = await getDoc(doc(db, 'userSkills', uid))
  return snap.exists() ? (snap.data() as UserSkills) : null
}

export async function setUserSkills(uid: string, skills: UserSkills): Promise<void> {
  await setDoc(doc(db, 'userSkills', uid), skills)
}

// ── Resume ─────────────────────────────────────────────────────────────────

export async function getUserResume(uid: string): Promise<UserResume | null> {
  const snap = await getDoc(doc(db, 'userResumes', uid))
  return snap.exists() ? (snap.data() as UserResume) : null
}

export async function setUserResume(uid: string, resume: UserResume): Promise<void> {
  await setDoc(doc(db, 'userResumes', uid), resume)
}

// ── Organization ───────────────────────────────────────────────────────────

export async function getOrganization(orgId: string): Promise<Organization | null> {
  const snap = await getDoc(doc(db, 'organizations', orgId))
  return snap.exists() ? (snap.data() as Organization) : null
}

export async function getOrgMembers(orgId: string): Promise<OrganizationMember[]> {
  const q = query(collection(db, 'organizationMembers'), where('orgId', '==', orgId))
  const snap = await getDocs(q)
  return snap.docs.map(d => d.data() as OrganizationMember)
}

export async function setOrgMember(member: OrganizationMember): Promise<void> {
  const id = `${member.orgId}_${member.uid}`
  await setDoc(doc(db, 'organizationMembers', id), member)
}

// ── Audit Logs ─────────────────────────────────────────────────────────────

export async function writeAuditLog(
  log: Omit<AuditLog, 'id' | 'timestamp'>
): Promise<void> {
  await addDoc(collection(db, 'auditLogs'), {
    ...log,
    timestamp: new Date().toISOString(),
  })
}

export async function getAuditLogs(uid: string, maxResults = 20): Promise<AuditLog[]> {
  const q = query(
    collection(db, 'auditLogs'),
    where('uid', '==', uid),
    orderBy('timestamp', 'desc'),
    limit(maxResults)
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as AuditLog)
}

// ── Login History ──────────────────────────────────────────────────────────

export async function writeLoginHistory(entry: Omit<LoginHistory, 'id'>): Promise<void> {
  await addDoc(collection(db, 'loginHistory'), entry)
}

export async function getLoginHistory(uid: string, maxResults = 10): Promise<LoginHistory[]> {
  const q = query(
    collection(db, 'loginHistory'),
    where('uid', '==', uid),
    orderBy('loginAt', 'desc'),
    limit(maxResults)
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as LoginHistory)
}

// ── Invitations ────────────────────────────────────────────────────────────
// Partner-scoped invitations live in src/firebase/partners.ts
// (createPartnerInvitation / listPartnerInvitations / redeemInvitation).

// ── Role Management ────────────────────────────────────────────────────────
// Roles are Partner-scoped and live on partnerMemberships — see
// src/firebase/partners.ts (updateMembership / createMembership).
// users/{uid}.role is legacy, locked by firestore.rules, and no longer written.
