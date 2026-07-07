# Premium Corporate Document Engine — Implementation Report

**Story:** PEOPLE-003
**Scope:** Redesign of the PEOPLE-002 Offer/Joining Letter generator into a premium, brand-configurable, versioned Corporate Document Engine for EV.ENGINEER / iTelematics Software Private Limited.
**Date:** 2026-07-07

## Summary

PEOPLE-002 shipped a working but visually plain Offer/Joining Letter generator: one fixed Firestore template, a black-and-white jsPDF layout, and a Draft → Approve → Generate → Send → Accept workflow. PEOPLE-003 keeps that workflow **exactly as-is** and upgrades everything around it: templates are now versioned and multi-instance (create, clone, archive, soft-delete, restore, set-default, version history), each template carries premium branding (theme, brand colors, hero banner, watermark, QR code, company seal), and the generated PDF itself is a real premium document — hero banner, rounded information cards, chip-style objective/value sections, key-terms cards, an embedded Inter typeface, and a verification QR code. Generated documents gained lifecycle management (regenerate, disable, archive, soft-delete, restore, per-document audit trail). The other ~15 document types from the brief (NDA, experience letter, promotion letter, etc.) are modelled as a visible, honestly-labelled roadmap catalog rather than built out — no workflow or PDF exists for them yet. No paid AI provider of any kind was introduced.

## Files Created

| File | Purpose |
|---|---|
| `src/types/documentCatalog.ts` | Static 15-entry roadmap catalog (`DOCUMENT_CATALOG`) — 2 marked `implemented: true` (Offer, Joining), 13 marked `false`. Deliberately kept separate from `LetterType` so the existing workflow's types are never put at risk. |
| `src/utils/pdf/fonts.ts` | Registers bundled Inter TTFs into jsPDF's virtual filesystem (`registerPremiumFonts`) so the PDF uses real premium typography instead of jsPDF's built-in Helvetica. |
| `src/utils/pdf/images.ts` | `loadImageAsDataUrl`, `dataUrlImageSize`, `imageFormatFromDataUrl` — fetches a remote branding image URL (hero banner/logo/signature/seal) and converts it for jsPDF embedding, failing gracefully (image just omitted) rather than breaking generation. |
| `src/utils/pdf/qrcode.ts` | `buildVerificationQrDataUrl` — generates a QR code (via the new `qrcode` dependency) pointing at `https://ev.engineer/verify/<documentId>`, the spec's future verification URL. |
| `src/utils/pdf/themes.ts` | `THEME_PRESETS` — 6 theme presets (classic/corporate/premium/aerospace/defence/minimal) driving card corner radius, fill density, and heading color on top of a template's own brand colors. One shared layout engine, not six bespoke layouts. |
| `public/fonts/Inter-{Regular,SemiBold,Bold}.ttf` | Bundled Inter weights (Google Fonts, OFL license) embedded into every generated PDF. |
| `scripts/verify-corporate-document-engine.mjs` | Static verification script (34 checks) for the new branding/versioning/lifecycle/catalog surface. |
| `docs/reports/corporate_document_engine_*.md` | This report + verification/manual-test/known-limitations reports. |

## Files Changed

| File | Change |
|---|---|
| `src/types/peopleLetters.ts` | Added `TemplateTheme`, `TemplateBrandColors`, `TEMPLATE_FONTS`; extended `PeopleLetterTemplate` with branding (hero banner, watermark, QR, seal, brand colors, theme, font, `companyPhone`, `hrManagerEmail`) and versioning/lifecycle fields (`templateGroupId`, `version`, `isLatest`, `versionNote`, `isDefault`, `isArchived`, `deletedAt`); extended `PeopleGeneratedLetter` with `templateVersion`, `isDisabled`, `isArchived`, `deletedAt`; extended `PeopleLetterAuditAction` with 12 new template/document lifecycle actions; added `letterVerificationUrl()`. |
| `src/firebase/peopleLetters.ts` | Added multi-template CRUD + versioning (`getAllTemplates`, `getTemplateVersionHistory`, `createTemplate`, `saveNewTemplateVersion`, `cloneTemplate`, `setTemplateActive`, `archiveTemplate`/`unarchiveTemplate`, `softDeleteTemplate`/`restoreTemplate`, `setDefaultTemplate`, `getArchivedOrDeletedTemplates`), a `normalizeTemplate()` backward-compatibility layer, and generated-document lifecycle functions (`regenerateLetterPdf`, `setLetterDisabled`, `setLetterArchived`, `softDeleteGeneratedLetter`, `restoreGeneratedLetter`, `getAuditLogsForResource`). `getDefaultLetterTemplate()` now resolves against the full multi-template set; `upsertDefaultLetterTemplate()` (the PEOPLE-002 single-doc path) is untouched and still works. |
| `src/utils/letterPdf.ts` | Fully rewritten premium layout (see below). All existing exports kept (`buildOfferLetterPdf`, `buildJoiningLetterPdf`, `buildLetterPdf`, `downloadLetterPdf`, `letterFileName`, `letterStoragePath`) — now `async` since fonts/images/QR are fetched before rendering. |
| `src/pages/people/documents/Templates.tsx` | Rewritten: a template list (theme/version/default/active badges, Clone/Edit/Enable-Disable/Archive/Delete/Set-Default/History/Preview actions) plus a full editor covering every new branding/theme/watermark/QR/seal field, and an "Archived & Deleted" panel with Restore/Unarchive. |
| `src/pages/people/documents/GeneratedLetters.tsx` | Added search (candidate/document ID), status filter, "show archived/deleted" toggle, and Preview / Regenerate / Disable / Archive / Soft-delete / Restore / Audit-trail actions per row. |
| `src/pages/people/documents/DocumentsHome.tsx` | Added a "Document Catalog" section rendering `DOCUMENT_CATALOG` — implemented types shown as green pills, the 13 future types as muted "Coming soon" pills, grouped by category. |
| `src/pages/people/documents/OfferLetter.tsx`, `JoiningLetter.tsx` | Pass `templateVersion` through to `createDraftLetter`; `await` the now-async `downloadLetterPdf`. No structural changes — both still call `getDefaultLetterTemplate()` as before. |
| `src/data/peopleLettersSeed.ts` | Seed generated letter updated with the new required lifecycle fields (`templateVersion`, `isDisabled`, `isArchived`, `deletedAt`). |
| `package.json` | Added `qrcode` (dependency) and `@types/qrcode` (devDependency). |

**Nothing existing was moved, renamed, or removed.** The Draft → Submitted → Approved → PDF Generated → Sent/Downloaded → Accepted workflow, all 5 routes, the sidebar entry, `firestore.rules` guards, and every PEOPLE-002 collection are unchanged — see the Verification Report's regression re-run of `verify-people-letter-generator.mjs` (still 51/51).

## Template Versioning & Lifecycle

A "template" as HR sees it is a `templateGroupId`. Saving an edit to an existing template writes a **new** Firestore document sharing that group id, with an incremented `version` (`1.0` → `1.1` → ...) and `isLatest: true`; the previous latest document for that group flips to `isLatest: false`. The template list shows one row per group (its latest version); "History" opens every version for that group. Clone creates a brand-new group (new `templateGroupId`, version `1.0`) from a copy of the source template's current content. Archive/Soft-delete/Restore/Set-Default all operate per-group and are fully reversible except hard delete (which was never exposed in the UI, exactly as in PEOPLE-002).

**Backward compatibility:** the legacy PEOPLE-002 single doc at `peopleLetterTemplates/default` (no branding/versioning fields at all) is left completely untouched. `normalizeTemplate()` fills in sane defaults for any missing field whenever a template doc is read, so that doc keeps working forever, transparently read as v1.0 of the "default" group — no migration script, no data loss risk.

## Premium PDF Engine

Every generated PDF now renders:
- A **hero banner** (constrained to ~12–15% of page height, never full-bleed) using the template's configured image URL.
- **Inter typography**, embedded as real PDF fonts (Regular/SemiBold/Bold) via jsPDF's virtual filesystem — not jsPDF's built-in Helvetica.
- A **Candidate Information card** (rounded, tinted, colored accent bar) instead of a paragraph.
- **Internship Objectives** and **Engineering Values** as 2-column "chip" cards (colored dot + label — see Known Limitations for why these aren't literal icon glyphs).
- **Key Terms** (Certificate Eligibility, Confidentiality, Code of Conduct, Termination, Acceptance) each as its own rounded clause card.
- A **signature block** with optional signature image and company seal image.
- A **footer** with company/website/email/phone, Document ID, template version, a `CONFIDENTIAL` classification, and the **verification QR code** in the corner.
- An optional **diagonal watermark** (`CONFIDENTIAL` / `DRAFT` / etc.) rendered at low opacity via jsPDF's `GState`.
- **6 theme presets** (classic/corporate/premium/aerospace/defence/minimal) that vary card corner radius, fill density, and which brand color drives section headings — layered on top of the template's own configurable brand colors, not six independent layouts.

## Document Catalog

`src/types/documentCatalog.ts` models all 15 document kinds from the brief beyond Offer/Joining Letter (Employment Offer/Joining, Internship/Project Completion Certificate, Experience Letter, Relieving Letter, Promotion Letter, Salary Revision Letter, Appreciation Letter, NDA, Confidentiality Agreement, IP Agreement, Policy Acknowledgement) as a flat, category-grouped catalog with an `implemented` flag. It's rendered on the Documents home page as a visible roadmap — this satisfies "architecture ready" honestly, without pretending workflows exist that weren't built, and without touching the tightly-typed `LetterType` union that the real Offer/Joining workflow depends on.

## Build Validation

```text
npx tsc --noEmit                                       → 0 errors
npm run build                                          → succeeds (pre-existing >500kB chunk-size warning, unrelated to this change)
node scripts/verify-people-letter-generator.mjs        → 51 passed, 0 failed (PEOPLE-002 regression, unchanged)
node scripts/verify-corporate-document-engine.mjs      → 34 passed, 0 failed
```
