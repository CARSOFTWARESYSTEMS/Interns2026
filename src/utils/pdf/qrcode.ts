// ── QR Code Generation For Generated Documents (PEOPLE-003) ─────────────────
// Every generated document embeds a QR code pointing at its future
// verification URL, even though the verification page itself doesn't exist
// yet (per spec) — the QR is generated now so it's already correct once that
// page ships.

import QRCode from 'qrcode'
import { letterVerificationUrl } from '../../types/peopleLetters'

export async function buildVerificationQrDataUrl(documentId: string): Promise<string | null> {
  try {
    return await QRCode.toDataURL(letterVerificationUrl(documentId), {
      margin: 1,
      width: 256,
      color: { dark: '#0B1220', light: '#FFFFFF' },
    })
  } catch {
    return null
  }
}
