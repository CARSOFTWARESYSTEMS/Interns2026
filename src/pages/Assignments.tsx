import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, Search, ArrowRight, AlertTriangle } from 'lucide-react'
import { useAssignments, useDevelopers, useStories, useSimulators } from '../data/DataProvider'
import PageHeader from '../components/ui/PageHeader'
import StatusBadge from '../components/ui/StatusBadge'
import StatCard from '../components/ui/StatCard'
import ProgressBar from '../components/ui/ProgressBar'
import { calcEvidenceProgress, getDaysRemaining, getRiskLevel } from '../utils/progress'

const ALL_STATUSES = [
  'Draft','Assigned','Accepted','Research','Analysis',
  'Simulator Development','Simulator QA','POC','Architecture',
  'Development','Unit Testing','Integration','Cross Testing',
  'QA Review','Bug Fixes','Architect Review','Demo Ready',
  'Completed','Blocked','Cancelled',
]

export default function Assignments() {
  const assignments = useAssignments()
  const developers  = useDevelopers()
  const stories     = useStories()
  const simulators  = useSimulators()
  const devMap   = Object.fromEntries(developers.map(d => [d.id, d.name]))
  const storyMap = Object.fromEntries(stories.map(s => [s.id, s.title]))
  const simMap   = Object.fromEntries(simulators.map(s => [s.id, s.name]))

  const [search, setSearch] = useState('')
  const [filterProduct, setFilterProduct] = useState('All')
  const [filterStatus, setFilterStatus] = useState('All')
  const [filterPriority, setFilterPriority] = useState('All')
  const [filterDev, setFilterDev] = useState('All')

  const filtered = assignments.filter(a => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      a.id.toLowerCase().includes(q) ||
      a.storyId.toLowerCase().includes(q) ||
      a.simulatorId.toLowerCase().includes(q) ||
      devMap[a.developerId]?.toLowerCase().includes(q) ||
      storyMap[a.storyId]?.toLowerCase().includes(q)
    const matchProduct = filterProduct === 'All' || a.product === filterProduct
    const matchStatus = filterStatus === 'All' || a.status === filterStatus
    const matchPriority = filterPriority === 'All' || a.priority === filterPriority
    const matchDev = filterDev === 'All' || a.developerId === filterDev
    return matchSearch && matchProduct && matchStatus && matchPriority && matchDev
  })

  // Summary stats
  const byStatus = (s: string) => assignments.filter(a => a.status === s).length
  const totalProgress = Math.round(assignments.reduce((sum, a) => sum + a.progress, 0) / assignments.length)

  const stats = [
    { label: 'Total', value: assignments.length, color: 'text-slate-600' },
    { label: 'Assigned', value: byStatus('Assigned'), color: 'text-blue-600' },
    { label: 'In Dev', value: assignments.filter(a => ['Development','Unit Testing','Integration','Cross Testing'].includes(a.status)).length, color: 'text-brand-600' },
    { label: 'QA Review', value: byStatus('QA Review'), color: 'text-yellow-600' },
    { label: 'Arch Review', value: byStatus('Architect Review'), color: 'text-purple-600' },
    { label: 'Approved', value: assignments.filter(a => a.status === 'Completed').length, color: 'text-green-600' },
    { label: 'Blocked', value: byStatus('Blocked'), color: 'text-red-600' },
    { label: 'Demo Ready', value: byStatus('Demo Ready'), color: 'text-emerald-600' },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Assignments"
        subtitle="10 engineering assignments · Battery Trust Platform Intern Program 2026"
        icon={<ClipboardList size={18}/>}
      />

      {/* Stats row */}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
        {stats.map(s => (
          <div key={s.label} className="card p-3 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Overall progress */}
      <div className="card p-4">
        <div className="flex justify-between mb-1.5">
          <span className="text-sm font-semibold text-slate-700">Overall Programme Progress</span>
          <span className="text-sm font-bold text-slate-800">{totalProgress}%</span>
        </div>
        <ProgressBar value={totalProgress} color="bg-brand-600" height="h-3" />
      </div>

      {/* Filters */}
      <div className="card p-3 flex flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-48">
          <Search size={14} className="text-slate-400" />
          <input
            type="text"
            placeholder="Search by ID, story, simulator, developer…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-sm outline-none flex-1 placeholder:text-slate-400"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['All','Battery Pack Aadhaar System','Battery Cybersecurity Platform'].map(p => (
            <button key={p} onClick={() => setFilterProduct(p)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${filterProduct === p ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {p === 'All' ? 'All' : p === 'Battery Pack Aadhaar System' ? 'Product 1' : 'Product 2'}
            </button>
          ))}
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none text-slate-600">
          <option value="All">All Statuses</option>
          {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none text-slate-600">
          <option value="All">All Priorities</option>
          {['Critical','High','Medium','Low'].map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterDev} onChange={e => setFilterDev(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none text-slate-600">
          <option value="All">All Developers</option>
          {developers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      <div className="text-xs text-slate-400">{filtered.length} of {assignments.length} assignments</div>

      {/* Assignment Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Assignment','Product','Story','Simulator','Developer','QA','Priority','Status','Progress','Due Date','Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(a => {
                const daysRem = getDaysRemaining(a.dueDate)
                const evidencePct = calcEvidenceProgress(a.evidence)
                const risk = getRiskLevel(daysRem, a.progress)
                const isProduct1 = a.product === 'Battery Pack Aadhaar System'
                return (
                  <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs font-bold text-slate-800">{a.id}</p>
                      <p className="text-[10px] text-slate-400">{a.workPackage}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold ${isProduct1 ? 'text-brand-700' : 'text-purple-700'}`}>
                        {isProduct1 ? 'P1' : 'P2'}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-48">
                      <p className="text-xs font-bold text-slate-700">{a.storyId}</p>
                      <p className="text-[10px] text-slate-400 truncate">{storyMap[a.storyId]}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-bold text-slate-700">{a.simulatorId}</p>
                      <p className="text-[10px] text-slate-400 truncate max-w-32">{simMap[a.simulatorId]}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-slate-800">{devMap[a.developerId]}</p>
                      <p className="text-[10px] text-slate-400">{a.developerId}</p>
                    </td>
                    <td className="px-4 py-3">
                      {a.qaId ? (
                        <p className="text-xs text-slate-700">{a.qaId}</p>
                      ) : (
                        <span className="text-[10px] text-slate-300 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={a.priority} size="xs" /></td>
                    <td className="px-4 py-3"><StatusBadge status={a.status} size="xs" /></td>
                    <td className="px-4 py-3 min-w-28">
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <ProgressBar value={a.progress} color={isProduct1 ? 'bg-brand-500' : 'bg-purple-500'} height="h-1.5" />
                        </div>
                        <span className="text-[10px] font-bold text-slate-600">{a.progress}%</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {risk !== 'Low Risk' && <AlertTriangle size={9} className={risk === 'Critical Risk' ? 'text-red-500' : risk === 'High Risk' ? 'text-orange-500' : 'text-amber-400'} />}
                        <span className="text-[10px] text-slate-400">Ev: {evidencePct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-slate-700">{a.dueDate}</p>
                      <p className={`text-[10px] ${daysRem < 14 ? 'text-red-500 font-bold' : daysRem < 30 ? 'text-amber-500' : 'text-slate-400'}`}>
                        {daysRem}d left
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/assignments/${a.id}`} className="btn-primary text-[10px] px-2.5 py-1.5 whitespace-nowrap">
                        View <ArrowRight size={10}/>
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <ClipboardList size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No assignments match the current filters</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
