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
import {
  DEFAULT_PARTNER_ID, DEFAULT_ORGANISATION_ID, letterDocPrefix, emptyLetterTemplate,
} from '../types/peopleLetters'

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
// Multiple reusable, versioned templates (PEOPLE-003) live in this same
// collection. A "template" as HR thinks of it is a `templateGroupId`; saving
// a new version writes a NEW doc sharing that group id with an incremented
// `version` and `isLatest: true`, flipping the previous latest doc to false.
//
// Backward compatible with the PEOPLE-002 single fixed-id doc
// ("peopleLetterTemplates/default", predating branding/versioning fields):
// normalizeTemplate() fills in sane defaults for any missing field, so that
// legacy doc keeps working, unmigrated, forever — it's just read as v1.0 of
// the "default" group.

const TEMPLATES = 'peopleLetterTemplates'
const DEFAULT_TEMPLATE_ID = 'default'

function normalizeTemplate(raw: Record<string, unknown>): PeopleLetterTemplate {
  const defaults = emptyLetterTemplate()
  const template = {
    ...defaults,
    ...raw,
    brandColors: { ...defaults.brandColors, ...((raw.brandColors as object) ?? {}) },
  } as PeopleLetterTemplate
  template.templateGroupId = (raw.templateGroupId as string) || (raw.id as string) || DEFAULT_TEMPLATE_ID
  template.isDefault = raw.isDefault !== undefined ? Boolean(raw.isDefault) : raw.id === DEFAULT_TEMPLATE_ID
  return template
}

function bumpVersion(version: string): string {
  const [major, minor] = version.split('.').map(n => Number(n) || 0)
  return `${major}.${minor + 1}`
}

/** Every latest, non-deleted template — one row per templateGroupId. */
export async function getAllTemplates(): Promise<PeopleLetterTemplate[]> {
  const snap = await getDocs(collection(db, TEMPLATES))
  return snap.docs
    .map(d => normalizeTemplate(d.data()))
    .filter(t => t.isLatest && !t.deletedAt)
    .sort((a, b) => a.templateName.localeCompare(b.templateName))
}

/** Latest-version templates that are archived and/or soft-deleted — for the "Archived & Deleted" panel. */
export async function getArchivedOrDeletedTemplates(): Promise<PeopleLetterTemplate[]> {
  const snap = await getDocs(collection(db, TEMPLATES))
  return snap.docs
    .map(d => normalizeTemplate(d.data()))
    .filter(t => t.isLatest && (t.isArchived || t.deletedAt))
    .sort((a, b) => a.templateName.localeCompare(b.templateName))
}

/** All versions (across time) for one templateGroupId, newest first. */
export async function getTemplateVersionHistory(templateGroupId: string): Promise<PeopleLetterTemplate[]> {
  const snap = await getDocs(collection(db, TEMPLATES))
  return snap.docs
    .map(d => normalizeTemplate(d.data()))
    .filter(t => t.templateGroupId === templateGroupId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getTemplate(id: string): Promise<PeopleLetterTemplate | null> {
  const snap = await getDoc(doc(db, TEMPLATES, id))
  return snap.exists() ? normalizeTemplate(snap.data()) : null
}

/** The template every offer/joining letter draft defaults to. */
export async function getDefaultLetterTemplate(): Promise<PeopleLetterTemplate | null> {
  const all = await getAllTemplates()
  const active = all.filter(t => !t.isArchived)
  return active.find(t => t.isDefault) ?? active[0] ?? all[0] ?? null
}

type TemplateInput = Omit<
  PeopleLetterTemplate,
  'id' | 'partnerId' | 'organisationId' | 'createdAt' | 'updatedAt' | 'status' | 'createdBy'
  | 'templateGroupId' | 'version' | 'isLatest'
>

export async function createTemplate(template: TemplateInput, createdBy: string): Promise<string> {
  const ref = await addDoc(collection(db, TEMPLATES), withEnvelope(
    { ...template, version: '1.0', isLatest: true }, createdBy, 'active',
  ))
  await updateDoc(ref, { id: ref.id, templateGroupId: ref.id })
  await writeLetterAuditLog({ uid: createdBy, action: 'template_created', resource: `templates/${ref.id}`, details: `Template "${template.templateName}" created` })
  return ref.id
}

export async function saveNewTemplateVersion(
  templateGroupId: string, template: TemplateInput, updatedBy: string, versionNote = '',
): Promise<string> {
  const history = await getTemplateVersionHistory(templateGroupId)
  const currentLatest = history.find(t => t.isLatest)
  const nextVersion = bumpVersion(currentLatest?.version ?? '1.0')
  if (currentLatest) {
    await updateDoc(doc(db, TEMPLATES, currentLatest.id), { isLatest: false, updatedAt: new Date().toISOString() })
  }
  const ref = await addDoc(collection(db, TEMPLATES), withEnvelope(
    { ...template, templateGroupId, version: nextVersion, isLatest: true, versionNote }, updatedBy, 'active',
  ))
  await updateDoc(ref, { id: ref.id })
  await writeLetterAuditLog({ uid: updatedBy, action: 'template_version_created', resource: `templates/${ref.id}`, details: `Template "${template.templateName}" saved as version ${nextVersion}` })
  return ref.id
}

/** Legacy single-template save path — kept for backward compatibility. New UI uses createTemplate / saveNewTemplateVersion. */
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

export async function cloneTemplate(id: string, createdBy: string): Promise<string> {
  const source = await getTemplate(id)
  if (!source) throw new Error('Template not found')
  const {
    id: _id, partnerId: _p, organisationId: _o, createdAt: _c, updatedAt: _u, status: _s, createdBy: _cb,
    templateGroupId: _tg, version: _v, isLatest: _il, ...rest
  } = source
  const newId = await createTemplate({
    ...rest,
    templateName: `${source.templateName} (Copy)`,
    isDefault: false,
    isArchived: false,
    deletedAt: '',
    versionNote: `Cloned from ${source.templateName} v${source.version}`,
  }, createdBy)
  await writeLetterAuditLog({ uid: createdBy, action: 'template_cloned', resource: `templates/${newId}`, details: `Cloned from templates/${id}` })
  return newId
}

export async function setTemplateActive(id: string, isActive: boolean): Promise<void> {
  await touch(TEMPLATES, id, { isActive })
}

export async function archiveTemplate(id: string, performedBy: string): Promise<void> {
  await touch(TEMPLATES, id, { isArchived: true })
  await writeLetterAuditLog({ uid: performedBy, action: 'template_archived', resource: `templates/${id}`, details: 'Template archived' })
}

export async function unarchiveTemplate(id: string, performedBy: string): Promise<void> {
  await touch(TEMPLATES, id, { isArchived: false })
  await writeLetterAuditLog({ uid: performedBy, action: 'template_restored', resource: `templates/${id}`, details: 'Template unarchived' })
}

export async function softDeleteTemplate(id: string, performedBy: string): Promise<void> {
  await touch(TEMPLATES, id, { deletedAt: new Date().toISOString() })
  await writeLetterAuditLog({ uid: performedBy, action: 'template_deleted', resource: `templates/${id}`, details: 'Template soft-deleted' })
}

export async function restoreTemplate(id: string, performedBy: string): Promise<void> {
  await touch(TEMPLATES, id, { deletedAt: '' })
  await writeLetterAuditLog({ uid: performedBy, action: 'template_restored', resource: `templates/${id}`, details: 'Template restored from soft delete' })
}

export async function setDefaultTemplate(templateGroupId: string, performedBy: string): Promise<void> {
  const all = await getAllTemplates()
  await Promise.all(all
    .filter(t => t.isDefault !== (t.templateGroupId === templateGroupId))
    .map(t => updateDoc(doc(db, TEMPLATES, t.id), {
      isDefault: t.templateGroupId === templateGroupId, updatedAt: new Date().toISOString(),
    })))
  await writeLetterAuditLog({ uid: performedBy, action: 'template_set_default', resource: `templates/${templateGroupId}`, details: 'Set as default template' })
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
  | 'isDisabled' | 'isArchived' | 'deletedAt'
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
    isDisabled: false, isArchived: false, deletedAt: '',
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
  // Deliberately no `orderBy` alongside this `where` — combining an equality
  // filter with an orderBy on a different field requires a Firestore
  // composite index that doesn't exist (and shouldn't need to, for a
  // collection this size). Sort client-side instead.
  const q = query(collection(db, LETTERS), where('letterType', '==', letterType))
  const snap = await getDocs(q)
  return snap.docs
    .map(d => d.data() as PeopleGeneratedLetter)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
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

// ── Generated-document lifecycle (PEOPLE-003) ───────────────────────────────
// Regenerate/disable/archive/soft-delete/restore sit alongside (not instead
// of) the Draft→...→Accepted workflow above — they manage visibility and
// housekeeping of already-generated documents, not the approval workflow.

export async function regenerateLetterPdf(id: string, performedBy: string): Promise<void> {
  await writeLetterAuditLog({ uid: performedBy, action: 'document_regenerated', resource: `letters/${id}`, details: 'PDF regenerated' })
}

export async function setLetterDisabled(id: string, isDisabled: boolean, performedBy: string): Promise<void> {
  await touch(LETTERS, id, { isDisabled })
  await writeLetterAuditLog({ uid: performedBy, action: 'document_disabled', resource: `letters/${id}`, details: isDisabled ? 'Document disabled' : 'Document enabled' })
}

export async function setLetterArchived(id: string, isArchived: boolean, performedBy: string): Promise<void> {
  await touch(LETTERS, id, { isArchived })
  await writeLetterAuditLog({ uid: performedBy, action: 'document_archived', resource: `letters/${id}`, details: isArchived ? 'Document archived' : 'Document unarchived' })
}

export async function softDeleteGeneratedLetter(id: string, performedBy: string): Promise<void> {
  await touch(LETTERS, id, { deletedAt: new Date().toISOString() })
  await writeLetterAuditLog({ uid: performedBy, action: 'document_soft_deleted', resource: `letters/${id}`, details: 'Document soft-deleted' })
}

export async function restoreGeneratedLetter(id: string, performedBy: string): Promise<void> {
  await touch(LETTERS, id, { deletedAt: '' })
  await writeLetterAuditLog({ uid: performedBy, action: 'document_restored', resource: `letters/${id}`, details: 'Document restored' })
}

/** Audit trail for a single template or letter, e.g. `letters/{id}` or `templates/{id}`. */
export async function getAuditLogsForResource(resource: string): Promise<PeopleLetterAuditLog[]> {
  const q = query(collection(db, LETTER_AUDIT), where('resource', '==', resource))
  const snap = await getDocs(q)
  return snap.docs
    .map(d => d.data() as PeopleLetterAuditLog)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

// ── Approvals ──────────────────────────────────────────────────────────────

export async function getApprovalsForLetter(letterId: string): Promise<PeopleLetterApproval[]> {
  // No composite index needed — see getLettersByType for why orderBy is dropped here too.
  const q = query(collection(db, 'peopleLetterApprovals'), where('letterId', '==', letterId))
  const snap = await getDocs(q)
  return snap.docs
    .map(d => d.data() as PeopleLetterApproval)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
