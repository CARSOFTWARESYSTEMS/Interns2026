import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FolderOpen, CheckCircle, XCircle, Clock, ExternalLink } from 'lucide-react'
import type { Story } from '../types'
import { useStories, useDevelopers } from '../data/DataProvider'
import PageHeader from '../components/ui/PageHeader'
import StatusBadge from '../components/ui/StatusBadge'

const EVIDENCE_FIELDS = [
  { key: 'driveFolder', label: 'Drive', required: true },
  { key: 'githubRepo', label: 'GitHub', required: true },
  { key: 'branch', label: 'Branch', required: true },
  { key: 'pullRequest', label: 'PR', required: true },
  { key: 'architectureDoc', label: 'Arch Doc', required: true },
  { key: 'designDoc', label: 'Design', required: true },
  { key: 'readme', label: 'README', required: true },
  { key: 'testReport', label: 'Tests', required: true },
  { key: 'coverageReport', label: 'Coverage', required: true },
  { key: 'demoVideo', label: 'Demo', required: true },
  { key: 'securityReport', label: 'Security', required: false },
  { key: 'presentation', label: 'Slides', required: false },
] as const

type EvKey = typeof EVIDENCE_FIELDS[number]['key']

function EvidenceCell({ value }: { value?: string }) {
  if (!value) return <XCircle size={14} className="text-red-400 mx-auto" />
  if (value.startsWith('http')) {
    return (
      <a href={value} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center">
        <CheckCircle size={14} className="text-green-500" />
      </a>
    )
  }
  return <CheckCircle size={14} className="text-green-500 mx-auto" />
}

function completionPct(ev: Story['evidence']): number {
  const required = EVIDENCE_FIELDS.filter(f => f.required)
  const filled = required.filter(f => !!ev[f.key as EvKey])
  return Math.round((filled.length / required.length) * 100)
}

export default function Evidence() {
  const stories    = useStories()
  const developers = useDevelopers()
  const devNames: Record<string, string> = Object.fromEntries(developers.map(d => [d.id, d.name]))

  const [filterProduct, setFilterProduct] = useState('All')
  const [search, setSearch] = useState('')

  const filtered = stories.filter(s => {
    const matchProduct = filterProduct === 'All' || s.product === filterProduct
    const matchSearch = !search || s.title.toLowerCase().includes(search.toLowerCase()) || s.id.toLowerCase().includes(search.toLowerCase())
    return matchProduct && matchSearch
  })

  const totalRequired = EVIDENCE_FIELDS.filter(f => f.required).length
  const submittedCount = stories.reduce((sum, s) => {
    return sum + EVIDENCE_FIELDS.filter(f => f.required && !!s.evidence[f.key as EvKey]).length
  }, 0)
  const totalSlots = stories.length * totalRequired
  const overallPct = Math.round((submittedCount / totalSlots) * 100)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Evidence Tracker"
        subtitle="Engineering evidence submission status across all intern stories"
        icon={<FolderOpen size={18} />}
      />

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-brand-700">{overallPct}%</p>
          <p className="text-xs text-slate-500 mt-1">Overall Submission</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{submittedCount}</p>
          <p className="text-xs text-slate-500 mt-1">Items Submitted</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-red-500">{totalSlots - submittedCount}</p>
          <p className="text-xs text-slate-500 mt-1">Items Missing</p>
        </div>
      </div>

      {/* Legend */}
      <div className="card p-3 flex items-center gap-5 text-xs text-slate-600">
        <div className="flex items-center gap-1.5"><CheckCircle size={13} className="text-green-500"/><span>Submitted</span></div>
        <div className="flex items-center gap-1.5"><XCircle size={13} className="text-red-400"/><span>Missing (required)</span></div>
        <div className="flex items-center gap-1.5"><Clock size={13} className="text-slate-300"/><span>Optional / not required</span></div>
        <div className="flex items-center gap-1.5"><ExternalLink size={13} className="text-brand-500"/><span>Submitted with link</span></div>
      </div>

      {/* Filters */}
      <div className="card p-3 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search stories…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="text-sm outline-none flex-1 min-w-40 placeholder:text-slate-400"
        />
        <div className="flex gap-2">
          {['All', 'Battery Pack Aadhaar System', 'Battery Cybersecurity Platform'].map(p => (
            <button key={p} onClick={() => setFilterProduct(p)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${filterProduct === p ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {p === 'All' ? 'All' : p === 'Battery Pack Aadhaar System' ? 'Product 1' : 'Product 2'}
            </button>
          ))}
        </div>
      </div>

      {/* Evidence Matrix */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 font-semibold text-slate-500 uppercase tracking-wide min-w-48">Story</th>
                <th className="px-3 py-3 font-semibold text-slate-500 uppercase tracking-wide min-w-20">Developer</th>
                {EVIDENCE_FIELDS.map(f => (
                  <th key={f.key} className={`px-2 py-3 font-semibold uppercase tracking-wide text-center min-w-14 ${f.required ? 'text-slate-500' : 'text-slate-300'}`}>
                    {f.label}
                    {!f.required && <span className="text-[8px] block text-slate-300">opt</span>}
                  </th>
                ))}
                <th className="text-center px-3 py-3 font-semibold text-slate-500 uppercase tracking-wide min-w-20">Done</th>
                <th className="px-3 py-3 font-semibold text-slate-500 uppercase tracking-wide min-w-16">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(story => {
                const pct = completionPct(story.evidence)
                return (
                  <tr key={story.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5">
                      <p className={`text-[10px] font-bold tracking-widest ${story.product === 'Battery Pack Aadhaar System' ? 'text-brand-600' : 'text-purple-600'}`}>{story.id}</p>
                      <p className="font-semibold text-slate-800 leading-tight">{story.title}</p>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-slate-600 font-medium">{devNames[story.developerId]?.split(' ')[0] ?? story.developerId}</span>
                    </td>
                    {EVIDENCE_FIELDS.map(f => (
                      <td key={f.key} className="px-2 py-2.5 text-center">
                        {f.required
                          ? <EvidenceCell value={story.evidence[f.key as EvKey] ?? undefined} />
                          : story.evidence[f.key as EvKey]
                            ? <EvidenceCell value={story.evidence[f.key as EvKey] ?? undefined} />
                            : <Clock size={12} className="text-slate-200 mx-auto" />
                        }
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`text-xs font-bold ${pct === 100 ? 'text-green-600' : pct > 50 ? 'text-amber-600' : 'text-red-500'}`}>{pct}%</span>
                        <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${pct === 100 ? 'bg-green-500' : pct > 50 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Link to={`/stories/${story.id}#evidence`} className="btn-secondary text-[10px] px-2 py-1">
                        Manage
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="card text-center py-12 text-slate-400">
          <FolderOpen size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No stories match the current filters</p>
        </div>
      )}
    </div>
  )
}
