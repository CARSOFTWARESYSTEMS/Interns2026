import { useEffect, useState } from 'react'
import { MessagesSquare, Plus } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import SectionCard from '../../components/ui/SectionCard'
import StatusBadge from '../../components/ui/StatusBadge'
import { useAuthContext } from '../../contexts/AuthContext'
import { getAllInterviews, createInterview, getAllCandidates, updateInterview } from '../../firebase/people'
import { SEED_INTERVIEWS, SEED_CANDIDATES } from '../../data/peopleSeed'
import type { PeopleInterview, PeopleCandidate, InterviewType, InterviewOutcome } from '../../types/people'
import { emptyAskiScore } from '../../types/people'

const INTERVIEW_TYPES: InterviewType[] = ['Technical', 'HR', 'Assignment Review', 'Final']
const OUTCOMES: InterviewOutcome[] = ['Pending', 'Passed', 'Failed', 'On Hold']

export default function Interviews() {
  const { uid } = useAuthContext()
  const [interviews, setInterviews] = useState<PeopleInterview[]>([])
  const [candidates, setCandidates] = useState<PeopleCandidate[]>([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [saving, setSaving]         = useState(false)
  const [form, setForm] = useState({ candidateId: '', interviewType: 'Technical' as InterviewType, scheduledAt: '' })

  useEffect(() => {
    Promise.all([getAllInterviews(), getAllCandidates()]).then(([iv, c]) => {
      setInterviews(iv.length ? iv : SEED_INTERVIEWS)
      setCandidates(c.length ? c : SEED_CANDIDATES)
      setLoading(false)
    })
  }, [])

  async function handleCreate() {
    if (!form.candidateId || !uid) return
    setSaving(true)
    const interview: Omit<PeopleInterview, 'id' | 'partnerId' | 'organisationId' | 'createdAt' | 'updatedAt' | 'status' | 'createdBy'> = {
      candidateId: form.candidateId, interviewType: form.interviewType,
      scheduledAt: form.scheduledAt || new Date().toISOString(), interviewerId: uid,
      outcome: 'Pending', askiScore: emptyAskiScore(), feedback: '',
    }
    const id = await createInterview(interview, uid)
    setInterviews(prev => [{ ...interview, id, partnerId: '', organisationId: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: uid, status: 'Pending' }, ...prev])
    setForm({ candidateId: '', interviewType: 'Technical', scheduledAt: '' })
    setShowForm(false)
    setSaving(false)
  }

  async function handleOutcome(id: string, outcome: InterviewOutcome) {
    await updateInterview(id, { outcome })
    setInterviews(prev => prev.map(i => i.id === id ? { ...i, outcome } : i))
  }

  function candidateName(id: string) {
    return candidates.find(c => c.id === id)?.name ?? id
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Interviews"
        subtitle="Technical, HR, assignment review and final interview scheduling"
        icon={<MessagesSquare size={18}/>}
        actions={
          <button onClick={() => setShowForm(s => !s)} className="btn-primary flex items-center gap-1.5">
            <Plus size={14}/> Schedule Interview
          </button>
        }
      />

      {showForm && (
        <SectionCard title="Schedule Interview" icon={<Plus size={14}/>}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:border-brand-400"
              value={form.candidateId} onChange={e => setForm(p => ({ ...p, candidateId: e.target.value }))}>
              <option value="">Select candidate…</option>
              {candidates.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:border-brand-400"
              value={form.interviewType} onChange={e => setForm(p => ({ ...p, interviewType: e.target.value as InterviewType }))}>
              {INTERVIEW_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="datetime-local" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-brand-400"
              value={form.scheduledAt} onChange={e => setForm(p => ({ ...p, scheduledAt: e.target.value }))} />
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setShowForm(false)} className="btn-ghost text-sm px-4 py-2">Cancel</button>
            <button onClick={handleCreate} disabled={saving || !form.candidateId} className="btn-primary text-sm px-5 py-2">
              {saving ? 'Scheduling…' : 'Schedule'}
            </button>
          </div>
        </SectionCard>
      )}

      <SectionCard title={`Interviews (${interviews.length})`} icon={<MessagesSquare size={14}/>}>
        {loading ? (
          <p className="text-sm text-slate-400 text-center py-8">Loading…</p>
        ) : interviews.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No interviews scheduled yet.</p>
        ) : (
          <div className="space-y-2">
            {interviews.map(iv => (
              <div key={iv.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-slate-800">{candidateName(iv.candidateId)}</p>
                    <StatusBadge status={iv.outcome} size="xs" />
                  </div>
                  <p className="text-xs text-slate-500">{iv.interviewType} · {new Date(iv.scheduledAt).toLocaleString()}</p>
                </div>
                <select
                  value={iv.outcome}
                  onChange={e => handleOutcome(iv.id, e.target.value as InterviewOutcome)}
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-brand-400"
                >
                  {OUTCOMES.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
