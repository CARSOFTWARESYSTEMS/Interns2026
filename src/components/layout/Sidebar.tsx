import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, Cpu, FileText, FolderOpen,
  ClipboardCheck, ShieldCheck, Award, CalendarDays, X
} from 'lucide-react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/developers', label: 'Developers', icon: Users },
  { to: '/simulators', label: 'Simulators', icon: Cpu },
  { to: '/stories', label: 'User Stories', icon: FileText },
  { to: '/evidence', label: 'Evidence', icon: FolderOpen },
  { to: '/qa', label: 'QA Review', icon: ClipboardCheck },
  { to: '/architect', label: 'Architect Approval', icon: ShieldCheck },
  { to: '/weekly', label: 'Weekly Review', icon: CalendarDays },
  { to: '/demo', label: 'Final Demo', icon: Award },
]

interface SidebarProps {
  open?: boolean
  onClose?: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-14 left-0 bottom-0 z-40 w-56 bg-slate-900 border-r border-slate-700
          flex flex-col transition-transform duration-200
          ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <button
          onClick={onClose}
          className="lg:hidden absolute top-2 right-2 p-1 text-slate-400 hover:text-white"
        >
          <X size={16} />
        </button>

        <div className="px-3 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 px-3 mb-2">Navigation</p>
          <nav className="space-y-0.5">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? 'active' : ''}`
                }
                onClick={onClose}
              >
                <Icon size={15} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="mt-auto px-4 py-4 border-t border-slate-700">
          <div className="text-[10px] text-slate-500 leading-relaxed">
            <p className="font-semibold text-slate-400 mb-1">EV.ENGINEER™</p>
            <p>Battery Trust Platform</p>
            <p>v1.0 · Intern Program 2026</p>
            <p className="mt-1.5 text-slate-600">Powered by EV.ENGINEER</p>
          </div>
        </div>
      </aside>
    </>
  )
}
