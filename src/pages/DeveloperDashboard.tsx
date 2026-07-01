import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText, Cpu, ClipboardCheck, Award, Calendar,
  FolderOpen, ArrowRight, User, AlertTriangle, CheckCircle,
  Bell, ThumbsUp, ThumbsDown, Loader2,
} from 'lucide-react'
import { useDevelopers, useSimulators, useStories, useWeeklyPlan } from '../data/DataProvider'
import { useAuthContext } from '../contexts/AuthContext'
import { getAssignmentsForDeveloper, acceptAssignment, declineAssignment } from '../firebase/assignments'
import type { M05Assignment } from '../types/assignments'
import StatusBadge from '../components/ui/StatusBadge'
import ProgressBar from '../components/ui/ProgressBar'
import SectionCard from '../components/ui/SectionCard'
import StatCard from '../components/ui/StatCard'
import UserAvatar from '../components/ui/UserAvatar'
import ProfileCompletion from '../components/ui/ProfileCompletion'
import { calcProfileCompletion } from '../types/auth'

export default function DeveloperDashboard() {
  const developers = useDevelopers()
  const simulators = useSimulators()
  const stories    = useStories()
  const weeklyPlan = useWeeklyPlan()
  const { userProfile, uid } = useAuthContext()

  const [invitations, setInvitations]     = useState<M05Assignment[]>([])
  const [actioning, setActioning]         = useState<string | null>(null)

  useEffect(() => {
    if (!uid) return
    getAssignmentsForDeveloper(uid).then(all => {
      setInvitations(all.filter(a => a.status === 'Assigned'))
    }).catch(() => {})
  }, [uid])

  async function handleAccept(a: M05Assignment) {
    if (!uid || !userProfile) return
    setActioning(a.id)
    await acceptAssignment(a.id, uid, userProfile.displayName, userProfile.email ?? '')
    setInvitations(prev => prev.filter(x => x.id !== a.id))
    setActioning(null)
  }

  async function handleDecline(a: M05Assignment) {
    if (!uid || !userProfile) return
    setActioning(a.id)
    await declineAssignment(a.id, uid, userProfile.displayName, userProfile.email ?? '', 'Personal reason')
    setInvitations(prev => prev.filter(x => x.id !== a.id))
    setActioning(null)
  }

  // Try to match by email to find the developer record for this user
  const myDev = developers.find(d => d.email === userProfile?.email) ?? developers[0]
  const myStory = myDev ? stories.find(s => s.id === myDev.storyId) : null
  const mySim   = myDev ? simulators.find(s => s.id === myDev.simulatorId) : null

  const completion = userProfile ? calcProfileCompletion(userProfile) : 0

  const start = new Date('2026-07-01')
  const now = new Date()
  const daysDiff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  const weekIdx = Math.max(0, Math.min(weeklyPlan.length - 1, Math.floor(daysDiff / 7)))
  const currentWeek = weeklyPlan[weekIdx]

  return (
    <div className="space-y-5">
      {/* Welcome */}
      <div className="card p-5 flex items-center gap-4">
        <UserAvatar photoURL={userProfile?.photoURL} displayName={userProfile?.displayName} size="lg" className="ring-brand-200" />
        <div className="flex-1">
          <p className="text-[10px] font-bold text-brand-600 uppercase tracking-widest">Welcome back</p>
          <h1 className="text-xl font-bold text-slate-900">{userProfile?.displayName ?? 'Developer'}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{userProfile?.college ?? ''} · {myDev?.id ?? ''}</p>
          <div className="mt-2 max-w-xs">
            <ProfileCompletion percent={completion} />
          </div>
        </div>
        {completion < 100 && (
          <Link to="/profile" className="btn-secondary text-xs flex items-center gap-1.5">
            <User size={12} /> Complete Profile
          </Link>
        )}
      </div>

      {/* Assignment Invitations */}
      {invitations.length > 0 && (
        <div className="card p-4 border-l-4 border-brand-500 space-y-3">
          <div className="flex items-center gap-2">
            <Bell size={15} className="text-brand-500" />
            <p className="text-sm font-bold text-slate-800">
              {invitations.length} Assignment Invitation{invitations.length !== 1 ? 's' : ''} Pending
            </p>
          </div>
          {invitations.map(a => (
            <div key={a.id} className="flex items-start justify-between gap-4 bg-slate-50 rounded-xl px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800">{a.storyTitle || a.simulatorTitle || a.assignmentId}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{a.productName} · {a.workPackageId} · {a.estimatedHours}h estimated</p>
                {a.managerNotes && <p className="text-[10px] text-slate-400 mt-1 italic line-clamp-1">{a.managerNotes}</p>}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => handleAccept(a)}
                  disabled={actioning === a.id}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-100 text-green-700 text-xs font-bold hover:bg-green-200 transition-colors disabled:opacity-50"
                >
                  {actioning === a.id ? <Loader2 size={11} className="animate-spin" /> : <ThumbsUp size={11} />}
                  Accept
                </button>
                <button
                  onClick={() => handleDecline(a)}
                  disabled={actioning === a.id}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-100 text-red-700 text-xs font-bold hover:bg-red-200 transition-colors disabled:opacity-50"
                >
                  {actioning === a.id ? <Loader2 size={11} className="animate-spin" /> : <ThumbsDown size={11} />}
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* My stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard title="My Story" value={myStory?.id ?? '—'} icon={<FileText size={16}/>} color="bg-brand-50 text-brand-700" subtitle={myStory?.title?.slice(0, 20) + '…'} />
        <StatCard title="My Simulator" value={mySim?.id ?? '—'} icon={<Cpu size={16}/>} color="bg-purple-50 text-purple-700" subtitle="Python simulator" />
        <StatCard title="QA Status" value={myDev?.qaStatus ?? '—'} icon={<ClipboardCheck size={16}/>} color="bg-teal-50 text-teal-700" />
        <StatCard title="Demo Status" value={myDev?.demoStatus ?? '—'} icon={<Award size={16}/>} color="bg-amber-50 text-amber-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* My Story */}
        <SectionCard title="My User Story" icon={<FileText size={14}/>} action={myStory && <Link to={`/stories/${myStory.id}`} className="text-xs text-brand-600 hover:underline">View details →</Link>}>
          {myStory ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-bold text-slate-800">{myStory.id}</p>
                  <p className="text-sm text-slate-700 mt-0.5">{myStory.title}</p>
                </div>
                <StatusBadge status={myStory.status} size="xs" />
              </div>
              <ProgressBar value={myStory.overallProgress} />
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">
                  <p className="text-xs font-bold text-slate-800">{myStory.qaStatus}</p>
                  <p className="text-[10px] text-slate-400">QA</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">
                  <p className="text-xs font-bold text-slate-800">{myStory.architectStatus}</p>
                  <p className="text-[10px] text-slate-400">Architect</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">
                  <p className="text-xs font-bold text-slate-800">{myStory.overallProgress}%</p>
                  <p className="text-[10px] text-slate-400">Progress</p>
                </div>
              </div>
              <div className="mt-3 space-y-1">
                {myStory.acceptanceCriteria.slice(0, 3).map((ac, i) => (
                  <div key={i} className="flex gap-2 text-xs text-slate-600">
                    <CheckCircle size={12} className="text-slate-300 flex-shrink-0 mt-0.5" />
                    <span className="truncate">{ac}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <p className="text-sm text-slate-400">No story assigned yet.</p>}
        </SectionCard>

        {/* My Simulator */}
        <SectionCard title="My Simulator" icon={<Cpu size={14}/>} action={mySim && <Link to={`/simulators/${mySim.id}`} className="text-xs text-brand-600 hover:underline">View details →</Link>}>
          {mySim ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-bold text-slate-800">{mySim.id}</p>
                  <p className="text-sm text-slate-700 mt-0.5">{mySim.name}</p>
                </div>
                <StatusBadge status={mySim.status} size="xs" />
              </div>
              <p className="text-xs text-slate-500 line-clamp-2">{mySim.purpose}</p>
              <div className="mt-3 space-y-1.5">
                {[
                  { label: 'GitHub', value: mySim.githubRepo },
                  { label: 'Streamlit', value: mySim.streamlitLink },
                  { label: 'Evidence', value: mySim.evidenceStatus },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-semibold">{label}</span>
                    <span className="text-slate-700 font-mono truncate max-w-[180px]">{value || '—'}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <p className="text-sm text-slate-400">No simulator assigned yet.</p>}
        </SectionCard>

        {/* Evidence quick view */}
        <SectionCard title="Evidence Status" icon={<FolderOpen size={14}/>} action={<Link to="/evidence" className="text-xs text-brand-600 hover:underline">View all →</Link>}>
          {myStory ? (
            <div className="space-y-1.5">
              {(Object.entries(myStory.evidence) as [string, string][]).filter(([k]) => k !== 'driveFolder').slice(0, 8).map(([key, val]) => (
                <div key={key} className="flex items-center gap-2 text-xs">
                  {val ? <CheckCircle size={12} className="text-green-500 flex-shrink-0" /> : <AlertTriangle size={12} className="text-amber-400 flex-shrink-0" />}
                  <span className="text-slate-600 capitalize flex-1">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                  <span className={`text-[10px] font-semibold ${val ? 'text-green-600' : 'text-amber-600'}`}>{val ? 'Submitted' : 'Missing'}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-slate-400">—</p>}
        </SectionCard>

        {/* Current week */}
        <SectionCard title="Current Week" icon={<Calendar size={14}/>} action={<Link to="/weekly" className="text-xs text-brand-600 hover:underline">Full schedule →</Link>}>
          {currentWeek ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-brand-100 text-brand-700">{currentWeek.week}</span>
                <span className="text-xs text-slate-500">{currentWeek.dates}</span>
              </div>
              <p className="text-sm font-semibold text-slate-800 mb-2">{currentWeek.title}</p>
              <ul className="space-y-1">
                {currentWeek.activities.slice(0, 5).map((act, i) => (
                  <li key={i} className="flex gap-2 text-xs text-slate-600">
                    <span className="text-brand-400 mt-0.5 flex-shrink-0">›</span>{act}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </SectionCard>
      </div>

      {myDev?.blockers && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-800">Active Blocker</p>
            <p className="text-xs text-red-600 mt-0.5">{myDev.blockers}</p>
          </div>
        </div>
      )}
    </div>
  )
}
