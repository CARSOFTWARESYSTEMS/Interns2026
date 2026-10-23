import PartnerBrandMark from '../../components/ui/PartnerBrandMark'
import MyOffers from '../../components/offers/MyOffers'
import { useBranding } from '../../contexts/PartnerContext'

/**
 * A member's own offer letter, inside the dashboard. Candidates without
 * Partner access see the same offers on the standalone /offer page.
 */
export default function MyOfferLetter() {
  const b = useBranding()

  return (
    <div className="space-y-6">
      {/* Partner band (matches the managers' Offer letter review page) */}
      <section className="rounded-2xl bg-slate-900 text-white px-5 sm:px-8 py-6 sm:py-7 flex items-center gap-4">
        <PartnerBrandMark size="lg" />
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">My offer letter</h1>
          <p className="text-sm text-slate-400 break-words">{b.name}</p>
        </div>
      </section>

      <MyOffers embedded />
    </div>
  )
}
