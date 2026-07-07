#!/usr/bin/env node
// Static verification for the Offer/Joining Letter PDF Generator (PEOPLE-002).
// Checks source-level wiring (sidebar, routes, types, services, firestore
// rules, PDF generation) and confirms no paid AI provider was introduced,
// and that FAI-style reporting / Battery Intelligence / People Operations
// foundation surfaces are untouched. Does not itself invoke tsc/vite —
// run `npx tsc --noEmit && npm run build` alongside this script.

import { existsSync, readFileSync, readdirSync } from 'node:fs'
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

console.log('People Letter Generator (PEOPLE-002) — Verification\n')

// ── Sidebar ───────────────────────────────────────────────────────────────
console.log('Sidebar')
const sidebar = read('src/components/layout/Sidebar.tsx')
check('Documents sidebar item exists under People Operations', () =>
  sidebar.includes('People Operations') && sidebar.includes("'/people/documents'") && sidebar.includes('Documents'))
check('Documents link is gated to Platform Admin / HR Manager only', () =>
  sidebar.includes('canSeeDocuments') && sidebar.includes("isHR") && sidebar.includes("role === 'HR Manager'"))

// ── Routes ────────────────────────────────────────────────────────────────
console.log('\nRoutes')
const app = read('src/App.tsx')
const routeChecks = [
  ['people/documents', 'PeopleDocumentsHome'],
  ['people/documents/templates', 'PeopleDocumentsTemplates'],
  ['people/documents/offer-letter', 'PeopleDocumentsOfferLetter'],
  ['people/documents/joining-letter', 'PeopleDocumentsJoiningLetter'],
  ['people/documents/generated', 'PeopleDocumentsGenerated'],
]
for (const [path, component] of routeChecks) {
  check(`Route "/${path}" wired to <${component} />`, () =>
    app.includes(`path="${path}"`) && app.includes(`<${component} />`))
}
check('All Documents routes are wrapped in RoleGuard allow=[Platform Admin, HR Manager]', () => {
  const docsRouteBlock = app.slice(app.indexOf('path="people/documents"'), app.indexOf('{/* Admin — Platform Admin + Engineering Manager */}'))
  const guardMatches = docsRouteBlock.match(/allow=\{\['Platform Admin', 'HR Manager'\]\}/g) ?? []
  return guardMatches.length === 5
})
check('Documents routes do NOT grant Engineering Manager access', () => {
  const start = app.indexOf('path="people/documents"')
  const end = app.indexOf('{/* Admin — Platform Admin + Engineering Manager */}')
  const docsRouteBlock = app.slice(start, end)
  return !docsRouteBlock.includes("'Engineering Manager'")
})

// ── Pages exist ───────────────────────────────────────────────────────────
console.log('\nPages')
const pages = [
  ['Documents Home', 'src/pages/people/documents/DocumentsHome.tsx'],
  ['Templates', 'src/pages/people/documents/Templates.tsx'],
  ['Offer Letter', 'src/pages/people/documents/OfferLetter.tsx'],
  ['Joining Letter', 'src/pages/people/documents/JoiningLetter.tsx'],
  ['Generated Letters', 'src/pages/people/documents/GeneratedLetters.tsx'],
]
for (const [label, path] of pages) {
  check(`${label} page exists (${path})`, () => exists(path))
}

// ── Type models ───────────────────────────────────────────────────────────
console.log('\nType Models')
check('src/types/peopleLetters.ts exists', () => exists('src/types/peopleLetters.ts'))
const types = exists('src/types/peopleLetters.ts') ? read('src/types/peopleLetters.ts') : ''
check('All letter-generator collections represented in types', () => [
  'PeopleLetterTemplate', 'PeopleGeneratedLetter', 'PeopleLetterApproval',
  'PeopleLetterCounter', 'PeopleLetterAuditLog',
].every(t => types.includes(`interface ${t}`)))
check('Document ID pattern helper exists (ITEL-EV-INT-<TYPE>-<YEAR>-<SEQ>)', () => {
  const service = read('src/firebase/peopleLetters.ts')
  return service.includes('ITEL-EV-INT-') && types.includes('letterDocPrefix')
})
check('17 intern designations modelled', () => {
  const match = types.match(/INTERN_DESIGNATIONS = \[([\s\S]*?)\] as const/)
  if (!match) return false
  const count = (match[1].match(/'[^']+',/g) ?? []).length
  return count === 17
})
check('Template configuration fields cover company/branding/clauses', () => [
  'companyName', 'businessUnit', 'department', 'domain', 'specialisation',
  'internshipType', 'durationText', 'weeklyHours', 'companyAddress', 'companyEmail',
  'companyWebsite', 'letterheadImageUrl', 'companyLogoUrl', 'headerText', 'footerText',
  'hrManagerName', 'hrManagerDesignation', 'signatureImageUrl',
  'stipendSectionEnabledByDefault', 'certificateEligibilityText', 'confidentialityClause',
  'codeOfConductClause', 'terminationClause', 'acceptanceInstructionText',
].every(f => types.includes(f)))
check('Stipend can be enabled/disabled per letter', () => types.includes('stipendEnabled: boolean'))
check('Generated letter carries required metadata fields', () => [
  'partnerId', 'organisationId', 'letterType', 'templateId', 'candidateId',
  'candidateName', 'candidateEmail', 'designation', 'documentId', 'status',
  'approvedBy', 'approvedAt', 'generatedBy', 'generatedAt', 'pdfUrl', 'pdfStoragePath',
  'createdAt', 'updatedAt', 'createdBy',
].every(f => types.includes(f)))
check('No pdf binary/base64 field type modelled on the letter record', () =>
  !/pdfBinary|pdfBase64|pdfBytes/i.test(types))

// ── Service layer ─────────────────────────────────────────────────────────
console.log('\nService Layer')
check('src/firebase/peopleLetters.ts exists', () => exists('src/firebase/peopleLetters.ts'))
const service = exists('src/firebase/peopleLetters.ts') ? read('src/firebase/peopleLetters.ts') : ''
check('Firestore collections wired for all 5 letter-generator collections', () => [
  'peopleLetterTemplates', 'peopleGeneratedLetters', 'peopleLetterApprovals',
  'peopleLetterCounters', 'peopleLetterAuditLogs',
].every(c => service.includes(`'${c}'`)))
check('firestore.rules covers all 5 letter-generator collections, restricted to canManageLetters()', () => {
  const rules = read('firestore.rules')
  const collections = [
    'peopleLetterTemplates', 'peopleGeneratedLetters', 'peopleLetterApprovals',
    'peopleLetterCounters', 'peopleLetterAuditLogs',
  ]
  const hasBlocks = collections.every(c => rules.includes(`match /${c}/`))
  const hasGuardFn = rules.includes('function canManageLetters()') && rules.includes('isPlatformAdmin() || isHRManager()')
  return hasBlocks && hasGuardFn
})
check('PDF generation is blocked before Approved status (service-layer guard)', () =>
  service.includes('markPdfGenerated') &&
  /PDF generation is only allowed after the letter has been approved/.test(service))
check('Document ID counter uses a Firestore transaction (atomic increment)', () =>
  service.includes('runTransaction'))
check('Offer acceptance workflow exists (markOfferAccepted)', () => service.includes('markOfferAccepted'))
check('Approval + rejection workflow exists', () =>
  service.includes('approveLetter') && service.includes('rejectLetter') && service.includes('submitLetterForApproval'))

// ── Joining letter requires accepted offer ─────────────────────────────────
console.log('\nJoining Letter Gating')
const joiningPage = read('src/pages/people/documents/JoiningLetter.tsx')
check('Joining letter page only offers candidates whose offer status is Accepted', () =>
  joiningPage.includes("o.status === 'Accepted'"))
check('Joining letter links back to its source offer letter (linkedOfferLetterId)', () =>
  joiningPage.includes('linkedOfferLetterId') && types.includes('linkedOfferLetterId'))

// ── PDF generation ─────────────────────────────────────────────────────────
console.log('\nPDF Generation')
check('src/utils/letterPdf.ts exists', () => exists('src/utils/letterPdf.ts'))
const pdfUtil = exists('src/utils/letterPdf.ts') ? read('src/utils/letterPdf.ts') : ''
check('PDF generation uses jsPDF (real binary PDF, not just HTML/print)', () =>
  pdfUtil.includes("from 'jspdf'") && pdfUtil.includes('new jsPDF'))
check('jspdf declared as a project dependency', () => {
  const pkg = JSON.parse(read('package.json'))
  return Boolean(pkg.dependencies && pkg.dependencies.jspdf)
})
check('Offer and joining letter PDF builders both exist', () =>
  pdfUtil.includes('buildOfferLetterPdf') && pdfUtil.includes('buildJoiningLetterPdf'))
check('Document ID is rendered into the PDF', () => pdfUtil.includes('letter.documentId'))

// ── No PDF binary stored in Firestore ──────────────────────────────────────
console.log('\nNo PDF Binary In Firestore')
check('Firestore service never writes a PDF blob/base64/ArrayBuffer field', () =>
  !/pdfBinary|pdfBase64|pdfBytes|Blob\(/i.test(service))
check('PDF is generated client-side on demand, not fetched from a stored binary URL', () => {
  const generatedPage = read('src/pages/people/documents/GeneratedLetters.tsx')
  return generatedPage.includes('downloadLetterPdf') && !generatedPage.includes('fetch(letter.pdfUrl')
})

// ── Access control ──────────────────────────────────────────────────────────
console.log('\nAccess Control')
check('HR Manager role exists in the platform role system', () => {
  const auth = read('src/types/auth.ts')
  return auth.includes("'HR Manager'")
})
check('RoleGuard component exists and is used for Documents routes', () => {
  const guard = read('src/components/auth/RoleGuard.tsx')
  return guard.includes('allow') && app.includes('RoleGuard allow={[\'Platform Admin\', \'HR Manager\']}')
})

// ── Seed data ────────────────────────────────────────────────────────────────
console.log('\nSeed Data')
check('src/data/peopleLettersSeed.ts exists', () => exists('src/data/peopleLettersSeed.ts'))
const seed = exists('src/data/peopleLettersSeed.ts') ? read('src/data/peopleLettersSeed.ts') : ''
check('Seed exports a default template and a sample generated letter', () =>
  seed.includes('export const SEED_LETTER_TEMPLATE') && seed.includes('export const SEED_GENERATED_LETTERS'))

// ── No paid AI ────────────────────────────────────────────────────────────
console.log('\nNo Paid AI')
function collectSourceFiles(dir, acc = []) {
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = join(dir, entry.name)
    if (entry.isDirectory()) collectSourceFiles(rel, acc)
    else if (/\.(ts|tsx)$/.test(entry.name)) acc.push(rel)
  }
  return acc
}
const sourceFiles = collectSourceFiles('src')
const AI_IMPORT_PATTERNS = [
  /openai/i, /@anthropic-ai/i, /anthropic/i, /generative-ai/i, /googleai/i,
  /gemini/i, /\bclaude\b/i,
]
const offendingFiles = sourceFiles.filter(f => {
  const content = read(f)
  return AI_IMPORT_PATTERNS.some(p => p.test(content))
})
check('No OpenAI/Claude/Gemini imports in src/', () => offendingFiles.length === 0)
if (offendingFiles.length) console.log(`         found in: ${offendingFiles.join(', ')}`)

check('No AI provider API key env vars introduced', () => {
  const envExample = exists('.env.example') ? read('.env.example') : ''
  return !/OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY|GOOGLE_AI_API_KEY/i.test(envExample)
})

check('package.json has no paid-AI SDK dependency', () => {
  const pkg = JSON.parse(read('package.json'))
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
  return !Object.keys(deps).some(d => /openai|anthropic|google-generative|@google\/genai/i.test(d))
})

// ── Existing features not broken ─────────────────────────────────────────
console.log('\nExisting Features Preserved')
check('Existing Reports route ("/reports", FAI-style reporting) still present', () =>
  app.includes('path="reports"') && exists('src/pages/Reports.tsx'))
check('Battery Intelligence competency still present', () => {
  const auth = read('src/types/auth.ts')
  return auth.includes('batteryIntelligence')
})
check('People Operations foundation routes still present (all 11)', () => [
  'people', 'people/recruitment', 'people/candidates', 'people/interviews',
  'people/offers', 'people/onboarding', 'people/profiles', 'people/reviews',
  'people/leave', 'people/policies', 'people/culture',
].every(r => app.includes(`path="${r}"`)))
check('People Operations foundation service untouched (peopleOffers, peopleOnboarding still wired)', () => {
  const peopleService = read('src/firebase/people.ts')
  return peopleService.includes("'peopleOffers'") && peopleService.includes("'peopleOnboarding'")
})
check('Existing Admin routes still present', () => [
  'admin/users', 'admin/invitations', 'admin/developer-settings', 'admin/assignments/new', 'admin/capacity',
].every(r => app.includes(`path="${r}"`)))
check('Existing Simulators / Stories / Assignments routes still present', () => [
  'assignments', 'simulators', 'stories', 'developers', 'evidence',
].every(r => app.includes(`path="${r}"`)))

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
