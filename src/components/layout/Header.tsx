import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Battery, Shield, Menu, User, LogOut, Settings, ChevronDown, LayoutDashboard } from 'lucide-react'
import { useAuthContext } from '../../contexts/AuthContext'
import UserAvatar from '../ui/UserAvatar'
import PermissionBadge from '../ui/PermissionBadge'
import ProfileCompletion from '../ui/ProfileCompletion'
import { calcProfileCompletion } from '../../types/auth'

interface HeaderProps {
  onMenuToggle?: () => void
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const { userProfile, signOut, isAuthenticated } = useAuthContext()
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const completion = userProfile ? calcProfileCompletion(userProfile) : 0

  async function handleSignOut() {
    setDropdownOpen(false)
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-slate-900 border-b border-slate-700 flex items-center px-4 gap-3">
      {/* Mobile menu toggle */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
      >
        <Menu size={18} />
      </button>

      {/* Brand */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1.5">
          <Battery size={18} className="text-brand-400" />
          <Shield size={14} className="text-brand-300 -ml-1" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-white font-bold text-sm tracking-wide">UFlight™ | EV.ENGINEER™</span>
          <span className="text-slate-400 text-[10px] tracking-widest uppercase">Battery Intelligence &amp; Cybersecurity</span>
        </div>
      </div>

      <div className="h-6 w-px bg-slate-700 mx-1" />

      <div className="flex flex-col gap-0.5">
        <span className="text-slate-200 font-semibold text-xs">Battery Trust Platform</span>
        <span className="text-slate-500 text-[10px]">Engineering Command Center</span>
      </div>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-2">
        <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-widest bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase hidden sm:inline">
          AS 9102 BETA
        </span>
        <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-widest bg-brand-700/30 text-brand-300 border border-brand-700/40 uppercase hidden sm:inline">
          M03
        </span>

        {/* User menu */}
        {isAuthenticated && userProfile && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              className="flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <UserAvatar
                photoURL={userProfile.photoURL}
                displayName={userProfile.displayName}
                size="xs"
                className="ring-slate-600"
              />
              <div className="hidden sm:flex flex-col items-start gap-0.5">
                <span className="text-xs font-semibold text-slate-200 max-w-[120px] truncate">
                  {userProfile.displayName}
                </span>
                <span className="text-[9px] text-slate-500 max-w-[120px] truncate">
                  {userProfile.role}
                </span>
              </div>
              <ChevronDown
                size={12}
                className={`text-slate-400 transition-transform duration-150 ${dropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Dropdown */}
            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-72 bg-white rounded-xl shadow-2xl border border-slate-100 z-50 overflow-hidden">
                {/* Profile header */}
                <div className="p-4 bg-slate-50 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      photoURL={userProfile.photoURL}
                      displayName={userProfile.displayName}
                      size="md"
                      className="ring-slate-200"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{userProfile.displayName}</p>
                      <p className="text-xs text-slate-400 truncate">{userProfile.email}</p>
                      <div className="mt-1">
                        <PermissionBadge role={userProfile.role} size="xs" />
                      </div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <ProfileCompletion percent={completion} size="sm" />
                  </div>
                </div>

                {/* Menu items */}
                <div className="py-1.5">
                  <button
                    onClick={() => { setDropdownOpen(false); navigate('/my-dashboard') }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <LayoutDashboard size={14} className="text-slate-400" />
                    My Dashboard
                  </button>
                  <button
                    onClick={() => { setDropdownOpen(false); navigate('/profile') }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <User size={14} className="text-slate-400" />
                    My Profile
                    {completion < 100 && (
                      <span className="ml-auto text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                        {completion}%
                      </span>
                    )}
                  </button>
                  {(userProfile.role === 'Platform Admin' || userProfile.role === 'Engineering Manager') && (
                    <button
                      onClick={() => { setDropdownOpen(false); navigate('/settings') }}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <Settings size={14} className="text-slate-400" />
                      Settings
                    </button>
                  )}
                </div>

                <div className="border-t border-slate-100 py-1.5">
                  <div className="px-4 py-1.5">
                    <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide">Organization</p>
                    <p className="text-xs text-slate-600 font-semibold">UFlight™ | EV.ENGINEER™</p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={14} className="text-red-400" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
