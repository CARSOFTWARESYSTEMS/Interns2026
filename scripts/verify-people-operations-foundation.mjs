#!/usr/bin/env node
// Static verification for the People Operations foundation (PEOPLE-001).
// Checks source-level wiring (sidebar, routes, types, services, seed data)
// and confirms no paid AI provider was introduced. Does not itself invoke
// tsc/vite — run `npx tsc --noEmit && npm run build` alongside this script.

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

console.log('People Operations Foundation — Verification\n')

// ── Sidebar ───────────────────────────────────────────────────────────────
console.log('Sidebar')
const sidebar = read('src/components/layout/Sidebar.tsx')
check('PEOPLE OPERATIONS section exists in sidebar', () => sidebar.includes('People Operations'))
check('Sidebar links to all 11 People routes', () => [
  '/people', '/people/recruitment', '/people/candidates', '/people/interviews',
  '/people/offers', '/people/onboarding', '/people/profiles', '/people/reviews',
  '/people/leave', '/people/policies', '/people/culture',
].every(r => sidebar.includes(`'${r}'`)))

// ── Routes ────────────────────────────────────────────────────────────────
console.log('\nRoutes')
const app = read('src/App.tsx')
const routeChecks = [
  ['people', 'PeopleDashboard'],
  ['people/recruitment', 'PeopleRecruitment'],
  ['people/candidates', 'PeopleCandidates'],
  ['people/interviews', 'PeopleInterviews'],
  ['people/offers', 'PeopleOffers'],
  ['people/onboarding', 'PeopleOnboarding'],
  ['people/profiles', 'PeopleProfiles'],
  ['people/reviews', 'PeopleReviews'],
  ['people/leave', 'PeopleLeave'],
  ['people/policies', 'PeoplePolicies'],
  ['people/culture', 'PeopleCulture'],
]
for (const [path, component] of routeChecks) {
  check(`Route "/${path}" wired to <${component} />`, () =>
    app.includes(`path="${path}"`) && app.includes(`<${component} />`))
}

// ── Pages build (source files present) ─────────────────────────────────────
console.log('\nPages')
const pages = [
  ['People Dashboard', 'src/pages/people/PeopleDashboard.tsx'],
  ['Recruitment', 'src/pages/people/Recruitment.tsx'],
  ['Candidates', 'src/pages/people/Candidates.tsx'],
  ['Interviews', 'src/pages/people/Interviews.tsx'],
  ['Offers', 'src/pages/people/Offers.tsx'],
  ['Onboarding', 'src/pages/people/Onboarding.tsx'],
  ['People Profiles', 'src/pages/people/Profiles.tsx'],
  ['1:1 Reviews', 'src/pages/people/Reviews.tsx'],
  ['Leave', 'src/pages/people/Leave.tsx'],
  ['Policies', 'src/pages/people/Policies.tsx'],
  ['Culture', 'src/pages/people/Culture.tsx'],
]
for (const [label, path] of pages) {
  check(`${label} page exists (${path})`, () => exists(path))
}

// ── Type models ───────────────────────────────────────────────────────────
console.log('\nType Models')
check('src/types/people.ts exists', () => exists('src/types/people.ts'))
const types = exists('src/types/people.ts') ? read('src/types/people.ts') : ''
check('All 13 People collections represented in types', () => [
  'PeopleProfile', 'PeopleJobOpening', 'PeopleCandidate', 'PeopleApplication',
  'PeopleInterview', 'PeopleOffer', 'PeopleOnboarding', 'PeopleOneOnOneReview',
  'PeopleLeaveRequest', 'PeoplePolicy', 'PeoplePolicyAcknowledgement',
  'PeopleCultureSignal', 'PeopleAuditLog',
].every(t => types.includes(`interface ${t}`)))
check('employmentType (intern|employee|contractor) modelled', () =>
  types.includes("'intern' | 'employee' | 'contractor'"))
check('personStatus lifecycle modelled', () =>
  types.includes('PersonStatus'))
check('A.S.K.I. score model exists', () =>
  types.includes('AskiScore') && ['attitude', 'skills', 'knowledge', 'integrity', 'communication', 'ownership', 'learningAbility'].every(k => types.includes(k)))
check('HR role mapping exists in auth types', () => {
  const auth = read('src/types/auth.ts')
  return auth.includes('HR Manager') && auth.includes('PEOPLE_ROLE_ACCESS')
})

// ── Service foundations ───────────────────────────────────────────────────
console.log('\nService Foundations')
check('src/firebase/people.ts exists', () => exists('src/firebase/people.ts'))
const service = exists('src/firebase/people.ts') ? read('src/firebase/people.ts') : ''
check('Firestore collections wired for all 13 People collections', () => [
  'peopleProfiles', 'peopleJobOpenings', 'peopleCandidates', 'peopleApplications',
  'peopleInterviews', 'peopleOffers', 'peopleOnboarding', 'peopleOneOnOneReviews',
  'peopleLeaveRequests', 'peoplePolicies', 'peoplePolicyAcknowledgements',
  'peopleCultureSignals', 'peopleAuditLogs',
].every(c => service.includes(`'${c}'`)))
check('firestore.rules covers all 13 People collections', () => {
  const rules = read('firestore.rules')
  return [
    'peopleProfiles', 'peopleJobOpenings', 'peopleCandidates', 'peopleApplications',
    'peopleInterviews', 'peopleOffers', 'peopleOnboarding', 'peopleOneOnOneReviews',
    'peopleLeaveRequests', 'peoplePolicies', 'peoplePolicyAcknowledgements',
    'peopleCultureSignals', 'peopleAuditLogs',
  ].every(c => rules.includes(`match /${c}/`))
})

// ── Seed / sample data ────────────────────────────────────────────────────
console.log('\nSeed Data')
check('src/data/peopleSeed.ts exists', () => exists('src/data/peopleSeed.ts'))
const seed = exists('src/data/peopleSeed.ts') ? read('src/data/peopleSeed.ts') : ''
check('Seed data covers intern, employee and contractor', () =>
  ["'intern'", "'employee'", "'contractor'"].every(t => seed.includes(t)))
check('Seed data exports sample arrays for key collections', () => [
  'SEED_PEOPLE_PROFILES', 'SEED_JOB_OPENINGS', 'SEED_CANDIDATES', 'SEED_INTERVIEWS',
  'SEED_OFFERS', 'SEED_ONBOARDING', 'SEED_REVIEWS', 'SEED_LEAVE_REQUESTS',
  'SEED_POLICIES', 'SEED_CULTURE_SIGNALS',
].every(v => seed.includes(`export const ${v}`)))

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

// ── Existing features not broken ─────────────────────────────────────────
console.log('\nExisting Features Preserved')
check('Existing Reports route ("/reports", FAI-style reporting) still present', () =>
  app.includes('path="reports"') && exists('src/pages/Reports.tsx'))
check('Battery Intelligence competency still present', () => {
  const auth = read('src/types/auth.ts')
  return auth.includes('batteryIntelligence')
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
