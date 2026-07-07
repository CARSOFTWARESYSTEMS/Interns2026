// ── People Operations — Offer & Joining Letter Generator (PEOPLE-002) ──────
// Configurable template + generated-letter data model for internship offer
// letters and joining letters. Firestore-ready, JSON-first. Only metadata is
// ever persisted — PDF binaries are generated on demand in the browser and
// are never written to Firestore.

import type { PeopleDocBase } from './people'
import { DEFAULT_PARTNER_ID, DEFAULT_ORGANISATION_ID } from './people'

export { DEFAULT_PARTNER_ID, DEFAULT_ORGANISATION_ID }
export type { PeopleDocBase }

// ── Intern designations ──────────────────────────────────────────────────────

export const INTERN_DESIGNATIONS = [
  'Cybersecurity Research Intern',
  'Battery Intelligence Research Intern',
  'Battery Aadhaar Research Intern',
  'Aerospace Cybersecurity Intern',
  'Battery Systems Engineering Intern',
  'Secure Software Development Intern',
  'Threat Modelling Intern',
  'AI-Assisted Engineering Intern',
  'Technical Documentation Intern',
  'Engineering Operations Intern',
  'Product Management Intern',
  'People Operations Intern',
  'HR Operations Intern',
  'Recruitment Intern',
  'Talent Acquisition Intern',
  'Learning & Development Intern',
  'Employee Engagement Intern',
] as const

export type InternDesignation = (typeof INTERN_DESIGNATIONS)[number]

// ── Letter type & workflow status ────────────────────────────────────────────

export type LetterType = 'offer' | 'joining'

export const LETTER_TYPE_LABELS: Record<LetterType, string> = {
  offer:   'Internship Offer Letter',
  joining: 'Internship Joining Letter',
}

// Offer workflow:  Draft -> Submitted for Approval -> Approved -> PDF Generated -> Sent / Downloaded -> Accepted
// Joining workflow (offer must be Accepted first): Draft -> Submitted for Approval -> Approved -> PDF Generated
export type LetterStatus =
  | 'Draft'
  | 'Submitted for Approval'
  | 'Rejected'
  | 'Approved'
  | 'PDF Generated'
  | 'Sent'
  | 'Downloaded'
  | 'Accepted'

export const LETTER_STATUSES: LetterStatus[] = [
  'Draft', 'Submitted for Approval', 'Rejected', 'Approved',
  'PDF Generated', 'Sent', 'Downloaded', 'Accepted',
]

// ── Template configuration ───────────────────────────────────────────────────
// One reusable template drives every generated letter. HR only fills in
// candidate-specific fields on the letter itself (see PeopleGeneratedLetter).

export interface PeopleLetterTemplate extends PeopleDocBase {
  id: string
  templateName: string
  isActive: boolean

  // Company identity
  companyName: string
  businessUnit: string
  department: string
  domain: string
  specialisation: string
  companyAddress: string
  companyEmail: string
  companyWebsite: string
  letterheadImageUrl: string
  companyLogoUrl: string

  // Internship defaults
  internshipType: string        // e.g. "Remote / Hybrid Research Internship"
  durationText: string          // e.g. "3 to 6 months"
  weeklyHours: string           // e.g. "20-25 hours/week"

  // Letter chrome
  headerText: string
  footerText: string

  // HR signatory
  hrManagerName: string
  hrManagerDesignation: string
  signatureImageUrl: string

  // Toggleable sections / clauses
  stipendSectionEnabledByDefault: boolean
  certificateEligibilityText: string
  confidentialityClause: string
  codeOfConductClause: string
  terminationClause: string
  acceptanceInstructionText: string
}

export function emptyLetterTemplate(): Omit<PeopleLetterTemplate,
  'id' | 'partnerId' | 'organisationId' | 'createdAt' | 'updatedAt' | 'status' | 'createdBy'> {
  return {
    templateName: 'Default Internship Template',
    isActive: true,
    companyName: 'iTelematics Software Private Limited',
    businessUnit: 'EV.ENGINEER',
    department: 'Engineering',
    domain: 'Electric Vehicles & Aerospace Cybersecurity',
    specialisation: '',
    companyAddress: 'Bangalore, Karnataka, India',
    companyEmail: 'people@evengineer.com',
    companyWebsite: 'https://evengineer.com',
    letterheadImageUrl: '',
    companyLogoUrl: '',
    internshipType: 'Remote Research Internship',
    durationText: '3 to 6 months',
    weeklyHours: '20-25 hours/week',
    headerText: 'iTelematics Software Private Limited — EV.ENGINEER',
    footerText: 'This is a system-generated letter and is valid without a physical signature.',
    hrManagerName: '',
    hrManagerDesignation: 'HR Manager',
    signatureImageUrl: '',
    stipendSectionEnabledByDefault: false,
    certificateEligibilityText:
      'A certificate of internship completion will be issued upon successful completion of the internship duration and satisfactory performance.',
    confidentialityClause:
      'The intern shall maintain strict confidentiality of all proprietary, technical and business information accessed during the internship, both during and after its term.',
    codeOfConductClause:
      'The intern is expected to adhere to the company’s Code of Conduct, maintain professionalism, and act with integrity in all engagements.',
    terminationClause:
      'Either party may terminate this internship engagement with written notice, in case of unsatisfactory performance, misconduct, or business need.',
    acceptanceInstructionText:
      'Please confirm your acceptance of this offer by replying to this email before the acceptance deadline stated above.',
  }
}

// ── Generated letters ────────────────────────────────────────────────────────

export interface PeopleGeneratedLetter extends PeopleDocBase {
  id: string
  letterType: LetterType
  templateId: string

  candidateId: string
  candidateName: string
  candidateEmail: string
  designation: InternDesignation | string

  documentId: string             // e.g. ITEL-EV-INT-OFFER-2026-001

  internshipStartDate: string
  internshipEndDate: string
  acceptanceDeadline: string

  stipendEnabled: boolean
  stipendAmount: number

  // Joining letters only — the offer letter this joining letter was created from.
  linkedOfferLetterId: string

  approvedBy: string
  approvedAt: string
  generatedBy: string
  generatedAt: string

  // Metadata only — no binary is ever stored. In this iteration the PDF is
  // regenerated on demand in the browser from this record + its template, so
  // this is a descriptive/traceability path rather than a live object-store URL.
  pdfUrl: string
  pdfStoragePath: string

  rejectionReason: string
}

export function letterDocPrefix(letterType: LetterType): string {
  return letterType === 'offer' ? 'OFFER' : 'JOIN'
}

// ── Approvals (explicit approval history, separate from the convenience
// approvedBy/approvedAt fields on the letter itself) ─────────────────────────

export type LetterApprovalDecision = 'Approved' | 'Rejected'

export interface PeopleLetterApproval extends PeopleDocBase {
  id: string
  letterId: string
  letterType: LetterType
  decision: LetterApprovalDecision
  decidedBy: string
  decidedAt: string
  comments: string
}

// ── Document ID counters ─────────────────────────────────────────────────────
// One counter document per (letterType, year), incremented via a Firestore
// transaction to produce a zero-padded sequential document ID.

export interface PeopleLetterCounter {
  id: string          // `${letterType}-${year}`, e.g. "offer-2026"
  letterType: LetterType
  year: number
  count: number
  updatedAt: string
}

// ── Audit logs ────────────────────────────────────────────────────────────────

export type PeopleLetterAuditAction =
  | 'template_updated'
  | 'letter_drafted'
  | 'letter_submitted'
  | 'letter_approved'
  | 'letter_rejected'
  | 'pdf_generated'
  | 'letter_sent'
  | 'letter_downloaded'
  | 'letter_accepted'

export interface PeopleLetterAuditLog extends PeopleDocBase {
  id: string
  uid: string
  action: PeopleLetterAuditAction
  resource: string
  details: string
}
