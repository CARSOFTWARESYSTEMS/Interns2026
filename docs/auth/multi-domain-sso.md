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

Application sites may also hide **premium pages** behind a sign-in (any
signed-in visitor, `roles` not required — e.g. AutonomousEV's
`src/config/premiumAuthRoutes.ts`). That is a login gate, not access control:
those pages are public files, so put nothing confidential there.

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

## How a logout works

An explicit Logout ends single sign-on, so the next Login goes to Google and
shows the **account chooser** (the user can pick the same account or another).

```text
aerospace.ev.engineer                login.autonomous.ev.engineer
─────────────────────                ────────────────────────────
1 POST /api/auth/logout?return=/aerospace   (same-origin only)
  • revoke this site's session, clear its cookie
  • revoke the central session that signed this site in
    (server-side: done even if the browser never reaches step 2)
  • signed logout ticket {host, path, user, time}
  ─────────── 303 ───────────────▶ 2 /signout?ticket=…  (page)
                                     • POST /api/auth/end-session {ticket}
                                       – end this browser's central session
                                         if it is the same user's; clear cookie
                                     • Firebase signOut() for that user here
  ◀──────────── back to the page ───── (only after both finish)
3 https://aerospace.ev.engineer/aerospace — signed out
```

Next Login: `/api/auth/authorize` finds no central session → `/sso` → Google
with `prompt=select_account`. Only this fresh sign-in reaches Google; while a
central session is valid, `/authorize` issues the code without it, so moving
between sites never shows the chooser.

What a site's Logout button does — either:

- **Form post** (preferred): `<form method="post" action="/api/auth/logout?return=/">`. The browser follows steps 1–3 by itself.
- **fetch:** `const r = await (await fetch('/api/auth/logout', { method: 'POST' })).json()`, then `location.assign(r.signOutUrl ?? '/')`. Without that navigation the central session is still revoked (step 1), but the login host's cookie and Firebase sign-in are only cleared at its next use.

Other sites' own sessions are untouched (per-site sessions): signing out of
`aerospace.ev.engineer` leaves `www.ev.engineer` signed in until it logs out or
expires. Other providers' login hosts are untouched too.

The `/signout` page renders before the dashboard's Partner, profile and data
providers, so signing out never loads the user's profile or records a sign-in.
A ticket is valid for 5 minutes and only ends a central session belonging to
the user who logged out: a ticket from someone else's logout signs no one out.

## Endpoints

On an application host (after its rewrite is deployed):

| | |
|---|---|
| `GET /api/auth/login?return=<path>[&trigger=<trigger>&label=<page>]` | Start sign-in. `return` is a path on the same host (path, query, hash); anything else is refused. `trigger` and `label` say why and where the sign-in started (see [Activation records](#activation-records-and-the-users-view)); both are optional. |
| `GET /api/auth/callback` | Used by the flow only. |
| `GET /api/auth/session` | `{ "authenticated": false }` or `{ "authenticated": true, "user": { "id", "name", "email" }, "roles": [...], "domain": "<host>" }` |
| `POST /api/auth/logout[?return=<path>]` | Ends this site's session **and single sign-on** ([How a logout works](#how-a-logout-works)). `fetch`: `{ "authenticated": false, "signOutUrl": "https://<login host>/signout?ticket=…" }` — open `signOutUrl` to finish. Form post: redirected there, then back to `return` (or `/`). With no session at the site: `{ "authenticated": false }` / straight back. |

On a login host: `GET /api/auth/authorize`, `POST /api/auth/session` (Firebase ID
token → central session; same-origin only), `GET /api/auth/session` (central
session status), `POST /api/auth/logout` (ends that login host's central session),
`POST /api/auth/end-session` (`{ ticket }` → `{ uid, returnTo }`; same-origin
only, used by the `/signout` page).

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
| `AUTH_TRUST_PROXIED_CLIENT_IP` | Optional. Leave **unset** until [section 5](#5-client-addresses-through-site-rewrites-rate-limits) shows sites' rewrites carry the visitor's address; then `true`. |

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
- **Explicit logout:** on `aerospace.ev.engineer`, run `const r = await (await fetch('/api/auth/logout', { method: 'POST' })).json(); r` → `{authenticated:false, signOutUrl:'https://login.autonomous.ev.engineer/signout?ticket=…'}`, then `location.assign(r.signOutUrl)`. Expect a brief "Signing you out…" on the login host and a return to `https://aerospace.ev.engineer/`; the site cookie gone; `/api/auth/session` false there and on `https://login.autonomous.ev.engineer/api/auth/session`; `www.ev.engineer` still signed in (its own session). Signing in again on `aerospace.ev.engineer` goes to Google with the **account chooser**.
- **Open redirect refused:** open `https://aerospace.ev.engineer/api/auth/login?return=https%3A%2F%2Fevil.example`. Expect "We can't send you there".
- **No membership, no access:** sign in with a Google account that has no membership in that Partner. Expect `authenticated: true, roles: []`, and the site must deny every protected route.
- **Audit:** `authEvents` shows `login_started`, `login_success`, `session_created`, `authorization_code_issued`, `authorization_code_exchanged`, `session_created` and `logout` (one for the site session, one with `sessionKind: central` for the login host) for these runs.

Only after these pass: add the sites' Login button and sign-in prompt.

## 5. Client addresses through site rewrites (rate limits)

Requests reach this function two ways:

- **Straight from the browser** to a login host (`/api/auth/authorize`, the
  dashboard's `POST /api/auth/session`, `/sso`). Vercel sets `x-real-ip` /
  `x-forwarded-for` to the visitor's address and overwrites any value the
  client sent, so these are trustworthy and every limit there is per address.
- **Through an application site's rewrite** (`/api/auth/app/<site>/login`,
  `…/callback`, `…/session`, `…/logout`). Vercel's documentation does not say
  whether the destination then sees the visitor's address or the site
  proxy's. If it is the proxy's, every visitor of a site shares one address.

So, until verified, sign-in starts that arrive through a rewrite are limited
**per site** (300 per minute) rather than per address: visitors can never
collapse into one visitor's 30-per-minute allowance. The `ip` on
`login_started` and callback audit events may likewise be the proxy's.

**Verify on production**, after this release is live:

1. *From real traffic (no test requests):* every `authorization_code_issued`
   audit event carries `startIpMatched` — whether the address that started
   the sign-in (through the rewrite; compared as a keyed hash, the address is
   never stored in the state) is the one asking for the code (directly).
   Firestore console → `authEvents` → filter `event == authorization_code_issued`.
   Mostly `true` ⇒ rewrites carry the visitor's address. Mostly `false` ⇒
   they carry the proxy's. (A few `false` are normal: phones change networks.)
2. *Or with a probe:* send two tagged sign-in starts and compare the `ip` of
   the two `login_started` events they create:
   ```sh
   UA="ip-probe-$(openssl rand -hex 6)"; echo "$UA"
   curl -s -o /dev/null -A "$UA" 'https://autonomous.ev.engineer/api/auth/login?return=%2F'                        # through the rewrite
   curl -s -o /dev/null -A "$UA" 'https://login.autonomous.ev.engineer/api/auth/app/autonomous.ev.engineer/login?return=%2F'   # direct
   ```
   Firestore console → `authEvents` → filter `userAgent == <UA>`. Same `ip`
   on both ⇒ the rewrite carries the visitor's address.
3. *Multiple real clients:* have two people on different networks start a
   sign-in on the same site; with (1) or (2) confirm two different addresses.

**Then decide:** if rewrites carry the visitor's address, set
`AUTH_TRUST_PROXIED_CLIENT_IP=true` (Production) and redeploy — sign-in starts
are then limited per visitor again. If not, leave it unset: the per-site cap
stays, the per-address limits on the login host still stop a single client,
and a per-IP rate-limit rule in the site project's Vercel Firewall (which
sees the real address before the rewrite) is the way to add per-visitor
limiting there.

## 6. Release checklist — premium login and activation records

In order; each step only after the one before it passes.

1. [ ] **Firestore rules:** `firebase deploy --only firestore:rules --project ev2027`.
2. [ ] **Intern2026:** merge and deploy to production.
3. [ ] **Activation recording:** sign in on an application site, then open
       `https://<login host>/admin/users` as Platform Admin: the account is
       listed with first source domain, page, trigger and location; its detail
       page shows the sign-in event. `authEvents` shows `user_activation`.
4. [ ] **Client addresses:** section 5, and set or leave
       `AUTH_TRUST_PROXIED_CLIENT_IP` accordingly.
5. [ ] **Application sites:** deploy (AutonomousEV: see its `docs/premium-login.md`).
6. [ ] **Real domains:** login gates and previews on required-login pages; the
       five-minute prompt on ordinary pages; exact return URL including query
       and `#hash` (section 4, stage 3 table).
7. [ ] **Phones:** iOS Safari and Android Chrome — sign-in, exact return,
       prompt as a bottom sheet.
8. [ ] **Authenticated · No Membership:** a Google account with no membership
       signs in; the site shows premium pages; `roles` is `[]`; the Users page
       shows *Authenticated · No Membership*; nothing role-protected opens.
9. [ ] **Admin scope:** a Partner Admin on their own login host sees only
       that Partner's users; Platform Admin sees every ecosystem; a Viewer has
       no Users page and the rules refuse the data.
10. [ ] **Privacy notice** reviewed (above) before broad rollout.

## 7. Logout and account switching — real browsers

After the release with explicit logout is in production. Use two Google
accounts, **A** (with a membership in the Partner) and **B** (another role, or none).

| Check | Steps | Expect |
|---|---|---|
| Account switch | Sign in on `https://www.ev.engineer/` with A → Logout → Login | Google's **account chooser**. Choose B: the site's `/api/auth/session` shows B and B's roles only; `/admin/users` on the login host lists B's sign-in. |
| Same account again | Logout → Login → choose A | Chooser shown; A signed in as before. |
| SSO kept | Sign in on `www.ev.engineer` → open `https://aerospace.ev.engineer/` → Login | No Google page, no chooser; same user. |
| SSO ended | After a Logout on one site, Login on another site of the same provider | Chooser shown (central session gone). |
| Dashboard | After a site Logout, open `https://login.autonomous.ev.engineer/` | Dashboard sign-in page, not the old account (Firebase sign-in ended by `/signout`). |

Run the table on each browser, each in three setups:

| Browser | One Google account signed in | Several Google accounts | Private / Incognito window |
|---|---|---|---|
| Chrome desktop | [ ] | [ ] | [ ] |
| Safari macOS | [ ] | [ ] | [ ] |
| Safari iOS | [ ] | [ ] | [ ] |
| Chrome Android | [ ] | [ ] | [ ] |

With one account in the browser, Google still shows the chooser (that account
plus "Use another account"). In a private window Google asks for the account
from scratch, which is expected.

## 8. Firebase auth domain — `auth.ev.engineer`

The auth domain is where Firebase runs Google sign-in (`/__/auth/handler`, in
the popup) and the domain Google shows the user. It is **only** Firebase
infrastructure: the branded login hosts (`login.itelematics.com`,
`login.autonomous.ev.engineer`, `login.gamyaa.in`, `login.uflight.in`) stay the
product-facing sign-in addresses.

```text
application site → login.<brand> (Intern2026) → Google via auth.ev.engineer → login.<brand> → application page
```

| | |
|---|---|
| Before | `ev2027.firebaseapp.com` (production, checked 2026-10-26) |
| After | `auth.ev.engineer` |
| Where | `VITE_FIREBASE_AUTH_DOMAIN`, read by [`src/firebase/webConfig.ts`](../../src/firebase/webConfig.ts) — the only Firebase web config in this repo. No other Firebase value changes. |

On 2026-10-26 `auth.ev.engineer` had **no DNS record** (the `ev.engineer` zone
is at GoDaddy, `domaincontrol.com`). **Do not switch production until every
step below passes.** The code needs no further change: the switch is the
environment value. A value that is not a bare hostname (e.g. a pasted
`https://…/`) falls back to `ev2027.firebaseapp.com` with a console warning.

1. [ ] **Firebase Hosting** (project `ev2027`, default site): Hosting → Add custom domain → `auth.ev.engineer`. Add the records the console shows at GoDaddy (DNS for `ev.engineer`; the apex and other subdomains stay on Vercel). Wait for **Connected** and an issued certificate — this can take hours.
2. [ ] **Handler check** — both `200`, and `curl` must not need `-k`:
   ```sh
   curl -s -o /dev/null -w '%{http_code}\n' https://auth.ev.engineer/__/auth/handler
   curl -s https://auth.ev.engineer/__/firebase/init.json   # "projectId": "ev2027"
   ```
   (`https://auth.ev.engineer/` itself shows the dashboard's "address isn't configured" screen; that is harmless.)
3. [ ] **Firebase Authentication** → Settings → Authorized domains → add `auth.ev.engineer`.
4. [ ] **Google OAuth client** — Google Cloud console (`ev2027`) → APIs & Services → Credentials → *Web client (auto created by Google Service)* → Authorized redirect URIs → add `https://auth.ev.engineer/__/auth/handler`. Keep `https://ev2027.firebaseapp.com/__/auth/handler` (rollback).
5. [ ] **Test before production:** `VITE_FIREBASE_AUTH_DOMAIN=auth.ev.engineer npm run dev`, open `http://localhost:5173/login?partnerHost=login.autonomous.ev.engineer`, sign in: the Google window's address is `auth.ev.engineer` and sign-in completes (`localhost` is authorized by default).
6. [ ] **Production:** Vercel → `interns2026` → Settings → Environment Variables → Production → `VITE_FIREBASE_AUTH_DOMAIN` = `auth.ev.engineer` → **redeploy** (VITE_ values are compiled in at build time). Check what is live:
   ```sh
   JS=$(curl -s https://login.autonomous.ev.engineer/login | grep -oE '/assets/index[^"]+\.js' | head -1)
   curl -s "https://login.autonomous.ev.engineer$JS" | grep -oE 'VITE_FIREBASE_AUTH_DOMAIN:"[^"]*"'
   ```
7. [ ] **Every login host:** sign in on all four; the Google window shows `auth.ev.engineer`, not `ev2027.firebaseapp.com`. Then section 7.

**Rollback:** set `VITE_FIREBASE_AUTH_DOMAIN` back to `ev2027.firebaseapp.com` and redeploy.

**Authorized domains — keep the list minimal.** Only pages that run the
Firebase Auth SDK need to be listed: the four login hosts, `auth.ev.engineer`,
and Firebase's defaults (`localhost`, `ev2027.firebaseapp.com`,
`ev2027.web.app`). The application sites (`ev.engineer`, `www.gamyaa.in`, …)
never run Firebase sign-in — they use the code flow above — so they don't
belong on it unless a site starts calling Firebase Auth in the browser.

**Branding is not code.** What Google shows as the app's name and logo comes
from Google Cloud console → Google Auth Platform → **Branding** (app name,
user support email, logo, app home page and privacy policy links, authorized
domains — `ev.engineer`, `itelematics.com`, `gamyaa.in`, `uflight.in` —
and developer contact). One OAuth client serves all four brands, so pick a
name that fits all of them. A logo may require Google's brand verification.
If, after step 7, Google still shows the wrong name or logo, fix it there.

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
| Logout | A site's logout (same-origin POST) revokes its session and the central session that signed it in. The login host finishes with an HMAC-signed ticket `{host, path, user, time}` (5 min, bound to the provider's sites) that ends only that user's central session, behind a same-origin POST from `/signout`. The return page is rebuilt from the ticket and re-checked in the browser against the provider's sites. Replaying a ticket at most signs the same user out again. |
| Fresh Google sign-in | `prompt=select_account` on every Google sign-in (no `login_hint`). Reached only when no valid central session exists. |
| Central sign-in | Verifies the Firebase ID token server-side (signature, revocation, disabled account) and requires a sign-in within the last 5 minutes. |
| Rate limits | Per minute: 10 token sign-ins and 30 authorizations per client address (requests straight to the login host). Sign-in starts arriving through a site's rewrite: 300 per site until `AUTH_TRUST_PROXIED_CLIENT_IP=true`, then 30 per client address ([section 5](#5-client-addresses-through-site-rewrites-rate-limits)). |
| Audit | `authEvents`: `login_started`, `login_success`, `login_failed`, `authorization_code_issued`, `authorization_code_exchanged`, `session_created`, `session_refreshed`, `logout`, `session_revoked`, `user_activation` — user, Partner, host, time, result, reason, IP, user agent. No tokens, codes or cookie values. Server-only: no Admin view reads them. |
| Activation records | `userActivations/{partnerId}_{uid}`: first and latest sign-in, coarse location, last 15 sign-in/sign-out events. No tokens, codes, session ids, cookies, nonces, IP addresses, user agents or coordinates (tested in `handler.test.ts`). |
| Errors | Fixed friendly pages per case (`expired_login`, `invalid_return`, `invalid_state`, `expired_code`, `code_used`, `session_failed`, `unauthorized_domain`, …); no internal detail. |

Tests: [`server/auth/handler.test.ts`](../../server/auth/handler.test.ts) runs the
whole flow through a simulated browser with one cookie jar per host;
[`src/auth/*.test.ts`](../../src/auth) cover the host table, return paths and
the `/signout` sequence; [`src/firebase/auth.test.ts`](../../src/firebase/auth.test.ts)
the account chooser (`prompt=select_account`) and Firebase sign-out;
[`src/firebase/webConfig.test.ts`](../../src/firebase/webConfig.test.ts) the auth domain;
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
`/sso`. Keep it in step with this section. **Needs legal/privacy review
before broad production rollout** — it was written from the implementation,
not by counsel.

## Decisions for this release

- **Authentication ≠ authorization.** Any Google account may authenticate; protected access needs all four checks above.
- **Sessions:** 12 hours idle, 7 days absolute, configurable with `AUTH_SESSION_IDLE_HOURS` and `AUTH_SESSION_MAX_HOURS`.
- **Roles:** the platform's existing role names. No SSO-specific roles.
- **Explicit logout ends single sign-on** (changed 2026-10-26; it used to be local only). A site's logout ends that site's session, the login host's central session and its Firebase sign-in, so the next Login shows Google's account chooser. Other sites' own sessions remain until they log out or expire. Signing out of the dashboard on a login host ends its central session, as before. There is no global logout across sites.
- **Site endpoints:** served by this project through each site's rewrite. Revisit only if production testing shows a problem.

## Future security work (not part of this release)

- **Dashboard browser token.** The dashboard on the login hosts still uses the Firebase Auth SDK's default persistence, which keeps its refresh token in IndexedDB. This release does not change that. The SSO cookies, codes and sessions never touch browser storage. A later change could sign the dashboard in from the HttpOnly central session (short-lived Firebase custom tokens, in-memory persistence).
- **Global logout / revoke all sessions** for a user (the store already supports `revokeUserSessions`), e.g. so a logout also ends the other sites' sessions that the same central session signed in (each app session records its `centralId`).
- **Transition:** site sessions created before explicit logout shipped don't record `centralId`. For them the central session ends at the login host's `/signout` step, so a site that logs out with `fetch` and never opens `signOutUrl` leaves it alive until it expires (12 h idle). Gone once those sessions expire (7 days at most).
- Two sign-ins started at once in two tabs of the same site: the later one wins; the earlier shows "couldn't be verified" and the user signs in again.
