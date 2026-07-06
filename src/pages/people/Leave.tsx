import { useEffect, useState } from 'react'
import { Plane, Plus } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import SectionCard from '../../components/ui/SectionCard'
import StatusBadge from '../../components/ui/StatusBadge'
import { useAuthContext } from '../../contexts/AuthContext'
import { PEOPLE_ROLE_ACCESS } from '../../types/auth'
import { getAllLeaveRequests, createLeaveRequest, updateLeaveStatus, getAllPeopleProfiles } from '../../firebase/people'
import { SEED_LEAVE_REQUESTS, SEED_PEOPLE_PROFILES } from '../../data/peopleSeed'
import type { PeopleLeaveRequest, PeopleProfile, LeaveType, LeaveRequestStatus } from '../../types/people'
import { LEAVE_TYPES } from '../../types/people'

const STATUSES: LeaveRequestStatus[] = ['Requested', 'Manager Approved', 'Rejected', 'Cancelled']

export default function Leave() {
  const { uid, role, userProfile } = useAuthContext()
  const [requests, setRequests] = useState<PeopleLeaveRequest[]>([])
  const [profiles, setProfiles] = useState<PeopleProfile[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [form, setForm] = useState({ personId: '', leaveType: 'Casual Leave' as LeaveType, startDate: '', endDate: '', reason: '' })

  const isSelfScoped = role ? PEOPLE_ROLE_ACCESS[role] === 'self' : false
  const canApprove = role ? ['full', 'org', 'team', 'people_ops'].includes(PEOPLE_ROLE_ACCESS[role]) : false

  useEffect(() => {
    Promise.all([getAllLeaveRequests(), getAllPeopleProfiles()]).then(([r, p]) => {
      setRequests(r.length ? r : SEED_LEAVE_REQUESTS)
      setProfiles(p.length ? p : SEED_PEOPLE_PROFILES)
      setLoading(false)
    })
  }, [])

  const myProfile = profiles.find(p => p.email === userProfile?.email)
  const visible = isSelfScoped && myProfile ? requests.filter(r => r.personId === myProfile.id) : requests

  function days(start: string, end: string) {
    if (!start || !end) return 1
    const ms = new Date(end).getTime() - new Date(start).getTime()
    return Math.max(1, Math.round(ms / 86400000) + 1)
  }

  async function handleCreate() {
    const personId = isSelfScoped ? myProfile?.id : form.personId
    if (!personId || !uid || !form.startDate || !form.endDate) return
    setSaving(true)
    const leave: Omit<PeopleLeaveRequest, 'id' | 'partnerId' | 'organisationId' | 'createdAt' | 'updatedAt' | 'status' | 'createdBy'> = {
      personId, leaveType: form.leaveType, startDate: form.startDate, endDate: form.endDate,
      days: days(form.startDate, form.endDate), reason: form.reason, leaveStatus: 'Requested',
      approverId: '', approverComments: '',
    }
    const id = await createLeaveRequest(leave, uid)
    setRequests(prev => [{ ...leave, id, partnerId: '', organisationId: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: uid, status: 'Requested' }, ...prev])
    setForm({ personId: '', leaveType: 'Casual Leave', startDate: '', endDate: '', reason: '' })
    setShowForm(false)
    setSaving(false)
  }

  async function handleStatus(id: string, leaveStatus: LeaveRequestStatus) {
    if (!uid) return
    await updateLeaveStatus(id, leaveStatus, uid)
    setRequests(prev => prev.map(r => r.id === id ? { ...r, leaveStatus } : r))
  }

  function personName(id: string) {
    return profiles.find(p => p.id === id)?.displayName ?? id
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave"
        subtitle="Casual, sick, emergency, exam, unpaid, WFH and comp-off requests"
        icon={<Plane size={18}/>}
        actions={
          <button onClick={() => setShowForm(s => !s)} className="btn-primary flex items-center gap-1.5">
            <Plus size={14}/> Request Leave
          </button>
        }
      />

      {showForm && (
        <SectionCard title="New Leave Request" icon={<Plus size={14}/>}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!isSelfScoped && (
              <select className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:border-brand-400"
                value={form.personId} onChange={e => setForm(p => ({ ...p, personId: e.target.value }))}>
                <option value="">Select person…</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
              </select>
            )}
            <select className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:border-brand-400"
              value={form.leaveType} onChange={e => setForm(p => ({ ...p, leaveType: e.target.value as LeaveType }))}>
              {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="date" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-brand-400"
              value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} />
            <input type="date" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-brand-400"
              value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} />
            <div className="sm:col-span-2">
              <textarea rows={2} placeholder="Reason" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-brand-400"
                value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setShowForm(false)} className="btn-ghost text-sm px-4 py-2">Cancel</button>
            <button onClick={handleCreate} disabled={saving || !form.startDate || !form.endDate} className="btn-primary text-sm px-5 py-2">
              {saving ? 'Requesting…' : 'Request Leave'}
            </button>
          </div>
        </SectionCard>
      )}

      <SectionCard title={`Leave Requests (${visible.length})`} icon={<Plane size={14}/>}>
        {loading ? (
          <p className="text-sm text-slate-400 text-center py-8">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No leave requests yet.</p>
        ) : (
          <div className="space-y-2">
            {visible.map(r => (
              <div key={r.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-slate-800">{personName(r.personId)}</p>
                    <StatusBadge status={r.leaveStatus} size="xs" />
                  </div>
                  <p className="text-xs text-slate-500">{r.leaveType} · {r.startDate} → {r.endDate} · {r.days} day(s)</p>
                </div>
                {canApprove ? (
                  <select
                    value={r.leaveStatus}
                    onChange={e => handleStatus(r.id, e.target.value as LeaveRequestStatus)}
                    className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-brand-400"
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
