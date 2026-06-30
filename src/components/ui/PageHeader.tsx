import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  icon?: ReactNode
  backTo?: string
  backLabel?: string
  actions?: ReactNode
  breadcrumb?: { label: string; to?: string }[]
}

export default function PageHeader({ title, subtitle, icon, backTo, backLabel, actions, breadcrumb }: PageHeaderProps) {
  const navigate = useNavigate()
  return (
    <div className="mb-5">
      {(backTo || breadcrumb) && (
        <div className="flex items-center gap-1 mb-2 text-xs text-slate-500">
          {backTo && (
            <button
              onClick={() => navigate(backTo)}
              className="flex items-center gap-1 hover:text-brand-600 transition-colors font-medium"
            >
              <ChevronLeft size={13} />
              {backLabel ?? 'Back'}
            </button>
          )}
          {breadcrumb && breadcrumb.map((b, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span className="text-slate-300">/</span>}
              <span>{b.label}</span>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-700 flex-shrink-0">
              {icon}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-slate-900">{title}</h1>
            {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 flex-shrink-0 no-print">{actions}</div>}
      </div>
    </div>
  )
}
