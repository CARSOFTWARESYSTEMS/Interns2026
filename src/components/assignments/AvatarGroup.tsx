interface AvatarGroupProps {
  names: string[]        // display names
  max?: number           // max visible before +N
  size?: 'sm' | 'md'
}

function initials(name: string): string {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

const COLORS = [
  'bg-brand-600', 'bg-purple-600', 'bg-emerald-600',
  'bg-amber-500', 'bg-rose-600', 'bg-indigo-600',
]

export default function AvatarGroup({ names, max = 3, size = 'sm' }: AvatarGroupProps) {
  const visible = names.slice(0, max)
  const overflow = names.length - visible.length
  const dim = size === 'sm' ? 'w-6 h-6 text-[9px]' : 'w-8 h-8 text-[11px]'
  const ring = size === 'sm' ? 'ring-1' : 'ring-2'

  return (
    <div className="flex items-center -space-x-1">
      {visible.map((name, i) => (
        <div
          key={name}
          title={name}
          className={`${dim} ${ring} ring-white rounded-full flex items-center justify-center font-bold text-white ${COLORS[i % COLORS.length]} relative z-${10 - i}`}
        >
          {initials(name)}
        </div>
      ))}
      {overflow > 0 && (
        <div className={`${dim} ${ring} ring-white rounded-full flex items-center justify-center font-bold bg-slate-200 text-slate-600`}>
          +{overflow}
        </div>
      )}
    </div>
  )
}
