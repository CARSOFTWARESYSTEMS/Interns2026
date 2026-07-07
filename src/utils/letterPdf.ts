// ── Offer / Joining Letter PDF Generation (PEOPLE-003 Premium Engine) ───────
// Renders a PeopleGeneratedLetter + its PeopleLetterTemplate into a premium,
// brand-configurable PDF binary client-side using jsPDF, then triggers a
// browser download. No PDF binary is ever uploaded or persisted — it is
// rebuilt on demand from the structured Firestore metadata each time it's
// needed, which is also why "download" always regenerates rather than
// fetching a stored file.
//
// Building the PDF is now async: bundled Inter fonts, remote branding images
// (hero banner / logo / signature / seal), and the verification QR code all
// need to be fetched/generated before the document is assembled.

import { jsPDF, GState } from 'jspdf'
import type { PeopleGeneratedLetter, PeopleLetterTemplate } from '../types/peopleLetters'
import { registerPremiumFonts } from './pdf/fonts'
import { loadImageAsDataUrl, dataUrlImageSize, imageFormatFromDataUrl } from './pdf/images'
import { buildVerificationQrDataUrl } from './pdf/qrcode'
import { THEME_PRESETS, type ThemePreset } from './pdf/themes'

const PAGE_WIDTH = 210 // A4 mm
const PAGE_HEIGHT = 297
const MARGIN = 18
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const BOTTOM_LIMIT = 268   // leave room for the footer band
const FOOTER_Y = 285

const INTERNSHIP_OBJECTIVES = [
  'Battery Intelligence', 'Battery Cybersecurity', 'Battery Aadhaar',
  'Secure Software Development', 'Threat Modelling', 'Research & Innovation',
  'Technical Documentation',
]

const ENGINEERING_VALUES = [
  'Integrity', 'Innovation', 'Security', 'Documentation',
  'Learning', 'Mission Ownership', 'Respect', 'Accountability',
]

function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
}

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')} / month`
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean
  const n = parseInt(full || '0b1220', 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Blends a brand color toward white — used for soft card fills instead of true alpha transparency. */
function tintHex(hex: string, amount: number): [number, number, number] {
  const [r, g, b] = hexToRgb(hex)
  const mix = (c: number) => Math.round(c + (255 - c) * Math.min(Math.max(amount, 0), 1))
  return [mix(r), mix(g), mix(b)]
}

type FontWeight = 'normal' | 'semibold' | 'bold'

class LetterWriter {
  doc: jsPDF
  y = MARGIN
  template: PeopleLetterTemplate
  theme: ThemePreset
  hasPremiumFont = false

  constructor(template: PeopleLetterTemplate) {
    this.doc = new jsPDF({ unit: 'mm', format: 'a4' })
    this.template = template
    this.theme = THEME_PRESETS[template.theme] ?? THEME_PRESETS.premium
  }

  async init() {
    this.hasPremiumFont = await registerPremiumFonts(this.doc)
    this.setFont('normal')
  }

  setFont(weight: FontWeight) {
    if (this.hasPremiumFont) {
      this.doc.setFont('Inter', weight)
    } else {
      // jsPDF's built-in Helvetica has no semibold — bold is the closest fallback.
      this.doc.setFont('helvetica', weight === 'normal' ? 'normal' : 'bold')
    }
  }

  ensureSpace(mm: number) {
    if (this.y + mm > BOTTOM_LIMIT) {
      this.doc.addPage()
      this.y = MARGIN
    }
  }

  heading(text: string, opts: { size?: number; color?: [number, number, number] } = {}) {
    const size = opts.size ?? 16
    this.ensureSpace(size / 2)
    this.setFont('bold')
    this.doc.setFontSize(size)
    const [r, g, b] = opts.color ?? hexToRgb(this.template.brandColors.navy)
    this.doc.setTextColor(r, g, b)
    this.doc.text(text, PAGE_WIDTH / 2, this.y, { align: 'center' })
    this.doc.setTextColor(0)
    this.y += size / 2.4
  }

  sectionHeading(text: string) {
    this.ensureSpace(9)
    this.setFont('bold')
    this.doc.setFontSize(12.5)
    const [r, g, b] = hexToRgb(this.template.brandColors[this.theme.headingColorKey])
    this.doc.setTextColor(r, g, b)
    this.doc.text(text, MARGIN, this.y)
    this.doc.setTextColor(0)
    this.y += 6.5
  }

  subheading(text: string) {
    this.ensureSpace(6)
    this.setFont('normal')
    this.doc.setFontSize(9.5)
    this.doc.setTextColor(100)
    this.doc.text(text, PAGE_WIDTH / 2, this.y, { align: 'center' })
    this.doc.setTextColor(0)
    this.y += 6
  }

  rule() {
    this.ensureSpace(3)
    this.doc.setDrawColor(210)
    this.doc.line(MARGIN, this.y, PAGE_WIDTH - MARGIN, this.y)
    this.y += 5
  }

  paragraph(text: string, size = 10.5) {
    this.setFont('normal')
    this.doc.setFontSize(size)
    this.doc.setTextColor(55)
    const lines = this.doc.splitTextToSize(text, CONTENT_WIDTH) as string[]
    this.ensureSpace(lines.length * 5.4)
    this.doc.text(lines, MARGIN, this.y)
    this.doc.setTextColor(0)
    this.y += lines.length * 5.4 + 2.5
  }

  spacer(mm = 4) {
    this.y += mm
  }

  // ── Premium card primitives ───────────────────────────────────────────

  private cardChrome(height: number) {
    const accent = hexToRgb(this.template.brandColors[this.theme.headingColorKey])
    const fill = tintHex(this.template.brandColors[this.theme.headingColorKey], 1 - this.theme.cardFillOpacity)
    this.doc.setFillColor(fill[0], fill[1], fill[2])
    this.doc.roundedRect(MARGIN, this.y, CONTENT_WIDTH, height, this.theme.cornerRadius, this.theme.cornerRadius, 'F')
    this.doc.setFillColor(accent[0], accent[1], accent[2])
    this.doc.rect(MARGIN, this.y, 1.3, height, 'F')
    return accent
  }

  /** A rounded, filled information card of label/value rows (e.g. Candidate Information). */
  card(title: string, rows: Array<[string, string]>) {
    const rowHeight = 6
    const padding = 5
    const titleHeight = title ? 7.5 : 2
    const height = padding * 2 + titleHeight + rows.length * rowHeight
    this.ensureSpace(height + 4)
    const accent = this.cardChrome(height)

    let cy = this.y + padding + 1
    if (title) {
      this.setFont('bold')
      this.doc.setFontSize(11.5)
      this.doc.setTextColor(accent[0], accent[1], accent[2])
      this.doc.text(title, MARGIN + padding + 2, cy)
      this.doc.setTextColor(0)
      cy += titleHeight
    }
    for (const [label, value] of rows) {
      this.setFont('semibold')
      this.doc.setFontSize(9)
      this.doc.setTextColor(90)
      this.doc.text(label, MARGIN + padding + 2, cy)
      this.setFont('normal')
      this.doc.setFontSize(10)
      this.doc.setTextColor(15)
      this.doc.text(value || '—', MARGIN + padding + 55, cy)
      this.doc.setTextColor(0)
      cy += rowHeight
    }
    this.y += height + 6
  }

  /** A rounded card carrying a clause heading + paragraph (e.g. Key Terms). */
  clauseCard(title: string, text: string) {
    this.setFont('normal')
    this.doc.setFontSize(10)
    const lines = this.doc.splitTextToSize(text, CONTENT_WIDTH - 14) as string[]
    const padding = 4.5
    const titleHeight = 6.5
    const height = padding * 2 + titleHeight + lines.length * 5
    this.ensureSpace(height + 4)
    const accent = this.cardChrome(height)

    this.setFont('bold')
    this.doc.setFontSize(10.5)
    this.doc.setTextColor(accent[0], accent[1], accent[2])
    this.doc.text(title, MARGIN + padding + 2, this.y + padding + 1)
    this.setFont('normal')
    this.doc.setFontSize(10)
    this.doc.setTextColor(40)
    this.doc.text(lines, MARGIN + padding + 2, this.y + padding + titleHeight)
    this.doc.setTextColor(0)
    this.y += height + 5
  }

  /** A 2-column grid of small rounded "chip" cards (objectives / values — no icon glyphs, a colored dot + label). */
  chipGrid(items: string[]) {
    const cols = 2
    const gap = 4
    const chipWidth = (CONTENT_WIDTH - gap * (cols - 1)) / cols
    const chipHeight = 9.5
    const rows = Math.ceil(items.length / cols)
    this.ensureSpace(rows * (chipHeight + gap))
    const accent = hexToRgb(this.template.brandColors.primary)
    const fill = tintHex(this.template.brandColors.primary, 1 - Math.min(this.theme.cardFillOpacity, 0.35))
    items.forEach((item, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const x = MARGIN + col * (chipWidth + gap)
      const cy = this.y + row * (chipHeight + gap)
      this.doc.setFillColor(fill[0], fill[1], fill[2])
      this.doc.roundedRect(x, cy, chipWidth, chipHeight, this.theme.cornerRadius, this.theme.cornerRadius, 'F')
      this.doc.setFillColor(accent[0], accent[1], accent[2])
      this.doc.circle(x + 6, cy + chipHeight / 2, 1.3, 'F')
      this.setFont('semibold')
      this.doc.setFontSize(9.5)
      this.doc.setTextColor(30)
      this.doc.text(item, x + 10.5, cy + chipHeight / 2 + 1.2)
      this.doc.setTextColor(0)
    })
    this.y += rows * (chipHeight + gap) + 2
  }

  // ── Branding chrome ────────────────────────────────────────────────────

  async heroBanner() {
    if (!this.template.heroBannerEnabled || !this.template.heroBannerImageUrl) return
    const dataUrl = await loadImageAsDataUrl(this.template.heroBannerImageUrl)
    if (!dataUrl) return
    try {
      const { width, height } = await dataUrlImageSize(dataUrl)
      const maxHeight = PAGE_HEIGHT * 0.13 // spec: hero banner ~12-15% of page height, never full-bleed
      let w = CONTENT_WIDTH
      let h = w * (height / width)
      if (h > maxHeight) { h = maxHeight; w = h * (width / height) }
      const x = MARGIN + (CONTENT_WIDTH - w) / 2
      this.doc.addImage(dataUrl, imageFormatFromDataUrl(dataUrl), x, this.y, w, h)
      this.y += h + 5
    } catch {
      // Known limitation: if the image can't be measured/embedded (e.g. unsupported
      // format), skip the banner rather than breaking PDF generation.
    }
  }

  masthead(letter: PeopleGeneratedLetter, titleText: string) {
    this.heading(this.template.businessUnit || this.template.companyName, { size: 20 })
    if (this.template.headerText) this.subheading(this.template.headerText)
    this.spacer(1)
    this.heading(titleText, { size: 14, color: hexToRgb(this.template.brandColors[this.theme.headingColorKey]) })
    this.spacer(1)
    if (this.theme.rule) this.rule()
    else this.spacer(2)
    this.setFont('normal')
    this.doc.setFontSize(9)
    this.doc.setTextColor(90)
    this.doc.text(`Document ID: ${letter.documentId}`, MARGIN, this.y)
    this.doc.text(`Issue Date: ${formatDate(letter.createdAt)}`, PAGE_WIDTH - MARGIN, this.y, { align: 'right' })
    this.doc.setTextColor(0)
    this.y += 8
  }

  async signatureBlock() {
    this.spacer(6)
    this.sectionHeading('Authorized Signatory')
    const t = this.template

    if (t.signatureImageUrl) {
      const sigImg = await loadImageAsDataUrl(t.signatureImageUrl)
      if (sigImg) {
        try {
          this.ensureSpace(18)
          this.doc.addImage(sigImg, imageFormatFromDataUrl(sigImg), MARGIN, this.y, 34, 14)
          this.y += 16
        } catch {
          // Known limitation: skip signature image on embed failure.
        }
      }
    }

    this.setFont('semibold')
    this.doc.setFontSize(11)
    this.doc.text(t.hrManagerName || '_______________________', MARGIN, this.y)
    this.y += 5.2
    this.setFont('normal')
    this.doc.setFontSize(9.5)
    this.doc.setTextColor(90)
    this.doc.text(t.hrManagerDesignation, MARGIN, this.y)
    this.y += 5
    this.doc.text(t.hrManagerEmail || t.companyEmail, MARGIN, this.y)
    this.y += 5
    this.doc.text(`For ${t.companyName}`, MARGIN, this.y)
    this.doc.setTextColor(0)
    this.y += 4

    if (t.companySealEnabled && t.companySealImageUrl) {
      const seal = await loadImageAsDataUrl(t.companySealImageUrl)
      if (seal) {
        try {
          this.doc.addImage(seal, imageFormatFromDataUrl(seal), PAGE_WIDTH - MARGIN - 26, this.y - 24, 26, 26)
        } catch {
          // Known limitation: skip company seal on embed failure.
        }
      }
    }
  }

  footer(letter: PeopleGeneratedLetter, qrDataUrl: string | null) {
    const t = this.template
    const pageCount = this.doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i)
      this.doc.setDrawColor(220)
      this.doc.line(MARGIN, FOOTER_Y - 5, PAGE_WIDTH - MARGIN, FOOTER_Y - 5)
      this.setFont('normal')
      this.doc.setFontSize(7.5)
      this.doc.setTextColor(120)
      const left = [t.companyName, t.companyWebsite, t.companyEmail, t.companyPhone].filter(Boolean).join(' · ')
      this.doc.text(left, MARGIN, FOOTER_Y)
      this.doc.text(
        `${letter.documentId} · v${letter.templateVersion || t.version} · CONFIDENTIAL`,
        PAGE_WIDTH - MARGIN, FOOTER_Y, { align: 'right' },
      )
      this.doc.text(
        t.footerText || 'System-generated document — valid without a physical signature.',
        PAGE_WIDTH / 2, FOOTER_Y + 4, { align: 'center' },
      )
      if (i === pageCount && qrDataUrl && t.qrCodeEnabled) {
        this.doc.addImage(qrDataUrl, 'PNG', PAGE_WIDTH - MARGIN - 15, FOOTER_Y - 21, 15, 15)
      }
      this.doc.setTextColor(0)
    }
  }

  applyWatermark() {
    if (!this.template.watermarkEnabled || !this.template.watermarkText) return
    const pageCount = this.doc.getNumberOfPages()
    const [r, g, b] = hexToRgb(this.template.brandColors.navy)
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i)
      this.doc.saveGraphicsState()
      this.doc.setGState(new GState({ opacity: 0.07 }))
      this.setFont('bold')
      this.doc.setFontSize(60)
      this.doc.setTextColor(r, g, b)
      this.doc.text(this.template.watermarkText.toUpperCase(), PAGE_WIDTH / 2, PAGE_HEIGHT / 2, {
        align: 'center', angle: 35,
      })
      this.doc.restoreGraphicsState()
      this.doc.setTextColor(0)
    }
  }
}

export async function buildOfferLetterPdf(letter: PeopleGeneratedLetter, template: PeopleLetterTemplate): Promise<jsPDF> {
  const w = new LetterWriter(template)
  await w.init()
  await w.heroBanner()
  w.masthead(letter, 'Internship Offer Letter')

  w.paragraph(`Dear ${letter.candidateName},`)
  w.paragraph(
    `We are pleased to offer you the position of "${letter.designation}" as part of the ${template.internshipType} ` +
    `at ${template.companyName} (${template.businessUnit}), within the ${template.department} department, ` +
    `focused on ${template.domain}${template.specialisation ? ` with specialisation in ${template.specialisation}` : ''}.`
  )

  w.sectionHeading('Candidate Information')
  w.card('', [
    ['Candidate Name', letter.candidateName],
    ['Designation', String(letter.designation)],
    ['Department', template.department],
    ['Internship Type', template.internshipType],
    ['Duration', template.durationText],
    ['Start Date', formatDate(letter.internshipStartDate)],
    ['End Date', formatDate(letter.internshipEndDate)],
    ['Acceptance Deadline', formatDate(letter.acceptanceDeadline)],
    ['Document ID', letter.documentId],
  ])

  if (letter.stipendEnabled) {
    w.sectionHeading('Stipend')
    w.paragraph(`A stipend of ${formatCurrency(letter.stipendAmount)} will be paid for the duration of this internship.`)
  }

  w.sectionHeading('Internship Objectives')
  w.chipGrid(INTERNSHIP_OBJECTIVES)
  w.spacer(1)
  w.sectionHeading('Engineering Values')
  w.chipGrid(ENGINEERING_VALUES)

  w.spacer(1)
  w.sectionHeading('Key Terms')
  w.clauseCard('Certificate Eligibility', template.certificateEligibilityText)
  w.clauseCard('Confidentiality & IP', template.confidentialityClause)
  w.clauseCard('Code of Conduct', template.codeOfConductClause)
  w.clauseCard('Termination', template.terminationClause)
  w.clauseCard('Acceptance', template.acceptanceInstructionText)

  await w.signatureBlock()

  const qr = template.qrCodeEnabled ? await buildVerificationQrDataUrl(letter.documentId) : null
  w.footer(letter, qr)
  w.applyWatermark()

  return w.doc
}

export async function buildJoiningLetterPdf(letter: PeopleGeneratedLetter, template: PeopleLetterTemplate): Promise<jsPDF> {
  const w = new LetterWriter(template)
  await w.init()
  await w.heroBanner()
  w.masthead(letter, 'Internship Joining Letter')

  w.paragraph(`Dear ${letter.candidateName},`)
  w.paragraph(
    `Welcome to ${template.companyName}! This letter confirms your joining as "${letter.designation}" ` +
    `under the ${template.internshipType} within the ${template.department} department, effective from the date below.`
  )

  w.sectionHeading('Joining Details')
  w.card('', [
    ['Designation', String(letter.designation)],
    ['Reporting Department', template.department],
    ['Joining / Start Date', formatDate(letter.internshipStartDate)],
    ['Internship End Date', formatDate(letter.internshipEndDate)],
    ['Weekly Commitment', template.weeklyHours],
    ['Document ID', letter.documentId],
  ])

  if (letter.stipendEnabled) {
    w.sectionHeading('Stipend')
    w.paragraph(`A stipend of ${formatCurrency(letter.stipendAmount)} will be paid for the duration of this internship.`)
  }

  w.sectionHeading('Internship Objectives')
  w.chipGrid(INTERNSHIP_OBJECTIVES)
  w.spacer(1)
  w.sectionHeading('Engineering Values')
  w.chipGrid(ENGINEERING_VALUES)

  w.spacer(1)
  w.sectionHeading('Key Terms')
  w.clauseCard('Certificate Eligibility', template.certificateEligibilityText)
  w.clauseCard('Confidentiality & IP', template.confidentialityClause)
  w.clauseCard('Code of Conduct', template.codeOfConductClause)

  await w.signatureBlock()

  const qr = template.qrCodeEnabled ? await buildVerificationQrDataUrl(letter.documentId) : null
  w.footer(letter, qr)
  w.applyWatermark()

  return w.doc
}

export async function buildLetterPdf(letter: PeopleGeneratedLetter, template: PeopleLetterTemplate): Promise<jsPDF> {
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

export async function downloadLetterPdf(letter: PeopleGeneratedLetter, template: PeopleLetterTemplate): Promise<void> {
  const pdf = await buildLetterPdf(letter, template)
  pdf.save(letterFileName(letter))
}
