# UFlight™ | EV.ENGINEER™ — Aerospace Intelligence & Cybersecurity Platform
Intern Engineering Program 2026 · iTelematics Software Private Limited

## Data Storage Architecture

| Layer | Store | Controlled by |
|---|---|---|
| **IAM / Auth / Profile** | Firebase Firestore (`users/{uid}`, `userSkills/{uid}`, `userResumes/{uid}`, `auditLogs`, `loginHistory`, `invitations`, `organizations`) | Always Firebase — never affected by `VITE_DATA_MODE` |
| **Engineering data** | Local JSON / Google Drive / Firestore | `VITE_DATA_MODE=local\|gdrive\|firebase` |

**Profile completion** (`profileCompleted: true`) is written to and read from Firestore exclusively.
It is never stored in `localStorage` and does not depend on `VITE_DATA_MODE`.

## Environment Variables

```
VITE_DATA_MODE=local|gdrive|firebase   # controls engineering data backend only
VITE_GOOGLE_CLIENT_ID=...              # required for gdrive mode
VITE_FIREBASE_*=...                    # required for firebase mode AND all IAM/profile features
```

Copy `.env.example` to `.env.local` and fill in your values.

# Security

This repository never stores secrets.

Do NOT commit:

- .env
- .env.local
- Google credentials
- Firebase credentials
- Service account keys
- OAuth tokens
- Personal API keys
- Resume PDFs
- Evidence files
- Google Drive exports

Only commit:

- .env.example

## Multi-domain sign-in

The login hosts also sign users in to the Partner websites (itelematics.com,
ev.engineer, gamyaa.in, uflight.in and their subdomains) through a Vercel
Function at `/api/auth`. Setup, the per-site rewrite and the security model:
[docs/auth/multi-domain-sso.md](docs/auth/multi-domain-sso.md).
