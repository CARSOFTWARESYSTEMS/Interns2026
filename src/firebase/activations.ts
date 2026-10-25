// ── User activations (read only) ────────────────────────────────────────────
//
// userActivations/{partnerId}_{uid} are written only by the /api/auth
// function when a sign-in completes. firestore.rules let a Platform Admin
// read every Partner's and a Partner Admin read their own Partner's; a
// Partner Admin's query must therefore filter on partnerId.

import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from './config'
import { activationId, type UserActivation } from '../types/activation'

/** One Partner's users (Admin of that Partner or Platform Admin), or every Partner's (null: Platform Admin). */
export async function listActivations(partnerId: string | null): Promise<UserActivation[]> {
  const ref = collection(db, 'userActivations')
  const snap = await getDocs(partnerId ? query(ref, where('partnerId', '==', partnerId)) : ref)
  return snap.docs.map(d => d.data() as UserActivation)
}

/** One user in one Partner, or null when they have never signed in there. */
export async function getActivation(partnerId: string, uid: string): Promise<UserActivation | null> {
  const snap = await getDoc(doc(db, 'userActivations', activationId(partnerId, uid)))
  return snap.exists() ? (snap.data() as UserActivation) : null
}

/** One user in every Partner — Platform Admin only. */
export async function listActivationsForUser(uid: string): Promise<UserActivation[]> {
  const snap = await getDocs(query(collection(db, 'userActivations'), where('uid', '==', uid)))
  return snap.docs.map(d => d.data() as UserActivation)
}
