import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { DataCollection, DataAdapter, CollectionName, AdapterStatus, SyncResult } from './types'
import { DATA_MODE } from './types'
import { LocalAdapter } from './adapters/localAdapter'
import { GDriveAdapter } from './adapters/gdriveAdapter'
import { FirebaseAdapter } from './adapters/firebaseAdapter'

// ── Context shape ─────────────────────────────────────────────────────────

interface DataContextValue {
  // Collections
  data: DataCollection | null
  loading: boolean
  error: string | null

  // Adapter controls
  adapter: DataAdapter
  status: AdapterStatus

  // Actions
  reload(): Promise<void>
  save(collection: CollectionName, data: DataCollection[CollectionName]): Promise<void>
  connect(): Promise<void>
  disconnect(): void
  sync(): Promise<SyncResult>
  backup(): Promise<SyncResult>
  exportAll(): Promise<void>
  importFile(file: File, collection: CollectionName): Promise<void>
}

const DataContext = createContext<DataContextValue | null>(null)

// ── Factory ───────────────────────────────────────────────────────────────

function createAdapter(): DataAdapter {
  switch (DATA_MODE) {
    case 'gdrive':   return new GDriveAdapter()
    case 'firebase': return new FirebaseAdapter()
    default:         return new LocalAdapter()
  }
}

// ── Provider ──────────────────────────────────────────────────────────────

export function DataProvider({ children }: { children: ReactNode }) {
  const [adapter]  = useState<DataAdapter>(createAdapter)
  const [data, setData]       = useState<DataCollection | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [status, setStatus]   = useState<AdapterStatus>(adapter.getStatus())

  const refreshStatus = useCallback(() => {
    setStatus(adapter.getStatus())
  }, [adapter])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await adapter.loadAll()
      setData(result)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
      refreshStatus()
    }
  }, [adapter, refreshStatus])

  // Initial load
  useEffect(() => { reload() }, [reload])

  const save = useCallback(async (col: CollectionName, colData: DataCollection[CollectionName]) => {
    if (!adapter.save) throw new Error(`Save not supported in ${DATA_MODE} mode`)
    await adapter.save(col, colData)
    // Patch local state so consumers re-render without a full reload
    setData(prev => prev ? { ...prev, [col]: colData } : prev)
    refreshStatus()
  }, [adapter, refreshStatus])

  const connect = useCallback(async () => {
    if (!adapter.connect) return
    await adapter.connect()
    refreshStatus()
    await reload()
  }, [adapter, reload, refreshStatus])

  const disconnect = useCallback(() => {
    if (!adapter.disconnect) return
    adapter.disconnect()
    refreshStatus()
    setData(null)
  }, [adapter, refreshStatus])

  const sync = useCallback(async (): Promise<SyncResult> => {
    if (!adapter.sync) return { success: false, timestamp: new Date().toISOString(), filesUpdated: 0, error: 'Sync not supported' }
    const result = await adapter.sync()
    if (result.success) await reload()
    refreshStatus()
    return result
  }, [adapter, reload, refreshStatus])

  const backup = useCallback(async (): Promise<SyncResult> => {
    if (!adapter.backup) return { success: false, timestamp: new Date().toISOString(), filesUpdated: 0, error: 'Backup not supported' }
    const result = await adapter.backup()
    refreshStatus()
    return result
  }, [adapter, refreshStatus])

  const exportAll = useCallback(async () => {
    if (!adapter.exportAll) throw new Error('Export not supported')
    await adapter.exportAll()
  }, [adapter])

  const importFile = useCallback(async (file: File, col: CollectionName) => {
    if (!adapter.importFile) throw new Error('Import not supported')
    await adapter.importFile(file, col)
    await reload()
  }, [adapter, reload])

  return (
    <DataContext.Provider value={{
      data, loading, error,
      adapter, status,
      reload, save, connect, disconnect, sync, backup, exportAll, importFile,
    }}>
      {children}
    </DataContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useData(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData() must be used inside <DataProvider>')
  return ctx
}

// ── Convenience typed selectors ───────────────────────────────────────────

export function useDevelopers()  { return useData().data?.developers  ?? [] }
export function useSimulators()  { return useData().data?.simulators  ?? [] }
export function useStories()     { return useData().data?.stories      ?? [] }
export function useAssignments() { return useData().data?.assignments  ?? [] }
export function useWeeklyPlan()  { return useData().data?.weeklyPlan   ?? [] }
