import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, Cpu, FileText, FolderOpen,
  ClipboardCheck, ShieldCheck, Award, CalendarDays, X,
  ClipboardList, BarChart2, Mail, Settings
} from 'lucide-react'

const platformItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/weekly', label: 'Weekly Review', icon: CalendarDays },
  { to: '/demo', label: 'Final Demo', icon: Award },
]

const engineeringItems = [
  { to: '/assignments', label: 'Assignments', icon: ClipboardList },
  { to: '/developers', label: 'Developers', icon: Users },
  { to: '/simulators', label: 'Simulators', icon: Cpu },
  { to: '/stories', label: 'User Stories', icon: FileText },
  { to: '/qa', label: 'QA Review', icon: ClipboardCheck },
  { to: '/architect', label: 'Architect', icon: ShieldCheck },
  { to: '/evidence', label: 'Evidence', icon: FolderOpen },
  { to: '/email-queue', label: 'Email Queue', icon: Mail },
  { to: '/reports', label: 'Reports', icon: BarChart2 },
  { to: '/settings', label: 'Settings', icon: Settings },
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
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} />
      )}

      <aside className={`
        fixed top-14 left-0 bottom-0 z-40 w-56 bg-slate-900 border-r border-slate-700
        flex flex-col transition-transform duration-200 overflow-y-auto
        ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <button onClick={onClose} className="lg:hidden absolute top-2 right-2 p-1 text-slate-400 hover:text-white">
          <X size={16} />
        </button>

        <div className="px-3 py-4 flex flex-col gap-4">
          {/* Platform Section */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 px-3 mb-1.5">Platform</p>
            <nav className="space-y-0.5">
              {platformItems.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                  onClick={onClose}
                >
                  <Icon size={14} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-800" />

          {/* Engineering Section */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 px-3 mb-1.5">Engineering</p>
            <nav className="space-y-0.5">
              {engineeringItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                  onClick={onClose}
                >
                  <Icon size={14} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto px-4 py-4 border-t border-slate-800">
          <div className="text-[10px] text-slate-500 leading-relaxed">
            <p className="font-semibold text-slate-400 mb-0.5">EV.ENGINEER™</p>
            <p>Battery Trust Platform</p>
            <p>v1.0 · M02 · Intern Program 2026</p>
          </div>
        </div>
      </aside>
    </>
  )
}
