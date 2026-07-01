import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Battery, Shield, Check, ChevronRight, ChevronLeft, User, GraduationCap, Link2, Star } from 'lucide-react'
import { useAuthContext } from '../contexts/AuthContext'
import { updateUserProfile, setUserSkills } from '../firebase/firestore'
import { isFirebaseConfigured } from '../firebase/config'
import {
  COMPETENCY_KEYS, COMPETENCY_FULL_LABELS, COMPETENCY_DESCRIPTIONS,
  COMPETENCY_LEVEL_LABELS, emptyCompetencyRatings,
  type EngineeringCompetencyKey,
} from '../types/auth'

const STEPS = [
  { id: 'personal', label: 'Personal', icon: User },
  { id: 'education', label: 'Education', icon: GraduationCap },
  { id: 'links', label: 'Links', icon: Link2 },
  { id: 'skills', label: 'Skills', icon: Star },
]

const GRAD_YEARS = Array.from({ length: 6 }, (_, i) => String(2024 + i))
const DEGREES = ['B.E.', 'B.Tech', 'M.E.', 'M.Tech', 'MCA', 'MBA', 'Ph.D.', 'Diploma', 'Other']
const EXPERIENCE = ['Fresher', '< 1 year', '1 year', '2 years', '3+ years']

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

export default function CompleteProfile() {
  const { userProfile, firebaseUser, refreshProfile } = useAuthContext()
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [form, setForm] = useState({
    displayName: userProfile?.displayName ?? firebaseUser?.displayName ?? '',
    mobile: userProfile?.mobile ?? '',
    bio: userProfile?.bio ?? '',
    city: userProfile?.city ?? '',
    country: userProfile?.country ?? '',
    college: userProfile?.college ?? '',
    degree: userProfile?.degree ?? '',
    specialization: userProfile?.specialization ?? '',
    graduationYear: userProfile?.graduationYear ?? '',
    experience: userProfile?.experience ?? '',
    github: userProfile?.github ?? '',
    linkedin: userProfile?.linkedin ?? '',
    portfolio: userProfile?.portfolio ?? '',
  })
  const [skills, setSkills] = useState(emptyCompetencyRatings)

  function setField(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function setSkill(key: EngineeringCompetencyKey, value: number) {
    setSkills(prev => ({ ...prev, [key]: value }))
  }

  const isStepValid = (): boolean => {
    if (step === 0) return form.displayName.trim().length > 0
    if (step === 1) return form.college.trim().length > 0 && form.degree.length > 0
    return true
  }

  async function handleFinish() {
    if (!userProfile) return
    if (!isFirebaseConfigured) {
      setSaveError('Firebase is not configured. Profile cannot be saved.')
      return
    }

    setSaving(true)
    setSaveError(null)

    const uid = userProfile.uid
    const now = new Date().toISOString()

    if (import.meta.env.DEV) console.log('[CompleteProfile] profile save started', uid)

    try {
      const profileUpdates = {
        ...form,
        profileComplete: true,      // backward-compat field
        profileCompleted: true,     // canonical field
        profileCompletedAt: now,
      }

      await Promise.all([
        updateUserProfile(uid, profileUpdates),
        setUserSkills(uid, {
          uid,
          ratings: skills,
          managerOverrides: {},
          updatedAt: now,
        }),
      ])

      if (import.meta.env.DEV) console.log('[CompleteProfile] profile save success')

      // Reload from Firestore to confirm persistence before navigating.
      // This ensures the next login also reads profileCompleted === true.
      await refreshProfile()

      if (import.meta.env.DEV) {
        console.log('[CompleteProfile] profile reload success')
        console.log('[CompleteProfile] profileCompleted:', true)
      }

      navigate('/', { replace: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[CompleteProfile] profile save failed', err)
      setSaveError(`Failed to save profile: ${msg}. Please check your connection and try again.`)
    } finally {
      setSaving(false)
    }
  }

  const inputCls = "w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200 transition-colors"
  const selectCls = `${inputCls} bg-white`

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-2 mb-8">
        <Battery size={22} className="text-brand-600" />
        <Shield size={14} className="text-brand-400 -ml-1" />
        <span className="font-bold text-slate-800 text-base ml-1">UFlight™ | EV.ENGINEER™</span>
      </div>

      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-100">
        {/* Title */}
        <div className="px-8 pt-7 pb-5 border-b border-slate-100">
          <h1 className="text-lg font-bold text-slate-900">Complete Your Profile</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            You're almost in. Complete your profile to access the Engineering Portal.
          </p>
        </div>

        {/* Step indicator */}
        <div className="px-8 py-4 flex items-center gap-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            const done = i < step
            const active = i === step
            return (
              <div key={s.id} className="flex items-center gap-2">
                <div className={`
                  w-7 h-7 rounded-full flex items-center justify-center transition-all
                  ${done ? 'bg-green-500 text-white' : active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-400'}
                `}>
                  {done ? <Check size={13} /> : <Icon size={13} />}
                </div>
                <span className={`text-xs font-semibold hidden sm:block ${active ? 'text-brand-700' : done ? 'text-green-600' : 'text-slate-400'}`}>
                  {s.label}
                </span>
                {i < STEPS.length - 1 && <div className={`flex-1 h-px w-6 ${i < step ? 'bg-green-300' : 'bg-slate-200'}`} />}
              </div>
            )
          })}
        </div>

        {/* Step content */}
        <div className="px-8 py-5 space-y-4 min-h-[300px]">
          {step === 0 && (
            <>
              <Field label="Full Name" required>
                <input className={inputCls} value={form.displayName} onChange={e => setField('displayName', e.target.value)} placeholder="Your full name" />
              </Field>
              <Field label="Mobile Number">
                <input className={inputCls} value={form.mobile} onChange={e => setField('mobile', e.target.value)} placeholder="+91 98765 43210" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="City">
                  <input className={inputCls} value={form.city} onChange={e => setField('city', e.target.value)} placeholder="Mangalore" />
                </Field>
                <Field label="Country">
                  <input className={inputCls} value={form.country} onChange={e => setField('country', e.target.value)} placeholder="India" />
                </Field>
              </div>
              <Field label="Bio">
                <textarea className={`${inputCls} resize-none`} rows={3} value={form.bio} onChange={e => setField('bio', e.target.value)} placeholder="Tell us about yourself…" />
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              <Field label="College / University" required>
                <input className={inputCls} value={form.college} onChange={e => setField('college', e.target.value)} placeholder="NITK Surathkal" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Degree" required>
                  <select className={selectCls} value={form.degree} onChange={e => setField('degree', e.target.value)}>
                    <option value="">Select…</option>
                    {DEGREES.map(d => <option key={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="Graduation Year">
                  <select className={selectCls} value={form.graduationYear} onChange={e => setField('graduationYear', e.target.value)}>
                    <option value="">Select…</option>
                    {GRAD_YEARS.map(y => <option key={y}>{y}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Specialization">
                <input className={inputCls} value={form.specialization} onChange={e => setField('specialization', e.target.value)} placeholder="Computer Science, Electronics…" />
              </Field>
              <Field label="Experience">
                <select className={selectCls} value={form.experience} onChange={e => setField('experience', e.target.value)}>
                  <option value="">Select…</option>
                  {EXPERIENCE.map(e => <option key={e}>{e}</option>)}
                </select>
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <Field label="GitHub">
                <input className={inputCls} value={form.github} onChange={e => setField('github', e.target.value)} placeholder="https://github.com/username" />
              </Field>
              <Field label="LinkedIn">
                <input className={inputCls} value={form.linkedin} onChange={e => setField('linkedin', e.target.value)} placeholder="https://linkedin.com/in/username" />
              </Field>
              <Field label="Portfolio / Website">
                <input className={inputCls} value={form.portfolio} onChange={e => setField('portfolio', e.target.value)} placeholder="https://yoursite.com" />
              </Field>
            </>
          )}

          {step === 3 && (
            <div>
              <p className="text-xs text-slate-500 mb-3">
                Rate your current level across the 10 UFlight™ | EV.ENGINEER™ Engineering Competency domains. You can update these anytime from your profile.
              </p>
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {COMPETENCY_KEYS.map(key => (
                  <div key={key} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] font-semibold text-slate-700 leading-tight">{COMPETENCY_FULL_LABELS[key]}</span>
                        <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{COMPETENCY_DESCRIPTIONS[key]}</p>
                      </div>
                      <div className="flex items-center gap-0.5 flex-shrink-0 mt-0.5">
                        {[1, 2, 3, 4, 5].map(n => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setSkill(key, n)}
                            title={COMPETENCY_LEVEL_LABELS[n]}
                            className={`w-6 h-6 rounded text-[10px] font-bold border transition-all ${
                              skills[key] >= n
                                ? 'bg-brand-600 text-white border-brand-600'
                                : 'bg-white text-slate-400 border-slate-200 hover:border-brand-300'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                    {skills[key] > 0 && (
                      <p className="mt-1 text-[10px] text-brand-600 font-semibold text-right">
                        {COMPETENCY_LEVEL_LABELS[skills[key]]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Save error */}
        {saveError && (
          <div className="mx-8 mb-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
            {saveError}
          </div>
        )}

        {/* Navigation */}
        <div className="px-8 py-5 border-t border-slate-100 flex justify-between">
          <button
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft size={14} /> Back
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!isStepValid()}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Next <ChevronRight size={14} />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 transition-all"
            >
              {saving ? 'Saving…' : (<><Check size={14} /> Complete Profile</>)}
            </button>
          )}
        </div>
      </div>

      {/* Company footer */}
      <div className="mt-6 text-center space-y-1">
        <p className="text-[11px] font-semibold text-slate-500">iTelematics Software Private Limited · Bangalore, India</p>
        <div className="flex items-center justify-center gap-3 text-[10px]">
          <a href="mailto:info@iTelematics.com" className="text-brand-500 hover:text-brand-600 transition-colors">
            info@iTelematics.com
          </a>
          <span className="text-slate-300">·</span>
          <a href="tel:+919108206147" className="text-slate-400 hover:text-slate-600 transition-colors">
            +91 91082 06147
          </a>
          <span className="text-slate-300">·</span>
          <a href="https://wa.me/919108206147" target="_blank" rel="noopener noreferrer" className="text-green-500 hover:text-green-600 transition-colors font-semibold">
            WhatsApp
          </a>
        </div>
      </div>
    </div>
  )
}
