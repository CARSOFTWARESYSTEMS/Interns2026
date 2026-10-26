// ── User-facing errors ─────────────────────────────────────────────────────
//
// Every failure maps to a fixed code with a fixed, friendly message. Nothing
// from an exception (message, stack, store error) is ever rendered.

export type AuthErrorCode =
  | 'expired_login'
  | 'invalid_return'
  | 'invalid_state'
  | 'invalid_code'
  | 'expired_code'
  | 'code_used'
  | 'session_failed'
  | 'invalid_logout'
  | 'unauthorized_domain'
  | 'invalid_credentials'
  | 'stale_sign_in'
  | 'forbidden_origin'
  | 'rate_limited'
  | 'bad_request'
  | 'not_found'
  | 'method_not_allowed'
  | 'unavailable'

interface ErrorInfo {
  status: number
  title: string
  message: string
}

const ERRORS: Record<AuthErrorCode, ErrorInfo> = {
  expired_login:       { status: 400, title: 'Your sign-in expired', message: 'The sign-in took too long to complete. Please sign in again.' },
  invalid_return:      { status: 400, title: "We can't send you there", message: 'The page you were returning to is not part of this site. Please sign in again from the site.' },
  invalid_state:       { status: 400, title: "This sign-in couldn't be verified", message: 'The sign-in link was incomplete, altered, or started in another browser or tab. Please sign in again.' },
  invalid_code:        { status: 400, title: "This sign-in couldn't be completed", message: 'The sign-in link is not valid for this site. Please sign in again.' },
  expired_code:        { status: 400, title: 'Your sign-in expired', message: 'The sign-in link expired before it was used. Please sign in again.' },
  code_used:           { status: 400, title: 'This sign-in link was already used', message: 'For your security each sign-in link works once. Please sign in again.' },
  session_failed:      { status: 503, title: "We couldn't sign you in", message: 'Your sign-in was accepted but the session could not be started. Please try again in a moment.' },
  invalid_logout:      { status: 400, title: "This sign-out link isn't valid", message: 'It was incomplete or altered. Sign out again from the site you were using.' },
  unauthorized_domain: { status: 403, title: "This site can't use this sign-in", message: 'This site is not registered with this sign-in service. Please sign in from the site itself.' },
  invalid_credentials: { status: 401, title: "We couldn't verify your sign-in", message: 'Please sign in again.' },
  stale_sign_in:       { status: 401, title: 'Please sign in again', message: 'For your security, confirm your account to continue.' },
  forbidden_origin:    { status: 403, title: 'Request blocked', message: 'This request did not come from this site.' },
  rate_limited:        { status: 429, title: 'Too many attempts', message: 'Please wait a minute and try again.' },
  bad_request:         { status: 400, title: 'Something was missing', message: 'The request was incomplete. Please try again.' },
  not_found:           { status: 404, title: 'Not found', message: 'There is nothing here.' },
  method_not_allowed:  { status: 405, title: 'Not allowed', message: 'This address does not accept that kind of request.' },
  unavailable:         { status: 503, title: 'Sign-in is temporarily unavailable', message: 'Please try again in a few minutes.' },
}

export function errorInfo(code: AuthErrorCode): ErrorInfo {
  return ERRORS[code]
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export interface ErrorAction {
  label: string
  /** Absolute https URL built by the server from a validated host — never from request input. */
  href: string
}

/** Self-contained page: no scripts, no external assets. */
export function renderErrorPage(code: AuthErrorCode, action: ErrorAction | null): string {
  const { title, message } = ERRORS[code]
  const button = action
    ? `<a class="btn" href="${escapeHtml(action.href)}">${escapeHtml(action.label)}</a>`
    : ''
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
         background: #020617; color: #cbd5e1; font: 14px/1.5 system-ui, -apple-system, Segoe UI, sans-serif; padding: 16px; box-sizing: border-box; }
  .card { width: 100%; max-width: 380px; background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 28px; }
  h1 { margin: 0 0 8px; font-size: 17px; color: #fff; }
  p { margin: 0; color: #94a3b8; }
  .btn { display: block; margin-top: 22px; text-align: center; background: #2563eb; color: #fff; text-decoration: none;
         padding: 10px 14px; border-radius: 10px; font-weight: 600; }
  .btn:hover { background: #1d4ed8; }
  .code { margin-top: 18px; font-size: 11px; color: #475569; }
</style>
</head>
<body>
  <main class="card">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    ${button}
    <p class="code">Reference: ${escapeHtml(code)}</p>
  </main>
</body>
</html>`
}
