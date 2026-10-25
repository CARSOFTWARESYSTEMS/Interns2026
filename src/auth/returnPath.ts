// ── Return destinations (open-redirect guard) ──────────────────────────────
//
// A sign-in returns the user to the page they started on. The destination is
// stored as a HOST (checked against AUTH_PROVIDERS) plus a same-host PATH
// (path + query + hash) — never as a full URL taken from a request. The path
// must be a plain absolute path: no scheme, no "//host", no backslashes, no
// control characters, so it can only ever resolve on the host it is paired
// with.
//
// Pure (shared by the browser bundle and the Vercel function).

const MAX_RETURN_PATH_LENGTH = 2048

/**
 * Returns a normalised path+query+hash that stays on `host`, or null when
 * `raw` could leave it (external URL, scheme-relative, javascript:, data:, …).
 */
export function sanitizeReturnPath(raw: string | null | undefined, host: string): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_RETURN_PATH_LENGTH) return null
  if (raw[0] !== '/') return null                      // javascript:, data:, https://…, relative paths
  if (raw[1] === '/' || raw[1] === '\\') return null   // //evil.example, /\evil.example
  if (raw.includes('\\')) return null                  // browsers treat \ as / in URLs
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null   // CR/LF, tabs (which URL parsers strip) …

  const origin = `https://${host}`
  let url: URL
  try {
    url = new URL(raw, origin)
  } catch {
    return null
  }
  if (url.origin !== origin) return null
  return `${url.pathname}${url.search}${url.hash}`
}

/** Absolute URL for a host + sanitised path. Throws if the result would leave the host. */
export function returnUrl(host: string, path: string): string {
  const origin = `https://${host}`
  const url = new URL(path, origin)
  if (url.origin !== origin) throw new Error('Return destination left its host')
  return url.href
}
