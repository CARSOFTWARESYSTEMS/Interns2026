import type { OfferDraftStatus } from '../../types/offers'

const STYLES: Record<OfferDraftStatus, { pill: string; dot: string }> = {
  'Draft':     { pill: 'bg-slate-100 text-slate-700 ring-slate-300/70',       dot: 'bg-slate-400' },
  'In Review': { pill: 'bg-amber-50 text-amber-800 ring-amber-300/70',        dot: 'bg-amber-500' },
  'Confirmed': { pill: 'bg-emerald-50 text-emerald-800 ring-emerald-300/70',  dot: 'bg-emerald-500' },
}

/** Draft · In Review · Confirmed — one badge everywhere the status appears. */
export default function OfferStatusBadge({ status, size = 'md' }: { status: OfferDraftStatus; size?: 'sm' | 'md' }) {
  const s = STYLES[status] ?? STYLES.Draft
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full ring-1 ring-inset font-semibold whitespace-nowrap
      ${size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'} ${s.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot} ${status === 'In Review' ? 'motion-safe:animate-pulse' : ''}`} aria-hidden="true" />
      {status}
    </span>
  )
}
