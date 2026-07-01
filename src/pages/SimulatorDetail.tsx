import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { CheckCircle2, Copy, Download, ExternalLink, FileText, FlaskConical, Github, Globe, Printer, Shield, Terminal } from 'lucide-react'
import { useAssignments, useDevelopers, useSimulators, useStories, useWeeklyPlan } from '../data/DataProvider'
import PageHeader from '../components/ui/PageHeader'
import TabNav from '../components/ui/TabNav'
import SectionCard from '../components/ui/SectionCard'
import StatusBadge from '../components/ui/StatusBadge'
import EvidenceRow from '../components/ui/EvidenceRow'
import { copyHtml, downloadHtml, generateSimulatorHtml, sanitizeFilename } from '../utils/htmlExport'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'scope', label: 'Scope' },
  { id: 'requirements', label: 'Requirements' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'json', label: 'JSON Schemas' },
  { id: 'cli', label: 'CLI & API' },
  { id: 'tests', label: 'Test Cases' },
  { id: 'security', label: 'Security' },
  { id: 'verification', label: 'Verification' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'qa', label: 'QA Review' },
  { id: 'architect', label: 'Architect' },
]

function ReqList({ items }: { items: string[] }) {
  return (
    <ol className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="req-item">
          <span className="req-num">{i + 1}</span>
          <span className="text-sm text-slate-700">{item}</span>
        </li>
      ))}
    </ol>
  )
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm text-slate-700">
          <span className="text-brand-400 mt-0.5 flex-shrink-0">›</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export default function SimulatorDetail() {
  const simulators = useSimulators()
  const developers = useDevelopers()
  const stories = useStories()
  const assignments = useAssignments()
  const weeklyPlan = useWeeklyPlan()
  const { id } = useParams<{ id: string }>()
  const [tab, setTab] = useState('overview')
  const [copied, setCopied] = useState(false)

  const sim = simulators.find(s => s.id === id)
  const owner = developers.find(d => d.id === sim?.ownerId)

  if (!sim) {
    return (
      <div className="card text-center py-16">
        <FlaskConical size={40} className="mx-auto mb-3 opacity-30 text-slate-400" />
        <p className="text-slate-600 font-medium">Simulator {id} not found</p>
        <Link to="/simulators" className="btn-primary mt-4 inline-flex">← Back to Simulators</Link>
      </div>
    )
  }

  const ev = sim.evidence
  const simulatorHtml = generateSimulatorHtml(sim, owner, stories, assignments, weeklyPlan)
  const simulatorFilename = `${sanitizeFilename(sim.id)}_${sanitizeFilename(sim.name)}_Simulator.html`

  async function handleCopyHtml() {
    await copyHtml(simulatorHtml)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={sim.name}
        subtitle={`${sim.id} · Owned by ${owner?.name ?? sim.ownerId} · ${sim.product}`}
        icon={<FlaskConical size={18} />}
        backTo="/simulators"
        backLabel="Simulators"
        actions={
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={sim.status} />
            <button onClick={() => downloadHtml(simulatorFilename, simulatorHtml)} className="btn-primary no-print">
              <Download size={13}/> Download HTML
            </button>
            <button onClick={handleCopyHtml} className="btn-secondary no-print">
              {copied ? <CheckCircle2 size={13} className="text-green-500"/> : <Copy size={13}/>}
              {copied ? 'Copied' : 'Copy HTML'}
            </button>
            <button onClick={() => window.print()} className="btn-secondary no-print">
              <Printer size={13}/> Print
            </button>
            {sim.githubRepo && (
              <a href={sim.githubRepo} target="_blank" rel="noopener noreferrer" className="btn-secondary no-print">
                <Github size={13}/> GitHub
              </a>
            )}
          </div>
        }
      />

      <TabNav tabs={TABS} activeTab={tab} onChange={setTab} />

      <div>
        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <SectionCard title="Simulator Overview">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {[
                    { label: 'Simulator ID', value: sim.id },
                    { label: 'Owner', value: owner?.name ?? sim.ownerId },
                    { label: 'Product', value: sim.product },
                    { label: 'Status', node: <StatusBadge status={sim.status} /> },
                    { label: 'Test Status', node: <StatusBadge status={sim.testStatus as 'Not Started'} /> },
                    { label: 'Evidence', node: <StatusBadge status={sim.evidenceStatus} /> },
                  ].map(item => (
                    <div key={item.label}>
                      <p className="data-label mb-1">{item.label}</p>
                      {'node' in item ? item.node : <p className="data-value">{item.value}</p>}
                    </div>
                  ))}
                </div>
              </SectionCard>
              <SectionCard title="Purpose">
                <p className="text-sm text-slate-700 leading-relaxed">{sim.purpose}</p>
              </SectionCard>
              <SectionCard title="Business Goal">
                <p className="text-sm text-slate-700 leading-relaxed">{sim.businessGoal}</p>
              </SectionCard>
              <SectionCard title="Problem Statement">
                <p className="text-sm text-slate-700 leading-relaxed">{sim.problemStatement}</p>
              </SectionCard>
            </div>
            <div className="space-y-4">
              <SectionCard title="User Personas">
                <ul className="space-y-2">
                  {sim.userPersonas.map(p => (
                    <li key={p} className="flex items-center gap-2 text-sm text-slate-700">
                      <span className="w-2 h-2 rounded-full bg-brand-400 flex-shrink-0" />
                      {p}
                    </li>
                  ))}
                </ul>
              </SectionCard>
              <SectionCard title="Links">
                {[
                  { label: 'GitHub Repo', value: sim.githubRepo, icon: <Github size={12}/> },
                  { label: 'Streamlit UI', value: sim.streamlitLink, icon: <Globe size={12}/> },
                  { label: 'API Endpoint', value: sim.apiLink, icon: <ExternalLink size={12}/> },
                ].map(({ label, value, icon }) => (
                  <div key={label} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0 text-xs">
                    <span className="text-slate-500 flex items-center gap-1.5">{icon}{label}</span>
                    {value
                      ? <a href={value} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline font-medium">Open</a>
                      : <span className="text-slate-300 italic">Not configured</span>}
                  </div>
                ))}
              </SectionCard>
              <SectionCard title="Used By Stories">
                <div className="space-y-1.5">
                  {sim.usedByStories.map(sId => (
                    <Link key={sId} to={`/stories/${sId}`} className="block text-xs text-brand-600 hover:underline font-medium">→ {sId}</Link>
                  ))}
                </div>
              </SectionCard>
            </div>
          </div>
        )}

        {/* SCOPE */}
        {tab === 'scope' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[
              { title: '✓ What it Simulates', items: sim.scope.simulates, color: 'text-green-600' },
              { title: '✗ What it Does NOT Simulate', items: sim.scope.doesNotSimulate, color: 'text-red-500' },
              { title: 'Inputs', items: sim.scope.inputs, color: 'text-brand-600' },
              { title: 'Outputs', items: sim.scope.outputs, color: 'text-purple-600' },
              { title: 'Assumptions', items: sim.scope.assumptions, color: 'text-amber-600' },
              { title: 'Limitations', items: sim.scope.limitations, color: 'text-orange-500' },
            ].map(({ title, items, color }) => (
              <SectionCard key={title} title={title}>
                <ul className="space-y-1.5">
                  {items.map((item, i) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-700">
                      <span className={`mt-0.5 flex-shrink-0 font-bold ${color}`}>›</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            ))}
          </div>
        )}

        {/* REQUIREMENTS */}
        {tab === 'requirements' && (
          <div className="space-y-4">
            <SectionCard title="Functional Requirements">
              <ReqList items={sim.functionalRequirements} />
            </SectionCard>
            <SectionCard title="Non-Functional Requirements">
              <BulletList items={sim.nonFunctionalRequirements} />
            </SectionCard>
            <SectionCard title="Technology Requirements">
              <div className="flex flex-wrap gap-2">
                {sim.technologyRequirements.map(tech => (
                  <span key={tech} className="px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-100 text-brand-800 border border-brand-200">{tech}</span>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {/* ARCHITECTURE */}
        {tab === 'architecture' && (
          <div className="space-y-4">
            <SectionCard title="Architecture Notes">
              <p className="text-sm text-slate-700 leading-relaxed font-mono bg-slate-50 p-4 rounded-lg border border-slate-200">{sim.architectureNotes}</p>
            </SectionCard>
            <SectionCard title="Technology Stack">
              <div className="flex flex-wrap gap-2">
                {sim.technologyRequirements.map(tech => (
                  <div key={tech} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-100">{tech}</div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {/* JSON SCHEMAS */}
        {tab === 'json' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SectionCard title="Sample Input JSON">
              <pre className="json-block">{JSON.stringify(sim.sampleInputJson, null, 2)}</pre>
            </SectionCard>
            <SectionCard title="Sample Output JSON">
              <pre className="json-block">{JSON.stringify(sim.sampleOutputJson, null, 2)}</pre>
            </SectionCard>
          </div>
        )}

        {/* CLI & API */}
        {tab === 'cli' && (
          <div className="space-y-4">
            <SectionCard title="CLI Commands" icon={<Terminal size={14}/>}>
              <div className="space-y-2">
                {sim.cliCommands.map((cmd, i) => (
                  <div key={i} className="bg-slate-900 text-green-400 rounded-lg px-4 py-2.5 font-mono text-xs">{cmd}</div>
                ))}
              </div>
            </SectionCard>
            <SectionCard title="REST API Endpoints">
              <div className="space-y-2">
                {sim.apiEndpoints.map((ep, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                      ep.method === 'POST' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                    }`}>{ep.method}</span>
                    <code className="text-xs font-mono text-slate-800 font-semibold flex-shrink-0">{ep.path}</code>
                    <span className="text-xs text-slate-500">{ep.description}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {/* TEST CASES */}
        {tab === 'tests' && (
          <SectionCard title="Test Cases">
            <div className="space-y-3">
              {sim.testCases.map(tc => (
                <div key={tc.id} className="p-3 border border-slate-100 rounded-lg hover:bg-slate-50">
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{tc.id}</code>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      tc.type === 'Unit' ? 'bg-blue-100 text-blue-700' :
                      tc.type === 'Integration' ? 'bg-purple-100 text-purple-700' :
                      tc.type === 'Negative' ? 'bg-red-100 text-red-700' :
                      tc.type === 'Security' ? 'bg-orange-100 text-orange-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>{tc.type}</span>
                    <span className="text-sm font-semibold text-slate-800">{tc.name}</span>
                  </div>
                  <p className="text-xs text-slate-500 ml-0">{tc.description}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* SECURITY */}
        {tab === 'security' && (
          <SectionCard title="Security Requirements" icon={<Shield size={14}/>}>
            <BulletList items={sim.securityRequirements} />
          </SectionCard>
        )}

        {/* VERIFICATION */}
        {tab === 'verification' && (
          <div className="space-y-4">
            <SectionCard title="Manual Verification Steps" icon={<CheckCircle2 size={14}/>}>
              <ol className="space-y-2">
                {sim.manualVerificationSteps.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm text-slate-700">
                    <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </SectionCard>
            <SectionCard title="Definition of Done">
              <div className="space-y-2">
                {sim.definitionOfDone.map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="w-4 h-4 rounded border-2 border-slate-300 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-700">{item}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {/* EVIDENCE */}
        {tab === 'evidence' && (
          <SectionCard title="Engineering Evidence" icon={<FileText size={14}/>}>
            <EvidenceRow label="Google Drive Folder" value={ev.driveFolder} />
            <EvidenceRow label="GitHub Repository" value={ev.githubRepo} />
            <EvidenceRow label="GitHub Branch" value={ev.branch} />
            <EvidenceRow label="Pull Request" value={ev.pullRequest} />
            <EvidenceRow label="Architecture Document" value={ev.architectureDoc} />
            <EvidenceRow label="Design Document" value={ev.designDoc} />
            <EvidenceRow label="README" value={ev.readme} />
            <EvidenceRow label="API Documentation" value={ev.apiDoc} />
            <EvidenceRow label="Test Report" value={ev.testReport} />
            <EvidenceRow label="Coverage Report" value={ev.coverageReport} />
            <EvidenceRow label="Security Report" value={ev.securityReport} required={false} />
            <EvidenceRow label="Verification Report" value={ev.verificationReport} />
            <EvidenceRow label="Demo Video" value={ev.demoVideo} />
            <EvidenceRow label="Presentation" value={ev.presentation} required={false} />
            <EvidenceRow label="Screenshots" value={ev.screenshots} required={false} />
            <EvidenceRow label="Release Notes" value={ev.releaseNotes} required={false} />
          </SectionCard>
        )}

        {/* QA REVIEW */}
        {tab === 'qa' && (
          <SectionCard title="QA Review">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: 'QA Reviewer', value: sim.qaReview.reviewer },
                { label: 'Review Date', value: sim.qaReview.reviewDate },
                { label: 'QA Status', node: <StatusBadge status={sim.qaReview.status} /> },
                { label: 'Severity', value: sim.qaReview.severity },
                { label: 'Issues Found', value: sim.qaReview.issuesFound },
                { label: 'Retest Status', value: sim.qaReview.retestStatus },
              ].map(item => (
                <div key={item.label}>
                  <p className="data-label mb-1">{item.label}</p>
                  {'node' in item
                    ? item.node
                    : <p className="data-value">{item.value || <span className="text-slate-300 italic font-normal">Pending</span>}</p>}
                </div>
              ))}
              <div className="sm:col-span-2">
                <p className="data-label mb-1">QA Comments</p>
                <p className="text-sm text-slate-700">{sim.qaReview.comments || <span className="text-slate-300 italic">No comments yet</span>}</p>
              </div>
            </div>
          </SectionCard>
        )}

        {/* ARCHITECT APPROVAL */}
        {tab === 'architect' && (
          <SectionCard title="Architect Approval">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: 'Architect', value: sim.architectApproval.reviewer },
                { label: 'Review Date', value: sim.architectApproval.reviewDate },
                { label: 'Approval Status', node: <StatusBadge status={sim.architectApproval.status} /> },
                { label: 'Final Decision', value: sim.architectApproval.finalDecision },
              ].map(item => (
                <div key={item.label}>
                  <p className="data-label mb-1">{item.label}</p>
                  {'node' in item
                    ? item.node
                    : <p className="data-value">{item.value || <span className="text-slate-300 italic font-normal">Pending</span>}</p>}
                </div>
              ))}
              <div className="sm:col-span-2">
                <p className="data-label mb-1">Architect Comments</p>
                <p className="text-sm text-slate-700">{sim.architectApproval.comments || <span className="text-slate-300 italic">No comments yet</span>}</p>
              </div>
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  )
}
