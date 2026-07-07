import { useEffect, useState } from 'react'
import {
  Settings2, Save, Plus, Copy, Archive, ArchiveRestore, Trash2,
  RotateCcw, Star, Eye, History, X, CheckCircle2,
} from 'lucide-react'
import PageHeader from '../../../components/ui/PageHeader'
import SectionCard from '../../../components/ui/SectionCard'
import { useAuthContext } from '../../../contexts/AuthContext'
import {
  getAllTemplates, getArchivedOrDeletedTemplates, getTemplateVersionHistory,
  createTemplate, saveNewTemplateVersion, cloneTemplate, setTemplateActive,
  archiveTemplate, unarchiveTemplate, softDeleteTemplate, restoreTemplate,
  setDefaultTemplate,
} from '../../../firebase/peopleLetters'
import { buildLetterPdf } from '../../../utils/letterPdf'
import { emptyLetterTemplate, TEMPLATE_THEMES, TEMPLATE_THEME_LABELS, TEMPLATE_FONTS } from '../../../types/peopleLetters'
import type { PeopleLetterTemplate } from '../../../types/peopleLetters'

type TemplateForm = Omit<PeopleLetterTemplate,
  'id' | 'partnerId' | 'organisationId' | 'createdAt' | 'updatedAt' | 'status' | 'createdBy' | 'templateGroupId' | 'version' | 'isLatest'>

function toForm(t: PeopleLetterTemplate): TemplateForm {
  const { id: _id, partnerId: _p, organisationId: _o, createdAt: _c, updatedAt: _u, status: _s, createdBy: _cb,
    templateGroupId: _tg, version: _v, isLatest: _il, ...rest } = t
  return rest
}

function samplePreviewLetter(template: PeopleLetterTemplate) {
  const now = new Date().toISOString()
  return {
    id: 'preview', partnerId: template.partnerId, organisationId: template.organisationId,
    createdAt: now, updatedAt: now, createdBy: 'preview', status: 'Approved',
    letterType: 'offer' as const, templateId: template.id, templateVersion: template.version,
    candidateId: 'preview', candidateName: 'Aarav Sharma', candidateEmail: 'aarav.sharma@example.com',
    designation: 'Battery Intelligence Research Intern',
    documentId: 'ITEL-EV-INT-OFFER-2026-PREVIEW',
    internshipStartDate: '2026-08-01', internshipEndDate: '2027-01-31', acceptanceDeadline: '2026-07-20',
    stipendEnabled: template.stipendSectionEnabledByDefault, stipendAmount: 8000,
    linkedOfferLetterId: '', approvedBy: 'preview', approvedAt: now, generatedBy: 'preview', generatedAt: now,
    pdfUrl: '', pdfStoragePath: '', rejectionReason: '', isDisabled: false, isArchived: false, deletedAt: '',
  }
}

function Field({ label, value, onChange, textarea, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; textarea?: boolean; type?: string
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      {textarea ? (
        <textarea
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
          rows={3}
          value={value}
          onChange={e => onChange(e.target.value)}
        />
      ) : (
        <input
          type={type}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
          value={value}
          onChange={e => onChange(e.target.value)}
        />
      )}
    </label>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <input type="color" className="h-9 w-12 rounded border border-slate-200" value={value} onChange={e => onChange(e.target.value)} />
        <input className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono" value={value} onChange={e => onChange(e.target.value)} />
      </div>
    </label>
  )
}

function Pill({ label, tone }: { label: string; tone: 'green' | 'gray' | 'blue' | 'red' }) {
  const toneClass = {
    green: 'bg-green-100 text-green-700 border-green-200',
    gray:  'bg-slate-100 text-slate-500 border-slate-200',
    blue:  'bg-brand-100 text-brand-700 border-brand-200',
    red:   'bg-red-100 text-red-700 border-red-200',
  }[tone]
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${toneClass}`}>{label}</span>
}

export default function Templates() {
  const { uid } = useAuthContext()
  const [templates, setTemplates] = useState<PeopleLetterTemplate[]>([])
  const [archived, setArchived] = useState<PeopleLetterTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [view, setView] = useState<'list' | 'editor'>('list')
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [form, setForm] = useState<TemplateForm>(emptyLetterTemplate())
  const [versionNote, setVersionNote] = useState('')
  const [saving, setSaving] = useState(false)

  const [historyFor, setHistoryFor] = useState<string | null>(null)
  const [historyList, setHistoryList] = useState<PeopleLetterTemplate[]>([])

  async function refresh() {
    const [all, archivedOrDeleted] = await Promise.all([getAllTemplates(), getArchivedOrDeletedTemplates()])
    setTemplates(all)
    setArchived(archivedOrDeleted)
    setLoading(false)
  }

  useEffect(() => { refresh() }, [])

  function set<K extends keyof TemplateForm>(key: K, value: TemplateForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function openCreate() {
    setEditingGroupId(null)
    setForm(emptyLetterTemplate())
    setVersionNote('')
    setView('editor')
  }

  function openEdit(t: PeopleLetterTemplate) {
    setEditingGroupId(t.templateGroupId)
    setForm(toForm(t))
    setVersionNote('')
    setView('editor')
  }

  async function withBusy(id: string, fn: () => Promise<void>) {
    setBusyId(id)
    try { await fn() } finally { setBusyId(null); await refresh() }
  }

  async function handleSave() {
    if (!uid) return
    setSaving(true)
    if (editingGroupId) {
      await saveNewTemplateVersion(editingGroupId, form, uid, versionNote || 'Updated configuration')
    } else {
      await createTemplate(form, uid)
    }
    setSaving(false)
    setView('list')
    await refresh()
  }

  async function handlePreview(template: TemplateForm) {
    const now = new Date().toISOString()
    const fullTemplate: PeopleLetterTemplate = {
      ...template,
      id: 'preview', partnerId: 'itelematics', organisationId: 'ev-engineer',
      createdAt: now, updatedAt: now, createdBy: 'preview', status: 'active',
      templateGroupId: 'preview', version: '1.0', isLatest: true,
    }
    const pdf = await buildLetterPdf(samplePreviewLetter(fullTemplate), fullTemplate)
    window.open(pdf.output('bloburl') as unknown as string, '_blank')
  }

  async function openHistory(t: PeopleLetterTemplate) {
    setHistoryFor(t.templateGroupId)
    const history = await getTemplateVersionHistory(t.templateGroupId)
    setHistoryList(history)
  }

  if (loading) return <div className="text-sm text-slate-500">Loading templates…</div>

  if (view === 'editor') {
    return (
      <div className="space-y-6">
        <PageHeader
          title={editingGroupId ? 'Edit Template' : 'New Template'}
          subtitle={editingGroupId ? 'Saving creates a new version — HR always sees the version history.' : 'Configure a new reusable Offer/Joining letter template.'}
          icon={<Settings2 size={18} />}
          actions={
            <div className="flex items-center gap-2">
              <button onClick={() => handlePreview(form)} className="btn-ghost flex items-center gap-1.5 text-sm px-3 py-2">
                <Eye size={14} /> Preview PDF
              </button>
              <button onClick={() => setView('list')} className="btn-ghost text-sm px-3 py-2">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-1.5">
                <Save size={14} /> {saving ? 'Saving…' : editingGroupId ? 'Save New Version' : 'Create Template'}
              </button>
            </div>
          }
        />

        <SectionCard title="Template Identity" icon={<Settings2 size={14} />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Template Name" value={form.templateName} onChange={v => set('templateName', v)} />
            {editingGroupId && (
              <Field label="Version Note" value={versionNote} onChange={setVersionNote} />
            )}
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={form.isDefault} onChange={e => set('isDefault', e.target.checked)} />
              Use as the default template for new letters
            </label>
          </div>
        </SectionCard>

        <SectionCard title="Theme & Premium Branding" icon={<Settings2 size={14} />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Theme</span>
              <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.theme}
                onChange={e => set('theme', e.target.value as TemplateForm['theme'])}>
                {TEMPLATE_THEMES.map(t => <option key={t} value={t}>{TEMPLATE_THEME_LABELS[t]}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Font Family</span>
              <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={form.fontFamily}
                onChange={e => set('fontFamily', e.target.value as TemplateForm['fontFamily'])}>
                {TEMPLATE_FONTS.map(f => <option key={f} value={f}>{f}{f !== 'Inter' ? ' (reserved — renders as Inter for now)' : ''}</option>)}
              </select>
            </label>
            <ColorField label="Primary Green" value={form.brandColors.primary} onChange={v => set('brandColors', { ...form.brandColors, primary: v })} />
            <ColorField label="Primary Blue" value={form.brandColors.secondary} onChange={v => set('brandColors', { ...form.brandColors, secondary: v })} />
            <ColorField label="Orange" value={form.brandColors.accent} onChange={v => set('brandColors', { ...form.brandColors, accent: v })} />
            <ColorField label="Dark Navy" value={form.brandColors.navy} onChange={v => set('brandColors', { ...form.brandColors, navy: v })} />
            <ColorField label="Light Gray" value={form.brandColors.lightGray} onChange={v => set('brandColors', { ...form.brandColors, lightGray: v })} />
            <ColorField label="Success Green" value={form.brandColors.success} onChange={v => set('brandColors', { ...form.brandColors, success: v })} />
          </div>
        </SectionCard>

        <SectionCard title="Hero Banner, Logo & Letterhead" icon={<Settings2 size={14} />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={form.heroBannerEnabled} onChange={e => set('heroBannerEnabled', e.target.checked)} />
              Show hero banner (~12–15% of page height, never full-bleed)
            </label>
            <Field label="Hero Banner Image URL" value={form.heroBannerImageUrl} onChange={v => set('heroBannerImageUrl', v)} />
            <Field label="Letterhead Image URL" value={form.letterheadImageUrl} onChange={v => set('letterheadImageUrl', v)} />
            <Field label="Company Logo URL" value={form.companyLogoUrl} onChange={v => set('companyLogoUrl', v)} />
          </div>
        </SectionCard>

        <SectionCard title="Watermark, QR Code & Seal" icon={<Settings2 size={14} />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.watermarkEnabled} onChange={e => set('watermarkEnabled', e.target.checked)} />
              Enable watermark
            </label>
            <Field label="Watermark Text" value={form.watermarkText} onChange={v => set('watermarkText', v)} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.qrCodeEnabled} onChange={e => set('qrCodeEnabled', e.target.checked)} />
              Show verification QR code (ev.engineer/verify/&#123;documentId&#125;)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.companySealEnabled} onChange={e => set('companySealEnabled', e.target.checked)} />
              Show company seal
            </label>
            <Field label="Company Seal Image URL" value={form.companySealImageUrl} onChange={v => set('companySealImageUrl', v)} />
          </div>
        </SectionCard>

        <SectionCard title="Company Identity" icon={<Settings2 size={14} />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Company Name" value={form.companyName} onChange={v => set('companyName', v)} />
            <Field label="Business Unit" value={form.businessUnit} onChange={v => set('businessUnit', v)} />
            <Field label="Department" value={form.department} onChange={v => set('department', v)} />
            <Field label="Domain" value={form.domain} onChange={v => set('domain', v)} />
            <Field label="Specialisation" value={form.specialisation} onChange={v => set('specialisation', v)} />
            <Field label="Company Address" value={form.companyAddress} onChange={v => set('companyAddress', v)} />
            <Field label="Email" value={form.companyEmail} onChange={v => set('companyEmail', v)} />
            <Field label="Phone" value={form.companyPhone} onChange={v => set('companyPhone', v)} />
            <Field label="Website" value={form.companyWebsite} onChange={v => set('companyWebsite', v)} />
          </div>
        </SectionCard>

        <SectionCard title="Internship Defaults" icon={<Settings2 size={14} />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Internship Type" value={form.internshipType} onChange={v => set('internshipType', v)} />
            <Field label="Duration" value={form.durationText} onChange={v => set('durationText', v)} />
            <Field label="Weekly Hours" value={form.weeklyHours} onChange={v => set('weeklyHours', v)} />
          </div>
        </SectionCard>

        <SectionCard title="Letter Chrome & Signatory" icon={<Settings2 size={14} />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Header / Tagline Text" value={form.headerText} onChange={v => set('headerText', v)} />
            <Field label="Footer Text" value={form.footerText} onChange={v => set('footerText', v)} />
            <Field label="HR Manager Name" value={form.hrManagerName} onChange={v => set('hrManagerName', v)} />
            <Field label="HR Manager Designation" value={form.hrManagerDesignation} onChange={v => set('hrManagerDesignation', v)} />
            <Field label="HR Manager Email" value={form.hrManagerEmail} onChange={v => set('hrManagerEmail', v)} />
            <Field label="Signature Image URL" value={form.signatureImageUrl} onChange={v => set('signatureImageUrl', v)} />
          </div>
        </SectionCard>

        <SectionCard title="Stipend" icon={<Settings2 size={14} />}>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.stipendSectionEnabledByDefault}
              onChange={e => set('stipendSectionEnabledByDefault', e.target.checked)}
            />
            Enable stipend section by default on new letters
          </label>
        </SectionCard>

        <SectionCard title="Clauses & Instructions" icon={<Settings2 size={14} />}>
          <div className="space-y-4">
            <Field label="Certificate Eligibility" value={form.certificateEligibilityText} onChange={v => set('certificateEligibilityText', v)} textarea />
            <Field label="Confidentiality / IP Clause" value={form.confidentialityClause} onChange={v => set('confidentialityClause', v)} textarea />
            <Field label="Code of Conduct Clause" value={form.codeOfConductClause} onChange={v => set('codeOfConductClause', v)} textarea />
            <Field label="Termination Clause" value={form.terminationClause} onChange={v => set('terminationClause', v)} textarea />
            <Field label="Acceptance Instruction Text" value={form.acceptanceInstructionText} onChange={v => set('acceptanceInstructionText', v)} textarea />
          </div>
        </SectionCard>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Letter Templates"
        subtitle="Create, clone, version, and manage premium Offer/Joining letter templates."
        icon={<Settings2 size={18} />}
        actions={
          <button onClick={openCreate} className="btn-primary flex items-center gap-1.5">
            <Plus size={14} /> New Template
          </button>
        }
      />

      <SectionCard title={`Templates (${templates.length})`} icon={<Settings2 size={14} />}>
        {templates.length === 0 ? (
          <p className="text-sm text-slate-500">No templates yet — create one to get started.</p>
        ) : (
          <div className="space-y-3">
            {templates.map(t => (
              <div key={t.id} className="border border-slate-100 rounded-lg p-3.5 flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    {t.templateName}
                    <span className="font-mono text-[10px] text-slate-400">v{t.version}</span>
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <Pill label={TEMPLATE_THEME_LABELS[t.theme]} tone="blue" />
                    {t.isDefault && <Pill label="Default" tone="green" />}
                    <Pill label={t.isActive ? 'Active' : 'Disabled'} tone={t.isActive ? 'green' : 'gray'} />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button onClick={() => handlePreview(toForm(t))} className="btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1">
                    <Eye size={12} /> Preview
                  </button>
                  <button onClick={() => openHistory(t)} className="btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1">
                    <History size={12} /> History
                  </button>
                  <button onClick={() => openEdit(t)} className="btn-secondary text-xs px-2.5 py-1.5">Edit</button>
                  <button disabled={busyId === t.id} onClick={() => withBusy(t.id, async () => { await cloneTemplate(t.id, uid!) })} className="btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1">
                    <Copy size={12} /> Clone
                  </button>
                  {!t.isDefault && (
                    <button disabled={busyId === t.id} onClick={() => withBusy(t.id, async () => { await setDefaultTemplate(t.templateGroupId, uid!) })} className="btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1">
                      <Star size={12} /> Set Default
                    </button>
                  )}
                  <button disabled={busyId === t.id} onClick={() => withBusy(t.id, async () => { await setTemplateActive(t.id, !t.isActive) })} className="btn-ghost text-xs px-2.5 py-1.5">
                    {t.isActive ? 'Disable' : 'Enable'}
                  </button>
                  <button disabled={busyId === t.id} onClick={() => withBusy(t.id, async () => { await archiveTemplate(t.id, uid!) })} className="btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1">
                    <Archive size={12} /> Archive
                  </button>
                  <button disabled={busyId === t.id} onClick={() => withBusy(t.id, async () => { await softDeleteTemplate(t.id, uid!) })} className="btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1 text-red-600">
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {archived.length > 0 && (
        <SectionCard title={`Archived & Deleted (${archived.length})`} icon={<Archive size={14} />}>
          <div className="space-y-3">
            {archived.map(t => (
              <div key={t.id} className="border border-slate-100 rounded-lg p-3.5 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-slate-700">{t.templateName} <span className="font-mono text-[10px] text-slate-400">v{t.version}</span></p>
                  <div className="flex items-center gap-1.5 mt-1">
                    {t.isArchived && <Pill label="Archived" tone="gray" />}
                    {t.deletedAt && <Pill label="Deleted" tone="red" />}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {t.isArchived && (
                    <button disabled={busyId === t.id} onClick={() => withBusy(t.id, async () => { await unarchiveTemplate(t.id, uid!) })} className="btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1">
                      <ArchiveRestore size={12} /> Unarchive
                    </button>
                  )}
                  {t.deletedAt && (
                    <button disabled={busyId === t.id} onClick={() => withBusy(t.id, async () => { await restoreTemplate(t.id, uid!) })} className="btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1">
                      <RotateCcw size={12} /> Restore
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {historyFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setHistoryFor(null)}>
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><History size={14} /> Version History</h3>
              <button onClick={() => setHistoryFor(null)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>
            <div className="space-y-2">
              {historyList.map(v => (
                <div key={v.id} className="border border-slate-100 rounded-lg p-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      v{v.version} {v.isLatest && <CheckCircle2 size={13} className="text-green-600" />}
                    </p>
                    <p className="text-xs text-slate-500">{v.versionNote || '—'}</p>
                    <p className="text-[10px] text-slate-400">{new Date(v.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
