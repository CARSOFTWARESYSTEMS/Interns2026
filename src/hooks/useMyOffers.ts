import { useEffect, useState } from 'react'
import { useAuthContext } from '../contexts/AuthContext'
import { usePartner } from '../contexts/PartnerContext'
import { listMyOffers } from '../firebase/offers'
import type { OfferDraft } from '../types/offers'

/**
 * Offers addressed to the signed-in user's email in the Partner of this
 * hostname (only In Review / Confirmed — rules hide Drafts from candidates).
 * Used for navigation hints only; the offer page and rules do the checks.
 */
export function useMyOffers(): OfferDraft[] {
  const { userProfile } = useAuthContext()
  const { partner } = usePartner()
  const [offers, setOffers] = useState<OfferDraft[]>([])
  const email = userProfile?.email ?? ''
  const pid = partner?.id ?? ''

  useEffect(() => {
    if (!pid || !email) { setOffers([]); return }
    let alive = true
    listMyOffers(pid, email).then(o => { if (alive) setOffers(o) }).catch(() => {})
    return () => { alive = false }
  }, [pid, email])

  return offers
}
