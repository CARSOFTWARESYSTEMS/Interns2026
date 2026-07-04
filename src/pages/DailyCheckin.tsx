import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, AlertTriangle, Loader2, CalendarCheck } from 'lucide-react'
import { useAuthContext } from '../contexts/AuthContext'
import { submitDailyCheckin } from '../firebase/assignments'
import { checkinLocalKey, todayKey, type RiskLevel } from '../types/assignments'

const RISK_OPTIONS: { value: RiskLevel; label: string; desc: string; dot: string; activeRing: string }[] = [
  { value: 'Green',  label: 'On Track', desc: 'No blockers, progressing well',         dot: 'bg-green-500',  activeRing: 'ring-2 ring-green-400 border-green-400 bg-green-50' },
  { value: 'Yellow', label: 'At Risk',  desc: 'Some concerns, may need help',           dot: 'bg-amber-500',  activeRing: 'ring-2 ring-amber-400 border-amber-400 bg-amber-50' },
  { value: 'Red',    label: 'Blocked',  desc: 'Cannot proceed without assistance',      dot: 'bg-red-500',    activeRing: 'ring-2 ring-red-400 border-red-400 bg-red-50' },
]

const inputCls = 'w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-100 transition-colors resize-none'

export default function DailyCheckin() {
  const { userProfile, uid } = useAuthContext()
  const navigate = useNavigate()
  const today = todayKey()

  const [yesterdayWork,        setYesterdayWork]        = useState('')
  const [todayPlan,            setTodayPlan]            = useState('')
  const [blockers,             setBlockers]             = useState('')
  const [estimatedHours,       setEstimatedHours]       = useState(8)
  const [actualHoursYesterday, setActualHoursYesterday] = useState(8)
  const [progressPercentage,   setProgressPercentage]   = useState(50)
  const [riskLevel,            setRiskLevel]            = useState<RiskLevel>('Green')
  const [plannedEvidence,      setPlannedEvidence]      = useState('')
  const [submitting,           setSubmitting]           = useState(false)
  const [done,                 setDone]                 = useState(false)
  const [error,                setError]                = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!uid || !userProfile) return
    if (!yesterdayWork.trim() || !todayPlan.trim()) {
      setError("Please fill in yesterday's work and today's plan.")
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await submitDailyCheckin({
        developerId: uid,
        developerName: userProfile.displayName,
        date: today,
        yesterdayWork: yesterdayWork.trim(),
        todayPlan: todayPlan.trim(),
        storyAssignments: [],
        simulatorAssignments: [],
        estimatedHours,
        actualHoursYesterday,
        progressPercentage,
        blockers: blockers.trim(),
        riskLevel,
        plannedEvidence: plannedEvidence.trim(),
        submittedAt: new Date().toISOString(),
      })
      localStorage.setItem(checkinLocalKey(uid), 'done')
      setDone(true)
      setTimeout(() => navigate('/'), 1800)
    } catch {
      setError('Failed to submit check-in. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="card p-10 text-center max-w-sm w-full space-y-4">
          <CheckCircle size={48} className="text-green-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Check-in Complete!</h2>
          <p className="text-sm text-slate-500">Good morning, {userProfile?.displayName}. Let's build something great today.</p>
          <p className="text-xs text-slate-400">Redirecting to workspace…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar — matches app navbar style */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-slate-900 border-b border-slate-700 flex items-center px-5 gap-3 z-50">
        <div className="w-7 h-7 rounded-md bg-brand-600 flex items-center justify-center flex-shrink-0">
          <span className="text-white font-black text-[10px] tracking-tight">EV</span>
        </div>
        <span className="text-white font-bold text-sm">UFlight™ | EV.ENGINEER™</span>
        <span className="text-slate-600 text-sm ml-1">·</span>
        <span className="text-slate-400 text-sm">Aerospace Intelligence &amp; Cybersecurity Platform · Intern Program 2026</span>
      </header>

      {/* Page content — same padding as dashboard Layout */}
      <div className="pt-14">
        <div className="max-w-2xl mx-auto p-5 lg:p-6 space-y-4">

          {/* Page header — matches PageHeader component style */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-100 flex items-center justify-center flex-shrink-0">
              <CalendarCheck size={17} className="text-brand-700" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Daily Engineering Check-in</h1>
              <p className="text-xs text-slate-500 mt-0.5">{today} · Complete to access your workspace</p>
            </div>
          </div>

          {/* Yesterday & Today */}
          <div className="card p-5 space-y-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Daily Update</p>

            <div>
              <label className="data-label mb-1.5 block">
                What did you accomplish yesterday? <span className="text-red-500 normal-case font-normal">*</span>
              </label>
              <textarea
                rows={3}
                value={yesterdayWork}
                onChange={e => setYesterdayWork(e.target.value)}
                placeholder="Describe your progress, PRs, code written, issues resolved…"
                className={inputCls}
              />
            </div>

            <div>
              <label className="data-label mb-1.5 block">
                What is your plan for today? <span className="text-red-500 normal-case font-normal">*</span>
              </label>
              <textarea
                rows={3}
                value={todayPlan}
                onChange={e => setTodayPlan(e.target.value)}
                placeholder="List the tasks, features, or tests you plan to complete today…"
                className={inputCls}
              />
            </div>
          </div>

          {/* Hours & Progress */}
          <div className="card p-5">
            <p className="data-label mb-3 block">Hours & Progress</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-medium">Actual hours yesterday</label>
                <input
                  type="number" min={0} max={16} step={0.5}
                  value={actualHoursYesterday}
                  onChange={e => setActualHoursYesterday(Number(e.target.value))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-medium">Planned hours today</label>
                <input
                  type="number" min={0} max={16} step={0.5}
                  value={estimatedHours}
                  onChange={e => setEstimatedHours(Number(e.target.value))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-medium">Overall progress %</label>
                <input
                  type="number" min={0} max={100} step={5}
                  value={progressPercentage}
                  onChange={e => setProgressPercentage(Number(e.target.value))}
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Risk Level */}
          <div className="card p-5">
            <p className="data-label mb-3 block">Risk Level</p>
            <div className="grid grid-cols-3 gap-3">
              {RISK_OPTIONS.map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRiskLevel(r.value)}
                  className={`border rounded-xl p-3.5 text-left transition-all ${
                    riskLevel === r.value
                      ? r.activeRing
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${r.dot}`} />
                    <p className="text-xs font-semibold text-slate-800">{r.label}</p>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-snug">{r.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Blockers & Evidence */}
          <div className="card p-5 space-y-4">
            <p className="data-label block">Additional Info</p>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5 font-medium">
                Blockers / Concerns <span className="text-slate-400">(optional)</span>
              </label>
              <textarea
                rows={2}
                value={blockers}
                onChange={e => setBlockers(e.target.value)}
                placeholder="Describe any blockers, dependencies, or concerns…"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5 font-medium">
                Planned Evidence Submission <span className="text-slate-400">(optional)</span>
              </label>
              <input
                type="text"
                value={plannedEvidence}
                onChange={e => setPlannedEvidence(e.target.value)}
                placeholder="E.g. PR #42 — unit tests for BalloonDetector"
                className={inputCls}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end pb-6">
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-700 hover:bg-brand-800 disabled:opacity-50 text-white font-semibold text-sm transition-colors"
            >
              {submitting
                ? <><Loader2 size={15} className="animate-spin" /> Submitting…</>
                : <><CheckCircle size={15} /> Submit Check-in & Enter Workspace</>}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
