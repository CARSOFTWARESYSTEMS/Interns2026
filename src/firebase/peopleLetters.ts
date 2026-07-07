import {
  doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc,
  collection, query, where, orderBy, runTransaction,
  getDocs,
} from 'firebase/firestore'
import { db } from './config'
import type {
  PeopleLetterTemplate, PeopleGeneratedLetter, PeopleLetterApproval,
  PeopleLetterCounter, PeopleLetterAuditLog, PeopleLetterAuditAction,
  LetterType, LetterStatus,
} from '../types/peopleLetters'
import { DEFAULT_PARTNER_ID, DEFAULT_ORGANISATION_ID, letterDocPrefix } from '../types/peopleLetters'

// ── Envelope helper (mirrors src/firebase/people.ts) ─────────────────────────

function withEnvelope<T extends Record<string, unknown>>(
  data: T,
  createdBy: string,
  status: string
) {
  const now = new Date().toISOString()
  return {
    ...data,
    partnerId: DEFAULT_PARTNER_ID,
    organisationId: DEFAULT_ORGANISATION_ID,
    createdAt: now,
    updatedAt: now,
    createdBy,
    status,
  }
}

async function touch(collectionName: string, id: string, data: Record<string, unknown>) {
  await updateDoc(doc(db, collectionName, id), {
    ...data,
    updatedAt: new Date().toISOString(),
  })
}

// ── Audit logs ─────────────────────────────────────────────────────────────

const LETTER_AUDIT = 'peopleLetterAuditLogs'

export async function writeLetterAuditLog(
  log: { uid: string; action: PeopleLetterAuditAction; resource: string; details: string }
): Promise<void> {
  await addDoc(collection(db, LETTER_AUDIT), withEnvelope(log, log.uid, 'logged'))
}

export async function getLetterAuditLogs(maxResults = 50): Promise<PeopleLetterAuditLog[]> {
  const snap = await getDocs(query(collection(db, LETTER_AUDIT), orderBy('createdAt', 'desc')))
  return snap.docs.slice(0, maxResults).map(d => d.data() as PeopleLetterAuditLog)
}

// ── Templates ──────────────────────────────────────────────────────────────
// A single reusable template drives every generated letter. Stored under a
// fixed id ("default") since People Ops asked for "reusable templates" that
// HR configures once and reuses per candidate, not one template per letter.

const TEMPLATES = 'peopleLetterTemplates'
const DEFAULT_TEMPLATE_ID = 'default'

export async function getDefaultLetterTemplate(): Promise<PeopleLetterTemplate | null> {
  const snap = await getDoc(doc(db, TEMPLATES, DEFAULT_TEMPLATE_ID))
  return snap.exists() ? (snap.data() as PeopleLetterTemplate) : null
}

export async function upsertDefaultLetterTemplate(
  template: Omit<PeopleLetterTemplate, 'id' | 'partnerId' | 'organisationId' | 'createdAt' | 'updatedAt' | 'status' | 'createdBy'>,
  updatedBy: string
): Promise<void> {
  const ref = doc(db, TEMPLATES, DEFAULT_TEMPLATE_ID)
  const existing = await getDoc(ref)
  const now = new Date().toISOString()
  if (existing.exists()) {
    await updateDoc(ref, { ...template, updatedAt: now })
  } else {
    await setDoc(ref, {
      ...template,
      id: DEFAULT_TEMPLATE_ID,
      partnerId: DEFAULT_PARTNER_ID,
      organisationId: DEFAULT_ORGANISATION_ID,
      createdAt: now,
      updatedAt: now,
      createdBy: updatedBy,
      status: 'active',
    })
  }
  await writeLetterAuditLog({ uid: updatedBy, action: 'template_updated', resource: `templates/${DEFAULT_TEMPLATE_ID}`, details: 'Letter template configuration updated' })
}

// ── Document ID counters ──────────────────────────────────────────────────────

async function nextDocumentId(letterType: LetterType): Promise<string> {
  const year = new Date().getFullYear()
  const counterId = `${letterType}-${year}`
  const ref = doc(db, 'peopleLetterCounters', counterId)

  const nextCount = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    const current = snap.exists() ? (snap.data() as PeopleLetterCounter).count : 0
    const updated = current + 1
    tx.set(ref, {
      id: counterId, letterType, year, count: updated,
      updatedAt: new Date().toISOString(),
    })
    return updated
  })

  const padded = String(nextCount).padStart(3, '0')
  return `ITEL-EV-INT-${letterDocPrefix(letterType)}-${year}-${padded}`
}

// ── Generated letters ────────────────────────────────────────────────────────

const LETTERS = 'peopleGeneratedLetters'

export type NewLetterInput = Omit<
  PeopleGeneratedLetter,
  | 'id' | 'partnerId' | 'organisationId' | 'createdAt' | 'updatedAt' | 'status' | 'createdBy'
  | 'documentId' | 'approvedBy' | 'approvedAt' | 'generatedBy' | 'generatedAt'
  | 'pdfUrl' | 'pdfStoragePath' | 'rejectionReason'
>

export async function createDraftLetter(input: NewLetterInput, createdBy: string): Promise<string> {
  const documentId = await nextDocumentId(input.letterType)
  const payload = {
    ...input,
    documentId,
    approvedBy: '', approvedAt: '',
    generatedBy: '', generatedAt: '',
    pdfUrl: '', pdfStoragePath: '',
    rejectionReason: '',
  }
  const ref = await addDoc(collection(db, LETTERS), withEnvelope(payload, createdBy, 'Draft' satisfies LetterStatus))
  await updateDoc(ref, { id: ref.id })
  await writeLetterAuditLog({
    uid: createdBy, action: 'letter_drafted', resource: `letters/${ref.id}`,
    details: `${input.letterType === 'offer' ? 'Offer' : 'Joining'} letter drafted for ${input.candidateName} (${documentId})`,
  })
  return ref.id
}

export async function getLetter(id: string): Promise<PeopleGeneratedLetter | null> {
  const snap = await getDoc(doc(db, LETTERS, id))
  return snap.exists() ? (snap.data() as PeopleGeneratedLetter) : null
}

export async function getAllLetters(): Promise<PeopleGeneratedLetter[]> {
  const snap = await getDocs(query(collection(db, LETTERS), orderBy('createdAt', 'desc')))
  return snap.docs.map(d => d.data() as PeopleGeneratedLetter)
}

export async function getLettersByType(letterType: LetterType): Promise<PeopleGeneratedLetter[]> {
  const q = query(collection(db, LETTERS), where('letterType', '==', letterType), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => d.data() as PeopleGeneratedLetter)
}

export async function submitLetterForApproval(id: string, performedBy: string): Promise<void> {
  await touch(LETTERS, id, { status: 'Submitted for Approval' satisfies LetterStatus })
  await writeLetterAuditLog({ uid: performedBy, action: 'letter_submitted', resource: `letters/${id}`, details: 'Submitted for approval' })
}

export async function approveLetter(id: string, approvedBy: string): Promise<void> {
  const letter = await getLetter(id)
  if (!letter) throw new Error('Letter not found')
  const now = new Date().toISOString()
  await touch(LETTERS, id, { status: 'Approved' satisfies LetterStatus, approvedBy, approvedAt: now })
  await addDoc(collection(db, 'peopleLetterApprovals'), withEnvelope(
    { letterId: id, letterType: letter.letterType, decision: 'Approved', decidedBy: approvedBy, decidedAt: now, comments: '' },
    approvedBy, 'logged',
  ))
  await writeLetterAuditLog({ uid: approvedBy, action: 'letter_approved', resource: `letters/${id}`, details: 'Letter approved' })
}

export async function rejectLetter(id: string, rejectedBy: string, reason: string): Promise<void> {
  const letter = await getLetter(id)
  if (!letter) throw new Error('Letter not found')
  await touch(LETTERS, id, { status: 'Rejected' satisfies LetterStatus, rejectionReason: reason })
  await addDoc(collection(db, 'peopleLetterApprovals'), withEnvelope(
    { letterId: id, letterType: letter.letterType, decision: 'Rejected', decidedBy: rejectedBy, decidedAt: new Date().toISOString(), comments: reason },
    rejectedBy, 'logged',
  ))
  await writeLetterAuditLog({ uid: rejectedBy, action: 'letter_rejected', resource: `letters/${id}`, details: `Letter rejected: ${reason || 'no reason given'}` })
}

/**
 * PDF generation is only permitted once a letter has been Approved (or is
 * already further along the workflow, e.g. re-downloading). This is the
 * server-side-equivalent guard backing the "no PDF before approval" rule —
 * the UI also disables the action, but this throws if called out of order.
 */
export async function markPdfGenerated(
  id: string, generatedBy: string, pdfStoragePath: string
): Promise<void> {
  const letter = await getLetter(id)
  if (!letter) throw new Error('Letter not found')
  const allowedFrom: LetterStatus[] = ['Approved', 'PDF Generated', 'Sent', 'Downloaded']
  if (!allowedFrom.includes(letter.status as LetterStatus)) {
    throw new Error('PDF generation is only allowed after the letter has been approved')
  }
  await touch(LETTERS, id, {
    status: 'PDF Generated' satisfies LetterStatus,
    generatedBy, generatedAt: new Date().toISOString(),
    pdfStoragePath, pdfUrl: '',
  })
  await writeLetterAuditLog({ uid: generatedBy, action: 'pdf_generated', resource: `letters/${id}`, details: `PDF generated at ${pdfStoragePath}` })
}

export async function markLetterSent(id: string, performedBy: string): Promise<void> {
  await touch(LETTERS, id, { status: 'Sent' satisfies LetterStatus })
  await writeLetterAuditLog({ uid: performedBy, action: 'letter_sent', resource: `letters/${id}`, details: 'Marked as sent to candidate' })
}

export async function markLetterDownloaded(id: string, performedBy: string): Promise<void> {
  await touch(LETTERS, id, { status: 'Downloaded' satisfies LetterStatus })
  await writeLetterAuditLog({ uid: performedBy, action: 'letter_downloaded', resource: `letters/${id}`, details: 'Marked as downloaded' })
}

/** Only valid for offer letters — unlocks joining-letter creation for the candidate. */
export async function markOfferAccepted(id: string, performedBy: string): Promise<void> {
  await touch(LETTERS, id, { status: 'Accepted' satisfies LetterStatus })
  await writeLetterAuditLog({ uid: performedBy, action: 'letter_accepted', resource: `letters/${id}`, details: 'Offer marked as accepted by candidate' })
}

export async function deleteLetter(id: string): Promise<void> {
  await deleteDoc(doc(db, LETTERS, id))
}

// ── Approvals ──────────────────────────────────────────────────────────────

export async function getApprovalsForLetter(letterId: string): Promise<PeopleLetterApproval[]> {
  const q = query(collection(db, 'peopleLetterApprovals'), where('letterId', '==', letterId), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => d.data() as PeopleLetterApproval)
}
