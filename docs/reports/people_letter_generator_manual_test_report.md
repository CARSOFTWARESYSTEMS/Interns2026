# Internship Offer & Joining Letter PDF Generator — Manual Test Report

**Story:** PEOPLE-002
**Date:** 2026-07-07

This story was authored in a headless environment without an interactive browser or a logged-in Google/Firebase session, so a full click-through of the approval workflow behind real authentication was not possible. The tests below were chosen to exercise the parts that matter most and that a static `tsc`/build/verify pass cannot prove: that the app actually boots with the new code wired in, and that real PDF binaries are actually produced with the right content.

## 1. Dev server boot & module compilation

Ran `npm run dev` and requested the app shell and every new source file through Vite's dev transform endpoint (which fails loudly with a compile-error overlay on any TS/JSX problem):

```
$ curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5183/
200
```

All 5 new pages (`DocumentsHome.tsx`, `Templates.tsx`, `OfferLetter.tsx`, `JoiningLetter.tsx`, `GeneratedLetters.tsx`) transformed cleanly with no server-side compile errors. `App.tsx` confirmed to contain all 5 `PeopleDocuments*` route wire-ups; `Sidebar.tsx` confirmed to contain the new `documents` references.

## 2. Real PDF generation (bypassing Firebase auth)

Since click-driving the "Generate PDF" button requires a signed-in HR Manager/Platform Admin session, the PDF builders (`buildOfferLetterPdf`, `buildJoiningLetterPdf` in `src/utils/letterPdf.ts`) were exercised directly with `vite-node`, using the same seed template/letter data the UI falls back to (`SEED_LETTER_TEMPLATE`, `SEED_GENERATED_LETTERS`):

```
$ npx vite-node scratch/test-letter-pdf.mjs
offer pdf bytes: 8230 filename: ITEL-EV-INT-OFFER-2026-001_Devansh_Patel.pdf path: people-letters/offer/ITEL-EV-INT-OFFER-2026-001.pdf
joining pdf bytes: 7301 filename: ITEL-EV-INT-JOIN-2026-001_Devansh_Patel.pdf
offer header: %PDF-1.3
joining header: %PDF-1.3
```

Both outputs are genuine PDF files (correct `%PDF-1.3` magic header, non-trivial size). Running `pdftotext` against the offer letter confirms the rendered content is correct and complete:

```
$ pdftotext /tmp/offer-letter-test.pdf -
iTelematics Software Private Limited
iTelematics Software Private Limited — EV.ENGINEER

Internship Offer Letter
Document ID: ITEL-EV-INT-OFFER-2026-001

Date: 01 June 2026

Dear Devansh Patel,
We are pleased to offer you the position of "Battery Systems Engineering Intern" as part of the Remote
Research Internship at iTelematics Software Private Limited (EV.ENGINEER), within the Engineering
department, focused on Electric Vehicles & Aerospace Cybersecurity with specialisation in Battery Intelligence &
Aerospace Cybersecurity.

Internship Details
Internship Type:      Remote Research Internship
Duration:             3 to 6 months
Weekly Commitment:    20-25 hours/week
Start Date:           01 August 2026
End Date:             31 January 2027
Acceptance Deadline:  15 July 2026

Stipend
...
```

This confirms: the document ID renders correctly, candidate name/designation/dates flow through from the letter record, template fields (company name, internship type, domain, specialisation) flow through from the template, and the stipend section appears when `stipendEnabled` is true.

## 3. Static wiring checks

Covered exhaustively by `node scripts/verify-people-letter-generator.mjs` (51/51 passed) — see the Verification Report for the full transcript. This includes confirming the role-gating source code (`RoleGuard allow={['Platform Admin', 'HR Manager']}` on every Documents route, and the sidebar's `canSeeDocuments` filter) is present, not just that the pages render.

## Not tested (requires a live, authenticated session)

- Actually signing in as an HR Manager / Platform Admin account and clicking through Draft → Submit → Approve → Generate PDF → Send → Accept → (joining letter) in the browser.
- Confirming a Developer/Engineering Manager/Viewer account is redirected to `/403` when navigating to `/people/documents` directly (the `RoleGuard` logic is identical to the already-shipped, already-tested pattern used by `/people/recruitment` etc., so this is a low-risk gap, not an unknown one).
- Firestore Rules emulator run against the 5 new `match` blocks for all 7 roles.
- Cross-browser / print-dialog behaviour (not applicable here since generation is a direct binary download, not `window.print()`).

These gaps are also listed in the Known Limitations report along with a recommended next step.
