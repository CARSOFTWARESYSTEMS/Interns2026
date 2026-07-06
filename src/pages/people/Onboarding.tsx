import { useEffect, useState } from 'react'
import { UserCheck, CheckCircle2, Circle } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import SectionCard from '../../components/ui/SectionCard'
import ProgressBar from '../../components/ui/ProgressBar'
import { useAuthContext } from '../../contexts/AuthContext'
import { getAllOnboarding, updateOnboardingTask, getAllPeopleProfiles } from '../../firebase/people'
import { SEED_ONBOARDING, SEED_PEOPLE_PROFILES } from '../../data/peopleSeed'
import type { PeopleOnboarding, PeopleProfile } from '../../types/people'

export default function Onboarding() {
  const { uid } = useAuthContext()
  const [onboarding, setOnboarding] = useState<PeopleOnboarding[]>([])
  const [profiles, setProfiles]     = useState<PeopleProfile[]>([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    Promise.all([getAllOnboarding(), getAllPeopleProfiles()]).then(([ob, p]) => {
      setOnboarding(ob.length ? ob : SEED_ONBOARDING)
      setProfiles(p.length ? p : SEED_PEOPLE_PROFILES)
      setLoading(false)
    })
  }, [])

  async function toggleTask(entry: PeopleOnboarding, taskKey: string) {
    if (!uid) return
    const tasks = entry.tasks.map(t => t.key === taskKey
      ? { ...t, status: t.status === 'Completed' ? 'Pending' as const : 'Completed' as const, completedAt: t.status === 'Completed' ? '' : new Date().toISOString() }
      : t)
    await updateOnboardingTask(entry.id, tasks, uid)
    setOnboarding(prev => prev.map(o => o.id === entry.id ? { ...o, tasks, onboardingComplete: tasks.every(t => t.status === 'Completed') } : o))
  }

  function personName(personId: string) {
    return profiles.find(p => p.id === personId)?.displayName ?? personId
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Onboarding"
        subtitle="First-day checklist for new interns, employees and contractors"
        icon={<UserCheck size={18}/>}
      />

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-8">Loading…</p>
      ) : onboarding.length === 0 ? (
        <SectionCard><p className="text-sm text-slate-400 text-center py-8">No onboarding in progress.</p></SectionCard>
      ) : (
        <div className="space-y-4">
          {onboarding.map(o => {
            const done = o.tasks.filter(t => t.status === 'Completed').length
            const pct = Math.round((done / o.tasks.length) * 100)
            return (
              <SectionCard key={o.id} title={personName(o.personId)} subtitle={`Starts ${o.startDate}`} icon={<UserCheck size={14}/>}>
                <div className="mb-4">
                  <ProgressBar value={pct} showLabel color={o.onboardingComplete ? 'bg-green-600' : 'bg-brand-600'} />
                </div>
                <div className="space-y-1.5">
                  {o.tasks.map(t => (
                    <button
                      key={t.key}
                      onClick={() => toggleTask(o, t.key)}
                      className="w-full flex items-center gap-2.5 py-1.5 text-left group"
                    >
                      {t.status === 'Completed'
                        ? <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
                        : <Circle size={16} className="text-slate-300 flex-shrink-0 group-hover:text-slate-400" />}
                      <span className={`text-sm ${t.status === 'Completed' ? 'text-slate-500 line-through' : 'text-slate-700'}`}>{t.label}</span>
                    </button>
                  ))}
                </div>
              </SectionCard>
            )
          })}
        </div>
      )}
    </div>
  )
}
