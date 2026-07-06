import { useEffect, useState } from 'react'
import { MessageCircle, Plus } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import SectionCard from '../../components/ui/SectionCard'
import { useAuthContext } from '../../contexts/AuthContext'
import { PEOPLE_ROLE_ACCESS } from '../../types/auth'
import { getAllReviews, createOneOnOneReview, getAllPeopleProfiles } from '../../firebase/people'
import { SEED_REVIEWS, SEED_PEOPLE_PROFILES } from '../../data/peopleSeed'
import type { PeopleOneOnOneReview, PeopleProfile } from '../../types/people'
import { emptyAskiScore } from '../../types/people'

const emptyForm = {
  personId: '', month: new Date().toISOString().slice(0, 7),
  whatWentWell: '', whatDidNotGoWell: '', blockers: '', learningProgress: '',
  engineeringProgress: '', behaviourFeedback: '', managerFeedback: '', employeeFeedback: '',
  nextMonthGoals: '', resultGoals: '', overallNotes: '',
}

export default function Reviews() {
  const { uid, role, userProfile } = useAuthContext()
  const [reviews, setReviews]   = useState<PeopleOneOnOneReview[]>([])
  const [profiles, setProfiles] = useState<PeopleProfile[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [form, setForm] = useState(emptyForm)

  const isSelfScoped = role ? PEOPLE_ROLE_ACCESS[role] === 'self' : false

  useEffect(() => {
    Promise.all([getAllReviews(), getAllPeopleProfiles()]).then(([r, p]) => {
      setReviews(r.length ? r : SEED_REVIEWS)
      setProfiles(p.length ? p : SEED_PEOPLE_PROFILES)
      setLoading(false)
    })
  }, [])

  const visible = isSelfScoped && userProfile
    ? reviews.filter(r => profiles.find(p => p.id === r.personId)?.email === userProfile.email)
    : reviews

  async function handleCreate() {
    if (!form.personId || !uid) return
    setSaving(true)
    const review: Omit<PeopleOneOnOneReview, 'id' | 'partnerId' | 'organisationId' | 'createdAt' | 'updatedAt' | 'status' | 'createdBy'> = {
      personId: form.personId, managerId: uid, month: form.month,
      whatWentWell: form.whatWentWell, whatDidNotGoWell: form.whatDidNotGoWell, blockers: form.blockers,
      learningProgress: form.learningProgress, engineeringProgress: form.engineeringProgress,
      behaviourFeedback: form.behaviourFeedback, managerFeedback: form.managerFeedback,
      employeeFeedback: form.employeeFeedback, nextMonthGoals: form.nextMonthGoals,
      resultGoals: form.resultGoals, askiGoals: emptyAskiScore(), overallNotes: form.overallNotes,
    }
    const id = await createOneOnOneReview(review, uid)
    setReviews(prev => [{ ...review, id, partnerId: '', organisationId: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: uid, status: 'submitted' }, ...prev])
    setForm(emptyForm)
    setShowForm(false)
    setSaving(false)
  }

  function personName(id: string) {
    return profiles.find(p => p.id === id)?.displayName ?? id
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="1:1 Reviews"
        subtitle="Monthly manager/employee reviews with A.S.K.I. goals"
        icon={<MessageCircle size={18}/>}
        actions={!isSelfScoped ? (
          <button onClick={() => setShowForm(s => !s)} className="btn-primary flex items-center gap-1.5">
            <Plus size={14}/> New Review
          </button>
        ) : undefined}
      />

      {showForm && (
        <SectionCard title="New 1:1 Review" icon={<Plus size={14}/>}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:border-brand-400"
              value={form.personId} onChange={e => setForm(p => ({ ...p, personId: e.target.value }))}>
              <option value="">Select person…</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
            </select>
            <input type="month" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-brand-400"
              value={form.month} onChange={e => setForm(p => ({ ...p, month: e.target.value }))} />
            {([
              ['whatWentWell', 'What went well'], ['whatDidNotGoWell', 'What did not go well'],
              ['blockers', 'Blockers'], ['learningProgress', 'Learning progress'],
              ['engineeringProgress', 'Engineering progress'], ['behaviourFeedback', 'Behaviour feedback'],
              ['managerFeedback', 'Manager feedback'], ['employeeFeedback', 'Employee feedback'],
              ['nextMonthGoals', 'Next month goals'], ['resultGoals', 'Result goals'],
            ] as const).map(([key, label]) => (
              <div key={key} className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
                <textarea rows={2} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-brand-400"
                  value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setShowForm(false)} className="btn-ghost text-sm px-4 py-2">Cancel</button>
            <button onClick={handleCreate} disabled={saving || !form.personId} className="btn-primary text-sm px-5 py-2">
              {saving ? 'Saving…' : 'Submit Review'}
            </button>
          </div>
        </SectionCard>
      )}

      <SectionCard title={`Reviews (${visible.length})`} icon={<MessageCircle size={14}/>}>
        {loading ? (
          <p className="text-sm text-slate-400 text-center py-8">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No reviews yet.</p>
        ) : (
          <div className="space-y-3">
            {visible.map(r => (
              <div key={r.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-slate-800">{personName(r.personId)}</p>
                  <span className="text-xs text-slate-400 font-semibold">{r.month}</span>
                </div>
                {r.whatWentWell && <p className="text-xs text-slate-600 mb-1"><strong>Went well:</strong> {r.whatWentWell}</p>}
                {r.nextMonthGoals && <p className="text-xs text-slate-600"><strong>Next goals:</strong> {r.nextMonthGoals}</p>}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
