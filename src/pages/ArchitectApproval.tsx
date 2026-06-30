import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import type { Story, Developer } from '../types'
import storiesData from '../data/stories.json'
import developersData from '../data/developers.json'
import PageHeader from '../components/ui/PageHeader'
import StatusBadge from '../components/ui/StatusBadge'
import StatCard from '../components/ui/StatCard'
import SectionCard from '../components/ui/SectionCard'

const stories = storiesData as Story[]
const developers = developersData as Developer[]
const devNames: Record<string, string> = Object.fromEntries(developers.map(d => [d.id, d.name]))

export default function ArchitectApproval() {
  const [filterProduct, setFilterProduct] = useState('All')

  const filtered = stories.filter(s =>
    filterProduct === 'All' || s.product === filterProduct
  )

  const pending = filtered.filter(s => s.architectStatus === 'Pending')
  const inReview = filtered.filter(s => s.architectStatus === 'In Review')
  const approved = filtered.filter(s => s.architectStatus === 'Approved')
  const rejected = filtered.filter(s => s.architectStatus === 'Changes Required')
  const qaReady = filtered.filter(s => s.qaStatus === 'Passed' && s.architectStatus === 'Pending')

  const groups = [
    { id: 'qa-ready', label: 'QA Passed — Ready for Architect Review', stories: qaReady, icon: <CheckCircle size={14} className="text-brand-500"/>, color: 'bg-brand-50 border-brand-200' },
    { id: 'pending', label: 'Awaiting Architect Review', stories: pending.filter(s => s.qaStatus !== 'Passed'), icon: <Clock size={14} className="text-slate-400"/>, color: 'bg-slate-50 border-slate-200' },
    { id: 'review', label: 'Under Architect Review', stories: inReview, icon: <ShieldCheck size={14} className="text-yellow-500"/>, color: 'bg-yellow-50 border-yellow-200' },
    { id: 'changes', label: 'Changes Required', stories: rejected, icon: <XCircle size={14} className="text-orange-500"/>, color: 'bg-orange-50 border-orange-200' },
    { id: 'approved', label: 'Architect Approved', stories: approved, icon: <CheckCircle size={14} className="text-green-500"/>, color: 'bg-green-50 border-green-200' },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Architect Approval"
        subtitle="Technical architecture review and final approval by the Founder / Architect"
        icon={<ShieldCheck size={18} />}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard title="Awaiting Review" value={pending.length} icon={<Clock size={18}/>} color="text-slate-500" subtitle="QA not yet passed" />
        <StatCard title="Under Review" value={inReview.length} icon={<ShieldCheck size={18}/>} color="text-yellow-600" subtitle="Active review" />
        <StatCard title="Changes Needed" value={rejected.length} icon={<XCircle size={18}/>} color="text-orange-600" subtitle="Revision required" />
        <StatCard title="Approved" value={approved.length} icon={<CheckCircle size={18}/>} color="text-green-600" subtitle="Demo eligible" />
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['All', 'Battery Pack Aadhaar System', 'Battery Cybersecurity Platform'].map(p => (
          <button key={p} onClick={() => setFilterProduct(p)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${filterProduct === p ? 'bg-brand-700 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {p === 'All' ? 'All Products' : p === 'Battery Pack Aadhaar System' ? 'Product 1' : 'Product 2'}
          </button>
        ))}
      </div>

      {/* QA Ready Alert */}
      {qaReady.length > 0 && (
        <div className="border border-brand-200 bg-brand-50 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle size={16} className="text-brand-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-brand-900">{qaReady.length} stor{qaReady.length > 1 ? 'ies' : 'y'} ready for architect review</p>
            <p className="text-xs text-brand-700 mt-0.5">QA has passed — waiting for architect review to begin</p>
          </div>
        </div>
      )}

      {/* Story Groups */}
      {groups.map(({ id, label, stories: groupStories, icon, color }) => (
        <SectionCard key={id} title={`${label} (${groupStories.length})`} icon={icon}>
          {groupStories.length === 0 ? (
            <p className="text-xs text-slate-400 italic">None</p>
          ) : (
            <div className="space-y-2">
              {groupStories.map(story => (
                <div key={story.id} className={`flex items-center gap-4 p-3 rounded-xl border ${color}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[10px] font-bold tracking-widest ${story.product === 'Battery Pack Aadhaar System' ? 'text-brand-600' : 'text-purple-600'}`}>
                        {story.id}
                      </span>
                      <StatusBadge status={story.qaStatus} size="xs" />
                    </div>
                    <p className="text-sm font-semibold text-slate-900 truncate">{story.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {devNames[story.developerId] ?? story.developerId}
                      {story.architectApproval.reviewer ? ` · Reviewer: ${story.architectApproval.reviewer}` : ' · Reviewer: Founder / Architect'}
                      {story.architectApproval.reviewDate ? ` · ${story.architectApproval.reviewDate}` : ''}
                    </p>
                    {story.architectApproval.comments && (
                      <p className="text-xs text-slate-600 mt-1 italic">"{story.architectApproval.comments}"</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <StatusBadge status={story.architectStatus} size="xs" />
                    {story.architectApproval.finalDecision && (
                      <span className="text-[10px] font-bold text-slate-600">{story.architectApproval.finalDecision}</span>
                    )}
                    <Link to={`/stories/${story.id}?tab=architect`} className="btn-secondary text-[10px] px-2 py-1">
                      Review →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      ))}

      {/* Architect Approval Criteria */}
      <SectionCard title="Architect Approval Criteria" icon={<ShieldCheck size={14}/>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5">
          {[
            'Architecture document reviewed and approved',
            'Technology stack meets product requirements',
            'Security architecture sound and sufficient',
            'BPAN format implemented correctly (if applicable)',
            'Trust score model correctly implemented (if applicable)',
            'API design follows RESTful standards',
            'Simulator outputs tagged with simulated=true',
            'Simulator integrates with story correctly',
            'Data model and JSON schemas validated',
            'Code quality and structure reviewed',
            'Performance meets non-functional requirements',
            'No critical security vulnerabilities remain',
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-slate-700">
              <div className="w-3.5 h-3.5 rounded border-2 border-slate-300 flex-shrink-0" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}
