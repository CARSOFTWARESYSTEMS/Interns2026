#!/usr/bin/env node
// Static verification for the Premium Corporate Document Engine (PEOPLE-003).
// Checks source-level wiring for template branding/theming/versioning, the
// generated-document lifecycle, the document catalog, and bundled premium
// assets (Inter fonts, qrcode dependency). Does not itself invoke tsc/vite —
// run `npx tsc --noEmit && npm run build` alongside this script, and
// `node scripts/verify-people-letter-generator.mjs` for PEOPLE-002 regressions.

import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = p => readFileSync(join(ROOT, p), 'utf8')
const exists = p => existsSync(join(ROOT, p))

let failures = 0
let passes = 0

function check(label, fn) {
  try {
    const ok = fn()
    if (ok) {
      console.log(`  PASS  ${label}`)
      passes++
    } else {
      console.log(`  FAIL  ${label}`)
      failures++
    }
  } catch (e) {
    console.log(`  FAIL  ${label} (${e.message})`)
    failures++
  }
}

console.log('Premium Corporate Document Engine (PEOPLE-003) — Verification\n')

// ── Types: branding / theme / versioning / lifecycle ───────────────────────
console.log('Type Models')
const types = read('src/types/peopleLetters.ts')
check('TemplateTheme + 6 theme presets modelled', () =>
  types.includes("export type TemplateTheme") &&
  ['classic', 'corporate', 'premium', 'aerospace', 'defence', 'minimal'].every(t => types.includes(`'${t}'`)))
check('TemplateBrandColors carries the 6 spec brand colors', () => [
  'primary', 'secondary', 'accent', 'navy', 'lightGray', 'success',
].every(c => types.includes(c)) && types.includes('#00E676') && types.includes('#246BFD'))
check('Template models hero banner, watermark, QR, and company seal toggles', () => [
  'heroBannerEnabled', 'heroBannerImageUrl', 'watermarkEnabled', 'watermarkText',
  'qrCodeEnabled', 'companySealEnabled', 'companySealImageUrl',
].every(f => types.includes(f)))
check('Template versioning fields modelled (templateGroupId/version/isLatest/versionNote)', () => [
  'templateGroupId', 'version', 'isLatest', 'versionNote',
].every(f => types.includes(f)))
check('Template lifecycle fields modelled (isDefault/isArchived/deletedAt)', () => [
  'isDefault', 'isArchived', 'deletedAt',
].every(f => types.includes(f)))
check('Generated letter carries templateVersion + lifecycle fields', () => [
  'templateVersion', 'isDisabled', 'isArchived', 'deletedAt',
].every(f => types.includes(f)))
check('Future verification URL helper exists (ev.engineer/verify/<documentId>)', () =>
  types.includes('letterVerificationUrl') && types.includes('ev.engineer/verify/'))
check('New template/document audit actions modelled', () => [
  'template_created', 'template_cloned', 'template_archived', 'template_restored',
  'template_deleted', 'template_version_created', 'template_set_default',
  'document_regenerated', 'document_disabled', 'document_archived',
  'document_soft_deleted', 'document_restored',
].every(a => types.includes(a)))

// ── Document Catalog ────────────────────────────────────────────────────────
console.log('\nDocument Catalog')
check('src/types/documentCatalog.ts exists', () => exists('src/types/documentCatalog.ts'))
const catalog = exists('src/types/documentCatalog.ts') ? read('src/types/documentCatalog.ts') : ''
check('Catalog models exactly 15 document kinds', () => {
  const matches = catalog.match(/key: '[^']+'/g) ?? []
  return matches.length === 15
})
check('Exactly 2 catalog entries are implemented (Offer + Joining)', () => {
  const matches = catalog.match(/implemented: true/g) ?? []
  return matches.length === 2
})
check('LetterType union stays offer|joining (broader catalog kept separate, no regression risk)', () =>
  types.includes("export type LetterType = 'offer' | 'joining'"))

// ── Service layer: template versioning + lifecycle ─────────────────────────
console.log('\nService Layer — Templates')
const service = read('src/firebase/peopleLetters.ts')
check('Multi-template CRUD + versioning functions exist', () => [
  'getAllTemplates', 'getTemplateVersionHistory', 'createTemplate', 'saveNewTemplateVersion', 'cloneTemplate',
].every(fn => service.includes(`function ${fn}`) || service.includes(`export async function ${fn}`)))
check('Template lifecycle functions exist (archive/restore/soft-delete/default)', () => [
  'archiveTemplate', 'unarchiveTemplate', 'softDeleteTemplate', 'restoreTemplate', 'setDefaultTemplate', 'setTemplateActive',
].every(fn => service.includes(fn)))
check('Legacy single-doc template path preserved for backward compatibility', () =>
  service.includes('upsertDefaultLetterTemplate') && service.includes("DEFAULT_TEMPLATE_ID = 'default'"))
check('Template normalization fills defaults for pre-PEOPLE-003 docs (no data loss)', () =>
  service.includes('function normalizeTemplate'))

console.log('\nService Layer — Generated Documents')
check('Generated-document lifecycle functions exist', () => [
  'regenerateLetterPdf', 'setLetterDisabled', 'setLetterArchived', 'softDeleteGeneratedLetter', 'restoreGeneratedLetter',
].every(fn => service.includes(fn)))
check('Per-resource audit trail lookup exists', () => service.includes('getAuditLogsForResource'))

// ── PDF engine ───────────────────────────────────────────────────────────────
console.log('\nPremium PDF Engine')
check('src/utils/pdf/ helper modules exist', () => [
  'src/utils/pdf/fonts.ts', 'src/utils/pdf/images.ts', 'src/utils/pdf/qrcode.ts', 'src/utils/pdf/themes.ts',
].every(p => exists(p)))
const pdfUtil = read('src/utils/letterPdf.ts')
check('PDF builders remain async (fonts/images/QR are fetched before rendering)', () =>
  /export async function buildOfferLetterPdf/.test(pdfUtil) &&
  /export async function buildJoiningLetterPdf/.test(pdfUtil) &&
  /export async function downloadLetterPdf/.test(pdfUtil))
check('Hero banner rendering is constrained to ~12-15% of page height, not full-bleed', () =>
  /PAGE_HEIGHT \* 0\.1[2-5]/.test(pdfUtil))
check('Premium fonts registered via jsPDF VFS (not just Helvetica)', () => {
  const fonts = read('src/utils/pdf/fonts.ts')
  return fonts.includes('addFileToVFS') && fonts.includes("addFont") && fonts.includes('Inter')
})
check('Bundled Inter TTF files exist under public/fonts/', () => [
  'public/fonts/Inter-Regular.ttf', 'public/fonts/Inter-SemiBold.ttf', 'public/fonts/Inter-Bold.ttf',
].every(p => exists(p)))
check('qrcode dependency declared and used for verification QR codes', () => {
  const pkg = JSON.parse(read('package.json'))
  const qrUtil = read('src/utils/pdf/qrcode.ts')
  return Boolean(pkg.dependencies && pkg.dependencies.qrcode) && qrUtil.includes("from 'qrcode'")
})
check('Watermark uses jsPDF GState opacity (not solid overlay)', () => pdfUtil.includes('GState'))
check('Candidate Information rendered as a card, not a paragraph', () => pdfUtil.includes("card('', ["))
check('Theme presets drive card styling on top of template brand colors', () => {
  const themes = read('src/utils/pdf/themes.ts')
  return ['classic', 'corporate', 'premium', 'aerospace', 'defence', 'minimal'].every(t => themes.includes(t))
})

// ── UI: Template management ─────────────────────────────────────────────────
console.log('\nTemplate Management UI')
const templatesPage = read('src/pages/people/documents/Templates.tsx')
check('Templates page supports create/edit/clone/archive/restore/preview/version-history', () => [
  'createTemplate', 'saveNewTemplateVersion', 'cloneTemplate', 'archiveTemplate', 'unarchiveTemplate',
  'softDeleteTemplate', 'restoreTemplate', 'setDefaultTemplate', 'getTemplateVersionHistory', 'buildLetterPdf',
].every(fn => templatesPage.includes(fn)))
check('Preview PDF opens a blob URL rather than downloading/persisting', () => templatesPage.includes("output('bloburl')"))

// ── UI: Generated Documents management ──────────────────────────────────────
console.log('\nGenerated Documents UI')
const generatedPage = read('src/pages/people/documents/GeneratedLetters.tsx')
check('Generated Documents page supports search + status filter', () =>
  generatedPage.includes('setSearch') && generatedPage.includes('statusFilter'))
check('Generated Documents page supports preview/regenerate/disable/archive/delete/restore/audit', () => [
  'handlePreview', 'handleRegenerate', 'setLetterDisabled', 'setLetterArchived',
  'softDeleteGeneratedLetter', 'restoreGeneratedLetter', 'getAuditLogsForResource',
].every(fn => generatedPage.includes(fn)))

// ── No PDF binary stored in Firestore (still true post-rewrite) ────────────
console.log('\nNo PDF Binary In Firestore')
check('Firestore service never writes a PDF blob/base64/ArrayBuffer field', () =>
  !/pdfBinary|pdfBase64|pdfBytes|Blob\(/i.test(service))

// ── No paid AI ────────────────────────────────────────────────────────────
console.log('\nNo Paid AI')
check('No paid-AI SDK dependency introduced', () => {
  const pkg = JSON.parse(read('package.json'))
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
  return !Object.keys(deps).some(d => /openai|anthropic|google-generative|@google\/genai/i.test(d))
})
check('No AI provider imports in the new PDF engine / template files', () => {
  const files = [pdfUtil, templatesPage, generatedPage, service, types, catalog]
  return !files.some(content => /openai|@anthropic-ai|anthropic|generative-ai|googleai|gemini|\bclaude\b/i.test(content))
})

// ── Summary ───────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`)
console.log(`${passes} passed, ${failures} failed`)
if (failures > 0) {
  console.log('\nVerification FAILED')
  process.exit(1)
} else {
  console.log('\nVerification PASS')
  process.exit(0)
}
