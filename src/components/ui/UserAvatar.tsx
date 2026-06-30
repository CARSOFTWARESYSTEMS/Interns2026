interface UserAvatarProps {
  photoURL?: string
  displayName?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const SIZE_MAP = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-2xl',
}

function getInitials(name?: string): string {
  if (!name) return '?'
  const parts = name.trim().split(' ')
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

export default function UserAvatar({ photoURL, displayName, size = 'md', className = '' }: UserAvatarProps) {
  const sizeClass = SIZE_MAP[size]

  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={displayName ?? 'User'}
        className={`${sizeClass} rounded-full object-cover ring-2 ring-slate-700 flex-shrink-0 ${className}`}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
      />
    )
  }

  return (
    <div className={`${sizeClass} rounded-full bg-brand-600 text-white flex items-center justify-center font-bold flex-shrink-0 ring-2 ring-slate-700 ${className}`}>
      {getInitials(displayName)}
    </div>
  )
}
