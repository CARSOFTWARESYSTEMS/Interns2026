# Multi-domain sign-in

One Intern2026 identity, signed in through four branded login hosts, used by
the application sites each login host serves. No cookie is shared between
sites: every application host holds its own session, and the login host holds
a central session that lets a second site sign in without asking again.

| Login host | Signs in to | Roles from Partner |
|---|---|---|
| `login.itelematics.com` | `itelematics.com`, `www.itelematics.com` | `itelematics` |
| `login.autonomous.ev.engineer` | `ev.engineer`, `www.ev.engineer`, `autonomous.ev.engineer`, `aerospace.ev.engineer` | `ev-engineer` |
| `login.gamyaa.in` | `gamyaa.in`, `www.gamyaa.in`, `aerospace.gamyaa.in`, `aerosystems.gamyaa.in` | `gamyaa` |
| `login.uflight.in` | `uflight.in`, `www.uflight.in` | `uflight` |

The table lives in one place: [`src/auth/providers.ts`](../../src/auth/providers.ts).
Add or remove a host there and nowhere else.

## How a sign-in works

```
aerospace.ev.engineer                login.autonomous.ev.engineer
─────────────────────                ────────────────────────────
1 GET /api/auth/login?return=/aerospace/uflight-3d
  • check the return path stays on this host
  • nonce + PKCE verifier → HttpOnly txn cookie
  • signed state {host, path, nonce, time, challenge}
  ─────────── 302 ───────────────▶ 2 GET /api/auth/authorize?state=…
                                     • verify state signature + age
                                     • host allowed for this login host?
                                     • central session? ── no ──▶ /sso (branded
                                       │                         Google sign-in →
                                       │                         POST /api/auth/session
                                       │                         → central session) → 2
                                       yes
                                     • one-time code (60 s, this host only,
                                       bound to nonce + PKCE challenge)
3 GET /api/auth/callback?code&state ◀── 302 ─────
  • state matches this browser's txn cookie
  • redeem code atomically (PKCE verifier)
  • new session → HttpOnly cookie on this host
  ─── 302 ──▶ https://aerospace.ev.engineer/aerospace/uflight-3d
```

If the user already has a central session on the login host (they signed in to
another site of the same provider, or to the dashboard), step 2 issues the code
immediately: the round trip is invisible.

All of this runs in one Vercel Function, [`api/auth.ts`](../../api/auth.ts) →
[`server/auth/handler.ts`](../../server/auth/handler.ts), deployed with this
project to the login hosts. Application sites reach it through a rewrite (below),
so their cookies stay on their own host and their sessions stay server-side.

## Endpoints

On an application host (after the rewrite below):

| | |
|---|---|
| `GET /api/auth/login?return=<path>` | Start sign-in. `return` is a path on the same host (path, query, hash); anything else is refused. |
| `GET /api/auth/callback` | Used by the flow only. |
| `GET /api/auth/session` | `{ "authenticated": false }` or `{ "authenticated": true, "user": { "id", "name", "email" }, "roles": [...], "domain": "<host>" }` |
| `POST /api/auth/logout` | Ends this site's session. JSON for `fetch`; a form post is redirected to `?return=<path>` (or `/`). |

On a login host: `GET /api/auth/authorize`, `POST /api/auth/session` (Firebase ID
token → central session; same-origin only), `GET /api/auth/session` (central
session status), `POST /api/auth/logout` (ends single sign-on for that provider).

`roles` are read live from Intern2026 on every call — `Platform Admin` plus the
user's role in the provider's Partner when that membership is Active — so
suspending a member takes effect at once. An empty list means signed in, no
access: **a site must check `roles`, not just `authenticated`, before showing
anything restricted.**

## Connecting an application site

Each site's Vercel project needs one rewrite per host, pointing at its login
host, with the site's own hostname in the path:

```json
{
  "rewrites": [
    {
      "source": "/api/auth/:action(login|callback|session|logout)",
      "has": [{ "type": "host", "value": "aerospace.ev.engineer" }],
      "destination": "https://login.autonomous.ev.engineer/api/auth/app/aerospace.ev.engineer/:action"
    },
    {
      "source": "/api/auth/:action(login|callback|session|logout)",
      "has": [{ "type": "host", "value": "aerospace.gamyaa.in" }],
      "destination": "https://login.gamyaa.in/api/auth/app/aerospace.gamyaa.in/:action"
    }
  ]
}
```

That example is the project that serves `autonomous.ev.engineer`,
`aerospace.ev.engineer` and `aerospace.gamyaa.in` (one Vercel deployment as of
2026-10-25): it needs a rule for each of those hosts, and the two `aerospace.`
hosts go to **different** login hosts. Put these rules before any catch-all
rewrite. Hosts that only redirect to `www.` (e.g. `ev.engineer`, `gamyaa.in`,
`uflight.in`) don't need one.

Then, in the site:

```js
// Sign in and come back to this exact page
location.href = '/api/auth/login?return=' +
  encodeURIComponent(location.pathname + location.search + location.hash)

// Who is signed in?
const me = await fetch('/api/auth/session').then(r => r.json())

// Sign out
await fetch('/api/auth/logout', { method: 'POST' })
```

```html
<!-- or without JavaScript -->
<form method="post" action="/api/auth/logout?return=/"><button>Sign out</button></form>
```

A site's own server code can check a visitor by calling
`https://<login host>/api/auth/app/<site host>/session` with the visitor's
`Cookie` header.

## Deploying this project

1. **Vercel environment variables** (Production, this project). Server-only —
   never `VITE_`-prefixed:
   - `AUTH_STATE_SECRET` — 32+ random characters (`openssl rand -base64 48`).
   - `FIREBASE_SERVICE_ACCOUNT` — a service-account key for the Firebase project
     (JSON, or base64 of it). It needs Firebase Auth (verify tokens, read users)
     and Firestore read/write.
   - Optional: `AUTH_SESSION_IDLE_HOURS` (default 12), `AUTH_SESSION_MAX_HOURS` (default 168).

   Without the first two, every `/api/auth` request answers "temporarily
   unavailable" — the dashboard itself keeps working.
2. **Firestore rules**: `firebase deploy --only firestore:rules`. The change only
   makes the existing default-deny explicit for the four `auth*` collections.
3. **Firestore TTL** (cleanup of expired records), once per collection:
   ```
   gcloud firestore fields ttls update ttlAt --collection-group=authSessions   --enable-ttl --project=<project>
   gcloud firestore fields ttls update ttlAt --collection-group=authCodes      --enable-ttl --project=<project>
   gcloud firestore fields ttls update ttlAt --collection-group=authEvents     --enable-ttl --project=<project>
   gcloud firestore fields ttls update ttlAt --collection-group=authRateLimits --enable-ttl --project=<project>
   ```
   Retention: sessions 30 days after expiry, codes 1 day, audit events 400 days.
4. **Check after the deploy**:
   - `curl https://login.uflight.in/api/auth/session` → `{"authenticated":false}` (the function is routed).
   - `curl -i 'https://login.uflight.in/api/auth/app/uflight.in/login?return=%2F%2Fevil.example'`
     → `400` "We can't send you there" (the query string reaches the function).
   - After connecting a site: sign in from a deep link and confirm you land back
     on it, the session cookie is on the site's host, and `/api/auth/session`
     answers there.

## Security properties

| | |
|---|---|
| Cookies | `__Host-` prefix (host-only, no `Domain`), `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`. Never shared across hosts. |
| Session ids | 256-bit random; only their SHA-256 is stored (`authSessions/{hash}`). |
| Codes | 256-bit random, hashed at rest, 60 s, single use (Firestore transaction), bound to one host, the state nonce and a PKCE S256 challenge. A replayed code revokes the session its first use created. |
| State | HMAC-signed `{host, path, nonce, time, challenge}`, 10 min, matched against the site's HttpOnly transaction cookie. |
| Return URLs | Built from a configured host + a same-host path; full URLs, `//`, `\`, control characters, `javascript:`/`data:` are refused. |
| CSRF | State-changing POSTs require the exact `Origin`; `SameSite=Lax`. |
| Session lifetime | 12 h idle, 7 days absolute; a new id on every sign-in (rotation); revoked on logout, rotation, code replay, disabled account. |
| Central sign-in | Verifies the Firebase ID token server-side (signature, revocation, disabled account) and requires a sign-in within the last 5 minutes. |
| Rate limits | Per IP per minute: 30 sign-in starts, 30 authorizations, 10 token sign-ins. |
| Audit | `authEvents`: `login_started`, `login_success`, `login_failed`, `authorization_code_issued`, `authorization_code_exchanged`, `session_created`, `session_refreshed`, `logout`, `session_revoked` — user, Partner, host, time, result, reason, IP, user agent. No tokens, codes or cookie values. |
| Errors | Fixed friendly pages per case (`expired_login`, `invalid_return`, `invalid_state`, `expired_code`, `code_used`, `session_failed`, `unauthorized_domain`, …); no internal detail. |

Tests: [`server/auth/handler.test.ts`](../../server/auth/handler.test.ts) runs the
whole flow through a simulated browser with one cookie jar per host;
[`src/auth/*.test.ts`](../../src/auth) cover the host table and return paths;
`tests/rules/tenant.rules.test.ts` pins the Firestore rules.

## Not done yet

- **Global logout.** Signing out of the dashboard on a login host ends single
  sign-on for that provider; sessions already created on sites stay until they
  expire or the user signs out there. The store can revoke all of a user's
  sessions (`revokeUserSessions`) for a future admin action.
- **The dashboard's own Firebase sign-in** still uses Firebase's default browser
  persistence (IndexedDB), as before. The new SSO cookies, codes and sessions
  never touch browser storage. Moving the dashboard onto the central session
  (Firebase custom tokens minted from it) is possible later.
- **Role names.** Roles are the platform's existing ones (`Admin` = Partner
  Admin, `Developer`, `Viewer`, …). Names such as Domain Admin, Reviewer or
  Intern need a product decision before they are added.
- Two sign-ins started at once in two tabs of the same site: the later one wins;
  the earlier shows "couldn't be verified" and the user signs in again.
