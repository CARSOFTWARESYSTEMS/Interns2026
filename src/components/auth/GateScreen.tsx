import type { ReactNode } from 'react'
import { Battery, Shield } from 'lucide-react'

interface GateScreenProps {
  /** Partner display name, or null when the Partner is unknown (never guess one). */
  partnerName: string | null
  icon: ReactNode
  title: string
  children?: ReactNode
  actions?: ReactNode
}

/**
 * Full-screen, closed state used for domain and membership gates.
 * Matches the Login page visual language. Never renders Partner data.
 */
export default function GateScreen({ partnerName, icon, title, children, actions }: GateScreenProps) {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 py-10">
      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(#3b82f6 1px, transparent 1px), linear-gradient(90deg, #3b82f6 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }} />

      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="relative">
              <Battery size={36} className="text-brand-400" />
              <Shield size={18} className="text-brand-300 absolute -bottom-1 -right-1" />
            </div>
          </div>
          {partnerName && (
            <h1 className="text-2xl font-bold text-white tracking-wide break-words">{partnerName}</h1>
          )}
          <p className="text-slate-600 text-xs mt-1 tracking-widest uppercase">Engineering Command Center</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">{icon}</div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-white break-words">{title}</h2>
              {children && <div className="text-slate-400 text-sm mt-2 space-y-2 break-words">{children}</div>}
            </div>
          </div>
          {actions && <div className="mt-6 flex flex-col gap-2">{actions}</div>}
        </div>
      </div>
    </div>
  )
}
