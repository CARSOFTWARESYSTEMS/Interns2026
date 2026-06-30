import { ExternalLink, CheckCircle, XCircle, Clock } from 'lucide-react'

interface EvidenceRowProps {
  label: string
  value: string
  required?: boolean
}

function StatusIcon({ value }: { value: string }) {
  if (!value) return <XCircle size={14} className="text-red-400" />
  if (value.startsWith('http') || value.startsWith('/')) {
    return <CheckCircle size={14} className="text-green-500" />
  }
  return <Clock size={14} className="text-yellow-500" />
}

export default function EvidenceRow({ label, value, required = true }: EvidenceRowProps) {
  return (
    <div className="evidence-row">
      <div className="flex items-center gap-2">
        <StatusIcon value={value} />
        <span className="text-sm text-slate-700">{label}</span>
        {required && !value && (
          <span className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded font-semibold">Required</span>
        )}
      </div>
      {value ? (
        value.startsWith('http') ? (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-brand-600 hover:underline font-medium"
          >
            View <ExternalLink size={11} />
          </a>
        ) : (
          <span className="text-xs text-slate-500 max-w-xs truncate">{value}</span>
        )
      ) : (
        <span className="text-xs text-slate-400 italic">Not submitted</span>
      )}
    </div>
  )
}
