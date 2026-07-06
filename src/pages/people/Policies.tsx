import { useEffect, useState } from 'react'
import { BookOpen, Plus, CheckCircle } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import SectionCard from '../../components/ui/SectionCard'
import { useAuthContext } from '../../contexts/AuthContext'
import { getAllPolicies, createPolicy, getAllPolicyAcknowledgements } from '../../firebase/people'
import { SEED_POLICIES } from '../../data/peopleSeed'
import type { PeoplePolicy, PolicyType } from '../../types/people'
import { POLICY_TYPES } from '../../types/people'

export default function Policies() {
  const { uid, userProfile } = useAuthContext()
  const [policies, setPolicies]   = useState<PeoplePolicy[]>([])
  const [ackCount, setAckCount]   = useState<Record<string, number>>({})
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [form, setForm] = useState({ policyType: 'NDA' as PolicyType, effectiveDate: '', contentSummary: '' })

  useEffect(() => {
    Promise.all([getAllPolicies(), getAllPolicyAcknowledgements()]).then(([pol, acks]) => {
      setPolicies(pol.length ? pol : SEED_POLICIES)
      const counts: Record<string, number> = {}
      acks.forEach(a => { counts[a.policyId] = (counts[a.policyId] ?? 0) + 1 })
      setAckCount(counts)
      setLoading(false)
    })
  }, [])

  async function handleCreate() {
    if (!uid || !userProfile) return
    setSaving(true)
    const policy: Omit<PeoplePolicy, 'id' | 'partnerId' | 'organisationId' | 'createdAt' | 'updatedAt' | 'status' | 'createdBy'> = {
      policyType: form.policyType, version: 1, effectiveDate: form.effectiveDate || new Date().toISOString().slice(0, 10),
      owner: userProfile.displayName, contentSummary: form.contentSummary, acknowledgementRequired: true,
    }
    const id = await createPolicy(policy, uid)
    setPolicies(prev => [{ ...policy, id, partnerId: '', organisationId: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: uid, status: 'active' }, ...prev])
    setForm({ policyType: 'NDA', effectiveDate: '', contentSummary: '' })
    setShowForm(false)
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Policies"
        subtitle="NDA, Code of Conduct, Data Privacy, Attendance and more — versioned with acknowledgements"
        icon={<BookOpen size={18}/>}
        actions={
          <button onClick={() => setShowForm(s => !s)} className="btn-primary flex items-center gap-1.5">
            <Plus size={14}/> New Policy
          </button>
        }
      />

      {showForm && (
        <SectionCard title="New Policy" icon={<Plus size={14}/>}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:border-brand-400"
              value={form.policyType} onChange={e => setForm(p => ({ ...p, policyType: e.target.value as PolicyType }))}>
              {POLICY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="date" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-brand-400"
              value={form.effectiveDate} onChange={e => setForm(p => ({ ...p, effectiveDate: e.target.value }))} />
            <div className="sm:col-span-3">
              <textarea rows={2} placeholder="Content summary" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-brand-400"
                value={form.contentSummary} onChange={e => setForm(p => ({ ...p, contentSummary: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setShowForm(false)} className="btn-ghost text-sm px-4 py-2">Cancel</button>
            <button onClick={handleCreate} disabled={saving} className="btn-primary text-sm px-5 py-2">
              {saving ? 'Creating…' : 'Create Policy'}
            </button>
          </div>
        </SectionCard>
      )}

      <SectionCard title={`Policies (${policies.length})`} icon={<BookOpen size={14}/>}>
        {loading ? (
          <p className="text-sm text-slate-400 text-center py-8">Loading…</p>
        ) : policies.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No policies published yet.</p>
        ) : (
          <div className="space-y-2">
            {policies.map(p => (
              <div key={p.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{p.policyType} <span className="text-xs text-slate-400 font-normal">v{p.version}</span></p>
                    <p className="text-xs text-slate-500">Effective {p.effectiveDate} · Owner {p.owner}</p>
                  </div>
                  {p.acknowledgementRequired && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                      <CheckCircle size={11}/> {ackCount[p.id] ?? 0} acknowledged
                    </span>
                  )}
                </div>
                {p.contentSummary && <p className="text-xs text-slate-600 mt-2">{p.contentSummary}</p>}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
