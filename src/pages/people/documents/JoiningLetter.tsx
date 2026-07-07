import { useEffect, useState } from 'react'
import { FileCheck2, Plus, Download } from 'lucide-react'
import PageHeader from '../../../components/ui/PageHeader'
import SectionCard from '../../../components/ui/SectionCard'
import StatusBadge from '../../../components/ui/StatusBadge'
import { useAuthContext } from '../../../contexts/AuthContext'
import {
  getLettersByType, createDraftLetter, submitLetterForApproval,
  approveLetter, rejectLetter, markPdfGenerated, getDefaultLetterTemplate,
} from '../../../firebase/peopleLetters'
import { downloadLetterPdf, letterStoragePath } from '../../../utils/letterPdf'
import { SEED_GENERATED_LETTERS, SEED_LETTER_TEMPLATE } from '../../../data/peopleLettersSeed'
import type { PeopleGeneratedLetter, PeopleLetterTemplate } from '../../../types/peopleLetters'

export default function JoiningLetter() {
  const { uid } = useAuthContext()
  const [offers, setOffers] = useState<PeopleGeneratedLetter[]>([])
  const [joinings, setJoinings] = useState<PeopleGeneratedLetter[]>([])
  const [template, setTemplate] = useState<PeopleLetterTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedOfferId, setSelectedOfferId] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  async function refresh() {
    const [allOffers, allJoinings, t] = await Promise.all([
      getLettersByType('offer'), getLettersByType('joining'), getDefaultLetterTemplate(),
    ])
    const seedOffers = SEED_GENERATED_LETTERS.filter(x => x.letterType === 'offer')
    const offerList = allOffers.length ? allOffers : seedOffers
    const joiningList = allJoinings.length ? allJoinings : []
    setOffers(offerList)
    setJoinings(joiningList)
    setTemplate(t ?? SEED_LETTER_TEMPLATE)
    setLoading(false)
  }

  useEffect(() => { refresh() }, [])

  // Only accepted offers without an existing joining letter are eligible.
  const eligibleOffers = offers.filter(o =>
    o.status === 'Accepted' && !joinings.some(j => j.linkedOfferLetterId === o.id)
  )

  async function handleCreate() {
    if (!uid || !selectedOfferId) return
    const offer = offers.find(o => o.id === selectedOfferId)
    if (!offer) return
    setSaving(true)
    await createDraftLetter({
      letterType: 'joining',
      templateId: template?.id ?? 'default',
      candidateId: offer.candidateId,
      candidateName: offer.candidateName,
      candidateEmail: offer.candidateEmail,
      designation: offer.designation,
      internshipStartDate: offer.internshipStartDate,
      internshipEndDate: offer.internshipEndDate,
      acceptanceDeadline: '',
      stipendEnabled: offer.stipendEnabled,
      stipendAmount: offer.stipendAmount,
      linkedOfferLetterId: offer.id,
    }, uid)
    setSelectedOfferId('')
    setShowForm(false)
    setSaving(false)
    await refresh()
  }

  async function withBusy(id: string, fn: () => Promise<void>) {
    setBusyId(id)
    try { await fn() } finally { setBusyId(null); await refresh() }
  }

  async function handleGeneratePdf(letter: PeopleGeneratedLetter) {
    if (!uid || !template) return
    downloadLetterPdf(letter, template)
    await markPdfGenerated(letter.id, uid, letterStoragePath(letter))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Joining Letter"
        subtitle="Only available once the candidate's offer letter is Accepted. Offer Accepted → Draft → Approved → PDF Generated"
        icon={<FileCheck2 size={18} />}
        actions={
          <button onClick={() => setShowForm(s => !s)} disabled={eligibleOffers.length === 0} className="btn-primary flex items-center gap-1.5 disabled:opacity-40">
            <Plus size={14} /> New Joining Letter
          </button>
        }
      />

      {showForm && (
        <SectionCard title="New Joining Letter" icon={<Plus size={14} />}>
          {eligibleOffers.length === 0 ? (
            <p className="text-sm text-slate-500">No candidates with an accepted offer are awaiting a joining letter.</p>
          ) : (
            <>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Accepted Offer</span>
                <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={selectedOfferId}
                  onChange={e => setSelectedOfferId(e.target.value)}>
                  <option value="">Select candidate…</option>
                  {eligibleOffers.map(o => (
                    <option key={o.id} value={o.id}>{o.candidateName} — {o.designation} ({o.documentId})</option>
                  ))}
                </select>
              </label>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setShowForm(false)} className="btn-ghost text-sm px-4 py-2">Cancel</button>
                <button onClick={handleCreate} disabled={saving || !selectedOfferId} className="btn-primary text-sm px-5 py-2">
                  {saving ? 'Creating…' : 'Create Draft'}
                </button>
              </div>
            </>
          )}
        </SectionCard>
      )}

      <SectionCard title={`Joining Letters (${joinings.length})`} icon={<FileCheck2 size={14} />}>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : joinings.length === 0 ? (
          <p className="text-sm text-slate-500">No joining letters yet.</p>
        ) : (
          <div className="space-y-3">
            {joinings.map(letter => (
              <div key={letter.id} className="border border-slate-100 rounded-lg p-3.5 flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{letter.candidateName} — {letter.designation}</p>
                  <p className="text-xs text-slate-500">{letter.documentId} · {letter.candidateEmail}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={letter.status} />
                  {letter.status === 'Draft' && (
                    <button disabled={busyId === letter.id} onClick={() => withBusy(letter.id, () => submitLetterForApproval(letter.id, uid!))} className="btn-secondary text-xs px-3 py-1.5">
                      Submit for Approval
                    </button>
                  )}
                  {letter.status === 'Submitted for Approval' && (
                    <>
                      <button disabled={busyId === letter.id} onClick={() => withBusy(letter.id, () => approveLetter(letter.id, uid!))} className="btn-primary text-xs px-3 py-1.5">
                        Approve
                      </button>
                      <button disabled={busyId === letter.id} onClick={() => withBusy(letter.id, () => rejectLetter(letter.id, uid!, 'Rejected by approver'))} className="btn-ghost text-xs px-3 py-1.5 text-red-600">
                        Reject
                      </button>
                    </>
                  )}
                  {(letter.status === 'Approved' || letter.status === 'PDF Generated') && (
                    <button disabled={busyId === letter.id} onClick={() => withBusy(letter.id, () => handleGeneratePdf(letter))} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1">
                      <Download size={12} /> {letter.status === 'PDF Generated' ? 'Re-download' : 'Generate PDF'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
