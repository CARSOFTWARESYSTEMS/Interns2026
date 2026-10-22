import { useEffect, useState } from 'react'
import { Building2, ChevronDown } from 'lucide-react'
import { useAuthContext } from '../../contexts/AuthContext'
import { usePartner } from '../../contexts/PartnerContext'
import { listPartners } from '../../firebase/partners'
import type { Partner } from '../../types/partner'

/**
 * Platform Admin only: choose which Partner's data is in view. Renders nothing
 * for anyone else — normal users reach another Partner through its own domain.
 * The choice is per browser tab and never changes the domain's branding.
 */
export default function PartnerSwitcher() {
  const { isPlatformAdmin, activePartnerId, setViewingPartner } = useAuthContext()
  const { partner: hostPartner } = usePartner()
  const [partners, setPartners] = useState<Partner[]>([])

  useEffect(() => {
    if (!isPlatformAdmin) return
    listPartners()
      .then(ps => setPartners(ps.sort((a, b) => a.displayName.localeCompare(b.displayName))))
      .catch(() => setPartners([]))
  }, [isPlatformAdmin])

  if (!isPlatformAdmin || partners.length === 0) return null

  return (
    <label className="relative flex items-center gap-1.5 flex-shrink-0" title="Viewing Partner (Platform Admin)">
      <span className="hidden xl:inline text-[10px] font-semibold uppercase tracking-wide text-slate-500 flex-shrink-0">Viewing</span>
      <Building2 size={13} className="text-amber-400 flex-shrink-0 hidden sm:block" />
      <select
        aria-label="Viewing Partner"
        value={activePartnerId ?? ''}
        onChange={e => setViewingPartner(partners.find(p => p.id === e.target.value) ?? null)}
        className="appearance-none bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-100 text-xs font-semibold rounded-lg pl-2 pr-6 py-1 w-[84px] sm:w-auto sm:max-w-[200px] truncate focus:outline-none focus:border-brand-400 cursor-pointer"
      >
        {partners.map(p => (
          <option key={p.id} value={p.id}>
            {p.displayName}{p.id === hostPartner?.id ? ' (this domain)' : ''}{p.status !== 'Active' ? ' — inactive' : ''}
          </option>
        ))}
      </select>
      <ChevronDown size={12} className="text-slate-400 absolute right-1.5 pointer-events-none" />
    </label>
  )
}
