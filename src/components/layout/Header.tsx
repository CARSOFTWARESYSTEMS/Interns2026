import { Battery, Shield, Menu } from 'lucide-react'

interface HeaderProps {
  onMenuToggle?: () => void
}

export default function Header({ onMenuToggle }: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-slate-900 border-b border-slate-700 flex items-center px-4 gap-3">
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
      >
        <Menu size={18} />
      </button>

      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1.5">
          <Battery size={18} className="text-brand-400" />
          <Shield size={14} className="text-brand-300 -ml-1" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-white font-bold text-sm tracking-wide">EV.ENGINEER™</span>
          <span className="text-slate-400 text-[10px] tracking-widest uppercase">Battery Intelligence &amp; Cybersecurity</span>
        </div>
      </div>

      <div className="h-6 w-px bg-slate-700 mx-1" />

      <div className="flex flex-col leading-none">
        <span className="text-slate-200 font-semibold text-xs">Battery Trust Platform</span>
        <span className="text-slate-500 text-[10px]">Engineering Command Center</span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-widest bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase">
          AS 9102 BETA
        </span>
        <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-widest bg-brand-700/30 text-brand-300 border border-brand-700/40 uppercase">
          Internal
        </span>
      </div>
    </header>
  )
}
