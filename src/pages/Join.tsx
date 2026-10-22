import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MailCheck, AlertCircle, Clock, LogOut } from 'lucide-react'
import { useAuthContext } from '../contexts/AuthContext'
import { usePartner } from '../contexts/PartnerContext'
import { getInvitation, redeemInvitation, writeTenantAudit } from '../firebase/partners'
import GateScreen from '../components/auth/GateScreen'
import type { Invitation } from '../types/auth'

type JoinState =
  | { kind: 'loading' }
  | { kind: 'invalid' }            // missing, not for this email, cancelled — deliberately indistinguishable
  | { kind: 'wrong-domain' }
  | { kind: 'expired' }
  | { kind: 'already-member' }
  | { kind: 'restricted' }         // existing Blocked/Suspended membership cannot be reset by an invite
  | { kind: 'ready'; inv: Invitation }

/**
 * Invitation redemption. The invitation's partnerId must equal the Partner
 * resolved from THIS hostname; rules independently require the invitation's
 * email to match the signed-in Google account and copy role/partnerId from
 * the invitation, so a GAMYAA invite can never create a UFlight membership.
 */
export default function Join() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const { userProfile, membership, setMembership, signOut, isPlatformAdmin } = useAuthContext()
  const { partner } = usePartner()
  const navigate = useNavigate()
  const [state, setState] = useState<JoinState>({ kind: 'loading' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!partner || !userProfile) return
    if (!/^[A-Za-z0-9_-]{32,64}$/.test(token)) { setState({ kind: 'invalid' }); return }
    getInvitation(token)
      .then(inv => {
        if (!inv || inv.status !== 'Pending') return setState({ kind: 'invalid' })
        if (inv.partnerId !== partner.id) return setState({ kind: 'wrong-domain' })
        if (Date.now() >= inv.expiresAtMs) return setState({ kind: 'expired' })
        if (membership?.status === 'Active') return setState({ kind: 'already-member' })
        if (membership && membership.status !== 'Pending') return setState({ kind: 'restricted' })
        setState({ kind: 'ready', inv })
      })
      .catch(() => setState({ kind: 'invalid' })) // rules deny ⇒ not this user's invite
  }, [token, partner, userProfile, membership])

  async function accept(inv: Invitation) {
    if (!userProfile) return
    setBusy(true)
    setError('')
    try {
      const m = await redeemInvitation(inv, userProfile, membership)
      await writeTenantAudit({
        uid: userProfile.uid, userEmail: userProfile.email, action: 'invitation_accepted',
        partnerId: inv.partnerId, targetType: 'partnerMemberships', targetId: m.id,
        details: `Accepted invitation as ${inv.role}`, metadata: { role: inv.role },
      }).catch(() => {})
      setMembership(m)
      navigate('/', { replace: true })
    } catch {
      setError('This invitation could not be accepted. It may have expired or been cancelled.')
    } finally {
      setBusy(false)
    }
  }

  const partnerName = partner?.displayName ?? null
  const signOutBtn = (
    <button onClick={async () => { await signOut(); navigate('/login', { replace: true }) }}
      className="btn-secondary w-full justify-center flex items-center gap-1.5">
      <LogOut size={14} /> Sign out
    </button>
  )
  const homeBtn = (
    <button onClick={() => navigate('/', { replace: true })} className="btn-primary w-full justify-center">
      Continue
    </button>
  )

  switch (state.kind) {
    case 'loading':
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )
    case 'already-member':
      return (
        <GateScreen partnerName={partnerName} icon={<MailCheck size={18} className="text-green-400" />}
          title="You already have access" actions={homeBtn}>
          <p>Your {partnerName} account is active.</p>
        </GateScreen>
      )
    case 'expired':
      return (
        <GateScreen partnerName={partnerName} icon={<Clock size={18} className="text-amber-400" />}
          title="This invitation has expired" actions={signOutBtn}>
          <p>Ask your administrator to send a new invitation.</p>
        </GateScreen>
      )
    case 'wrong-domain':
      return (
        <GateScreen partnerName={partnerName} icon={<AlertCircle size={18} className="text-amber-400" />}
          title="Wrong sign-in address" actions={signOutBtn}>
          <p>Open the invitation link exactly as you received it — it was issued for a different sign-in address.</p>
        </GateScreen>
      )
    case 'restricted':
      return (
        <GateScreen partnerName={partnerName} icon={<AlertCircle size={18} className="text-red-400" />}
          title="This invitation can't be used" actions={signOutBtn}>
          <p>Your access to {partnerName} is restricted. Contact your administrator.</p>
        </GateScreen>
      )
    case 'invalid':
      return (
        <GateScreen partnerName={partnerName} icon={<AlertCircle size={18} className="text-red-400" />}
          title="Invitation not found"
          actions={isPlatformAdmin ? <>{homeBtn}{signOutBtn}</> : signOutBtn}>
          <p>This invitation link isn't valid for <span className="text-slate-200 break-all">{userProfile?.email}</span>.</p>
          <p className="text-xs text-slate-500">Make sure you're signed in with the Google account the invitation was sent to.</p>
        </GateScreen>
      )
    case 'ready':
      return (
        <GateScreen
          partnerName={partnerName}
          icon={<MailCheck size={18} className="text-brand-400" />}
          title={`Join ${partnerName}`}
          actions={
            <>
              <button onClick={() => accept(state.inv)} disabled={busy} className="btn-primary w-full justify-center">
                {busy ? 'Accepting…' : 'Accept invitation'}
              </button>
              {signOutBtn}
            </>
          }
        >
          <p>You've been invited to join {partnerName} as <span className="text-white font-semibold">{state.inv.role}</span>.</p>
          <p className="text-xs text-slate-500 break-all">Signed in as {userProfile?.email}</p>
          {error && <p className="text-xs text-red-300">{error}</p>}
        </GateScreen>
      )
  }
}
