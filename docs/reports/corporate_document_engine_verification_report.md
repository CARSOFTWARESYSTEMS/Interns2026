# Premium Corporate Document Engine — Verification Report

**Story:** PEOPLE-003
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
✓ 2049 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                              2.32 kB │ gzip:   0.77 kB
dist/assets/index-BWqfyDE3.css              49.34 kB │ gzip:   8.20 kB
dist/assets/purify.es-Csrj9YNg.js           28.14 kB │ gzip:  10.69 kB
dist/assets/index.es-BlRIkd9n.js           150.69 kB │ gzip:  51.55 kB
dist/assets/html2canvas.esm-CBrSDip1.js    201.42 kB │ gzip:  48.03 kB
dist/assets/index-DAN15krT.js            2,004.53 kB │ gzip: 522.34 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 3.29s
```

The chunk-size warning pre-dates this change (present in the PEOPLE-002 verification report too) and grew slightly due to the bundled `qrcode` dependency — not a regression introduced by broken code, just an existing code-splitting opportunity out of scope for this story.

### `node scripts/verify-corporate-document-engine.mjs` (new, PEOPLE-003)

```
Premium Corporate Document Engine (PEOPLE-003) — Verification

Type Models
  PASS  TemplateTheme + 6 theme presets modelled
  PASS  TemplateBrandColors carries the 6 spec brand colors
  PASS  Template models hero banner, watermark, QR, and company seal toggles
  PASS  Template versioning fields modelled (templateGroupId/version/isLatest/versionNote)
  PASS  Template lifecycle fields modelled (isDefault/isArchived/deletedAt)
  PASS  Generated letter carries templateVersion + lifecycle fields
  PASS  Future verification URL helper exists (ev.engineer/verify/<documentId>)
  PASS  New template/document audit actions modelled

Document Catalog
  PASS  src/types/documentCatalog.ts exists
  PASS  Catalog models exactly 15 document kinds
  PASS  Exactly 2 catalog entries are implemented (Offer + Joining)
  PASS  LetterType union stays offer|joining (broader catalog kept separate, no regression risk)

Service Layer — Templates
  PASS  Multi-template CRUD + versioning functions exist
  PASS  Template lifecycle functions exist (archive/restore/soft-delete/default)
  PASS  Legacy single-doc template path preserved for backward compatibility
  PASS  Template normalization fills defaults for pre-PEOPLE-003 docs (no data loss)

Service Layer — Generated Documents
  PASS  Generated-document lifecycle functions exist
  PASS  Per-resource audit trail lookup exists

Premium PDF Engine
  PASS  src/utils/pdf/ helper modules exist
  PASS  PDF builders remain async (fonts/images/QR are fetched before rendering)
  PASS  Hero banner rendering is constrained to ~12-15% of page height, not full-bleed
  PASS  Premium fonts registered via jsPDF VFS (not just Helvetica)
  PASS  Bundled Inter TTF files exist under public/fonts/
  PASS  qrcode dependency declared and used for verification QR codes
  PASS  Watermark uses jsPDF GState opacity (not solid overlay)
  PASS  Candidate Information rendered as a card, not a paragraph
  PASS  Theme presets drive card styling on top of template brand colors

Template Management UI
  PASS  Templates page supports create/edit/clone/archive/restore/preview/version-history
  PASS  Preview PDF opens a blob URL rather than downloading/persisting

Generated Documents UI
  PASS  Generated Documents page supports search + status filter
  PASS  Generated Documents page supports preview/regenerate/disable/archive/delete/restore/audit

No PDF Binary In Firestore
  PASS  Firestore service never writes a PDF blob/base64/ArrayBuffer field

No Paid AI
  PASS  No paid-AI SDK dependency introduced
  PASS  No AI provider imports in the new PDF engine / template files

──────────────────────────────────────────────────
34 passed, 0 failed

Verification PASS
```

### `node scripts/verify-people-letter-generator.mjs` (PEOPLE-002 regression re-run)

```
──────────────────────────────────────────────────
51 passed, 0 failed

Verification PASS
```

All 51 PEOPLE-002 checks — sidebar, routes, RoleGuard scoping, type models, service layer, joining-letter gating, PDF generation, "no PDF binary in Firestore," access control, seed data, no-paid-AI, and every "existing features preserved" check (Reports/FAI, Battery Intelligence, People Operations foundation routes, Admin routes, Simulators/Stories/Assignments) — still pass unmodified after the PEOPLE-003 rewrite.

No new Firestore collections were introduced (templates and generated letters still live in `peopleLetterTemplates` / `peopleGeneratedLetters`), so `firestore.rules` and `scripts/test-people-letter-rules.mjs` (the live Rules Emulator suite) did not need changes and were not re-run here — they check collection-level access, which is unaffected by the new document-shape fields.

## Runtime Smoke Test (headless browser)

Static checks confirm the code is *wired correctly*; they can't confirm the PDF engine actually *runs* in a browser (font fetch, remote image fetch, QR generation, jsPDF rendering are all runtime behavior). A headless-Chromium smoke test was run against the dev server — see the Manual Test Report for the full methodology and results. Summary: the premium PDF engine was exercised directly (bypassing Firestore/auth) for both offer and joining letters, confirmed the Inter font registered into jsPDF's font list, confirmed the hero banner image (real `ev.engineer` URL) fetched and embedded successfully, and confirmed broken image URLs are skipped gracefully rather than crashing generation.
