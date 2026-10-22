import { Navigate, useLocation } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { useAuthContext } from '../../contexts/AuthContext'
import { usePartner } from '../../contexts/PartnerContext'
import AccessGate from './AccessGate'
import GateScreen from './GateScreen'

interface RequireAuthProps {
  children: React.ReactNode
  /**
   * Only require a signed-in user (no membership / profile checks).
   * Used by /join so a user without a membership can redeem an invitation.
   */
  signedInOnly?: boolean
}

function Spinner() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    </div>
  )
}

/**
 * Route guard, evaluated in order:
 *   1. still loading            → spinner
 *   2. session failed to load   → closed error screen (fail closed)
 *   3. not signed in            → /login
 *   4. no ACTIVE membership in the hostname's Partner (and not Platform Admin)
 *                               → AccessGate (no Partner data rendered)
 *   5. global profile incomplete → /complete-profile
 *
 * This is a UX guard. Data access is enforced by firestore.rules.
 */
export default function RequireAuth({ children, signedInOnly = false }: RequireAuthProps) {
  const { isAuthenticated, loading, isProfileComplete, accessState, authError, signOut } = useAuthContext()
  const { partner } = usePartner()
  const location = useLocation()

  if (loading) return <Spinner />

  if (authError) {
    return (
      <GateScreen
        partnerName={partner?.displayName ?? null}
        icon={<AlertTriangle size={18} className="text-red-400" />}
        title="We couldn't load your access"
        actions={
          <>
            <button onClick={() => window.location.reload()} className="btn-primary w-full justify-center">Try again</button>
            <button onClick={() => signOut()} className="btn-secondary w-full justify-center">Sign out</button>
          </>
        }
      >
        <p>Please try again. If this keeps happening, contact your administrator.</p>
      </GateScreen>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (signedInOnly) return <>{children}</>

  if (accessState !== 'active' && accessState !== 'platform-admin') {
    return <AccessGate />
  }

  if (!isProfileComplete && location.pathname !== '/complete-profile') {
    return <Navigate to="/complete-profile" replace />
  }

  return <>{children}</>
}
