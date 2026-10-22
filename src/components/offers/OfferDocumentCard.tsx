import type { ReactNode } from 'react'
import { FileText } from 'lucide-react'
import type { OfferDraft } from '../../types/offers'

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function confirmedAtIso(offer: OfferDraft): string {
  const c = offer.confirmedAt as unknown
  if (!c) return ''
  if (typeof c === 'string') return c
  if (typeof (c as { toDate?: () => Date }).toDate === 'function') return (c as { toDate: () => Date }).toDate().toISOString()
  return ''
}

function formatSize(bytes: number): string {
  if (!bytes) return ''
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * The offer letter as a controlled engineering document: file identity on
 * top, then a drawing-style title block (revision, issue date, status).
 */
export default function OfferDocumentCard({ offer, children }: { offer: OfferDraft; children?: ReactNode }) {
  const confirmed = confirmedAtIso(offer)
  return (
    <article className="rounded-2xl bg-white ring-1 ring-slate-200 shadow-[0_1px_0_rgba(15,23,42,0.04),0_12px_32px_-12px_rgba(15,23,42,0.18)] overflow-hidden">
      {/* Document identity */}
      <div className="flex items-start gap-4 p-5 sm:p-6">
        <div className="relative flex-shrink-0 h-14 w-11 rounded-md bg-slate-50 ring-1 ring-slate-200 flex items-center justify-center">
          <FileText size={20} className="text-brand-600" aria-hidden="true" />
          <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded bg-brand-600 px-1 text-[9px] font-bold text-white">PDF</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900 break-words leading-snug">{offer.file.name}</p>
          <p className="text-sm text-slate-500 mt-0.5">Draft offer letter{offer.file.size ? `, ${formatSize(offer.file.size)}` : ''}</p>
        </div>
      </div>

      {/* Title block */}
      <dl className="grid grid-cols-[auto_1fr_1fr] border-t border-slate-200 text-sm [&>div+div]:border-l [&>div+div]:border-slate-200">
        <div className="px-3 sm:px-6 py-3">
          <dt className="text-xs text-slate-500">Revision</dt>
          <dd className="mt-0.5 font-semibold text-slate-900 tabular-nums">{String(offer.version).padStart(2, '0')}</dd>
        </div>
        <div className="px-3 sm:px-6 py-3 min-w-0">
          <dt className="text-xs text-slate-500">Issued</dt>
          <dd className="mt-0.5 font-semibold text-slate-900 tabular-nums whitespace-nowrap">{formatDate(offer.file.uploadedAt)}</dd>
        </div>
        <div className="px-3 sm:px-6 py-3 min-w-0">
          <dt className="text-xs text-slate-500">Updated</dt>
          <dd className="mt-0.5 font-semibold text-slate-900 tabular-nums whitespace-nowrap">{formatDate(offer.updatedAt)}</dd>
        </div>
      </dl>

      {confirmed && (
        <p className="border-t border-emerald-200 bg-emerald-50/70 px-5 sm:px-6 py-3 text-sm text-emerald-900">
          Confirmed on <span className="font-semibold tabular-nums">{formatDateTime(confirmed)}</span>
        </p>
      )}

      {children && <div className="border-t border-slate-200 p-5 sm:p-6">{children}</div>}
    </article>
  )
}
