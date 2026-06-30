import { useNavigate } from 'react-router-dom'
import { SearchX, ArrowLeft, Home } from 'lucide-react'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-5">
        <SearchX size={28} className="text-slate-400" />
      </div>

      <h1 className="text-4xl font-black text-slate-900 mb-1">404</h1>
      <h2 className="text-lg font-bold text-slate-700 mb-2">Page Not Found</h2>
      <p className="text-sm text-slate-500 max-w-sm mb-6">
        The page you're looking for doesn't exist or has been moved.
      </p>

      <div className="flex gap-3">
        <button onClick={() => navigate(-1)} className="btn-secondary flex items-center gap-1.5">
          <ArrowLeft size={14} /> Go Back
        </button>
        <button onClick={() => navigate('/')} className="btn-primary flex items-center gap-1.5">
          <Home size={14} /> Dashboard
        </button>
      </div>
    </div>
  )
}
