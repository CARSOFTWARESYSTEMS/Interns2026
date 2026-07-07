# Internship Offer & Joining Letter PDF Generator — Implementation Report

**Story:** PEOPLE-002
**Scope:** Configurable Offer Letter & Joining Letter Generator inside People Operations, for EV.ENGINEER / iTelematics Software Private Limited.
**Date:** 2026-07-07

## Summary

Added a **Documents** sub-module to People Operations that lets HR Manager / Super Admin (Platform Admin) configure a reusable letter template once, then generate Internship Offer Letters and Internship Joining Letters per candidate through an explicit Draft → Approval → PDF workflow. PDFs are real binaries (generated client-side with `jsPDF`), never stored in Firestore — only structured metadata (candidate fields, status, document ID, approval trail) is persisted. No AI provider of any kind was introduced.

## Files Created

| File | Purpose |
|---|---|
| `src/types/peopleLetters.ts` | Data model — `PeopleLetterTemplate`, `PeopleGeneratedLetter`, `PeopleLetterApproval`, `PeopleLetterCounter`, `PeopleLetterAuditLog`; `INTERN_DESIGNATIONS` (17 designations); `LetterStatus` workflow enum |
| `src/firebase/peopleLetters.ts` | Firestore service — template CRUD, draft/submit/approve/reject/generate/send/download/accept workflow functions, transactional document-ID counter, audit log writer |
| `src/utils/letterPdf.ts` | jsPDF-based PDF builders for offer and joining letters, filename/storage-path helpers, `downloadLetterPdf` |
| `src/data/peopleLettersSeed.ts` | Deterministic seed template + sample generated letter, used as a display fallback when Firestore is empty |
| `src/pages/people/documents/DocumentsHome.tsx` | `/people/documents` — status counts + links into the four sub-pages |
| `src/pages/people/documents/Templates.tsx` | `/people/documents/templates` — full template configuration form |
| `src/pages/people/documents/OfferLetter.tsx` | `/people/documents/offer-letter` — create + drive the offer-letter workflow |
| `src/pages/people/documents/JoiningLetter.tsx` | `/people/documents/joining-letter` — create + drive the joining-letter workflow (gated on an Accepted offer) |
| `src/pages/people/documents/GeneratedLetters.tsx` | `/people/documents/generated` — unified list of every generated letter with re-download |
| `scripts/verify-people-letter-generator.mjs` | Static verification script (51 checks) |
| `scripts/test-people-letter-rules.mjs` | Live Firestore Rules Emulator test suite (79 checks) — every role × every new collection, immutability, and a `peopleOffers` regression check |
| `docs/reports/people_letter_generator_*.md` | This report + verification/manual-test/known-limitations reports |

## Files Changed

| File | Change |
|---|---|
| `src/App.tsx` | Added 5 routes under `/people/documents*`, each wrapped in `RoleGuard allow={['Platform Admin', 'HR Manager']}` |
| `src/components/layout/Sidebar.tsx` | Added a "Documents" link to the People Operations nav section, hidden from every role except Platform Admin and HR Manager (`canSeeDocuments`) |
| `firestore.rules` | Added `canManageLetters()` helper (`isPlatformAdmin() || isHRManager()` — deliberately excludes Engineering Manager) and `match` blocks for all 5 new collections |
| `package.json` | Added `jspdf` as a production dependency; added `@firebase/rules-unit-testing` and `firebase-tools` as devDependencies for the live rules test |
| `firebase.json` | Added an `emulators.firestore` port config so `firebase emulators:exec` can run the new rules test suite |

**Nothing existing was moved, renamed, or removed.** All 11 People Operations Foundation (PEOPLE-001) routes, Admin routes, Reports, Simulators, Stories, Assignments, Evidence, and Developers routes are untouched — see the verification script's "Existing Features Preserved" section.

## Routes Added

```
/people/documents                  Documents home / overview   (Platform Admin, HR Manager)
/people/documents/templates        Letter template config      (Platform Admin, HR Manager)
/people/documents/offer-letter     Offer letter workflow        (Platform Admin, HR Manager)
/people/documents/joining-letter   Joining letter workflow      (Platform Admin, HR Manager)
/people/documents/generated        Generated letters list        (Platform Admin, HR Manager)
```

## Sidebar

A single "Documents" entry was added to the existing **People Operations** nav section. Unlike every other item in that section, it is filtered out client-side for any role other than Platform Admin / HR Manager (`canSeeDocuments` in `Sidebar.tsx`), in addition to the server-side `RoleGuard` on each route.

## Data Models Added

5 Firestore-ready collections, each carrying the standard People Operations envelope (`partnerId`, `organisationId`, `createdAt`, `updatedAt`, `createdBy`, `status`):

- **`peopleLetterTemplates`** — one reusable template document (`id: 'default'`) holding every configurable field: company identity (name, business unit, department, domain, specialisation, address, email, website, letterhead/logo image URLs), internship defaults (type, duration, weekly hours), letter chrome (header/footer text), HR signatory (name, designation, signature image URL), the stipend-section default toggle, and all five clause/instruction texts (certificate eligibility, confidentiality/IP, code of conduct, termination, acceptance instructions).
- **`peopleGeneratedLetters`** — one document per generated offer/joining letter: candidate fields, designation, document ID, workflow `status`, approval metadata, generation metadata, `pdfUrl`/`pdfStoragePath` (traceability strings only — see PDF section), and `linkedOfferLetterId` tying a joining letter back to its accepted offer.
- **`peopleLetterApprovals`** — immutable approval/rejection history, one row per decision, separate from the convenience `approvedBy`/`approvedAt` fields on the letter itself.
- **`peopleLetterCounters`** — one counter document per `(letterType, year)` (e.g. `offer-2026`), incremented inside a Firestore transaction to produce the sequential document ID.
- **`peopleLetterAuditLogs`** — append-only audit trail (`template_updated`, `letter_drafted`, `letter_submitted`, `letter_approved`, `letter_rejected`, `pdf_generated`, `letter_sent`, `letter_downloaded`, `letter_accepted`).

## Template Fields Added

Every field listed in the PEOPLE-002 brief is present on `PeopleLetterTemplate` and editable from `/people/documents/templates`: company name, business unit, department, domain, specialisation, internship type, duration, weekly hours, company address, email, website, letterhead image, company logo, header text, footer text, HR Manager name, HR Manager designation, signature image, stipend section on/off (default), certificate eligibility text, confidentiality/IP clause, code of conduct clause, termination clause, acceptance instruction text.

Per-letter, HR only fills candidate-specific fields: candidate name, email, designation (from the 17-item `INTERN_DESIGNATIONS` list), internship start/end date, acceptance deadline, and stipend enabled + amount — everything else is pulled from the template at generation time.

## Document ID Generation

Pattern: `ITEL-EV-INT-<OFFER|JOIN>-<YEAR>-<SEQ3>`, e.g. `ITEL-EV-INT-OFFER-2026-001`, `ITEL-EV-INT-JOIN-2026-001`. The sequence is per `(letterType, year)`, atomically incremented via `runTransaction` against `peopleLetterCounters` at draft-creation time, and stored on the letter's `documentId` field. It is also rendered directly into the generated PDF's header and footer.

## Approval Workflow

Implemented exactly as specified, enforced both in the UI (buttons only appear for the current status) and in the service layer (`markPdfGenerated` throws if the letter isn't `Approved` or later):

```
Offer:    Draft → Submitted for Approval → Approved → PDF Generated → Sent / Downloaded → Accepted
Joining:  (requires a linked Accepted offer) → Draft → Submitted for Approval → Approved → PDF Generated
```

A `Rejected` state exists off "Submitted for Approval" for both letter types, recorded in `peopleLetterApprovals` with a reason.

## PDF Generation Approach

PDFs are real binaries built client-side with **jsPDF** (`src/utils/letterPdf.ts`) — a small, dependency-light, non-AI, MIT-licensed library, consistent with the "no paid AI" and "keep the app lightweight" constraints. Each PDF includes: company name/letterhead line, document ID, date, candidate name, internship details, the stipend section (only if enabled on that letter), certificate eligibility, confidentiality/IP clause, code of conduct clause, termination clause (offer only), acceptance deadline/instructions, and an HR Manager signature block with a footer carrying company email and website.

**No PDF binary is ever persisted** — not in Firestore (which was explicitly disallowed) and, in this iteration, not in any external object store either. Every "Generate PDF" / "Download" / "Re-download" action rebuilds the PDF on demand from the letter's Firestore metadata plus the current template, and triggers a browser download. `pdfStoragePath` is recorded on the letter document as a descriptive, deterministic path (`people-letters/<type>/<documentId>.pdf`) for traceability only — it does not point at an actual stored file. See the Known Limitations report for the recommended next step (wiring this to Firebase Storage).

## Access Control Implementation

- **Route level:** every `/people/documents*` route is wrapped in `<RoleGuard allow={['Platform Admin', 'HR Manager']}>` in `App.tsx` — strictly narrower than the rest of People Operations, which also admits Engineering Manager.
- **Sidebar level:** the "Documents" nav link is filtered out for every role except Platform Admin / HR Manager.
- **Data level:** `firestore.rules` adds `canManageLetters() { return isPlatformAdmin() || isHRManager(); }` and applies it to all 5 new collections' read/write rules — Engineering Manager, Architect, QA Engineer, Developer, and Viewer have no access at any layer.
- **"Owner" role:** the brief asks for optional read/approval visibility for an "Owner" role. This platform's `UserRole` union (`src/types/auth.ts`) has no `Owner` role — "Super Admin" already maps to `Platform Admin` via an email allowlist. No fictitious role was invented; see Known Limitations.

## Build Validation

```text
npx tsc --noEmit                                    → 0 errors
npm run build                                        → succeeds (see known limitations for bundle-size note)
node scripts/verify-people-letter-generator.mjs      → 51 passed, 0 failed, "Verification PASS"
node scripts/test-people-letter-rules.mjs            → 79 passed, 0 failed, "Rules Verification PASS"
                                                        (live Firestore Rules Emulator — see Verification Report)
```
