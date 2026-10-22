import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Header from './Header'
import Sidebar from './Sidebar'
import { useAuthContext } from '../../contexts/AuthContext'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { activePartnerId } = useAuthContext()

  return (
    <div className="min-h-screen bg-slate-50">
      <Header onMenuToggle={() => setSidebarOpen(o => !o)} />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="pt-14 lg:pl-56 min-h-screen">
        <div className="p-5 lg:p-6">
          {/* Remount pages when the Partner in view changes: no state from a
              previous Partner survives a switch. */}
          <Outlet key={activePartnerId ?? 'none'} />
        </div>
      </main>
    </div>
  )
}
