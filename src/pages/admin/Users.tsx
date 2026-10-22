import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Users, Search, Shield, CheckCircle, XCircle, Clock, Building2, UserPlus, AlertCircle,
} from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import SectionCard from '../../components/ui/SectionCard'
import UserAvatar from '../../components/ui/UserAvatar'
import PermissionBadge from '../../components/ui/PermissionBadge'
import { useAuthContext } from '../../contexts/AuthContext'
import {
  listPartnerMemberships, listAllMemberships, listAllUsers, listPartners,
  updateMembership, createMembership, writeTenantAudit,
} from '../../firebase/partners'
import { canChangeMembership } from '../../tenant/authorize'
import {
  PARTNER_ROLES, type MembershipStatus, type Partner, type PartnerMembership, type PartnerRole,
} from '../../types/partner'
import type { AuditAction, UserProfile } from '../../types/auth'

const STATUSES: MembershipStatus[] = ['Active', 'Pending', 'Suspended', 'Blocked']
const STATUS_COLORS: Record<MembershipStatus, string> = {
  Active:    'bg-green-100 text-green-700 border-green-200',
  Pending:   'bg-amber-100 text-amber-700 border-amber-200',
  Suspended: 'bg-orange-100 text-orange-700 border-orange-200',
  Blocked:   'bg-red-100 text-red-600 border-red-200',
}
const ALL = '__all__'

export default function AdminUsers() {
  const { principal, isPlatformAdmin, userProfile, activePartner } = useAuthContext()

  const [memberships, setMemberships] = useState<PartnerMembership[]>([])
  const [allUsers, setAllUsers]       = useState<UserProfile[]>([])     // Platform Admin only
  const [partners, setPartners]       = useState<Partner[]>([])         // Platform Admin only
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [search, setSearch]           = useState('')
  const [filterRole, setFilterRole]   = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  // Platform Admin may look across Partners; Partner Admin is pinned to the active Partner.
  const [scope, setScope] = useState<string>(activePartner?.id ?? ALL)

  const load = useCallback(async () => {
    if (!activePartner) return
    setLoading(true)
    setError('')
    try {
      if (isPlatformAdmin) {
        const [m, u, p] = await Promise.all([listAllMemberships(), listAllUsers(), listPartners()])
        setMemberships(m); setAllUsers(u); setPartners(p)
      } else {
        // Rules allow this query only for an Admin of activePartner.
        setMemberships(await listPartnerMemberships(activePartner.id))
      }
    } catch {
      setError('You do not have permission to view these users.')
    } finally {
      setLoading(false)
    }
  }, [activePartner, isPlatformAdmin])

  useEffect(() => { load() }, [load])

  const partnerName = useCallback(
    (id: string) => partners.find(p => p.id === id)?.displayName ?? (id === activePartner?.id ? activePartner.displayName : id),
    [partners, activePartner],
  )

  const effectiveScope = isPlatformAdmin ? scope : (activePartner?.id ?? '')

  const visible = useMemo(() => memberships.filter(m => {
    if (effectiveScope !== ALL && m.partnerId !== effectiveScope) return false
    const q = search.trim().toLowerCase()
    if (q && !m.displayName.toLowerCase().includes(q) && !m.email.toLowerCase().includes(q)) return false
    if (filterRole && m.role !== filterRole) return false
    if (filterStatus && m.status !== filterStatus) return false
    return true
  }), [memberships, effectiveScope, search, filterRole, filterStatus])

  const usersWithoutMembership = useMemo(() => {
    if (!isPlatformAdmin || effectiveScope === ALL) return []
    const memberUids = new Set(memberships.filter(m => m.partnerId === effectiveScope).map(m => m.uid))
    return allUsers.filter(u => !memberUids.has(u.uid))
  }, [isPlatformAdmin, effectiveScope, memberships, allUsers])

  async function audit(action: AuditAction, m: PartnerMembership, details: string, metadata?: Record<string, string>) {
    if (!userProfile) return
    await writeTenantAudit({
      uid: userProfile.uid, userEmail: userProfile.email, action,
      partnerId: m.partnerId, targetType: 'partnerMemberships', targetId: m.id, details, metadata,
    }).catch(() => {})
  }

  async function changeRole(m: PartnerMembership, role: PartnerRole) {
    if (!principal || role === m.role) return
    if (!canChangeMembership(principal, { targetUid: m.uid, partnerId: m.partnerId, beforeRole: m.role, afterRole: role })) return
    setError('')
    try {
      await updateMembership(m.partnerId, m.uid, { role }, principal.uid)
      setMemberships(prev => prev.map(x => x.id === m.id ? { ...x, role } : x))
      const action: AuditAction = role === 'Admin' ? 'admin_assigned' : m.role === 'Admin' ? 'admin_removed' : 'role_changed'
      await audit(action, m, `Role ${m.role} → ${role}`, { from: m.role, to: role })
    } catch {
      setError('Role change was rejected.')
    }
  }

  async function changeStatus(m: PartnerMembership, status: MembershipStatus) {
    if (!principal || status === m.status) return
    if (!canChangeMembership(principal, { targetUid: m.uid, partnerId: m.partnerId, beforeRole: m.role, afterRole: m.role })) return
    setError('')
    try {
      const patch = status === 'Active' && m.status === 'Pending'
        ? { status, approvedBy: principal.uid } : { status }
      await updateMembership(m.partnerId, m.uid, patch, principal.uid)
      setMemberships(prev => prev.map(x => x.id === m.id ? { ...x, ...patch } : x))
      await audit(status === 'Blocked' ? 'membership_blocked' : 'membership_updated', m,
        `Status ${m.status} → ${status}`, { from: m.status, to: status })
    } catch {
      setError('Status change was rejected.')
    }
  }

  async function addToPartner(u: UserProfile, partnerId: string, role: PartnerRole) {
    if (!principal || !isPlatformAdmin) return
    setError('')
    try {
      const m = await createMembership(partnerId, u, role, principal.uid)
      setMemberships(prev => [...prev, m])
      await audit(role === 'Admin' ? 'admin_assigned' : 'membership_created', m, `Added as ${role}`, { role })
    } catch {
      setError('Could not add the user to this Partner.')
    }
  }

  const counts = {
    total:   visible.length,
    active:  visible.filter(m => m.status === 'Active').length,
    pending: visible.filter(m => m.status === 'Pending').length,
    blocked: visible.filter(m => m.status === 'Blocked' || m.status === 'Suspended').length,
  }
  const byRole = PARTNER_ROLES.reduce<Record<string, number>>((acc, r) => {
    acc[r] = visible.filter(m => m.role === r).length; return acc
  }, {})

  const subtitle = isPlatformAdmin
    ? 'Platform Admin · All Partners'
    : `${activePartner?.displayName ?? ''} · Partner members`

  return (
    <div className="space-y-6">
      <PageHeader title="User Management" subtitle={subtitle} icon={<Users size={18}/>} />

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex gap-2 text-sm text-red-700">
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />{error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Members', value: counts.total, icon: <Users size={14}/>, color: 'bg-brand-50 text-brand-700' },
          { label: 'Active', value: counts.active, icon: <CheckCircle size={14}/>, color: 'bg-green-50 text-green-700' },
          { label: 'Pending', value: counts.pending, icon: <Clock size={14}/>, color: 'bg-amber-50 text-amber-700' },
          { label: 'Blocked / Suspended', value: counts.blocked, icon: <XCircle size={14}/>, color: 'bg-red-50 text-red-600' },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className={`card p-4 ${color}`}>
            <div className="flex items-center gap-2 mb-1">{icon}<p className="text-[10px] font-bold uppercase tracking-wide truncate">{label}</p></div>
            <p className="text-2xl font-black">{value}</p>
          </div>
        ))}
      </div>

      {/* Role Distribution */}
      <SectionCard title="Role Distribution" icon={<Shield size={14}/>}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {PARTNER_ROLES.map(role => (
            <div key={role} className="flex items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <PermissionBadge role={role} size="xs" />
              <span className="text-sm font-bold text-slate-800">{byRole[role] ?? 0}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {isPlatformAdmin && (
          <div className="relative">
            <Building2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select value={scope} onChange={e => setScope(e.target.value)} aria-label="Partner"
              className="border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-sm bg-white focus:outline-none focus:border-brand-400 max-w-[240px]">
              <option value={ALL}>All Partners</option>
              {partners.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
            </select>
          </div>
        )}
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email…"
            className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-brand-400" />
        </div>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)} aria-label="Role"
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-brand-400">
          <option value="">All Roles</option>
          {PARTNER_ROLES.map(r => <option key={r}>{r}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} aria-label="Status"
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-brand-400">
          <option value="">All Status</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* Members */}
      <SectionCard title={`Members (${visible.length})`} icon={<Users size={14}/>}>
        {loading ? (
          <p className="text-sm text-slate-400 text-center py-8">Loading users…</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No members found.</p>
        ) : (
          <div className="space-y-2">
            {visible.map(m => {
              const editable = principal
                ? canChangeMembership(principal, { targetUid: m.uid, partnerId: m.partnerId, beforeRole: m.role, afterRole: m.role })
                : false
              const grantable = PARTNER_ROLES.filter(r => principal && canChangeMembership(principal,
                { targetUid: m.uid, partnerId: m.partnerId, beforeRole: m.role, afterRole: r }))
              return (
                <div key={m.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <UserAvatar photoURL={m.photoURL} displayName={m.displayName} size="sm" className="ring-transparent" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-slate-800 truncate">{m.displayName || m.email}</p>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${STATUS_COLORS[m.status] ?? STATUS_COLORS.Blocked}`}>{m.status}</span>
                        {isPlatformAdmin && effectiveScope === ALL && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full border border-slate-200 bg-white text-slate-500 truncate max-w-[160px]">
                            {partnerName(m.partnerId)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 truncate">{m.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:flex-shrink-0">
                    {editable && grantable.length > 0 ? (
                      <select value={m.role} onChange={e => changeRole(m, e.target.value as PartnerRole)} aria-label="Role"
                        className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:border-brand-400">
                        {!grantable.includes(m.role) && <option value={m.role} disabled>{m.role}</option>}
                        {grantable.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    ) : (
                      <PermissionBadge role={m.role} size="xs" />
                    )}
                    {editable ? (
                      <select value={m.status} onChange={e => changeStatus(m, e.target.value as MembershipStatus)} aria-label="Status"
                        className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:border-brand-400">
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : m.uid === principal?.uid ? (
                      <span className="text-[10px] text-slate-400">You</span>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>

      {/* Platform Admin: add existing users to the selected Partner */}
      {isPlatformAdmin && effectiveScope !== ALL && usersWithoutMembership.length > 0 && (
        <SectionCard title={`Not in ${partnerName(effectiveScope)} (${usersWithoutMembership.length})`} icon={<UserPlus size={14}/>}>
          <div className="space-y-2">
            {usersWithoutMembership.map(u => (
              <AddMemberRow key={u.uid} user={u} onAdd={role => addToPartner(u, effectiveScope, role)} />
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  )
}

function AddMemberRow({ user, onAdd }: { user: UserProfile; onAdd: (role: PartnerRole) => Promise<void> }) {
  const [role, setRole] = useState<PartnerRole>('Developer')
  const [busy, setBusy] = useState(false)
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-white rounded-xl border border-slate-100">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <UserAvatar photoURL={user.photoURL} displayName={user.displayName} size="sm" className="ring-transparent" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{user.displayName || user.email}</p>
          <p className="text-xs text-slate-400 truncate">{user.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <select value={role} onChange={e => setRole(e.target.value as PartnerRole)} aria-label="Role"
          className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:border-brand-400">
          {PARTNER_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <button disabled={busy} onClick={async () => { setBusy(true); await onAdd(role); setBusy(false) }}
          className="btn-primary text-xs px-3 py-1.5">
          {busy ? 'Adding…' : 'Add'}
        </button>
      </div>
    </div>
  )
}
