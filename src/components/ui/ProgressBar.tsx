interface ProgressBarProps {
  value: number
  color?: string
  showLabel?: boolean
  height?: string
}

export default function ProgressBar({ value, color = 'bg-brand-600', showLabel = false, height = 'h-2' }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 bg-slate-100 rounded-full overflow-hidden ${height}`}>
        <div
          className={`${height} ${color} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-semibold text-slate-600 w-9 text-right">{pct}%</span>
      )}
    </div>
  )
}
