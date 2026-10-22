// ── Offer Letter Draft Review ──────────────────────────────────────────────
//
// A Partner Admin / HR Manager uploads a draft offer letter (PDF) for a
// candidate's email; the candidate signs in on the Partner's domain, reviews
// it and confirms. Deliberately small: no approval chains, no e-signature.
//
// Firestore: offerDrafts/{offerId}
// Storage:   partners/{partnerId}/offerDrafts/{offerId}/{version}-{fileName}
//
// Spec field → field here:
//   partner_id → partnerId · viewer_email → viewerEmail · file_reference → file
//   status → status · created_by → createdBy · created_at → createdAt
//   updated_at → updatedAt · confirmed_at → confirmedAt

export type OfferDraftStatus = 'Draft' | 'In Review' | 'Confirmed'

export const OFFER_STATUSES: readonly OfferDraftStatus[] = ['Draft', 'In Review', 'Confirmed']

/** Reference to the stored PDF. Only the storage PATH is kept — never a public download URL. */
export interface OfferFileReference {
  path: string
  name: string
  size: number
  contentType: string
  uploadedAt: string
}

export interface OfferDraft {
  id: string
  partnerId: string
  viewerEmail: string          // lowercase; the only person who may view/confirm
  candidateName: string
  file: OfferFileReference
  version: number              // increments on Replace Draft
  status: OfferDraftStatus
  createdBy: string            // uid
  createdByEmail: string
  createdAt: string
  updatedAt: string
  sentForReviewAt: string      // '' until sent
  /** Server timestamp (Firestore Timestamp) once confirmed; null before. */
  confirmedAt: { toDate(): Date } | null
  confirmedBy: string          // uid of the confirming candidate
}

export const OFFER_MAX_BYTES = 10 * 1024 * 1024
export const LOGO_MAX_BYTES = 2 * 1024 * 1024

export const OFFER_CONFIRMATION_TEXT =
  'I have reviewed the draft offer letter and confirm that the details are correct.'

/** Storage-safe file name (keeps the extension, strips anything path-like). */
export function safeFileName(name: string): string {
  const cleaned = name.normalize('NFKD').replace(/[^\w.\- ]+/g, '').replace(/\s+/g, '-').replace(/^\.+/, '')
  return (cleaned || 'offer-letter.pdf').slice(-120)
}

export function isPdf(file: { type: string; name: string }): boolean {
  return file.type === 'application/pdf' && /\.pdf$/i.test(file.name)
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(email.trim())
}
