import { useEffect, useRef, useState } from 'react'
import { Upload, Eye, RefreshCw, Send, Link2, AlertCircle, Loader2, FileUp, Check } from 'lucide-react'
import { useAuthContext } from '../../contexts/AuthContext'
import { useBranding } from '../../contexts/PartnerContext'
import PartnerBrandMark from '../../components/ui/PartnerBrandMark'
import OfferStatusBadge from '../../components/offers/OfferStatusBadge'
import { formatDateTime, confirmedAtIso } from '../../components/offers/OfferDocumentCard'
import {
  listPartnerOffers, createOfferDraft, replaceOfferDraft, sendOfferForReview, openOfferPdf,
} from '../../firebase/offers'
import { writeTenantAudit } from '../../firebase/partners'
import { isLocalDevHost } from '../../tenant/hostname'
import { isPdf, isValidEmail, OFFER_MAX_BYTES, type OfferDraft, type OfferDraftStatus } from '../../types/offers'
import type { AuditAction } from '../../types/auth'

const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100'

/**
 * Admin / HR view. Everything here is scoped to the Partner in view (the
 * tenant session); firestore.rules and storage.rules enforce the same.
 */
export default function OfferDrafts() {
  const { userProfile, activePartner } = useAuthContext()
  const b = useBranding()
  const [offers, setOffers] = useState<OfferDraft[] | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    listPartnerOffers().then(setOffers).catch(() => { setOffers([]); setError('Offer letters couldn’t be loaded for this Partner.') })
  }, [])

  const counts = (s: OfferDraftStatus) => offers?.filter(o => o.status === s).length ?? 0
  const partnerName = activePartner?.displayName ?? b.name
  const candidateLink = (() => {
    const dom = activePartner?.defaultDomain
    return isLocalDevHost(window.location.hostname) || !dom ? `${window.location.origin}/offer` : `https://${dom}/offer`
  })()

  async function audit(action: AuditAction, o: OfferDraft, details: string) {
    if (!userProfile) return
    await writeTenantAudit({
      uid: userProfile.uid, userEmail: userProfile.email, action, partnerId: o.partnerId,
      targetType: 'offerDrafts', targetId: o.id, details, metadata: { revision: o.version },
    }).catch(() => {})
  }

  function upsert(o: OfferDraft) {
    setOffers(prev => [o, ...(prev ?? []).filter(x => x.id !== o.id)])
  }

  return (
    <div className="space-y-6">
      {/* Partner band */}
      <section className="rounded-2xl bg-slate-900 text-white px-5 sm:px-8 py-6 sm:py-7 flex flex-col md:flex-row md:items-center gap-5 md:gap-8">
        <div className="flex items-center gap-4 min-w-0">
          <PartnerBrandMark size="lg" />
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Offer letter review</h1>
            <p className="text-sm text-slate-400 break-words">{partnerName}</p>
          </div>
        </div>
        <dl className="md:ml-auto grid grid-cols-3 gap-px rounded-xl overflow-hidden bg-white/10 text-center">
          {(['Draft', 'In Review', 'Confirmed'] as const).map(s => (
            <div key={s} className="bg-slate-900 px-4 sm:px-6 py-2.5">
              <dd className="text-xl font-bold tabular-nums">{offers ? counts(s) : '–'}</dd>
              <dt className="text-xs text-slate-400 whitespace-nowrap">{s}</dt>
            </div>
          ))}
        </dl>
      </section>

      {(error || notice) && (
        <p className={`flex items-start gap-2 rounded-lg px-4 py-3 text-sm ring-1 ${error ? 'bg-red-50 text-red-700 ring-red-200' : 'bg-emerald-50 text-emerald-800 ring-emerald-200'}`}>
          {error ? <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /> : <Check size={16} className="flex-shrink-0 mt-0.5" />}
          <span className="min-w-0 break-words">{error || notice}</span>
        </p>
      )}

      <UploadDraft
        onUploaded={o => { upsert(o); setError(''); setNotice(`Draft uploaded for ${o.viewerEmail}. Send it for review when it’s ready.`); audit('offer_uploaded', o, `Uploaded draft for ${o.viewerEmail}`) }}
        onError={e => { setNotice(''); setError(e) }}
      />

      {/* Offers */}
      <section className="rounded-2xl bg-white ring-1 ring-slate-200 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-5 sm:px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Draft offers</h2>
          <button
            onClick={() => { navigator.clipboard.writeText(candidateLink); setError(''); setNotice('Candidate link copied. Candidates sign in with the email the offer was sent to.') }}
            className="sm:ml-auto inline-flex items-center gap-1.5 self-start rounded-lg px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50">
            <Link2 size={14} /> Copy candidate link
          </button>
        </div>

        {offers === null ? (
          <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-brand-600" aria-label="Loading" /></div>
        ) : offers.length === 0 ? (
          <p className="px-6 py-12 text-center text-slate-500">No draft offers yet. Upload the first one above.</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden xl:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-6 py-2.5 font-medium">Candidate</th>
                  <th className="px-3 py-2.5 font-medium">Document</th>
                  <th className="px-3 py-2.5 font-medium">Uploaded</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Last updated</th>
                  <th className="px-6 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {offers.map(o => (
                  <tr key={o.id} className="align-top">
                    <td className="px-6 py-4 max-w-[260px]">
                      <p className="font-medium text-slate-900 truncate">{o.candidateName || '—'}</p>
                      <p className="text-slate-500 truncate" title={o.viewerEmail}>{o.viewerEmail}</p>
                    </td>
                    <td className="px-3 py-4 max-w-[220px]">
                      <p className="text-slate-800 break-words">{o.file.name}</p>
                      <p className="text-xs text-slate-500 tabular-nums">Revision {String(o.version).padStart(2, '0')}</p>
                    </td>
                    <td className="px-3 py-4 text-slate-600 tabular-nums whitespace-nowrap">{formatDateTime(o.file.uploadedAt)}</td>
                    <td className="px-3 py-4">
                      <OfferStatusBadge status={o.status} size="sm" />
                      {o.status === 'Draft' && <p className="mt-1 text-xs text-amber-700">Not visible to candidate yet</p>}
                      {o.status === 'Confirmed' && <p className="mt-1 text-xs text-emerald-700 tabular-nums">{formatDateTime(confirmedAtIso(o))}</p>}
                    </td>
                    <td className="px-3 py-4 text-slate-600 tabular-nums whitespace-nowrap">{formatDateTime(o.updatedAt)}</td>
                    <td className="px-6 py-4"><OfferActions offer={o} onChange={upsert} onError={setError} onNotice={setNotice} audit={audit} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            {/* Below xl (sidebar + table don't fit): stacked cards */}
            <ul className="xl:hidden divide-y divide-slate-100">
              {offers.map(o => (
                <li key={o.id} className="px-5 py-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 break-words">{o.candidateName || o.viewerEmail}</p>
                      {o.candidateName && <p className="text-sm text-slate-500 break-all">{o.viewerEmail}</p>}
                    </div>
                    <OfferStatusBadge status={o.status} size="sm" />
                  </div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                    <dt className="text-slate-500">Document</dt><dd className="text-slate-800 break-words">{o.file.name}</dd>
                    <dt className="text-slate-500">Uploaded</dt><dd className="text-slate-800 tabular-nums">{formatDateTime(o.file.uploadedAt)}</dd>
                    <dt className="text-slate-500">Last updated</dt><dd className="text-slate-800 tabular-nums">{formatDateTime(o.updatedAt)}</dd>
                    {o.status === 'Confirmed' && <>
                      <dt className="text-slate-500">Confirmed</dt><dd className="text-emerald-700 tabular-nums">{formatDateTime(confirmedAtIso(o))}</dd>
                    </>}
                  </dl>
                  {o.status === 'Draft' && <p className="text-xs text-amber-700">Not visible to the candidate until you send it for review.</p>}
                  <OfferActions offer={o} onChange={upsert} onError={setError} onNotice={setNotice} audit={audit} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  )
}

// ── Upload ──────────────────────────────────────────────────────────────────

function UploadDraft({ onUploaded, onError }: { onUploaded: (o: OfferDraft) => void; onError: (e: string) => void }) {
  const { userProfile } = useAuthContext()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const fileError = file && !isPdf(file) ? 'Choose a PDF file.' : file && file.size > OFFER_MAX_BYTES ? 'The PDF must be 10 MB or smaller.' : ''
  const emailError = email && !isValidEmail(email) ? 'Enter a valid email address.' : ''
  const ready = file && !fileError && email && !emailError && !busy

  async function submit() {
    if (!ready || !userProfile || !file) return
    setBusy(true)
    try {
      const o = await createOfferDraft({ file, viewerEmail: email, candidateName: name, actor: { uid: userProfile.uid, email: userProfile.email } })
      onUploaded(o)
      setEmail(''); setName(''); setFile(null)
      if (fileInput.current) fileInput.current.value = ''
    } catch (e) {
      onError((e as Error).message?.startsWith('Firebase') || !(e as Error).message
        ? 'The draft couldn’t be uploaded. Check that you have Admin or HR access for this Partner.'
        : (e as Error).message)
    } finally { setBusy(false) }
  }

  return (
    <section className="rounded-2xl bg-white ring-1 ring-slate-200 p-5 sm:p-6">
      <h2 className="font-semibold text-slate-900">Upload draft</h2>
      <p className="mt-1 text-sm text-slate-500">The candidate sees it only after you send it for review.</p>
      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block">
          <span className="block text-sm font-medium text-slate-700 mb-1.5">Candidate email</span>
          <input type="email" className={inputCls} value={email} onChange={e => setEmail(e.target.value)} placeholder="candidate@example.com" autoComplete="off" />
          {emailError && <span className="mt-1 block text-xs text-red-600">{emailError}</span>}
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-slate-700 mb-1.5">Candidate name <span className="font-normal text-slate-400">(optional)</span></span>
          <input className={inputCls} value={name} onChange={e => setName(e.target.value)} />
        </label>
        <label className="md:col-span-2 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 cursor-pointer hover:border-brand-400 focus-within:border-brand-400">
          <FileUp size={20} className="text-brand-600 flex-shrink-0" />
          <span className="min-w-0 flex-1 text-sm">
            <span className="block font-medium text-slate-800 break-words">{file ? file.name : 'Choose the draft offer letter (PDF, up to 10 MB)'}</span>
            {fileError && <span className="block text-xs text-red-600">{fileError}</span>}
          </span>
          <input ref={fileInput} type="file" accept="application/pdf,.pdf" className="sr-only"
            onChange={e => setFile(e.target.files?.[0] ?? null)} />
          <span className="text-sm font-medium text-brand-700">{file ? 'Change file' : 'Browse'}</span>
        </label>
      </div>
      <div className="mt-5 flex justify-end">
        <button onClick={submit} disabled={!ready}
          className="btn-primary inline-flex items-center justify-center gap-2 px-5 py-2.5 w-full sm:w-auto disabled:opacity-50">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Upload draft
        </button>
      </div>
    </section>
  )
}

// ── Row actions ─────────────────────────────────────────────────────────────

function OfferActions({ offer, onChange, onError, onNotice, audit }: {
  offer: OfferDraft
  onChange: (o: OfferDraft) => void
  onError: (e: string) => void
  onNotice: (n: string) => void
  audit: (action: AuditAction, o: OfferDraft, details: string) => Promise<void>
}) {
  const [busy, setBusy] = useState<'' | 'view' | 'replace' | 'send'>('')
  const replaceInput = useRef<HTMLInputElement>(null)
  const btn = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ring-inset disabled:opacity-50'

  async function act(kind: 'view' | 'replace' | 'send', fn: () => Promise<void>) {
    setBusy(kind); onError(''); onNotice('')
    try { await fn() } catch (e) { onError((e as Error).message?.startsWith('Firebase') ? 'That action was rejected.' : (e as Error).message || 'That action failed.') }
    finally { setBusy('') }
  }

  return (
    <div className="flex flex-wrap gap-2 xl:justify-end">
      <button className={`${btn} ring-slate-200 text-slate-700 hover:bg-slate-50`} disabled={busy !== ''}
        onClick={() => act('view', () => openOfferPdf(offer))}>
        {busy === 'view' ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />} View
      </button>

      {offer.status !== 'Confirmed' && (
        <>
          <button className={`${btn} ring-slate-200 text-slate-700 hover:bg-slate-50`} disabled={busy !== ''}
            onClick={() => replaceInput.current?.click()}>
            {busy === 'replace' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Replace
          </button>
          <input ref={replaceInput} type="file" accept="application/pdf,.pdf" className="sr-only" aria-label={`Replace draft for ${offer.viewerEmail}`}
            onChange={e => {
              const f = e.target.files?.[0]; e.target.value = ''
              if (f) act('replace', async () => {
                const o = await replaceOfferDraft(offer, f)
                onChange(o)
                onNotice(`Draft replaced (revision ${String(o.version).padStart(2, '0')}). Send it for review again when ready.`)
                await audit('offer_replaced', o, `Replaced draft, revision ${o.version}`)
              })
            }} />
        </>
      )}

      {offer.status === 'Draft' && (
        <button className={`${btn} ring-brand-600 bg-brand-600 text-white hover:bg-brand-700`} disabled={busy !== ''}
          onClick={() => act('send', async () => {
            const o = await sendOfferForReview(offer)
            onChange(o)
            onNotice(`Sent for review. ${o.viewerEmail} can now view and confirm it.`)
            await audit('offer_sent_for_review', o, `Sent for review to ${o.viewerEmail}`)
          })}>
          {busy === 'send' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send for review
        </button>
      )}
    </div>
  )
}
