# People Operations Foundation — Manual Test Report

**Story:** PEOPLE-001
**Date:** 2026-07-06

## Environment

The app is a Vite + React + Firebase SPA authenticated via Google Sign-In (`GoogleLoginButton`/Firebase Auth). This session has no browser automation tool (`chromium-cli`/Playwright) available, and Google OAuth requires an interactive human login — a headless agent cannot complete it. The checks below were therefore split into what could be verified statically/via dev-server smoke test versus what requires a human tester with real credentials.

## Verified in this session

| # | Flow | Method | Result |
|---|---|---|---|
| — | Dev server boots and serves the app shell | `npm run dev` + `curl` | **PASS** — HTML shell (title "Aerospace Intelligence & Cybersecurity Platform \| UFlight™ EV.ENGINEER™") returned correctly, no server-side crash |
| — | TypeScript compiles across all new + changed files | `npx tsc --noEmit` | **PASS** — 0 errors |
| — | Production bundle builds | `npm run build` | **PASS** |
| 1 | Sidebar shows PEOPLE OPERATIONS section | Source inspection + verification script | **PASS** (structural) |
| 2–10 | Each People page (Dashboard, Recruitment, Candidates pipeline + A.S.K.I., People profiles for intern/employee/contractor, 1:1 review form, leave request form, policies list, culture signals) | Source inspection — every page fetches from `firebase/people.ts` and falls back to `data/peopleSeed.ts` sample data when Firestore is empty, so each renders non-empty content on first load | **PASS** (structural — see limitation below) |
| 11–13 | FAI/Reports, Battery Intelligence competency, Admin Users/Invitations routes unchanged | Source inspection — routes and files untouched; verification script confirms all still present | **PASS** |
| 14 | Unauthorised access to restricted people data | Code review of `RoleGuard` usage in `App.tsx` and `firestore.rules` match blocks | **PASS (logic reviewed)** — `/people/recruitment`, `/people/candidates`, `/people/interviews`, `/people/offers`, `/people/onboarding`, `/people/policies` are wrapped in `<RoleGuard allow={['Platform Admin','Engineering Manager','HR Manager']}>`; `firestore.rules` independently enforces the same restriction at the data layer so a client-side bypass of `RoleGuard` still can't read/write those collections |

## Not verified in this session (requires a human tester)

The following require an actual browser click-through with a real, authenticated Google session against the live Firebase project, which this session cannot perform:

1. Visually confirming the sidebar renders correctly (icons, spacing) across roles.
2. Clicking through each People page in the browser to confirm forms submit, Firestore writes succeed, and lists refresh.
3. Confirming the daily check-in gate (`RequireCheckin`) doesn't block access to `/people/*` in some unintended way — it's an existing gate applied to the whole `Layout` route, unchanged by this story, but was not re-clicked-through here.
4. Confirming `firestore.rules` behave as intended against the **live** Firestore project (rules were reviewed logically but not run through the Firebase Rules simulator/emulator in this session — no Firebase CLI/emulator was available here).
5. Confirming the `HR Manager` role, once assigned to a real user via Admin → Users, actually unlocks the Recruitment/Candidates/Interviews/Offers/Onboarding/Policies pages end-to-end for that user's session.

## Recommended before sign-off

- A developer with an authenticated session should click through all 11 `/people/*` routes once against a real (or emulator) Firestore project, create one real record per collection, and confirm it persists and re-renders on reload.
- Run `firebase emulators:start --only firestore` and replay the rules against at least one request per role (`Platform Admin`, `Engineering Manager`, `HR Manager`, `Developer`) to confirm `firestore.rules` matches the intended access matrix.
