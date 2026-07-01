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

// Shared Tailwind classes — matches the dashboard input style
const selectCls = 'w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-100 transition-colors appearance-none'
const inputCls  = 'w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-100 transition-colors'
const labelCls  = 'block text-xs font-semibold text-slate-600 mb-1.5'

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

export default function AssignmentCreate() {
  const { userProfile, uid } = useAuthContext()
  const navigate   = useNavigate()
  const developers = useDevelopers()
  const stories    = useStories()
  const simulators = useSimulators()

  const [form, setForm]         = useState(emptyM05Assignment())
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone]         = useState(false)
  const [error, setError]       = useState('')
  const [createdId, setCreatedId] = useState('')

  function set<K extends keyof typeof form>(key: K, val: typeof form[K]) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  const filteredStories   = stories.filter(s => !form.productName || s.product === form.productName)
  const filteredSimulators = simulators.filter(s => !form.productName || s.product === form.productName)

  function handleDevChange(devId: string) {
    const dev = developers.find(d => d.id === devId)
    setForm(prev => ({ ...prev, developerId: devId, developerName: dev?.name ?? '', developerEmail: dev?.email ?? '' }))
  }
  function handleStoryChange(storyId: string) {
    const story = stories.find(s => s.id === storyId)
    setForm(prev => ({ ...prev, storyId, storyTitle: story?.title ?? '' }))
  }
  function handleSimChange(simId: string) {
    const sim = simulators.find(s => s.id === simId)
    setForm(prev => ({ ...prev, simulatorId: simId, simulatorTitle: sim?.name ?? '' }))
  }
  function handleProductChange(name: string) {
    const product = PRODUCTS.find(p => p.name === name)
    setForm(prev => ({ ...prev, productName: name, productId: product?.id ?? '', storyId: '', storyTitle: '', simulatorId: '', simulatorTitle: '' }))
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
      const now = new Date().toISOString()
      const id = await createM05Assignment({
        ...form,
        status: 'Assigned' as M05AssignmentStatus,
        assignedBy: uid,
        assignedByName: userProfile.displayName,
        assignedDate: now,
        lastUpdated: now,
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
    } catch {
      setError('Failed to create assignment. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <PageHeader title="Assignment Created" subtitle="M05 Assignment Management" icon={<ClipboardList size={18}/>} />
        <div className="card p-10 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle size={28} className="text-green-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Assignment Created</h2>
            <p className="text-sm text-slate-500 mt-1">
              Assigned to <strong>{form.developerName}</strong> · ID: <span className="font-mono text-slate-700">{createdId}</span>
            </p>
            <p className="text-xs text-slate-400 mt-1">The developer can accept or decline from their dashboard.</p>
          </div>
          <div className="flex gap-3 mt-2">
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

        {/* ── Developer & Role ──────────────────────────────────── */}
        <div className="card p-5 space-y-4">
          <p className="data-label">Developer & Role</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Developer" required>
              <select value={form.developerId} onChange={e => handleDevChange(e.target.value)} className={selectCls}>
                <option value="">Select developer…</option>
                {developers.map(d => <option key={d.id} value={d.id}>{d.name} ({d.id})</option>)}
              </select>
            </Field>
            <Field label="Assignment Role">
              <select value={form.assignmentRole} onChange={e => set('assignmentRole', e.target.value as AssignmentRole)} className={selectCls}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Category">
              <select value={form.assignmentCategory} onChange={e => set('assignmentCategory', e.target.value as AssignmentCategory)} className={selectCls}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Priority">
              <select value={form.priority} onChange={e => set('priority', e.target.value as typeof form.priority)} className={selectCls}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
          </div>
        </div>

        {/* ── Product & Work Items ──────────────────────────────── */}
        <div className="card p-5 space-y-4">
          <p className="data-label">Product & Work Items</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Product" required>
              <select value={form.productName} onChange={e => handleProductChange(e.target.value)} className={selectCls}>
                <option value="">Select product…</option>
                {PRODUCTS.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Work Package">
              <select value={form.workPackageId} onChange={e => set('workPackageId', e.target.value)} className={selectCls}>
                <option value="">Select work package…</option>
                {WORK_PACKAGES.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </Field>
            <Field label="Milestone">
              <select value={form.milestoneId} onChange={e => set('milestoneId', e.target.value)} className={selectCls}>
                <option value="">Select milestone…</option>
                {MILESTONES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="User Story">
              <select value={form.storyId} onChange={e => handleStoryChange(e.target.value)} className={selectCls}>
                <option value="">Select story…</option>
                {filteredStories.map(s => <option key={s.id} value={s.id}>{s.id} — {s.title}</option>)}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Simulator">
                <select value={form.simulatorId} onChange={e => handleSimChange(e.target.value)} className={selectCls}>
                  <option value="">None (desktop app or N/A)</option>
                  {filteredSimulators.map(s => <option key={s.id} value={s.id}>{s.id} — {s.name}</option>)}
                </select>
              </Field>
            </div>
          </div>
        </div>

        {/* ── Timeline & Hours ──────────────────────────────────── */}
        <div className="card p-5 space-y-4">
          <p className="data-label">Timeline & Hours</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Planned Start" required>
              <input type="date" value={form.plannedStartDate} onChange={e => set('plannedStartDate', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Planned End" required>
              <input type="date" value={form.plannedEndDate} onChange={e => set('plannedEndDate', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Estimated Hours">
              <input type="number" min={1} max={500} value={form.estimatedHours} onChange={e => set('estimatedHours', Number(e.target.value))} className={inputCls} />
            </Field>
          </div>
        </div>

        {/* ── Manager Notes ─────────────────────────────────────── */}
        <div className="card p-5 space-y-3">
          <p className="data-label">Manager Notes</p>
          <textarea
            rows={3}
            value={form.managerNotes}
            onChange={e => set('managerNotes', e.target.value)}
            placeholder="Instructions, context, or expectations for the developer…"
            className={`${inputCls} resize-none`}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex justify-end gap-3 pb-2">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
          <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-brand-700 hover:bg-brand-800 disabled:opacity-50 text-white font-semibold text-sm transition-colors">
            {submitting
              ? <><Loader2 size={14} className="animate-spin" /> Creating…</>
              : <><ClipboardList size={14}/> Create Assignment</>}
          </button>
        </div>

      </form>
    </div>
  )
}
