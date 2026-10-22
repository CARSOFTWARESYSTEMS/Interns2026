import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { DataCollection, DataAdapter, CollectionName, AdapterStatus, SyncResult } from './types'
import { DATA_MODE } from './types'
import { FirebaseAdapter } from './adapters/firebaseAdapter'
import { getActivePartnerId, onActivePartnerChange } from '../tenant/session'
import { isLocalDevHost, normalizeHostname } from '../tenant/hostname'

// ── Context shape ─────────────────────────────────────────────────────────

interface DataContextValue {
  // Collections
  data: DataCollection | null
  loading: boolean
  error: string | null

  // Adapter controls
  /** null until created (async; dev-only modes fail closed off localhost). */
  adapter: DataAdapter | null
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
//
// Only `firebase` mode is tenant-isolated (data lives under
// partners/{partnerId}/engineering and is guarded by firestore.rules).
// `local` (bundled JSON) and `gdrive` (the user's own Drive) cannot be
// isolated per Partner, so they are DEV-ONLY: they refuse to start on any
// non-loopback host. When the build sets VITE_DATA_MODE=firebase, the
// condition below is a compile-time constant and the local/Drive adapters
// (and the seed JSON they bundle) are dropped from the production bundle.

const DEV_ONLY_MODE_ERROR =
  'This data mode is for local development only. Production must use VITE_DATA_MODE=firebase.'

async function createAdapter(): Promise<DataAdapter> {
  if (import.meta.env.VITE_DATA_MODE !== 'firebase') {
    if (!isLocalDevHost(normalizeHostname(window.location.host))) throw new Error(DEV_ONLY_MODE_ERROR)
    if (DATA_MODE === 'gdrive') {
      const { GDriveAdapter } = await import('./adapters/gdriveAdapter')
      return new GDriveAdapter()
    }
    const { LocalAdapter } = await import('./adapters/localAdapter')
    return new LocalAdapter()
  }
  return new FirebaseAdapter()
}

const EMPTY_STATUS: AdapterStatus = {
  connected: false, lastSync: null, syncInProgress: false, error: null, rootFolderName: null, rootFolderId: null,
}

// ── Provider ──────────────────────────────────────────────────────────────

export function DataProvider({ children }: { children: ReactNode }) {
  const [adapter, setAdapter] = useState<DataAdapter | null>(null)
  const [partnerId, setPartnerId] = useState<string | null>(getActivePartnerId())
  const [data, setData]       = useState<DataCollection | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [status, setStatus]   = useState<AdapterStatus>(EMPTY_STATUS)

  // Create the adapter once (fails closed for dev-only modes off localhost).
  useEffect(() => {
    createAdapter().then(setAdapter).catch(e => { setError((e as Error).message); setLoading(false) })
  }, [])

  // Follow the tenant session: data belongs to exactly one Partner at a time.
  // The session is published during AuthProvider's render, so defer the state
  // update to avoid updating this component while another one is rendering.
  useEffect(() => onActivePartnerChange(pid => queueMicrotask(() => setPartnerId(pid))), [])

  const refreshStatus = useCallback(() => {
    if (adapter) setStatus(adapter.getStatus())
  }, [adapter])

  const reload = useCallback(async () => {
    // Clear first so nothing from a previous Partner context is ever shown.
    setData(null)
    if (!adapter || !partnerId) { setLoading(!error && Boolean(partnerId)); return }
    setLoading(true)
    setError(null)
    try {
      const result = await adapter.loadAll()
      // Ignore a late result if the Partner changed while loading.
      if (getActivePartnerId() === partnerId) setData(result)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
      refreshStatus()
    }
  }, [adapter, partnerId, refreshStatus, error])

  // Load only once the user is authorised in a Partner; reload on change.
  useEffect(() => { reload() }, [adapter, partnerId]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = useCallback(async (col: CollectionName, colData: DataCollection[CollectionName]) => {
    if (!adapter?.save) throw new Error(`Save not supported in ${DATA_MODE} mode`)
    await adapter.save(col, colData)
    // Patch local state so consumers re-render without a full reload
    setData(prev => prev ? { ...prev, [col]: colData } : prev)
    refreshStatus()
  }, [adapter, refreshStatus])

  const connect = useCallback(async () => {
    if (!adapter?.connect) return
    await adapter.connect()
    refreshStatus()
    await reload()
  }, [adapter, reload, refreshStatus])

  const disconnect = useCallback(() => {
    if (!adapter?.disconnect) return
    adapter.disconnect()
    refreshStatus()
    setData(null)
  }, [adapter, refreshStatus])

  const sync = useCallback(async (): Promise<SyncResult> => {
    if (!adapter?.sync) return { success: false, timestamp: new Date().toISOString(), filesUpdated: 0, error: 'Sync not supported' }
    const result = await adapter.sync()
    if (result.success) await reload()
    refreshStatus()
    return result
  }, [adapter, reload, refreshStatus])

  const backup = useCallback(async (): Promise<SyncResult> => {
    if (!adapter?.backup) return { success: false, timestamp: new Date().toISOString(), filesUpdated: 0, error: 'Backup not supported' }
    const result = await adapter.backup()
    refreshStatus()
    return result
  }, [adapter, refreshStatus])

  const exportAll = useCallback(async () => {
    if (!adapter?.exportAll) throw new Error('Export not supported')
    await adapter.exportAll()
  }, [adapter])

  const importFile = useCallback(async (file: File, col: CollectionName) => {
    if (!adapter?.importFile) throw new Error('Import not supported')
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
