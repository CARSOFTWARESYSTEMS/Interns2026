// ── Offer Letter Draft Review — Firestore + Storage service ────────────────
//
// Security is enforced by firestore.rules (offerDrafts) and storage.rules
// (partners/{pid}/offerDrafts/**). This module never creates public download
// URLs for offer PDFs: files are fetched with getBlob(), which is authorised
// by storage.rules on every request, so a copied link can't leak a letter.

import {
  collection, doc, getDocs, query, setDoc, updateDoc, where, orderBy, serverTimestamp,
} from 'firebase/firestore'
import { ref, uploadBytes, getBlob, deleteObject, getDownloadURL } from 'firebase/storage'
import { db, storage } from './config'
import { requirePartnerId } from '../tenant/session'
import {
  OFFER_MAX_BYTES, LOGO_MAX_BYTES, isPdf, isValidEmail, safeFileName,
  type OfferDraft, type OfferFileReference,
} from '../types/offers'

const COL = 'offerDrafts'

function storagePath(partnerId: string, offerId: string, version: number, fileName: string): string {
  return `partners/${partnerId}/offerDrafts/${offerId}/${version}-${safeFileName(fileName)}`
}

function assertPdf(file: File): void {
  if (!isPdf(file)) throw new Error('Please choose a PDF file.')
  if (file.size > OFFER_MAX_BYTES) throw new Error('The PDF must be 10 MB or smaller.')
}

async function uploadPdf(path: string, file: File, partnerId: string, offerId: string): Promise<OfferFileReference> {
  await uploadBytes(ref(storage, path), file, {
    contentType: 'application/pdf',
    customMetadata: { partnerId, offerId },
  })
  return { path, name: file.name, size: file.size, contentType: 'application/pdf', uploadedAt: new Date().toISOString() }
}

// ── Admin / HR (Partner-scoped through the active tenant session) ─────────

export async function listPartnerOffers(): Promise<OfferDraft[]> {
  const q = query(collection(db, COL), where('partnerId', '==', requirePartnerId()), orderBy('updatedAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => d.data() as OfferDraft)
}

export async function createOfferDraft(input: {
  file: File
  viewerEmail: string
  candidateName: string
  actor: { uid: string; email: string }
}): Promise<OfferDraft> {
  assertPdf(input.file)
  const email = input.viewerEmail.trim().toLowerCase()
  if (!isValidEmail(email)) throw new Error('Enter a valid email address.')

  const partnerId = requirePartnerId()
  const docRef = doc(collection(db, COL))
  const path = storagePath(partnerId, docRef.id, 1, input.file.name)
  const fileRef = await uploadPdf(path, input.file, partnerId, docRef.id)

  const now = new Date().toISOString()
  const offer: OfferDraft = {
    id: docRef.id,
    partnerId,
    viewerEmail: email,
    candidateName: input.candidateName.trim(),
    file: fileRef,
    version: 1,
    status: 'Draft',
    createdBy: input.actor.uid,
    createdByEmail: input.actor.email,
    createdAt: now,
    updatedAt: now,
    sentForReviewAt: '',
    confirmedAt: null,
    confirmedBy: '',
  }
  try {
    await setDoc(docRef, offer)
  } catch (e) {
    await deleteObject(ref(storage, path)).catch(() => {})   // don't leave an orphaned file
    throw e
  }
  return offer
}

/** Replace the PDF. Returns the draft to Draft status (it must be sent again). Confirmed offers are locked. */
export async function replaceOfferDraft(offer: OfferDraft, file: File): Promise<OfferDraft> {
  assertPdf(file)
  if (offer.status === 'Confirmed') throw new Error('A confirmed offer letter cannot be replaced.')
  const version = offer.version + 1
  const path = storagePath(offer.partnerId, offer.id, version, file.name)
  const fileRef = await uploadPdf(path, file, offer.partnerId, offer.id)
  const patch = { file: fileRef, version, status: 'Draft' as const, sentForReviewAt: '', updatedAt: new Date().toISOString() }
  await updateDoc(doc(db, COL, offer.id), patch)
  await deleteObject(ref(storage, offer.file.path)).catch(() => {})
  return { ...offer, ...patch }
}

export async function sendOfferForReview(offer: OfferDraft): Promise<OfferDraft> {
  const now = new Date().toISOString()
  const patch = { status: 'In Review' as const, sentForReviewAt: now, updatedAt: now }
  await updateDoc(doc(db, COL, offer.id), patch)
  return { ...offer, ...patch }
}

// ── Candidate (viewer) ─────────────────────────────────────────────────────

/**
 * Offers sent to the signed-in email in the hostname's Partner. Drafts not yet
 * sent for review are never visible to the candidate (rules enforce it too).
 * The partnerId is the HOSTNAME's Partner: candidates are usually not members.
 */
export async function listMyOffers(partnerId: string, email: string): Promise<OfferDraft[]> {
  const q = query(
    collection(db, COL),
    where('partnerId', '==', partnerId),
    where('viewerEmail', '==', email.trim().toLowerCase()),
    where('status', 'in', ['In Review', 'Confirmed']),
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => d.data() as OfferDraft).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

/** Candidate confirms. confirmedAt is the SERVER time (rules require it). */
export async function confirmOffer(offer: OfferDraft, uid: string): Promise<void> {
  await updateDoc(doc(db, COL, offer.id), {
    status: 'Confirmed',
    confirmedAt: serverTimestamp(),
    confirmedBy: uid,
    updatedAt: new Date().toISOString(),
  })
}

// ── File access (rules-checked, no bearer links) ───────────────────────────

export async function fetchOfferPdf(offer: OfferDraft): Promise<Blob> {
  const blob = await getBlob(ref(storage, offer.file.path))
  return blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' })
}

/**
 * Opens the PDF in a new tab. The tab is opened synchronously (before the
 * download) so popup blockers allow it; the object URL is revoked later.
 */
/**
 * Human-readable reason a PDF couldn't be fetched. The raw error is logged so
 * the browser console shows the Storage code (e.g. a CORS / network failure
 * surfaces as storage/unknown or storage/retry-limit-exceeded).
 */
export function offerFileErrorMessage(e: unknown): string {
  console.error('[offer pdf]', e)
  const code = (e as { code?: string })?.code ?? ''
  if (code === 'storage/unauthorized') return 'You don’t have access to this document. Make sure you’re signed in with the email the offer was sent to.'
  if (code === 'storage/object-not-found') return 'This document is no longer available. Please contact the sender.'
  return 'The document couldn’t be downloaded. Check your connection and try again; if it keeps failing, contact the sender.'
}

export async function openOfferPdf(offer: OfferDraft): Promise<void> {
  const win = window.open('', '_blank')
  try {
    const url = URL.createObjectURL(await fetchOfferPdf(offer))
    if (win) win.location.href = url
    else window.location.assign(url)
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (e) {
    win?.close()
    throw e
  }
}

export async function downloadOfferPdf(offer: OfferDraft): Promise<void> {
  const url = URL.createObjectURL(await fetchOfferPdf(offer))
  const a = document.createElement('a')
  a.href = url
  a.download = offer.file.name || 'offer-letter.pdf'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

// ── Partner logo (public branding asset) ───────────────────────────────────

const LOGO_TYPES: Record<string, string> = { 'image/png': 'png', 'image/svg+xml': 'svg', 'image/webp': 'webp', 'image/jpeg': 'jpg' }

/**
 * Uploads a logo and stores its https URL in partners/{id}.branding. Logos are
 * public by design (they appear on the login page before sign-in).
 */
export async function uploadPartnerLogo(partnerId: string, file: File, variant: 'logoUrl' | 'logoDarkUrl', actorUid: string): Promise<string> {
  const ext = LOGO_TYPES[file.type]
  if (!ext) throw new Error('Use a PNG, SVG, WebP or JPEG image.')
  if (file.size > LOGO_MAX_BYTES) throw new Error('The logo must be 2 MB or smaller.')
  const r = ref(storage, `partners/${partnerId}/branding/${variant === 'logoUrl' ? 'logo' : 'logo-dark'}-${Date.now()}.${ext}`)
  await uploadBytes(r, file, { contentType: file.type, cacheControl: 'public,max-age=3600' })
  const url = await getDownloadURL(r)
  await updateDoc(doc(db, 'partners', partnerId), {
    [`branding.${variant}`]: url,
    updatedAt: new Date().toISOString(),
    updatedBy: actorUid,
  })
  return url
}

export async function clearPartnerLogo(partnerId: string, variant: 'logoUrl' | 'logoDarkUrl', actorUid: string): Promise<void> {
  await updateDoc(doc(db, 'partners', partnerId), {
    [`branding.${variant}`]: '',
    updatedAt: new Date().toISOString(),
    updatedBy: actorUid,
  })
}
