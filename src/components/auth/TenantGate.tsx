import type { ReactNode } from 'react'
import { Globe, PauseCircle, WifiOff } from 'lucide-react'
import { usePartner } from '../../contexts/PartnerContext'
import { isLocalDevHost } from '../../tenant/hostname'
import GateScreen from './GateScreen'

/**
 * Domain-level gate. Nothing below it — login, auth, data — renders until the
 * hostname has resolved to an ACTIVE Partner. Unknown, inactive or
 * unverifiable hosts fail closed and never fall back to a real Partner.
 */
export default function TenantGate({ children }: { children: ReactNode }) {
  const { status, lookupHost } = usePartner()

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (status === 'unknown-domain') {
    const onLocalhost = isLocalDevHost(window.location.hostname)
    return (
      <GateScreen partnerName={null} icon={<Globe size={18} className="text-amber-400" />} title="This sign-in address isn't configured">
        <p>Please use the sign-in link provided by your organisation.</p>
        {onLocalhost && (
          <p className="text-xs text-slate-500">
            Local development: open <code className="font-mono text-slate-300">?partnerHost=login.example.com</code> or
            set <code className="font-mono text-slate-300">VITE_DEV_PARTNER_HOST</code> to a hostname registered in
            {' '}<code className="font-mono text-slate-300">partnerDomains</code>.
            {lookupHost && <> Tried: <code className="font-mono text-slate-300">{lookupHost}</code>.</>}
          </p>
        )}
      </GateScreen>
    )
  }

  if (status === 'inactive') {
    return (
      <GateScreen partnerName={null} icon={<PauseCircle size={18} className="text-slate-400" />} title="This workspace is currently unavailable">
        <p>Contact your administrator for more information.</p>
      </GateScreen>
    )
  }

  if (status === 'error') {
    return (
      <GateScreen
        partnerName={null}
        icon={<WifiOff size={18} className="text-red-400" />}
        title="We couldn't verify this sign-in address"
        actions={
          <button onClick={() => window.location.reload()} className="btn-primary w-full justify-center">
            Try again
          </button>
        }
      >
        <p>Check your connection and try again.</p>
      </GateScreen>
    )
  }

  return <>{children}</>
}
