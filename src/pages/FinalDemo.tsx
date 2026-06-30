import { Link } from 'react-router-dom'
import { Trophy, Video, Monitor, Star, CheckCircle, Clock } from 'lucide-react'
import type { Story, Developer } from '../types'
import storiesData from '../data/stories.json'
import developersData from '../data/developers.json'
import PageHeader from '../components/ui/PageHeader'
import StatusBadge from '../components/ui/StatusBadge'
import StatCard from '../components/ui/StatCard'
import SectionCard from '../components/ui/SectionCard'
import ProgressBar from '../components/ui/ProgressBar'

const stories = storiesData as Story[]
const developers = developersData as Developer[]
const devNames: Record<string, string> = Object.fromEntries(developers.map(d => [d.id, d.name]))

export default function FinalDemo() {
  const demoReady = stories.filter(s => s.demoStatus === 'Ready')
  const scheduled = stories.filter(s => s.demoStatus === 'In Preparation')
  const demoDone = stories.filter(s => s.demoStatus === 'Presented')
  const certEligible = stories.filter(s => s.finalDemo?.certificateEligible)
  const notReady = stories.filter(s => !['Ready','In Preparation','Presented'].includes(s.demoStatus))
  const architectApproved = stories.filter(s => s.architectStatus === 'Approved')

  const overallReadiness = Math.round((demoReady.length + scheduled.length + demoDone.length) / stories.length * 100)

  const groups = [
    { id: 'complete', label: 'Demo Complete', stories: demoDone, icon: <Trophy size={14} className="text-amber-500"/>, color: 'bg-amber-50 border-amber-200' },
    { id: 'scheduled', label: 'Scheduled for Demo', stories: scheduled, icon: <Monitor size={14} className="text-brand-500"/>, color: 'bg-brand-50 border-brand-200' },
    { id: 'ready', label: 'Demo Ready', stories: demoReady, icon: <CheckCircle size={14} className="text-green-500"/>, color: 'bg-green-50 border-green-200' },
    { id: 'not-ready', label: 'Not Yet Ready', stories: notReady, icon: <Clock size={14} className="text-slate-400"/>, color: 'bg-slate-50 border-slate-200' },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Final Demo"
        subtitle="Intern final demonstration dashboard · September 28–30, 2026"
        icon={<Trophy size={18} />}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard title="Demo Ready" value={demoReady.length} icon={<CheckCircle size={18}/>} color="text-green-600" subtitle="Ready to present" />
        <StatCard title="Demo Complete" value={demoDone.length} icon={<Trophy size={18}/>} color="text-amber-600" subtitle="Presented" />
        <StatCard title="Certificate Eligible" value={certEligible.length} icon={<Star size={18}/>} color="text-brand-600" subtitle="Cleared all gates" />
        <StatCard title="Arch Approved" value={architectApproved.length} icon={<CheckCircle size={18}/>} color="text-purple-600" subtitle="Architecture cleared" />
      </div>

      {/* Overall Readiness */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-slate-700">Demo Readiness</p>
          <span className="text-sm font-bold text-slate-800">{overallReadiness}%</span>
        </div>
        <ProgressBar value={overallReadiness} color="bg-amber-500" />
        <p className="text-xs text-slate-400 mt-2">{demoReady.length + demoDone.length} of {stories.length} stories ready or presented</p>
      </div>

      {/* Demo Day Info */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 text-center border-2 border-amber-200">
          <Trophy size={24} className="text-amber-500 mx-auto mb-2" />
          <p className="text-base font-bold text-slate-900">Demo Day</p>
          <p className="text-sm text-amber-600 font-medium">Sept 28–30, 2026</p>
          <p className="text-xs text-slate-400 mt-1">Final presentation to stakeholders</p>
        </div>
        <div className="card p-4 text-center">
          <Video size={24} className="text-brand-500 mx-auto mb-2" />
          <p className="text-base font-bold text-slate-900">Demo Format</p>
          <p className="text-sm text-slate-600 font-medium">Live + Recorded</p>
          <p className="text-xs text-slate-400 mt-1">5-min demo + Q&A per intern</p>
        </div>
        <div className="card p-4 text-center">
          <Star size={24} className="text-purple-500 mx-auto mb-2" />
          <p className="text-base font-bold text-slate-900">Certificate</p>
          <p className="text-sm text-slate-600 font-medium">EV.ENGINEER™ Certified</p>
          <p className="text-xs text-slate-400 mt-1">Issued on architect approval</p>
        </div>
      </div>

      {/* Story Groups */}
      {groups.map(({ id, label, stories: groupStories, icon, color }) => (
        <SectionCard key={id} title={`${label} (${groupStories.length})`} icon={icon}>
          {groupStories.length === 0 ? (
            <p className="text-xs text-slate-400 italic">None</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {groupStories.map(story => (
                <div key={story.id} className={`p-3 rounded-xl border ${color}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`text-[10px] font-bold tracking-widest ${story.product === 'Battery Pack Aadhaar System' ? 'text-brand-600' : 'text-purple-600'}`}>
                          {story.id}
                        </span>
                        {story.finalDemo?.certificateEligible && (
                          <Star size={11} className="text-amber-500" />
                        )}
                      </div>
                      <p className="text-sm font-bold text-slate-900 leading-tight">{story.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{devNames[story.developerId] ?? story.developerId}</p>
                    </div>
                    <StatusBadge status={story.demoStatus} size="xs" />
                  </div>

                  <div className="mt-2 space-y-1 text-xs text-slate-500">
                    <div className="flex justify-between">
                      <span>QA Status</span>
                      <StatusBadge status={story.qaStatus} size="xs" />
                    </div>
                    <div className="flex justify-between">
                      <span>Architect</span>
                      <StatusBadge status={story.architectStatus} size="xs" />
                    </div>
                    {story.finalDemo?.demoDate && (
                      <div className="flex justify-between">
                        <span>Demo Date</span>
                        <span className="font-medium text-slate-700">{story.finalDemo.demoDate}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mt-2.5">
                    {story.finalDemo?.demoLink && (
                      <a href={story.finalDemo.demoLink} target="_blank" rel="noopener noreferrer"
                        className="btn-secondary text-[10px] px-2 py-1 flex items-center gap-1">
                        <Video size={10}/> Video
                      </a>
                    )}
                    <Link to={`/stories/${story.id}?tab=demo`} className="btn-primary text-[10px] px-2 py-1 flex-1 justify-center">
                      View →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      ))}

      {/* Certificate Eligibility Criteria */}
      <SectionCard title="Certificate Eligibility Criteria" icon={<Star size={14}/>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {[
            'Simulator fully developed and tested',
            'User story implemented with all requirements',
            'All evidence documents submitted',
            'QA review passed (no critical issues)',
            'Architect approval received',
            'Demo video recorded and uploaded',
            'Final demo presented successfully',
            'Definition of Done checked off completely',
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-slate-700 p-2 bg-amber-50 rounded-lg border border-amber-100">
              <Star size={11} className="text-amber-500 flex-shrink-0" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}
