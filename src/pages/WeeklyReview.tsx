import { Calendar, CheckCircle, Clock } from 'lucide-react'
import { useWeeklyPlan } from '../data/DataProvider'
import PageHeader from '../components/ui/PageHeader'
import SectionCard from '../components/ui/SectionCard'

function getCurrentWeekIndex(length: number): number {
  const start = new Date('2026-07-01')
  const now = new Date()
  if (now < start) return 0
  const diffMs = now.getTime() - start.getTime()
  const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000))
  return Math.min(diffWeeks + 1, length - 1)
}

export default function WeeklyReview() {
  const weeklyPlan = useWeeklyPlan()
  const currentIdx = getCurrentWeekIndex(weeklyPlan.length)
  return (
    <div className="space-y-4">
      <PageHeader
        title="Weekly Review"
        subtitle={`Internship roadmap · July 1 – September 30, 2026 · ${weeklyPlan.length} phases`}
        icon={<Calendar size={18} />}
      />

      {/* Current Week Banner */}
      {weeklyPlan[currentIdx] && (
        <div className="card p-4 border-2 border-brand-500 bg-brand-50">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
            <span className="text-xs font-bold text-brand-600 uppercase tracking-widest">Current Phase</span>
          </div>
          <p className="text-lg font-bold text-slate-900">{weeklyPlan[currentIdx].title}</p>
          <p className="text-sm text-brand-700 font-medium">{weeklyPlan[currentIdx].dates}</p>
          <p className="text-xs text-slate-600 mt-1">{weeklyPlan[currentIdx].focus}</p>
        </div>
      )}

      {/* Progress Overview */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{currentIdx}</p>
          <p className="text-xs text-slate-500 mt-1">Weeks Completed</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-brand-700">{weeklyPlan.length - currentIdx}</p>
          <p className="text-xs text-slate-500 mt-1">Weeks Remaining</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-slate-700">{weeklyPlan.length}</p>
          <p className="text-xs text-slate-500 mt-1">Total Phases</p>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-3">
        {weeklyPlan.map((w, idx) => {
          const isPast = idx < currentIdx
          const isCurrent = idx === currentIdx
          const isFuture = idx > currentIdx

          return (
            <div key={w.week} className={`card p-4 transition-all ${
              isCurrent ? 'border-2 border-brand-500 shadow-md' :
              isPast ? 'opacity-70' : ''
            }`}>
              <div className="flex items-start gap-4">
                {/* Timeline dot */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  isCurrent ? 'bg-brand-600 text-white' :
                  isPast ? 'bg-green-100 text-green-600' :
                  'bg-slate-100 text-slate-400'
                }`}>
                  {isPast
                    ? <CheckCircle size={16} />
                    : isCurrent
                    ? <span className="text-xs font-bold">{idx + 1}</span>
                    : <Clock size={14} />
                  }
                </div>

                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          isCurrent ? 'bg-brand-600 text-white' :
                          isPast ? 'bg-green-100 text-green-700' :
                          'bg-slate-100 text-slate-500'
                        }`}>{w.week}</span>
                        {isCurrent && <span className="text-xs font-bold text-brand-600 animate-pulse">← NOW</span>}
                      </div>
                      <p className={`text-base font-bold mt-1 ${isCurrent ? 'text-brand-900' : isPast ? 'text-slate-700' : 'text-slate-500'}`}>
                        {w.title}
                      </p>
                      <p className={`text-xs mt-0.5 ${isCurrent ? 'text-brand-600 font-medium' : 'text-slate-400'}`}>{w.dates}</p>
                    </div>
                    <div className={`text-xs px-3 py-1.5 rounded-lg font-medium ${
                      isCurrent ? 'bg-brand-100 text-brand-800' :
                      isPast ? 'bg-green-50 text-green-700' :
                      'bg-slate-50 text-slate-400'
                    }`}>
                      {isPast ? 'Completed' : isCurrent ? 'In Progress' : 'Upcoming'}
                    </div>
                  </div>

                  <p className={`text-sm mt-2 ${isCurrent ? 'text-slate-700' : 'text-slate-500'}`}>
                    <span className="font-medium">Focus:</span> {w.focus}
                  </p>

                  <ul className={`mt-2 space-y-1 ${isFuture ? 'opacity-60' : ''}`}>
                    {w.activities.map((act, i) => (
                      <li key={i} className="flex gap-2 text-xs text-slate-600">
                        <span className={`mt-0.5 flex-shrink-0 ${isCurrent ? 'text-brand-400' : 'text-slate-300'}`}>›</span>
                        <span>{act}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Phase Legend */}
      <SectionCard title="Schedule Overview">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-xs font-bold text-slate-700 mb-1">Phase 1: Foundation</p>
            <p className="text-xs text-slate-500">Weeks 0–2 · July 1–15</p>
            <p className="text-xs text-slate-500">Onboarding, environment setup, POC</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-xs font-bold text-slate-700 mb-1">Phase 2: Development</p>
            <p className="text-xs text-slate-500">Weeks 3–9 · July 16 – Sept 3</p>
            <p className="text-xs text-slate-500">Core simulator + story development</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-xs font-bold text-slate-700 mb-1">Phase 3: QA & Demo</p>
            <p className="text-xs text-slate-500">Weeks 10–14 · Sept 4–30</p>
            <p className="text-xs text-slate-500">Testing, architect approval, final demo</p>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
