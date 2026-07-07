# Premium Corporate Document Engine — Manual Test Report

**Story:** PEOPLE-003
**Date:** 2026-07-07

## Environment constraint

This project is linked to a **live, production Firebase project** (`.env.local` holds real credentials, and sign-in is real Google OAuth restricted to iTelematics/EV.ENGINEER team members — confirmed via screenshot below). There is no local emulator config or test account available in this environment. That means two things were deliberately **not** done, on purpose, for safety:

1. **No sign-in was attempted.** There are no test credentials in this environment, and authenticating as a real user without being asked to would be inappropriate.
2. **No data was written to the production Firestore.** Everything below either reads nothing at all, or runs the new PDF engine directly in the browser against in-memory sample data (the same `SEED_LETTER_TEMPLATE` / `SEED_GENERATED_LETTERS` already used as this module's offline display fallback) — no template, letter, or audit log was created, modified, or deleted in the real database.

Given that constraint, verification here focuses on what can be checked safely: (a) the app boots cleanly against production config, and (b) the new premium PDF engine — the highest-risk, purely-client-side part of this change — actually runs correctly in a real browser, not just type-checks.

## What was tested

### 1. App boots cleanly

Started the dev server (`npm run dev`, port 5174 — a second, unrelated dev server was already running on 5173 for another project) and loaded it in headless Chromium.

- Page title and branding render correctly: "UFlight™ | EV.ENGINEER™ — Aerospace Intelligence & Cybersecurity Platform."
- The real sign-in screen renders (Google OAuth button, contact footer with `info@iTelematics.com` and WhatsApp link) — confirms the People Operations Documents module didn't break app bootstrap.
- No console errors during initial load.

### 2. Premium PDF engine — direct runtime smoke test

Since the Offer/Joining Letter pages require an authenticated HR Manager/Platform Admin session, the PDF engine (`src/utils/letterPdf.ts` + `src/utils/pdf/*`) was exercised directly in the browser via a dynamic `import()` of the Vite-served module, bypassing the UI and Firestore entirely:

```js
const mod  = await import('/src/utils/letterPdf.ts')
const seed = await import('/src/data/peopleLettersSeed.ts')
const template = { ...seed.SEED_LETTER_TEMPLATE, watermarkEnabled: true, qrCodeEnabled: true, heroBannerEnabled: true }
await mod.buildOfferLetterPdf(seed.SEED_GENERATED_LETTERS[0], template)
await mod.buildJoiningLetterPdf({ ...seed.SEED_GENERATED_LETTERS[0], letterType: 'joining' }, template)
```

Results:

| Check | Result |
|---|---|
| Offer letter PDF builds without throwing | ✅ 3 pages |
| Joining letter PDF builds without throwing | ✅ 2 pages |
| Inter font registered into jsPDF (not just Helvetica) | ✅ `getFontList()` includes `Inter` alongside the built-ins |
| Hero banner image (real `ev.engineer` URL from the spec) fetches and embeds | ✅ no fetch/CORS error, PDF byte size consistent with an embedded ~image |
| QR code generates | ✅ no error (uses the `qrcode` dependency) |
| No console/page errors during generation | ✅ |

### 3. Graceful degradation — broken branding URLs

Re-ran the same smoke test with `heroBannerImageUrl`, `signatureImageUrl`, and `companySealImageUrl` all pointed at a non-existent host, `theme: 'aerospace'`, and `watermarkEnabled: true`:

| Check | Result |
|---|---|
| PDF still builds (doesn't throw) | ✅ 2 pages, smaller byte size (no images embedded, as expected) |
| No page errors | ✅ |

This confirms the "skip the image, don't break the document" fallback described in the plan actually works, not just that the `try/catch` is present in the source.

## What could not be manually tested here (needs the user)

The following require an authenticated HR Manager/Platform Admin session and were **not** exercised in this environment. Please run through this checklist yourself (or ask for a follow-up session with test credentials / a Firestore emulator):

- [ ] Create a new template from `/people/documents/templates`, set a hero banner URL, brand colors, and a theme; confirm it appears in the template list.
- [ ] Preview PDF from the editor (should open a new tab with the rendered document, no download/save prompt).
- [ ] Save an edit as a new version; confirm Version History shows both versions with the correct `isLatest` marker.
- [ ] Clone a template; confirm the clone is an independent group (editing/deleting it doesn't affect the original).
- [ ] Set a different template as Default; confirm `OfferLetter.tsx` / `JoiningLetter.tsx` pick it up for new drafts.
- [ ] Archive a template, confirm it moves to "Archived & Deleted," then Unarchive it back.
- [ ] Soft-delete a template, confirm Restore brings it back.
- [ ] Generate a real Offer Letter end-to-end (Draft → Submit → Approve → Generate PDF) and visually confirm the premium layout, QR code, and watermark (if enabled) in the downloaded PDF.
- [ ] Generate a Joining Letter from an Accepted offer, same visual check.
- [ ] On Generated Documents: search by candidate name/Document ID, filter by status, Preview, Regenerate, Disable/Enable, Archive/Unarchive, Soft-delete/Restore, and open the Audit Trail modal for a document.
- [ ] Confirm a pre-existing (PEOPLE-002-era) generated letter is still downloadable (backward compatibility with the legacy `peopleLetterTemplates/default` doc).
