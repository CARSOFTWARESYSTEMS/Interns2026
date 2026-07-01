import type { DeveloperCapacity } from '../../types/assignments'

interface CapacityBarProps {
  capacity: DeveloperCapacity
  showLabel?: boolean
}

export default function CapacityBar({ capacity, showLabel = true }: CapacityBarProps) {
  const { capacityPercent, currentAssignedHours, weeklyCapacityHours, remainingHours } = capacity
  const barColor =
    capacityPercent >= 90 ? 'bg-red-500' :
    capacityPercent >= 70 ? 'bg-amber-500' :
    'bg-green-500'
  const textColor =
    capacityPercent >= 90 ? 'text-red-600' :
    capacityPercent >= 70 ? 'text-amber-600' :
    'text-green-600'
  const label =
    capacityPercent >= 90 ? 'Full' :
    capacityPercent >= 70 ? 'Busy' :
    'Available'

  return (
    <div className="space-y-1">
      {showLabel && (
        <div className="flex items-center justify-between text-[10px]">
          <span className={`font-bold ${textColor}`}>{label}</span>
          <span className="text-slate-400">{currentAssignedHours}/{weeklyCapacityHours}h · {remainingHours}h free</span>
        </div>
      )}
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.min(100, capacityPercent)}%` }}
        />
      </div>
      {showLabel && (
        <p className="text-[10px] text-slate-400">{capacity.activeAssignments} active assignment{capacity.activeAssignments !== 1 ? 's' : ''}</p>
      )}
    </div>
  )
}
