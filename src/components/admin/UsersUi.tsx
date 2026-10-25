import { NavLink } from 'react-router-dom'
import PermissionBadge from '../ui/PermissionBadge'
import type { DirectoryRole, DirectoryStatus } from '../../admin/userDirectory'
import type { UserRole } from '../../types/auth'

const STATUS_COLORS: Record<DirectoryStatus, string> = {
  Active:        'bg-green-100 text-green-700 border-green-200',
  Pending:       'bg-amber-100 text-amber-700 border-amber-200',
  Suspended:     'bg-orange-100 text-orange-700 border-orange-200',
  Blocked:       'bg-red-100 text-red-600 border-red-200',
  // Signed in, no membership: authenticated, not authorized.
  Authenticated: 'bg-sky-50 text-sky-700 border-sky-200',
}

export function DirectoryStatusBadge({ status }: { status: DirectoryStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap ${STATUS_COLORS[status] ?? STATUS_COLORS.Blocked}`}>
      {status}
    </span>
  )
}

export function DirectoryRoleBadge({ role }: { role: DirectoryRole }) {
  if (role === 'No Membership') {
    return (
      <span className="inline-flex items-center rounded-full border border-dashed border-slate-300 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 whitespace-nowrap">
        No Membership
      </span>
    )
  }
  return <PermissionBadge role={role as UserRole} size="xs" />
}

/** Directory (who signed in, from where) and Manage Members (roles and status). */
export function UsersTabs() {
  const tab = ({ isActive }: { isActive: boolean }) => `tab-btn ${isActive ? 'active' : ''}`
  return (
    <nav aria-label="Users" className="flex gap-0 border-b border-slate-200 overflow-x-auto -mt-2">
      <NavLink to="/admin/users" end className={tab}>Directory</NavLink>
      <NavLink to="/admin/users/manage" className={tab}>Manage Members</NavLink>
    </nav>
  )
}
