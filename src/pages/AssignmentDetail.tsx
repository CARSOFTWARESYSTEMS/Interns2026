import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ClipboardList, Users, FlaskConical, FileText, Clock,
  FolderOpen, ClipboardCheck, ShieldCheck, Mail, History,
  CheckCircle, XCircle, AlertCircle, ExternalLink, Github,
  Printer, ArrowRight
} from 'lucide-react'
import type { Assignment, Developer, Story, Simulator } from '../types'
import { useAssignments, useDevelopers, useStories, useSimulators } from '../data/DataProvider'
import PageHeader from '../components/ui/PageHeader'
import TabNav from '../components/ui/TabNav'
import SectionCard from '../components/ui/SectionCard'
import StatusBadge from '../components/ui/StatusBadge'
import ProgressBar from '../components/ui/ProgressBar'
import Timeline, { type TimelinePhase, type PhaseStatus } from '../components/ui/Timeline'
import EmailPreview from '../components/ui/EmailPreview'
import {
  getPhaseIndex, calcSimulatorProgress, calcEvidenceProgress,
  calcQAProgress, calcArchitectProgress, calcOverallProgress,
  getDaysRemaining, getRiskLevel,
} from '../utils/progress'



const TABS = [
  { id: 'summary',    label: 'Summary' },
  { id: 'details',    label: 'Details' },
  { id: 'developer',  label: 'Developer' },
  { id: 'simulator',  label: 'Simulator' },
  { id: 'story',      label: 'Story' },
  { id: 'timeline',   label: 'Timeline' },
  { id: 'evidence',   label: 'Evidence' },
  { id: 'qa',         label: 'QA' },
  { id: 'architect',  label: 'Architect' },
  { id: 'email',      label: 'Email' },
  { id: 'history',    label: 'History' },
]

const PHASE_DEFS = [
  { id: 'research',      label: 'Research' },
  { id: 'analysis',      label: 'Analysis' },
  { id: 'simulator-dev', label: 'Simulator Development' },
  { id: 'simulator-qa',  label: 'Simulator QA' },
  { id: 'poc',           label: 'POC' },
  { id: 'architecture',  label: 'Architecture' },
  { id: 'development',   label: 'Development' },
  { id: 'testing',       label: 'Testing' },
  { id: 'security',      label: 'Security' },
  { id: 'review',        label: 'Review' },
  { id: 'demo',          label: 'Demo' },
  { id: 'completed',     label: 'Completed' },
]

function buildPhases(assignment: Assignment): TimelinePhase[] {
  const idx = getPhaseIndex(assignment.status)
  const isBlocked = assignment.status === 'Blocked'
  const isCancelled = assignment.status === 'Cancelled'

  return PHASE_DEFS.map((p, i) => {
    let status: PhaseStatus = 'Not Started'
    if (isCancelled) {
      status = 'Not Started'
    } else if (isBlocked) {
      if (i < idx) status = 'Completed'
      else if (i === idx) status = 'Blocked'
    } else {
      if (i < idx) status = 'Completed'
      else if (i === idx) status = 'In Progress'
    }
    return { id: p.id, label: p.label, status }
  })
}

const EV_LABELS: Record<keyof Assignment['evidence'], string> = {
  architecture: 'Architecture Document',
  design: 'Design Document',
  github: 'GitHub Repository',
  branch: 'Feature Branch',
  pr: 'Pull Request',
  readme: 'README',
  apiDoc: 'API Documentation',
  verification: 'Verification Report',
  security: 'Security Report',
  presentation: 'Presentation Slides',
  demo: 'Demo Video',
  research: 'Research Notes',
  patent: 'Patent Notes',
  releaseNotes: 'Release Notes',
}

const EV_REQUIRED = new Set(['architecture','design','github','branch','pr','readme','apiDoc','verification','security','demo'])

function EvidenceStatusIcon({ status }: { status: string }) {
  if (status === 'Approved')   return <CheckCircle size={14} className="text-green-500" />
  if (status === 'Submitted')  return <CheckCircle size={14} className="text-brand-500" />
  if (status === 'Rejected')   return <XCircle size={14} className="text-red-500" />
  return <XCircle size={14} className="text-slate-300" />
}

export default function AssignmentDetail() {
  const assignments = useAssignments()
  const developers  = useDevelopers()
  const stories     = useStories()
  const simulators  = useSimulators()
  const { id } = useParams<{ id: string }>()
  const [tab, setTab] = useState('summary')

  const assignment = assignments.find(a => a.id === id)
  const developer = developers.find(d => d.id === assignment?.developerId)
  const story = stories.find(s => s.id === assignment?.storyId)
  const simulator = simulators.find(s => s.id === assignment?.simulatorId)

  if (!assignment || !developer || !story) {
    return (
      <div className="card text-center py-16">
        <ClipboardList size={40} className="mx-auto mb-3 opacity-30 text-slate-400" />
        <p className="text-slate-600 font-medium">Assignment {id} not found</p>
        <Link to="/assignments" className="btn-primary mt-4 inline-flex">← Back to Assignments</Link>
      </div>
    )
  }

  const accentCls =
    assignment.product === 'Battery Pack Aadhaar System' ? 'text-brand-600' :
    assignment.product === 'AS9102 FAI Reports Platform' ? 'text-emerald-600' : 'text-purple-600'

  // Progress calculations
  const simPct     = simulator ? calcSimulatorProgress(simulator.status) : 0
  const storyPct   = story.overallProgress
  const evidencePct = calcEvidenceProgress(assignment.evidence)
  const qaPct      = calcQAProgress(developer.qaStatus)
  const archPct    = calcArchitectProgress(developer.architectStatus)
  const overallPct = calcOverallProgress(simPct, storyPct, evidencePct, qaPct, archPct)
  const daysRem    = getDaysRemaining(assignment.dueDate)
  const risk       = getRiskLevel(daysRem, overallPct)
  const phases     = buildPhases(assignment)

  const evidenceEntries = Object.entries(assignment.evidence) as [keyof Assignment['evidence'], Assignment['evidence'][keyof Assignment['evidence']]][]
  const evidenceSubmitted = evidenceEntries.filter(([, v]) => v.status !== 'Missing').length

  function MetricRow({ label, value, node }: { label: string; value?: string; node?: React.ReactNode }) {
    return (
      <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 text-xs">
        <span className="text-slate-500 font-medium">{label}</span>
        {node ?? <span className="font-semibold text-slate-800">{value || <span className="text-slate-300 italic font-normal">—</span>}</span>}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${assignment.id}`}
        subtitle={`${assignment.product} · ${assignment.workPackage} · ${developer.name}`}
        icon={<ClipboardList size={18}/>}
        backTo="/assignments"
        backLabel="Assignments"
        actions={
          <div className="flex gap-2">
            <StatusBadge status={assignment.priority} size="xs" />
            <StatusBadge status={assignment.status} />
            <button onClick={() => window.print()} className="btn-secondary no-print">
              <Printer size={13}/> Print
            </button>
          </div>
        }
      />

      <TabNav tabs={TABS} activeTab={tab} onChange={setTab} />

      <div>

        {/* ── SUMMARY ─────────────────────────────────────── */}
        {tab === 'summary' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              {/* Manager KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Overall Progress', value: `${overallPct}%`, sub: 'Weighted avg', color: 'text-brand-700' },
                  { label: 'Days Remaining', value: `${daysRem}`, sub: 'Until due date', color: daysRem < 14 ? 'text-red-600' : daysRem < 30 ? 'text-amber-600' : 'text-slate-700' },
                  { label: 'Risk Level', node: <StatusBadge status={risk} />, sub: 'Schedule risk' },
                  { label: 'Simulator', value: `${simPct}%`, sub: simulator ? simulator.status : 'No simulator', color: 'text-purple-700' },
                  { label: 'Story', value: `${storyPct}%`, sub: `${story.status}`, color: 'text-brand-700' },
                  { label: 'Evidence', value: `${evidencePct}%`, sub: `${evidenceSubmitted}/14 items`, color: evidencePct === 100 ? 'text-green-600' : 'text-amber-600' },
                ].map(item => (
                  <div key={item.label} className="card p-3">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1">{item.label}</p>
                    {'node' in item ? item.node : <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>}
                    <p className="text-[10px] text-slate-400 mt-0.5">{item.sub}</p>
                  </div>
                ))}
              </div>

              {/* Progress bars */}
              <SectionCard title="Progress Breakdown">
                <div className="space-y-3">
                  {[
                    { label: 'Overall', pct: overallPct, color: 'bg-brand-600', weight: '—' },
                    { label: 'Story (40%)', pct: storyPct, color: 'bg-brand-500', weight: '40%' },
                    { label: 'Simulator (20%)', pct: simPct, color: 'bg-purple-500', weight: '20%' },
                    { label: 'Evidence (15%)', pct: evidencePct, color: 'bg-amber-500', weight: '15%' },
                    { label: 'QA (15%)', pct: qaPct, color: 'bg-yellow-500', weight: '15%' },
                    { label: 'Architect (10%)', pct: archPct, color: 'bg-green-500', weight: '10%' },
                  ].map(({ label, pct, color }) => (
                    <div key={label}>
                      <div className="flex justify-between text-xs text-slate-600 mb-1">
                        <span className="font-medium">{label}</span>
                        <span className="font-bold">{pct}%</span>
                      </div>
                      <ProgressBar value={pct} color={color} height="h-2" />
                    </div>
                  ))}
                </div>
              </SectionCard>

              {/* Next action */}
              <SectionCard title="Manager Summary">
                <div className="grid grid-cols-2 gap-4">
                  <MetricRow label="Current Status" node={<StatusBadge status={assignment.status} size="xs" />} />
                  <MetricRow label="Priority" node={<StatusBadge status={assignment.priority} size="xs" />} />
                  <MetricRow label="Current Phase" value={assignment.status} />
                  <MetricRow label="Due Date" value={assignment.dueDate} />
                  <MetricRow label="Days Remaining" value={`${daysRem} days`} />
                  <MetricRow label="Risk" node={<StatusBadge status={risk} size="xs" />} />
                </div>
              </SectionCard>
            </div>

            <div className="space-y-4">
              {/* Quick links */}
              <SectionCard title="Quick Navigation">
                <div className="space-y-1.5">
                  {[
                    { label: developer.name, sub: 'Developer Profile', to: `/developers/${developer.id}`, icon: <Users size={13}/> },
                    ...(simulator ? [{ label: simulator.name, sub: assignment.simulatorId, to: `/simulators/${simulator.id}`, icon: <FlaskConical size={13}/> }] : []),
                    { label: story.title, sub: `${assignment.storyId}`, to: `/stories/${story.id}`, icon: <FileText size={13}/> },
                  ].map(item => (
                    <Link key={item.label} to={item.to} className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-brand-50 group transition-colors border border-slate-100">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-brand-100 flex items-center justify-center text-slate-400 group-hover:text-brand-600 flex-shrink-0 transition-colors">
                        {item.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-800 truncate">{item.label}</p>
                        <p className="text-[10px] text-slate-400">{item.sub}</p>
                      </div>
                      <ArrowRight size={11} className="text-slate-300 group-hover:text-brand-500 flex-shrink-0" />
                    </Link>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Status Checklist">
                {[
                  { label: 'Assignment Accepted', done: !['Draft','Assigned'].includes(assignment.status) },
                  { label: 'Simulator Running', done: simPct > 30 },
                  { label: 'Story Development', done: storyPct > 50 },
                  { label: 'Evidence Submitted', done: evidencePct === 100 },
                  { label: 'QA Passed', done: developer.qaStatus === 'Passed' },
                  { label: 'Architect Approved', done: developer.architectStatus === 'Approved' },
                  { label: 'Demo Ready', done: assignment.status === 'Demo Ready' || assignment.status === 'Completed' },
                ].map(({ label, done }) => (
                  <div key={label} className="flex items-center gap-2 py-1.5 border-b border-slate-50 last:border-0 text-xs">
                    {done
                      ? <CheckCircle size={13} className="text-green-500 flex-shrink-0" />
                      : <Clock size={13} className="text-slate-300 flex-shrink-0" />}
                    <span className={done ? 'text-slate-700 font-medium' : 'text-slate-400'}>{label}</span>
                  </div>
                ))}
              </SectionCard>

              {assignment.dependencies.length > 0 && (
                <SectionCard title="Dependencies">
                  {assignment.dependencies.map(dep => (
                    <Link key={dep} to={`/assignments/${dep}`} className="block text-xs text-brand-600 hover:underline font-medium py-1">→ {dep}</Link>
                  ))}
                </SectionCard>
              )}
            </div>
          </div>
        )}

        {/* ── DETAILS ─────────────────────────────────────── */}
        {tab === 'details' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SectionCard title="Assignment Information">
              <MetricRow label="Assignment ID" value={assignment.id} />
              <MetricRow label="Product" value={assignment.product} />
              <MetricRow label="Work Package" value={assignment.workPackage} />
              <MetricRow label="Story" value={assignment.storyId} />
              <MetricRow label="Simulator" value={assignment.simulatorId} />
              <MetricRow label="Developer" value={developer.name} />
              <MetricRow label="QA" value={assignment.qaId || 'Unassigned'} />
              <MetricRow label="Architect" value={assignment.architectId} />
            </SectionCard>
            <SectionCard title="Schedule & Effort">
              <MetricRow label="Priority" node={<StatusBadge status={assignment.priority} size="xs" />} />
              <MetricRow label="Status" node={<StatusBadge status={assignment.status} size="xs" />} />
              <MetricRow label="Created Date" value={assignment.createdDate} />
              <MetricRow label="Due Date" value={assignment.dueDate} />
              <MetricRow label="Days Remaining" value={`${daysRem} days`} />
              <MetricRow label="Estimated Hours" value={`${assignment.estimatedHours} hours`} />
              <MetricRow label="Weekly Hours" value={`${assignment.weeklyHours} hrs/week`} />
              <MetricRow label="Overall Progress" value={`${overallPct}%`} />
            </SectionCard>
            {assignment.dependencies.length > 0 && (
              <SectionCard title="Dependencies" className="lg:col-span-2">
                <div className="flex flex-wrap gap-2">
                  {assignment.dependencies.map(dep => (
                    <Link key={dep} to={`/assignments/${dep}`}
                      className="px-3 py-1.5 bg-brand-50 text-brand-700 rounded-lg text-xs font-semibold border border-brand-100 hover:bg-brand-100">
                      {dep}
                    </Link>
                  ))}
                </div>
              </SectionCard>
            )}
          </div>
        )}

        {/* ── DEVELOPER ────────────────────────────────────── */}
        {tab === 'developer' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="space-y-4">
              <div className="card p-5 text-center">
                <div className="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-2xl font-bold mx-auto mb-3">
                  {developer.name.charAt(0)}
                </div>
                <h3 className="text-base font-bold text-slate-900">{developer.name}</h3>
                <p className="text-xs text-slate-500">{developer.email}</p>
                <p className="text-xs text-slate-400 mt-0.5">{developer.id}</p>
              </div>
              <SectionCard title="Status">
                {[
                  { label: 'Dev Status', status: developer.status },
                  { label: 'QA Status', status: developer.qaStatus },
                  { label: 'Architect', status: developer.architectStatus },
                  { label: 'Demo', status: developer.demoStatus },
                ].map(({ label, status }) => (
                  <div key={label} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                    <span className="text-xs text-slate-500">{label}</span>
                    <StatusBadge status={status} size="xs" />
                  </div>
                ))}
              </SectionCard>
            </div>
            <div className="lg:col-span-2 space-y-4">
              <SectionCard title="Developer Details">
                <MetricRow label="Name" value={developer.name} />
                <MetricRow label="Email" value={developer.email} />
                <MetricRow label="Developer ID" value={developer.id} />
                <MetricRow label="Availability" value={developer.weeklyAvailability} />
                <MetricRow label="Expected Hours/Week" value={developer.expectedWeeklyHours} />
              </SectionCard>
              <SectionCard title="GitHub & Links" icon={<Github size={13}/>}>
                {[
                  { label: 'GitHub Repo', value: developer.githubRepo },
                  { label: 'Feature Branch', value: developer.branch },
                  { label: 'Pull Request', value: developer.pullRequest },
                  { label: 'Drive Folder', value: developer.driveFolder },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0 text-xs">
                    <span className="text-slate-500">{label}</span>
                    {value
                      ? <a href={value} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline font-medium flex items-center gap-1">Open <ExternalLink size={10}/></a>
                      : <span className="text-slate-300 italic">Not set</span>}
                  </div>
                ))}
              </SectionCard>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { title: 'Mentor Notes', value: developer.mentorNotes, bg: 'bg-brand-50 border-brand-100' },
                  { title: 'QA Notes', value: developer.qaNotes, bg: 'bg-yellow-50 border-yellow-100' },
                  { title: 'Architect Notes', value: developer.architectNotes, bg: 'bg-green-50 border-green-100' },
                ].map(({ title, value, bg }) => (
                  <div key={title} className={`p-3 rounded-xl border ${bg}`}>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">{title}</p>
                    <p className="text-xs text-slate-700">{value || <span className="text-slate-300 italic">No notes</span>}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Link to={`/developers/${developer.id}`} className="btn-primary flex-1 justify-center">
                  <Users size={13}/> Open Profile
                </Link>
                <Link to={`/stories/${story.id}`} className="btn-secondary flex-1 justify-center">
                  <FileText size={13}/> Open Story
                </Link>
                {simulator && (
                  <Link to={`/simulators/${simulator.id}`} className="btn-secondary flex-1 justify-center">
                    <FlaskConical size={13}/> Open Simulator
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── SIMULATOR ────────────────────────────────────── */}
        {tab === 'simulator' && (
          simulator ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <SectionCard title="Simulator Summary">
                  <MetricRow label="Simulator ID" value={simulator.id} />
                  <MetricRow label="Name" value={simulator.name} />
                  <MetricRow label="Status" node={<StatusBadge status={simulator.status} size="xs" />} />
                  <MetricRow label="Test Status" node={<StatusBadge status={simulator.testStatus as 'Not Started'} size="xs" />} />
                  <MetricRow label="Evidence" node={<StatusBadge status={simulator.evidenceStatus} size="xs" />} />
                  <MetricRow label="Progress" value={`${simPct}%`} />
                </SectionCard>
                <SectionCard title="Purpose & Links">
                  <p className="text-sm text-slate-700 mb-4 leading-relaxed">{simulator.purpose}</p>
                  <div className="space-y-1">
                    {[
                      { label: 'GitHub', value: simulator.githubRepo, icon: <Github size={12}/> },
                      { label: 'Streamlit UI', value: simulator.streamlitLink, icon: <ExternalLink size={12}/> },
                      { label: 'FastAPI', value: simulator.apiLink, icon: <ExternalLink size={12}/> },
                    ].map(({ label, value, icon }) => (
                      <div key={label} className="flex items-center justify-between py-1.5 text-xs border-b border-slate-50 last:border-0">
                        <span className="text-slate-500 flex items-center gap-1.5">{icon}{label}</span>
                        {value
                          ? <a href={value} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline font-medium">Open</a>
                          : <span className="text-slate-300 italic">Not configured</span>}
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </div>
              <div className="flex gap-2">
                <Link to={`/simulators/${simulator.id}`} className="btn-primary">
                  <FlaskConical size={13}/> Open Simulator Detail
                </Link>
              </div>
            </div>
          ) : (
            <div className="card text-center py-12 text-slate-400">
              <FlaskConical size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">No simulator assigned</p>
              <p className="text-xs mt-1">This product uses a desktop application instead of a simulator.</p>
            </div>
          )
        )}

        {/* ── STORY ────────────────────────────────────────── */}
        {tab === 'story' && (
          <div className="space-y-4">
            <SectionCard title="Story Summary">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <MetricRow label="Story ID" value={story.id} />
                <MetricRow label="Status" node={<StatusBadge status={story.status} size="xs" />} />
                <MetricRow label="Priority" node={<StatusBadge status={story.priority} size="xs" />} />
                <MetricRow label="Progress" value={`${story.overallProgress}%`} />
              </div>
              <div className="mb-4">
                <ProgressBar value={story.overallProgress} color={
                  assignment.product === 'Battery Pack Aadhaar System' ? 'bg-brand-600' :
                  assignment.product === 'AS9102 FAI Reports Platform' ? 'bg-emerald-600' : 'bg-purple-600'
                } />
              </div>
              <div className="bg-brand-50 border border-brand-100 rounded-xl p-4">
                <p className="text-xs font-bold text-brand-600 mb-1 uppercase tracking-wide">User Story</p>
                <p className="text-sm text-slate-800 leading-relaxed italic">"{story.userStory}"</p>
              </div>
            </SectionCard>
            <SectionCard title="Business Goal">
              <p className="text-sm text-slate-700 leading-relaxed">{story.businessGoal}</p>
            </SectionCard>
            <SectionCard title="Acceptance Criteria (top 5)">
              <ol className="space-y-1.5">
                {story.acceptanceCriteria.slice(0, 5).map((ac, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-slate-700">
                    <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                    <span>{ac}</span>
                  </li>
                ))}
              </ol>
            </SectionCard>
            <div className="flex gap-2">
              <Link to={`/stories/${story.id}`} className="btn-primary">
                <FileText size={13}/> Open Full Story
              </Link>
              <button onClick={() => window.print()} className="btn-secondary no-print">
                <Printer size={13}/> Print Story
              </button>
            </div>
          </div>
        )}

        {/* ── TIMELINE ─────────────────────────────────────── */}
        {tab === 'timeline' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SectionCard title="Engineering Phase Timeline">
              <Timeline phases={phases} />
            </SectionCard>
            <div className="space-y-4">
              <SectionCard title="Current Phase">
                <div className="text-center py-4">
                  <p className={`text-2xl font-bold ${accentCls}`}>{assignment.status}</p>
                  <StatusBadge status={assignment.status} />
                </div>
              </SectionCard>
              <SectionCard title="Schedule">
                <MetricRow label="Created" value={assignment.createdDate} />
                <MetricRow label="Due Date" value={assignment.dueDate} />
                <MetricRow label="Days Remaining" value={`${daysRem} days`} />
                <MetricRow label="Risk" node={<StatusBadge status={risk} size="xs" />} />
                <MetricRow label="Estimated" value={`${assignment.estimatedHours} hrs total`} />
                <MetricRow label="Weekly" value={`${assignment.weeklyHours} hrs/week`} />
              </SectionCard>
            </div>
          </div>
        )}

        {/* ── EVIDENCE ─────────────────────────────────────── */}
        {tab === 'evidence' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="card p-4 text-center">
                <p className="text-2xl font-bold text-brand-700">{evidencePct}%</p>
                <p className="text-xs text-slate-400 mt-1">Completion</p>
              </div>
              <div className="card p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{evidenceSubmitted}</p>
                <p className="text-xs text-slate-400 mt-1">Submitted</p>
              </div>
              <div className="card p-4 text-center">
                <p className="text-2xl font-bold text-red-500">{14 - evidenceSubmitted}</p>
                <p className="text-xs text-slate-400 mt-1">Missing</p>
              </div>
            </div>
            <SectionCard title="Evidence Checklist" icon={<FolderOpen size={13}/>}>
              <div className="space-y-1">
                {evidenceEntries.map(([key, ev]) => (
                  <div key={String(key)} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors border border-slate-50">
                    <EvidenceStatusIcon status={ev.status} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-slate-800">{EV_LABELS[key]}</span>
                        {EV_REQUIRED.has(key as string) && <span className="text-[9px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full">REQUIRED</span>}
                      </div>
                      {ev.date && <p className="text-[10px] text-slate-400">Submitted: {ev.date}</p>}
                      {ev.comments && <p className="text-[10px] text-slate-500 italic">{ev.comments}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        ev.status === 'Approved'  ? 'bg-green-100 text-green-700' :
                        ev.status === 'Submitted' ? 'bg-brand-100 text-brand-700' :
                        ev.status === 'Rejected'  ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-400'
                      }`}>{ev.status}</span>
                      {ev.link && (
                        <a href={ev.link} target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:text-brand-700">
                          <ExternalLink size={12}/>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {/* ── QA ───────────────────────────────────────────── */}
        {tab === 'qa' && (
          <div className="space-y-4">
            <SectionCard title="QA Assignment" icon={<ClipboardCheck size={13}/>}>
              <MetricRow label="Assigned QA" value={assignment.qaId || 'Unassigned'} />
              <MetricRow label="QA Status" node={<StatusBadge status={developer.qaStatus} size="xs" />} />
              <MetricRow label="QA Progress" value={`${qaPct}%`} />
            </SectionCard>
            <SectionCard title="Pending Issues Tracker">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {['Critical','High','Medium','Low'].map(sev => (
                  <div key={sev} className={`p-4 rounded-xl text-center border ${
                    sev === 'Critical' ? 'bg-red-50 border-red-200' :
                    sev === 'High' ? 'bg-orange-50 border-orange-200' :
                    sev === 'Medium' ? 'bg-amber-50 border-amber-200' :
                    'bg-green-50 border-green-200'
                  }`}>
                    <p className="text-2xl font-bold text-slate-800">0</p>
                    <p className={`text-xs font-semibold mt-0.5 ${
                      sev === 'Critical' ? 'text-red-600' : sev === 'High' ? 'text-orange-600' :
                      sev === 'Medium' ? 'text-amber-600' : 'text-green-600'
                    }`}>{sev}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 italic mt-3 text-center">No issues logged yet — QA review has not started</p>
            </SectionCard>
            <Link to={`/stories/${story.id}?tab=qa`} className="btn-secondary inline-flex">
              <ClipboardCheck size={13}/> View Full QA Review →
            </Link>
          </div>
        )}

        {/* ── ARCHITECT ────────────────────────────────────── */}
        {tab === 'architect' && (
          <div className="space-y-4">
            <SectionCard title="Architect Review" icon={<ShieldCheck size={13}/>}>
              <MetricRow label="Architect" value={assignment.architectId} />
              <MetricRow label="Status" node={<StatusBadge status={developer.architectStatus} size="xs" />} />
              <MetricRow label="Progress" value={`${archPct}%`} />
            </SectionCard>
            <div className="grid grid-cols-3 gap-3">
              <button className="btn-primary justify-center py-3 opacity-50 cursor-not-allowed">
                <CheckCircle size={14}/> Approve
              </button>
              <button className="btn-secondary justify-center py-3 opacity-50 cursor-not-allowed">
                <AlertCircle size={14}/> Request Changes
              </button>
              <button className="border border-red-200 text-red-600 rounded-xl text-sm font-semibold flex items-center gap-2 justify-center py-3 opacity-50 cursor-not-allowed">
                <XCircle size={14}/> Reject
              </button>
            </div>
            <p className="text-xs text-slate-400 italic text-center">Architect actions available after QA approval</p>
            <Link to={`/stories/${story.id}?tab=architect`} className="btn-secondary inline-flex">
              <ShieldCheck size={13}/> View Full Architect Review →
            </Link>
          </div>
        )}

        {/* ── EMAIL ────────────────────────────────────────── */}
        {tab === 'email' && (
          <SectionCard title="Assignment Email Generator" icon={<Mail size={13}/>}>
            <EmailPreview
              assignment={assignment}
              developer={developer}
              story={story}
              simulator={simulator}
            />
          </SectionCard>
        )}

        {/* ── HISTORY ──────────────────────────────────────── */}
        {tab === 'history' && (
          <SectionCard title="Activity Timeline" icon={<History size={13}/>}>
            <div className="space-y-0">
              {[...assignment.history].reverse().map((entry, i) => (
                <div key={i} className="flex gap-4 pb-5">
                  <div className="flex flex-col items-center flex-shrink-0 w-8">
                    <div className="w-8 h-8 rounded-full bg-brand-100 border-2 border-brand-200 flex items-center justify-center">
                      <History size={13} className="text-brand-600" />
                    </div>
                    {i < assignment.history.length - 1 && <div className="w-0.5 flex-1 bg-slate-200 my-1" />}
                  </div>
                  <div className="pb-0">
                    <p className="text-sm font-semibold text-slate-800">{entry.action}</p>
                    <p className="text-xs text-slate-500 mt-0.5">By <span className="font-medium">{entry.by}</span> · {entry.date}</p>
                    {entry.note && <p className="text-xs text-slate-600 mt-1 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">{entry.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

      </div>
    </div>
  )
}
