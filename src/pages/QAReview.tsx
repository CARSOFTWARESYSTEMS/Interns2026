import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardCheck, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
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

export default function QAReview() {
  const [filterProduct, setFilterProduct] = useState('All')

  const filtered = stories.filter(s =>
    filterProduct === 'All' || s.product === filterProduct
  )

  const pendingQA = filtered.filter(s => s.qaStatus === 'Pending')
  const inReview = filtered.filter(s => s.qaStatus === 'In Review')
  const passed = filtered.filter(s => s.qaStatus === 'Passed')
  const failed = filtered.filter(s => s.qaStatus === 'Failed')
  const blocked = filtered.filter(s => s.status === 'Blocked')

  const groups = [
    { id: 'pending', label: 'Awaiting QA', stories: pendingQA, icon: <Clock size={14}/>, color: 'bg-slate-50 border-slate-200' },
    { id: 'review', label: 'In QA Review', stories: inReview, icon: <ClipboardCheck size={14}/>, color: 'bg-yellow-50 border-yellow-200' },
    { id: 'failed', label: 'QA Failed', stories: failed, icon: <AlertTriangle size={14}/>, color: 'bg-red-50 border-red-200' },
    { id: 'passed', label: 'QA Passed', stories: passed, icon: <CheckCircle size={14}/>, color: 'bg-green-50 border-green-200' },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="QA Review"
        subtitle="Quality assurance tracking for all 10 intern user stories"
        icon={<ClipboardCheck size={18} />}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard title="Pending QA" value={pendingQA.length} icon={<Clock size={18}/>} color="text-slate-500" subtitle="Awaiting start" />
        <StatCard title="In Review" value={inReview.length} icon={<ClipboardCheck size={18}/>} color="text-yellow-600" subtitle="Active review" />
        <StatCard title="QA Failed" value={failed.length} icon={<AlertTriangle size={18}/>} color="text-red-500" subtitle="Need fixes" />
        <StatCard title="QA Passed" value={passed.length} icon={<CheckCircle size={18}/>} color="text-green-600" subtitle="Ready for architect" />
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

      {/* Blocked Alert */}
      {blocked.length > 0 && (
        <div className="border border-red-200 bg-red-50 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800">{blocked.length} stor{blocked.length > 1 ? 'ies' : 'y'} blocked</p>
            <p className="text-xs text-red-600 mt-0.5">{blocked.map(s => s.id).join(', ')}</p>
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
                      <StatusBadge status={story.priority} size="xs" />
                    </div>
                    <p className="text-sm font-semibold text-slate-900 truncate">{story.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {devNames[story.developerId] ?? story.developerId}
                      {story.qaReview.reviewer ? ` · QA: ${story.qaReview.reviewer}` : ''}
                      {story.qaReview.reviewDate ? ` · ${story.qaReview.reviewDate}` : ''}
                    </p>
                    {story.qaReview.comments && (
                      <p className="text-xs text-slate-600 mt-1 italic">"{story.qaReview.comments}"</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <StatusBadge status={story.qaStatus} size="xs" />
                    {story.qaReview.severity && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        story.qaReview.severity === 'Critical' ? 'bg-red-100 text-red-700' :
                        story.qaReview.severity === 'High' ? 'bg-orange-100 text-orange-700' :
                        story.qaReview.severity === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {story.qaReview.severity}
                      </span>
                    )}
                    <Link to={`/stories/${story.id}?tab=qa`} className="btn-secondary text-[10px] px-2 py-1">
                      Review →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      ))}

      {/* QA Checklist Reference */}
      <SectionCard title="QA Review Checklist">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5">
          {[
            'All functional requirements implemented',
            'All non-functional requirements verified',
            'Unit tests written and passing (>80% coverage)',
            'Integration tests passing',
            'Security tests passing',
            'UI/UX requirements met',
            'Documentation complete (README, API docs)',
            'GitHub repo accessible with clean history',
            'No critical/high vulnerabilities',
            'Demo video recorded and uploaded',
            'Architecture document approved',
            'Definition of Done items checked off',
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
