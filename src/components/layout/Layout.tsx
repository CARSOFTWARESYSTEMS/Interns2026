import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { FileCheck2 } from 'lucide-react'
import { useMyOffers } from '../../hooks/useMyOffers'
import Header from './Header'
import Sidebar from './Sidebar'
import { useAuthContext } from '../../contexts/AuthContext'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { activePartnerId } = useAuthContext()
  const { pathname } = useLocation()
  const awaiting = useMyOffers().filter(o => o.status === 'In Review')

  return (
    <div className="min-h-screen bg-slate-50">
      <Header onMenuToggle={() => setSidebarOpen(o => !o)} />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="pt-14 lg:pl-56 min-h-screen">
        <div className="p-5 lg:p-6">
          {awaiting.length > 0 && pathname !== '/offer' && (
            <div className="mb-5 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl bg-brand-50 ring-1 ring-brand-200 px-4 py-3">
              <FileCheck2 size={18} className="text-brand-700 flex-shrink-0" />
              <p className="text-sm text-brand-900 flex-1">
                Your draft offer letter is ready for review. Please check the details and confirm.
              </p>
              <Link to="/offer" className="btn-primary self-start sm:self-auto whitespace-nowrap">Review offer letter</Link>
            </div>
          )}
          {/* Remount pages when the Partner in view changes: no state from a
              previous Partner survives a switch. */}
          <Outlet key={activePartnerId ?? 'none'} />
        </div>
      </main>
    </div>
  )
}
