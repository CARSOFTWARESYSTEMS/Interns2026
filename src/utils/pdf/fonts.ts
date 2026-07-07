// ── Premium PDF Typography (PEOPLE-003) ─────────────────────────────────────
// jsPDF's built-in fonts are limited to Helvetica/Times/Courier. For a real
// premium document we register the bundled Inter TTFs (public/fonts/) into
// jsPDF's virtual filesystem so callers can `doc.setFont('Inter', 'bold')`
// etc. Only Inter is embedded in this iteration — a template's other
// `fontFamily` choices are stored for a future sprint but currently render
// with this same Inter PDF font.

import type { jsPDF } from 'jspdf'

const FONT_FILES: Record<string, string> = {
  normal:   '/fonts/Inter-Regular.ttf',
  semibold: '/fonts/Inter-SemiBold.ttf',
  bold:     '/fonts/Inter-Bold.ttf',
}

async function fetchAsBase64(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch font ${url}`)
  const buf = await res.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

/**
 * Registers the bundled Inter TTFs on this jsPDF instance's VFS. Returns
 * whether registration succeeded — callers fall back to Helvetica (jsPDF's
 * default) if this returns false, e.g. when running somewhere `/fonts/*.ttf`
 * isn't servable.
 */
export async function registerPremiumFonts(doc: jsPDF): Promise<boolean> {
  try {
    const [normal, semibold, bold] = await Promise.all([
      fetchAsBase64(FONT_FILES.normal),
      fetchAsBase64(FONT_FILES.semibold),
      fetchAsBase64(FONT_FILES.bold),
    ])
    doc.addFileToVFS('Inter-Regular.ttf', normal)
    doc.addFont('Inter-Regular.ttf', 'Inter', 'normal')
    doc.addFileToVFS('Inter-SemiBold.ttf', semibold)
    doc.addFont('Inter-SemiBold.ttf', 'Inter', 'semibold')
    doc.addFileToVFS('Inter-Bold.ttf', bold)
    doc.addFont('Inter-Bold.ttf', 'Inter', 'bold')
    return true
  } catch {
    return false
  }
}
