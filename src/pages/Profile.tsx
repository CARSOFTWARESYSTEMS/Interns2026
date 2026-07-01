import { useState, useEffect } from 'react'
import {
  User, Briefcase, Star, FileText, Globe, Shield, Activity,
  Edit3, Save, X, ExternalLink, Github, Linkedin, Upload,
  Clock, CheckCircle, AlertTriangle, Download,
} from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import SectionCard from '../components/ui/SectionCard'
import SkillsRadar from '../components/ui/SkillsRadar'
import ProfileCompletion from '../components/ui/ProfileCompletion'
import PermissionBadge from '../components/ui/PermissionBadge'
import UserAvatar from '../components/ui/UserAvatar'
import { useAuthContext } from '../contexts/AuthContext'
import {
  getUserSkills, setUserSkills, getAuditLogs, getLoginHistory,
  getUserResume, setUserResume,
} from '../firebase/firestore'
import {
  calcProfileCompletion, emptyCompetencyRatings,
  COMPETENCY_KEYS, COMPETENCY_FULL_LABELS, COMPETENCY_LEVEL_LABELS,
  type EngineeringCompetencyKey, type UserSkills, type AuditLog,
  type LoginHistory, type UserResume, AUDIT_ACTION_LABELS,
} from '../types/auth'

const TABS = [
  { id: 'personal',      label: 'Personal',      icon: User },
  { id: 'professional',  label: 'Professional',   icon: Briefcase },
  { id: 'skills',        label: 'Skills',         icon: Star },
  { id: 'resume',        label: 'Resume',         icon: FileText },
  { id: 'portfolio',     label: 'Portfolio',      icon: Globe },
  { id: 'security',      label: 'Security',       icon: Shield },
  { id: 'activity',      label: 'Activity',       icon: Activity },
]

const DEGREES = ['B.E.', 'B.Tech', 'M.E.', 'M.Tech', 'MCA', 'MBA', 'Ph.D.', 'Diploma', 'Other']
const GRAD_YEARS = Array.from({ length: 6 }, (_, i) => String(2024 + i))
const EXPERIENCE_OPTS = ['Fresher', '< 1 year', '1 year', '2 years', '3+ years']
export default function Profile() {
  const { userProfile, updateProfile } = useAuthContext()
  const [tab, setTab] = useState('personal')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [form, setForm]       = useState({ ...userProfile })

  const [skills, setSkillsState]     = useState<UserSkills | null>(null)
  const [skillsEdit, setSkillsEdit]  = useState(false)
  const [skillForm, setSkillForm]    = useState(emptyCompetencyRatings())

  const [auditLogs, setAuditLogs]       = useState<AuditLog[]>([])
  const [loginHistory, setLoginHistory] = useState<LoginHistory[]>([])
  const [resume, setResume]             = useState<UserResume | null>(null)
  const [uploading, setUploading]       = useState(false)

  const completion = userProfile ? calcProfileCompletion(userProfile) : 0

  useEffect(() => {
    if (!userProfile) return
    setForm({ ...userProfile })
    if (tab === 'skills') loadSkills()
    if (tab === 'activity') loadActivity()
    if (tab === 'resume') loadResume()
  }, [userProfile, tab])

  async function loadSkills() {
    if (!userProfile) return
    const s = await getUserSkills(userProfile.uid)
    setSkillsState(s)
    setSkillForm(s?.ratings ?? emptyCompetencyRatings())
  }

  async function loadActivity() {
    if (!userProfile) return
    const [logs, history] = await Promise.all([
      getAuditLogs(userProfile.uid, 20),
      getLoginHistory(userProfile.uid, 10),
    ])
    setAuditLogs(logs)
    setLoginHistory(history)
  }

  async function loadResume() {
    if (!userProfile) return
    const r = await getUserResume(userProfile.uid)
    setResume(r)
  }

  function setField(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function saveProfile() {
    if (!userProfile) return
    setSaving(true)
    try {
      await updateProfile(form as typeof userProfile)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  async function saveSkills() {
    if (!userProfile) return
    const updated: UserSkills = {
      uid: userProfile.uid,
      ratings: skillForm,
      managerOverrides: skills?.managerOverrides ?? {},
      updatedAt: new Date().toISOString(),
    }
    await setUserSkills(userProfile.uid, updated)
    setSkillsState(updated)
    setSkillsEdit(false)
  }

  function handleResumeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !userProfile) return
    if (file.type !== 'application/pdf') { alert('PDF only'); return }
    if (file.size > 10 * 1024 * 1024) { alert('Max 10 MB'); return }
    setUploading(true)
    // Simulates upload to Google Drive (real upload needs backend/Drive API)
    setTimeout(async () => {
      const version = (resume?.history.length ?? 0) + 1
      const newVersion = {
        version,
        driveLink: '#',
        driveFolderId: '',
        fileName: file.name,
        fileSizeKB: Math.round(file.size / 1024),
        uploadDate: new Date().toISOString(),
        status: 'Active' as const,
      }
      const updated: UserResume = {
        uid: userProfile.uid,
        current: newVersion,
        history: [newVersion, ...(resume?.history ?? []).map(v => ({ ...v, status: 'Archived' as const }))],
      }
      await setUserResume(userProfile.uid, updated)
      await updateProfile({ resumeDriveLink: newVersion.driveLink })
      setResume(updated)
      setUploading(false)
    }, 1500)
  }

  if (!userProfile) return null

  const inputCls = "w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200 transition-colors"
  const selectCls = `${inputCls} bg-white`
  const ROCls = "text-sm text-slate-800"

  function InfoRow({ label, value, href }: { label: string; value?: string; href?: string }) {
    return (
      <div className="py-2.5 border-b border-slate-50 last:border-0">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-600 hover:underline flex items-center gap-1">
            {value || '—'} {value && <ExternalLink size={10} />}
          </a>
        ) : (
          <p className={ROCls}>{value || <span className="text-slate-300 italic">Not set</span>}</p>
        )}
      </div>
    )
  }

  function EditField({ label, field, type = 'text', options, required }: {
    label: string; field: string; type?: string; options?: string[]; required?: boolean
  }) {
    const val = (form as Record<string, string>)[field] ?? ''
    return (
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">
          {label}{required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
        {options ? (
          <select className={selectCls} value={val} onChange={e => setField(field, e.target.value)}>
            <option value="">Select…</option>
            {options.map(o => <option key={o}>{o}</option>)}
          </select>
        ) : type === 'textarea' ? (
          <textarea className={`${inputCls} resize-none`} rows={3} value={val} onChange={e => setField(field, e.target.value)} />
        ) : (
          <input className={inputCls} type={type} value={val} onChange={e => setField(field, e.target.value)} />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="My Profile" subtitle="Manage your personal and professional information" icon={<User size={18} />} />

      {/* Profile header card */}
      <div className="card p-5">
        <div className="flex items-start gap-4">
          <UserAvatar photoURL={userProfile.photoURL} displayName={userProfile.displayName} size="xl" className="ring-brand-200" />
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-3 flex-wrap">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{userProfile.displayName}</h2>
                <p className="text-sm text-slate-500">{userProfile.email}</p>
                {userProfile.college && <p className="text-xs text-slate-400 mt-0.5">{userProfile.college}</p>}
              </div>
              <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                <PermissionBadge role={userProfile.role} />
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                  userProfile.status === 'Active' ? 'bg-green-50 text-green-700 border-green-200' :
                  userProfile.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  'bg-red-50 text-red-700 border-red-200'
                }`}>{userProfile.status}</span>
              </div>
            </div>
            <div className="mt-3 max-w-xs">
              <ProfileCompletion percent={completion} />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap border-b border-slate-200">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setEditing(false) }}
              className={`tab-btn flex items-center gap-1.5 ${tab === t.id ? 'active' : ''}`}
            >
              <Icon size={13} />{t.label}
            </button>
          )
        })}
      </div>

      {/* ── Personal ───────────────────────────────────────────────────── */}
      {tab === 'personal' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SectionCard title="Personal Information" icon={<User size={14} />} action={
            editing ? (
              <div className="flex gap-2">
                <button onClick={() => { setEditing(false); setForm({ ...userProfile }) }} className="btn-ghost text-xs py-1 px-2"><X size={12} /> Cancel</button>
                <button onClick={saveProfile} disabled={saving} className="btn-primary text-xs py-1 px-3"><Save size={12} /> {saving ? 'Saving…' : 'Save'}</button>
              </div>
            ) : (
              <button onClick={() => setEditing(true)} className="btn-ghost text-xs py-1 px-2"><Edit3 size={12} /> Edit</button>
            )
          }>
            {editing ? (
              <div className="space-y-3">
                <EditField label="Full Name" field="displayName" required />
                <EditField label="Mobile" field="mobile" type="tel" />
                <div className="grid grid-cols-2 gap-3">
                  <EditField label="City" field="city" />
                  <EditField label="Country" field="country" />
                </div>
                <EditField label="Bio" field="bio" type="textarea" />
              </div>
            ) : (
              <>
                <InfoRow label="Full Name" value={userProfile.displayName} />
                <InfoRow label="Email" value={userProfile.email} />
                <InfoRow label="Mobile" value={userProfile.mobile} />
                <InfoRow label="City" value={userProfile.city} />
                <InfoRow label="Country" value={userProfile.country} />
                <InfoRow label="Bio" value={userProfile.bio} />
              </>
            )}
          </SectionCard>
          <SectionCard title="Platform Info" icon={<Shield size={14} />}>
            <InfoRow label="UID" value={userProfile.uid} />
            <InfoRow label="Role" value={userProfile.role} />
            <InfoRow label="Organization" value="UFlight™ | EV.ENGINEER™ — Battery Trust Platform" />
            <InfoRow label="Status" value={userProfile.status} />
            <InfoRow label="Member Since" value={new Date(userProfile.createdAt).toLocaleDateString('en-IN', { dateStyle: 'long' })} />
            <InfoRow label="Last Login" value={userProfile.lastLogin ? new Date(userProfile.lastLogin).toLocaleString('en-IN') : ''} />
          </SectionCard>
        </div>
      )}

      {/* ── Professional ───────────────────────────────────────────────── */}
      {tab === 'professional' && (
        <SectionCard title="Professional Information" icon={<Briefcase size={14} />} action={
          editing ? (
            <div className="flex gap-2">
              <button onClick={() => { setEditing(false); setForm({ ...userProfile }) }} className="btn-ghost text-xs py-1 px-2"><X size={12} /> Cancel</button>
              <button onClick={saveProfile} disabled={saving} className="btn-primary text-xs py-1 px-3"><Save size={12} /> {saving ? 'Saving…' : 'Save'}</button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="btn-ghost text-xs py-1 px-2"><Edit3 size={12} /> Edit</button>
          )
        }>
          {editing ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><EditField label="College / University" field="college" /></div>
              <EditField label="Degree" field="degree" options={DEGREES} />
              <EditField label="Graduation Year" field="graduationYear" options={GRAD_YEARS} />
              <div className="col-span-2"><EditField label="Specialization" field="specialization" /></div>
              <EditField label="Semester" field="semester" />
              <EditField label="Experience" field="experience" options={EXPERIENCE_OPTS} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-8">
              <div>
                <InfoRow label="College" value={userProfile.college} />
                <InfoRow label="Degree" value={userProfile.degree} />
                <InfoRow label="Specialization" value={userProfile.specialization} />
              </div>
              <div>
                <InfoRow label="Graduation Year" value={userProfile.graduationYear} />
                <InfoRow label="Semester" value={userProfile.semester} />
                <InfoRow label="Experience" value={userProfile.experience} />
              </div>
            </div>
          )}
        </SectionCard>
      )}

      {/* ── Skills ─────────────────────────────────────────────────────── */}
      {tab === 'skills' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SectionCard title="Skills Matrix" icon={<Star size={14} />} action={
            skillsEdit ? (
              <div className="flex gap-2">
                <button onClick={() => setSkillsEdit(false)} className="btn-ghost text-xs py-1 px-2"><X size={12} /> Cancel</button>
                <button onClick={saveSkills} className="btn-primary text-xs py-1 px-3"><Save size={12} /> Save</button>
              </div>
            ) : (
              <button onClick={() => { setSkillsEdit(true); setSkillForm(skills?.ratings ?? emptyCompetencyRatings()) }} className="btn-ghost text-xs py-1 px-2"><Edit3 size={12} /> Edit</button>
            )
          }>
            <div className="space-y-2">
              {COMPETENCY_KEYS.map((key: EngineeringCompetencyKey) => {
                const managerVal = skills?.managerOverrides?.[key]
                const myVal = skillsEdit ? skillForm[key] : (skills?.ratings[key] ?? 0)
                const displayVal = managerVal ?? myVal
                return (
                  <div key={key} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-[11px] font-semibold text-slate-700 truncate">{COMPETENCY_FULL_LABELS[key]}</span>
                        {managerVal && <span className="text-[9px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">Manager</span>}
                      </div>
                      {skillsEdit ? (
                        <div className="flex gap-0.5 flex-shrink-0">
                          {[1, 2, 3, 4, 5].map(n => (
                            <button key={n} type="button"
                              title={COMPETENCY_LEVEL_LABELS[n]}
                              onClick={() => setSkillForm(prev => ({ ...prev, [key]: n }))}
                              className={`w-6 h-6 rounded text-[10px] font-bold border transition-all ${skillForm[key] >= n ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-400 border-slate-200 hover:border-brand-300'}`}>
                              {n}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex gap-0.5 flex-shrink-0">
                          {[1, 2, 3, 4, 5].map(n => (
                            <div key={n} className={`w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center ${displayVal >= n ? 'bg-brand-100 text-brand-700' : 'bg-white text-slate-300 border border-slate-100'}`}>{n}</div>
                          ))}
                        </div>
                      )}
                    </div>
                    {displayVal > 0 && (
                      <p className="mt-0.5 text-[10px] text-brand-600 font-semibold text-right">{COMPETENCY_LEVEL_LABELS[displayVal]}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </SectionCard>

          <SectionCard title="Skills Radar" icon={<Star size={14} />}>
            <div className="flex justify-center">
              <SkillsRadar ratings={skills?.ratings ?? emptyCompetencyRatings()} size={300} />
            </div>
            <p className="text-[10px] text-slate-400 text-center mt-2">Self-rated · Manager can override scores</p>
          </SectionCard>
        </div>
      )}

      {/* ── Resume ─────────────────────────────────────────────────────── */}
      {tab === 'resume' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SectionCard title="Current Resume" icon={<FileText size={14} />}>
            {resume?.current ? (
              <div className="space-y-3">
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
                  <CheckCircle size={18} className="text-green-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{resume.current.fileName}</p>
                    <p className="text-[10px] text-slate-500">{resume.current.fileSizeKB} KB · v{resume.current.version} · {new Date(resume.current.uploadDate).toLocaleDateString()}</p>
                  </div>
                  <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">{resume.current.status}</span>
                </div>
                <div className="flex gap-2">
                  <a href={resume.current.driveLink} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"><ExternalLink size={12} /> View</a>
                  <a href={resume.current.driveLink} download className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"><Download size={12} /> Download</a>
                </div>
              </div>
            ) : (
              <div className="p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl text-center">
                <FileText size={24} className="text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600">No resume uploaded</p>
                <p className="text-xs text-slate-400 mt-0.5">Upload a PDF to get started</p>
              </div>
            )}

            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold text-slate-700 mb-2">Upload New Resume</p>
              <label className={`flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg border-2 border-dashed cursor-pointer transition-all ${uploading ? 'border-brand-300 bg-brand-50' : 'border-slate-200 hover:border-brand-300 hover:bg-brand-50'}`}>
                <input type="file" accept=".pdf" className="hidden" onChange={handleResumeUpload} disabled={uploading} />
                <Upload size={14} className="text-slate-400" />
                <span className="text-xs font-semibold text-slate-500">{uploading ? 'Uploading to Drive…' : 'Choose PDF (max 10 MB)'}</span>
              </label>
              <p className="text-[10px] text-slate-400 mt-1.5">Stored in Google Drive · Firestore stores metadata only</p>
            </div>
          </SectionCard>

          <SectionCard title="Version History" icon={<Clock size={14} />}>
            {(resume?.history ?? []).length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No history yet.</p>
            ) : (
              <div className="space-y-2">
                {(resume?.history ?? []).map(v => (
                  <div key={v.version} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold bg-brand-100 text-brand-700 px-2 py-1 rounded-full">v{v.version}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700 truncate">{v.fileName}</p>
                      <p className="text-[10px] text-slate-400">{new Date(v.uploadDate).toLocaleDateString()} · {v.fileSizeKB} KB</p>
                    </div>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${v.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{v.status}</span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* ── Portfolio ──────────────────────────────────────────────────── */}
      {tab === 'portfolio' && (
        <SectionCard title="Portfolio & Links" icon={<Globe size={14} />} action={
          editing ? (
            <div className="flex gap-2">
              <button onClick={() => { setEditing(false); setForm({ ...userProfile }) }} className="btn-ghost text-xs py-1 px-2"><X size={12} /> Cancel</button>
              <button onClick={saveProfile} disabled={saving} className="btn-primary text-xs py-1 px-3"><Save size={12} /> {saving ? 'Saving…' : 'Save'}</button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="btn-ghost text-xs py-1 px-2"><Edit3 size={12} /> Edit</button>
          )
        }>
          {editing ? (
            <div className="space-y-3 max-w-lg">
              <EditField label="GitHub" field="github" />
              <EditField label="LinkedIn" field="linkedin" />
              <EditField label="Portfolio / Website" field="portfolio" />
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { label: 'GitHub', value: userProfile.github, icon: <Github size={14}/> },
                { label: 'LinkedIn', value: userProfile.linkedin, icon: <Linkedin size={14}/> },
                { label: 'Portfolio', value: userProfile.portfolio, icon: <Globe size={14}/> },
              ].map(({ label, value, icon }) => (
                <div key={label} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 flex-shrink-0">{icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{label}</p>
                    {value ? (
                      <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-600 hover:underline truncate block">{value}</a>
                    ) : (
                      <span className="text-sm text-slate-300 italic">Not set</span>
                    )}
                  </div>
                  {value && <ExternalLink size={12} className="text-slate-400 flex-shrink-0" />}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* ── Security ───────────────────────────────────────────────────── */}
      {tab === 'security' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SectionCard title="Access & Role" icon={<Shield size={14} />}>
            <InfoRow label="Role" value={userProfile.role} />
            <InfoRow label="Status" value={userProfile.status} />
            <InfoRow label="Organization" value="UFlight™ | EV.ENGINEER™" />
            <InfoRow label="Auth Method" value="Google OAuth 2.0" />
            <InfoRow label="Manager" value={userProfile.managerId || 'Not assigned'} />
            <InfoRow label="Architect" value={userProfile.architectId || 'Not assigned'} />
          </SectionCard>

          <SectionCard title="Recent Sessions" icon={<Clock size={14} />}>
            {loginHistory.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">Loading…</p>
            ) : (
              <div className="space-y-2">
                {loginHistory.map((h, i) => (
                  <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700">{new Date(h.loginAt).toLocaleString('en-IN')}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${h.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {h.success ? 'Success' : 'Failed'}
                      </span>
                    </div>
                    <p className="text-slate-400 mt-0.5">{h.browser} · {h.device}</p>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* ── Activity ───────────────────────────────────────────────────── */}
      {tab === 'activity' && (
        <SectionCard title="Audit Log" icon={<Activity size={14} />}>
          {auditLogs.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No activity recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {auditLogs.map(log => (
                <div key={log.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0 mt-1.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-800">
                        {AUDIT_ACTION_LABELS[log.action] ?? log.action}
                      </span>
                      <span className="text-[10px] text-slate-400 flex-shrink-0 ml-2">
                        {new Date(log.timestamp).toLocaleString('en-IN')}
                      </span>
                    </div>
                    {log.details && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{log.details}</p>}
                    <p className="text-[10px] text-slate-400 font-mono">{log.resource}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}
    </div>
  )
}
