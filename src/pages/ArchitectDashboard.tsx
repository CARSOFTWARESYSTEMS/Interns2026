import { Link } from 'react-router-dom'
import {
  ShieldCheck, Clock, CheckCircle, XCircle,
  FileText, Cpu, AlertTriangle,
} from 'lucide-react'
import { useStories, useSimulators } from '../data/DataProvider'
import { useAuthContext } from '../contexts/AuthContext'
import StatCard from '../components/ui/StatCard'
import SectionCard from '../components/ui/SectionCard'
import StatusBadge from '../components/ui/StatusBadge'
import UserAvatar from '../components/ui/UserAvatar'

export default function ArchitectDashboard() {
  const stories    = useStories()
  const simulators = useSimulators()
  const { userProfile } = useAuthContext()

  const pendingReview  = stories.filter(s => s.architectStatus === 'Pending' && s.qaStatus === 'Passed')
  const inReview       = stories.filter(s => s.architectStatus === 'In Review')
  const approved       = stories.filter(s => s.architectStatus === 'Approved')
  const changesReq     = stories.filter(s => s.architectStatus === 'Changes Required')
  const simPending     = simulators.filter(s => s.architectApproval.status === 'Pending')

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="card p-5 flex items-center gap-4">
        <UserAvatar photoURL={userProfile?.photoURL} displayName={userProfile?.displayName} size="lg" className="ring-purple-200" />
        <div>
          <p className="text-[10px] font-bold text-purple-600 uppercase tracking-widest">Architect</p>
          <h1 className="text-xl font-bold text-slate-900">{userProfile?.displayName ?? 'Architect'}</h1>
          <p className="text-sm text-slate-500 mt-0.5">Architecture approvals · Evidence reviews</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard title="Approval Queue" value={pendingReview.length} icon={<Clock size={16}/>} color="bg-amber-50 text-amber-700" subtitle="QA passed, awaiting you" />
        <StatCard title="In Review" value={inReview.length} icon={<ShieldCheck size={16}/>} color="bg-brand-50 text-brand-700" />
        <StatCard title="Approved" value={approved.length} icon={<CheckCircle size={16}/>} color="bg-green-50 text-green-700" />
        <StatCard title="Changes Required" value={changesReq.length} icon={<XCircle size={16}/>} color="bg-orange-50 text-orange-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Approval Queue */}
        <SectionCard title="Approval Queue" icon={<Clock size={14}/>} action={<Link to="/architect" className="text-xs text-brand-600 hover:underline">Full list →</Link>}>
          {pendingReview.length === 0 ? (
            <div className="flex items-center gap-2 p-4 bg-green-50 rounded-xl">
              <CheckCircle size={16} className="text-green-500" />
              <p className="text-sm text-green-700 font-semibold">Queue is clear</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingReview.map(s => (
                <Link key={s.id} to={`/stories/${s.id}`} className="block p-3 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-amber-800">{s.id}</span>
                    <StatusBadge status={s.priority} size="xs" />
                  </div>
                  <p className="text-xs text-amber-700 truncate">{s.title}</p>
                  <p className="text-[10px] text-amber-500 mt-0.5">QA: {s.qaStatus} · Arch: {s.architectStatus}</p>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Stories in Review */}
        <SectionCard title="Stories In Review" icon={<FileText size={14}/>}>
          {inReview.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">None in review</p>
          ) : (
            <div className="space-y-2">
              {inReview.map(s => (
                <Link key={s.id} to={`/stories/${s.id}`} className="block p-3 bg-brand-50 border border-brand-100 rounded-xl hover:bg-brand-100 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-brand-800">{s.id}</span>
                    <StatusBadge status={s.architectStatus} size="xs" />
                  </div>
                  <p className="text-xs text-brand-700 truncate mt-0.5">{s.title}</p>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Changes Required */}
        <SectionCard title="Changes Required" icon={<AlertTriangle size={14}/>}>
          {changesReq.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">None pending changes</p>
          ) : (
            <div className="space-y-2">
              {changesReq.map(s => (
                <div key={s.id} className="p-3 bg-orange-50 border border-orange-200 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-orange-800">{s.id}</span>
                    <StatusBadge status={s.architectStatus} size="xs" />
                  </div>
                  <p className="text-xs text-orange-700 truncate mt-0.5">{s.title}</p>
                  <p className="text-[10px] text-orange-500 mt-0.5 truncate">{s.architectApproval.comments}</p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Simulator Reviews */}
        <SectionCard title="Simulator Approvals" icon={<Cpu size={14}/>}>
          {simPending.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">All simulators cleared</p>
          ) : (
            <div className="space-y-2">
              {simPending.map(s => (
                <Link key={s.id} to={`/simulators/${s.id}`} className="block p-3 bg-slate-50 border border-slate-100 rounded-xl hover:bg-slate-100 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">{s.id}</span>
                    <StatusBadge status={s.architectApproval.status} size="xs" />
                  </div>
                  <p className="text-xs text-slate-600 truncate mt-0.5">{s.name}</p>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
