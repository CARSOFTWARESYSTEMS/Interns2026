/**
 * Google Drive adapter — reads/writes JSON config files from a Drive folder.
 *
 * Auth:  Google Identity Services (GIS) — token-based OAuth 2.0.
 * Scope: drive.file — only files created/opened by this app.
 * Files: stored under "Battery Trust Platform 2026/config/".
 *
 * Bootstrap: on first connect, uploads bundled JSON as initial data.
 * Subsequent connections: reads from Drive; writes back on save.
 * Backup: creates a timestamped copy before every write.
 */

import type { DataAdapter, DataCollection, AdapterStatus, CollectionName, SyncResult, DriveFile } from '../types'
import { DRIVE_ROOT_NAME, DRIVE_CONFIG_NAME, DRIVE_CONFIG_FILES, DRIVE_SCOPE, VALIDATORS } from '../types'

// Bundled JSON for bootstrap (first connect)
import developersRaw  from '../developers.json'
import simulatorsRaw  from '../simulators.json'
import storiesRaw     from '../stories.json'
import assignmentsRaw from '../assignments.json'
import weeklyPlanRaw  from '../weeklyPlan.json'
import type { Developer, Simulator, Story, Assignment, WeeklyPlan } from '../../types'

const BUNDLED_DEFAULTS: DataCollection = {
  developers:  developersRaw  as Developer[],
  simulators:  simulatorsRaw  as Simulator[],
  stories:     storiesRaw     as Story[],
  assignments: assignmentsRaw as Assignment[],
  weeklyPlan:  weeklyPlanRaw  as WeeklyPlan[],
}

const LS_ROOT_ID   = 'ev_gdrive_root_id'
const LS_CONFIG_ID = 'ev_gdrive_config_id'
const LS_LAST_SYNC = 'ev_gdrive_last_sync'

const DRIVE_API   = 'https://www.googleapis.com/drive/v3'
const UPLOAD_API  = 'https://www.googleapis.com/upload/drive/v3'
const FOLDER_MIME = 'application/vnd.google-apps.folder'
const JSON_MIME   = 'application/json'

// ── GIS helpers ───────────────────────────────────────────────────────────

function loadGIS(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as unknown as Record<string, unknown>).google) { resolve(); return }
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.onload  = () => resolve()
    s.onerror = () => reject(new Error('Failed to load Google Identity Services'))
    document.head.appendChild(s)
  })
}

function requestAccessToken(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).google
    if (!g?.accounts?.oauth2) { reject(new Error('GIS not loaded')); return }

    const tokenClient = g.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope:     DRIVE_SCOPE,
      callback:  (resp: Record<string, string>) => {
        if (resp.error) reject(new Error(resp.error_description ?? resp.error))
        else resolve(resp.access_token)
      },
    })
    tokenClient.requestAccessToken({ prompt: '' })
  })
}

// ── Drive API helpers ─────────────────────────────────────────────────────

async function driveGet<T>(path: string, token: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${DRIVE_API}/${path}`)
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Drive GET ${path} → ${res.status} ${await res.text()}`)
  return res.json() as Promise<T>
}

async function driveGetMedia(fileId: string, token: string): Promise<unknown> {
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Drive media ${fileId} → ${res.status}`)
  return res.json()
}

async function driveCreateFolder(name: string, parentId: string | null, token: string): Promise<string> {
  const meta = { name, mimeType: FOLDER_MIME, parents: parentId ? [parentId] : [] }
  const res = await fetch(`${DRIVE_API}/files`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': JSON_MIME },
    body:    JSON.stringify(meta),
  })
  if (!res.ok) throw new Error(`Drive create folder "${name}" → ${res.status}`)
  const file = await res.json() as DriveFile
  return file.id
}

async function driveListFiles(folderId: string, token: string): Promise<DriveFile[]> {
  const q = `'${folderId}' in parents and trashed = false`
  const data = await driveGet<{ files: DriveFile[] }>('files', token, {
    q,
    fields: 'files(id,name,mimeType,modifiedTime,size)',
    pageSize: '100',
  })
  return data.files ?? []
}

async function driveUploadJson(
  name:     string,
  data:     unknown,
  parentId: string,
  token:    string,
  existingId?: string,
): Promise<string> {
  const body    = JSON.stringify(data, null, 2)
  const meta    = JSON.stringify({ name, mimeType: JSON_MIME, ...(existingId ? {} : { parents: [parentId] }) })
  const boundary = 'ev_boundary_' + Date.now()
  const multipart =
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${meta}` +
    `\r\n--${boundary}\r\nContent-Type: ${JSON_MIME}\r\n\r\n${body}\r\n--${boundary}--`

  const url = existingId
    ? `${UPLOAD_API}/files/${existingId}?uploadType=multipart`
    : `${UPLOAD_API}/files?uploadType=multipart`

  const res = await fetch(url, {
    method:  existingId ? 'PATCH' : 'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary="${boundary}"`,
    },
    body: multipart,
  })
  if (!res.ok) throw new Error(`Drive upload "${name}" → ${res.status}`)
  const file = await res.json() as DriveFile
  return file.id
}

// ── Adapter class ─────────────────────────────────────────────────────────

export class GDriveAdapter implements DataAdapter {
  readonly mode = 'gdrive' as const

  private clientId:      string
  private accessToken:   string | null = null
  private rootFolderId:  string | null = null
  private configFolderId:string | null = null
  private fileIds:       Partial<Record<CollectionName, string>> = {}
  private lastSync:      string | null = null
  private syncInProgress = false
  private error:         string | null = null

  constructor() {
    this.clientId      = import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID ?? ''
    this.rootFolderId  = localStorage.getItem(LS_ROOT_ID)
    this.configFolderId= localStorage.getItem(LS_CONFIG_ID)
    this.lastSync      = localStorage.getItem(LS_LAST_SYNC)
  }

  // ── Public lifecycle ────────────────────────────────────────────────────

  async connect(): Promise<void> {
    if (!this.clientId) throw new Error('VITE_GOOGLE_DRIVE_CLIENT_ID is not set')
    await loadGIS()
    this.accessToken = await requestAccessToken(this.clientId)
    await this._ensureFolderStructure()
    this.error = null
  }

  disconnect(): void {
    this.accessToken    = null
    this.rootFolderId   = null
    this.configFolderId = null
    this.fileIds        = {}
    localStorage.removeItem(LS_ROOT_ID)
    localStorage.removeItem(LS_CONFIG_ID)
    localStorage.removeItem(LS_LAST_SYNC)
  }

  // ── Data loading ────────────────────────────────────────────────────────

  async loadAll(): Promise<DataCollection> {
    if (!this.accessToken || !this.configFolderId) {
      // Not connected — return bundled defaults
      return { ...BUNDLED_DEFAULTS }
    }
    try {
      const files = await driveListFiles(this.configFolderId, this.accessToken)
      // Index fileIds for future saves
      for (const f of files) {
        const name = Object.entries(DRIVE_CONFIG_FILES).find(([, v]) => v === f.name)?.[0] as CollectionName | undefined
        if (name) this.fileIds[name] = f.id
      }

      async function read<T>(collection: CollectionName, adapter: GDriveAdapter): Promise<T[]> {
        const fid = adapter.fileIds[collection]
        if (!fid) {
          // File doesn't exist yet — upload default and return it
          const defaults = BUNDLED_DEFAULTS[collection]
          const id = await driveUploadJson(
            DRIVE_CONFIG_FILES[collection],
            defaults,
            adapter.configFolderId!,
            adapter.accessToken!,
          )
          adapter.fileIds[collection] = id
          return defaults as T[]
        }
        const data = await driveGetMedia(fid, adapter.accessToken!) as unknown
        return VALIDATORS[collection](data) ? (data as T[]) : (BUNDLED_DEFAULTS[collection] as T[])
      }

      const [developers, simulators, stories, assignments, weeklyPlan] = await Promise.all([
        read<Developer>('developers', this),
        read<Simulator>('simulators', this),
        read<Story>('stories', this),
        read<Assignment>('assignments', this),
        read<WeeklyPlan>('weeklyPlan', this),
      ])

      this.lastSync = new Date().toISOString()
      localStorage.setItem(LS_LAST_SYNC, this.lastSync)
      return { developers, simulators, stories, assignments, weeklyPlan }
    } catch (e) {
      this.error = (e as Error).message
      return { ...BUNDLED_DEFAULTS }
    }
  }

  // ── Save ────────────────────────────────────────────────────────────────

  async save(collection: CollectionName, data: DataCollection[CollectionName]): Promise<void> {
    this._requireConnected()
    if (!VALIDATORS[collection](data)) {
      throw new Error(`Schema validation failed for "${collection}"`)
    }
    // Backup first
    await this._backupFile(collection)
    // Write
    const existingId = this.fileIds[collection]
    const newId = await driveUploadJson(
      DRIVE_CONFIG_FILES[collection],
      data,
      this.configFolderId!,
      this.accessToken!,
      existingId,
    )
    this.fileIds[collection] = newId
    this.lastSync = new Date().toISOString()
    localStorage.setItem(LS_LAST_SYNC, this.lastSync)
  }

  // ── Sync (reload from Drive) ────────────────────────────────────────────

  async sync(): Promise<SyncResult> {
    this._requireConnected()
    this.syncInProgress = true
    try {
      await this.loadAll()
      this.syncInProgress = false
      return { success: true, timestamp: this.lastSync!, filesUpdated: 5 }
    } catch (e) {
      this.syncInProgress = false
      return { success: false, timestamp: new Date().toISOString(), filesUpdated: 0, error: (e as Error).message }
    }
  }

  // ── Backup all config files ─────────────────────────────────────────────

  async backup(): Promise<SyncResult> {
    this._requireConnected()
    try {
      for (const collection of Object.keys(DRIVE_CONFIG_FILES) as CollectionName[]) {
        if (this.fileIds[collection]) await this._backupFile(collection)
      }
      return { success: true, timestamp: new Date().toISOString(), filesUpdated: Object.keys(this.fileIds).length }
    } catch (e) {
      return { success: false, timestamp: new Date().toISOString(), filesUpdated: 0, error: (e as Error).message }
    }
  }

  // ── Export all as individual downloads ─────────────────────────────────

  async exportAll(): Promise<void> {
    const all = await this.loadAll()
    for (const [name, data] of Object.entries(all)) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: JSON_MIME })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `${name}.json`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  // ── Import a single JSON file ──────────────────────────────────────────

  async importFile(file: File, collection: CollectionName): Promise<void> {
    this._requireConnected()
    const text = await file.text()
    const data = JSON.parse(text) as unknown
    if (!VALIDATORS[collection](data)) {
      throw new Error(`Uploaded file failed schema validation for "${collection}"`)
    }
    await this.save(collection, data as DataCollection[CollectionName])
  }

  // ── Status ────────────────────────────────────────────────────────────

  getStatus(): AdapterStatus {
    return {
      connected:      Boolean(this.accessToken),
      lastSync:       this.lastSync,
      syncInProgress: this.syncInProgress,
      error:          this.error,
      rootFolderName: this.rootFolderId ? DRIVE_ROOT_NAME : null,
      rootFolderId:   this.rootFolderId,
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────

  private _requireConnected(): void {
    if (!this.accessToken) throw new Error('Google Drive is not connected')
    if (!this.configFolderId) throw new Error('Drive folder structure not initialized')
  }

  private async _ensureFolderStructure(): Promise<void> {
    const token = this.accessToken!

    if (!this.rootFolderId) {
      // Search for existing root folder
      const res = await driveGet<{ files: DriveFile[] }>('files', token, {
        q:      `name = '${DRIVE_ROOT_NAME}' and mimeType = '${FOLDER_MIME}' and trashed = false`,
        fields: 'files(id,name)',
      })
      if (res.files.length > 0) {
        this.rootFolderId = res.files[0].id
      } else {
        this.rootFolderId = await driveCreateFolder(DRIVE_ROOT_NAME, null, token)
      }
      localStorage.setItem(LS_ROOT_ID, this.rootFolderId)
    }

    if (!this.configFolderId) {
      const res = await driveGet<{ files: DriveFile[] }>('files', token, {
        q:      `name = '${DRIVE_CONFIG_NAME}' and '${this.rootFolderId}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`,
        fields: 'files(id,name)',
      })
      if (res.files.length > 0) {
        this.configFolderId = res.files[0].id
      } else {
        this.configFolderId = await driveCreateFolder(DRIVE_CONFIG_NAME, this.rootFolderId, token)
        // Also create other subfolders
        for (const sub of ['developers', 'evidence', 'reports', 'exports']) {
          await driveCreateFolder(sub, this.rootFolderId, token)
        }
      }
      localStorage.setItem(LS_CONFIG_ID, this.configFolderId)
    }
  }

  private async _backupFile(collection: CollectionName): Promise<void> {
    const fileId = this.fileIds[collection]
    if (!fileId) return
    try {
      const current = await driveGetMedia(fileId, this.accessToken!) as unknown
      const ts      = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const backupName = `${collection}_backup_${ts}.json`
      await driveUploadJson(backupName, current, this.rootFolderId!, this.accessToken!)
    } catch {
      // Backup failure is non-fatal; log and continue
      console.warn(`[gdriveAdapter] Backup failed for ${collection}`)
    }
  }
}
