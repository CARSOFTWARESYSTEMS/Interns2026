# People Operations Foundation — Known Limitations Report

**Story:** PEOPLE-001
**Date:** 2026-07-06

This is an MVP foundation. The following are known, intentional simplifications or gaps — not defects — scoped out to keep this story deterministic, JSON-first, and AI-free per the brief.

## Scope limitations (by design)

- **No AI anywhere.** A.S.K.I. scoring, candidate stage recommendations, and culture-signal categorisation are entered manually. No OpenAI/Claude/Gemini integration exists, and none should be added without a separate, explicitly-scoped story.
- **No payroll / salary storage.** Offers capture role, department, and start date only — no compensation fields exist anywhere in `types/people.ts`, by design.
- **Culture page write access is broad.** Per the spec's MVP scope, `/people/culture` is reachable and writable by any authenticated role rather than being restricted to Manager/HR Manager/Admin like Recruitment/Candidates/Interviews/Offers/Onboarding/Policies. Tightening this (e.g. to managers only) is a one-line `RoleGuard` change if the next sprint wants it.
- **Onboarding/Reviews/Leave "self-scope" is best-effort.** Self-scoping matches a `PeopleProfile` to the signed-in user by `email`, since most seed/sample profiles don't yet have a linked platform `uid`. Once profiles are created through the real Recruitment→Offer→Onboarding flow (which does capture `uid` via the invited user's account), matching becomes exact.
- **No email notifications.** Offer sent, interview scheduled, leave approved, etc. do not trigger any email — consistent with the rest of the platform (see the existing Invitations page's own "Email Integration — Phase E Roadmap" note).

## Data model simplifications

- **`peopleApplications` vs `peopleCandidates`.** Both exist per spec, but the UI currently drives everything off `peopleCandidates` (which embeds `stage` and `appliedForOpeningId` directly). `peopleApplications` is Firestore-ready (types + service functions exist) but has no dedicated UI yet — a candidate can apply to multiple openings in the data model, but the current pages assume one active application per candidate.
- **A.S.K.I. is entered manually** on Candidates/Interviews, with no aggregation across multiple interviewers yet (e.g. no "average across all interviews" rollup on the candidate record itself).
- **`peopleAuditLogs` has no dedicated viewer page.** The service (`getPeopleAuditLogs`) and writes exist and are exercised by every mutation, but there's no `/people/audit` route in this MVP — add one if audit visibility becomes a near-term need.

## Access control

- **`HR Manager` is a new role**, added without a migration path for existing users — an existing user must be manually promoted via Admin → Users. No existing role's permissions were changed.
- **Route-level guards (`RoleGuard`) and `firestore.rules` were authored together** but only the rules have not been run against the Firebase Rules emulator in this session (no Firebase CLI/emulator available here — see Manual Test Report). Recommend running the emulator suite before this reaches a shared/staging Firestore project.

## Build / performance

- **Single JS chunk (~1.5 MB minified).** `vite build` warns about chunk size; this is a pre-existing condition of the app (no code-splitting anywhere in the router), not something this story introduced or worsened meaningfully — People Operations added ~11 small pages to an already-unsplit bundle. Recommend addressing with route-level `React.lazy()` in a dedicated perf story, not as part of this foundation.

## Testing gap

- No automated UI/E2E test (Playwright/Cypress) was added — the existing codebase has no test suite to extend, and adding one was out of scope for this foundation story. See the Manual Test Report for exactly what still needs a human click-through pass.

## Next recommended sprint

1. Wire `/people/candidates` and `/people/offers` UI to also create/update `peopleApplications` records so the one-candidate-many-openings data model is actually exercised.
2. Add a dedicated Onboarding→Profile handoff: when onboarding completes, auto-create/promote the linked `PeopleProfile` from `personStatus: 'onboarding'` to `'active'` and set `uid` once the invited user completes their first login (mirrors the existing `AuthContext.loadProfile` first-login pattern).
3. Run the Firebase Rules emulator against the new `firestore.rules` blocks for all 7 roles before deploying to any shared project.
4. Add a lightweight `/people/audit` viewer for `peopleAuditLogs` (Platform Admin / HR Manager only).
5. Decide whether `/people/culture` write access should be narrowed to Manager/HR Manager/Admin, or intentionally stay open to all roles as a peer-recognition channel.
