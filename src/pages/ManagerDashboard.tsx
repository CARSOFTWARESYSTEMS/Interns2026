import { Link } from 'react-router-dom'
import {
  Users, AlertTriangle, Clock, CheckCircle,
  BarChart3, FileText, Cpu, Battery,
} from 'lucide-react'
import type { Developer, Story, Simulator } from '../types'
import developersData  from '../data/developers.json'
import storiesData     from '../data/stories.json'
import simulatorsData  from '../data/simulators.json'
import { useAuthContext } from '../contexts/AuthContext'
import StatCard from '../components/ui/StatCard'
import SectionCard from '../components/ui/SectionCard'
import StatusBadge from '../components/ui/StatusBadge'
import ProgressBar from '../components/ui/ProgressBar'
import UserAvatar from '../components/ui/UserAvatar'

const developers = developersData as Developer[]
const stories    = storiesData    as Story[]
const simulators = simulatorsData as Simulator[]

export default function ManagerDashboard() {
  const { userProfile } = useAuthContext()

  const blocked  = stories.filter(s => s.status === 'Blocked')
  const pending  = stories.filter(s => s.qaStatus === 'Pending')
  const failedQA = stories.filter(s => s.qaStatus === 'Failed')
  const archPending = stories.filter(s => s.architectStatus === 'Pending' && s.qaStatus === 'Passed')
  const overallProgress = Math.round(stories.reduce((sum, s) => sum + s.overallProgress, 0) / stories.length)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="card p-5 flex items-center gap-4">
        <UserAvatar photoURL={userProfile?.photoURL} displayName={userProfile?.displayName} size="lg" className="ring-brand-200" />
        <div>
          <p className="text-[10px] font-bold text-brand-600 uppercase tracking-widest">Engineering Manager</p>
          <h1 className="text-xl font-bold text-slate-900">{userProfile?.displayName ?? 'Manager'}</h1>
          <p className="text-sm text-slate-500 mt-0.5">Team overview · Intern Program 2026</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard title="Team Progress" value={`${overallProgress}%`} icon={<BarChart3 size={16}/>} color="bg-brand-50 text-brand-700" subtitle="All stories" />
        <StatCard title="Blocked" value={blocked.length} icon={<AlertTriangle size={16}/>} color="bg-red-50 text-red-600" subtitle="Needs attention" />
        <StatCard title="QA Pending" value={pending.length} icon={<Clock size={16}/>} color="bg-amber-50 text-amber-700" />
        <StatCard title="QA Failed" value={failedQA.length} icon={<AlertTriangle size={16}/>} color="bg-red-50 text-red-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Team Progress */}
        <SectionCard title="Team Progress" icon={<Users size={14}/>} action={<Link to="/developers" className="text-xs text-brand-600 hover:underline">View all →</Link>}>
          <div className="space-y-3">
            {developers.map(dev => {
              const story = stories.find(s => s.id === dev.storyId)
              return (
                <div key={dev.id} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold flex-shrink-0">
                    {dev.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-slate-800 truncate">{dev.name}</p>
                      <span className="text-xs font-bold text-slate-700 ml-2">{story?.overallProgress ?? 0}%</span>
                    </div>
                    <ProgressBar value={story?.overallProgress ?? 0} height="h-1" />
                  </div>
                  <StatusBadge status={dev.status} size="xs" />
                </div>
              )
            })}
          </div>
        </SectionCard>

        {/* Blocked Stories */}
        <SectionCard title="Blocked Stories" icon={<AlertTriangle size={14}/>}>
          {blocked.length === 0 ? (
            <div className="flex items-center gap-2 p-4 bg-green-50 rounded-xl">
              <CheckCircle size={16} className="text-green-500" />
              <p className="text-sm text-green-700 font-semibold">No blocked stories</p>
            </div>
          ) : (
            <div className="space-y-2">
              {blocked.map(s => (
                <Link key={s.id} to={`/stories/${s.id}`} className="block p-3 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-red-800">{s.id}</span>
                    <StatusBadge status={s.status} size="xs" />
                  </div>
                  <p className="text-xs text-red-700 mt-0.5 truncate">{s.title}</p>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Pending Architect Reviews */}
        <SectionCard title="Pending Architect Review" icon={<FileText size={14}/>} action={<Link to="/architect" className="text-xs text-brand-600 hover:underline">View all →</Link>}>
          {archPending.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">None pending</p>
          ) : (
            <div className="space-y-2">
              {archPending.map(s => (
                <div key={s.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  <div>
                    <p className="text-xs font-bold text-slate-800">{s.id}</p>
                    <p className="text-[10px] text-slate-400 truncate">{s.title}</p>
                  </div>
                  <StatusBadge status={s.qaStatus} size="xs" />
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Intern Hours Overview */}
        <SectionCard title="Estimated Hours" icon={<Clock size={14}/>}>
          <div className="space-y-2">
            {developers.map(dev => (
              <div key={dev.id} className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-semibold truncate">{dev.name}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-slate-500">{dev.weeklyAvailability}</span>
                  <span className="text-[10px] bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded font-bold">{dev.expectedWeeklyHours}h/wk</span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Product Split */}
      <div className="grid grid-cols-2 gap-4">
        {['Battery Pack Aadhaar System', 'Battery Cybersecurity Platform'].map((product, idx) => {
          const ps = stories.filter(s => s.product === product)
          const avg = ps.length ? Math.round(ps.reduce((sum, s) => sum + s.overallProgress, 0) / ps.length) : 0
          return (
            <div key={product} className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                {idx === 0 ? <Battery size={14} className="text-brand-600"/> : <FileText size={14} className="text-purple-600"/>}
                <p className="text-xs font-bold text-slate-800 truncate">{product}</p>
              </div>
              <p className="text-2xl font-black text-slate-900 mb-1">{avg}%</p>
              <ProgressBar value={avg} color={idx === 0 ? 'bg-brand-500' : 'bg-purple-500'} />
              <p className="text-[10px] text-slate-400 mt-1">{ps.length} stories</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
