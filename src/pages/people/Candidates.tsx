import { useEffect, useState } from 'react'
import { Users, Plus, ShieldCheck } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import SectionCard from '../../components/ui/SectionCard'
import StatusBadge from '../../components/ui/StatusBadge'
import { useAuthContext } from '../../contexts/AuthContext'
import { getAllCandidates, createCandidate, updateCandidateStage } from '../../firebase/people'
import { SEED_CANDIDATES } from '../../data/peopleSeed'
import type { PeopleCandidate, CandidateStage, EmploymentType } from '../../types/people'
import { CANDIDATE_STAGES, emptyAskiScore, askiAverage, EMPLOYMENT_TYPE_LABELS } from '../../types/people'

export default function Candidates() {
  const { uid } = useAuthContext()
  const [candidates, setCandidates] = useState<PeopleCandidate[]>([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [saving, setSaving]         = useState(false)
  const [form, setForm] = useState({ name: '', email: '', employmentType: 'intern' as EmploymentType, source: '' })

  useEffect(() => {
    getAllCandidates().then(c => { setCandidates(c.length ? c : SEED_CANDIDATES); setLoading(false) })
  }, [])

  async function handleCreate() {
    if (!form.name.trim() || !uid) return
    setSaving(true)
    const candidate: Omit<PeopleCandidate, 'id' | 'partnerId' | 'organisationId' | 'createdAt' | 'updatedAt' | 'status' | 'createdBy'> = {
      name: form.name.trim(), email: form.email.trim(), mobile: '', appliedForOpeningId: '',
      employmentType: form.employmentType, resumeLink: '', stage: 'Applied',
      askiScore: emptyAskiScore(), source: form.source, notes: '',
    }
    const id = await createCandidate(candidate, uid)
    setCandidates(prev => [{ ...candidate, id, partnerId: '', organisationId: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: uid, status: 'Applied' }, ...prev])
    setForm({ name: '', email: '', employmentType: 'intern', source: '' })
    setShowForm(false)
    setSaving(false)
  }

  async function handleStageChange(id: string, stage: CandidateStage) {
    if (!uid) return
    await updateCandidateStage(id, stage, uid)
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, stage } : c))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Candidates"
        subtitle="Applied → Screening → … → Joined pipeline, with A.S.K.I. scoring"
        icon={<Users size={18}/>}
        actions={
          <button onClick={() => setShowForm(s => !s)} className="btn-primary flex items-center gap-1.5">
            <Plus size={14}/> Add Candidate
          </button>
        }
      />

      {showForm && (
        <SectionCard title="Add Candidate" icon={<Plus size={14}/>}>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-brand-400"
              placeholder="Full name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            <input className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-brand-400"
              placeholder="Email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            <select className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:border-brand-400"
              value={form.employmentType} onChange={e => setForm(p => ({ ...p, employmentType: e.target.value as EmploymentType }))}>
              {(['intern', 'employee', 'contractor'] as EmploymentType[]).map(t => <option key={t} value={t}>{EMPLOYMENT_TYPE_LABELS[t]}</option>)}
            </select>
            <input className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-brand-400"
              placeholder="Source (e.g. Referral)" value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))} />
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setShowForm(false)} className="btn-ghost text-sm px-4 py-2">Cancel</button>
            <button onClick={handleCreate} disabled={saving || !form.name.trim()} className="btn-primary text-sm px-5 py-2">
              {saving ? 'Adding…' : 'Add Candidate'}
            </button>
          </div>
        </SectionCard>
      )}

      <SectionCard title={`Candidates (${candidates.length})`} icon={<Users size={14}/>}>
        {loading ? (
          <p className="text-sm text-slate-400 text-center py-8">Loading…</p>
        ) : candidates.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No candidates yet.</p>
        ) : (
          <div className="space-y-2">
            {candidates.map(c => (
              <div key={c.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-slate-800">{c.name}</p>
                      <StatusBadge status={c.stage} size="xs" />
                    </div>
                    <p className="text-xs text-slate-500">{c.email} · {EMPLOYMENT_TYPE_LABELS[c.employmentType]}{c.source && ` · ${c.source}`}</p>
                  </div>
                  <select
                    value={c.stage}
                    onChange={e => handleStageChange(c.id, e.target.value as CandidateStage)}
                    className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-brand-400"
                  >
                    {CANDIDATE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="mt-3 flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs">
                    <ShieldCheck size={12} className={c.askiScore.integrity >= 7 ? 'text-green-600' : 'text-amber-500'} />
                    <span className="font-semibold text-slate-600">Integrity: {c.askiScore.integrity}/10</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    A.S.K.I. avg: <span className="font-semibold text-slate-600">{askiAverage(c.askiScore)}/10</span>
                  </p>
                  <div className="flex gap-1 flex-wrap text-[10px] text-slate-400">
                    {(['attitude', 'skills', 'knowledge', 'communication', 'ownership', 'learningAbility'] as const).map(k => (
                      <span key={k} className="px-1.5 py-0.5 bg-white border border-slate-200 rounded">{k}: {c.askiScore[k]}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
