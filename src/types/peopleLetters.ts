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

// ── Premium branding / theme (PEOPLE-003) ───────────────────────────────────

export type TemplateTheme =
  | 'classic' | 'corporate' | 'premium' | 'aerospace' | 'defence' | 'minimal'

export const TEMPLATE_THEMES: TemplateTheme[] = [
  'classic', 'corporate', 'premium', 'aerospace', 'defence', 'minimal',
]

export const TEMPLATE_THEME_LABELS: Record<TemplateTheme, string> = {
  classic:   'Classic',
  corporate: 'Corporate',
  premium:   'Premium',
  aerospace: 'Aerospace',
  defence:   'Defence',
  minimal:   'Minimal',
}

// Only 'Inter' is actually embedded as a PDF font in this iteration (bundled
// TTFs registered with jsPDF). The others are stored for a future sprint and
// currently only affect nothing in the generated PDF.
export const TEMPLATE_FONTS = ['Inter', 'Plus Jakarta Sans', 'Manrope', 'Source Sans 3', 'Poppins'] as const
export type TemplateFont = (typeof TEMPLATE_FONTS)[number]

export interface TemplateBrandColors {
  primary: string    // Primary Green
  secondary: string  // Primary Blue
  accent: string      // Orange
  navy: string        // Dark Navy
  lightGray: string   // Light Gray
  success: string     // Success Green
}

export const DEFAULT_BRAND_COLORS: TemplateBrandColors = {
  primary:   '#00E676',
  secondary: '#246BFD',
  accent:    '#FF8A00',
  navy:      '#0B1220',
  lightGray: '#F5F7FA',
  success:   '#16A34A',
}

// ── Template configuration ───────────────────────────────────────────────────
// One reusable template drives every generated letter. HR only fills in
// candidate-specific fields on the letter itself (see PeopleGeneratedLetter).
//
// Versioning: a template as HR thinks of it is a `templateGroupId`. Editing
// and saving a new version writes a NEW Firestore doc with the same
// `templateGroupId`, an incremented `version`, and `isLatest: true` — the
// previous latest doc for that group is flipped to `isLatest: false`. The
// template list UI shows one row per group (its latest version); version
// history queries all docs sharing a `templateGroupId`.

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
  companyPhone: string
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
  hrManagerEmail: string
  signatureImageUrl: string

  // Toggleable sections / clauses
  stipendSectionEnabledByDefault: boolean
  certificateEligibilityText: string
  confidentialityClause: string
  codeOfConductClause: string
  terminationClause: string
  acceptanceInstructionText: string

  // Premium branding (PEOPLE-003)
  theme: TemplateTheme
  fontFamily: TemplateFont
  brandColors: TemplateBrandColors
  heroBannerEnabled: boolean
  heroBannerImageUrl: string
  watermarkEnabled: boolean
  watermarkText: string
  qrCodeEnabled: boolean
  companySealEnabled: boolean
  companySealImageUrl: string

  // Versioning & lifecycle (PEOPLE-003)
  templateGroupId: string
  version: string          // e.g. "1.0", "1.1", "2.0"
  isLatest: boolean
  versionNote: string
  isDefault: boolean
  isArchived: boolean
  deletedAt: string        // '' when not soft-deleted
}

export function emptyLetterTemplate(): Omit<PeopleLetterTemplate,
  'id' | 'partnerId' | 'organisationId' | 'createdAt' | 'updatedAt' | 'status' | 'createdBy'> {
  return {
    templateName: 'Default Internship Template',
    isActive: true,
    companyName: 'iTelematics Software Private Limited',
    businessUnit: 'EV.ENGINEER',
    department: 'Energy Battery Intelligence',
    domain: 'Aerospace',
    specialisation: '',
    companyAddress: 'Bangalore, Karnataka, India',
    companyEmail: 'info@itelematics.com',
    companyWebsite: 'https://itelematics.com',
    companyPhone: '',
    letterheadImageUrl: '',
    companyLogoUrl: '',
    internshipType: 'Remote Research Internship',
    durationText: '3 to 6 months',
    weeklyHours: '20-25 hours/week',
    headerText: 'iTelematics Software Private Limited — EV.ENGINEER',
    footerText: 'This is a system-generated letter and is valid without a physical signature.',
    hrManagerName: 'Tanuja Revansidh Jadhav',
    hrManagerDesignation: 'HR Manager',
    hrManagerEmail: 'tanujajadhav725@gmail.com',
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

    theme: 'premium',
    fontFamily: 'Inter',
    brandColors: { ...DEFAULT_BRAND_COLORS },
    heroBannerEnabled: true,
    heroBannerImageUrl: 'https://www.ev.engineer/_next/image?url=%2Fimages%2FSudarshana%20Karkala%20EV%20ENGINEER.png&w=3840&q=75',
    watermarkEnabled: false,
    watermarkText: 'CONFIDENTIAL',
    qrCodeEnabled: true,
    companySealEnabled: false,
    companySealImageUrl: '',

    templateGroupId: 'default',
    version: '1.0',
    isLatest: true,
    versionNote: 'Initial version',
    isDefault: true,
    isArchived: false,
    deletedAt: '',
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

  // Template traceability (PEOPLE-003) — which exact version generated this.
  templateVersion: string

  // Generated-document lifecycle (PEOPLE-003)
  isDisabled: boolean
  isArchived: boolean
  deletedAt: string        // '' when not soft-deleted
}

export function letterDocPrefix(letterType: LetterType): string {
  return letterType === 'offer' ? 'OFFER' : 'JOIN'
}

/** Future verification URL encoded into every generated document's QR code. */
export function letterVerificationUrl(documentId: string): string {
  return `https://ev.engineer/verify/${documentId}`
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
  // Template lifecycle (PEOPLE-003)
  | 'template_created'
  | 'template_cloned'
  | 'template_archived'
  | 'template_restored'
  | 'template_deleted'
  | 'template_version_created'
  | 'template_set_default'
  // Generated-document lifecycle (PEOPLE-003)
  | 'document_regenerated'
  | 'document_disabled'
  | 'document_archived'
  | 'document_soft_deleted'
  | 'document_restored'

export interface PeopleLetterAuditLog extends PeopleDocBase {
  id: string
  uid: string
  action: PeopleLetterAuditAction
  resource: string
  details: string
}
