import { Link } from 'react-router-dom'
import {
  ClipboardCheck, AlertTriangle, CheckCircle,
  XCircle, Clock, RefreshCw, FileText,
} from 'lucide-react'
import type { Story } from '../types'
import storiesData from '../data/stories.json'
import { useAuthContext } from '../contexts/AuthContext'
import StatCard from '../components/ui/StatCard'
import SectionCard from '../components/ui/SectionCard'
import StatusBadge from '../components/ui/StatusBadge'
import ProgressBar from '../components/ui/ProgressBar'
import UserAvatar from '../components/ui/UserAvatar'

const stories = storiesData as Story[]

export default function QADashboard() {
  const { userProfile } = useAuthContext()

  const pending   = stories.filter(s => s.qaStatus === 'Pending')
  const inReview  = stories.filter(s => s.qaStatus === 'In Review')
  const passed    = stories.filter(s => s.qaStatus === 'Passed')
  const failed    = stories.filter(s => s.qaStatus === 'Failed')
  const blocked   = stories.filter(s => s.qaStatus === 'Blocked')

  function QAGroup({ title, items, color, icon }: { title: string; items: Story[]; color: string; icon: React.ReactNode }) {
    if (items.length === 0) return null
    return (
      <div>
        <div className={`flex items-center gap-2 mb-2 px-1 ${color}`}>
          {icon}
          <span className="text-xs font-bold uppercase tracking-wide">{title}</span>
          <span className="ml-auto text-xs font-bold">{items.length}</span>
        </div>
        <div className="space-y-2">
          {items.map(s => (
            <Link key={s.id} to={`/stories/${s.id}`} className="block p-3 bg-slate-50 border border-slate-100 rounded-xl hover:bg-slate-100 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-800">{s.id}</span>
                <StatusBadge status={s.qaStatus} size="xs" />
              </div>
              <p className="text-xs text-slate-600 truncate">{s.title}</p>
              <div className="mt-1.5">
                <ProgressBar value={s.overallProgress} height="h-1" />
              </div>
              {s.qaReview.comments && (
                <p className="text-[10px] text-slate-400 mt-1 truncate">{s.qaReview.comments}</p>
              )}
            </Link>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="card p-5 flex items-center gap-4">
        <UserAvatar photoURL={userProfile?.photoURL} displayName={userProfile?.displayName} size="lg" className="ring-teal-200" />
        <div>
          <p className="text-[10px] font-bold text-teal-600 uppercase tracking-widest">QA Engineer</p>
          <h1 className="text-xl font-bold text-slate-900">{userProfile?.displayName ?? 'QA Engineer'}</h1>
          <p className="text-sm text-slate-500 mt-0.5">Quality assurance · Evidence verification</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        <StatCard title="Pending" value={pending.length}  icon={<Clock size={16}/>}      color="bg-slate-50 text-slate-700" />
        <StatCard title="In Review" value={inReview.length} icon={<RefreshCw size={16}/>}   color="bg-blue-50 text-blue-700" />
        <StatCard title="Passed"  value={passed.length}   icon={<CheckCircle size={16}/>} color="bg-green-50 text-green-700" />
        <StatCard title="Failed"  value={failed.length}   icon={<XCircle size={16}/>}     color="bg-red-50 text-red-600" />
        <StatCard title="Blocked" value={blocked.length}  icon={<AlertTriangle size={16}/>} color="bg-orange-50 text-orange-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="QA Queue" icon={<ClipboardCheck size={14}/>} action={<Link to="/qa" className="text-xs text-brand-600 hover:underline">Full list →</Link>}>
          <div className="space-y-4">
            <QAGroup title="In Review" items={inReview} color="text-brand-700" icon={<RefreshCw size={13}/>} />
            <QAGroup title="Pending" items={pending.slice(0, 3)} color="text-slate-600" icon={<Clock size={13}/>} />
            {pending.length === 0 && inReview.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">Queue is empty</p>
            )}
          </div>
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title="Failed QA" icon={<XCircle size={14}/>}>
            <div className="space-y-2">
              <QAGroup title="Failed" items={failed} color="text-red-700" icon={<XCircle size={13}/>} />
              {failed.length === 0 && (
                <div className="flex items-center gap-2 p-4 bg-green-50 rounded-xl">
                  <CheckCircle size={14} className="text-green-500" />
                  <p className="text-sm text-green-700 font-semibold">No failures</p>
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Passed Stories" icon={<CheckCircle size={14}/>}>
            {passed.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">None passed yet</p>
            ) : (
              <div className="space-y-1.5">
                {passed.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-2 bg-green-50 rounded-lg border border-green-100">
                    <span className="text-xs font-bold text-green-800">{s.id}</span>
                    <StatusBadge status={s.architectStatus} size="xs" />
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
