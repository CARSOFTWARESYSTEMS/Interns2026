import { useCallback, useEffect, useState } from 'react'
import { Eye, EyeOff, Download, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { useAuthContext } from '../../contexts/AuthContext'
import { usePartner, useBranding } from '../../contexts/PartnerContext'
import OfferDocumentCard from './OfferDocumentCard'
import OfferPdfViewer from './OfferPdfViewer'
import OfferStatusBadge from './OfferStatusBadge'
import {
  listMyOffers, confirmOffer, fetchOfferPdf, openOfferPdf, downloadOfferPdf, offerFileErrorMessage,
} from '../../firebase/offers'
import { writeTenantAudit } from '../../firebase/partners'
import { OFFER_CONFIRMATION_TEXT, type OfferDraft } from '../../types/offers'

/**
 * Offers addressed to the signed-in (verified) email in the Partner resolved
 * from this hostname: loading, empty state, and one panel per offer. Used by
 * the standalone candidate page (/offer) and, for members, inside the
 * dashboard. firestore.rules + storage.rules enforce the same scope.
 *
 * `embedded`: inside the dashboard. The page around it has the <h1>, on
 * wide screens the document and its status sit side by side, and View shows
 * the PDF in the page.
 */
export default function MyOffers({ embedded = false }: { embedded?: boolean }) {
  const { firebaseUser, userProfile } = useAuthContext()
  const { partner } = usePartner()
  const b = useBranding()

  const [offers, setOffers] = useState<OfferDraft[] | null>(null)
  const [error, setError] = useState('')
  const email = (firebaseUser?.email ?? '').toLowerCase()
  const name = userProfile?.displayName || firebaseUser?.displayName || ''
  const Heading = embedded ? 'h2' : 'h1'

  const load = useCallback(async () => {
    if (!partner || !email) return
    setError('')
    try {
      setOffers(await listMyOffers(partner.id, email))
    } catch {
      setOffers([])
      setError('We couldn’t load your offer letter. Refresh the page to try again.')
    }
  }, [partner, email])

  useEffect(() => { load() }, [load])

  if (offers === null) {
    return (
      <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-10 flex justify-center">
        <Loader2 size={22} className="animate-spin text-brand-600" aria-label="Loading" />
      </div>
    )
  }

  if (offers.length === 0) {
    return (
      <section className="rounded-2xl bg-white ring-1 ring-slate-200 p-8 sm:p-10 text-center">
        <Heading className="text-xl font-bold text-slate-900">No offer letter to review</Heading>
        <p className="mt-2 text-slate-600 max-w-md mx-auto">
          There’s no offer letter for <span className="font-medium text-slate-900 break-all">{email}</span> at {b.name} yet.
          If you were expecting one, check that you signed in with the email address the offer was sent to.
        </p>
        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
      </section>
    )
  }

  return (
    <div className="space-y-10">
      {offers.map(o => (
        <OfferPanel key={o.id} offer={o} name={o.candidateName || name} email={email}
          partnerName={b.name} embedded={embedded}
          onConfirmed={load} />
      ))}
    </div>
  )
}

function OfferPanel({ offer, name, email, partnerName, embedded, onConfirmed }: {
  offer: OfferDraft
  name: string
  email: string
  partnerName: string
  embedded: boolean
  onConfirmed: () => Promise<void>
}) {
  const Heading = embedded ? 'h2' : 'h1'
  const { firebaseUser, userProfile } = useAuthContext()
  const [reviewed, setReviewed] = useState(false)
  const [busy, setBusy] = useState<'' | 'view' | 'download' | 'confirm'>('')
  const [error, setError] = useState('')

  // In the dashboard the PDF opens in the page when the browser has a built-in
  // viewer; otherwise (e.g. Android Chrome) it opens in a new tab as before.
  const inline = embedded && navigator.pdfViewerEnabled === true
  const [previewUrl, setPreviewUrl] = useState('')
  useEffect(() => { setPreviewUrl('') }, [offer.file.path])   // a new revision needs a fresh download
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])
  // Wide screens: keep the status / confirm card in view beside the open PDF.
  const side = embedded ? 'lg:col-span-2 lg:sticky lg:top-20' : ''

  async function run(kind: 'view' | 'download', fn: () => Promise<void>) {
    setBusy(kind); setError('')
    try { await fn() } catch (e) { setError(offerFileErrorMessage(e)) }
    finally { setBusy('') }
  }

  function view() {
    if (!inline) return run('view', () => openOfferPdf(offer))
    if (previewUrl) return setPreviewUrl('')
    return run('view', async () => setPreviewUrl(URL.createObjectURL(await fetchOfferPdf(offer))))
  }

  async function confirm() {
    if (!firebaseUser || !reviewed) return
    setBusy('confirm'); setError('')
    try {
      await confirmOffer(offer, firebaseUser.uid)
      await writeTenantAudit({
        uid: firebaseUser.uid, userEmail: email, action: 'offer_confirmed',
        partnerId: '', targetType: 'offerDrafts', targetId: offer.id,
        details: 'Candidate confirmed the draft offer letter',
        metadata: { partner: offer.partnerId, revision: offer.version },
      }).catch(() => {})
      await onConfirmed()
    } catch {
      setError('Your confirmation wasn’t saved. The offer may have been updated — refresh the page and review it again.')
    } finally {
      setBusy('')
    }
  }

  return (
    // The lg:col-span-* classes only take effect in the embedded grid.
    <section aria-labelledby={`offer-${offer.id}`}
      className={embedded ? 'grid grid-cols-1 gap-5 lg:grid-cols-5 lg:items-start' : 'space-y-5'}>
      <div className="lg:col-span-5 rounded-2xl bg-white ring-1 ring-slate-200 px-5 sm:px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
        <div className="min-w-0 flex-1">
          <Heading id={`offer-${offer.id}`} className="text-2xl font-bold tracking-tight text-slate-900">Draft offer letter</Heading>
          <p className="mt-1 text-slate-600 break-words">
            {name && <span className="font-medium text-slate-900">{name}</span>}
            {name && <br className="sm:hidden" />}
            <span className={name ? 'sm:ml-2 text-slate-500' : ''}>{email}</span>
          </p>
        </div>
        <div className="self-start sm:self-center"><OfferStatusBadge status={offer.status} /></div>
      </div>

      <div className="lg:col-span-3 space-y-5">
        <OfferDocumentCard offer={offer}>
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={view} disabled={busy !== ''} aria-expanded={inline ? !!previewUrl : undefined}
              className="btn-primary justify-center inline-flex items-center gap-2 px-5 py-2.5 disabled:opacity-60">
              {busy === 'view' ? <Loader2 size={16} className="animate-spin" /> : previewUrl ? <EyeOff size={16} /> : <Eye size={16} />}
              {previewUrl ? 'Hide document' : 'View document'}
            </button>
            <button onClick={() => run('download', () => downloadOfferPdf(offer))} disabled={busy !== ''}
              className="btn-secondary justify-center inline-flex items-center gap-2 px-5 py-2.5 disabled:opacity-60">
              {busy === 'download' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Download
            </button>
          </div>
        </OfferDocumentCard>
        {previewUrl && <OfferPdfViewer offer={offer} url={previewUrl} onClose={() => setPreviewUrl('')} />}
      </div>

      {offer.status === 'In Review' ? (
        <div className={`${side} rounded-2xl bg-white ring-1 ring-slate-200 p-5 sm:p-6 space-y-5`}>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)}
              className="mt-0.5 h-5 w-5 flex-shrink-0 rounded border-slate-300 accent-brand-600" />
            <span className="text-slate-700 leading-relaxed">{OFFER_CONFIRMATION_TEXT}</span>
          </label>
          <button onClick={confirm} disabled={!reviewed || busy !== ''}
            className="w-full sm:w-auto inline-flex justify-center items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white
              hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500
              disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {busy === 'confirm' ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
            Confirm offer letter
          </button>
          <p className="text-xs text-slate-500">
            Confirming tells {partnerName} the draft is correct. It is not a signature.
          </p>
        </div>
      ) : (
        <div className={`${side} rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 p-5 sm:p-6 flex items-start gap-3`}>
          <CheckCircle2 size={22} className="text-emerald-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-emerald-900">Status: Confirmed</p>
            <p className="text-sm text-emerald-800 mt-0.5">
              Thank you{userProfile?.displayName ? `, ${userProfile.displayName.split(' ')[0]}` : ''}. {partnerName} will be in touch about next steps.
            </p>
          </div>
        </div>
      )}

      {error && (
        <p className="lg:col-span-5 flex items-start gap-2 text-sm text-red-700"><AlertCircle size={16} className="flex-shrink-0 mt-0.5" />{error}</p>
      )}
    </section>
  )
}
