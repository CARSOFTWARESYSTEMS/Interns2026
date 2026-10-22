import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Building2, Plus, Globe, Palette, LogIn, LayoutTemplate, Phone, Puzzle, BadgeInfo,
  Trash2, Star, AlertCircle, CheckCircle, X,
} from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import SectionCard from '../../components/ui/SectionCard'
import { useAuthContext } from '../../contexts/AuthContext'
import { usePartner } from '../../contexts/PartnerContext'
import {
  listPartners, createPartner, updatePartner, getPartnerSettings, updatePartnerSettings,
  listPartnerDomains, addPartnerDomain, updatePartnerDomain, removePartnerDomain, writeTenantAudit,
  type PartnerDraft,
} from '../../firebase/partners'
import {
  PARTNER_ID_PATTERN, PARTNER_MODULE_KEYS,
  type Partner, type PartnerDomain, type PartnerModuleKey, type PartnerSettings,
} from '../../types/partner'
import type { AuditAction } from '../../types/auth'
import { normalizeHostname, isLocalDevHost } from '../../tenant/hostname'
import { paletteFor, parseHex } from '../../tenant/theme'
import { safeUrl, safeEmail } from '../../tenant/branding'
import seed from '../../tenant/partners.seed.json'

// ── Constants ───────────────────────────────────────────────────────────────

type Tab = 'identity' | 'domains' | 'theme' | 'login' | 'platform' | 'contact' | 'modules'

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'identity', label: 'Identity', icon: <BadgeInfo size={13} /> },
  { id: 'domains',  label: 'Domains',  icon: <Globe size={13} /> },
  { id: 'theme',    label: 'Theme',    icon: <Palette size={13} /> },
  { id: 'login',    label: 'Login',    icon: <LogIn size={13} /> },
  { id: 'platform', label: 'Platform', icon: <LayoutTemplate size={13} /> },
  { id: 'contact',  label: 'Contact',  icon: <Phone size={13} /> },
  { id: 'modules',  label: 'Modules',  icon: <Puzzle size={13} /> },
]

const MODULE_LABELS: Record<PartnerModuleKey, string> = {
  engineering: 'Engineering',
  peopleOperations: 'People Operations',
  quality: 'Quality',
  cybersecurity: 'Cybersecurity',
  fai: 'FAI',
  digitalTwin: 'Digital Twin',
  internships: 'Internships',
  reports: 'Reports',
}

const inputCls = 'w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:border-brand-400'

/** A blank Partner using the seed's structure for defaults (no invented copy). */
function blankPartner(id: string, displayName: string, domain: string): PartnerDraft {
  return {
    id, slug: id, status: 'Active',
    displayName, shortName: displayName, legalName: displayName, description: '',
    defaultDomain: domain,
    branding: { logoUrl: '', logoDarkUrl: '', faviconUrl: '', primaryColor: '#2563eb', secondaryColor: '#0f172a', accentColor: '#60a5fa' },
    login: { title: displayName, subtitle: '', restrictedNotice: `Access is restricted to authorized ${displayName} team members.` },
    platform: { title: displayName, subtitle: '', tagline: 'Engineering Command Center', footer: '', versionLabel: '' },
    contact: { supportEmail: '', supportPhone: '', whatsappUrl: '', websiteUrl: '', supportUrl: '' },
    documentPrefix: id.toUpperCase(),
    city: '', country: '',
  }
}

/** Validation for values that end up in links, images or document numbers. */
function validate(p: PartnerDraft): string[] {
  const errs: string[] = []
  if (!p.displayName.trim()) errs.push('Display name is required.')
  for (const [label, v] of [
    ['Logo URL', p.branding.logoUrl], ['Dark logo URL', p.branding.logoDarkUrl], ['Favicon URL', p.branding.faviconUrl],
    ['WhatsApp URL', p.contact.whatsappUrl], ['Website', p.contact.websiteUrl], ['Support URL', p.contact.supportUrl],
  ] as const) {
    if (v && !safeUrl(v)) errs.push(`${label} must be an https:// URL.`)
  }
  if (p.contact.supportEmail && !safeEmail(p.contact.supportEmail)) errs.push('Support email is not a valid address.')
  for (const [label, v] of [['Primary', p.branding.primaryColor], ['Secondary', p.branding.secondaryColor], ['Accent', p.branding.accentColor]] as const) {
    if (!parseHex(v)) errs.push(`${label} colour must be a hex value like #2563eb.`)
  }
  if (!/^[A-Z0-9][A-Z0-9-]{0,23}$/.test(p.documentPrefix)) errs.push('Document prefix: A–Z, 0–9 and hyphens, up to 24 characters.')
  return errs
}

// ── Small form helpers ──────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="block text-xs font-semibold text-slate-600 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[10px] text-slate-400 mt-1">{hint}</span>}
    </label>
  )
}

function Text({ value, onChange, placeholder, mono }: { value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean }) {
  return <input className={`${inputCls} ${mono ? 'font-mono text-xs' : ''}`} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function Partners() {
  const { userProfile, uid } = useAuthContext()
  const { partner: hostPartner } = usePartner()

  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading]   = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    listPartners()
      .then(ps => setPartners(ps.sort((a, b) => a.displayName.localeCompare(b.displayName))))
      .catch(() => setNotice({ kind: 'error', text: 'Only Platform Admins can view the Partner registry.' }))
      .finally(() => setLoading(false))
  }, [])

  const selected = partners.find(p => p.id === selectedId) ?? null

  async function audit(action: AuditAction, partnerId: string, targetType: string, targetId: string, details: string, metadata?: Record<string, string>) {
    if (!userProfile) return
    await writeTenantAudit({ uid: userProfile.uid, userEmail: userProfile.email, action, partnerId, targetType, targetId, details, metadata })
      .catch(() => {})
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Partners"
        subtitle="Platform Admin · Partner registry, domains, branding and modules"
        icon={<Building2 size={18} />}
        actions={
          <button onClick={() => setShowCreate(s => !s)} className="btn-primary flex items-center gap-1.5">
            <Plus size={14} /> New Partner
          </button>
        }
      />

      {notice && (
        <div className={`p-3 rounded-lg border flex gap-2 text-sm ${notice.kind === 'ok' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {notice.kind === 'ok' ? <CheckCircle size={15} className="flex-shrink-0 mt-0.5" /> : <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />}
          <span className="flex-1 min-w-0 break-words">{notice.text}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss"><X size={14} /></button>
        </div>
      )}

      {showCreate && uid && (
        <CreatePartner
          existingIds={partners.map(p => p.id)}
          onCancel={() => setShowCreate(false)}
          onCreate={async (draft, domain) => {
            try {
              const created = await createPartner(draft, { partnerId: draft.id, ...seed.defaultSettings } as PartnerSettings, uid)
              await audit('partner_created', created.id, 'partners', created.id, `Created Partner ${created.displayName}`)
              if (domain) {
                await addPartnerDomain(created.id, domain, true)
                await audit('domain_added', created.id, 'partnerDomains', domain, `Added domain ${domain}`)
              }
              setPartners(ps => [...ps, created].sort((a, b) => a.displayName.localeCompare(b.displayName)))
              setSelectedId(created.id)
              setShowCreate(false)
              setNotice({ kind: 'ok', text: `${created.displayName} created. Configure its branding, then assign an Admin from Users.` })
            } catch (e) {
              setNotice({ kind: 'error', text: (e as Error).message || 'Could not create the Partner.' })
            }
          }}
        />
      )}

      {/* Partner cards */}
      {loading ? (
        <p className="text-sm text-slate-400 text-center py-8">Loading Partners…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {partners.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id === selectedId ? null : p.id)}
              className={`card text-left overflow-hidden transition-all hover:shadow-md ${p.id === selectedId ? 'ring-2 ring-brand-400' : ''}`}
            >
              <div className="h-1.5" style={{ background: parseHex(p.branding?.primaryColor) ? p.branding.primaryColor : '#2563eb' }} />
              <div className="p-4 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-slate-900 text-sm break-words min-w-0">{p.displayName}</p>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${p.status === 'Active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                    {p.status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono truncate">{p.id}</p>
                <p className="text-xs text-slate-500 flex items-center gap-1 min-w-0">
                  <Globe size={11} className="flex-shrink-0" /><span className="truncate">{p.defaultDomain || 'No primary domain'}</span>
                </p>
                {p.id === hostPartner?.id && <p className="text-[10px] font-semibold text-brand-600">This domain</p>}
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && uid && (
        <PartnerEditor
          key={selected.id}
          partner={selected}
          actorUid={uid}
          onSaved={(updated, changed) => {
            setPartners(ps => ps.map(p => p.id === updated.id ? updated : p))
            setNotice({ kind: 'ok', text: `Saved ${updated.displayName}.` })
            audit('partner_updated', updated.id, 'partners', updated.id, `Updated ${changed.join(', ')}`, { fields: changed.join(',') })
          }}
          onError={text => setNotice({ kind: 'error', text })}
          onAudit={audit}
        />
      )}
    </div>
  )
}

// ── Create ──────────────────────────────────────────────────────────────────

function CreatePartner({ existingIds, onCancel, onCreate }: {
  existingIds: string[]
  onCancel: () => void
  onCreate: (draft: PartnerDraft, domain: string | null) => Promise<void>
}) {
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [busy, setBusy] = useState(false)

  const host = domain.trim() ? normalizeHostname(domain) : null
  const errors = [
    id && !PARTNER_ID_PATTERN.test(id) ? 'Id: lowercase letters, digits and hyphens (e.g. "acme-aero").' : '',
    existingIds.includes(id) ? 'That id is already used.' : '',
    domain.trim() && (!host || isLocalDevHost(host)) ? 'Domain must be a real hostname such as login.example.com.' : '',
  ].filter(Boolean)
  const canSubmit = id && name.trim() && errors.length === 0 && !busy

  return (
    <SectionCard title="New Partner" icon={<Plus size={14} />}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Partner id" hint="Permanent security identifier — cannot be changed later.">
          <Text value={id} onChange={v => setId(v.toLowerCase().trim())} placeholder="acme-aero" mono />
        </Field>
        <Field label="Display name">
          <Text value={name} onChange={setName} placeholder="ACME™ Aerospace" />
        </Field>
        <Field label="Primary login domain" hint="Optional now; add more under Domains.">
          <Text value={domain} onChange={setDomain} placeholder="login.acme.example" mono />
        </Field>
      </div>
      {errors.length > 0 && <ul className="mt-3 text-xs text-red-600 list-disc pl-5">{errors.map(e => <li key={e}>{e}</li>)}</ul>}
      <div className="flex gap-2 mt-4">
        <button onClick={onCancel} className="btn-ghost text-sm px-4 py-2">Cancel</button>
        <button
          disabled={!canSubmit}
          onClick={async () => { setBusy(true); await onCreate(blankPartner(id, name.trim(), host ?? ''), host); setBusy(false) }}
          className="btn-primary text-sm px-5 py-2 disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Create Partner'}
        </button>
      </div>
    </SectionCard>
  )
}

// ── Editor ──────────────────────────────────────────────────────────────────

function PartnerEditor({ partner, actorUid, onSaved, onError, onAudit }: {
  partner: Partner
  actorUid: string
  onSaved: (p: Partner, changedSections: string[]) => void
  onError: (text: string) => void
  onAudit: (action: AuditAction, partnerId: string, targetType: string, targetId: string, details: string) => Promise<void>
}) {
  const [tab, setTab] = useState<Tab>('identity')
  const [draft, setDraft] = useState<PartnerDraft>(() => ({
    ...blankPartner(partner.id, partner.displayName, partner.defaultDomain),
    ...partner,
    branding: { ...blankPartner(partner.id, '', '').branding, ...partner.branding },
    login: { ...blankPartner(partner.id, '', '').login, ...partner.login },
    platform: { ...blankPartner(partner.id, '', '').platform, ...partner.platform },
    contact: { ...blankPartner(partner.id, '', '').contact, ...partner.contact },
  }))
  const [settings, setSettings] = useState<PartnerSettings | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { getPartnerSettings(partner.id).then(setSettings).catch(() => setSettings(null)) }, [partner.id])

  const errors = useMemo(() => validate(draft), [draft])
  const set = <K extends keyof PartnerDraft>(k: K, v: PartnerDraft[K]) => setDraft(d => ({ ...d, [k]: v }))
  const setIn = <K extends 'branding' | 'login' | 'platform' | 'contact'>(k: K, field: keyof PartnerDraft[K], v: string) =>
    setDraft(d => ({ ...d, [k]: { ...d[k], [field]: v } }))

  async function save() {
    if (errors.length) { onError(errors[0]); return }
    setSaving(true)
    try {
      const sections = (['displayName', 'shortName', 'legalName', 'description', 'status', 'documentPrefix', 'city', 'country', 'branding', 'login', 'platform', 'contact'] as const)
        .filter(k => JSON.stringify(draft[k]) !== JSON.stringify((partner as PartnerDraft)[k]))
      await updatePartner(partner.id, draft, actorUid)
      if (settings) await updatePartnerSettings(partner.id, { modules: settings.modules, authPolicy: settings.authPolicy }, actorUid)
      onSaved({ ...partner, ...draft, updatedAt: new Date().toISOString(), updatedBy: actorUid }, sections.length ? sections : ['settings'])
    } catch {
      onError('Save was rejected. Only Platform Admins can change Partner configuration.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionCard title={`Configure ${partner.displayName}`} icon={<Building2 size={14} />}>
      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-2 -mx-1 px-1 border-b border-slate-100 mb-4">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${tab === t.id ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {tab === 'identity' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Partner id" hint="Immutable security boundary."><Text value={draft.id} onChange={() => {}} mono /></Field>
          <Field label="Status" hint="Inactive Partners' domains show 'workspace unavailable'.">
            <select className={inputCls} value={draft.status} onChange={e => set('status', e.target.value as Partner['status'])}>
              <option>Active</option><option>Inactive</option>
            </select>
          </Field>
          <Field label="Display name"><Text value={draft.displayName} onChange={v => set('displayName', v)} /></Field>
          <Field label="Short name"><Text value={draft.shortName} onChange={v => set('shortName', v)} /></Field>
          <Field label="Legal name"><Text value={draft.legalName} onChange={v => set('legalName', v)} /></Field>
          <Field label="Document number prefix" hint="Used for offer/joining letter ids.">
            <Text value={draft.documentPrefix} onChange={v => set('documentPrefix', v.toUpperCase())} mono />
          </Field>
          <div className="sm:col-span-2"><Field label="Description"><Text value={draft.description} onChange={v => set('description', v)} /></Field></div>
          <Field label="Logo URL (light backgrounds)" hint="https:// only"><Text value={draft.branding.logoUrl} onChange={v => setIn('branding', 'logoUrl', v)} mono /></Field>
          <Field label="Logo URL (dark backgrounds)" hint="https:// only"><Text value={draft.branding.logoDarkUrl} onChange={v => setIn('branding', 'logoDarkUrl', v)} mono /></Field>
          <Field label="Favicon URL" hint="https:// only"><Text value={draft.branding.faviconUrl} onChange={v => setIn('branding', 'faviconUrl', v)} mono /></Field>
        </div>
      )}

      {tab === 'domains' && <DomainsTab partner={partner} actorUid={actorUid} onError={onError} onAudit={onAudit} onPrimary={host => set('defaultDomain', host)} />}

      {tab === 'theme' && <ThemeTab draft={draft} setIn={setIn} />}

      {tab === 'login' && (
        <div className="grid grid-cols-1 gap-3">
          <Field label="Login heading"><Text value={draft.login.title} onChange={v => setIn('login', 'title', v)} /></Field>
          <Field label="Login description"><Text value={draft.login.subtitle} onChange={v => setIn('login', 'subtitle', v)} /></Field>
          <Field label="Access notice"><Text value={draft.login.restrictedNotice} onChange={v => setIn('login', 'restrictedNotice', v)} /></Field>
        </div>
      )}

      {tab === 'platform' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Platform title"><Text value={draft.platform.title} onChange={v => setIn('platform', 'title', v)} /></Field>
          <Field label="Platform subtitle"><Text value={draft.platform.subtitle} onChange={v => setIn('platform', 'subtitle', v)} /></Field>
          <Field label="Tagline"><Text value={draft.platform.tagline} onChange={v => setIn('platform', 'tagline', v)} /></Field>
          <Field label="Footer (company line)"><Text value={draft.platform.footer} onChange={v => setIn('platform', 'footer', v)} /></Field>
          <Field label="Version label"><Text value={draft.platform.versionLabel} onChange={v => setIn('platform', 'versionLabel', v)} /></Field>
          <Field label="Website" hint="https:// only"><Text value={draft.contact.websiteUrl} onChange={v => setIn('contact', 'websiteUrl', v)} mono /></Field>
          <Field label="City"><Text value={draft.city} onChange={v => set('city', v)} /></Field>
          <Field label="Country"><Text value={draft.country} onChange={v => set('country', v)} /></Field>
        </div>
      )}

      {tab === 'contact' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Support email"><Text value={draft.contact.supportEmail} onChange={v => setIn('contact', 'supportEmail', v)} /></Field>
          <Field label="Support phone"><Text value={draft.contact.supportPhone} onChange={v => setIn('contact', 'supportPhone', v)} /></Field>
          <Field label="WhatsApp URL" hint="e.g. https://wa.me/91XXXXXXXXXX"><Text value={draft.contact.whatsappUrl} onChange={v => setIn('contact', 'whatsappUrl', v)} mono /></Field>
          <Field label="Support URL" hint="https:// only"><Text value={draft.contact.supportUrl} onChange={v => setIn('contact', 'supportUrl', v)} mono /></Field>
        </div>
      )}

      {tab === 'modules' && (
        settings ? (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Module switches are stored per Partner for upcoming module gating; today they record intent and do not yet hide navigation.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PARTNER_MODULE_KEYS.map(k => (
                <label key={k} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50">
                  <span className="text-sm font-semibold text-slate-700">{MODULE_LABELS[k]}</span>
                  <input type="checkbox" className="h-4 w-4 accent-brand-600"
                    checked={settings.modules?.[k]?.enabled ?? false}
                    onChange={e => setSettings(s => s && ({ ...s, modules: { ...s.modules, [k]: { ...(s.modules?.[k] ?? {}), enabled: e.target.checked } } }))} />
                </label>
              ))}
            </div>
            <label className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100">
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-700">Allow access requests</span>
                <span className="block text-[11px] text-slate-400">Signed-in users without access can request a Pending Viewer membership.</span>
              </span>
              <input type="checkbox" className="h-4 w-4 accent-brand-600 flex-shrink-0"
                checked={settings.authPolicy?.allowAccessRequests ?? false}
                onChange={e => setSettings(s => s && ({ ...s, authPolicy: { ...s.authPolicy, allowAccessRequests: e.target.checked } }))} />
            </label>
          </div>
        ) : <p className="text-sm text-slate-400">Loading settings…</p>
      )}

      {/* Save */}
      {tab !== 'domains' && (
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3">
          {errors.length > 0
            ? <p className="text-xs text-red-600 flex-1">{errors[0]}{errors.length > 1 ? ` (+${errors.length - 1} more)` : ''}</p>
            : <p className="text-xs text-slate-400 flex-1">Changes apply on the Partner's domains on next load.</p>}
          <button onClick={save} disabled={saving || errors.length > 0} className="btn-primary text-sm px-5 py-2 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      )}
    </SectionCard>
  )
}

// ── Domains ─────────────────────────────────────────────────────────────────

function DomainsTab({ partner, actorUid, onError, onAudit, onPrimary }: {
  partner: Partner
  actorUid: string
  onError: (t: string) => void
  onAudit: (action: AuditAction, partnerId: string, targetType: string, targetId: string, details: string) => Promise<void>
  onPrimary: (host: string) => void
}) {
  const [domains, setDomains] = useState<PartnerDomain[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { listPartnerDomains(partner.id).then(setDomains).catch(() => onError('Could not load domains.')) }, [partner.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const host = input.trim() ? normalizeHostname(input) : null
  const invalid = input.trim() && (!host || isLocalDevHost(host))

  async function add() {
    if (!host || invalid) return
    setBusy(true)
    try {
      const d = await addPartnerDomain(partner.id, host, domains.length === 0)
      setDomains(ds => [...ds, d])
      setInput('')
      await onAudit('domain_added', partner.id, 'partnerDomains', host, `Added domain ${host}`)
      if (d.isPrimary) { await updatePartner(partner.id, { defaultDomain: host }, actorUid); onPrimary(host) }
    } catch (e) {
      onError((e as Error).message || 'Could not add the domain.')
    } finally { setBusy(false) }
  }

  async function makePrimary(d: PartnerDomain) {
    try {
      await Promise.all(domains.filter(x => x.isPrimary && x.hostname !== d.hostname).map(x => updatePartnerDomain(x.hostname, { isPrimary: false })))
      await updatePartnerDomain(d.hostname, { isPrimary: true })
      await updatePartner(partner.id, { defaultDomain: d.hostname }, actorUid)
      setDomains(ds => ds.map(x => ({ ...x, isPrimary: x.hostname === d.hostname })))
      onPrimary(d.hostname)
      await onAudit('partner_updated', partner.id, 'partnerDomains', d.hostname, `Primary domain set to ${d.hostname}`)
    } catch { onError('Could not change the primary domain.') }
  }

  async function toggle(d: PartnerDomain) {
    const status = d.status === 'Active' ? 'Inactive' : 'Active'
    try {
      await updatePartnerDomain(d.hostname, { status })
      setDomains(ds => ds.map(x => x.hostname === d.hostname ? { ...x, status } : x))
      await onAudit('partner_updated', partner.id, 'partnerDomains', d.hostname, `Domain ${d.hostname} set ${status}`)
    } catch { onError('Could not update the domain.') }
  }

  async function remove(d: PartnerDomain) {
    if (!window.confirm(`Remove ${d.hostname}? Users on this address will see "sign-in address isn't configured".`)) return
    try {
      await removePartnerDomain(d.hostname)
      setDomains(ds => ds.filter(x => x.hostname !== d.hostname))
      await onAudit('domain_removed', partner.id, 'partnerDomains', d.hostname, `Removed domain ${d.hostname}`)
    } catch { onError('Could not remove the domain.') }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        A hostname maps to exactly one Partner. Each domain must also be added to Firebase Hosting (custom domain) and Firebase Auth (authorised domains).
      </p>
      <div className="space-y-2">
        {domains.length === 0 && <p className="text-sm text-slate-400">No domains yet.</p>}
        {domains.map(d => (
          <div key={d.hostname} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-xl border border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Globe size={13} className="text-slate-400 flex-shrink-0" />
              <span className="font-mono text-xs text-slate-800 truncate">{d.hostname}</span>
              {d.isPrimary && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">Primary</span>}
              {d.status !== 'Active' && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">Inactive</span>}
            </div>
            <div className="flex items-center gap-1.5">
              {!d.isPrimary && (
                <button onClick={() => makePrimary(d)} className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center gap-1">
                  <Star size={11} /> Make primary
                </button>
              )}
              <button onClick={() => toggle(d)} className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50">
                {d.status === 'Active' ? 'Deactivate' : 'Activate'}
              </button>
              <button onClick={() => remove(d)} aria-label={`Remove ${d.hostname}`} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input className={`${inputCls} font-mono text-xs`} placeholder="login.example.com" value={input} onChange={e => setInput(e.target.value)} />
        <button onClick={add} disabled={!host || Boolean(invalid) || busy} className="btn-primary text-sm px-4 py-2 disabled:opacity-50 whitespace-nowrap">
          {busy ? 'Adding…' : 'Add domain'}
        </button>
      </div>
      {invalid && <p className="text-xs text-red-600">Enter a real hostname (no paths, ports or localhost).</p>}
    </div>
  )
}

// ── Theme ───────────────────────────────────────────────────────────────────

function ThemeTab({ draft, setIn }: {
  draft: PartnerDraft
  setIn: (k: 'branding', field: keyof PartnerDraft['branding'], v: string) => void
}) {
  const palette = paletteFor(draft.branding.primaryColor)
  const swatch = (shade: 100 | 400 | 600 | 800) => palette ? `rgb(${palette[shade].join(' ')})` : '#e2e8f0'

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="space-y-3">
        {([['primaryColor', 'Primary colour', 'Buttons, links, highlights'],
           ['secondaryColor', 'Secondary colour', 'Browser theme colour'],
           ['accentColor', 'Accent colour', 'Reserved for module accents']] as const).map(([k, label, hint]) => (
          <Field key={k} label={label} hint={hint}>
            <div className="flex items-center gap-2">
              <input type="color" aria-label={`${label} picker`} className="h-9 w-12 rounded border border-slate-200 bg-white p-0.5 flex-shrink-0"
                value={parseHex(draft.branding[k]) ? draft.branding[k] : '#2563eb'} onChange={e => setIn('branding', k, e.target.value)} />
              <Text value={draft.branding[k]} onChange={v => setIn('branding', k, v)} mono />
            </div>
          </Field>
        ))}
      </div>

      {/* Live preview — inline styles so it never recolours the admin's own UI */}
      <div className="rounded-2xl bg-slate-950 p-5 flex flex-col items-center justify-center gap-3 min-h-[220px]">
        <p className="text-white font-bold text-lg text-center break-words">{draft.login.title || draft.displayName}</p>
        {draft.login.subtitle && <p className="text-slate-400 text-xs text-center">{draft.login.subtitle}</p>}
        <div className="w-full max-w-[240px] rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-2">
          <div className="h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: swatch(600) }}>Primary button</div>
          <p className="text-xs text-center" style={{ color: swatch(400) }}>Link colour</p>
        </div>
        <div className="flex gap-1">
          {([100, 400, 600, 800] as const).map(s => <span key={s} className="h-4 w-8 rounded" style={{ background: swatch(s) }} />)}
        </div>
      </div>
    </div>
  )
}
