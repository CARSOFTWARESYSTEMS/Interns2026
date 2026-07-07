# Premium Corporate Document Engine — Known Limitations Report

**Story:** PEOPLE-003
**Date:** 2026-07-07

These are known, intentional simplifications or gaps — scoped deliberately to ship a real premium engine for Offer/Joining Letter without over-building for 15 document types that don't exist yet, and without introducing infrastructure (Storage uploads, paid AI, new auth roles) beyond what the brief and prior PEOPLE-002 decisions already established.

## Re-download still uses the "default" template, not the letter's exact version

Every generated letter now stores `templateId` and `templateVersion` at creation time — but `OfferLetter.tsx`, `JoiningLetter.tsx`, and `GeneratedLetters.tsx` still fetch the single **current default** template (`getDefaultLetterTemplate()`) for every download/preview/regenerate action, exactly as PEOPLE-002 did. This is the same historical-accuracy gap flagged in the PEOPLE-002 known-limitations report, now slightly wider in scope: if HR edits the default template, switches which template is Default, or archives one, re-downloading an older letter reflects *today's* default template, not the template version that was actually live when that letter was approved — even though the correct version is recorded right there on the letter document.

**Recommended fix (next sprint):** change the three download/preview/regenerate call sites to look up the specific template by `letter.templateId` (falling back to `getDefaultLetterTemplate()` only if that exact doc is missing), rather than always using the default.

## Only Inter is actually embedded in the PDF

The template editor offers 5 font choices (Inter, Plus Jakarta Sans, Manrope, Source Sans 3, Poppins) per the spec's typography section, but only Inter is bundled as a real jsPDF font (`public/fonts/Inter-*.ttf`, registered via `addFileToVFS`/`addFont`). Selecting any other font is stored on the template but currently **renders as Inter** in the generated PDF — the dropdown is labeled accordingly ("reserved — renders as Inter for now") so this isn't silently misleading. Embedding the other 4 typefaces is mechanical (same `fonts.ts` pattern, more TTF files) but was left out to keep the font-bundle size and scope contained for this iteration.

## Objectives/Values are colored chip cards, not icon glyphs

The spec's mockup shows "icon cards" for Internship Objectives and Engineering Values. jsPDF has no reliable way to render arbitrary icon glyphs (no icon font is embedded), so these sections render as rounded, colored chip cards with a dot + bold label instead of a literal icon. Visually distinct and on-brand, but not pixel-identical to the spec's icon-card mockup. Embedding an icon font (e.g. Lucide as a TTF) would close this gap in a follow-up.

## Branding images depend on the host allowing cross-origin fetch

Hero banner / logo / signature / company seal are still plain URL fields (per the confirmed scope decision — no Firebase Storage upload was added). At generation time, `loadImageAsDataUrl()` fetches the URL client-side and converts it to a data URI for jsPDF; this requires the image host to permit cross-origin reads. The spec's own default hero banner URLs (`ev.engineer`) were confirmed working in the runtime smoke test (see Manual Test Report), but a template pointed at an image host with restrictive CORS headers will silently render without that image rather than fail the whole document — verified in the same smoke test with deliberately broken URLs. This is a deliberate "degrade, don't break" tradeoff, not a bug, but it means HR should test any new image URL via "Preview PDF" before relying on it.

## No true file upload for branding assets

Per the confirmed scope decision, hero banner/logo/letterhead/signature/seal all remain URL-only fields (consistent with PEOPLE-002's `letterheadImageUrl`/`companyLogoUrl`/`signatureImageUrl`) — HR must host the image somewhere else first and paste the URL in. Wiring actual file upload would mean adding `firebase/storage` (the `storageBucket` env var already exists, unused, same note as PEOPLE-002's known limitations).

## Document Catalog is a static roadmap, not a plugin system

`DOCUMENT_CATALOG` (15 entries, 2 implemented) is a flat, hardcoded list for visibility — it is **not** an extensible plugin architecture. Adding real support for, say, an Experience Letter means: adding a template shape, a PDF builder, workflow pages, and Firestore wiring much like Offer/Joining Letter got — the catalog entry alone doesn't reduce that work, it just documents that the work is expected and not yet started.

## Template versioning has no diff/rollback UI beyond "view + restore forward"

Version History shows every version's note and timestamp, and "restoring" an older version works by saving it forward as a new latest version (clone-forward) — there's no side-by-side diff between versions, and no way to see *which fields* changed between v1.0 and v1.1 beyond reading the version note HR typed in.

## No live theme preview outside the PDF

Themes (classic/corporate/premium/aerospace/defence/minimal) only visibly differ inside the generated/previewed PDF — the Templates editor form itself doesn't render a live mock of the selected theme's look. "Preview PDF" is the only way to see a theme's effect, which is one extra click but not a limitation of correctness.

## Carried forward from PEOPLE-002 (still true)

- No PDF binary is persisted anywhere (Firestore or object storage) — every download/regenerate rebuilds client-side. Unchanged from PEOPLE-002; see that story's known-limitations report for the Firebase Storage recommendation, which would also solve the "exact version at generation time" gap above if the rendered Blob were snapshotted at approval time.
- No segregation-of-duties enforcement (same HR Manager can draft and approve).
- No "Owner" role (Platform Admin + HR Manager only, as before).
- No authenticated browser click-through of the full workflow was performed in this environment — see the Manual Test Report for what could and couldn't be safely tested against the live production Firebase project, and the manual QA checklist for the user to run.

## Next recommended sprint

1. Change download/preview/regenerate call sites to resolve the letter's exact `templateId` instead of always using the current default template.
2. Embed the remaining 4 typefaces (Plus Jakarta Sans, Manrope, Source Sans 3, Poppins) as real PDF fonts.
3. Replace chip-card bullets with an embedded icon font for a closer match to the spec's icon-card mockup.
4. Wire Firebase Storage for both branding asset uploads (closing the "URL-only" gap) and generated-PDF snapshots (closing the "exact version" gap) in one pass, since both need the same Storage integration.
5. Pick the next real document type from the catalog (Experience Letter or NDA are the smallest scope) and build it out fully, proving the "architecture ready" claim with a second real implementation.
6. Run the manual QA checklist from the Manual Test Report against a real authenticated session before relying on this in production.
