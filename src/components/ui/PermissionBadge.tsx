import type { UserRole } from '../../types/auth'

const ROLE_COLORS: Record<UserRole, string> = {
  'Platform Admin':       'bg-red-100 text-red-700 border-red-200',
  'Engineering Manager':  'bg-brand-100 text-brand-700 border-brand-200',
  'Architect':            'bg-purple-100 text-purple-700 border-purple-200',
  'QA Engineer':          'bg-green-100 text-green-700 border-green-200',
  'Developer':            'bg-blue-100 text-blue-700 border-blue-200',
  'Viewer':               'bg-slate-100 text-slate-600 border-slate-200',
}

interface PermissionBadgeProps {
  role: UserRole
  size?: 'xs' | 'sm'
}

export default function PermissionBadge({ role, size = 'sm' }: PermissionBadgeProps) {
  const cls = ROLE_COLORS[role] ?? 'bg-slate-100 text-slate-600 border-slate-200'
  const textSize = size === 'xs' ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5'
  return (
    <span className={`inline-flex items-center rounded-full font-bold border whitespace-nowrap ${textSize} ${cls}`}>
      {role}
    </span>
  )
}
