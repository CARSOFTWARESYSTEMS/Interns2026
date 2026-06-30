import { BarChart2, Users, Package, Activity, Calendar, AlertTriangle, ClipboardCheck, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAssignments, useDevelopers, useStories } from '../data/DataProvider'
import PageHeader from '../components/ui/PageHeader'
import SectionCard from '../components/ui/SectionCard'
import StatusBadge from '../components/ui/StatusBadge'
import ProgressBar from '../components/ui/ProgressBar'
import { getDaysRemaining, getRiskLevel, calcEvidenceProgress } from '../utils/progress'

function MiniBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-600 w-32 flex-shrink-0 truncate">{label}</span>
      <div className="flex-1">
        <ProgressBar value={pct} color={color} height="h-2" />
      </div>
      <span className="text-xs font-bold text-slate-700 w-8 text-right">{count}</span>
    </div>
  )
}

export default function Reports() {
  const assignments = useAssignments()
  const developers  = useDevelopers()
  const stories     = useStories()
  const devMap = Object.fromEntries(developers.map(d => [d.id, d]))

  // ── By Developer ──────────────────────────────────────
  const byDev = developers.map(dev => {
    const devAssigns = assignments.filter(a => a.developerId === dev.id)
    return { dev, assignments: devAssigns, progress: devAssigns[0]?.progress ?? 0 }
  }).sort((a, b) => b.progress - a.progress)

  // ── By Product ────────────────────────────────────────
  const p1 = assignments.filter(a => a.product === 'Battery Pack Aadhaar System')
  const p2 = assignments.filter(a => a.product === 'Battery Cybersecurity Platform')
  const p1Avg = p1.length ? Math.round(p1.reduce((s, a) => s + a.progress, 0) / p1.length) : 0
  const p2Avg = p2.length ? Math.round(p2.reduce((s, a) => s + a.progress, 0) / p2.length) : 0

  // ── By Status ─────────────────────────────────────────
  const statusCounts = assignments.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1
    return acc
  }, {})

  // ── By Priority ───────────────────────────────────────
  const priorityCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 }
  assignments.forEach(a => { priorityCounts[a.priority as keyof typeof priorityCounts]++ })

  // ── By Risk ──────────────────────────────────────────
  const riskGroups = assignments.map(a => ({
    assignment: a,
    risk: getRiskLevel(getDaysRemaining(a.dueDate), a.progress),
    evidencePct: calcEvidenceProgress(a.evidence),
  })).sort((a, b) => {
    const order = ['Critical Risk','High Risk','Medium Risk','Low Risk']
    return order.indexOf(a.risk) - order.indexOf(b.risk)
  })

  // ── By QA ────────────────────────────────────────────
  const qaGroups = { Pending: 0, 'In Review': 0, Passed: 0, Failed: 0, Blocked: 0 }
  developers.forEach(d => { qaGroups[d.qaStatus as keyof typeof qaGroups]++ })

  // ── By Architect ─────────────────────────────────────
  const archGroups = { Pending: 0, 'In Review': 0, Approved: 0, 'Changes Required': 0, Rejected: 0 }
  developers.forEach(d => { archGroups[d.architectStatus as keyof typeof archGroups]++ })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        subtitle="Assignment analytics and progress reports · Battery Trust Platform 2026"
        icon={<BarChart2 size={18}/>}
      />

      {/* ── By Developer ──────────────────────────────── */}
      <SectionCard title="Assignments by Developer" icon={<Users size={14}/>}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                {['Developer','Product','Story','Simulator','Status','QA','Architect','Progress','Risk','Evidence','Actions'].map(h => (
                  <th key={h} className="text-left py-2 pr-4 font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {byDev.map(({ dev, assignments: da }) => {
                const a = da[0]
                if (!a) return null
                const risk = getRiskLevel(getDaysRemaining(a.dueDate), a.progress)
                const evPct = calcEvidenceProgress(a.evidence)
                return (
                  <tr key={dev.id} className="hover:bg-slate-50">
                    <td className="py-2 pr-4">
                      <p className="font-semibold text-slate-800">{dev.name}</p>
                      <p className="text-slate-400">{dev.id}</p>
                    </td>
                    <td className="py-2 pr-4">
                      <span className={`font-semibold ${a.product === 'Battery Pack Aadhaar System' ? 'text-brand-600' : 'text-purple-600'}`}>
                        {a.product === 'Battery Pack Aadhaar System' ? 'P1' : 'P2'}
                      </span>
                    </td>
                    <td className="py-2 pr-4"><span className="font-mono">{a.storyId}</span></td>
                    <td className="py-2 pr-4"><span className="font-mono">{a.simulatorId}</span></td>
                    <td className="py-2 pr-4"><StatusBadge status={a.status} size="xs" /></td>
                    <td className="py-2 pr-4"><StatusBadge status={dev.qaStatus} size="xs" /></td>
                    <td className="py-2 pr-4"><StatusBadge status={dev.architectStatus} size="xs" /></td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2 min-w-20">
                        <ProgressBar value={a.progress} color={a.product === 'Battery Pack Aadhaar System' ? 'bg-brand-500' : 'bg-purple-500'} height="h-1.5" />
                        <span className="font-bold text-slate-700">{a.progress}%</span>
                      </div>
                    </td>
                    <td className="py-2 pr-4"><StatusBadge status={risk} size="xs" /></td>
                    <td className="py-2 pr-4">
                      <span className={`font-bold ${evPct === 100 ? 'text-green-600' : evPct > 50 ? 'text-amber-600' : 'text-red-500'}`}>{evPct}%</span>
                    </td>
                    <td className="py-2">
                      <Link to={`/assignments/${a.id}`} className="btn-secondary text-[10px] px-2 py-1">View</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── By Product ──────────────────────────────── */}
        <SectionCard title="Assignments by Product" icon={<Package size={14}/>}>
          <div className="space-y-4">
            {[
              { label: 'Battery Pack Aadhaar System', count: p1.length, avg: p1Avg, color: 'bg-brand-500', accent: 'text-brand-700' },
              { label: 'Battery Cybersecurity Platform', count: p2.length, avg: p2Avg, color: 'bg-purple-500', accent: 'text-purple-700' },
            ].map(({ label, count, avg, color, accent }) => (
              <div key={label} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex justify-between mb-2">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{label}</p>
                    <p className="text-xs text-slate-500">{count} assignments</p>
                  </div>
                  <p className={`text-2xl font-bold ${accent}`}>{avg}%</p>
                </div>
                <ProgressBar value={avg} color={color} height="h-2" />
              </div>
            ))}
          </div>
        </SectionCard>

        {/* ── By Status ──────────────────────────────── */}
        <SectionCard title="Assignments by Status" icon={<Activity size={14}/>}>
          <div className="space-y-2">
            {Object.entries(statusCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([status, count]) => (
                <MiniBar key={status} label={status} count={count} total={assignments.length} color="bg-brand-500" />
              ))}
          </div>
        </SectionCard>

        {/* ── By Priority ─────────────────────────────── */}
        <SectionCard title="Assignments by Priority">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Critical', count: priorityCounts.Critical, color: 'bg-red-100 border-red-200 text-red-700' },
              { label: 'High', count: priorityCounts.High, color: 'bg-orange-100 border-orange-200 text-orange-700' },
              { label: 'Medium', count: priorityCounts.Medium, color: 'bg-amber-100 border-amber-200 text-amber-700' },
              { label: 'Low', count: priorityCounts.Low, color: 'bg-green-100 border-green-200 text-green-700' },
            ].map(({ label, count, color }) => (
              <div key={label} className={`p-4 rounded-xl border text-center ${color}`}>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs font-semibold mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* ── By QA ──────────────────────────────────── */}
        <SectionCard title="Assignments by QA Status" icon={<ClipboardCheck size={14}/>}>
          <div className="space-y-2">
            {Object.entries(qaGroups).filter(([, c]) => c > 0 || true).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                <StatusBadge status={status} size="xs" />
                <span className="text-sm font-bold text-slate-700">{count}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* ── By Architect ────────────────────────────── */}
        <SectionCard title="Assignments by Architect Status" icon={<ShieldCheck size={14}/>}>
          <div className="space-y-2">
            {Object.entries(archGroups).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                <StatusBadge status={status} size="xs" />
                <span className="text-sm font-bold text-slate-700">{count}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* ── By Week ─────────────────────────────────── */}
        <SectionCard title="Assignments by Schedule Risk" icon={<Calendar size={14}/>}>
          <div className="space-y-2">
            {riskGroups.map(({ assignment: a, risk, evidencePct: evPct }) => (
              <div key={a.id} className="flex items-center gap-3 py-1.5 border-b border-slate-50 last:border-0">
                <StatusBadge status={risk} size="xs" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">{a.id}</p>
                  <p className="text-[10px] text-slate-400">{devMap[a.developerId]?.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-700">{a.progress}%</p>
                  <p className="text-[10px] text-slate-400">Ev: {evPct}%</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* ── Risk Alert ────────────────────────────────── */}
      {riskGroups.some(r => r.risk === 'Critical Risk' || r.risk === 'High Risk') && (
        <SectionCard title="Risk Alerts" icon={<AlertTriangle size={14} className="text-red-500"/>}>
          <div className="space-y-2">
            {riskGroups
              .filter(r => r.risk === 'Critical Risk' || r.risk === 'High Risk')
              .map(({ assignment: a, risk }) => (
                <div key={a.id} className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <AlertTriangle size={14} className={risk === 'Critical Risk' ? 'text-red-500' : 'text-orange-500'} />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-slate-800">{a.id} — {devMap[a.developerId]?.name}</p>
                    <p className="text-[10px] text-slate-500">{a.storyId} · Progress: {a.progress}%</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={risk} size="xs" />
                    <Link to={`/assignments/${a.id}`} className="btn-secondary text-[10px] px-2 py-1">View</Link>
                  </div>
                </div>
              ))}
          </div>
        </SectionCard>
      )}

      {/* ── Story Progress Table ──────────────────────── */}
      <SectionCard title="Story Progress Report">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                {['Story ID','Title','Developer','Priority','Status','Progress','QA','Architect','Demo'].map(h => (
                  <th key={h} className="text-left py-2 pr-4 font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {stories.map(s => {
                const dev = devMap[s.developerId]
                return (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="py-2 pr-4 font-mono font-bold text-slate-700">{s.id}</td>
                    <td className="py-2 pr-4 max-w-40 truncate font-medium text-slate-800">{s.title}</td>
                    <td className="py-2 pr-4">{dev?.name ?? s.developerId}</td>
                    <td className="py-2 pr-4"><StatusBadge status={s.priority} size="xs" /></td>
                    <td className="py-2 pr-4"><StatusBadge status={s.status} size="xs" /></td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2 min-w-20">
                        <ProgressBar value={s.overallProgress} color={s.product === 'Battery Pack Aadhaar System' ? 'bg-brand-500' : 'bg-purple-500'} height="h-1.5" />
                        <span className="font-bold text-slate-700">{s.overallProgress}%</span>
                      </div>
                    </td>
                    <td className="py-2 pr-4"><StatusBadge status={s.qaStatus} size="xs" /></td>
                    <td className="py-2 pr-4"><StatusBadge status={s.architectStatus} size="xs" /></td>
                    <td className="py-2"><StatusBadge status={s.demoStatus} size="xs" /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}
