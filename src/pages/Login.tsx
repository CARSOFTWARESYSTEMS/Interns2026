import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import GoogleLoginButton from '../components/auth/GoogleLoginButton'
import { useAuthContext } from '../contexts/AuthContext'
import { isFirebaseConfigured } from '../firebase/config'
import { useBranding } from '../contexts/PartnerContext'
import PartnerBrandMark from '../components/ui/PartnerBrandMark'
import { isLoginHost, startCentralSession } from '../auth/centralSession'

export default function Login() {
  const { isAuthenticated, loading } = useAuthContext()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState('')
  const b = useBranding()

  // Keep the query string so /join?token=… survives the sign-in round trip.
  const fromLoc = (location.state as { from?: { pathname: string; search?: string } })?.from
  const from = fromLoc ? `${fromLoc.pathname}${fromLoc.search ?? ''}` : '/'

  // After sign-in, RequireAuth decides: access gate → profile wizard → app.
  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate(from, { replace: true })
    }
  }, [isAuthenticated, loading, navigate, from])

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
        backgroundImage: 'linear-gradient(rgb(var(--brand-500)) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--brand-500)) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }} />

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <PartnerBrandMark size="lg" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide break-words">{b.login.title}</h1>
          {b.login.subtitle && <p className="text-slate-400 text-sm mt-1 break-words">{b.login.subtitle}</p>}
          <p className="text-slate-600 text-xs mt-0.5 tracking-widest uppercase">{b.tagline}</p>
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
            // Also start the central session, so this Partner's applications sign in without asking.
            // Optional for the dashboard itself: it must keep working if this fails.
            onSuccess={(user) => { if (isLoginHost()) startCentralSession(user, 'workspace').catch(() => {}) }}
            onError={(err) => setError(err.message.replace('Firebase: ', '').replace(/ \(.*\)/, ''))}
          />

          <div className="mt-6 pt-5 border-t border-slate-800">
            <p className="text-[10px] text-slate-600 text-center leading-relaxed mb-3">
              {b.login.restrictedNotice}
            </p>
            <p className="text-center mb-3">
              <a href="/privacy" className="text-[10px] text-slate-500 hover:text-slate-300 underline decoration-slate-700 underline-offset-2">
                What signing in records
              </a>
            </p>
            <div className="flex flex-col items-center gap-1.5">
              {b.contact.email && (
                <a
                  href={`mailto:${b.contact.email}`}
                  className="text-[10px] text-brand-400 hover:text-brand-300 transition-colors break-all"
                >
                  {b.contact.email}
                </a>
              )}
              {(b.contact.phoneHref || b.contact.whatsappUrl) && (
                <div className="flex items-center gap-3">
                  {b.contact.phoneHref && (
                    <a href={b.contact.phoneHref} className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors">
                      {b.contact.phone}
                    </a>
                  )}
                  {b.contact.phoneHref && b.contact.whatsappUrl && <span className="text-slate-700">·</span>}
                  {b.contact.whatsappUrl && (
                    <a
                      href={b.contact.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-green-500 hover:text-green-400 transition-colors"
                    >
                      WhatsApp
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 space-y-1">
          {b.footer && <p className="text-[10px] text-slate-600 font-semibold">{b.footer}</p>}
          {b.location && <p className="text-[10px] text-slate-700">{b.location}</p>}
          {b.versionLabel && <p className="text-[10px] text-slate-700">{b.versionLabel}</p>}
        </div>
      </div>
    </div>
  )
}
