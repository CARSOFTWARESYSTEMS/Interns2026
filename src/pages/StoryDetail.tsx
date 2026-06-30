import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { FileText, Printer, Shield, CheckCircle2, Trophy, ArrowRight } from 'lucide-react'
import type { Story, Developer } from '../types'
import storiesData from '../data/stories.json'
import developersData from '../data/developers.json'
import PageHeader from '../components/ui/PageHeader'
import TabNav from '../components/ui/TabNav'
import SectionCard from '../components/ui/SectionCard'
import StatusBadge from '../components/ui/StatusBadge'
import ProgressBar from '../components/ui/ProgressBar'
import EvidenceRow from '../components/ui/EvidenceRow'

const stories = storiesData as Story[]
const developers = developersData as Developer[]

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'story', label: 'Story' },
  { id: 'requirements', label: 'Requirements' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'json', label: 'JSON Schemas' },
  { id: 'usecases', label: 'Use Cases' },
  { id: 'tests', label: 'Test Cases' },
  { id: 'security', label: 'Security' },
  { id: 'verification', label: 'Verification' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'qa', label: 'QA Review' },
  { id: 'architect', label: 'Architect' },
  { id: 'demo', label: 'Final Demo' },
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

function BulletList({ items, color = 'text-brand-400' }: { items: string[]; color?: string }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm text-slate-700">
          <span className={`mt-0.5 flex-shrink-0 font-bold ${color}`}>›</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function CheckList({ items }: { items: string[] }) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <div className="w-4 h-4 rounded border-2 border-slate-300 mt-0.5 flex-shrink-0" />
          <span className="text-sm text-slate-700">{item}</span>
        </div>
      ))}
    </div>
  )
}

export default function StoryDetail() {
  const { id } = useParams<{ id: string }>()
  const [tab, setTab] = useState('overview')

  const story = stories.find(s => s.id === id)
  const developer = developers.find(d => d.id === story?.developerId)

  if (!story) {
    return (
      <div className="card text-center py-16">
        <FileText size={40} className="mx-auto mb-3 opacity-30 text-slate-400" />
        <p className="text-slate-600 font-medium">Story {id} not found</p>
        <Link to="/stories" className="btn-primary mt-4 inline-flex">← Back to Stories</Link>
      </div>
    )
  }

  const isProduct1 = story.product === 'Battery Pack Aadhaar System'
  const accentColor = isProduct1 ? 'text-brand-600' : 'text-purple-600'
  const progressColor = isProduct1 ? 'bg-brand-600' : 'bg-purple-600'
  const ev = story.evidence

  return (
    <div className="space-y-4">
      <PageHeader
        title={story.title}
        subtitle={`${story.id} · ${isProduct1 ? 'Product 1' : 'Product 2'} · Assigned to ${developer?.name ?? story.developerId}`}
        icon={<FileText size={18} />}
        backTo="/stories"
        backLabel="User Stories"
        actions={
          <div className="flex gap-2">
            <StatusBadge status={story.priority} size="xs" />
            <StatusBadge status={story.status} />
            <button onClick={() => window.print()} className="btn-secondary no-print">
              <Printer size={13}/> Print / Export
            </button>
          </div>
        }
      />

      <TabNav tabs={TABS} activeTab={tab} onChange={setTab} />

      <div>
        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <SectionCard title="Story Overview">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                  {[
                    { label: 'Story ID', value: story.id },
                    { label: 'Work Package', value: story.workPackage },
                    { label: 'Epic', value: story.epic },
                    { label: 'Priority', node: <StatusBadge status={story.priority} /> },
                    { label: 'Status', node: <StatusBadge status={story.status} /> },
                    { label: 'Risk', node: story.riskStatus ? <StatusBadge status={story.riskStatus as 'Not Started'} /> : <span className="text-xs text-slate-400">N/A</span> },
                    { label: 'QA Status', node: <StatusBadge status={story.qaStatus} /> },
                    { label: 'Architect', node: <StatusBadge status={story.architectStatus} /> },
                    { label: 'Demo', node: <StatusBadge status={story.demoStatus} /> },
                  ].map(item => (
                    <div key={item.label}>
                      <p className="data-label mb-1">{item.label}</p>
                      {'node' in item ? item.node : <p className="data-value">{item.value}</p>}
                    </div>
                  ))}
                </div>
                <div>
                  <p className="data-label mb-1">Overall Progress</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <ProgressBar value={story.overallProgress} color={progressColor} />
                    </div>
                    <span className="text-sm font-bold text-slate-700">{story.overallProgress}%</span>
                  </div>
                </div>
              </SectionCard>
              <SectionCard title="Business Goal">
                <p className="text-sm text-slate-700 leading-relaxed">{story.businessGoal}</p>
              </SectionCard>
              <SectionCard title="Problem Statement">
                <p className="text-sm text-slate-700 leading-relaxed">{story.problemStatement}</p>
              </SectionCard>
            </div>
            <div className="space-y-4">
              <div className="card p-4 text-center border-2 border-dashed border-slate-200">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2 ${isProduct1 ? 'bg-brand-50' : 'bg-purple-50'}`}>
                  <FileText size={22} className={accentColor} />
                </div>
                <p className={`text-[10px] font-bold tracking-widest mb-0.5 ${accentColor}`}>{story.id}</p>
                <p className="text-sm font-bold text-slate-900 leading-tight mb-1">{story.title}</p>
                <p className="text-xs text-slate-400">{story.product}</p>
              </div>
              <SectionCard title="Assignment">
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Developer</span>
                    <Link to={`/developers/${story.developerId}`} className={`font-semibold hover:underline ${accentColor}`}>
                      {developer?.name ?? story.developerId}
                    </Link>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Due Date</span>
                    <span className="font-semibold text-slate-700">{story.dueDate}</span>
                  </div>
                </div>
              </SectionCard>
              <SectionCard title="Simulator Dependencies">
                <div className="space-y-1.5">
                  {story.simulatorIds.map(sid => (
                    <Link key={sid} to={`/simulators/${sid}`} className="flex items-center gap-1.5 text-xs text-brand-600 hover:underline font-medium">
                      <ArrowRight size={11}/> {sid}
                    </Link>
                  ))}
                </div>
              </SectionCard>
              <SectionCard title="User Persona">
                <p className="text-sm text-slate-700 italic">"{story.userPersona}"</p>
              </SectionCard>
            </div>
          </div>
        )}

        {/* STORY */}
        {tab === 'story' && (
          <div className="space-y-4">
            <SectionCard title="User Story">
              <div className="bg-gradient-to-r from-brand-50 to-blue-50 border border-brand-100 rounded-xl p-5">
                <p className="text-sm text-brand-900 leading-relaxed font-medium italic">
                  "{story.userStory}"
                </p>
              </div>
            </SectionCard>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SectionCard title="Business Goal">
                <p className="text-sm text-slate-700 leading-relaxed">{story.businessGoal}</p>
              </SectionCard>
              <SectionCard title="Problem Statement">
                <p className="text-sm text-slate-700 leading-relaxed">{story.problemStatement}</p>
              </SectionCard>
            </div>
            <SectionCard title="User Persona">
              <p className="text-sm text-slate-700">{story.userPersona}</p>
            </SectionCard>
            <SectionCard title="Epic">
              <p className="text-sm font-semibold text-slate-800">{story.epic}</p>
            </SectionCard>
            <SectionCard title="Feature Description">
              <p className="text-sm text-slate-700 leading-relaxed">{story.description}</p>
            </SectionCard>
          </div>
        )}

        {/* REQUIREMENTS */}
        {tab === 'requirements' && (
          <div className="space-y-4">
            <SectionCard title="Functional Requirements">
              <ReqList items={story.functionalRequirements} />
            </SectionCard>
            <SectionCard title="Non-Functional Requirements">
              <BulletList items={story.nonFunctionalRequirements} />
            </SectionCard>
            <SectionCard title="UI / UX Requirements">
              <BulletList items={story.uiRequirements} color="text-purple-400" />
            </SectionCard>
          </div>
        )}

        {/* ARCHITECTURE */}
        {tab === 'architecture' && (
          <SectionCard title="Architecture Notes">
            <p className="text-sm text-slate-700 leading-relaxed font-mono bg-slate-50 p-5 rounded-xl border border-slate-200 whitespace-pre-wrap">
              {story.architectureNotes}
            </p>
          </SectionCard>
        )}

        {/* JSON SCHEMAS */}
        {tab === 'json' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SectionCard title="Sample Input JSON">
              <pre className="json-block">{JSON.stringify(story.sampleInputJson, null, 2)}</pre>
            </SectionCard>
            <SectionCard title="Sample Output JSON">
              <pre className="json-block">{JSON.stringify(story.sampleOutputJson, null, 2)}</pre>
            </SectionCard>
          </div>
        )}

        {/* USE CASES */}
        {tab === 'usecases' && (
          <div className="space-y-4">
            <SectionCard title="Acceptance Criteria">
              <CheckList items={story.acceptanceCriteria} />
            </SectionCard>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SectionCard title="Positive Use Cases">
                <BulletList items={story.positiveUseCases} color="text-green-500" />
              </SectionCard>
              <SectionCard title="Negative Use Cases">
                <BulletList items={story.negativeUseCases} color="text-red-500" />
              </SectionCard>
            </div>
          </div>
        )}

        {/* TEST CASES */}
        {tab === 'tests' && (
          <SectionCard title="Test Cases">
            <div className="space-y-3">
              {story.testCases.map(tc => (
                <div key={tc.id} className="p-3 border border-slate-100 rounded-lg hover:bg-slate-50">
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{tc.id}</code>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      tc.type === 'Unit' ? 'bg-blue-100 text-blue-700' :
                      tc.type === 'Integration' ? 'bg-purple-100 text-purple-700' :
                      tc.type === 'Negative' ? 'bg-red-100 text-red-700' :
                      tc.type === 'Security' ? 'bg-orange-100 text-orange-700' :
                      'bg-teal-100 text-teal-700'
                    }`}>{tc.type}</span>
                    <span className="text-sm font-semibold text-slate-800">{tc.name}</span>
                  </div>
                  <p className="text-xs text-slate-500">{tc.description}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* SECURITY */}
        {tab === 'security' && (
          <div className="space-y-4">
            <SectionCard title="Security Requirements" icon={<Shield size={14}/>}>
              <BulletList items={story.securityRequirements} color="text-orange-500" />
            </SectionCard>
            <SectionCard title="Security Test Cases" icon={<Shield size={14}/>}>
              <div className="space-y-2">
                {story.securityTestCases.map((tc, i) => (
                  <div key={i} className="flex gap-2 p-2.5 border border-orange-100 rounded-lg bg-orange-50 text-sm text-slate-700">
                    <span className="text-orange-400 flex-shrink-0 font-bold">›</span>
                    <span>{tc}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {/* VERIFICATION */}
        {tab === 'verification' && (
          <div className="space-y-4">
            <SectionCard title="Manual Verification Steps" icon={<CheckCircle2 size={14}/>}>
              <ol className="space-y-2">
                {story.manualVerificationSteps.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm text-slate-700">
                    <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </SectionCard>
            <SectionCard title="Definition of Done">
              <CheckList items={story.definitionOfDone} />
            </SectionCard>
          </div>
        )}

        {/* EVIDENCE */}
        {tab === 'evidence' && (
          <SectionCard title="Engineering Evidence">
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
                { label: 'QA Reviewer', value: story.qaReview.reviewer },
                { label: 'Review Date', value: story.qaReview.reviewDate },
                { label: 'QA Status', node: <StatusBadge status={story.qaReview.status} /> },
                { label: 'Severity', value: story.qaReview.severity },
                { label: 'Issues Found', value: story.qaReview.issuesFound },
                { label: 'Retest Status', value: story.qaReview.retestStatus },
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
                <p className="text-sm text-slate-700">{story.qaReview.comments || <span className="text-slate-400 italic">No comments yet</span>}</p>
              </div>
            </div>
          </SectionCard>
        )}

        {/* ARCHITECT APPROVAL */}
        {tab === 'architect' && (
          <SectionCard title="Architect Approval">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: 'Architect', value: story.architectApproval.reviewer },
                { label: 'Review Date', value: story.architectApproval.reviewDate },
                { label: 'Approval Status', node: <StatusBadge status={story.architectApproval.status} /> },
                { label: 'Final Decision', value: story.architectApproval.finalDecision },
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
                <p className="text-sm text-slate-700">{story.architectApproval.comments || <span className="text-slate-400 italic">No comments yet</span>}</p>
              </div>
            </div>
          </SectionCard>
        )}

        {/* FINAL DEMO */}
        {tab === 'demo' && (
          <div className="space-y-4">
            <SectionCard title="Final Demo Status" icon={<Trophy size={14}/>}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="data-label mb-1">Demo Status</p>
                  <StatusBadge status={story.finalDemo.status} />
                </div>
                <div>
                  <p className="data-label mb-1">Demo Date</p>
                  <p className="data-value">{story.finalDemo.demoDate || <span className="text-slate-300 italic font-normal">TBD</span>}</p>
                </div>
                <div>
                  <p className="data-label mb-1">Certificate Eligible</p>
                  <span className={`text-sm font-bold ${story.finalDemo.certificateEligible ? 'text-green-600' : 'text-slate-400'}`}>
                    {story.finalDemo.certificateEligible ? 'Yes ✓' : 'Not yet'}
                  </span>
                </div>
                <div>
                  <p className="data-label mb-1">Demo Video</p>
                  {story.finalDemo.demoLink
                    ? <a href={story.finalDemo.demoLink} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:underline font-medium">Watch Recording</a>
                    : <span className="text-xs text-slate-300 italic">Not uploaded</span>}
                </div>
                <div className="sm:col-span-2">
                  <p className="data-label mb-1">Demo Notes</p>
                  <p className="text-sm text-slate-700">{story.finalDemo.evSocietyComments || <span className="text-slate-400 italic">No notes yet</span>}</p>
                </div>
              </div>
            </SectionCard>
          </div>
        )}
      </div>
    </div>
  )
}
