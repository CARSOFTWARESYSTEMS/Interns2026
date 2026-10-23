import { Navigate, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuthContext } from '../contexts/AuthContext'
import { useBranding } from '../contexts/PartnerContext'
import PartnerBrandMark from '../components/ui/PartnerBrandMark'
import MyOffers from '../components/offers/MyOffers'

/**
 * Candidate view. Shows only offers addressed to the signed-in (verified)
 * email in the Partner resolved from this hostname. No membership needed.
 * firestore.rules + storage.rules enforce the same: another candidate's
 * offer id in the URL or a query returns nothing.
 *
 * Members read the same offers inside the dashboard (/people/my-offer), so a
 * member opening this link (e.g. the copied candidate link) is sent there.
 */
export default function OfferReview() {
  const { signOut, accessState } = useAuthContext()
  const b = useBranding()
  const navigate = useNavigate()

  if (accessState === 'active' || accessState === 'platform-admin') {
    return <Navigate to="/people/my-offer" replace />
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Partner identity band */}
      <header className="bg-slate-900 text-white">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 pt-6 pb-24 sm:pb-28">
          <div className="flex items-center justify-end gap-2 text-sm">
            <button onClick={handleSignOut} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-slate-300 hover:text-white hover:bg-white/10">
              <LogOut size={14} /> Sign out
            </button>
          </div>
          <div className="mt-6 flex flex-col items-center text-center gap-4">
            <PartnerBrandMark size="xl" />
            <div>
              <p className="text-xl sm:text-2xl font-bold tracking-tight break-words">{b.name}</p>
              {b.subtitle && <p className="mt-1 text-sm text-slate-400 break-words">{b.subtitle}</p>}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 sm:px-6 -mt-16 sm:-mt-20 pb-16">
        <MyOffers />

        {b.footer && (
          <p className="mt-12 text-center text-xs text-slate-400">{b.footer}{b.location ? `, ${b.location}` : ''}</p>
        )}
      </main>
    </div>
  )
}
