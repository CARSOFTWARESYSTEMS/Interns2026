import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, Download, CheckCircle2, LogOut, AlertCircle, LayoutDashboard, Loader2 } from 'lucide-react'
import { useAuthContext } from '../contexts/AuthContext'
import { usePartner, useBranding } from '../contexts/PartnerContext'
import PartnerBrandMark from '../components/ui/PartnerBrandMark'
import OfferDocumentCard from '../components/offers/OfferDocumentCard'
import OfferStatusBadge from '../components/offers/OfferStatusBadge'
import { listMyOffers, confirmOffer, openOfferPdf, downloadOfferPdf } from '../firebase/offers'
import { writeTenantAudit } from '../firebase/partners'
import { OFFER_CONFIRMATION_TEXT, type OfferDraft } from '../types/offers'

/**
 * Candidate view. Shows only offers addressed to the signed-in (verified)
 * email in the Partner resolved from this hostname. No membership needed.
 * firestore.rules + storage.rules enforce the same: another candidate's
 * offer id in the URL or a query returns nothing.
 */
export default function OfferReview() {
  const { firebaseUser, userProfile, signOut, accessState } = useAuthContext()
  const { partner } = usePartner()
  const b = useBranding()
  const navigate = useNavigate()

  const [offers, setOffers] = useState<OfferDraft[] | null>(null)
  const [error, setError] = useState('')
  const email = (firebaseUser?.email ?? '').toLowerCase()
  const name = userProfile?.displayName || firebaseUser?.displayName || ''
  const isMember = accessState === 'active' || accessState === 'platform-admin'

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

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Partner identity band */}
      <header className="bg-slate-900 text-white">
        <div className="mx-auto max-w-3xl px-5 sm:px-8 pt-6 pb-24 sm:pb-28">
          <div className="flex items-center justify-end gap-2 text-sm">
            {isMember && (
              <Link to="/" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-slate-300 hover:text-white hover:bg-white/10">
                <LayoutDashboard size={14} /> Dashboard
              </Link>
            )}
            <button onClick={handleSignOut} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-slate-300 hover:text-white hover:bg-white/10">
              <LogOut size={14} /> Sign out
            </button>
          </div>
          <div className="mt-6 flex flex-col items-center text-center gap-4">
            <PartnerBrandMark size="xl" />
            <div>
              <p className="text-xl sm:text-2xl font-bold tracking-tight break-words">{b.name}</p>
              {b.subtitle && <p className="mt-1 text-sm text-slate-400 break-words">{b.subtitle}</p>}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 sm:px-6 -mt-16 sm:-mt-20 pb-16">
        {offers === null ? (
          <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-10 flex justify-center">
            <Loader2 size={22} className="animate-spin text-brand-600" aria-label="Loading" />
          </div>
        ) : offers.length === 0 ? (
          <section className="rounded-2xl bg-white ring-1 ring-slate-200 p-8 sm:p-10 text-center">
            <h1 className="text-xl font-bold text-slate-900">No offer letter to review</h1>
            <p className="mt-2 text-slate-600 max-w-md mx-auto">
              There’s no offer letter for <span className="font-medium text-slate-900 break-all">{email}</span> at {b.name} yet.
              If you were expecting one, check that you signed in with the email address the offer was sent to.
            </p>
            {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
          </section>
        ) : (
          <div className="space-y-10">
            {offers.map(o => (
              <OfferPanel key={o.id} offer={o} name={o.candidateName || name} email={email}
                partnerName={b.name}
                onConfirmed={load} />
            ))}
          </div>
        )}

        {b.footer && (
          <p className="mt-12 text-center text-xs text-slate-400">{b.footer}{b.location ? `, ${b.location}` : ''}</p>
        )}
      </main>
    </div>
  )
}

function OfferPanel({ offer, name, email, partnerName, onConfirmed }: {
  offer: OfferDraft
  name: string
  email: string
  partnerName: string
  onConfirmed: () => Promise<void>
}) {
  const { firebaseUser, userProfile } = useAuthContext()
  const [reviewed, setReviewed] = useState(false)
  const [busy, setBusy] = useState<'' | 'view' | 'download' | 'confirm'>('')
  const [error, setError] = useState('')

  async function run(kind: 'view' | 'download', fn: () => Promise<void>) {
    setBusy(kind); setError('')
    try { await fn() } catch { setError('The document couldn’t be opened. Refresh the page and try again.') }
    finally { setBusy('') }
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
    <section aria-labelledby={`offer-${offer.id}`} className="space-y-5">
      <div className="rounded-2xl bg-white ring-1 ring-slate-200 px-5 sm:px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
        <div className="min-w-0 flex-1">
          <h1 id={`offer-${offer.id}`} className="text-2xl font-bold tracking-tight text-slate-900">Draft offer letter</h1>
          <p className="mt-1 text-slate-600 break-words">
            {name && <span className="font-medium text-slate-900">{name}</span>}
            {name && <br className="sm:hidden" />}
            <span className={name ? 'sm:ml-2 text-slate-500' : ''}>{email}</span>
          </p>
        </div>
        <div className="self-start sm:self-center"><OfferStatusBadge status={offer.status} /></div>
      </div>

      <OfferDocumentCard offer={offer}>
        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={() => run('view', () => openOfferPdf(offer))} disabled={busy !== ''}
            className="btn-primary justify-center inline-flex items-center gap-2 px-5 py-2.5 disabled:opacity-60">
            {busy === 'view' ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />} View document
          </button>
          <button onClick={() => run('download', () => downloadOfferPdf(offer))} disabled={busy !== ''}
            className="btn-secondary justify-center inline-flex items-center gap-2 px-5 py-2.5 disabled:opacity-60">
            {busy === 'download' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Download
          </button>
        </div>
      </OfferDocumentCard>

      {offer.status === 'In Review' ? (
        <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-5 sm:p-6 space-y-5">
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
        <div className="rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 p-5 sm:p-6 flex items-start gap-3">
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
        <p className="flex items-start gap-2 text-sm text-red-700"><AlertCircle size={16} className="flex-shrink-0 mt-0.5" />{error}</p>
      )}
    </section>
  )
}
