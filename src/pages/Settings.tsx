import { useState } from 'react'
import {
  Settings as SettingsIcon, Database, Github, Mail, Calendar,
  Slack, Shield, Bell, CloudOff, Cloud, RefreshCw, Download,
  Upload, HardDrive, CheckCircle, XCircle, Loader2,
} from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import SectionCard from '../components/ui/SectionCard'
import { useData } from '../data/DataProvider'
import { DATA_MODE } from '../data/types'
import type { CollectionName } from '../data/types'

// ── Sub-components ────────────────────────────────────────────────────────

function IntegrationCard({ icon, title, desc, status }: {
  icon: React.ReactNode; title: string; desc: string
  status: 'planned' | 'active' | 'disabled'
}) {
  return (
    <div className={`p-4 rounded-xl border flex items-start gap-3 ${
      status === 'active'   ? 'bg-green-50 border-green-200' :
      status === 'planned'  ? 'bg-slate-50 border-slate-200' :
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
            status === 'active'  ? 'bg-green-100 text-green-700'  :
            status === 'planned' ? 'bg-amber-100 text-amber-700'  :
                                   'bg-slate-200 text-slate-500'
          }`}>
            {status === 'active' ? 'Active' : status === 'planned' ? 'Planned' : 'Disabled'}
          </span>
        </div>
        <p className="text-xs text-slate-500">{desc}</p>
      </div>
    </div>
  )
}

const MODE_LABELS: Record<string, string> = {
  local:    'Local (bundled JSON + localStorage)',
  gdrive:   'Google Drive (OAuth + Drive API)',
  firebase: 'Firebase Firestore',
}

// ── Data Mode Panel ───────────────────────────────────────────────────────

function DataModePanel() {
  const { status, connect, disconnect, sync, backup, exportAll, importFile, reload } = useData()
  const [busy, setBusy]       = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [importCol, setImportCol] = useState<CollectionName>('developers')

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label)
    setFeedback(null)
    try {
      const result = await fn()
      if (result && typeof result === 'object' && 'error' in result) {
        setFeedback(`Error: ${(result as { error: string }).error}`)
      } else {
        setFeedback(`${label} completed successfully`)
      }
    } catch (e) {
      setFeedback(`Error: ${(e as Error).message}`)
    } finally {
      setBusy(null)
    }
  }

  const collections: CollectionName[] = ['developers', 'simulators', 'stories', 'assignments', 'weeklyPlan']

  return (
    <SectionCard title="Data Mode" icon={<HardDrive size={14}/>}>
      {/* Mode Badge */}
      <div className="flex items-center gap-3 mb-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          DATA_MODE === 'firebase' ? 'bg-orange-100 text-orange-600' :
          DATA_MODE === 'gdrive'   ? 'bg-blue-100 text-blue-600'     :
                                     'bg-slate-200 text-slate-500'
        }`}>
          {DATA_MODE === 'gdrive' ? <Cloud size={16}/> : <Database size={16}/>}
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Active Mode</p>
          <p className="text-sm font-bold text-slate-800">{MODE_LABELS[DATA_MODE]}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {status.connected
            ? <CheckCircle size={14} className="text-green-500"/>
            : <XCircle size={14} className="text-red-400"/>}
          <span className={`text-xs font-semibold ${status.connected ? 'text-green-600' : 'text-red-500'}`}>
            {status.connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* GDrive-specific: Connect / Disconnect */}
      {DATA_MODE === 'gdrive' && (
        <div className="flex flex-wrap gap-2 mb-4">
          {!status.connected ? (
            <button
              onClick={() => run('Connect', connect)}
              disabled={!!busy}
              className="btn-primary text-xs"
            >
              {busy === 'Connect' ? <Loader2 size={12} className="animate-spin"/> : <Cloud size={12}/>}
              Connect Google Drive
            </button>
          ) : (
            <button
              onClick={() => { disconnect(); setFeedback('Disconnected from Google Drive') }}
              className="btn-secondary text-xs text-red-600 border-red-200 hover:bg-red-50"
            >
              <CloudOff size={12}/> Disconnect
            </button>
          )}
        </div>
      )}

      {/* Last sync info */}
      {status.lastSync && (
        <p className="text-[10px] text-slate-400 mb-3">
          Last sync: {new Date(status.lastSync).toLocaleString()}
        </p>
      )}

      {status.error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
          {status.error}
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => run('Reload', reload)}
          disabled={!!busy}
          className="btn-secondary text-xs"
        >
          {busy === 'Reload' ? <Loader2 size={12} className="animate-spin"/> : <RefreshCw size={12}/>}
          Reload Data
        </button>

        {DATA_MODE === 'gdrive' && status.connected && (
          <>
            <button
              onClick={() => run('Sync', sync)}
              disabled={!!busy}
              className="btn-secondary text-xs"
            >
              {busy === 'Sync' ? <Loader2 size={12} className="animate-spin"/> : <RefreshCw size={12}/>}
              Sync from Drive
            </button>
            <button
              onClick={() => run('Backup', backup)}
              disabled={!!busy}
              className="btn-secondary text-xs"
            >
              {busy === 'Backup' ? <Loader2 size={12} className="animate-spin"/> : <Download size={12}/>}
              Backup to Drive
            </button>
          </>
        )}

        <button
          onClick={() => run('Export', exportAll)}
          disabled={!!busy}
          className="btn-secondary text-xs"
        >
          {busy === 'Export' ? <Loader2 size={12} className="animate-spin"/> : <Download size={12}/>}
          Export All JSON
        </button>
      </div>

      {/* Import */}
      <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
        <p className="text-xs font-bold text-slate-700 mb-2">Import Collection</p>
        <div className="flex gap-2">
          <select
            value={importCol}
            onChange={e => setImportCol(e.target.value as CollectionName)}
            className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-brand-400"
          >
            {collections.map(c => <option key={c} value={c}>{c}.json</option>)}
          </select>
          <label className="btn-secondary text-xs cursor-pointer flex items-center gap-1">
            <Upload size={12}/> Choose File
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={async e => {
                const file = e.target.files?.[0]
                if (!file) return
                await run(`Import ${importCol}`, () => importFile(file, importCol))
                e.target.value = ''
              }}
            />
          </label>
        </div>
      </div>

      {feedback && (
        <p className={`text-xs mt-3 px-3 py-2 rounded-lg border ${
          feedback.startsWith('Error')
            ? 'bg-red-50 text-red-600 border-red-200'
            : 'bg-green-50 text-green-600 border-green-200'
        }`}>
          {feedback}
        </p>
      )}
    </SectionCard>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function Settings() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Platform configuration, data management, and integrations"
        icon={<SettingsIcon size={18}/>}
      />

      {/* Data Mode Panel (M04) */}
      <DataModePanel />

      {/* Company Info */}
      <SectionCard title="Company Information">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: 'Company',   value: 'iTelematics Software Private Limited' },
            { label: 'Location',  value: 'Bangalore, India' },
          ].map(({ label, value }) => (
            <div key={label} className="border-b border-slate-50 pb-2">
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{label}</p>
              <p className="text-sm font-semibold text-slate-800 mt-0.5">{value}</p>
            </div>
          ))}
          <div className="border-b border-slate-50 pb-2">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Email</p>
            <a href="mailto:info@iTelematics.com" className="text-sm font-semibold text-brand-600 hover:underline mt-0.5 block">
              info@iTelematics.com
            </a>
          </div>
          <div className="border-b border-slate-50 pb-2">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Phone / WhatsApp</p>
            <div className="flex items-center gap-3 mt-0.5">
              <a href="tel:+919108206147" className="text-sm font-semibold text-slate-800 hover:text-brand-600 transition-colors">
                +91 91082 06147
              </a>
              <a
                href="https://wa.me/919108206147"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200 hover:bg-green-200 transition-colors"
              >
                WhatsApp
              </a>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Platform Info */}
      <SectionCard title="Platform Information">
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Platform',     value: 'UFlight™ | EV.ENGINEER™ Battery Trust Platform' },
            { label: 'Version',      value: 'v1.0 — Milestone 04' },
            { label: 'Data Mode',    value: MODE_LABELS[DATA_MODE] },
            { label: 'Architecture', value: 'React 18 + TypeScript 5 + Vite 5' },
            { label: 'Styling',      value: 'Tailwind CSS v3' },
            { label: 'Routing',      value: 'React Router v6' },
            { label: 'Auth',         value: 'Firebase Auth (Google OAuth)' },
            { label: 'IAM Store',    value: 'Firestore (users, roles, audit)' },
          ].map(({ label, value }) => (
            <div key={label} className="border-b border-slate-50 pb-2">
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{label}</p>
              <p className="text-sm font-semibold text-slate-800 mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Future Integrations */}
      <SectionCard title="Future Integrations">
        <div className="space-y-3">
          <IntegrationCard
            icon={<Shield size={16}/>}
            title="Firebase Auth + Firestore (IAM)"
            desc="Google OAuth login with role-based access. Intern, QA, Architect, Admin roles."
            status="active"
          />
          <IntegrationCard
            icon={<Database size={16}/>}
            title="Google Drive API"
            desc="Store engineering JSON config in Drive. Enable via VITE_DATA_MODE=gdrive."
            status={DATA_MODE === 'gdrive' ? 'active' : 'planned'}
          />
          <IntegrationCard
            icon={<Database size={16}/>}
            title="Firebase Firestore (Engineering Data)"
            desc="Replace local JSON with real-time Firestore. Enable via VITE_DATA_MODE=firebase."
            status={DATA_MODE === 'firebase' ? 'active' : 'planned'}
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
            desc="Send assignment emails, weekly reminders, and QA/architect notifications."
            status="planned"
          />
          <IntegrationCard
            icon={<Calendar size={16}/>}
            title="Google Calendar API"
            desc="Sync demo dates, review schedules, and weekly check-ins to intern calendars."
            status="planned"
          />
          <IntegrationCard
            icon={<Slack size={16}/>}
            title="Slack / Notifications"
            desc="Real-time status updates, QA pass/fail alerts, and daily progress digests."
            status="planned"
          />
          <IntegrationCard
            icon={<Bell size={16}/>}
            title="Push Notifications"
            desc="Browser push notifications for deadline alerts and architect approvals."
            status="planned"
          />
        </div>
      </SectionCard>
    </div>
  )
}
