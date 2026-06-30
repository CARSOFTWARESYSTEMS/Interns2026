import { CheckCircle2, Circle, AlertCircle, Clock } from 'lucide-react'

export type PhaseStatus = 'Completed' | 'In Progress' | 'Not Started' | 'Blocked'

export interface TimelinePhase {
  id: string
  label: string
  status: PhaseStatus
  note?: string
}

interface TimelineProps {
  phases: TimelinePhase[]
}

const statusConfig: Record<PhaseStatus, { icon: React.ReactNode; line: string; dot: string; text: string }> = {
  'Completed':  { icon: <CheckCircle2 size={16}/>, line: 'bg-green-400', dot: 'bg-green-500 border-green-500 text-white', text: 'text-green-700' },
  'In Progress':{ icon: <Clock size={16}/>,        line: 'bg-brand-400', dot: 'bg-brand-600 border-brand-600 text-white', text: 'text-brand-700' },
  'Blocked':    { icon: <AlertCircle size={16}/>,  line: 'bg-red-300',   dot: 'bg-red-500 border-red-500 text-white',   text: 'text-red-700'   },
  'Not Started':{ icon: <Circle size={16}/>,       line: 'bg-slate-200', dot: 'bg-white border-slate-300 text-slate-400', text: 'text-slate-400' },
}

export default function Timeline({ phases }: TimelineProps) {
  return (
    <div className="relative">
      {phases.map((phase, i) => {
        const cfg = statusConfig[phase.status]
        const isLast = i === phases.length - 1
        return (
          <div key={phase.id} className="flex gap-4">
            {/* Dot + vertical line */}
            <div className="flex flex-col items-center flex-shrink-0 w-8">
              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${cfg.dot}`}>
                {cfg.icon}
              </div>
              {!isLast && <div className={`w-0.5 flex-1 min-h-4 my-1 ${cfg.line}`} />}
            </div>
            {/* Content */}
            <div className={`pb-5 ${isLast ? '' : ''}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-sm font-bold ${cfg.text}`}>{phase.label}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  phase.status === 'Completed'  ? 'bg-green-50 text-green-700 border-green-200' :
                  phase.status === 'In Progress'? 'bg-brand-50 text-brand-700 border-brand-200' :
                  phase.status === 'Blocked'    ? 'bg-red-50 text-red-700 border-red-200' :
                  'bg-slate-50 text-slate-400 border-slate-200'
                }`}>{phase.status}</span>
              </div>
              {phase.note && (
                <p className="text-xs text-slate-500 mt-0.5">{phase.note}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
