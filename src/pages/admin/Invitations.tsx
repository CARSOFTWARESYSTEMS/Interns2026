import { useState, useEffect } from 'react'
import { Mail, Plus, Clock, CheckCircle, XCircle, AlertTriangle, Copy, Trash2 } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import SectionCard from '../../components/ui/SectionCard'
import PermissionBadge from '../../components/ui/PermissionBadge'
import { getInvitations, createInvitation, updateInvitationStatus } from '../../firebase/firestore'
import { useAuthContext } from '../../contexts/AuthContext'
import type { Invitation, UserRole, InvitationStatus } from '../../types/auth'

const ROLES: UserRole[] = ['Developer', 'QA Engineer', 'Architect', 'Engineering Manager', 'Viewer']

const STATUS_META: Record<InvitationStatus, { color: string; icon: React.ReactNode }> = {
  Pending:  { color: 'bg-amber-100 text-amber-700 border-amber-200',  icon: <Clock size={11}/> },
  Accepted: { color: 'bg-green-100 text-green-700 border-green-200',  icon: <CheckCircle size={11}/> },
  Expired:  { color: 'bg-slate-100 text-slate-500 border-slate-200',  icon: <AlertTriangle size={11}/> },
  Cancelled:{ color: 'bg-red-100 text-red-600 border-red-200',        icon: <XCircle size={11}/> },
}

function generateToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export default function AdminInvitations() {
  const { userProfile } = useAuthContext()
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [saving, setSaving]           = useState(false)
  const [copied, setCopied]           = useState<string | null>(null)

  const [form, setForm] = useState({ name: '', email: '', role: 'Developer' as UserRole })

  useEffect(() => {
    getInvitations('ev-engineer').then(inv => { setInvitations(inv); setLoading(false) })
  }, [])

  async function handleCreate() {
    if (!form.name.trim() || !form.email.trim() || !userProfile) return
    setSaving(true)
    const now = new Date()
    const expires = new Date(now)
    expires.setDate(expires.getDate() + 7)
    const inv: Omit<Invitation, 'id'> = {
      name:      form.name.trim(),
      email:     form.email.trim(),
      role:      form.role,
      orgId:     'ev-engineer',
      invitedBy: userProfile.email,
      token:     generateToken(),
      status:    'Pending',
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
    }
    const id = await createInvitation(inv)
    setInvitations(prev => [{ ...inv, id }, ...prev])
    setForm({ name: '', email: '', role: 'Developer' })
    setShowForm(false)
    setSaving(false)
  }

  async function handleCancel(id: string) {
    await updateInvitationStatus(id, 'Cancelled')
    setInvitations(prev => prev.map(i => i.id === id ? { ...i, status: 'Cancelled' } : i))
  }

  function copyLink(token: string, id: string) {
    navigator.clipboard.writeText(`${window.location.origin}/join?token=${token}`)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const pending  = invitations.filter(i => i.status === 'Pending')
  const accepted = invitations.filter(i => i.status === 'Accepted')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invitations"
        subtitle="Invite team members to the EV.ENGINEER platform"
        icon={<Mail size={18}/>}
        actions={
          <button onClick={() => setShowForm(s => !s)} className="btn-primary flex items-center gap-1.5">
            <Plus size={14}/> Invite User
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total', value: invitations.length, color: 'text-slate-700' },
          { label: 'Pending', value: pending.length, color: 'text-amber-700' },
          { label: 'Accepted', value: accepted.length, color: 'text-green-700' },
          { label: 'Cancelled', value: invitations.filter(i => i.status === 'Cancelled').length, color: 'text-red-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-4 text-center">
            <p className={`text-2xl font-black ${color}`}>{value}</p>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* New invitation form */}
      {showForm && (
        <SectionCard title="New Invitation" icon={<Plus size={14}/>}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name <span className="text-red-400">*</span></label>
              <input
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-brand-400"
                placeholder="Priya Sharma"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Email <span className="text-red-400">*</span></label>
              <input
                type="email"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-brand-400"
                placeholder="priya@example.com"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Role</label>
              <select
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:border-brand-400"
                value={form.role}
                onChange={e => setForm(p => ({ ...p, role: e.target.value as UserRole }))}
              >
                {ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-xl">
            <p className="text-xs text-blue-700">
              <strong>Note:</strong> Email sending is not yet integrated (planned: Gmail API in Phase E).
              Copy the invitation link manually and share it with the invitee.
              The link expires in <strong>7 days</strong>.
            </p>
          </div>

          <div className="flex gap-2 mt-4">
            <button onClick={() => setShowForm(false)} className="btn-ghost text-sm px-4 py-2">Cancel</button>
            <button
              onClick={handleCreate}
              disabled={saving || !form.name.trim() || !form.email.trim()}
              className="btn-primary text-sm px-5 py-2"
            >
              {saving ? 'Generating…' : 'Generate Invitation'}
            </button>
          </div>
        </SectionCard>
      )}

      {/* Pending invitations */}
      <SectionCard title={`Pending (${pending.length})`} icon={<Clock size={14}/>}>
        {loading ? (
          <p className="text-sm text-slate-400 text-center py-6">Loading…</p>
        ) : pending.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">No pending invitations.</p>
        ) : (
          <div className="space-y-2">
            {pending.map(inv => (
              <div key={inv.id} className="flex items-center gap-4 p-4 bg-amber-50 border border-amber-100 rounded-xl">
                <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-sm font-bold flex-shrink-0">
                  {inv.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800">{inv.name}</p>
                  <p className="text-xs text-slate-500">{inv.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <PermissionBadge role={inv.role} size="xs" />
                    <span className="text-[10px] text-slate-400">Invited by {inv.invitedBy}</span>
                    <span className="text-[10px] text-slate-400">· Expires {new Date(inv.expiresAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => copyLink(inv.token, inv.id)}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-all"
                  >
                    <Copy size={11}/> {copied === inv.id ? 'Copied!' : 'Copy Link'}
                  </button>
                  <button
                    onClick={() => handleCancel(inv.id)}
                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    title="Cancel invitation"
                  >
                    <Trash2 size={13}/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* All invitations history */}
      <SectionCard title="Invitation History" icon={<Mail size={14}/>}>
        {invitations.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">No invitations sent yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Name', 'Email', 'Role', 'Status', 'Invited By', 'Sent', 'Expires'].map(h => (
                    <th key={h} className="text-left pb-2 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {invitations.map(inv => {
                  const { color, icon } = STATUS_META[inv.status]
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-2 font-semibold text-slate-800">{inv.name}</td>
                      <td className="py-2.5 px-2 text-slate-500">{inv.email}</td>
                      <td className="py-2.5 px-2"><PermissionBadge role={inv.role} size="xs" /></td>
                      <td className="py-2.5 px-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-bold text-[9px] ${color}`}>
                          {icon}{inv.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-slate-400">{inv.invitedBy}</td>
                      <td className="py-2.5 px-2 text-slate-400">{new Date(inv.createdAt).toLocaleDateString()}</td>
                      <td className="py-2.5 px-2 text-slate-400">{new Date(inv.expiresAt).toLocaleDateString()}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Future roadmap */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
        <p className="text-xs font-bold text-slate-700 mb-1">Email Integration — Phase E Roadmap</p>
        <p className="text-xs text-slate-500">
          Gmail API integration will automatically email invitation links, send role assignment notifications,
          and trigger weekly reminders. Planned for Firebase Phase E.
        </p>
      </div>
    </div>
  )
}
