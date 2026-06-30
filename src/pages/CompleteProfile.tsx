import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Battery, Shield, Check, ChevronRight, ChevronLeft, User, GraduationCap, Link2, Star } from 'lucide-react'
import { useAuthContext } from '../contexts/AuthContext'
import { updateUserProfile, setUserSkills } from '../firebase/firestore'
import { SKILL_KEYS, SKILL_LABELS, emptySkillRatings, type SkillKey } from '../types/auth'

const STEPS = [
  { id: 'personal', label: 'Personal', icon: User },
  { id: 'education', label: 'Education', icon: GraduationCap },
  { id: 'links', label: 'Links', icon: Link2 },
  { id: 'skills', label: 'Skills', icon: Star },
]

const GRAD_YEARS = Array.from({ length: 6 }, (_, i) => String(2024 + i))
const DEGREES = ['B.E.', 'B.Tech', 'M.E.', 'M.Tech', 'MCA', 'MBA', 'Ph.D.', 'Diploma', 'Other']
const EXPERIENCE = ['Fresher', '< 1 year', '1 year', '2 years', '3+ years']

export default function CompleteProfile() {
  const { userProfile, firebaseUser, setProfileAfterComplete } = useAuthContext()
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
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
  const [skills, setSkills] = useState(emptySkillRatings)

  function setField(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function setSkill(key: SkillKey, value: number) {
    setSkills(prev => ({ ...prev, [key]: value }))
  }

  const isStepValid = (): boolean => {
    if (step === 0) return form.displayName.trim().length > 0
    if (step === 1) return form.college.trim().length > 0 && form.degree.length > 0
    return true
  }

  async function handleFinish() {
    if (!userProfile) return
    setSaving(true)
    try {
      const updates = { ...form, profileComplete: true }
      await Promise.all([
        updateUserProfile(userProfile.uid, updates),
        setUserSkills(userProfile.uid, {
          uid: userProfile.uid,
          ratings: skills,
          managerOverrides: {},
          updatedAt: new Date().toISOString(),
        }),
      ])
      setProfileAfterComplete({ ...userProfile, ...updates })
      navigate('/', { replace: true })
    } finally {
      setSaving(false)
    }
  }

  function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
    return (
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {children}
      </div>
    )
  }

  const inputCls = "w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200 transition-colors"
  const selectCls = `${inputCls} bg-white`

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-2 mb-8">
        <Battery size={22} className="text-brand-600" />
        <Shield size={14} className="text-brand-400 -ml-1" />
        <span className="font-bold text-slate-800 text-base ml-1">EV.ENGINEER™</span>
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
              <p className="text-xs text-slate-500 mb-4">Rate your current skill level (1 = beginner, 5 = expert). You can update these anytime.</p>
              <div className="space-y-3">
                {SKILL_KEYS.map(key => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-600 w-32 flex-shrink-0">{SKILL_LABELS[key]}</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setSkill(key, n)}
                          className={`w-7 h-7 rounded text-xs font-bold border transition-all ${
                            skills[key] >= n
                              ? 'bg-brand-600 text-white border-brand-600'
                              : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-brand-300'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    {skills[key] > 0 && (
                      <span className="text-[10px] text-brand-600 font-semibold">
                        {['', 'Beginner', 'Basic', 'Intermediate', 'Advanced', 'Expert'][skills[key]]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

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
    </div>
  )
}
