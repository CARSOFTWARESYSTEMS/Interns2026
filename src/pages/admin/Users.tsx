import { useState, useEffect } from 'react'
import {
  Users, Search, Filter, Shield, CheckCircle,
  XCircle, Clock, AlertTriangle, Edit3, Eye,
} from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import SectionCard from '../../components/ui/SectionCard'
import UserAvatar from '../../components/ui/UserAvatar'
import PermissionBadge from '../../components/ui/PermissionBadge'
import ProfileCompletion from '../../components/ui/ProfileCompletion'
import { getAllUsers, setUserRole } from '../../firebase/firestore'
import { calcProfileCompletion, type UserProfile, type UserRole, type UserStatus } from '../../types/auth'

const ROLES: UserRole[] = ['Platform Admin', 'Engineering Manager', 'HR Manager', 'Architect', 'QA Engineer', 'Developer', 'Viewer']
const STATUS_COLORS: Record<UserStatus, string> = {
  Active:    'bg-green-100 text-green-700 border-green-200',
  Pending:   'bg-amber-100 text-amber-700 border-amber-200',
  Blocked:   'bg-red-100 text-red-600 border-red-200',
  Inactive:  'bg-slate-100 text-slate-500 border-slate-200',
  Deleted:   'bg-slate-100 text-slate-400 border-slate-100',
  Suspended: 'bg-orange-100 text-orange-700 border-orange-200',
}

export default function AdminUsers() {
  const [users, setUsers]           = useState<UserProfile[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filterRole, setFilterRole] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [editingRole, setEditingRole] = useState<string | null>(null)

  useEffect(() => {
    getAllUsers().then(u => { setUsers(u); setLoading(false) })
  }, [])

  async function handleRoleChange(uid: string, newRole: UserRole) {
    await setUserRole(uid, newRole, 'ev-engineer')
    setUsers(prev => prev.map(u => u.uid === uid ? { ...u, role: newRole } : u))
    setEditingRole(null)
  }

  const filtered = users.filter(u => {
    const matchSearch = !search || u.displayName.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
    const matchRole   = !filterRole || u.role === filterRole
    const matchStatus = !filterStatus || u.status === filterStatus
    return matchSearch && matchRole && matchStatus
  })

  const byRole    = ROLES.reduce((acc, r) => ({ ...acc, [r]: users.filter(u => u.role === r).length }), {} as Record<string, number>)
  const active    = users.filter(u => u.status === 'Active').length
  const pending   = users.filter(u => u.status === 'Pending').length
  const blocked   = users.filter(u => u.status === 'Blocked').length

  return (
    <div className="space-y-6">
      <PageHeader title="User Management" subtitle="Platform Admin · Manage all platform users" icon={<Users size={18}/>} />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Users', value: users.length, icon: <Users size={14}/>, color: 'bg-brand-50 text-brand-700' },
          { label: 'Active', value: active, icon: <CheckCircle size={14}/>, color: 'bg-green-50 text-green-700' },
          { label: 'Pending', value: pending, icon: <Clock size={14}/>, color: 'bg-amber-50 text-amber-700' },
          { label: 'Blocked', value: blocked, icon: <XCircle size={14}/>, color: 'bg-red-50 text-red-600' },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className={`card p-4 ${color}`}>
            <div className="flex items-center gap-2 mb-1">{icon}<p className="text-[10px] font-bold uppercase tracking-wide">{label}</p></div>
            <p className="text-2xl font-black">{value}</p>
          </div>
        ))}
      </div>

      {/* Role Distribution */}
      <SectionCard title="Role Distribution" icon={<Shield size={14}/>}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {ROLES.map(role => (
            <div key={role} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
              <PermissionBadge role={role} size="xs" />
              <span className="text-sm font-bold text-slate-800">{byRole[role] ?? 0}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-brand-400"
          />
        </div>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-brand-400">
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r}>{r}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-brand-400">
          <option value="">All Status</option>
          {(['Active', 'Pending', 'Blocked', 'Inactive', 'Suspended'] as UserStatus[]).map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* Users table */}
      <SectionCard title={`Users (${filtered.length})`} icon={<Users size={14}/>}>
        {loading ? (
          <p className="text-sm text-slate-400 text-center py-8">Loading users…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No users found.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map(u => {
              const completion = calcProfileCompletion(u)
              return (
                <div key={u.uid} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                  <UserAvatar photoURL={u.photoURL} displayName={u.displayName} size="sm" className="ring-transparent" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-slate-800">{u.displayName}</p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${STATUS_COLORS[u.status] ?? STATUS_COLORS.Inactive}`}>{u.status}</span>
                    </div>
                    <p className="text-xs text-slate-400 truncate">{u.email}</p>
                    {u.college && <p className="text-[10px] text-slate-400">{u.college}</p>}
                    <div className="mt-1.5 max-w-[180px]">
                      <ProfileCompletion percent={completion} showLabel={false} size="sm" />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    {editingRole === u.uid ? (
                      <select
                        defaultValue={u.role}
                        onChange={e => handleRoleChange(u.uid, e.target.value as UserRole)}
                        className="border border-brand-300 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none"
                        autoFocus
                        onBlur={() => setEditingRole(null)}
                      >
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    ) : (
                      <>
                        <PermissionBadge role={u.role} size="xs" />
                        <button onClick={() => setEditingRole(u.uid)} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors">
                          <Edit3 size={13} />
                        </button>
                      </>
                    )}
                    <p className="text-[10px] text-slate-400 hidden sm:block">{completion}%</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
