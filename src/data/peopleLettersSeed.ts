// ── Offer / Joining Letter Generator — Deterministic Sample Data ────────────
// Used as a display fallback when Firestore has no letter template / letters
// yet. Pages read this only when a live query returns empty — real data
// always takes precedence.

import type { PeopleLetterTemplate, PeopleGeneratedLetter } from '../types/peopleLetters'
import { DEFAULT_PARTNER_ID, DEFAULT_ORGANISATION_ID, emptyLetterTemplate } from '../types/peopleLetters'

const base = {
  partnerId: DEFAULT_PARTNER_ID,
  organisationId: DEFAULT_ORGANISATION_ID,
  createdAt: '2026-06-01T09:00:00.000Z',
  updatedAt: '2026-06-01T09:00:00.000Z',
  createdBy: 'seed',
}

export const SEED_LETTER_TEMPLATE: PeopleLetterTemplate = {
  ...base,
  id: 'default',
  status: 'active',
  ...emptyLetterTemplate(),
  hrManagerName: 'Sudarshana Karkala',
  specialisation: 'Battery Intelligence & Aerospace Cybersecurity',
}

export const SEED_GENERATED_LETTERS: PeopleGeneratedLetter[] = [
  {
    ...base,
    id: 'letter-seed-offer-1',
    status: 'Approved',
    letterType: 'offer',
    templateId: 'default',
    candidateId: 'candidate-seed-3',
    candidateName: 'Devansh Patel',
    candidateEmail: 'devansh.patel@example.com',
    designation: 'Battery Systems Engineering Intern',
    documentId: 'ITEL-EV-INT-OFFER-2026-001',
    internshipStartDate: '2026-08-01',
    internshipEndDate: '2027-01-31',
    acceptanceDeadline: '2026-07-15',
    stipendEnabled: true,
    stipendAmount: 8000,
    linkedOfferLetterId: '',
    approvedBy: 'seed-admin',
    approvedAt: '2026-07-05T09:00:00.000Z',
    generatedBy: '',
    generatedAt: '',
    pdfUrl: '',
    pdfStoragePath: '',
    rejectionReason: '',
    templateVersion: '1.0',
    isDisabled: false,
    isArchived: false,
    deletedAt: '',
  },
]
