import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users, AlertTriangle, Clock, CheckCircle,
  BarChart3, FileText, Cpu, Battery, PlusSquare,
} from 'lucide-react'
import { useDevelopers, useStories, useSimulators } from '../data/DataProvider'
import { useAuthContext } from '../contexts/AuthContext'
import { getAllCapacities } from '../firebase/assignments'
import type { DeveloperCapacity } from '../types/assignments'
import StatCard from '../components/ui/StatCard'
import SectionCard from '../components/ui/SectionCard'
import StatusBadge from '../components/ui/StatusBadge'
import ProgressBar from '../components/ui/ProgressBar'
import UserAvatar from '../components/ui/UserAvatar'
import CapacityBar from '../components/assignments/CapacityBar'

export default function ManagerDashboard() {
  const developers = useDevelopers()
  const stories    = useStories()
  const simulators = useSimulators()
  const { userProfile } = useAuthContext()
  const [capacities, setCapacities] = useState<DeveloperCapacity[]>([])

  useEffect(() => {
    getAllCapacities().then(setCapacities).catch(() => {})
  }, [])

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

      {/* Product Split — 3 products */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { name: 'Battery Pack Aadhaar System',   label: 'Battery Aadhaar', color: 'bg-brand-500',   icon: <Battery size={14} className="text-brand-600"/> },
          { name: 'Battery Cybersecurity Platform', label: 'Cybersecurity',   color: 'bg-purple-500',  icon: <FileText size={14} className="text-purple-600"/> },
          { name: 'AS9102 FAI Reports Platform',    label: 'FAI AS9102',      color: 'bg-emerald-500', icon: <Cpu size={14} className="text-emerald-600"/> },
        ].map(({ name, label, color, icon }) => {
          const ps = stories.filter(s => s.product === name)
          const avg = ps.length ? Math.round(ps.reduce((sum, s) => sum + s.overallProgress, 0) / ps.length) : 0
          return (
            <div key={name} className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                {icon}
                <p className="text-xs font-bold text-slate-800 truncate">{label}</p>
              </div>
              <p className="text-2xl font-black text-slate-900 mb-1">{avg}%</p>
              <ProgressBar value={avg} color={color} />
              <p className="text-[10px] text-slate-400 mt-1">{ps.length} stories</p>
            </div>
          )
        })}
      </div>

      {/* M05 Capacity Overview */}
      {capacities.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-slate-500" />
              <p className="text-sm font-bold text-slate-700">Developer Capacity</p>
            </div>
            <Link to="/admin/capacity" className="text-xs text-brand-600 hover:underline">Manage →</Link>
          </div>
          <div className="space-y-3">
            {capacities.map(cap => (
              <div key={cap.developerId} className="flex items-center gap-4">
                <p className="text-xs font-semibold text-slate-700 w-32 truncate">{cap.developerName}</p>
                <div className="flex-1">
                  <CapacityBar capacity={cap} showLabel={false} />
                </div>
                <p className="text-[10px] text-slate-400 w-20 text-right flex-shrink-0">
                  {cap.currentAssignedHours}/{cap.weeklyCapacityHours}h
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <Link to="/admin/assignments/new" className="btn-primary text-xs gap-1.5">
              <PlusSquare size={12}/> New Assignment
            </Link>
            <div className="flex gap-4 text-[10px] text-slate-400">
              <span><span className="font-bold text-green-600">{capacities.filter(c => c.capacityPercent < 70).length}</span> Available</span>
              <span><span className="font-bold text-amber-600">{capacities.filter(c => c.capacityPercent >= 70 && c.capacityPercent < 90).length}</span> Busy</span>
              <span><span className="font-bold text-red-600">{capacities.filter(c => c.capacityPercent >= 90).length}</span> Full</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
