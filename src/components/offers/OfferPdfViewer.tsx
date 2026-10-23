import { useEffect, useRef } from 'react'
import { FileText, ExternalLink, X } from 'lucide-react'
import type { OfferDraft } from '../../types/offers'

/**
 * The offer PDF shown in the page through the browser's own viewer (zoom,
 * search, print). `url` is an object URL of the rules-checked download, so
 * nothing here is a shareable link. Scrolls itself into view when opened.
 */
export default function OfferPdfViewer({ offer, url, detail, onClose }: {
  offer: OfferDraft
  url: string
  /** Extra context after the file name, e.g. the candidate on the managers' page. */
  detail?: string
  onClose: () => void
}) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => { ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, [])

  return (
    <section ref={ref} aria-label="Offer letter document"
      className="scroll-mt-20 rounded-2xl bg-white ring-1 ring-slate-200 overflow-hidden">
      <div className="flex items-center gap-2 pl-4 sm:pl-5 pr-2 py-2 border-b border-slate-200">
        <FileText size={16} className="text-brand-600 flex-shrink-0" aria-hidden="true" />
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">
          {offer.file.name}
          {detail && <span className="ml-2 font-normal text-slate-500">{detail}</span>}
        </p>
        <a href={url} target="_blank" rel="noopener"
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 whitespace-nowrap">
          <ExternalLink size={14} /> <span className="hidden sm:inline">Open in new tab</span>
        </a>
        <button onClick={onClose} aria-label="Close document"
          className="rounded-lg p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100">
          <X size={16} />
        </button>
      </div>
      <iframe title={`Offer letter: ${offer.file.name}`} src={`${url}#navpanes=0`}
        className="block w-full h-[80vh] min-h-[32rem] bg-slate-100" />
    </section>
  )
}
