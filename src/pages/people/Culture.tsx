import { useEffect, useState } from 'react'
import { Sparkles, Plus } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import SectionCard from '../../components/ui/SectionCard'
import StatusBadge from '../../components/ui/StatusBadge'
import { useAuthContext } from '../../contexts/AuthContext'
import { getAllCultureSignals, createCultureSignal, getAllPeopleProfiles } from '../../firebase/people'
import { SEED_CULTURE_SIGNALS, SEED_PEOPLE_PROFILES } from '../../data/peopleSeed'
import type { PeopleCultureSignal, PeopleProfile, CultureSignalType, CultureValue } from '../../types/people'
import { CULTURE_SIGNAL_TYPES, CULTURE_VALUES } from '../../types/people'

export default function Culture() {
  const { uid } = useAuthContext()
  const [signals, setSignals]   = useState<PeopleCultureSignal[]>([])
  const [profiles, setProfiles] = useState<PeopleProfile[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [form, setForm] = useState({
    personId: '', signalType: 'Recognition' as CultureSignalType, cultureValue: 'Integrity First' as CultureValue, note: '',
  })

  useEffect(() => {
    Promise.all([getAllCultureSignals(), getAllPeopleProfiles()]).then(([s, p]) => {
      setSignals(s.length ? s : SEED_CULTURE_SIGNALS)
      setProfiles(p.length ? p : SEED_PEOPLE_PROFILES)
      setLoading(false)
    })
  }, [])

  async function handleCreate() {
    if (!form.personId || !uid) return
    setSaving(true)
    const signal: Omit<PeopleCultureSignal, 'id' | 'partnerId' | 'organisationId' | 'createdAt' | 'updatedAt' | 'status' | 'createdBy'> = {
      personId: form.personId, signalType: form.signalType, cultureValue: form.cultureValue,
      note: form.note, raisedBy: uid, visibleToPerson: true,
    }
    const id = await createCultureSignal(signal, uid)
    setSignals(prev => [{ ...signal, id, partnerId: '', organisationId: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: uid, status: 'logged' }, ...prev])
    setForm({ personId: '', signalType: 'Recognition', cultureValue: 'Integrity First', note: '' })
    setShowForm(false)
    setSaving(false)
  }

  function personName(id: string) {
    return profiles.find(p => p.id === id)?.displayName ?? id
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Culture"
        subtitle="Recognition, concerns, feedback and policy-violation signals against team values"
        icon={<Sparkles size={18}/>}
        actions={
          <button onClick={() => setShowForm(s => !s)} className="btn-primary flex items-center gap-1.5">
            <Plus size={14}/> Raise Signal
          </button>
        }
      />

      {showForm && (
        <SectionCard title="Raise Culture Signal" icon={<Plus size={14}/>}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:border-brand-400"
              value={form.personId} onChange={e => setForm(p => ({ ...p, personId: e.target.value }))}>
              <option value="">Select person…</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
            </select>
            <select className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:border-brand-400"
              value={form.signalType} onChange={e => setForm(p => ({ ...p, signalType: e.target.value as CultureSignalType }))}>
              {CULTURE_SIGNAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:border-brand-400"
              value={form.cultureValue} onChange={e => setForm(p => ({ ...p, cultureValue: e.target.value as CultureValue }))}>
              {CULTURE_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <div className="sm:col-span-3">
              <textarea rows={2} placeholder="Note" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-brand-400"
                value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setShowForm(false)} className="btn-ghost text-sm px-4 py-2">Cancel</button>
            <button onClick={handleCreate} disabled={saving || !form.personId} className="btn-primary text-sm px-5 py-2">
              {saving ? 'Saving…' : 'Raise Signal'}
            </button>
          </div>
        </SectionCard>
      )}

      <SectionCard title={`Culture Signals (${signals.length})`} icon={<Sparkles size={14}/>}>
        {loading ? (
          <p className="text-sm text-slate-400 text-center py-8">Loading…</p>
        ) : signals.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No culture signals yet.</p>
        ) : (
          <div className="space-y-2">
            {signals.map(s => (
              <div key={s.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="text-sm font-bold text-slate-800">{personName(s.personId)}</p>
                  <StatusBadge status={s.signalType} size="xs" />
                  <span className="text-[10px] font-semibold text-slate-400">{s.cultureValue}</span>
                </div>
                {s.note && <p className="text-xs text-slate-600">{s.note}</p>}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
