import { useEffect, useState } from 'react'
import { Users, RefreshCw, Loader2 } from 'lucide-react'
import { useAuthContext } from '../../contexts/AuthContext'
import { useDevelopers } from '../../data/DataProvider'
import { getAllCapacities, recalculateCapacity } from '../../firebase/assignments'
import type { DeveloperCapacity } from '../../types/assignments'
import CapacityBar from '../../components/assignments/CapacityBar'
import PageHeader from '../../components/ui/PageHeader'

export default function Capacity() {
  const { uid } = useAuthContext()
  const developers = useDevelopers()
  const [capacities, setCapacities] = useState<DeveloperCapacity[]>([])
  const [loading, setLoading]       = useState(true)
  const [recalcId, setRecalcId]     = useState<string | null>(null)

  useEffect(() => {
    loadCapacities()
  }, [])

  async function loadCapacities() {
    setLoading(true)
    const data = await getAllCapacities()
    // Merge with developer list so any devs not yet in Firestore show up
    const merged = developers.map(d => {
      const existing = data.find(c => c.developerId === d.id)
      return existing ?? {
        developerId: d.id,
        developerName: d.name,
        weeklyCapacityHours: 40,
        currentAssignedHours: 0,
        remainingHours: 40,
        capacityPercent: 0,
        activeAssignments: 0,
        lastUpdated: '',
      } satisfies DeveloperCapacity
    })
    setCapacities(merged)
    setLoading(false)
  }

  async function handleRecalculate(devId: string, devName: string) {
    setRecalcId(devId)
    const updated = await recalculateCapacity(devId, devName)
    setCapacities(prev => prev.map(c => c.developerId === devId ? updated : c))
    setRecalcId(null)
  }

  async function handleRecalculateAll() {
    setRecalcId('all')
    const updated = await Promise.all(
      developers.map(d => recalculateCapacity(d.id, d.name))
    )
    setCapacities(updated)
    setRecalcId(null)
  }

  const available = capacities.filter(c => c.capacityPercent < 70).length
  const busy      = capacities.filter(c => c.capacityPercent >= 70 && c.capacityPercent < 90).length
  const full      = capacities.filter(c => c.capacityPercent >= 90).length

  return (
    <div className="space-y-4">
      <PageHeader
        title="Developer Capacity"
        subtitle="Weekly capacity and assignment load per developer"
        icon={<Users size={18}/>}
      />

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4 text-center border-l-4 border-green-400">
          <p className="text-2xl font-bold text-green-600">{available}</p>
          <p className="text-xs text-slate-500 mt-0.5">Available</p>
          <p className="text-[10px] text-slate-400">&lt; 70% capacity</p>
        </div>
        <div className="card p-4 text-center border-l-4 border-amber-400">
          <p className="text-2xl font-bold text-amber-600">{busy}</p>
          <p className="text-xs text-slate-500 mt-0.5">Busy</p>
          <p className="text-[10px] text-slate-400">70–90% capacity</p>
        </div>
        <div className="card p-4 text-center border-l-4 border-red-400">
          <p className="text-2xl font-bold text-red-600">{full}</p>
          <p className="text-xs text-slate-500 mt-0.5">Full</p>
          <p className="text-[10px] text-slate-400">&gt; 90% capacity</p>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleRecalculateAll}
          disabled={recalcId !== null}
          className="btn-secondary gap-1.5 text-xs"
        >
          {recalcId === 'all'
            ? <Loader2 size={12} className="animate-spin" />
            : <RefreshCw size={12} />}
          Recalculate All
        </button>
      </div>

      {loading ? (
        <div className="card p-12 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Developer','Product','Capacity','Hours','Active','Last Updated','Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {capacities.map(cap => {
                const dev = developers.find(d => d.id === cap.developerId)
                return (
                  <tr key={cap.developerId} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800 text-sm">{cap.developerName}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{cap.developerId}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-500">
                        {dev?.storyId?.startsWith('P1') ? 'Battery Aadhaar' :
                         dev?.storyId?.startsWith('P2') ? 'Cybersecurity' :
                         dev?.storyId?.startsWith('P3') ? 'FAI AS9102' : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 min-w-48">
                      <CapacityBar capacity={cap} showLabel />
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-bold text-slate-700">{cap.currentAssignedHours}h</p>
                      <p className="text-[10px] text-slate-400">of {cap.weeklyCapacityHours}h/week</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-bold text-slate-700">{cap.activeAssignments}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[10px] text-slate-400">
                        {cap.lastUpdated ? new Date(cap.lastUpdated).toLocaleDateString() : 'Never'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleRecalculate(cap.developerId, cap.developerName)}
                        disabled={recalcId !== null}
                        className="btn-secondary text-[10px] px-2.5 py-1.5 gap-1"
                      >
                        {recalcId === cap.developerId
                          ? <Loader2 size={10} className="animate-spin" />
                          : <RefreshCw size={10} />}
                        Recalc
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
