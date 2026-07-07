import { useEffect, useState } from 'react'
import { FileSignature, Plus, Download } from 'lucide-react'
import PageHeader from '../../../components/ui/PageHeader'
import SectionCard from '../../../components/ui/SectionCard'
import StatusBadge from '../../../components/ui/StatusBadge'
import { useAuthContext } from '../../../contexts/AuthContext'
import {
  getLettersByType, createDraftLetter, submitLetterForApproval,
  approveLetter, rejectLetter, markPdfGenerated, markLetterSent,
  markLetterDownloaded, markOfferAccepted, getDefaultLetterTemplate,
} from '../../../firebase/peopleLetters'
import { downloadLetterPdf, letterStoragePath } from '../../../utils/letterPdf'
import { SEED_GENERATED_LETTERS, SEED_LETTER_TEMPLATE } from '../../../data/peopleLettersSeed'
import { INTERN_DESIGNATIONS } from '../../../types/peopleLetters'
import type { PeopleGeneratedLetter, PeopleLetterTemplate } from '../../../types/peopleLetters'

const emptyForm = {
  candidateName: '', candidateEmail: '', designation: INTERN_DESIGNATIONS[0] as string,
  internshipStartDate: '', internshipEndDate: '', acceptanceDeadline: '',
  stipendEnabled: false, stipendAmount: 0,
}

export default function OfferLetter() {
  const { uid } = useAuthContext()
  const [letters, setLetters] = useState<PeopleGeneratedLetter[]>([])
  const [template, setTemplate] = useState<PeopleLetterTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function refresh() {
    const [l, t] = await Promise.all([getLettersByType('offer'), getDefaultLetterTemplate()])
    setLetters(l.length ? l : SEED_GENERATED_LETTERS.filter(x => x.letterType === 'offer'))
    setTemplate(t ?? SEED_LETTER_TEMPLATE)
    setLoading(false)
  }

  useEffect(() => { refresh() }, [])

  async function handleCreate() {
    if (!uid || !form.candidateName || !form.candidateEmail) return
    setSaving(true)
    await createDraftLetter({
      letterType: 'offer',
      templateId: template?.id ?? 'default',
      templateVersion: template?.version ?? '1.0',
      candidateId: '',
      candidateName: form.candidateName,
      candidateEmail: form.candidateEmail,
      designation: form.designation,
      internshipStartDate: form.internshipStartDate,
      internshipEndDate: form.internshipEndDate,
      acceptanceDeadline: form.acceptanceDeadline,
      stipendEnabled: form.stipendEnabled,
      stipendAmount: form.stipendAmount,
      linkedOfferLetterId: '',
    }, uid)
    setForm(emptyForm)
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
    await downloadLetterPdf(letter, template)
    await markPdfGenerated(letter.id, uid, letterStoragePath(letter))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Offer Letter"
        subtitle="Draft → Submit for Approval → Approve → Generate PDF → Send / Download → Accepted"
        icon={<FileSignature size={18} />}
        actions={
          <button onClick={() => setShowForm(s => !s)} className="btn-primary flex items-center gap-1.5">
            <Plus size={14} /> New Offer Letter
          </button>
        }
      />

      {showForm && (
        <SectionCard title="New Offer Letter" icon={<Plus size={14} />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Candidate Name</span>
              <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.candidateName}
                onChange={e => setForm(f => ({ ...f, candidateName: e.target.value }))} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Candidate Email</span>
              <input type="email" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.candidateEmail}
                onChange={e => setForm(f => ({ ...f, candidateEmail: e.target.value }))} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Designation</span>
              <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.designation}
                onChange={e => setForm(f => ({ ...f, designation: e.target.value }))}>
                {INTERN_DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Acceptance Deadline</span>
              <input type="date" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.acceptanceDeadline}
                onChange={e => setForm(f => ({ ...f, acceptanceDeadline: e.target.value }))} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Internship Start Date</span>
              <input type="date" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.internshipStartDate}
                onChange={e => setForm(f => ({ ...f, internshipStartDate: e.target.value }))} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Internship End Date</span>
              <input type="date" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.internshipEndDate}
                onChange={e => setForm(f => ({ ...f, internshipEndDate: e.target.value }))} />
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={form.stipendEnabled}
                onChange={e => setForm(f => ({ ...f, stipendEnabled: e.target.checked }))} />
              Stipend enabled
            </label>
            {form.stipendEnabled && (
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Stipend Amount (₹/month)</span>
                <input type="number" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.stipendAmount}
                  onChange={e => setForm(f => ({ ...f, stipendAmount: Number(e.target.value) }))} />
              </label>
            )}
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setShowForm(false)} className="btn-ghost text-sm px-4 py-2">Cancel</button>
            <button onClick={handleCreate} disabled={saving || !form.candidateName || !form.candidateEmail} className="btn-primary text-sm px-5 py-2">
              {saving ? 'Creating…' : 'Create Draft'}
            </button>
          </div>
        </SectionCard>
      )}

      <SectionCard title={`Offer Letters (${letters.length})`} icon={<FileSignature size={14} />}>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : letters.length === 0 ? (
          <p className="text-sm text-slate-500">No offer letters yet.</p>
        ) : (
          <div className="space-y-3">
            {letters.map(letter => (
              <div key={letter.id} className="border border-slate-100 rounded-lg p-3.5 flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{letter.candidateName} — {letter.designation}</p>
                  <p className="text-xs text-slate-500">{letter.documentId || 'Document ID pending'} · {letter.candidateEmail}</p>
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
                  {letter.status === 'Approved' && (
                    <button disabled={busyId === letter.id} onClick={() => withBusy(letter.id, () => handleGeneratePdf(letter))} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1">
                      <Download size={12} /> Generate PDF
                    </button>
                  )}
                  {letter.status === 'PDF Generated' && (
                    <>
                      <button disabled={busyId === letter.id} onClick={() => withBusy(letter.id, () => handleGeneratePdf(letter))} className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1">
                        <Download size={12} /> Re-download
                      </button>
                      <button disabled={busyId === letter.id} onClick={() => withBusy(letter.id, () => markLetterSent(letter.id, uid!))} className="btn-secondary text-xs px-3 py-1.5">
                        Mark Sent
                      </button>
                    </>
                  )}
                  {(letter.status === 'Sent' || letter.status === 'Downloaded') && (
                    <button disabled={busyId === letter.id} onClick={() => withBusy(letter.id, () => markOfferAccepted(letter.id, uid!))} className="btn-primary text-xs px-3 py-1.5">
                      Mark Accepted
                    </button>
                  )}
                  {letter.status === 'PDF Generated' && (
                    <button disabled={busyId === letter.id} onClick={() => withBusy(letter.id, () => markLetterDownloaded(letter.id, uid!))} className="btn-ghost text-xs px-3 py-1.5">
                      Mark Downloaded
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
