import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Search, ArrowRight, Cpu } from 'lucide-react'
import { useStories, useDevelopers } from '../data/DataProvider'
import PageHeader from '../components/ui/PageHeader'
import StatusBadge from '../components/ui/StatusBadge'
import ProgressBar from '../components/ui/ProgressBar'

const priorityOrder: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 }

export default function Stories() {
  const stories    = useStories()
  const developers = useDevelopers()
  const devNames: Record<string, string> = Object.fromEntries(developers.map(d => [d.id, d.name]))
  const [search, setSearch] = useState('')
  const [filterProduct, setFilterProduct] = useState('All')
  const [filterStatus, setFilterStatus] = useState('All')
  const [filterPriority, setFilterPriority] = useState('All')

  const filtered = stories
    .filter(s => {
      const matchSearch = !search ||
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.id.toLowerCase().includes(search.toLowerCase())
      const matchProduct = filterProduct === 'All' || s.product === filterProduct
      const matchStatus = filterStatus === 'All' || s.status === filterStatus
      const matchPriority = filterPriority === 'All' || s.priority === filterPriority
      return matchSearch && matchProduct && matchStatus && matchPriority
    })
    .sort((a, b) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9))

  return (
    <div className="space-y-4">
      <PageHeader
        title="User Stories"
        subtitle={`${stories.length} engineering stories across 3 products`}
        icon={<FileText size={18} />}
      />

      {/* Filters */}
      <div className="card p-3 flex flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-48">
          <Search size={14} className="text-slate-400" />
          <input
            type="text"
            placeholder="Search stories…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-sm outline-none flex-1 placeholder:text-slate-400"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { value: 'All',                          label: 'All Products' },
            { value: 'Battery Pack Aadhaar System',  label: 'Battery Aadhaar' },
            { value: 'Battery Cybersecurity Platform', label: 'Cybersecurity' },
            { value: 'AS9102 FAI Reports Platform',  label: 'FAI AS9102' },
          ].map(({ value, label }) => (
            <button key={value} onClick={() => setFilterProduct(value)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${filterProduct === value ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none text-slate-600">
            <option value="All">All Statuses</option>
            {['Not Started','Research','POC Development','Product Development','QA Review','Approved','Blocked'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none text-slate-600">
            <option value="All">All Priorities</option>
            {['Critical','High','Medium','Low'].map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="text-xs text-slate-400">{filtered.length} of {stories.length} stories</div>

      {/* Story Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map(story => (
          <div key={story.id} className="card p-4 flex flex-col hover:shadow-md transition-shadow">
            {/* Header */}
            <div className="flex items-start gap-3 mb-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                story.product === 'Battery Pack Aadhaar System' ? 'bg-brand-50' :
                story.product === 'AS9102 FAI Reports Platform' ? 'bg-emerald-50' : 'bg-purple-50'
              }`}>
                <FileText size={16} className={
                  story.product === 'Battery Pack Aadhaar System' ? 'text-brand-600' :
                  story.product === 'AS9102 FAI Reports Platform' ? 'text-emerald-600' : 'text-purple-600'
                } />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-[10px] font-bold tracking-widest ${
                    story.product === 'Battery Pack Aadhaar System' ? 'text-brand-600' :
                    story.product === 'AS9102 FAI Reports Platform' ? 'text-emerald-600' : 'text-purple-600'
                  }`}>{story.id}</span>
                  <StatusBadge status={story.priority} size="xs" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 leading-tight">{story.title}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {story.product === 'Battery Pack Aadhaar System' ? 'Battery Aadhaar' :
                   story.product === 'AS9102 FAI Reports Platform' ? 'FAI AS9102' : 'Cybersecurity'} · {story.workPackage}
                </p>
              </div>
              <StatusBadge status={story.status} size="xs" />
            </div>

            {/* Progress */}
            <div className="mb-3">
              <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                <span>Progress</span>
                <span>{story.overallProgress}%</span>
              </div>
              <ProgressBar value={story.overallProgress} color={
                story.product === 'Battery Pack Aadhaar System' ? 'bg-brand-600' :
                story.product === 'AS9102 FAI Reports Platform' ? 'bg-emerald-600' : 'bg-purple-600'
              } />
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-3 text-xs">
              <div>
                <span className="text-slate-400">Developer: </span>
                <span className="font-medium text-slate-700">{devNames[story.developerId] ?? story.developerId}</span>
              </div>
              <div>
                <span className="text-slate-400">Due: </span>
                <span className="font-medium text-slate-700">{story.dueDate}</span>
              </div>
              <div>
                <span className="text-slate-400">QA: </span>
                <StatusBadge status={story.qaStatus} size="xs" />
              </div>
              <div>
                <span className="text-slate-400">Architect: </span>
                <StatusBadge status={story.architectStatus} size="xs" />
              </div>
            </div>

            {/* Simulator Dependencies */}
            {story.simulatorIds.length > 0 && (
              <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                <Cpu size={11} className="text-slate-400 flex-shrink-0" />
                {story.simulatorIds.map(id => (
                  <Link key={id} to={`/simulators/${id}`}
                    className="text-[10px] bg-slate-100 hover:bg-brand-100 text-slate-600 hover:text-brand-700 px-1.5 py-0.5 rounded font-medium transition-colors">
                    {id}
                  </Link>
                ))}
              </div>
            )}

            {/* Demo Status */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-400">Demo</span>
              <StatusBadge status={story.demoStatus} size="xs" />
            </div>

            <Link to={`/stories/${story.id}`} className="btn-primary mt-auto justify-center">
              View Story <ArrowRight size={12}/>
            </Link>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="card text-center py-12 text-slate-400">
          <FileText size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No stories match the current filters</p>
        </div>
      )}
    </div>
  )
}
