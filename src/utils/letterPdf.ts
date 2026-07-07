// ── Offer / Joining Letter PDF Generation ───────────────────────────────────
// Renders a PeopleGeneratedLetter + its PeopleLetterTemplate into a real PDF
// binary client-side using jsPDF, then triggers a browser download. No PDF
// binary is ever uploaded or persisted — it is rebuilt on demand from the
// structured Firestore metadata each time it's needed, which is also why
// "download" always regenerates rather than fetching a stored file.

import { jsPDF } from 'jspdf'
import type { PeopleGeneratedLetter, PeopleLetterTemplate } from '../types/peopleLetters'

const PAGE_WIDTH = 210 // A4 mm
const MARGIN = 18
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
}

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')} / month`
}

class LetterWriter {
  doc: jsPDF
  y: number

  constructor() {
    this.doc = new jsPDF({ unit: 'mm', format: 'a4' })
    this.y = MARGIN
  }

  private ensureSpace(lines: number, lineHeight = 5.2) {
    if (this.y + lines * lineHeight > 280) {
      this.doc.addPage()
      this.y = MARGIN
    }
  }

  heading(text: string, size = 14) {
    this.ensureSpace(2)
    this.doc.setFont('helvetica', 'bold')
    this.doc.setFontSize(size)
    this.doc.text(text, PAGE_WIDTH / 2, this.y, { align: 'center' })
    this.y += size / 2.2
  }

  subheading(text: string) {
    this.ensureSpace(2)
    this.doc.setFont('helvetica', 'normal')
    this.doc.setFontSize(9.5)
    this.doc.setTextColor(90)
    this.doc.text(text, PAGE_WIDTH / 2, this.y, { align: 'center' })
    this.doc.setTextColor(0)
    this.y += 6
  }

  rule() {
    this.ensureSpace(1)
    this.doc.setDrawColor(200)
    this.doc.line(MARGIN, this.y, PAGE_WIDTH - MARGIN, this.y)
    this.y += 5
  }

  label(text: string) {
    this.ensureSpace(2)
    this.doc.setFont('helvetica', 'bold')
    this.doc.setFontSize(10.5)
    this.doc.text(text, MARGIN, this.y)
    this.y += 6
  }

  paragraph(text: string, size = 10) {
    this.doc.setFont('helvetica', 'normal')
    this.doc.setFontSize(size)
    const lines = this.doc.splitTextToSize(text, CONTENT_WIDTH) as string[]
    this.ensureSpace(lines.length)
    this.doc.text(lines, MARGIN, this.y)
    this.y += lines.length * 5.2 + 2
  }

  keyValueRow(key: string, value: string) {
    this.ensureSpace(1)
    this.doc.setFont('helvetica', 'bold')
    this.doc.setFontSize(10)
    this.doc.text(`${key}:`, MARGIN, this.y)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text(value, MARGIN + 55, this.y)
    this.y += 6
  }

  spacer(mm = 4) {
    this.y += mm
  }

  footer(text: string, documentId: string) {
    const pageCount = this.doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i)
      this.doc.setFont('helvetica', 'normal')
      this.doc.setFontSize(7.5)
      this.doc.setTextColor(130)
      this.doc.text(text, PAGE_WIDTH / 2, 290, { align: 'center' })
      this.doc.text(documentId, PAGE_WIDTH - MARGIN, 290, { align: 'right' })
      this.doc.setTextColor(0)
    }
  }
}

function renderCommonHeader(w: LetterWriter, template: PeopleLetterTemplate, letter: PeopleGeneratedLetter, titleText: string) {
  w.heading(template.companyName)
  w.subheading(template.headerText)
  w.spacer(2)
  w.rule()
  w.heading(titleText, 12)
  w.spacer(1)
  w.doc.setFont('helvetica', 'normal')
  w.doc.setFontSize(9)
  w.doc.text(`Document ID: ${letter.documentId}`, MARGIN, w.y)
  w.doc.text(`Date: ${formatDate(letter.createdAt)}`, PAGE_WIDTH - MARGIN, w.y, { align: 'right' })
  w.y += 8
}

function renderSignatureBlock(w: LetterWriter, template: PeopleLetterTemplate) {
  w.spacer(6)
  w.paragraph('For ' + template.companyName + ',')
  w.spacer(10)
  w.paragraph(template.hrManagerName || '_______________________')
  w.paragraph(template.hrManagerDesignation)
}

export function buildOfferLetterPdf(letter: PeopleGeneratedLetter, template: PeopleLetterTemplate): jsPDF {
  const w = new LetterWriter()
  renderCommonHeader(w, template, letter, 'Internship Offer Letter')

  w.paragraph(`Dear ${letter.candidateName},`)
  w.paragraph(
    `We are pleased to offer you the position of "${letter.designation}" as part of the ${template.internshipType} ` +
    `at ${template.companyName} (${template.businessUnit}), within the ${template.department} department, ` +
    `focused on ${template.domain}${template.specialisation ? ` with specialisation in ${template.specialisation}` : ''}.`
  )

  w.spacer(2)
  w.label('Internship Details')
  w.keyValueRow('Internship Type', template.internshipType)
  w.keyValueRow('Duration', template.durationText)
  w.keyValueRow('Weekly Commitment', template.weeklyHours)
  w.keyValueRow('Start Date', formatDate(letter.internshipStartDate))
  w.keyValueRow('End Date', formatDate(letter.internshipEndDate))
  w.keyValueRow('Acceptance Deadline', formatDate(letter.acceptanceDeadline))

  if (letter.stipendEnabled) {
    w.spacer(2)
    w.label('Stipend')
    w.paragraph(`A stipend of ${formatCurrency(letter.stipendAmount)} will be paid for the duration of this internship.`)
  }

  w.spacer(2)
  w.label('Certificate Eligibility')
  w.paragraph(template.certificateEligibilityText)

  w.label('Confidentiality & IP')
  w.paragraph(template.confidentialityClause)

  w.label('Code of Conduct')
  w.paragraph(template.codeOfConductClause)

  w.label('Termination')
  w.paragraph(template.terminationClause)

  w.label('Acceptance')
  w.paragraph(template.acceptanceInstructionText)

  renderSignatureBlock(w, template)
  w.footer(`${template.footerText} · ${template.companyEmail} · ${template.companyWebsite}`, letter.documentId)

  return w.doc
}

export function buildJoiningLetterPdf(letter: PeopleGeneratedLetter, template: PeopleLetterTemplate): jsPDF {
  const w = new LetterWriter()
  renderCommonHeader(w, template, letter, 'Internship Joining Letter')

  w.paragraph(`Dear ${letter.candidateName},`)
  w.paragraph(
    `Welcome to ${template.companyName}! This letter confirms your joining as "${letter.designation}" ` +
    `under the ${template.internshipType} within the ${template.department} department, effective from the date below.`
  )

  w.spacer(2)
  w.label('Joining Details')
  w.keyValueRow('Designation', String(letter.designation))
  w.keyValueRow('Reporting Department', template.department)
  w.keyValueRow('Joining / Start Date', formatDate(letter.internshipStartDate))
  w.keyValueRow('Internship End Date', formatDate(letter.internshipEndDate))
  w.keyValueRow('Weekly Commitment', template.weeklyHours)

  if (letter.stipendEnabled) {
    w.spacer(2)
    w.label('Stipend')
    w.paragraph(`A stipend of ${formatCurrency(letter.stipendAmount)} will be paid for the duration of this internship.`)
  }

  w.spacer(2)
  w.label('Certificate Eligibility')
  w.paragraph(template.certificateEligibilityText)

  w.label('Confidentiality & IP')
  w.paragraph(template.confidentialityClause)

  w.label('Code of Conduct')
  w.paragraph(template.codeOfConductClause)

  renderSignatureBlock(w, template)
  w.footer(`${template.footerText} · ${template.companyEmail} · ${template.companyWebsite}`, letter.documentId)

  return w.doc
}

export function buildLetterPdf(letter: PeopleGeneratedLetter, template: PeopleLetterTemplate): jsPDF {
  return letter.letterType === 'offer'
    ? buildOfferLetterPdf(letter, template)
    : buildJoiningLetterPdf(letter, template)
}

export function letterFileName(letter: PeopleGeneratedLetter): string {
  const safeName = letter.candidateName.replace(/[^a-z0-9]+/gi, '_')
  return `${letter.documentId}_${safeName}.pdf`
}

/** Logical storage path recorded on the letter record for traceability only — no file is actually uploaded. */
export function letterStoragePath(letter: PeopleGeneratedLetter): string {
  return `people-letters/${letter.letterType}/${letter.documentId}.pdf`
}

export function downloadLetterPdf(letter: PeopleGeneratedLetter, template: PeopleLetterTemplate): void {
  const pdf = buildLetterPdf(letter, template)
  pdf.save(letterFileName(letter))
}
