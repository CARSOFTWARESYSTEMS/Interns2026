import { Settings as SettingsIcon, Database, Github, Mail, Calendar, Slack, Shield, Bell } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import SectionCard from '../components/ui/SectionCard'

function IntegrationCard({ icon, title, desc, status }: { icon: React.ReactNode; title: string; desc: string; status: 'planned' | 'active' | 'disabled' }) {
  return (
    <div className={`p-4 rounded-xl border flex items-start gap-3 ${
      status === 'active' ? 'bg-green-50 border-green-200' :
      status === 'planned' ? 'bg-slate-50 border-slate-200' :
      'bg-slate-50 border-slate-100 opacity-50'
    }`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
        status === 'active' ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-400'
      }`}>
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-bold text-slate-800">{title}</p>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
            status === 'active' ? 'bg-green-100 text-green-700' :
            status === 'planned' ? 'bg-amber-100 text-amber-700' :
            'bg-slate-200 text-slate-500'
          }`}>{status === 'active' ? 'Active' : status === 'planned' ? 'Planned' : 'Disabled'}</span>
        </div>
        <p className="text-xs text-slate-500">{desc}</p>
      </div>
    </div>
  )
}

export default function Settings() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Platform configuration and future integrations"
        icon={<SettingsIcon size={18}/>}
      />

      {/* Platform Info */}
      <SectionCard title="Platform Information">
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Platform', value: 'EV.ENGINEER™ Battery Trust Platform' },
            { label: 'Version', value: 'v1.0 — Milestone 02' },
            { label: 'Environment', value: 'Development (Local JSON)' },
            { label: 'Architecture', value: 'React 18 + TypeScript 5 + Vite 5' },
            { label: 'Styling', value: 'Tailwind CSS v3' },
            { label: 'Routing', value: 'React Router v6' },
            { label: 'Data Store', value: 'Local JSON (v1) → Firebase (v2)' },
            { label: 'Auth', value: 'None (v1) → Google OAuth (v2)' },
          ].map(({ label, value }) => (
            <div key={label} className="border-b border-slate-50 pb-2">
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{label}</p>
              <p className="text-sm font-semibold text-slate-800 mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Data Config */}
      <SectionCard title="Data Configuration" icon={<Database size={14}/>}>
        <div className="space-y-3">
          {[
            { file: 'developers.json', records: 10, desc: 'Intern developer profiles and assignment tracking' },
            { file: 'simulators.json', records: 10, desc: 'Python simulator specifications and evidence' },
            { file: 'stories.json', records: 10, desc: 'User story specifications and QA/architect review' },
            { file: 'assignments.json', records: 10, desc: 'Engineering assignment tracking and progress' },
            { file: 'weeklyPlan.json', records: 14, desc: 'Internship weekly schedule and phase timeline' },
          ].map(({ file, records, desc }) => (
            <div key={file} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <Database size={14} className="text-slate-400 flex-shrink-0"/>
              <div className="flex-1">
                <p className="text-xs font-bold text-slate-800 font-mono">{file}</p>
                <p className="text-[10px] text-slate-400">{desc}</p>
              </div>
              <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">{records} records</span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Future Integrations */}
      <SectionCard title="Future Integrations — Firebase Architecture">
        <div className="space-y-3">
          <IntegrationCard
            icon={<Database size={16}/>}
            title="Firebase Firestore"
            desc="Replace local JSON with real-time Firestore database. Zero architecture change — swap data layer only."
            status="planned"
          />
          <IntegrationCard
            icon={<Shield size={16}/>}
            title="Google OAuth 2.0"
            desc="Intern login with Google account. Role-based access: Intern, QA, Architect, Admin."
            status="planned"
          />
          <IntegrationCard
            icon={<Github size={16}/>}
            title="GitHub API"
            desc="Auto-sync repo activity, branch status, PR state, and commit history into assignments."
            status="planned"
          />
          <IntegrationCard
            icon={<Mail size={16}/>}
            title="Gmail API"
            desc="Send assignment emails, weekly reminders, and QA/architect notifications directly from the platform."
            status="planned"
          />
          <IntegrationCard
            icon={<Database size={16}/>}
            title="Google Drive API"
            desc="Auto-link evidence documents, auto-create intern Drive folders, check submission status."
            status="planned"
          />
          <IntegrationCard
            icon={<Calendar size={16}/>}
            title="Google Calendar API"
            desc="Sync demo dates, review schedules, and weekly check-ins to intern calendars automatically."
            status="planned"
          />
          <IntegrationCard
            icon={<Slack size={16}/>}
            title="Slack / Notifications"
            desc="Real-time status updates, QA pass/fail alerts, and daily progress digests via Slack or email."
            status="planned"
          />
          <IntegrationCard
            icon={<Bell size={16}/>}
            title="Push Notifications"
            desc="Browser push notifications for deadline alerts, QA review requests, and architect approvals."
            status="planned"
          />
        </div>
      </SectionCard>

      {/* Firebase Migration Plan */}
      <SectionCard title="Firebase Migration Roadmap">
        <div className="space-y-3">
          {[
            { phase: 'Phase A', title: 'Data Layer Swap', desc: 'Replace JSON imports with Firestore queries. No UI changes required.', effort: '2 days' },
            { phase: 'Phase B', title: 'Authentication', desc: 'Add Google OAuth login with Firebase Auth. Protect all routes with role check.', effort: '3 days' },
            { phase: 'Phase C', title: 'Real-time Updates', desc: 'Replace static data with Firestore onSnapshot listeners for live progress updates.', effort: '2 days' },
            { phase: 'Phase D', title: 'Storage & Drive', desc: 'Evidence file uploads via Firebase Storage. Auto-link to Google Drive folders.', effort: '3 days' },
            { phase: 'Phase E', title: 'Notifications', desc: 'Gmail API for emails, Firebase Cloud Messaging for push notifications.', effort: '4 days' },
          ].map(({ phase, title, desc, effort }) => (
            <div key={phase} className="flex gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="w-16 text-[10px] font-bold text-brand-600 flex-shrink-0 pt-0.5">{phase}</span>
              <div className="flex-1">
                <p className="text-xs font-bold text-slate-800">{title}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{desc}</p>
              </div>
              <span className="text-[10px] font-semibold text-slate-400 flex-shrink-0">{effort}</span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}
