# Multi-domain sign-in

One Intern2026 identity, signed in through four branded login hosts, used by
the application sites each login host serves. No cookie is shared between
sites: every application host holds its own session, and the login host holds
a central session that lets a second site sign in without asking again.

| Login host | Signs in to | Roles from Partner |
|---|---|---|
| `login.itelematics.com` | `itelematics.com`, `www.itelematics.com` | `itelematics` |
| `login.autonomous.ev.engineer` | `ev.engineer`, `www.ev.engineer`, `autonomous.ev.engineer`, `aerospace.ev.engineer`, `aerospace.ishavasyam.org` | `ev-engineer` |
| `login.gamyaa.in` | `gamyaa.in`, `www.gamyaa.in`, `aerospace.gamyaa.in`, `aerosystems.gamyaa.in` | `gamyaa` |
| `login.uflight.in` | `uflight.in`, `www.uflight.in`, `cybersecurity.uflight.in` | `uflight` |

The table lives in one place: [`src/auth/providers.ts`](../../src/auth/providers.ts).
Add or remove a host there and nowhere else.

## Protecting routes — required on every site

**Signing in is not access.** Any Google account can sign in. A protected
page, API or action may serve a request only when all four hold:

> **authenticated + active membership + correct domain/partner + required role/permission**

| Check | How to read it from `GET /api/auth/session` |
|---|---|
| authenticated | `authenticated === true` |
| active membership | `roles` is not empty. A Partner role is listed only while the user's membership in this site's Partner is **Active** — Pending, Suspended, Blocked or removed members get no role. `Platform Admin` is the platform-wide grant. |
| correct domain/partner | `domain` equals this site's own hostname. The session's Partner is fixed by that hostname (table above), and a session never works on another host. |
| required role/permission | `roles` contains a role this route allows, using the platform's existing role names (`Platform Admin`, `Admin`, `Engineering Manager`, `HR Manager`, `Architect`, `QA Engineer`, `Developer`, `Viewer`). |

**`authenticated: true` with `roles: []` means signed in with no access.** Any
error, non-200 response or unexpected shape also means no access.

```js
// Allowed roles are per route, e.g. ['Platform Admin', 'Admin', 'HR Manager'].
async function canOpen(allowedRoles) {
  const res = await fetch('/api/auth/session', { cache: 'no-store' })
  if (!res.ok) return false
  const s = await res.json()
  return s.authenticated === true                       // authenticated
    && Array.isArray(s.roles) && s.roles.length > 0     // active membership
    && s.domain === location.hostname                   // correct domain/partner
    && s.roles.some(r => allowedRoles.includes(r))      // required role/permission
}
```

A check in the browser only decides what to show. Anything that returns
protected data must make the same four checks on the server: a site's server
calls `https://<login host>/api/auth/app/<site host>/session` with the visitor's
`Cookie` header and applies them to the answer. Roles are read live from
Intern2026 on every call, so suspending or removing a member takes effect at once.

## How a sign-in works

```text
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
immediately and no sign-in page is shown.

All of this runs in one Vercel Function, [`api/auth.ts`](../../api/auth.ts) →
[`server/auth/handler.ts`](../../server/auth/handler.ts), deployed with this
project to the login hosts. Application sites reach it through a rewrite, so
their cookies stay on their own host and their sessions stay server-side.

## Endpoints

On an application host (after its rewrite is deployed):

| | |
|---|---|
| `GET /api/auth/login?return=<path>[&trigger=<trigger>&label=<page>]` | Start sign-in. `return` is a path on the same host (path, query, hash); anything else is refused. `trigger` and `label` say why and where the sign-in started (see [Activation records](#activation-records-and-the-users-view)); both are optional. |
| `GET /api/auth/callback` | Used by the flow only. |
| `GET /api/auth/session` | `{ "authenticated": false }` or `{ "authenticated": true, "user": { "id", "name", "email" }, "roles": [...], "domain": "<host>" }` |
| `POST /api/auth/logout` | Ends this site's session only. JSON for `fetch`; a form post is redirected to `?return=<path>` (or `/`). |

On a login host: `GET /api/auth/authorize`, `POST /api/auth/session` (Firebase ID
token → central session; same-origin only), `GET /api/auth/session` (central
session status), `POST /api/auth/logout` (ends that login host's central session).

## 1. Vercel environment variables (this project, `interns2026`)

Set in Vercel → `interns2026` → Settings → Environment Variables, environment
**Production** only (preview URLs are not login hosts). Mark the first two
**Sensitive**. Never prefix them with `VITE_`, which would compile them into the
browser bundle.

| Name | Value |
|---|---|
| `AUTH_STATE_SECRET` | A new random value: `openssl rand -base64 48` (64 characters). |
| `FIREBASE_SERVICE_ACCOUNT` | Service-account key for Firebase project `ev2027`: Firebase console → Project settings → Service accounts → *Generate new private key*. Paste the JSON as is (or `base64 -i key.json`), then delete the downloaded file. |
| `AUTH_SESSION_IDLE_HOURS` | Optional. Default `12` (allowed 1–24). |
| `AUTH_SESSION_MAX_HOURS` | Optional. Default `168` = 7 days (allowed 1–720). |

Environment variables apply to new deployments only: **redeploy production**
after adding them. Until both required values are present, every `/api/auth`
request answers `503 {"error":"unavailable"}` and the dashboard is unaffected.

## 2. Rewrite rules for each application project

Add the rules to the project that serves the hosts, **before** any catch-all
rewrite. Hosts below were grouped by their Vercel deployment on 2026-10-25;
check the project's Domains list before editing. Apex hosts that Vercel
currently redirects to `www.` (`ev.engineer`, `gamyaa.in`, `uflight.in`) never
reach the rewrite — their rules are included so the sites keep working if
the redirect is removed.

**itelematics.com project** — `vercel.json`
(`www.itelematics.com` does not currently serve HTTPS; add it to the project's
Domains before testing it.)

```json
{
  "rewrites": [
    { "source": "/api/auth/:action(login|callback|session|logout)", "has": [{ "type": "host", "value": { "eq": "itelematics.com" } }], "destination": "https://login.itelematics.com/api/auth/app/itelematics.com/:action" },
    { "source": "/api/auth/:action(login|callback|session|logout)", "has": [{ "type": "host", "value": { "eq": "www.itelematics.com" } }], "destination": "https://login.itelematics.com/api/auth/app/www.itelematics.com/:action" }
  ]
}
```

**www.ev.engineer project** — `vercel.json`

```json
{
  "rewrites": [
    { "source": "/api/auth/:action(login|callback|session|logout)", "has": [{ "type": "host", "value": { "eq": "ev.engineer" } }], "destination": "https://login.autonomous.ev.engineer/api/auth/app/ev.engineer/:action" },
    { "source": "/api/auth/:action(login|callback|session|logout)", "has": [{ "type": "host", "value": { "eq": "www.ev.engineer" } }], "destination": "https://login.autonomous.ev.engineer/api/auth/app/www.ev.engineer/:action" }
  ]
}
```

**autonomous / aerospace project** (`autonomous.ev.engineer`,
`aerospace.ev.engineer`, `aerospace.ishavasyam.org`, `aerospace.gamyaa.in` and
`cybersecurity.uflight.in` share one deployment; Next.js, repo `CARSOFTWARESYSTEMS/AutonomousEV`). Its
`next.config.ts` generates these rules from the site's own host table
(`src/lib/auth/sites.ts`), so nothing needs copying by hand. Note
`aerospace.gamyaa.in` and `cybersecurity.uflight.in` go to **different** login
hosts. The equivalent `vercel.json` form:

```json
{
  "rewrites": [
    { "source": "/api/auth/:action(login|callback|session|logout)", "has": [{ "type": "host", "value": { "eq": "autonomous.ev.engineer" } }], "destination": "https://login.autonomous.ev.engineer/api/auth/app/autonomous.ev.engineer/:action" },
    { "source": "/api/auth/:action(login|callback|session|logout)", "has": [{ "type": "host", "value": { "eq": "aerospace.ev.engineer" } }], "destination": "https://login.autonomous.ev.engineer/api/auth/app/aerospace.ev.engineer/:action" },
    { "source": "/api/auth/:action(login|callback|session|logout)", "has": [{ "type": "host", "value": { "eq": "aerospace.ishavasyam.org" } }], "destination": "https://login.autonomous.ev.engineer/api/auth/app/aerospace.ishavasyam.org/:action" },
    { "source": "/api/auth/:action(login|callback|session|logout)", "has": [{ "type": "host", "value": { "eq": "aerospace.gamyaa.in" } }], "destination": "https://login.gamyaa.in/api/auth/app/aerospace.gamyaa.in/:action" },
    { "source": "/api/auth/:action(login|callback|session|logout)", "has": [{ "type": "host", "value": { "eq": "cybersecurity.uflight.in" } }], "destination": "https://login.uflight.in/api/auth/app/cybersecurity.uflight.in/:action" }
  ]
}
```

**gamyaa project** (`www.gamyaa.in`, `aerosystems.gamyaa.in`, `gamyaa.in`;
Next.js, repo `gamyaaaerosystems/gamyaa`) — in `next.config.ts`, replace
`rewrites()` so the sign-in rules apply in both AeroSystems canonical modes:

```ts
  async rewrites() {
    // Multi-domain sign-in: /api/auth/* is served by login.gamyaa.in (docs/auth/multi-domain-sso.md in Interns2026).
    const sso = ["www.gamyaa.in", "gamyaa.in", "aerosystems.gamyaa.in"].map(host => ({
      source: "/api/auth/:action(login|callback|session|logout)",
      has: [{ type: "host" as const, value: host.replace(/\./g, "\\.") }],
      destination: `https://login.gamyaa.in/api/auth/app/${host}/:action`,
    }));
    if (aeroCanonical !== "subdomain") return { beforeFiles: sso, afterFiles: [], fallback: [] };
    return {
      beforeFiles: [
        ...sso,
        {
          source: "/",
          has: [{ type: "host" as const, value: AERO_HOST }],
          destination: "/aerosystems",
        },
        {
          // Anything that is not a framework asset, API route, file with an extension,
          // or already-prefixed path is served from the /aerosystems route tree.
          source: "/:path((?!_next/|api/|aerosystems(?:/|$))[^.]+)",
          has: [{ type: "host" as const, value: AERO_HOST }],
          destination: "/aerosystems/:path",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
```

**www.uflight.in project** — `vercel.json`

```json
{
  "rewrites": [
    { "source": "/api/auth/:action(login|callback|session|logout)", "has": [{ "type": "host", "value": { "eq": "uflight.in" } }], "destination": "https://login.uflight.in/api/auth/app/uflight.in/:action" },
    { "source": "/api/auth/:action(login|callback|session|logout)", "has": [{ "type": "host", "value": { "eq": "www.uflight.in" } }], "destination": "https://login.uflight.in/api/auth/app/www.uflight.in/:action" }
  ]
}
```

A project that uses the older `routes` property instead takes the same rule as
`{ "src": "^/api/auth/(login|callback|session|logout)$", "has": [{ "type": "host", "value": { "eq": "<host>" } }], "dest": "https://<login host>/api/auth/app/<host>/$1" }`,
placed before its catch-all. A Next.js project takes the `next.config.ts` form above.

## 3. Firestore rules and TTL (project `ev2027`)

```sh
# Rules: explicit deny for authSessions, authCodes, authEvents, authRateLimits
firebase deploy --only firestore:rules --project ev2027

# TTL on ttlAt (deletes expired records)
gcloud firestore fields ttls update ttlAt --collection-group=authSessions   --enable-ttl --async --project=ev2027
gcloud firestore fields ttls update ttlAt --collection-group=authCodes      --enable-ttl --async --project=ev2027
gcloud firestore fields ttls update ttlAt --collection-group=authEvents     --enable-ttl --async --project=ev2027
gcloud firestore fields ttls update ttlAt --collection-group=authRateLimits --enable-ttl --async --project=ev2027

# Check: all four should become ACTIVE
gcloud firestore fields ttls list --project=ev2027
```

Applied to `ev2027` on 2026-10-25. Retention: sessions 30 days after expiry,
codes 1 day, audit events 400 days. No new indexes are needed.

**Activation records (added after 2026-10-25):** the same rules deploy adds
`userActivations` — readable by Platform Admin and by that Partner's Admins,
written by no client. Deploy the rules **before** the dashboard build that
reads them; until then the Users page lists members with a notice that sign-in
activity isn't available. `userActivations` has no TTL (they are the user
records Admins work from) and needs no index: list queries filter on one field
and sort in the browser.

## 4. Post-deployment smoke tests

### Stage 1 — backend only (no site changes yet)

Needs: production deployment of `main` succeeded, and section 1 done and redeployed.

1. Each login host answers. Expect `{"authenticated":false}`; `{"error":"unavailable"}` means the environment variables are missing or production wasn't redeployed.
   ```sh
   for h in login.itelematics.com login.autonomous.ev.engineer login.gamyaa.in login.uflight.in; do
     echo "$h $(curl -s https://$h/api/auth/session)"; done
   ```
2. The query string reaches the function. Expect `400`:
   ```sh
   curl -s -o /dev/null -w '%{http_code}\n' 'https://login.uflight.in/api/auth/app/www.uflight.in/login?return=%2F%2Fevil.example'
   ```
3. A sign-in starts. Expect `302`, `location: https://login.uflight.in/api/auth/authorize?state=…`, `set-cookie: __Host-i26_txn=…; HttpOnly; Secure; SameSite=Lax` and `cache-control: no-store`:
   ```sh
   curl -si 'https://login.uflight.in/api/auth/app/www.uflight.in/login?return=%2F' | grep -iE '^(HTTP|location|set-cookie|cache-control)'
   ```
4. Dashboard unchanged: sign in at `https://login.gamyaa.in/login` with Google and use the dashboard as before. Then open `https://login.gamyaa.in/api/auth/session`: `authenticated: true` with your roles (the dashboard sign-in started the central session). Sign out; it shows `authenticated: false` again.
5. Firestore console: `authEvents` has `login_success`, `session_created` and `logout` for that sign-in, with no tokens or cookie values in them.

### Stage 2 — each application project, after its rewrite deploys

For each host the project serves:

```sh
curl -s https://<site>/api/auth/session                                  # {"authenticated":false}
curl -si 'https://<site>/api/auth/login?return=%2F' | grep -iE '^(HTTP|location|set-cookie)'
# 302 to its login host, and set-cookie: __Host-i26_txn=… arriving through the rewrite
```

### Stage 3 — real Google sign-in and exact return

Use a **new private window for every row** so each one starts signed out and
must show the Google sign-in. The Console line in step 3 is exactly what the
site's Login button will do.

1. Open the **Start URL**.
2. The address bar shows the **Expected URL** (for apex hosts Vercel has already moved you to `www.`; the `#hash` survives).
3. DevTools → Console:
   ```js
   location.href = '/api/auth/login?return=' + encodeURIComponent(location.pathname + location.search + location.hash)
   ```
4. You are on the **Login host**, with that Partner's branding and "You're signing in to *site*". Sign in with Google.
5. You land on **exactly the Expected URL**: same path, same query (`%20` intact), same `#hash`.
6. Console: `await (await fetch('/api/auth/session')).json()` → `authenticated: true`, your `user`, the `roles` you hold in that Partner, and `domain` equal to the site's hostname.
7. DevTools → Application → Cookies: on the site only `__Host-i26_session`, marked HttpOnly, Secure, SameSite=Lax, with no Domain.

| # | Start URL | Login host | Expected URL after sign-in |
|---|---|---|---|
| 1 | `https://itelematics.com/internships?smoke=it&q=a%20b#apply` | `login.itelematics.com` | `https://itelematics.com/internships?smoke=it&q=a%20b#apply` |
| 2 | `https://ev.engineer/ev-engineer?smoke=ev&q=a%20b#overview` | `login.autonomous.ev.engineer` | `https://www.ev.engineer/ev-engineer?smoke=ev&q=a%20b#overview` |
| 3 | `https://autonomous.ev.engineer/av-concepts?smoke=auto&q=a%20b#top` | `login.autonomous.ev.engineer` | `https://autonomous.ev.engineer/av-concepts?smoke=auto&q=a%20b#top` |
| 4 | `https://aerospace.ev.engineer/aerospace/uflight-3d?smoke=aero&view=orbit#telemetry` | `login.autonomous.ev.engineer` | `https://aerospace.ev.engineer/aerospace/uflight-3d?smoke=aero&view=orbit#telemetry` |
| 5 | `https://gamyaa.in/aerosystems?smoke=gamyaa&q=a%20b#solutions` | `login.gamyaa.in` | `https://www.gamyaa.in/aerosystems?smoke=gamyaa&q=a%20b#solutions` |
| 6 | `https://uflight.in/?smoke=uflight&q=a%20b#top` | `login.uflight.in` | `https://www.uflight.in/?smoke=uflight&q=a%20b#top` |
| 7 | `https://aerospace.gamyaa.in/aerospace?smoke=aero-g#top` | `login.gamyaa.in` (not EV.ENGINEER) | `https://aerospace.gamyaa.in/aerospace?smoke=aero-g#top` |
| 8 | `https://cybersecurity.uflight.in/aerospace?smoke=cyber#top` | `login.uflight.in` (not EV.ENGINEER) | `https://cybersecurity.uflight.in/aerospace?smoke=cyber#top` |
| 9 | `https://aerospace.ishavasyam.org/space?smoke=isha#research` | `login.autonomous.ev.engineer` | `https://aerospace.ishavasyam.org/space?smoke=isha#research` |

Rows 7 and 8 check the one deployment that serves three providers.

Then, in the window from row 2 (still signed in):

- **Single sign-on:** do row 4 in the same window. Expect no Google prompt and the same exact return.
- **Provider isolation:** do row 5 in the same window. Expect the GAMYAA sign-in page (a different provider never reuses EV.ENGINEER's session).
- **Local logout:** on `aerospace.ev.engineer`, run `await (await fetch('/api/auth/logout', { method: 'POST' })).json()`. Expect `{authenticated:false}`, the cookie gone, `/api/auth/session` false, and `www.ev.engineer` still signed in. Signing in again on `aerospace.ev.engineer` needs no Google prompt.
- **Open redirect refused:** open `https://aerospace.ev.engineer/api/auth/login?return=https%3A%2F%2Fevil.example`. Expect "We can't send you there".
- **No membership, no access:** sign in with a Google account that has no membership in that Partner. Expect `authenticated: true, roles: []`, and the site must deny every protected route.
- **Audit:** `authEvents` shows `login_started`, `login_success`, `session_created`, `authorization_code_issued`, `authorization_code_exchanged`, `session_created` and `logout` for these runs.

Only after these pass: add the sites' Login button and sign-in prompt.

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
| Audit | `authEvents`: `login_started`, `login_success`, `login_failed`, `authorization_code_issued`, `authorization_code_exchanged`, `session_created`, `session_refreshed`, `logout`, `session_revoked`, `user_activation` — user, Partner, host, time, result, reason, IP, user agent. No tokens, codes or cookie values. Server-only: no Admin view reads them. |
| Activation records | `userActivations/{partnerId}_{uid}`: first and latest sign-in, coarse location, last 15 sign-in/sign-out events. No tokens, codes, session ids, cookies, nonces, IP addresses, user agents or coordinates (tested in `handler.test.ts`). |
| Errors | Fixed friendly pages per case (`expired_login`, `invalid_return`, `invalid_state`, `expired_code`, `code_used`, `session_failed`, `unauthorized_domain`, …); no internal detail. |

Tests: [`server/auth/handler.test.ts`](../../server/auth/handler.test.ts) runs the
whole flow through a simulated browser with one cookie jar per host;
[`src/auth/*.test.ts`](../../src/auth) cover the host table and return paths;
`tests/rules/tenant.rules.test.ts` and `tests/rules/authStore.test.ts` cover the
Firestore rules and the Firestore store in the emulator.

## Activation records and the Users view

Every completed sign-in updates one record per user per Partner,
`userActivations/{partnerId}_{uid}` ([`server/auth/activation.ts`](../../server/auth/activation.ts),
types in [`src/types/activation.ts`](../../src/types/activation.ts)), inside a
transaction:

- **First activation** — written once, never overwritten: when, source domain and host, page path (no query or hash) and label, login trigger and prompt type.
- **Latest login** — replaced on every sign-in, with the access the user had at that moment (`granted`, `platform_admin`, `no_membership`, `pending`, `suspended`, `blocked`). Live access is still the membership.
- **Identity** — email, verified flag and name as Google reports them now.
- **Coarse location** — country, state/region, city, time zone. The user's profile (`country`, `stateOrRegion`, `city`) wins; otherwise Vercel's `x-vercel-ip-*` headers, read at `/api/auth/authorize` (the one step the browser sends straight to the login host — requests through a site's rewrite carry the proxy's location). Latitude, longitude and postal code are never read; the IP address is not stored. A sign-in without a location keeps the previous one.
- **Recent events** — the last 15 `user_activation`, `login_success` and `logout` entries.

Where a sign-in comes from:

| Trigger | Prompt type | Sent by |
|---|---|---|
| `premium_route_required` | required | A site's login gate on a required-login page |
| `five_minute_prompt` | optional | A site's optional prompt after five anonymous minutes |
| `header_login` | — | A site's header Login control |
| `workspace_access` | — | The dashboard's own sign-in (`POST /api/auth/session` with `purpose: "workspace"`; host = the login host) |
| `manual_login` | — | Anything else, including a missing or unknown `trigger` |

`label` is plain text, 80 characters at most. Both values are display
metadata for Admins and never affect access. A failure to write the record is
logged and never blocks the sign-in.

**Users view** (`/admin/users`): Platform Admin sees every Partner; an Admin
sees their own Partner only — firestore.rules enforce the same, so the scope
holds even against a hand-made query. Viewers and every other role get
nothing. One row per user per Partner joins the membership with the activation
record; someone who signed in without a membership shows as
*Authenticated · No Membership*. `/admin/users/<uid>` shows identity,
membership, activation and access, location and recent events per Partner;
`/admin/users/manage` is the membership management page that was
`/admin/users` before.

**Privacy notice:** `/privacy` on every login host, linked from `/login` and
`/sso`. Keep it in step with this section.

## Decisions for this release

- **Authentication ≠ authorization.** Any Google account may authenticate; protected access needs all four checks above.
- **Sessions:** 12 hours idle, 7 days absolute, configurable with `AUTH_SESSION_IDLE_HOURS` and `AUTH_SESSION_MAX_HOURS`.
- **Roles:** the platform's existing role names. No SSO-specific roles.
- **Logout is local.** A site's logout ends only that site's session. Signing out of the dashboard on a login host ends that login host's central session (no more automatic sign-in there), not the sites' sessions. There is no global logout.
- **Site endpoints:** served by this project through each site's rewrite. Revisit only if production testing shows a problem.

## Future security work (not part of this release)

- **Dashboard browser token.** The dashboard on the login hosts still uses the Firebase Auth SDK's default persistence, which keeps its refresh token in IndexedDB. This release does not change that. The SSO cookies, codes and sessions never touch browser storage. A later change could sign the dashboard in from the HttpOnly central session (short-lived Firebase custom tokens, in-memory persistence).
- **Global logout / revoke all sessions** for a user (the store already supports `revokeUserSessions`).
- Two sign-ins started at once in two tabs of the same site: the later one wins; the earlier shows "couldn't be verified" and the user signs in again.
