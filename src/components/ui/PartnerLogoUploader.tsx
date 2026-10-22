import { useRef, useState } from 'react'
import { ImageUp, Loader2, Trash2 } from 'lucide-react'
import { uploadPartnerLogo, clearPartnerLogo } from '../../firebase/offers'
import { writeTenantAudit } from '../../firebase/partners'
import { safeUrl } from '../../tenant/branding'
import type { Partner } from '../../types/partner'

type Variant = 'logoUrl' | 'logoDarkUrl'

/**
 * Upload / replace / clear a Partner's logos. Used by the Partner's Admin
 * (Settings) and by Platform Admins (Partners). Rules allow a Partner Admin
 * to change ONLY the logo fields of their own Partner.
 */
export default function PartnerLogoUploader({ partner, actor, onChange }: {
  partner: Partner
  actor: { uid: string; email: string }
  onChange?: (variant: Variant, url: string) => void
}) {
  const [urls, setUrls] = useState<Record<Variant, string>>({
    logoUrl: safeUrl(partner.branding?.logoUrl),
    logoDarkUrl: safeUrl(partner.branding?.logoDarkUrl),
  })
  const [busy, setBusy] = useState<Variant | ''>('')
  const [error, setError] = useState('')

  async function upload(variant: Variant, file: File) {
    setBusy(variant); setError('')
    try {
      const url = await uploadPartnerLogo(partner.id, file, variant, actor.uid)
      setUrls(u => ({ ...u, [variant]: url }))
      onChange?.(variant, url)
      await writeTenantAudit({
        uid: actor.uid, userEmail: actor.email, action: 'logo_updated', partnerId: partner.id,
        targetType: 'partners', targetId: partner.id, details: `${variant === 'logoUrl' ? 'Logo' : 'Dark logo'} updated`,
      }).catch(() => {})
    } catch (e) {
      const m = (e as Error).message
      setError(m && !m.startsWith('Firebase') ? m : 'The logo couldn’t be saved. Only this Partner’s Admin or a Platform Admin can change it.')
    } finally { setBusy('') }
  }

  async function clear(variant: Variant) {
    setBusy(variant); setError('')
    try {
      await clearPartnerLogo(partner.id, variant, actor.uid)
      setUrls(u => ({ ...u, [variant]: '' }))
      onChange?.(variant, '')
    } catch { setError('The logo couldn’t be removed.') }
    finally { setBusy('') }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <LogoSlot label="Logo for light backgrounds" hint="Offer pages and documents" dark={false}
          url={urls.logoUrl} busy={busy === 'logoUrl'} onFile={f => upload('logoUrl', f)} onClear={() => clear('logoUrl')} />
        <LogoSlot label="Logo for dark backgrounds" hint="Login, header and offer banner" dark
          url={urls.logoDarkUrl} busy={busy === 'logoDarkUrl'} onFile={f => upload('logoDarkUrl', f)} onClear={() => clear('logoDarkUrl')} />
      </div>
      <p className="text-xs text-slate-500">PNG, SVG, WebP or JPEG, up to 2 MB. Logos are public; they appear on the sign-in page. Changes show on the next page load.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}

function LogoSlot({ label, hint, dark, url, busy, onFile, onClear }: {
  label: string; hint: string; dark: boolean; url: string; busy: boolean
  onFile: (f: File) => void; onClear: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className="rounded-xl ring-1 ring-slate-200 overflow-hidden">
      <div className={`h-24 flex items-center justify-center ${dark ? 'bg-slate-900' : 'bg-slate-50'}`}>
        {url
          ? <img src={url} alt="" className="max-h-16 max-w-[80%] object-contain" />
          : <span className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>No logo</span>}
      </div>
      <div className="flex items-center gap-2 px-3 py-2.5 bg-white">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-800">{label}</p>
          <p className="text-xs text-slate-500">{hint}</p>
        </div>
        {url && !busy && (
          <button onClick={onClear} aria-label={`Remove ${label.toLowerCase()}`} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50">
            <Trash2 size={14} />
          </button>
        )}
        <button onClick={() => input.current?.click()} disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ring-inset ring-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <ImageUp size={14} />} {url ? 'Replace' : 'Upload'}
        </button>
        <input ref={input} type="file" accept="image/png,image/svg+xml,image/webp,image/jpeg" className="sr-only"
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onFile(f) }} />
      </div>
    </div>
  )
}
