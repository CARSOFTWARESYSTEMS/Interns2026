# People Operations Foundation — Implementation Report

**Story:** PEOPLE-001
**Scope:** MVP foundation for the People Operations module inside the existing EV.ENGINEER / FAI.EV.ENGINEER Engineering Command Center.
**Date:** 2026-07-06

## Summary

Added a new **People Operations** vertical (interns, employees, contractors) alongside the existing Platform Administration and Engineering Operations areas, without moving or altering existing Admin, FAI/Reports, Battery Intelligence, or Engineering functionality. The module is deterministic and JSON-first: no AI provider (OpenAI, Claude API, Gemini API, or otherwise) was integrated anywhere in this story.

## Files Created

| File | Purpose |
|---|---|
| `src/types/people.ts` | Core People Operations data model — 13 document interfaces, employment/lifecycle enums, A.S.K.I. score model, recruitment pipeline stages, leave types, policy types, culture values |
| `src/firebase/people.ts` | Firestore-ready service foundation — CRUD + workflow functions for all 13 collections, `peopleAuditLogs` writer |
| `src/data/peopleSeed.ts` | Deterministic sample/seed data (interns, employees, contractors) used as a display fallback when Firestore has no documents yet |
| `src/pages/people/PeopleDashboard.tsx` | People Dashboard — 12 summary cards (open roles, candidates, interviews, offers, onboarding, active interns/employees/contractors, leave, reviews due, policy ack, culture signals) |
| `src/pages/people/Recruitment.tsx` | Job opening creation + list |
| `src/pages/people/Candidates.tsx` | Candidate pipeline with stage transitions and A.S.K.I. scoring display |
| `src/pages/people/Interviews.tsx` | Interview scheduling + outcome tracking |
| `src/pages/people/Offers.tsx` | Offer creation + status workflow |
| `src/pages/people/Onboarding.tsx` | Onboarding checklist per new hire with progress bar |
| `src/pages/people/Profiles.tsx` | People list/detail (filterable by employment type; self-scoped for Developer/Architect/QA Engineer roles) |
| `src/pages/people/Reviews.tsx` | Monthly 1:1 review form + history |
| `src/pages/people/Leave.tsx` | Leave request + approval workflow |
| `src/pages/people/Policies.tsx` | Policy publishing + acknowledgement counts |
| `src/pages/people/Culture.tsx` | Culture signal logging against the 8 culture values |
| `scripts/verify-people-operations-foundation.mjs` | Static verification script (42 checks) |
| `docs/reports/*.md` | This report + verification/manual-test/known-limitations reports |

## Files Changed

| File | Change |
|---|---|
| `src/types/auth.ts` | Added `'HR Manager'` to `UserRole`; added `PEOPLE_ROLE_ACCESS` role→access-level mapping; extended `_ROLE_PERMISSIONS`; added People-route handling to `canAccessRoute` |
| `src/components/layout/Sidebar.tsx` | Added **PEOPLE OPERATIONS** nav section (11 links); self-service subset (Profile/Reviews/Leave) shown to Developer role |
| `src/components/ui/PermissionBadge.tsx` | Added color mapping for the new `HR Manager` role |
| `src/pages/admin/Users.tsx` | Added `HR Manager` to the assignable roles list |
| `src/pages/admin/Invitations.tsx` | Added `HR Manager` to the invitation role list |
| `src/App.tsx` | Added 11 People Operations routes under the existing authenticated `Layout` route tree |
| `firestore.rules` | Added `isHRManager()`, `canManagePeopleOps()`, `isOwnPeopleRecord()` helpers and match blocks for all 13 People collections |

**Nothing existing was moved, renamed, or removed.** Admin routes (`/admin/*`), Reports (`/reports`), Simulators, Stories, Assignments, Evidence, and Developers routes are untouched.

## Routes Added

```
/people             People Dashboard        (all authenticated roles; self-scoped data)
/people/recruitment Recruitment             (Platform Admin, Engineering Manager, HR Manager)
/people/candidates  Candidates              (Platform Admin, Engineering Manager, HR Manager)
/people/interviews  Interviews              (Platform Admin, Engineering Manager, HR Manager)
/people/offers      Offers                  (Platform Admin, Engineering Manager, HR Manager)
/people/onboarding  Onboarding              (Platform Admin, Engineering Manager, HR Manager)
/people/profiles    People                  (all authenticated roles; self-scoped for Developer/Architect/QA Engineer)
/people/reviews     1:1 Reviews             (all authenticated roles; self-scoped for Developer/Architect/QA Engineer)
/people/leave       Leave                   (all authenticated roles; self-scoped for Developer/Architect/QA Engineer)
/people/policies    Policies                (Platform Admin, Engineering Manager, HR Manager)
/people/culture     Culture                 (all authenticated roles; write access broad, per MVP scope)
```

## Sidebar Changes

New **PEOPLE OPERATIONS** section added between Engineering and Notifications. Platform Admin / Engineering Manager / HR Manager / Architect / QA Engineer / Viewer see all 11 links. Developer role sees a filtered subset (People, 1:1 Reviews, Leave) consistent with the existing "My Work" pattern already used for the Engineering section.

## Data Models Added

13 Firestore-ready collections, every document carrying the required envelope (`partnerId`, `organisationId`, `createdAt`, `updatedAt`, `createdBy`, `status`):

`peopleProfiles`, `peopleJobOpenings`, `peopleCandidates`, `peopleApplications`, `peopleInterviews`, `peopleOffers`, `peopleOnboarding`, `peopleOneOnOneReviews`, `peopleLeaveRequests`, `peoplePolicies`, `peoplePolicyAcknowledgements`, `peopleCultureSignals`, `peopleAuditLogs`.

`PeopleProfile` supports `employmentType: intern | employee | contractor` and the full `personStatus` lifecycle (`candidate → onboarding → active → inactive/on_notice/exited/blocked`).

The A.S.K.I. model (`AskiScore`) is a shared type used by both `PeopleCandidate` and `PeopleInterview`, with `integrity` always present and surfaced distinctly in the Candidates UI (mandatory for hiring decisions per spec).

## Services Added

`src/firebase/people.ts` exports create/read/update functions for every collection, plus workflow helpers (`updateCandidateStage`, `updateOfferStatus`, `updateLeaveStatus`, `updateOnboardingTask`, `acknowledgePolicy`) that also write to `peopleAuditLogs`.

## Role / Security Foundation

Added `'HR Manager'` as a new `UserRole` (existing roles untouched) and a `PEOPLE_ROLE_ACCESS` mapping:

- **Platform Admin** → `full`
- **Engineering Manager** → `team` (maps to spec's "Manager")
- **HR Manager** → `people_ops`
- **Architect / QA Engineer / Developer** → `self`
- **Viewer** → `read_only`

`firestore.rules` enforces this at the data layer for all 13 collections (recruitment/onboarding/policy writes restricted to `full`/`team`/`people_ops`; profile/leave/review reads restricted to the owning user or a manager-level role).

## Build Validation

```
npx tsc --noEmit                                    → 0 errors
npm run build                                        → succeeds (see known limitations for bundle-size note)
node scripts/verify-people-operations-foundation.mjs → 42 passed, 0 failed, "Verification PASS"
```
