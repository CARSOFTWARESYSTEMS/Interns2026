import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Battery, Shield, AlertCircle } from 'lucide-react'
import GoogleLoginButton from '../components/auth/GoogleLoginButton'
import { useAuthContext } from '../contexts/AuthContext'
import { isFirebaseConfigured } from '../firebase/config'

export default function Login() {
  const { isAuthenticated, isProfileComplete, loading } = useAuthContext()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState('')

  const from = (location.state as { from?: Location })?.from?.pathname ?? '/'

  useEffect(() => {
    if (!loading && isAuthenticated) {
      if (!isProfileComplete) {
        navigate('/complete-profile', { replace: true })
      } else {
        navigate(from, { replace: true })
      }
    }
  }, [isAuthenticated, isProfileComplete, loading, navigate, from])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4">
      {/* Background grid */}
      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(#3b82f6 1px, transparent 1px), linear-gradient(90deg, #3b82f6 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }} />

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="relative">
              <Battery size={36} className="text-brand-400" />
              <Shield size={18} className="text-brand-300 absolute -bottom-1 -right-1" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">EV.ENGINEER™</h1>
          <p className="text-slate-400 text-sm mt-1">Battery Trust Platform</p>
          <p className="text-slate-600 text-xs mt-0.5 tracking-widest uppercase">Engineering Command Center</p>
        </div>

        {/* Login card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white">Sign in</h2>
            <p className="text-slate-400 text-sm mt-1">
              Use your Google account to access the platform.
            </p>
          </div>

          {!isFirebaseConfigured && (
            <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex gap-2">
              <AlertCircle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">
                Firebase is not configured. Copy <code className="font-mono">.env.example</code> to{' '}
                <code className="font-mono">.env.local</code> and add your credentials.
              </p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex gap-2">
              <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}

          <GoogleLoginButton
            onError={(err) => setError(err.message.replace('Firebase: ', '').replace(/ \(.*\)/, ''))}
          />

          <div className="mt-6 pt-5 border-t border-slate-800">
            <p className="text-[10px] text-slate-600 text-center leading-relaxed">
              Access is restricted to authorized EV.ENGINEER team members.
              <br />Contact your manager to request access.
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-slate-700 mt-6">
          v1.0 · M03 · Intern Program 2026 · AS 9102 Beta
        </p>
      </div>
    </div>
  )
}
