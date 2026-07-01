import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Loader2, CheckCircle, AlertTriangle } from 'lucide-react'
import { useAuthContext } from '../../contexts/AuthContext'
import { useDevelopers, useStories, useSimulators } from '../../data/DataProvider'
import { createM05Assignment, recordHistory } from '../../firebase/assignments'
import { emptyM05Assignment, type AssignmentCategory, type AssignmentRole, type M05AssignmentStatus } from '../../types/assignments'
import PageHeader from '../../components/ui/PageHeader'

const PRODUCTS = [
  { id: 'P1', name: 'Battery Pack Aadhaar System' },
  { id: 'P2', name: 'Battery Cybersecurity Platform' },
  { id: 'P3', name: 'AS9102 FAI Reports Platform' },
]

const WORK_PACKAGES = ['WP-001','WP-002','WP-003','WP-004','WP-005','WP-006','WP-101','WP-102','WP-103','WP-104','WP-105']
const MILESTONES    = ['M01','M02','M03','M04','M05']
const CATEGORIES: AssignmentCategory[] = ['Simulator','Story','QA','Architect','Research','Mentor','Support']
const ROLES: AssignmentRole[]           = ['Primary Developer','Secondary Developer','QA Reviewer','Architect','Observer','Mentor']
const PRIORITIES                        = ['Critical','High','Medium','Low'] as const

export default function AssignmentCreate() {
  const { userProfile, uid } = useAuthContext()
  const navigate  = useNavigate()
  const developers  = useDevelopers()
  const stories     = useStories()
  const simulators  = useSimulators()

  const [form, setForm] = useState(emptyM05Assignment())
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone]             = useState(false)
  const [error, setError]           = useState('')
  const [createdId, setCreatedId]   = useState('')

  function set<K extends keyof typeof form>(key: K, val: typeof form[K]) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  // Filter stories/simulators by chosen product
  const filteredStories   = stories.filter(s => !form.productName || s.product === form.productName)
  const filteredSimulators = simulators.filter(s => !form.productName || s.product === form.productName)

  // Auto-fill developer fields when developerId changes
  function handleDevChange(devId: string) {
    const dev = developers.find(d => d.id === devId)
    set('developerId', devId)
    set('developerName', dev?.name ?? '')
    set('developerEmail', dev?.email ?? '')
  }

  // Auto-fill story title when storyId changes
  function handleStoryChange(storyId: string) {
    const story = stories.find(s => s.id === storyId)
    set('storyId', storyId)
    set('storyTitle', story?.title ?? '')
  }

  // Auto-fill simulator title when simulatorId changes
  function handleSimChange(simId: string) {
    const sim = simulators.find(s => s.id === simId)
    set('simulatorId', simId)
    set('simulatorTitle', sim?.name ?? '')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!uid || !userProfile) return
    if (!form.developerId || !form.productName || !form.plannedStartDate || !form.plannedEndDate) {
      setError('Developer, product, start date, and end date are required.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const id = await createM05Assignment({
        ...form,
        status: 'Assigned' as M05AssignmentStatus,
        assignedBy: uid,
        assignedByName: userProfile.displayName,
        assignedDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      })
      await recordHistory({
        assignmentId: id,
        action: 'Assigned',
        performedBy: uid,
        performedByName: userProfile.displayName,
        performedByEmail: userProfile.email ?? '',
        performedByRole: userProfile.role ?? '',
        note: `Assignment created by ${userProfile.displayName}`,
        previousStatus: '',
        newStatus: 'Assigned',
      })
      setCreatedId(id)
      setDone(true)
    } catch (err) {
      setError('Failed to create assignment. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <PageHeader title="Assignment Created" subtitle="M05 Assignment Management" icon={<ClipboardList size={18}/>} />
        <div className="card p-10 flex flex-col items-center gap-4">
          <CheckCircle size={48} className="text-green-500" />
          <h2 className="text-xl font-bold text-slate-800">Assignment Created</h2>
          <p className="text-slate-500 text-sm">ID: <span className="font-mono font-bold text-slate-700">{createdId}</span></p>
          <p className="text-slate-500 text-sm">
            A notification has been sent to <strong>{form.developerName}</strong>. They can accept or decline from their dashboard.
          </p>
          <div className="flex gap-3">
            <button onClick={() => navigate('/admin/capacity')} className="btn-secondary">View Capacity</button>
            <button onClick={() => { setForm(emptyM05Assignment()); setDone(false) }} className="btn-primary">Create Another</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Create Assignment"
        subtitle="M05 Assignment Management System"
        icon={<ClipboardList size={18}/>}
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Developer & Role */}
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Developer & Role</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Developer <span className="text-red-500">*</span></label>
              <select value={form.developerId} onChange={e => handleDevChange(e.target.value)} className="form-select">
                <option value="">Select developer…</option>
                {developers.map(d => <option key={d.id} value={d.id}>{d.name} ({d.id})</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Assignment Role</label>
              <select value={form.assignmentRole} onChange={e => set('assignmentRole', e.target.value as AssignmentRole)} className="form-select">
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Category</label>
              <select value={form.assignmentCategory} onChange={e => set('assignmentCategory', e.target.value as AssignmentCategory)} className="form-select">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Priority</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value as typeof form.priority)} className="form-select">
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Product & Work */}
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Product & Work Items</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Product <span className="text-red-500">*</span></label>
              <select value={form.productName} onChange={e => { set('productName', e.target.value); set('productId', PRODUCTS.find(p => p.name === e.target.value)?.id ?? '') }} className="form-select">
                <option value="">Select product…</option>
                {PRODUCTS.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Work Package</label>
              <select value={form.workPackageId} onChange={e => set('workPackageId', e.target.value)} className="form-select">
                <option value="">Select work package…</option>
                {WORK_PACKAGES.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Milestone</label>
              <select value={form.milestoneId} onChange={e => set('milestoneId', e.target.value)} className="form-select">
                <option value="">Select milestone…</option>
                {MILESTONES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">User Story</label>
              <select value={form.storyId} onChange={e => handleStoryChange(e.target.value)} className="form-select">
                <option value="">Select story…</option>
                {filteredStories.map(s => <option key={s.id} value={s.id}>{s.id} — {s.title}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Simulator</label>
              <select value={form.simulatorId} onChange={e => handleSimChange(e.target.value)} className="form-select">
                <option value="">None (desktop app or N/A)</option>
                {filteredSimulators.map(s => <option key={s.id} value={s.id}>{s.id} — {s.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Timeline & Hours */}
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Timeline & Hours</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="form-label">Planned Start <span className="text-red-500">*</span></label>
              <input type="date" value={form.plannedStartDate} onChange={e => set('plannedStartDate', e.target.value)} className="form-input" />
            </div>
            <div>
              <label className="form-label">Planned End <span className="text-red-500">*</span></label>
              <input type="date" value={form.plannedEndDate} onChange={e => set('plannedEndDate', e.target.value)} className="form-input" />
            </div>
            <div>
              <label className="form-label">Estimated Hours</label>
              <input type="number" min={1} max={500} value={form.estimatedHours} onChange={e => set('estimatedHours', Number(e.target.value))} className="form-input" />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Manager Notes</h2>
          <textarea
            rows={3}
            value={form.managerNotes}
            onChange={e => set('managerNotes', e.target.value)}
            placeholder="Instructions, context, or expectations for the developer…"
            className="form-textarea"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={submitting} className="btn-primary gap-1.5">
            {submitting ? <><Loader2 size={14} className="animate-spin" /> Creating…</> : <><ClipboardList size={14}/> Create Assignment</>}
          </button>
        </div>
      </form>
    </div>
  )
}
