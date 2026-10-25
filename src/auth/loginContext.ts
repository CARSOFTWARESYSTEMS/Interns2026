// ── Why and where a sign-in started ────────────────────────────────────────
//
// A site's Login link names what made the visitor sign in (the trigger) and
// the page they were on (its label):
//
//   /api/auth/login?return=/space/cubesat&trigger=premium_route_required&label=CubeSat
//
// Both travel inside the signed state and end up on the user's activation
// record for Admin views. They are display metadata, never an access
// decision, and untrusted input: an unknown trigger reads as manual_login and
// a label is plain text cut to 80 characters.
//
// Shared by the browser bundle and the Vercel function: pure, relative
// imports carry a .js extension (Node ESM).

export const LOGIN_TRIGGERS = [
  'header_login',
  'five_minute_prompt',
  'premium_route_required',
  'workspace_access',
  'manual_login',
] as const

export type LoginTrigger = (typeof LOGIN_TRIGGERS)[number]

/** A prompt the visitor could dismiss, or a gate they could not pass without signing in. */
export type LoginPromptType = 'optional' | 'required'

export const LOGIN_TRIGGER_LABELS: Record<LoginTrigger, string> = {
  header_login: 'Header Login',
  five_minute_prompt: 'Optional Prompt',
  premium_route_required: 'Premium Route',
  workspace_access: 'Workspace',
  manual_login: 'Manual Login',
}

export function parseLoginTrigger(raw: unknown): LoginTrigger {
  return typeof raw === 'string' && (LOGIN_TRIGGERS as readonly string[]).includes(raw) ? (raw as LoginTrigger) : 'manual_login'
}

/** The prompt behind a trigger; null when no prompt was involved. */
export function promptTypeFor(trigger: LoginTrigger): LoginPromptType | null {
  if (trigger === 'five_minute_prompt') return 'optional'
  if (trigger === 'premium_route_required') return 'required'
  return null
}

export const MAX_PAGE_LABEL_LENGTH = 80

/** Plain, single-line text of at most 80 characters ('' for anything else). */
export function sanitizePageLabel(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const text = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  return Array.from(text).slice(0, MAX_PAGE_LABEL_LENGTH).join('').trim()
}

/** The path alone: a query or hash can carry personal data, so neither is kept on a record. */
export function pathOnly(path: string): string {
  const bare = path.split(/[?#]/)[0]
  return bare.startsWith('/') ? bare : '/'
}

/** The site as people name it: the host without a leading "www.". */
export function siteDomain(host: string): string {
  return host.replace(/^www\./, '')
}
