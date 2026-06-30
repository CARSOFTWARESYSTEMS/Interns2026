import { useNavigate } from 'react-router-dom'
import { ShieldOff, ArrowLeft, Home } from 'lucide-react'
import { useAuthContext } from '../contexts/AuthContext'
import PermissionBadge from '../components/ui/PermissionBadge'

export default function Unauthorized() {
  const navigate = useNavigate()
  const { role } = useAuthContext()

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mb-5">
        <ShieldOff size={28} className="text-red-500" />
      </div>

      <h1 className="text-4xl font-black text-slate-900 mb-1">403</h1>
      <h2 className="text-lg font-bold text-slate-700 mb-2">Access Denied</h2>
      <p className="text-sm text-slate-500 max-w-sm mb-2">
        You don't have permission to access this page.
      </p>
      {role && (
        <div className="flex items-center gap-2 mb-6 text-xs text-slate-400">
          Your role: <PermissionBadge role={role} size="xs" />
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={() => navigate(-1)} className="btn-secondary flex items-center gap-1.5">
          <ArrowLeft size={14} /> Go Back
        </button>
        <button onClick={() => navigate('/')} className="btn-primary flex items-center gap-1.5">
          <Home size={14} /> Dashboard
        </button>
      </div>

      <p className="mt-8 text-[10px] text-slate-300">
        Contact your Engineering Manager to request access.
      </p>
    </div>
  )
}
