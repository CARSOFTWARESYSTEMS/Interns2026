import { useEffect, useState } from 'react'
import { Handshake, Plus } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import SectionCard from '../../components/ui/SectionCard'
import StatusBadge from '../../components/ui/StatusBadge'
import { useAuthContext } from '../../contexts/AuthContext'
import { getAllOffers, createOffer, updateOfferStatus, getAllCandidates } from '../../firebase/people'
import { SEED_OFFERS, SEED_CANDIDATES } from '../../data/peopleSeed'
import type { PeopleOffer, PeopleCandidate, EmploymentType, OfferStatus } from '../../types/people'
import { EMPLOYMENT_TYPE_LABELS } from '../../types/people'

const OFFER_STATUSES: OfferStatus[] = ['Draft', 'Sent', 'Accepted', 'Declined', 'Withdrawn']

export default function Offers() {
  const { uid } = useAuthContext()
  const [offers, setOffers]         = useState<PeopleOffer[]>([])
  const [candidates, setCandidates] = useState<PeopleCandidate[]>([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [saving, setSaving]         = useState(false)
  const [form, setForm] = useState({
    candidateId: '', employmentType: 'intern' as EmploymentType, role: '', department: '', proposedStartDate: '',
  })

  useEffect(() => {
    Promise.all([getAllOffers(), getAllCandidates()]).then(([o, c]) => {
      setOffers(o.length ? o : SEED_OFFERS)
      setCandidates(c.length ? c : SEED_CANDIDATES)
      setLoading(false)
    })
  }, [])

  async function handleCreate() {
    if (!form.candidateId || !uid) return
    setSaving(true)
    const offer: Omit<PeopleOffer, 'id' | 'partnerId' | 'organisationId' | 'createdAt' | 'updatedAt' | 'status' | 'createdBy'> = {
      candidateId: form.candidateId, employmentType: form.employmentType, role: form.role,
      department: form.department, proposedStartDate: form.proposedStartDate,
      offerStatus: 'Draft', sentAt: '', respondedAt: '', notes: '',
    }
    const id = await createOffer(offer, uid)
    setOffers(prev => [{ ...offer, id, partnerId: '', organisationId: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: uid, status: 'Draft' }, ...prev])
    setForm({ candidateId: '', employmentType: 'intern', role: '', department: '', proposedStartDate: '' })
    setShowForm(false)
    setSaving(false)
  }

  async function handleStatus(id: string, offerStatus: OfferStatus) {
    if (!uid) return
    await updateOfferStatus(id, offerStatus, uid)
    setOffers(prev => prev.map(o => o.id === id ? { ...o, offerStatus } : o))
  }

  function candidateName(id: string) {
    return candidates.find(c => c.id === id)?.name ?? id
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Offers"
        subtitle="Offer letters for interns, employees and contractors"
        icon={<Handshake size={18}/>}
        actions={
          <button onClick={() => setShowForm(s => !s)} className="btn-primary flex items-center gap-1.5">
            <Plus size={14}/> New Offer
          </button>
        }
      />

      {showForm && (
        <SectionCard title="New Offer" icon={<Plus size={14}/>}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:border-brand-400"
              value={form.candidateId} onChange={e => setForm(p => ({ ...p, candidateId: e.target.value }))}>
              <option value="">Select candidate…</option>
              {candidates.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:border-brand-400"
              value={form.employmentType} onChange={e => setForm(p => ({ ...p, employmentType: e.target.value as EmploymentType }))}>
              {(['intern', 'employee', 'contractor'] as EmploymentType[]).map(t => <option key={t} value={t}>{EMPLOYMENT_TYPE_LABELS[t]}</option>)}
            </select>
            <input className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-brand-400"
              placeholder="Role" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} />
            <input className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-brand-400"
              placeholder="Department" value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} />
            <input type="date" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-brand-400"
              value={form.proposedStartDate} onChange={e => setForm(p => ({ ...p, proposedStartDate: e.target.value }))} />
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setShowForm(false)} className="btn-ghost text-sm px-4 py-2">Cancel</button>
            <button onClick={handleCreate} disabled={saving || !form.candidateId} className="btn-primary text-sm px-5 py-2">
              {saving ? 'Creating…' : 'Create Offer'}
            </button>
          </div>
        </SectionCard>
      )}

      <SectionCard title={`Offers (${offers.length})`} icon={<Handshake size={14}/>}>
        {loading ? (
          <p className="text-sm text-slate-400 text-center py-8">Loading…</p>
        ) : offers.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No offers yet.</p>
        ) : (
          <div className="space-y-2">
            {offers.map(o => (
              <div key={o.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-slate-800">{candidateName(o.candidateId)}</p>
                    <StatusBadge status={o.offerStatus} size="xs" />
                  </div>
                  <p className="text-xs text-slate-500">{o.role} · {o.department} · {EMPLOYMENT_TYPE_LABELS[o.employmentType]}{o.proposedStartDate && ` · starts ${o.proposedStartDate}`}</p>
                </div>
                <select
                  value={o.offerStatus}
                  onChange={e => handleStatus(o.id, e.target.value as OfferStatus)}
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-brand-400"
                >
                  {OFFER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
