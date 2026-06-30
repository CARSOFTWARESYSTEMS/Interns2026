import type { ReactNode } from 'react'

interface SectionCardProps {
  title?: string
  subtitle?: string
  icon?: ReactNode
  children: ReactNode
  className?: string
  action?: ReactNode
}

export default function SectionCard({ title, subtitle, icon, children, className = '', action }: SectionCardProps) {
  return (
    <div className={`card ${className}`}>
      {title && (
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            {icon && <span className="text-brand-600">{icon}</span>}
            <div>
              <h3 className="text-sm font-bold text-slate-900">{title}</h3>
              {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
            </div>
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}
