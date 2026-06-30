import { useState } from 'react'
import { Mail, CheckCircle, Clock, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Assignment, Developer, Story, Simulator } from '../types'
import assignmentsData from '../data/assignments.json'
import developersData from '../data/developers.json'
import storiesData from '../data/stories.json'
import simulatorsData from '../data/simulators.json'
import PageHeader from '../components/ui/PageHeader'
import SectionCard from '../components/ui/SectionCard'
import StatusBadge from '../components/ui/StatusBadge'

const assignments = assignmentsData as Assignment[]
const developers = developersData as Developer[]
const stories = storiesData as Story[]
const simulators = simulatorsData as Simulator[]

const devMap = Object.fromEntries(developers.map(d => [d.id, d]))
const storyMap = Object.fromEntries(stories.map(s => [s.id, s.title]))
const simMap = Object.fromEntries(simulators.map(s => [s.id, s.name]))

export default function EmailQueue() {
  const [generated, setGenerated] = useState<Set<string>>(new Set())

  function markGenerated(id: string) {
    setGenerated(prev => new Set([...prev, id]))
  }

  const pending = assignments.filter(a => !generated.has(a.id))
  const done = assignments.filter(a => generated.has(a.id))

  return (
    <div className="space-y-4">
      <PageHeader
        title="Email Queue"
        subtitle="Generate and manage assignment emails for all interns"
        icon={<Mail size={18}/>}
      />

      {/* Info Banner */}
      <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 flex items-start gap-3">
        <Mail size={16} className="text-amber-500 flex-shrink-0 mt-0.5"/>
        <div>
          <p className="text-sm font-semibold text-amber-800">Gmail API Integration — Planned</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Email sending via Gmail API is planned for a future milestone.
            For now, generate each email, preview it, and send manually.
            Click "Generate &amp; Preview" to open the full email preview for any assignment.
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-slate-700">{assignments.length}</p>
          <p className="text-xs text-slate-400 mt-1">Total Emails</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{pending.length}</p>
          <p className="text-xs text-slate-400 mt-1">Pending</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{done.length}</p>
          <p className="text-xs text-slate-400 mt-1">Generated</p>
        </div>
      </div>

      {/* Pending */}
      <SectionCard title={`Pending (${pending.length})`} icon={<Clock size={14}/>}>
        {pending.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle size={32} className="text-green-400 mx-auto mb-2"/>
            <p className="text-sm text-slate-500">All emails generated!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pending.map(a => {
              const dev = devMap[a.developerId]
              const isProduct1 = a.product === 'Battery Pack Aadhaar System'
              return (
                <div key={a.id} className="flex items-center gap-4 p-3 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${isProduct1 ? 'bg-brand-100 text-brand-700' : 'bg-purple-100 text-purple-700'}`}>
                    {dev?.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-bold text-slate-900">{dev?.name}</p>
                      <StatusBadge status={a.priority} size="xs" />
                    </div>
                    <p className="text-xs text-slate-500">
                      <span className="font-mono">{a.id}</span> · <span className="font-mono">{a.storyId}</span> · {storyMap[a.storyId]}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      To: {dev?.email} · Simulator: {simMap[a.simulatorId]}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => markGenerated(a.id)} className="btn-secondary text-xs">
                      <CheckCircle size={12}/> Mark Done
                    </button>
                    <Link to={`/assignments/${a.id}?tab=email`} className="btn-primary text-xs">
                      Generate <ArrowRight size={12}/>
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>

      {/* Generated */}
      {done.length > 0 && (
        <SectionCard title={`Generated (${done.length})`} icon={<CheckCircle size={14} className="text-green-500"/>}>
          <div className="space-y-2">
            {done.map(a => {
              const dev = devMap[a.developerId]
              return (
                <div key={a.id} className="flex items-center gap-4 p-3 border border-green-100 rounded-xl bg-green-50">
                  <CheckCircle size={16} className="text-green-500 flex-shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{dev?.name}</p>
                    <p className="text-xs text-slate-500 font-mono">{a.id} · {a.storyId}</p>
                  </div>
                  <Link to={`/assignments/${a.id}?tab=email`} className="btn-secondary text-xs">
                    Re-generate
                  </Link>
                </div>
              )
            })}
          </div>
        </SectionCard>
      )}

      {/* Future Roadmap */}
      <SectionCard title="Future: Gmail API Integration">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { step: '1', title: 'OAuth 2.0 Login', desc: 'Sign in with Google using OAuth to get Gmail send permissions' },
            { step: '2', title: 'Compose Email', desc: 'Generate assignment email with pre-filled content per intern' },
            { step: '3', title: 'Send / Schedule', desc: 'Send immediately or schedule for a specific date and time' },
            { step: '4', title: 'Track Delivery', desc: 'Monitor open rates, read receipts, and intern replies' },
          ].map(({ step, title, desc }) => (
            <div key={step} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex gap-3">
              <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{step}</span>
              <div>
                <p className="text-xs font-bold text-slate-800">{title}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}
