import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Clock, Ban, AlertCircle, LogOut } from 'lucide-react'
import { useAuthContext } from '../../contexts/AuthContext'
import { usePartner } from '../../contexts/PartnerContext'
import { requestAccess, writeTenantAudit } from '../../firebase/partners'
import GateScreen from './GateScreen'

/**
 * Membership-level gate for the Partner resolved from the hostname.
 * Rendered by RequireAuth whenever accessState is not 'active' /
 * 'platform-admin'. It never reveals whether the user belongs to any OTHER
 * Partner — it only knows about this one.
 */
export default function AccessGate() {
  const { accessState, userProfile, signOut, setMembership } = useAuthContext()
  const { partner } = usePartner()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const partnerName = partner?.displayName ?? null
  const contact = partner?.contact

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  async function handleRequestAccess() {
    if (!partner || !userProfile) return
    setBusy(true)
    setError('')
    try {
      const m = await requestAccess(partner.id, userProfile)
      await writeTenantAudit({
        uid: userProfile.uid, userEmail: userProfile.email, action: 'access_requested',
        partnerId: partner.id, targetType: 'partnerMemberships', targetId: m.id,
        details: 'Requested access',
      }).catch(() => {})
      setMembership(m)
    } catch {
      setError(`Access requests aren't enabled for ${partner.displayName}. Please contact your administrator.`)
    } finally {
      setBusy(false)
    }
  }

  const signOutButton = (
    <button onClick={handleSignOut} className="btn-secondary w-full justify-center flex items-center gap-1.5">
      <LogOut size={14} /> Sign out
    </button>
  )

  const contactLine = contact?.supportEmail ? (
    <p className="text-xs">
      Contact:{' '}
      <a href={`mailto:${contact.supportEmail}`} className="text-brand-400 hover:text-brand-300 break-all">
        {contact.supportEmail}
      </a>
    </p>
  ) : null

  if (accessState === 'pending') {
    return (
      <GateScreen partnerName={partnerName} icon={<Clock size={18} className="text-amber-400" />}
        title="Access request pending" actions={signOutButton}>
        <p>Your {partnerName} access request is pending approval.</p>
        <p className="text-xs text-slate-500">Signed in as {userProfile?.email}</p>
        {contactLine}
      </GateScreen>
    )
  }

  if (accessState === 'suspended' || accessState === 'blocked') {
    return (
      <GateScreen partnerName={partnerName} icon={<Ban size={18} className="text-red-400" />}
        title={accessState === 'suspended' ? 'Access suspended' : 'Access blocked'} actions={signOutButton}>
        <p>Your access to {partnerName} is currently {accessState}.</p>
        <p>Contact your Partner Administrator or Platform Administrator.</p>
        {contactLine}
      </GateScreen>
    )
  }

  // 'no-membership' (and any unexpected state → fail closed here)
  return (
    <GateScreen
      partnerName={partnerName}
      icon={<Lock size={18} className="text-slate-300" />}
      title={`Access not configured for ${partnerName ?? 'this workspace'}`}
      actions={
        <>
          <button onClick={handleRequestAccess} disabled={busy} className="btn-primary w-full justify-center">
            {busy ? 'Sending request…' : 'Request access'}
          </button>
          {signOutButton}
        </>
      }
    >
      <p>Contact your Partner Administrator or Platform Administrator.</p>
      <p className="text-xs text-slate-500">Signed in as {userProfile?.email}</p>
      {error && (
        <p className="flex gap-1.5 text-xs text-red-300"><AlertCircle size={13} className="flex-shrink-0 mt-0.5" />{error}</p>
      )}
      {contactLine}
    </GateScreen>
  )
}
