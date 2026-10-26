import { useEffect, useState, type ReactNode } from 'react'
import { AlertCircle, Link2Off } from 'lucide-react'
import { isAllowedAppHost, providerForLoginHost } from '../auth/providers'
import { peekLoginState } from '../auth/loginState'
import { returnUrl, sanitizeReturnPath } from '../auth/returnPath'
import { finishSignOut } from '../auth/centralSession'
import { signOutUser } from '../firebase/auth'

/**
 * /signout?ticket=… — where an application's Logout sends the browser to
 * finish on its login host: the central session and its cookie end, then the
 * user's Firebase sign-in on this host, then back to the application's page.
 *
 * Rendered by App outside the Partner, auth and data providers: on its way
 * out it must not load the signed-in user's profile or record a sign-in. So
 * it has no Partner branding either, and uses its own plain card.
 */
export default function SignOut() {
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const ticket = new URLSearchParams(window.location.search).get('ticket')
  const provider = providerForLoginHost(window.location.hostname)

  useEffect(() => {
    if (!ticket || !provider) return
    let cancelled = false
    setFailed(false)
    finishSignOut(ticket, signOutUser)
      .then(url => { if (!cancelled) window.location.replace(url) })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [ticket, provider, attempt])

  if (!ticket || !provider) {
    return (
      <Card icon={<Link2Off size={18} className="text-amber-400" />} title="This sign-out link isn’t valid">
        <p>Go back to the site you came from and sign out there.</p>
      </Card>
    )
  }

  if (!failed) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3 px-4" role="status">
        <div className="w-8 h-8 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-400">Signing you out…</p>
      </div>
    )
  }

  // Display only (the ticket's signature is the server's to check): a way back to the site it names.
  const target = peekLoginState(ticket)
  const back = target && isAllowedAppHost(provider, target.host)
    ? { host: target.host, href: returnUrl(target.host, sanitizeReturnPath(target.path, target.host) ?? '/') }
    : null

  return (
    <Card
      icon={<AlertCircle size={18} className="text-red-400" />}
      title="We couldn’t finish signing you out"
      actions={
        <>
          <button onClick={() => setAttempt(n => n + 1)} className="btn-primary w-full justify-center">Try again</button>
          {back && (
            <a href={back.href} className="py-3 text-center text-sm text-slate-400 hover:text-slate-200 transition-colors rounded-lg">
              Back to {back.host}
            </a>
          )}
        </>
      }
    >
      <p>Your session on the site has ended, but sign-in couldn’t be reached to finish. Try again so the next sign-in asks for your Google account.</p>
    </Card>
  )
}

function Card({ icon, title, children, actions }: { icon: ReactNode; title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">{icon}</div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-white break-words">{title}</h1>
            <div className="text-slate-400 text-sm mt-2 space-y-2 break-words">{children}</div>
          </div>
        </div>
        {actions && <div className="mt-6 flex flex-col gap-2">{actions}</div>}
      </div>
    </div>
  )
}
