import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Cpu, Search, ExternalLink, Github, Globe, FlaskConical } from 'lucide-react'
import type { Simulator, Developer } from '../types'
import simulatorsData from '../data/simulators.json'
import developersData from '../data/developers.json'
import PageHeader from '../components/ui/PageHeader'
import StatusBadge from '../components/ui/StatusBadge'

const simulators = simulatorsData as Simulator[]
const developers = developersData as Developer[]

const devNames: Record<string, string> = Object.fromEntries(
  developers.map(d => [d.id, d.name])
)

export default function Simulators() {
  const [search, setSearch] = useState('')
  const [filterProduct, setFilterProduct] = useState('All')
  const [filterStatus, setFilterStatus] = useState('All')

  const filtered = simulators.filter(sim => {
    const matchSearch = !search ||
      sim.name.toLowerCase().includes(search.toLowerCase()) ||
      sim.id.toLowerCase().includes(search.toLowerCase())
    const matchProduct = filterProduct === 'All' || sim.product === filterProduct
    const matchStatus = filterStatus === 'All' || sim.status === filterStatus
    return matchSearch && matchProduct && matchStatus
  })

  return (
    <div className="space-y-4">
      <PageHeader
        title="Simulators"
        subtitle="10 Python simulators — CLI + Streamlit + FastAPI"
        icon={<FlaskConical size={18} />}
      />

      {/* Filters */}
      <div className="card p-3 flex flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-48">
          <Search size={14} className="text-slate-400" />
          <input
            type="text"
            placeholder="Search simulators…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-sm outline-none flex-1 placeholder:text-slate-400"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['All','Battery Pack Aadhaar System','Battery Cybersecurity Platform','Both Products'].map(p => (
            <button key={p} onClick={() => setFilterProduct(p)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${filterProduct === p ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {p === 'All' ? 'All' : p === 'Battery Pack Aadhaar System' ? 'P1: Aadhaar' : p === 'Battery Cybersecurity Platform' ? 'P2: Cyber' : 'Both'}
            </button>
          ))}
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none text-slate-600"
        >
          <option value="All">All Statuses</option>
          {['Not Started','Simulator Development','Simulator QA','Demo Ready','Approved','Blocked'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(sim => (
          <div key={sim.id} className="card p-4 flex flex-col hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                  <Cpu size={16} className="text-purple-600" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-purple-600 tracking-widest">{sim.id}</p>
                  <p className="text-sm font-bold text-slate-900 leading-tight">{sim.name}</p>
                </div>
              </div>
              <StatusBadge status={sim.status} size="xs" />
            </div>

            <p className="text-xs text-slate-500 mb-3 line-clamp-2 flex-1">{sim.purpose}</p>

            <div className="space-y-1.5 mb-3">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Owner</span>
                <span className="font-medium text-slate-700">{devNames[sim.ownerId] ?? sim.ownerId}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Product</span>
                <span className={`font-medium ${sim.product === 'Battery Pack Aadhaar System' ? 'text-brand-700' : sim.product === 'Battery Cybersecurity Platform' ? 'text-purple-700' : 'text-teal-700'}`}>
                  {sim.product === 'Battery Pack Aadhaar System' ? 'Product 1' : sim.product === 'Battery Cybersecurity Platform' ? 'Product 2' : 'Both'}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Test Status</span>
                <StatusBadge status={sim.testStatus as 'Not Started'} size="xs" />
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Evidence</span>
                <StatusBadge status={sim.evidenceStatus} size="xs" />
              </div>
            </div>

            <div className="flex gap-1.5 mb-3">
              {sim.githubRepo ? (
                <a href={sim.githubRepo} target="_blank" rel="noopener noreferrer" className="btn-secondary text-[10px] px-2 py-1">
                  <Github size={10}/> GitHub
                </a>
              ) : (
                <span className="btn-ghost text-[10px] px-2 py-1 opacity-40 cursor-not-allowed"><Github size={10}/> GitHub</span>
              )}
              {sim.streamlitLink ? (
                <a href={sim.streamlitLink} target="_blank" rel="noopener noreferrer" className="btn-secondary text-[10px] px-2 py-1">
                  <Globe size={10}/> Streamlit
                </a>
              ) : (
                <span className="btn-ghost text-[10px] px-2 py-1 opacity-40 cursor-not-allowed"><Globe size={10}/> Streamlit</span>
              )}
              {sim.apiLink ? (
                <a href={sim.apiLink} target="_blank" rel="noopener noreferrer" className="btn-secondary text-[10px] px-2 py-1">
                  <ExternalLink size={10}/> API
                </a>
              ) : (
                <span className="btn-ghost text-[10px] px-2 py-1 opacity-40 cursor-not-allowed"><ExternalLink size={10}/> API</span>
              )}
            </div>

            <div className="flex gap-2 mt-auto">
              <Link to={`/simulators/${sim.id}`} className="btn-primary flex-1 justify-center text-xs">
                View Details
              </Link>
              <Link to={`/developers/${sim.ownerId}`} className="btn-secondary text-xs px-3">
                Owner
              </Link>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="card text-center py-12 text-slate-400">
          <Cpu size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No simulators match the current filters</p>
        </div>
      )}
    </div>
  )
}
