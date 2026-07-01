import { Battery, Shield, Star, CheckCircle, XCircle, Crown, Lock, Eye, Edit3, Settings } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import SectionCard from '../../components/ui/SectionCard'
import { SUPER_ADMIN_EMAILS, type UserRole } from '../../types/auth'

// ── Role metadata ─────────────────────────────────────────────────────────

interface RoleMeta {
  label: UserRole
  color: string
  bg: string
  border: string
  icon: React.ReactNode
  description: string
  permissions: string[]
}

const ROLE_META: RoleMeta[] = [
  {
    label: 'Platform Admin',
    color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200',
    icon: <Crown size={14} className="text-red-600" />,
    description: 'Full unrestricted access to all platform features, data, and configuration.',
    permissions: [
      'All pages & features',
      'User management (create, block, delete)',
      'Role assignment for all users',
      'Admin panel access',
      'Invitation management',
      'All engineering data (read + write)',
      'Audit log access (all users)',
      'Platform settings',
    ],
  },
  {
    label: 'Engineering Manager',
    color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200',
    icon: <Settings size={14} className="text-purple-600" />,
    description: 'Manages the engineering team, assigns work, reviews progress, and approves weekly plans.',
    permissions: [
      'Write: Assignments, Stories, Developers',
      'Read: Users (team management)',
      'QA & Architect assignment',
      'Weekly review approval',
      'Reports access',
      'Invitation management',
      'Read: all engineering data',
    ],
  },
  {
    label: 'Architect',
    color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200',
    icon: <ShieldCheck size={14} className="text-blue-600" />,
    description: 'Reviews and approves architecture designs and evidence submissions.',
    permissions: [
      'Approve: Architecture decisions',
      'Approve: Evidence submissions',
      'Read: Stories, Simulators, Assignments',
      'Architect review page',
    ],
  },
  {
    label: 'QA Engineer',
    color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200',
    icon: <CheckCircle size={14} className="text-teal-600" />,
    description: 'Performs quality assurance testing and verifies evidence against acceptance criteria.',
    permissions: [
      'QA review of assigned stories',
      'Evidence verification',
      'Read: assigned stories only',
      'QA review page',
    ],
  },
  {
    label: 'Developer',
    color: 'text-brand-700', bg: 'bg-brand-50', border: 'border-brand-200',
    icon: <Edit3 size={14} className="text-brand-600" />,
    description: 'Intern developer assigned to a specific story and simulator for the duration of the program.',
    permissions: [
      'Read + Write: own assignment only',
      'Own story & simulator',
      'Submit evidence',
      'Weekly self-assessment',
      'Final demo submission',
    ],
  },
  {
    label: 'Viewer',
    color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200',
    icon: <Eye size={14} className="text-slate-500" />,
    description: 'Read-only observer — can browse the platform but cannot make any changes.',
    permissions: [
      'Read-only: Dashboard',
      'Read-only: Stories, Simulators',
      'Read-only: Developers, Assignments',
      'Read-only: Evidence, Reports',
    ],
  },
]

// ── Access matrix ─────────────────────────────────────────────────────────

type AccessLevel = 'full' | 'write' | 'read' | 'own' | 'none'

interface MatrixRow {
  area: string
  admin: AccessLevel
  manager: AccessLevel
  architect: AccessLevel
  qa: AccessLevel
  developer: AccessLevel
  viewer: AccessLevel
}

const MATRIX: MatrixRow[] = [
  { area: 'Dashboard',          admin: 'full', manager: 'full', architect: 'full', qa: 'read', developer: 'read', viewer: 'read' },
  { area: 'Assignments',        admin: 'full', manager: 'write', architect: 'read', qa: 'read', developer: 'own', viewer: 'read' },
  { area: 'Developers',         admin: 'full', manager: 'write', architect: 'read', qa: 'none', developer: 'own', viewer: 'read' },
  { area: 'Simulators',         admin: 'full', manager: 'write', architect: 'read', qa: 'read', developer: 'own', viewer: 'read' },
  { area: 'User Stories',       admin: 'full', manager: 'write', architect: 'read', qa: 'read', developer: 'own', viewer: 'read' },
  { area: 'QA Review',          admin: 'full', manager: 'write', architect: 'read', qa: 'full', developer: 'none', viewer: 'none' },
  { area: 'Architect Approval', admin: 'full', manager: 'read', architect: 'full', qa: 'none', developer: 'none', viewer: 'none' },
  { area: 'Evidence',           admin: 'full', manager: 'read', architect: 'write', qa: 'write', developer: 'own', viewer: 'read' },
  { area: 'Email Queue',        admin: 'full', manager: 'full', architect: 'none', qa: 'none', developer: 'none', viewer: 'none' },
  { area: 'Reports',            admin: 'full', manager: 'full', architect: 'read', qa: 'none', developer: 'none', viewer: 'read' },
  { area: 'Weekly Review',      admin: 'full', manager: 'write', architect: 'read', qa: 'none', developer: 'own', viewer: 'none' },
  { area: 'Final Demo',         admin: 'full', manager: 'full', architect: 'read', qa: 'read', developer: 'own', viewer: 'none' },
  { area: 'Admin Panel',        admin: 'full', manager: 'none', architect: 'none', qa: 'none', developer: 'none', viewer: 'none' },
  { area: 'User Management',    admin: 'full', manager: 'read', architect: 'none', qa: 'none', developer: 'none', viewer: 'none' },
  { area: 'Platform Settings',  admin: 'full', manager: 'none', architect: 'none', qa: 'none', developer: 'none', viewer: 'none' },
]

const ACCESS_META: Record<AccessLevel, { label: string; cls: string; icon: React.ReactNode }> = {
  full:  { label: 'Full',  cls: 'bg-green-100 text-green-700',   icon: <CheckCircle size={11} /> },
  write: { label: 'Write', cls: 'bg-blue-100 text-blue-700',     icon: <Edit3 size={11} /> },
  read:  { label: 'Read',  cls: 'bg-slate-100 text-slate-600',   icon: <Eye size={11} /> },
  own:   { label: 'Own',   cls: 'bg-amber-100 text-amber-700',   icon: <Lock size={11} /> },
  none:  { label: '—',     cls: 'bg-transparent text-slate-300', icon: <XCircle size={11} /> },
}

// Lucide ShieldCheck not imported above — define inline helper
function ShieldCheck({ size, className }: { size: number; className?: string }) {
  return <Shield size={size} className={className} />
}

// ── Component ─────────────────────────────────────────────────────────────

export default function DeveloperSettings() {
  const superAdmins = Array.from(SUPER_ADMIN_EMAILS)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Developer Settings"
        subtitle="Role definitions, access matrix, and super admin configuration — visible to Platform Admin only"
        icon={<Settings size={18} />}
      />

      {/* Super Admin Card */}
      <SectionCard
        title="Super Admins"
        icon={<Crown size={14} className="text-amber-500" />}
      >
        <p className="text-xs text-slate-500 mb-4">
          These accounts are hardcoded as <strong>Platform Admin</strong> at the application layer and in
          Firestore security rules. Their role is enforced on every sign-in regardless of the stored
          Firestore value.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {superAdmins.map(email => (
            <div
              key={email}
              className="flex items-center gap-3 p-4 rounded-xl border-2 border-amber-200 bg-amber-50"
            >
              <div className="w-9 h-9 rounded-full bg-amber-100 border-2 border-amber-300 flex items-center justify-center flex-shrink-0">
                <Crown size={16} className="text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{email}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                    Platform Admin
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                    Super Admin
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Battery size={14} className="text-amber-500" />
                <Shield size={10} className="text-amber-400 -ml-0.5" />
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-400 mt-3 italic">
          To add or remove super admins, update <code className="font-mono bg-slate-100 px-1 rounded">SUPER_ADMIN_EMAILS</code> in{' '}
          <code className="font-mono bg-slate-100 px-1 rounded">src/types/auth.ts</code> and redeploy Firestore rules.
        </p>
      </SectionCard>

      {/* Role Definitions */}
      <SectionCard
        title="Role Definitions"
        icon={<Shield size={14} />}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {ROLE_META.map(role => (
            <div
              key={role.label}
              className={`rounded-xl border ${role.border} ${role.bg} p-4`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-7 h-7 rounded-lg bg-white border ${role.border} flex items-center justify-center flex-shrink-0`}>
                  {role.icon}
                </div>
                <span className={`text-sm font-bold ${role.color}`}>{role.label}</span>
              </div>
              <p className="text-xs text-slate-500 mb-3 leading-relaxed">{role.description}</p>
              <ul className="space-y-1">
                {role.permissions.map(p => (
                  <li key={p} className="flex items-start gap-1.5 text-[11px] text-slate-600">
                    <CheckCircle size={10} className="text-green-500 flex-shrink-0 mt-0.5" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Access Matrix */}
      <SectionCard
        title="Access Matrix"
        icon={<Star size={14} />}
      >
        <p className="text-xs text-slate-500 mb-4">
          Feature-level access for each role. <span className="font-semibold">Own</span> = restricted to the user's own data only.
        </p>

        {/* Legend */}
        <div className="flex flex-wrap gap-2 mb-4">
          {(Object.entries(ACCESS_META) as [AccessLevel, typeof ACCESS_META[AccessLevel]][]).map(([key, meta]) => (
            key !== 'none' && (
              <div key={key} className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${meta.cls}`}>
                {meta.icon} {meta.label}
              </div>
            )
          ))}
          <div className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold text-slate-300">
            <XCircle size={11} /> No Access
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-2.5 text-[11px] font-bold text-slate-500 w-40">Feature Area</th>
                {ROLE_META.map(r => (
                  <th key={r.label} className="text-center px-2 py-2.5 min-w-[80px]">
                    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${r.border} ${r.bg} ${r.color}`}>
                      {r.icon}
                      <span className="hidden sm:inline">{r.label.split(' ')[0]}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX.map((row, i) => (
                <tr key={row.area} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                  <td className="px-4 py-2 font-semibold text-slate-700 border-b border-slate-100 whitespace-nowrap">
                    {row.area}
                  </td>
                  {(['admin', 'manager', 'architect', 'qa', 'developer', 'viewer'] as const).map(col => {
                    const level = row[col] as AccessLevel
                    const meta = ACCESS_META[level]
                    return (
                      <td key={col} className="text-center px-2 py-2 border-b border-slate-100">
                        <div className={`inline-flex items-center justify-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${meta.cls}`}>
                          {meta.icon}
                          <span>{meta.label}</span>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Security Model Note */}
      <SectionCard title="Security Model" icon={<Lock size={14} />}>
        <div className="space-y-3 text-xs text-slate-600">
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl">
            <Shield size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-blue-800 mb-0.5">Two-Layer Enforcement</p>
              <p>Role access is enforced at both the <strong>React app layer</strong> (route guards, UI visibility) and at the
              <strong> Firestore security rules layer</strong> (server-side read/write control). Bypassing the UI does not grant data access.</p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <Crown size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-800 mb-0.5">Super Admin Override</p>
              <p>Super admin emails are validated against <code className="font-mono bg-amber-100 px-1 rounded">request.auth.token.email</code> in Firestore rules, which comes from the signed Google OAuth token — it cannot be spoofed by a document edit.</p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <CheckCircle size={14} className="text-green-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-700 mb-0.5">Audit Trail</p>
              <p>All sign-ins, role changes, profile updates, and evidence events are written to <code className="font-mono bg-slate-100 px-1 rounded">auditLogs</code> in Firestore. Logs are immutable — update and delete are denied by rules.</p>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
