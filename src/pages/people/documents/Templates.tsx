import { useEffect, useState } from 'react'
import { Settings2, Save } from 'lucide-react'
import PageHeader from '../../../components/ui/PageHeader'
import SectionCard from '../../../components/ui/SectionCard'
import { useAuthContext } from '../../../contexts/AuthContext'
import { getDefaultLetterTemplate, upsertDefaultLetterTemplate } from '../../../firebase/peopleLetters'
import { SEED_LETTER_TEMPLATE } from '../../../data/peopleLettersSeed'
import { emptyLetterTemplate } from '../../../types/peopleLetters'
import type { PeopleLetterTemplate } from '../../../types/peopleLetters'

type TemplateForm = Omit<PeopleLetterTemplate, 'id' | 'partnerId' | 'organisationId' | 'createdAt' | 'updatedAt' | 'status' | 'createdBy'>

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

export default function Templates() {
  const { uid } = useAuthContext()
  const [form, setForm] = useState<TemplateForm>(emptyLetterTemplate())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState('')

  useEffect(() => {
    getDefaultLetterTemplate().then(t => {
      const source = t ?? SEED_LETTER_TEMPLATE
      const { id: _id, partnerId: _p, organisationId: _o, createdAt: _c, updatedAt: _u, status: _s, createdBy: _cb, ...rest } = source
      setForm(rest)
      setLoading(false)
    })
  }, [])

  function set<K extends keyof TemplateForm>(key: K, value: TemplateForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (!uid) return
    setSaving(true)
    await upsertDefaultLetterTemplate(form, uid)
    setSaving(false)
    setSavedAt(new Date().toLocaleTimeString())
  }

  if (loading) return <div className="text-sm text-slate-500">Loading template…</div>

  return (
    <div className="space-y-6">
      <PageHeader
        title="Letter Template"
        subtitle="Configure once — reused for every offer and joining letter. Only candidate-specific fields are filled per letter."
        icon={<Settings2 size={18} />}
        actions={
          <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-1.5">
            <Save size={14} /> {saving ? 'Saving…' : 'Save Template'}
          </button>
        }
      />
      {savedAt && <p className="text-xs text-green-600">Saved at {savedAt}</p>}

      <SectionCard title="Company Identity" icon={<Settings2 size={14} />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Company Name" value={form.companyName} onChange={v => set('companyName', v)} />
          <Field label="Business Unit" value={form.businessUnit} onChange={v => set('businessUnit', v)} />
          <Field label="Department" value={form.department} onChange={v => set('department', v)} />
          <Field label="Domain" value={form.domain} onChange={v => set('domain', v)} />
          <Field label="Specialisation" value={form.specialisation} onChange={v => set('specialisation', v)} />
          <Field label="Company Address" value={form.companyAddress} onChange={v => set('companyAddress', v)} />
          <Field label="Email" value={form.companyEmail} onChange={v => set('companyEmail', v)} />
          <Field label="Website" value={form.companyWebsite} onChange={v => set('companyWebsite', v)} />
          <Field label="Letterhead Image URL" value={form.letterheadImageUrl} onChange={v => set('letterheadImageUrl', v)} />
          <Field label="Company Logo URL" value={form.companyLogoUrl} onChange={v => set('companyLogoUrl', v)} />
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
          <Field label="Header Text" value={form.headerText} onChange={v => set('headerText', v)} />
          <Field label="Footer Text" value={form.footerText} onChange={v => set('footerText', v)} />
          <Field label="HR Manager Name" value={form.hrManagerName} onChange={v => set('hrManagerName', v)} />
          <Field label="HR Manager Designation" value={form.hrManagerDesignation} onChange={v => set('hrManagerDesignation', v)} />
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
