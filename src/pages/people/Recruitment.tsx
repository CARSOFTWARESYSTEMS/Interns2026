import { useEffect, useState } from 'react'
import { Briefcase, Plus } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import SectionCard from '../../components/ui/SectionCard'
import StatusBadge from '../../components/ui/StatusBadge'
import { useAuthContext } from '../../contexts/AuthContext'
import { getAllJobOpenings, createJobOpening } from '../../firebase/people'
import { SEED_JOB_OPENINGS } from '../../data/peopleSeed'
import type { PeopleJobOpening, EmploymentType } from '../../types/people'
import { EMPLOYMENT_TYPE_LABELS } from '../../types/people'

const EMPLOYMENT_TYPES: EmploymentType[] = ['intern', 'employee', 'contractor']

export default function Recruitment() {
  const { uid } = useAuthContext()
  const [openings, setOpenings] = useState<PeopleJobOpening[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [form, setForm] = useState({
    title: '', department: '', employmentType: 'intern' as EmploymentType,
    openings: 1, description: '', location: '',
  })

  useEffect(() => {
    getAllJobOpenings().then(o => { setOpenings(o.length ? o : SEED_JOB_OPENINGS); setLoading(false) })
  }, [])

  async function handleCreate() {
    if (!form.title.trim() || !uid) return
    setSaving(true)
    const opening: Omit<PeopleJobOpening, 'id' | 'partnerId' | 'organisationId' | 'createdAt' | 'updatedAt' | 'status' | 'createdBy'> = {
      title: form.title.trim(), department: form.department.trim(), employmentType: form.employmentType,
      openings: form.openings, description: form.description, requirements: [], location: form.location,
      openingStatus: 'Open', hiringManagerId: uid,
    }
    const id = await createJobOpening(opening, uid)
    setOpenings(prev => [{ ...opening, id, partnerId: '', organisationId: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: uid, status: 'Open' }, ...prev])
    setForm({ title: '', department: '', employmentType: 'intern', openings: 1, description: '', location: '' })
    setShowForm(false)
    setSaving(false)
  }

  const open = openings.filter(o => o.openingStatus === 'Open')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recruitment"
        subtitle="Open roles across interns, employees and contractors"
        icon={<Briefcase size={18}/>}
        actions={
          <button onClick={() => setShowForm(s => !s)} className="btn-primary flex items-center gap-1.5">
            <Plus size={14}/> New Opening
          </button>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4 text-center">
          <p className="text-2xl font-black text-slate-700">{openings.length}</p>
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mt-0.5">Total Openings</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-black text-green-700">{open.length}</p>
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mt-0.5">Open</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-black text-slate-500">{openings.length - open.length}</p>
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mt-0.5">Closed / Filled</p>
        </div>
      </div>

      {showForm && (
        <SectionCard title="New Job Opening" icon={<Plus size={14}/>}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Title <span className="text-red-400">*</span></label>
              <input className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-brand-400"
                value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="EV Engineering Intern" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Department</label>
              <input className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-brand-400"
                value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} placeholder="Engineering" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Employment Type</label>
              <select className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:border-brand-400"
                value={form.employmentType} onChange={e => setForm(p => ({ ...p, employmentType: e.target.value as EmploymentType }))}>
                {EMPLOYMENT_TYPES.map(t => <option key={t} value={t}>{EMPLOYMENT_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Number of Openings</label>
              <input type="number" min={1} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-brand-400"
                value={form.openings} onChange={e => setForm(p => ({ ...p, openings: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Location</label>
              <input className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-brand-400"
                value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="Bangalore (Remote)" />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
              <textarea className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-brand-400" rows={2}
                value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setShowForm(false)} className="btn-ghost text-sm px-4 py-2">Cancel</button>
            <button onClick={handleCreate} disabled={saving || !form.title.trim()} className="btn-primary text-sm px-5 py-2">
              {saving ? 'Creating…' : 'Create Opening'}
            </button>
          </div>
        </SectionCard>
      )}

      <SectionCard title={`Job Openings (${openings.length})`} icon={<Briefcase size={14}/>}>
        {loading ? (
          <p className="text-sm text-slate-400 text-center py-8">Loading…</p>
        ) : openings.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No job openings yet.</p>
        ) : (
          <div className="space-y-2">
            {openings.map(o => (
              <div key={o.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-slate-800">{o.title}</p>
                    <StatusBadge status={o.openingStatus} size="xs" />
                  </div>
                  <p className="text-xs text-slate-500">{o.department} · {EMPLOYMENT_TYPE_LABELS[o.employmentType]} · {o.location}</p>
                </div>
                <p className="text-xs font-semibold text-slate-500 flex-shrink-0">{o.openings} opening{o.openings !== 1 ? 's' : ''}</p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
