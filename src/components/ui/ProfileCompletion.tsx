interface ProfileCompletionProps {
  percent: number
  showLabel?: boolean
  size?: 'sm' | 'md'
}

export default function ProfileCompletion({ percent, showLabel = true, size = 'md' }: ProfileCompletionProps) {
  const color =
    percent < 40 ? 'bg-red-500' :
    percent < 70 ? 'bg-amber-500' :
    percent < 100 ? 'bg-brand-500' : 'bg-green-500'

  const textColor =
    percent < 40 ? 'text-red-600' :
    percent < 70 ? 'text-amber-600' :
    percent < 100 ? 'text-brand-600' : 'text-green-600'

  const h = size === 'sm' ? 'h-1.5' : 'h-2'

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Profile Completion</span>
          <span className={`text-xs font-bold ${textColor}`}>{percent}%</span>
        </div>
      )}
      <div className={`w-full bg-slate-100 rounded-full overflow-hidden ${h}`}>
        <div
          className={`${h} ${color} rounded-full transition-all duration-500`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
