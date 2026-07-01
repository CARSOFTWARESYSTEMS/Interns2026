import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Cpu, FileText, FolderOpen,
  ClipboardCheck, ShieldCheck, Award, CalendarDays, X,
  ClipboardList, BarChart2, Mail, Settings, UserCog,
  User, LogOut, Shield, SlidersHorizontal,
} from 'lucide-react'
import { useAuthContext } from '../../contexts/AuthContext'
import UserAvatar from '../ui/UserAvatar'
import PermissionBadge from '../ui/PermissionBadge'

const platformItems = [
  { to: '/',        label: 'Dashboard',    icon: LayoutDashboard, end: true },
  { to: '/weekly',  label: 'Weekly Review', icon: CalendarDays },
  { to: '/demo',    label: 'Final Demo',    icon: Award },
]

const engineeringItems = [
  { to: '/assignments', label: 'Assignments',  icon: ClipboardList },
  { to: '/developers',  label: 'Developers',   icon: Users },
  { to: '/simulators',  label: 'Simulators',   icon: Cpu },
  { to: '/stories',     label: 'User Stories', icon: FileText },
  { to: '/qa',          label: 'QA Review',    icon: ClipboardCheck },
  { to: '/architect',   label: 'Architect',    icon: ShieldCheck },
  { to: '/evidence',    label: 'Evidence',     icon: FolderOpen },
  { to: '/email-queue', label: 'Email Queue',  icon: Mail },
  { to: '/reports',     label: 'Reports',      icon: BarChart2 },
  { to: '/settings',    label: 'Settings',     icon: Settings },
]

const adminItems = [
  { to: '/admin/users',               label: 'Users',               icon: UserCog },
  { to: '/admin/invitations',         label: 'Invitations',         icon: Mail },
  { to: '/admin/developer-settings',  label: 'Developer Settings',  icon: SlidersHorizontal },
]

interface SidebarProps {
  open?: boolean
  onClose?: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { userProfile, signOut, role } = useAuthContext()
  const navigate = useNavigate()

  const isAdmin   = role === 'Platform Admin'
  const isManager = role === 'Engineering Manager'
  const isDev     = role === 'Developer'

  async function handleSignOut() {
    onClose?.()
    await signOut()
    navigate('/login', { replace: true })
  }

  // Developers get a filtered engineering nav
  const devItems = [
    { to: '/assignments', label: 'My Assignment', icon: ClipboardList },
    { to: '/stories',     label: 'My Story',      icon: FileText },
    { to: '/simulators',  label: 'My Simulator',  icon: Cpu },
    { to: '/evidence',    label: 'Evidence',       icon: FolderOpen },
    { to: '/weekly',      label: 'Weekly',         icon: CalendarDays },
    { to: '/demo',        label: 'Final Demo',     icon: Award },
  ]

  const navItems = isDev ? devItems : engineeringItems

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

        <div className="px-3 py-4 flex flex-col gap-4 flex-1">
          {/* Platform Section */}
          {!isDev && (
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
          )}

          <div className={!isDev ? 'border-t border-slate-800' : ''} />

          {/* Engineering Section */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 px-3 mb-1.5">
              {isDev ? 'My Work' : 'Engineering'}
            </p>
            <nav className="space-y-0.5">
              {navItems.map(({ to, label, icon: Icon }) => (
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

          {/* Admin Section — Platform Admin only */}
          {isAdmin && (
            <>
              <div className="border-t border-slate-800" />
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 px-3 mb-1.5 flex items-center gap-1">
                  <Shield size={9} className="text-red-500" /> Admin
                </p>
                <nav className="space-y-0.5">
                  {adminItems.map(({ to, label, icon: Icon }) => (
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
            </>
          )}
        </div>

        {/* User footer */}
        <div className="mt-auto border-t border-slate-800">
          {userProfile && (
            <div className="px-3 py-3">
              <NavLink
                to="/profile"
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''} mb-1`}
                onClick={onClose}
              >
                <User size={14} />
                <span>My Profile</span>
              </NavLink>
              <button
                onClick={handleSignOut}
                className="sidebar-link w-full text-left text-red-400 hover:text-red-300 hover:bg-red-900/20"
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          )}

          <div className="px-4 py-3 border-t border-slate-800">
            {userProfile ? (
              <div>
                <div className="flex items-center gap-2.5">
                  <UserAvatar
                    photoURL={userProfile.photoURL}
                    displayName={userProfile.displayName}
                    size="xs"
                    className="ring-slate-700"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-slate-300 truncate">{userProfile.displayName}</p>
                    <PermissionBadge role={userProfile.role} size="xs" />
                  </div>
                </div>
                <p className="text-[9px] text-slate-600 mt-2 font-semibold tracking-wide">iTelematics Software Pvt. Ltd. · Bangalore</p>
              </div>
            ) : (
              <div className="text-[10px] text-slate-500 leading-relaxed">
                <p className="font-semibold text-slate-400 mb-0.5">UFlight™ | EV.ENGINEER™</p>
                <p>Battery Trust Platform</p>
                <p className="mt-1 text-slate-600 font-semibold">iTelematics Software Pvt. Ltd.</p>
                <p>Bangalore, India</p>
                <p>v1.0 · M03 · Intern Program 2026</p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
