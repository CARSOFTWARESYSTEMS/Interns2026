# Internship Offer & Joining Letter PDF Generator — Known Limitations Report

**Story:** PEOPLE-002
**Date:** 2026-07-07

## Post-review fix

During a live click-through against a real Firebase project, `/people/documents/offer-letter` got stuck on "Loading…" with a console error: `FirebaseError: The query requires an index`. `getLettersByType` and `getApprovalsForLetter` in `src/firebase/peopleLetters.ts` combined a `where(...)` equality filter with `orderBy('createdAt', 'desc')` on a different field — Firestore requires a composite index for that combination, and none exists in this project. Rather than sending HR to the Firebase Console to create one (extra deploy step, and the index build can take minutes), both queries were changed to drop the `orderBy` and sort the results client-side in JS after fetching. This needs no index at all and is safe at this collection's expected size (per-candidate letter counts, not a high-volume table). Re-verified with `tsc --noEmit` (0 errors) and the static verify script (51/51) after the fix.

These are known, intentional simplifications or gaps — not defects — scoped out to keep this story deterministic, AI-free, and shippable on top of the existing PEOPLE-001 foundation.

## PDF storage

- **No PDF binary is persisted anywhere — not Firestore (disallowed by spec) and, in this iteration, not an external object store either.** Every generate/download/re-download action rebuilds the PDF client-side from the letter's Firestore metadata + the current template. `pdfStoragePath` on `PeopleGeneratedLetter` is a descriptive, deterministic string (`people-letters/<type>/<documentId>.pdf`) recorded for traceability, not a pointer to an actual stored file, and `pdfUrl` is currently always empty.
- **Practical effect:** if the template is edited *after* a letter reaches `PDF Generated`, re-downloading that letter will reflect the *current* template, not the template as it was at generation time. This is a real (if narrow) correctness gap for audit purposes.
- **Recommended fix (next sprint):** upload the generated `Blob` to Firebase Storage (the project's `storageBucket` is already configured in `.env.local`, just unused) at `pdfStoragePath`, store the resulting `pdfUrl`, and either snapshot the template fields onto the letter at generation time or make templates versioned/immutable once referenced by a generated letter.

## Templates

- **Single reusable template, not multiple named templates.** The brief says "create reusable templates" (plural); this implementation ships one singleton template (`peopleLetterTemplates/default`) shared by both offer and joining letters, since the field list in the brief is singular/org-wide (one company, one set of clauses). If different business units/domains eventually need distinct templates, `PeopleLetterTemplate` already has a `templateName`/`isActive` shape that a "manage multiple templates" UI could be layered onto without a data-model change.

## Access control

- **No "Owner" role exists on this platform.** `src/types/auth.ts`'s `UserRole` union has no `Owner` — "Super Admin" already maps onto `Platform Admin` via an email allowlist (`SUPER_ADMIN_EMAILS`). Rather than invent a role the rest of the app doesn't recognise, Documents access was implemented strictly as `['Platform Admin', 'HR Manager']`, satisfying "Super Admin, HR Manager" from the spec and omitting the optional "Owner read/approval visibility" bullet. If a distinct Owner persona is introduced platform-wide, extending the `RoleGuard allow` lists on the 5 Documents routes (and `canManageLetters()` in `firestore.rules` if Owner needs read access to the underlying data) is a small, contained change.
- **No segregation-of-duties enforcement.** Any user in `['Platform Admin', 'HR Manager']` can both draft and approve the same letter — the workflow doesn't prevent a single HR Manager from self-approving. Not specified in the brief; flagged here since some compliance programs require a different approver than drafter.

## Document numbering

- **No existing sequential-ID pattern to build on.** There was no counter/invoice-number precedent anywhere in this codebase (confirmed via repo-wide search) before this story, so `peopleLetterCounters` + a Firestore transaction is a new pattern. It has not been load-tested for concurrent drafts in the same second; Firestore transactions guarantee correctness (no duplicate IDs) but under very high concurrency, retries could add latency. Not a concern at internship-program volume.

## Testing

- **Firestore Rules emulator: now covered.** Unlike PEOPLE-001, this story does include a live Firestore Rules Emulator suite (`scripts/test-people-letter-rules.mjs`, using `@firebase/rules-unit-testing`) that exercises all 5 new collections against all 7 platform roles plus unauthenticated access, plus immutability and a `peopleOffers` regression check — 79/79 passed. See the Verification Report for the full transcript. Running it requires a local JDK 21+ (this machine's default `openjdk@17` on `PATH` is too old for current `firebase-tools`; `JAVA_HOME` must point at a newer JDK, e.g. the machine's separately-installed JDK 23) and downloads the Firestore emulator jar on first run.
- **No authenticated browser click-through.** See the Manual Test Report — PDF generation itself was verified directly (real binaries, correct content via `pdftotext`), rules were verified live against the emulator, and all wiring was verified statically, but the full Draft→Approve→Generate→Send→Accept flow was not driven through a real Google-login session in a browser in this environment.
- **No automated E2E test suite** exists in this repo to extend (consistent with PEOPLE-001's own limitation) — the rules emulator suite added here tests the data layer, not the UI.

## Build / performance

- **Bundle grew from ~1.5 MB to ~1.95 MB minified** (plus two additional lazy chunks: `html2canvas.esm` ~201 KB and `purify.es` ~28 KB, pulled in transitively by `jsPDF`'s optional HTML-rendering feature, which this integration does not use). The existing single-chunk warning predates this story; `jsPDF` made it larger. Recommend addressing with route-level `React.lazy()` for the Documents pages (and ideally the whole router) in a dedicated performance story, rather than deferred further here.

## Next recommended sprint

1. Wire actual Firebase Storage upload for generated PDFs (`storageBucket` is already configured) and snapshot template fields onto the letter at generation time, so re-downloads are historically accurate.
2. Decide on and implement an "Owner" role platform-wide if genuinely needed, or confirm Super Admin + HR Manager is sufficient and drop that bullet from future specs.
3. Add segregation-of-duties (drafter ≠ approver) if this becomes a compliance requirement.
4. Wire `scripts/test-people-letter-rules.mjs` into CI (it needs a JDK 21+ runner and Firestore emulator, which most CI images don't have by default — add a setup step).
5. Add `React.lazy()` code-splitting for the 5 new Documents pages to offset the bundle-size growth from `jsPDF`.
6. If multiple distinct templates (e.g. per business unit) become a real need, extend `Templates.tsx` from a single-record editor into a list + editor using the `templateName`/`isActive` fields already present on `PeopleLetterTemplate`.
7. Drive the full Draft→Approve→Generate→Send→Accept flow through a real authenticated browser session (Platform Admin and HR Manager accounts) as a one-time manual QA pass before this reaches production.
