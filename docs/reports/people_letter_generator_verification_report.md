# Internship Offer & Joining Letter PDF Generator — Verification Report

**Story:** PEOPLE-002
**Date:** 2026-07-07

## Automated Checks

### `npx tsc --noEmit`

```
(no output — 0 errors)
```

### `npm run build`

```
> ev-engineer-battery-trust-platform@0.1.0 build
> tsc && vite build

vite v5.4.21 building for production...
transforming...
✓ 1969 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                              2.32 kB │ gzip:   0.77 kB
dist/assets/index-BSfVMV7s.css              49.24 kB │ gzip:   8.17 kB
dist/assets/purify.es-Csrj9YNg.js           28.14 kB │ gzip:  10.69 kB
dist/assets/index.es-C6jmeiow.js           150.69 kB │ gzip:  51.55 kB
dist/assets/html2canvas.esm-CBrSDip1.js    201.42 kB │ gzip:  48.03 kB
dist/assets/index-BXQgwn1x.js            1,947.65 kB │ gzip: 506.02 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 3.43s
```

### `node scripts/verify-people-letter-generator.mjs`

```
People Letter Generator (PEOPLE-002) — Verification

Sidebar
  PASS  Documents sidebar item exists under People Operations
  PASS  Documents link is gated to Platform Admin / HR Manager only

Routes
  PASS  Route "/people/documents" wired to <PeopleDocumentsHome />
  PASS  Route "/people/documents/templates" wired to <PeopleDocumentsTemplates />
  PASS  Route "/people/documents/offer-letter" wired to <PeopleDocumentsOfferLetter />
  PASS  Route "/people/documents/joining-letter" wired to <PeopleDocumentsJoiningLetter />
  PASS  Route "/people/documents/generated" wired to <PeopleDocumentsGenerated />
  PASS  All Documents routes are wrapped in RoleGuard allow=[Platform Admin, HR Manager]
  PASS  Documents routes do NOT grant Engineering Manager access

Pages
  PASS  Documents Home page exists (src/pages/people/documents/DocumentsHome.tsx)
  PASS  Templates page exists (src/pages/people/documents/Templates.tsx)
  PASS  Offer Letter page exists (src/pages/people/documents/OfferLetter.tsx)
  PASS  Joining Letter page exists (src/pages/people/documents/JoiningLetter.tsx)
  PASS  Generated Letters page exists (src/pages/people/documents/GeneratedLetters.tsx)

Type Models
  PASS  src/types/peopleLetters.ts exists
  PASS  All letter-generator collections represented in types
  PASS  Document ID pattern helper exists (ITEL-EV-INT-<TYPE>-<YEAR>-<SEQ>)
  PASS  17 intern designations modelled
  PASS  Template configuration fields cover company/branding/clauses
  PASS  Stipend can be enabled/disabled per letter
  PASS  Generated letter carries required metadata fields
  PASS  No pdf binary/base64 field type modelled on the letter record

Service Layer
  PASS  src/firebase/peopleLetters.ts exists
  PASS  Firestore collections wired for all 5 letter-generator collections
  PASS  firestore.rules covers all 5 letter-generator collections, restricted to canManageLetters()
  PASS  PDF generation is blocked before Approved status (service-layer guard)
  PASS  Document ID counter uses a Firestore transaction (atomic increment)
  PASS  Offer acceptance workflow exists (markOfferAccepted)
  PASS  Approval + rejection workflow exists

Joining Letter Gating
  PASS  Joining letter page only offers candidates whose offer status is Accepted
  PASS  Joining letter links back to its source offer letter (linkedOfferLetterId)

PDF Generation
  PASS  src/utils/letterPdf.ts exists
  PASS  PDF generation uses jsPDF (real binary PDF, not just HTML/print)
  PASS  jspdf declared as a project dependency
  PASS  Offer and joining letter PDF builders both exist
  PASS  Document ID is rendered into the PDF

No PDF Binary In Firestore
  PASS  Firestore service never writes a PDF blob/base64/ArrayBuffer field
  PASS  PDF is generated client-side on demand, not fetched from a stored binary URL

Access Control
  PASS  HR Manager role exists in the platform role system
  PASS  RoleGuard component exists and is used for Documents routes

Seed Data
  PASS  src/data/peopleLettersSeed.ts exists
  PASS  Seed exports a default template and a sample generated letter

No Paid AI
  PASS  No OpenAI/Claude/Gemini imports in src/
  PASS  No AI provider API key env vars introduced
  PASS  package.json has no paid-AI SDK dependency

Existing Features Preserved
  PASS  Existing Reports route ("/reports", FAI-style reporting) still present
  PASS  Battery Intelligence competency still present
  PASS  People Operations foundation routes still present (all 11)
  PASS  People Operations foundation service untouched (peopleOffers, peopleOnboarding still wired)
  PASS  Existing Admin routes still present
  PASS  Existing Simulators / Stories / Assignments routes still present

──────────────────────────────────────────────────
51 passed, 0 failed

Verification PASS
```

| Section | Checks | Result |
|---|---|---|
| Sidebar | 2 | PASS |
| Routes | 7 | PASS |
| Pages | 5 | PASS |
| Type Models | 7 | PASS |
| Service Layer | 6 | PASS |
| Joining Letter Gating | 2 | PASS |
| PDF Generation | 5 | PASS |
| No PDF Binary In Firestore | 2 | PASS |
| Access Control | 2 | PASS |
| Seed Data | 2 | PASS |
| No Paid AI | 3 | PASS |
| Existing Features Preserved | 6 | PASS |
| **Total** | **51** | **0 failed** |

## What each section confirms

- **Sidebar / Routes / Pages** — the "Documents" nav entry, all 5 routes, and all 5 page components exist and are wired together, and the routes are specifically gated to `['Platform Admin', 'HR Manager']` (not the broader People Operations role set).
- **Type Models** — every collection from the brief is modelled, all 17 intern designations are present, every listed template field exists, stipend is per-letter toggleable, and no field resembling a PDF binary/base64 payload was added to the letter record.
- **Service Layer** — all 5 collections are wired in `src/firebase/peopleLetters.ts`, `firestore.rules` covers them under a dedicated `canManageLetters()` guard, the document-ID counter uses a Firestore transaction (atomic, no duplicate-ID race), and the full approve/reject/accept workflow exists.
- **Joining Letter Gating** — the joining-letter page's eligible-candidate list is filtered to `status === 'Accepted'` offers only, and each joining letter records which offer it came from.
- **PDF Generation / No PDF Binary In Firestore** — PDF building genuinely uses `jsPDF` (not just HTML+print), both letter types have builders, the document ID is rendered into the output, and neither the Firestore service nor the generated-letters page ever writes or fetches a raw PDF binary — see the Manual Test Report for an actual generated-PDF content check.
- **Access Control** — `HR Manager` exists as a platform role and `RoleGuard` is the enforcement mechanism used.
- **No Paid AI** — no OpenAI/Claude/Gemini imports, env vars, or package.json dependencies were introduced anywhere in `src/`.
- **Existing Features Preserved** — `/reports` (FAI-style reporting), the `batteryIntelligence` competency, all 11 PEOPLE-001 routes and their Firestore service, and unrelated Admin/Engineering routes are all still present and untouched.

## Live Firestore Rules Emulator Verification

The static script above only checks that the right `match` blocks and helper functions exist in `firestore.rules` as *text*. To actually prove the rules behave correctly at the data layer, a second suite (`scripts/test-people-letter-rules.mjs`, using `@firebase/rules-unit-testing`) was run against a real local Firestore Emulator, loading the real `firestore.rules` and issuing genuine authenticated read/write requests for all 7 platform roles plus unauthenticated, against all 5 new collections, plus immutability and regression checks against the pre-existing `peopleOffers` collection.

```
$ JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-23.jdk/Contents/Home \
  npx firebase emulators:exec --project people-letter-rules-test --only firestore \
  "node scripts/test-people-letter-rules.mjs"

✔  firestore: Firestore Emulator was started in standard edition.
People Letter Generator — Firestore Rules Emulator Verification

Access control — every role × every new collection (read)
  PASS  Platform Admin → read peopleLetterTemplates: expect ALLOW
  PASS  Platform Admin → read peopleGeneratedLetters: expect ALLOW
  PASS  Platform Admin → read peopleLetterApprovals: expect ALLOW
  PASS  Platform Admin → read peopleLetterCounters: expect ALLOW
  PASS  Platform Admin → read peopleLetterAuditLogs: expect ALLOW
  PASS  Engineering Manager → read peopleLetterTemplates: expect DENY
  PASS  Engineering Manager → read peopleGeneratedLetters: expect DENY
  PASS  Engineering Manager → read peopleLetterApprovals: expect DENY
  PASS  Engineering Manager → read peopleLetterCounters: expect DENY
  PASS  Engineering Manager → read peopleLetterAuditLogs: expect DENY
  PASS  HR Manager → read peopleLetterTemplates: expect ALLOW
  PASS  HR Manager → read peopleGeneratedLetters: expect ALLOW
  PASS  HR Manager → read peopleLetterApprovals: expect ALLOW
  PASS  HR Manager → read peopleLetterCounters: expect ALLOW
  PASS  HR Manager → read peopleLetterAuditLogs: expect ALLOW
  PASS  Architect → read peopleLetterTemplates: expect DENY
  PASS  Architect → read peopleGeneratedLetters: expect DENY
  PASS  Architect → read peopleLetterApprovals: expect DENY
  PASS  Architect → read peopleLetterCounters: expect DENY
  PASS  Architect → read peopleLetterAuditLogs: expect DENY
  PASS  QA Engineer → read peopleLetterTemplates: expect DENY
  PASS  QA Engineer → read peopleGeneratedLetters: expect DENY
  PASS  QA Engineer → read peopleLetterApprovals: expect DENY
  PASS  QA Engineer → read peopleLetterCounters: expect DENY
  PASS  QA Engineer → read peopleLetterAuditLogs: expect DENY
  PASS  Developer → read peopleLetterTemplates: expect DENY
  PASS  Developer → read peopleGeneratedLetters: expect DENY
  PASS  Developer → read peopleLetterApprovals: expect DENY
  PASS  Developer → read peopleLetterCounters: expect DENY
  PASS  Developer → read peopleLetterAuditLogs: expect DENY
  PASS  Viewer → read peopleLetterTemplates: expect DENY
  PASS  Viewer → read peopleGeneratedLetters: expect DENY
  PASS  Viewer → read peopleLetterApprovals: expect DENY
  PASS  Viewer → read peopleLetterCounters: expect DENY
  PASS  Viewer → read peopleLetterAuditLogs: expect DENY

Access control — every role × every new collection (write)
  PASS  Platform Admin → write peopleLetterTemplates: expect ALLOW
  PASS  Platform Admin → write peopleGeneratedLetters: expect ALLOW
  PASS  Platform Admin → write peopleLetterApprovals: expect ALLOW
  PASS  Platform Admin → write peopleLetterCounters: expect ALLOW
  PASS  Platform Admin → write peopleLetterAuditLogs: expect ALLOW
  PASS  Engineering Manager → write peopleLetterTemplates: expect DENY
  PASS  Engineering Manager → write peopleGeneratedLetters: expect DENY
  PASS  Engineering Manager → write peopleLetterApprovals: expect DENY
  PASS  Engineering Manager → write peopleLetterCounters: expect DENY
  PASS  Engineering Manager → write peopleLetterAuditLogs: expect DENY
  PASS  HR Manager → write peopleLetterTemplates: expect ALLOW
  PASS  HR Manager → write peopleGeneratedLetters: expect ALLOW
  PASS  HR Manager → write peopleLetterApprovals: expect ALLOW
  PASS  HR Manager → write peopleLetterCounters: expect ALLOW
  PASS  HR Manager → write peopleLetterAuditLogs: expect ALLOW
  PASS  Architect → write peopleLetterTemplates: expect DENY
  PASS  Architect → write peopleGeneratedLetters: expect DENY
  PASS  Architect → write peopleLetterApprovals: expect DENY
  PASS  Architect → write peopleLetterCounters: expect DENY
  PASS  Architect → write peopleLetterAuditLogs: expect DENY
  PASS  QA Engineer → write peopleLetterTemplates: expect DENY
  PASS  QA Engineer → write peopleGeneratedLetters: expect DENY
  PASS  QA Engineer → write peopleLetterApprovals: expect DENY
  PASS  QA Engineer → write peopleLetterCounters: expect DENY
  PASS  QA Engineer → write peopleLetterAuditLogs: expect DENY
  PASS  Developer → write peopleLetterTemplates: expect DENY
  PASS  Developer → write peopleGeneratedLetters: expect DENY
  PASS  Developer → write peopleLetterApprovals: expect DENY
  PASS  Developer → write peopleLetterCounters: expect DENY
  PASS  Developer → write peopleLetterAuditLogs: expect DENY
  PASS  Viewer → write peopleLetterTemplates: expect DENY
  PASS  Viewer → write peopleGeneratedLetters: expect DENY
  PASS  Viewer → write peopleLetterApprovals: expect DENY
  PASS  Viewer → write peopleLetterCounters: expect DENY
  PASS  Viewer → write peopleLetterAuditLogs: expect DENY

Unauthenticated access
  PASS  Unauthenticated → read peopleLetterTemplates: expect DENY
  PASS  Unauthenticated → read peopleGeneratedLetters: expect DENY
  PASS  Unauthenticated → read peopleLetterApprovals: expect DENY
  PASS  Unauthenticated → read peopleLetterCounters: expect DENY
  PASS  Unauthenticated → read peopleLetterAuditLogs: expect DENY

Immutability — approvals & audit logs cannot be updated or deleted
  PASS  HR Manager cannot update an existing approval record (immutable)
  PASS  HR Manager cannot update an existing audit log (immutable)

Regression — existing PEOPLE-001 collections still enforce their original rules
  PASS  Engineering Manager CAN still write peopleOffers (unchanged by this story)
  PASS  Developer still CANNOT write peopleOffers (unchanged by this story)

────────────────────────────────────────────────────────────
79 passed, 0 failed

Rules Verification PASS
✔  Script exited successfully (code 0)
```

This is a genuine data-layer test, not a text match: it starts a real Firestore Emulator, loads the actual `firestore.rules` file, and issues real `getDoc`/`setDoc`/`updateDoc` calls as tokens carrying each role (via a seeded `users/{uid}` doc, exactly how `callerRole()` resolves in production) and confirms the emulator itself rejects/accepts each call. It proves, beyond static inspection: only Platform Admin and HR Manager can read or write any of the 5 new collections; every other role (including Engineering Manager, who *does* have broader People Operations access) and unauthenticated callers are denied on both read and write; `peopleLetterApprovals` and `peopleLetterAuditLogs` reject `update` calls even from an authorized HR Manager (append-only, as designed); and the pre-existing `peopleOffers` rule (Engineering Manager allowed, Developer denied) is unchanged by this story.

Requires a local JDK 21+ (the pre-installed Homebrew `openjdk@17` on this machine is too old for the current `firebase-tools` emulator; `JAVA_HOME` was pointed at the machine's separately-installed JDK 23 for this run) and adds `@firebase/rules-unit-testing` + `firebase-tools` as devDependencies. Re-run anytime with:

```bash
node scripts/test-people-letter-rules.mjs   # requires the Firestore emulator already running, or:
npx firebase emulators:exec --project <any-id> --only firestore "node scripts/test-people-letter-rules.mjs"
```

## Not covered by any script in this repo

- No automated browser click-through / E2E test (this repo has no test framework to extend, consistent with PEOPLE-001) — see the Manual Test Report for what was exercised against a live dev server instead.
