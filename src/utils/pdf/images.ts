// ── Remote Image Loading For PDF Embedding (PEOPLE-003) ─────────────────────
// jsPDF's addImage needs an actual data URI, not a remote URL, so hero
// banners / logos / signatures / seals configured as plain URLs (see
// Templates.tsx) must be fetched and converted client-side before embedding.
//
// Known limitation: this requires the image host to allow cross-origin
// `fetch` reads. Hosts without permissive CORS headers will fail here — we
// swallow that failure and simply omit the image rather than breaking PDF
// generation, since a missing banner is far better than a document that
// won't generate at all.

export async function loadImageAsDataUrl(url: string): Promise<string | null> {
  if (!url) return null
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/** jsPDF's addImage needs an explicit format string (e.g. "PNG", "JPEG") derived from the data URI's mime type. */
export function imageFormatFromDataUrl(dataUrl: string): string {
  const match = /^data:image\/(\w+);/.exec(dataUrl)
  const ext = (match?.[1] ?? 'png').toUpperCase()
  return ext === 'JPG' ? 'JPEG' : ext
}

/** Naturally-sized dimensions of a data URI image, in pixels. */
export function dataUrlImageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = reject
    img.src = dataUrl
  })
}
