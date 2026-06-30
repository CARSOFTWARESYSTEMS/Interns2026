import { useParams, Link } from 'react-router-dom'
import { Users, Github, FolderOpen, ExternalLink, Cpu, FileText, Calendar } from 'lucide-react'
import type { Developer } from '../types'
import developersData from '../data/developers.json'
import simulatorsData from '../data/simulators.json'
import storiesData from '../data/stories.json'
import PageHeader from '../components/ui/PageHeader'
import SectionCard from '../components/ui/SectionCard'
import StatusBadge from '../components/ui/StatusBadge'

const developers = developersData as Developer[]
const simNames: Record<string, string> = Object.fromEntries(
  (simulatorsData as { id: string; name: string }[]).map(s => [s.id, s.name])
)
const storyTitles: Record<string, string> = Object.fromEntries(
  (storiesData as { id: string; title: string }[]).map(s => [s.id, s.title])
)

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-slate-100 last:border-0 gap-4">
      <span className="text-xs text-slate-500 font-medium flex-shrink-0 w-36">{label}</span>
      <span className="text-xs text-slate-800 font-semibold text-right">{value || <span className="text-slate-300 font-normal italic">Not set</span>}</span>
    </div>
  )
}

function LinkRow({ label, value, icon }: { label: string; value?: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500 flex items-center gap-1.5">{icon} {label}</span>
      {value ? (
        <a href={value.startsWith('http') ? value : '#'} target="_blank" rel="noopener noreferrer"
          className="text-xs text-brand-600 hover:underline font-medium flex items-center gap-1">
          Open <ExternalLink size={10}/>
        </a>
      ) : (
        <span className="text-xs text-slate-300 italic">Not set</span>
      )}
    </div>
  )
}

export default function DeveloperDetail() {
  const { id } = useParams<{ id: string }>()
  const dev = developers.find(d => d.id === id)

  if (!dev) {
    return (
      <div className="card text-center py-16">
        <Users size={40} className="mx-auto mb-3 opacity-30 text-slate-400" />
        <p className="text-slate-600 font-medium">Developer {id} not found</p>
        <Link to="/developers" className="btn-primary mt-4 inline-flex">← Back to Developers</Link>
      </div>
    )
  }

  const statusColor = dev.product === 'Battery Pack Aadhaar System' ? 'bg-brand-100 text-brand-700' : 'bg-purple-100 text-purple-700'

  return (
    <div className="space-y-4">
      <PageHeader
        title={dev.name}
        subtitle={`${dev.id} · ${dev.email}`}
        icon={<Users size={18}/>}
        backTo="/developers"
        backLabel="Developers"
        actions={<StatusBadge status={dev.status} />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column */}
        <div className="space-y-4">
          {/* Profile Card */}
          <div className="card p-5 text-center">
            <div className="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-2xl font-bold mx-auto mb-3">
              {dev.name.charAt(0)}
            </div>
            <h2 className="text-base font-bold text-slate-900">{dev.name}</h2>
            <p className="text-xs text-slate-500 mb-1">{dev.email}</p>
            <p className="text-xs font-semibold text-slate-400 mb-3">{dev.id}</p>
            <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusColor}`}>
              {dev.product === 'Battery Pack Aadhaar System' ? 'Product 1 — Aadhaar' : 'Product 2 — Cybersecurity'}
            </div>
          </div>

          {/* Status Summary */}
          <SectionCard title="Status Summary">
            <div className="space-y-2">
              {[
                { label: 'Development Status', status: dev.status },
                { label: 'QA Status', status: dev.qaStatus },
                { label: 'Architect Status', status: dev.architectStatus },
                { label: 'Demo Status', status: dev.demoStatus },
              ].map(({ label, status }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{label}</span>
                  <StatusBadge status={status} size="xs" />
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Availability */}
          <SectionCard title="Availability" icon={<Calendar size={14}/>}>
            <div className="space-y-2">
              <div>
                <p className="data-label">Weekly Schedule</p>
                <p className="text-xs text-slate-700 mt-1">{dev.weeklyAvailability}</p>
              </div>
              <div>
                <p className="data-label">Expected Hours / Week</p>
                <p className="text-xs font-semibold text-slate-800 mt-1">{dev.expectedWeeklyHours}</p>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Middle + Right columns */}
        <div className="lg:col-span-2 space-y-4">
          {/* Assignment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SectionCard title="Simulator Assignment" icon={<Cpu size={14}/>}>
              <div className="mb-3">
                <p className="text-[10px] font-bold text-purple-600 tracking-widest mb-0.5">{dev.simulatorId}</p>
                <p className="text-sm font-bold text-slate-900">{simNames[dev.simulatorId]}</p>
              </div>
              <Link to={`/simulators/${dev.simulatorId}`} className="btn-primary text-xs w-full justify-center">
                View Simulator →
              </Link>
            </SectionCard>

            <SectionCard title="User Story Assignment" icon={<FileText size={14}/>}>
              <div className="mb-3">
                <p className="text-[10px] font-bold text-brand-600 tracking-widest mb-0.5">{dev.storyId}</p>
                <p className="text-sm font-bold text-slate-900 leading-tight">{storyTitles[dev.storyId]}</p>
              </div>
              <Link to={`/stories/${dev.storyId}`} className="btn-primary text-xs w-full justify-center">
                View Story →
              </Link>
            </SectionCard>
          </div>

          {/* Repository Links */}
          <SectionCard title="Repository & Evidence Links" icon={<Github size={14}/>}>
            <LinkRow label="GitHub Repository" value={dev.githubRepo} icon={<Github size={12}/>} />
            <LinkRow label="GitHub Branch" value={dev.branch} icon={<Github size={12}/>} />
            <LinkRow label="Pull Request" value={dev.pullRequest} icon={<ExternalLink size={12}/>} />
            <LinkRow label="Google Drive Folder" value={dev.driveFolder} icon={<FolderOpen size={12}/>} />
          </SectionCard>

          {/* Dev Info */}
          <SectionCard title="Developer Details">
            <InfoRow label="Developer ID" value={dev.id} />
            <InfoRow label="Full Name" value={dev.name} />
            <InfoRow label="Email" value={dev.email} />
            <InfoRow label="Product" value={dev.product} />
            <InfoRow label="Expected Hours/Week" value={dev.expectedWeeklyHours} />
          </SectionCard>

          {/* Blockers */}
          <SectionCard title="Blockers">
            {dev.blockers ? (
              <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">{dev.blockers}</p>
            ) : (
              <p className="text-xs text-slate-400 italic">No blockers reported</p>
            )}
          </SectionCard>

          {/* Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { title: 'Mentor Notes', value: dev.mentorNotes, color: 'bg-brand-50 border-brand-100' },
              { title: 'QA Notes', value: dev.qaNotes, color: 'bg-yellow-50 border-yellow-100' },
              { title: 'Architect Notes', value: dev.architectNotes, color: 'bg-green-50 border-green-100' },
            ].map(({ title, value, color }) => (
              <div key={title} className={`p-3 rounded-lg border ${color}`}>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">{title}</p>
                {value ? (
                  <p className="text-xs text-slate-700">{value}</p>
                ) : (
                  <p className="text-xs text-slate-300 italic">No notes</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
