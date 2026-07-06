import { useEffect, useMemo, useState } from 'react'
import { Users, GraduationCap, Building2, HardHat, ChevronDown, ChevronUp } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import SectionCard from '../../components/ui/SectionCard'
import StatusBadge from '../../components/ui/StatusBadge'
import { useAuthContext } from '../../contexts/AuthContext'
import { PEOPLE_ROLE_ACCESS } from '../../types/auth'
import {
  getAllPeopleProfiles, getReviewsForPerson, getLeaveRequestsForPerson, getCultureSignalsForPerson,
} from '../../firebase/people'
import { SEED_PEOPLE_PROFILES } from '../../data/peopleSeed'
import type { PeopleProfile, PeopleOneOnOneReview, PeopleLeaveRequest, PeopleCultureSignal, EmploymentType } from '../../types/people'
import { EMPLOYMENT_TYPE_LABELS, PERSON_STATUS_LABELS } from '../../types/people'

const TYPE_ICON: Record<EmploymentType, typeof GraduationCap> = {
  intern: GraduationCap, employee: Building2, contractor: HardHat,
}

export default function Profiles() {
  const { role, userProfile } = useAuthContext()
  const [profiles, setProfiles] = useState<PeopleProfile[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<'' | EmploymentType>('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [detail, setDetail] = useState<{ reviews: PeopleOneOnOneReview[]; leave: PeopleLeaveRequest[]; culture: PeopleCultureSignal[] } | null>(null)

  const isSelfScoped = role ? PEOPLE_ROLE_ACCESS[role] === 'self' : false

  useEffect(() => {
    getAllPeopleProfiles().then(p => { setProfiles(p.length ? p : SEED_PEOPLE_PROFILES); setLoading(false) })
  }, [])

  const visible = useMemo(() => {
    let list = profiles
    if (isSelfScoped && userProfile) {
      list = list.filter(p => p.email === userProfile.email)
    }
    if (filter) list = list.filter(p => p.employmentType === filter)
    return list
  }, [profiles, filter, isSelfScoped, userProfile])

  async function toggleExpand(p: PeopleProfile) {
    if (expanded === p.id) { setExpanded(null); setDetail(null); return }
    setExpanded(p.id)
    const [reviews, leave, culture] = await Promise.all([
      getReviewsForPerson(p.id), getLeaveRequestsForPerson(p.id), getCultureSignalsForPerson(p.id),
    ])
    setDetail({ reviews, leave, culture })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="People"
        subtitle={isSelfScoped ? 'Your profile' : 'Interns, employees and contractors — lifecycle, skills, assignments'}
        icon={<Users size={18}/>}
      />

      {!isSelfScoped && (
        <div className="flex gap-2">
          {(['', 'intern', 'employee', 'contractor'] as const).map(t => (
            <button
              key={t || 'all'}
              onClick={() => setFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${filter === t ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            >
              {t ? EMPLOYMENT_TYPE_LABELS[t] : 'All'}
            </button>
          ))}
        </div>
      )}

      <SectionCard title={`People (${visible.length})`} icon={<Users size={14}/>}>
        {loading ? (
          <p className="text-sm text-slate-400 text-center py-8">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No profiles found.</p>
        ) : (
          <div className="space-y-2">
            {visible.map(p => {
              const Icon = TYPE_ICON[p.employmentType]
              const isOpen = expanded === p.id
              return (
                <div key={p.id} className="rounded-xl border border-slate-100 bg-slate-50 overflow-hidden">
                  <button onClick={() => toggleExpand(p)} className="w-full flex items-center gap-4 p-4 text-left">
                    <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 flex-shrink-0">
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-slate-800">{p.displayName}</p>
                        <StatusBadge status={PERSON_STATUS_LABELS[p.personStatus]} size="xs" />
                      </div>
                      <p className="text-xs text-slate-500">{p.role} · {p.department} · {EMPLOYMENT_TYPE_LABELS[p.employmentType]}</p>
                    </div>
                    {isOpen ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronDown size={16} className="text-slate-400"/>}
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 border-t border-slate-200 bg-white space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div><p className="data-label">Manager</p><p className="data-value">{p.managerId || '—'}</p></div>
                        <div><p className="data-label">Start Date</p><p className="data-value">{p.startDate || '—'}</p></div>
                        <div><p className="data-label">Email</p><p className="data-value truncate">{p.email}</p></div>
                        <div><p className="data-label">Status</p><p className="data-value">{PERSON_STATUS_LABELS[p.personStatus]}</p></div>
                      </div>

                      <div>
                        <p className="data-label mb-1">Skills</p>
                        <div className="flex flex-wrap gap-1.5">
                          {p.skills.length ? p.skills.map(s => (
                            <span key={s} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">{s}</span>
                          )) : <span className="text-xs text-slate-400">No skills recorded.</span>}
                        </div>
                      </div>

                      <div>
                        <p className="data-label mb-1">Assigned Work Packages</p>
                        <p className="text-xs text-slate-600">{p.assignedWorkPackages.length ? p.assignedWorkPackages.join(', ') : 'None assigned.'}</p>
                      </div>

                      {p.performanceNotes && (
                        <div>
                          <p className="data-label mb-1">Performance Notes</p>
                          <p className="text-xs text-slate-600">{p.performanceNotes}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <p className="data-label mb-1">1:1 Reviews ({detail?.reviews.length ?? 0})</p>
                          {detail?.reviews.length ? detail.reviews.map(r => (
                            <p key={r.id} className="text-xs text-slate-500">{r.month}</p>
                          )) : <p className="text-xs text-slate-400">No reviews yet.</p>}
                        </div>
                        <div>
                          <p className="data-label mb-1">Leave History ({detail?.leave.length ?? 0})</p>
                          {detail?.leave.length ? detail.leave.map(l => (
                            <p key={l.id} className="text-xs text-slate-500">{l.leaveType} · {l.leaveStatus}</p>
                          )) : <p className="text-xs text-slate-400">No leave records.</p>}
                        </div>
                        <div>
                          <p className="data-label mb-1">Culture Signals ({detail?.culture.length ?? 0})</p>
                          {detail?.culture.length ? detail.culture.map(c => (
                            <p key={c.id} className="text-xs text-slate-500">{c.signalType} · {c.cultureValue}</p>
                          )) : <p className="text-xs text-slate-400">No signals yet.</p>}
                        </div>
                      </div>

                      <div>
                        <p className="data-label mb-1">Policy Acknowledgements</p>
                        <p className="text-xs text-slate-600">{p.policyAcknowledgements.length} acknowledged.</p>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
