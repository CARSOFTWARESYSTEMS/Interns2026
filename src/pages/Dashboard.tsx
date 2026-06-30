import { Link } from 'react-router-dom'
import {
  Users, Cpu, FileText, BarChart3, AlertTriangle,
  CheckCircle, ShieldCheck, Award, Clock, Battery,
  ArrowRight, CalendarDays, Lock
} from 'lucide-react'
import type { Developer, Simulator, Story, WeeklyPlan } from '../types'
import developersData from '../data/developers.json'
import simulatorsData from '../data/simulators.json'
import storiesData from '../data/stories.json'
import weeklyPlanData from '../data/weeklyPlan.json'
import StatCard from '../components/ui/StatCard'
import SectionCard from '../components/ui/SectionCard'
import StatusBadge from '../components/ui/StatusBadge'
import ProgressBar from '../components/ui/ProgressBar'

const developers = developersData as Developer[]
const simulators = simulatorsData as Simulator[]
const stories = storiesData as Story[]
const weeklyPlan = weeklyPlanData as WeeklyPlan[]

const PHASES = [
  'Not Started','Research','Simulator Development','Simulator QA',
  'POC Development','Architecture Review','Product Development',
  'Unit Testing','Cross Testing','QA Review','Bug Fixing',
  'Security Review','Architect Review','Demo Ready','Approved',
]

const PHASE_COLORS = [
  'bg-slate-400','bg-purple-500','bg-blue-500','bg-cyan-500',
  'bg-teal-500','bg-sky-500','bg-brand-600','bg-violet-500',
  'bg-amber-500','bg-yellow-500','bg-orange-500',
  'bg-red-500','bg-blue-700','bg-emerald-500','bg-green-600',
]

export default function Dashboard() {
  const qaPassedCount = stories.filter(s => s.qaStatus === 'Passed').length
  const architectApprovedCount = stories.filter(s => s.architectStatus === 'Approved').length
  const demoReadyCount = stories.filter(s => (['Ready','Presented','Accepted'] as const).includes(s.demoStatus as 'Ready'|'Presented'|'Accepted')).length
  const blockedCount = [
    ...developers.filter(d => d.status === 'Blocked'),
    ...simulators.filter(s => s.status === 'Blocked'),
    ...stories.filter(s => s.status === 'Blocked'),
  ].length
  const overallProgress = Math.round(stories.reduce((sum, s) => sum + s.overallProgress, 0) / stories.length)

  const product1Stories = stories.filter(s => s.product === 'Battery Pack Aadhaar System')
  const product1Sims = simulators.filter(s => s.product === 'Battery Pack Aadhaar System')
  const product2Stories = stories.filter(s => s.product === 'Battery Cybersecurity Platform')
  const product2Sims = simulators.filter(s => s.product === 'Battery Cybersecurity Platform')

  const start = new Date('2026-07-01')
  const now = new Date()
  const daysDiff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  const currentWeekIdx = Math.max(0, Math.min(weeklyPlan.length - 1, Math.floor(daysDiff / 7)))
  const currentWeek = weeklyPlan[currentWeekIdx]

  return (
    <div className="space-y-5">
      {/* Title */}
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <Battery size={20} className="text-brand-600" />
          <h1 className="text-xl font-bold text-slate-900">Battery Trust Platform</h1>
          <span className="ml-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 uppercase tracking-wide">AS 9102 Beta</span>
        </div>
        <p className="text-sm text-slate-500">Engineering Command Center &middot; Intern Program 2026 &middot; EV.ENGINEER™</p>
      </div>

      {/* Primary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard title="Developers" value={10} icon={<Users size={18}/>} color="bg-brand-50 text-brand-700" />
        <StatCard title="Simulators" value={10} icon={<Cpu size={18}/>} color="bg-purple-50 text-purple-700" />
        <StatCard title="User Stories" value={10} icon={<FileText size={18}/>} color="bg-teal-50 text-teal-700" />
        <StatCard title="Overall Progress" value={`${overallProgress}%`} icon={<BarChart3 size={18}/>} color="bg-brand-50 text-brand-700" subtitle="Across all stories" />
        <StatCard title="Blocked" value={blockedCount} icon={<AlertTriangle size={18}/>} color="bg-red-50 text-red-600" subtitle="Items blocked" />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard title="QA Passed" value={qaPassedCount} icon={<CheckCircle size={16}/>} color="bg-green-50 text-green-700" />
        <StatCard title="Architect Approved" value={architectApprovedCount} icon={<ShieldCheck size={16}/>} color="bg-green-50 text-green-700" />
        <StatCard title="Demo Ready" value={demoReadyCount} icon={<Award size={16}/>} color="bg-amber-50 text-amber-700" />
        <StatCard title="Not Started" value={stories.filter(s => s.status === 'Not Started').length} icon={<Clock size={16}/>} color="bg-slate-50 text-slate-600" />
      </div>

      {/* Product Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center">
              <Battery size={16} className="text-brand-700" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-brand-700 uppercase tracking-widest">Product 1</p>
              <h3 className="text-sm font-bold text-slate-900">Battery Pack Aadhaar System</h3>
            </div>
            <div className="ml-auto"><StatusBadge status="Not Started" size="xs" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center mb-3">
            <div><p className="text-2xl font-bold text-slate-900">{product1Stories.length}</p><p className="text-[10px] text-slate-500">Stories</p></div>
            <div><p className="text-2xl font-bold text-slate-900">{product1Sims.length}</p><p className="text-[10px] text-slate-500">Simulators</p></div>
            <div><p className="text-2xl font-bold text-slate-900">0%</p><p className="text-[10px] text-slate-500">Progress</p></div>
          </div>
          <div className="mb-3"><ProgressBar value={0} /></div>
          <p className="text-xs text-slate-400 mb-3">Target: September Week 4, 2026</p>
          <Link to="/stories" className="btn-primary w-full justify-center">
            View Stories <ArrowRight size={12}/>
          </Link>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <Lock size={16} className="text-purple-700" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-purple-700 uppercase tracking-widest">Product 2</p>
              <h3 className="text-sm font-bold text-slate-900">Battery Cybersecurity Platform</h3>
            </div>
            <div className="ml-auto"><StatusBadge status="Not Started" size="xs" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center mb-3">
            <div><p className="text-2xl font-bold text-slate-900">{product2Stories.length}</p><p className="text-[10px] text-slate-500">Stories</p></div>
            <div><p className="text-2xl font-bold text-slate-900">{product2Sims.length}</p><p className="text-[10px] text-slate-500">Simulators</p></div>
            <div><p className="text-2xl font-bold text-slate-900">0%</p><p className="text-[10px] text-slate-500">Progress</p></div>
          </div>
          <div className="mb-3"><ProgressBar value={0} color="bg-purple-600" /></div>
          <p className="text-xs text-slate-400 mb-3">Target: September Week 4, 2026</p>
          <Link to="/stories" className="btn-primary w-full justify-center" style={{background:'#7c3aed'}}>
            View Stories <ArrowRight size={12}/>
          </Link>
        </div>
      </div>

      {/* Team + Week */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Team Overview" icon={<Users size={15}/>} action={<Link to="/developers" className="text-xs text-brand-600 hover:underline font-medium">View all →</Link>}>
          <div className="space-y-2.5">
            {developers.map(dev => (
              <div key={dev.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold flex-shrink-0">
                    {dev.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">{dev.name}</p>
                    <p className="text-[10px] text-slate-400">{dev.id} · {dev.storyId}</p>
                  </div>
                </div>
                <StatusBadge status={dev.status} size="xs" />
              </div>
            ))}
          </div>
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title="Current Week" icon={<CalendarDays size={15}/>} action={<Link to="/weekly-review" className="text-xs text-brand-600 hover:underline font-medium">Full schedule →</Link>}>
            {currentWeek && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-brand-100 text-brand-700">{currentWeek.week}</span>
                  <span className="text-xs text-slate-500">{currentWeek.dates}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-600 ml-auto">{currentWeek.focus}</span>
                </div>
                <p className="text-sm font-semibold text-slate-800 mb-2">{currentWeek.title}</p>
                <ul className="space-y-1">
                  {currentWeek.activities.slice(0, 4).map((act, i) => (
                    <li key={i} className="flex gap-2 text-xs text-slate-600">
                      <span className="text-brand-400 mt-0.5 flex-shrink-0">›</span>
                      <span>{act}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Phase Distribution" icon={<BarChart3 size={15}/>}>
            <div className="space-y-1.5">
              {PHASES.map((phase, idx) => {
                const total = stories.filter(s => s.status === phase).length + simulators.filter(s => s.status === phase).length
                return (
                  <div key={phase} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${PHASE_COLORS[idx]}`} />
                    <span className="text-xs text-slate-600 flex-1 truncate">{phase}</span>
                    <span className="text-xs font-bold text-slate-800 w-4 text-right">{total}</span>
                  </div>
                )
              })}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
