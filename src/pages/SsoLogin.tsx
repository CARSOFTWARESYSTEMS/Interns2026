import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { User } from 'firebase/auth'
import { AlertCircle, Link2Off, LogIn } from 'lucide-react'
import GoogleLoginButton from '../components/auth/GoogleLoginButton'
import GateScreen from '../components/auth/GateScreen'
import { useBranding, usePartner } from '../contexts/PartnerContext'
import { isAllowedAppHost, providerForLoginHost } from '../auth/providers'
import { peekLoginState } from '../auth/loginState'
import { returnUrl, sanitizeReturnPath } from '../auth/returnPath'
import { CentralSessionError, startCentralSession } from '../auth/centralSession'

const MESSAGES: Record<string, string> = {
  stale_sign_in: 'Please sign in again to confirm it’s you.',
  invalid_credentials: 'We couldn’t verify your Google sign-in. Please try again.',
  rate_limited: 'Too many attempts. Please wait a minute and try again.',
}
const FALLBACK_MESSAGE = 'Sign-in is temporarily unavailable. Please try again in a few minutes.'

/**
 * /sso?state=… — where /api/auth/authorize sends a visitor who has no central
 * session on this login host. After Google sign-in, the ID token becomes a
 * central session (HttpOnly cookie) and the browser goes back to authorize,
 * which issues the one-time code for the application.
 */
export default function SsoLogin() {
  const b = useBranding()
  const { lookupHost } = usePartner()
  const [params] = useSearchParams()
  const [continuing, setContinuing] = useState(false)
  const [error, setError] = useState('')

  const state = params.get('state')
  const provider = providerForLoginHost(lookupHost)
  const target = peekLoginState(state)
  const valid = Boolean(state && provider && target && isAllowedAppHost(provider, target.host))

  async function handleSignedIn(user: User) {
    setContinuing(true)
    setError('')
    try {
      await startCentralSession(user, 'sso')
      window.location.replace(`/api/auth/authorize?state=${encodeURIComponent(state!)}`)
    } catch (e) {
      setContinuing(false)
      setError(MESSAGES[e instanceof CentralSessionError ? e.code : ''] ?? FALLBACK_MESSAGE)
    }
  }

  if (!valid || !target) {
    return (
      <GateScreen partnerName={b.name} icon={<Link2Off size={18} className="text-amber-400" />} title="This sign-in link isn’t valid">
        <p>Go back to the site you came from and choose Sign in again.</p>
      </GateScreen>
    )
  }

  return (
    <GateScreen
      partnerName={b.login.title}
      icon={<LogIn size={18} className="text-brand-400" />}
      title="Sign in to continue"
      actions={
        continuing ? (
          <div className="flex items-center justify-center gap-2 py-3 text-sm text-slate-400">
            <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            Signing you in…
          </div>
        ) : (
          <>
            <GoogleLoginButton
              onSuccess={handleSignedIn}
              onError={err => setError(err.message.replace('Firebase: ', '').replace(/ \(.*\)/, ''))}
            />
            {/* Cancelling returns to the page the sign-in started on, on a host this login host serves. */}
            <a
              href={returnUrl(target.host, sanitizeReturnPath(target.path, target.host) ?? '/')}
              className="py-3 text-center text-sm text-slate-400 hover:text-slate-200 transition-colors rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              Back to {target.host}
            </a>
          </>
        )
      }
    >
      <p>
        You’re signing in to <span className="font-semibold text-slate-200 break-words">{target.host}</span> with
        your {b.shortName || b.name} account.
      </p>
      {error && (
        <p className="flex gap-1.5 text-xs text-red-300"><AlertCircle size={13} className="flex-shrink-0 mt-0.5" />{error}</p>
      )}
      {b.login.restrictedNotice && <p className="text-[11px] text-slate-500">{b.login.restrictedNotice}</p>}
      <p className="text-[11px]">
        <a href="/privacy" target="_blank" rel="noopener" className="text-slate-400 underline decoration-slate-600 underline-offset-2 hover:text-slate-200">
          What signing in records
        </a>
      </p>
    </GateScreen>
  )
}
