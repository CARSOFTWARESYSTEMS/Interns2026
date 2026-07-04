import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Search, ExternalLink, Eye } from 'lucide-react'
import { useDevelopers, useSimulators, useStories } from '../data/DataProvider'
import PageHeader from '../components/ui/PageHeader'
import StatusBadge from '../components/ui/StatusBadge'

export default function Developers() {
  const developers = useDevelopers()
  const simulators = useSimulators()
  const stories    = useStories()

  const simulatorNames: Record<string, string> = Object.fromEntries(simulators.map(s => [s.id, s.name]))
  const storyTitles: Record<string, string>    = Object.fromEntries(stories.map(s => [s.id, s.title]))
  const productNames = Array.from(new Set([
    ...developers.map(d => d.product),
    ...stories.map(s => s.product),
  ].filter(Boolean)))
  const [search, setSearch] = useState('')
  const [filterProduct, setFilterProduct] = useState('All')

  const filtered = developers.filter(dev => {
    const matchSearch =
      !search ||
      dev.name.toLowerCase().includes(search.toLowerCase()) ||
      dev.id.toLowerCase().includes(search.toLowerCase()) ||
      dev.email.toLowerCase().includes(search.toLowerCase())
    const matchProduct =
      filterProduct === 'All' || dev.product === filterProduct
    return matchSearch && matchProduct
  })

  return (
    <div className="space-y-4">
      <PageHeader
        title="Developers"
        subtitle={`${developers.length} interns assigned to Aerospace Intelligence & Cybersecurity Platform`}
        icon={<Users size={18} />}
      />

      {/* Filters */}
      <div className="card p-3 flex flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-48">
          <Search size={14} className="text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, ID, or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-sm outline-none flex-1 placeholder:text-slate-400"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['All', ...productNames].map(p => (
            <button
              key={p}
              onClick={() => setFilterProduct(p)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                filterProduct === p
                  ? 'bg-brand-700 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {p === 'All' ? 'All Products' : p}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Dev</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Developer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Product</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Simulator</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">User Story</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">QA</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Architect</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Demo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(dev => (
                <tr key={dev.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold">
                      {dev.name.charAt(0)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{dev.name}</p>
                    <p className="text-xs text-slate-400">{dev.email}</p>
                    <p className="text-[10px] text-slate-400">{dev.id}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold ${
                      dev.product === 'Battery Pack Aadhaar System' ? 'text-brand-700' :
                      dev.product === 'AS9102 FAI Reports Platform' ? 'text-emerald-700' : 'text-purple-700'
                    }`}>
                      {dev.product}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {dev.simulatorId ? (
                      <>
                        <p className="text-xs font-semibold text-slate-800">{dev.simulatorId}</p>
                        <p className="text-[10px] text-slate-400 truncate max-w-32">{simulatorNames[dev.simulatorId]}</p>
                      </>
                    ) : (
                      <span className="text-xs text-slate-300 italic">Not assigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-semibold text-slate-800">{dev.storyId}</p>
                    <p className="text-[10px] text-slate-400 truncate max-w-40">{storyTitles[dev.storyId]}</p>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={dev.status} size="xs" /></td>
                  <td className="px-4 py-3"><StatusBadge status={dev.qaStatus} size="xs" /></td>
                  <td className="px-4 py-3"><StatusBadge status={dev.architectStatus} size="xs" /></td>
                  <td className="px-4 py-3"><StatusBadge status={dev.demoStatus} size="xs" /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 flex-wrap">
                      <Link to={`/developers/${dev.id}`} className="btn-primary text-[10px] px-2 py-1">
                        <Eye size={10}/> Profile
                      </Link>
                      {dev.simulatorId && (
                        <Link to={`/simulators/${dev.simulatorId}`} className="btn-secondary text-[10px] px-2 py-1">
                          <ExternalLink size={10}/> Sim
                        </Link>
                      )}
                      <Link to={`/stories/${dev.storyId}`} className="btn-secondary text-[10px] px-2 py-1">
                        <ExternalLink size={10}/> Story
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <Users size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No developers match the current filters</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
