import { useState } from 'react'
import { Battery, Shield } from 'lucide-react'
import { useBranding } from '../../contexts/PartnerContext'

interface PartnerBrandMarkProps {
  size?: 'sm' | 'lg'
  /** Use the dark-background logo variant when the Partner provides one. */
  onDark?: boolean
}

/**
 * The Partner's logo when configured (https URLs only), otherwise the
 * platform's original battery + shield mark. One component for every Partner.
 */
export default function PartnerBrandMark({ size = 'sm', onDark = true }: PartnerBrandMarkProps) {
  const b = useBranding()
  const [failed, setFailed] = useState(false)
  const src = (onDark && b.logoDarkUrl) || b.logoUrl

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={b.name}
        onError={() => setFailed(true)}
        className={size === 'lg' ? 'h-10 w-auto max-w-[180px] object-contain' : 'h-6 w-auto max-w-[96px] object-contain'}
      />
    )
  }

  if (size === 'lg') {
    return (
      <div className="relative" aria-hidden="true">
        <Battery size={36} className="text-brand-400" />
        <Shield size={18} className="text-brand-300 absolute -bottom-1 -right-1" />
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      <Battery size={18} className="text-brand-400" />
      <Shield size={14} className="text-brand-300 -ml-1" />
    </div>
  )
}
