import type { Developer, Simulator, Story, Assignment, WeeklyPlan } from '../types'

// ── Mode ──────────────────────────────────────────────────────────────────

export type DataMode = 'local' | 'gdrive' | 'firebase'

export const DATA_MODE: DataMode =
  (import.meta.env.VITE_DATA_MODE as DataMode | undefined) ?? 'local'

// ── Collections ───────────────────────────────────────────────────────────

export interface DataCollection {
  developers:  Developer[]
  simulators:  Simulator[]
  stories:     Story[]
  assignments: Assignment[]
  weeklyPlan:  WeeklyPlan[]
}

export type CollectionName = keyof DataCollection

// ── Status ────────────────────────────────────────────────────────────────

export interface AdapterStatus {
  connected:      boolean
  lastSync:       string | null
  syncInProgress: boolean
  error:          string | null
  rootFolderName: string | null
  rootFolderId:   string | null
}

export interface SyncResult {
  success:      boolean
  timestamp:    string
  filesUpdated: number
  error?:       string
}

// ── Drive folder / file metadata ──────────────────────────────────────────

export interface DriveFile {
  id:           string
  name:         string
  mimeType:     string
  modifiedTime: string
  size?:        string
}

// ── Adapter interface ─────────────────────────────────────────────────────

export interface DataAdapter {
  readonly mode: DataMode

  // Load all collections at once (called on app start)
  loadAll(): Promise<DataCollection>

  // Granular saves (optional — not all modes support writes)
  save?(collection: CollectionName, data: DataCollection[CollectionName]): Promise<void>

  // GDrive-specific lifecycle
  connect?():    Promise<void>
  disconnect?(): void
  sync?():       Promise<SyncResult>
  backup?():     Promise<SyncResult>
  exportAll?():  Promise<void>    // download all collections as zip / JSON files
  importFile?(file: File, collection: CollectionName): Promise<void>

  getStatus(): AdapterStatus
}

// ── Google Drive folder structure ─────────────────────────────────────────

export const DRIVE_ROOT_NAME   = 'Battery Trust Platform 2026'
export const DRIVE_CONFIG_NAME = 'config'

export const DRIVE_CONFIG_FILES: Record<CollectionName, string> = {
  developers:  'developers.json',
  simulators:  'simulators.json',
  stories:     'stories.json',
  assignments: 'assignments.json',
  weeklyPlan:  'weeklyPlan.json',
}

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

// ── Schema validators (lightweight — checks presence of key field) ─────────

export function validateDevelopers(data: unknown): data is Developer[] {
  return Array.isArray(data) && (data.length === 0 || typeof (data[0] as Developer).id === 'string')
}
export function validateSimulators(data: unknown): data is Simulator[] {
  return Array.isArray(data) && (data.length === 0 || typeof (data[0] as Simulator).id === 'string')
}
export function validateStories(data: unknown): data is Story[] {
  return Array.isArray(data) && (data.length === 0 || typeof (data[0] as Story).id === 'string')
}
export function validateAssignments(data: unknown): data is Assignment[] {
  return Array.isArray(data) && (data.length === 0 || typeof (data[0] as Assignment).id === 'string')
}
export function validateWeeklyPlan(data: unknown): data is WeeklyPlan[] {
  return Array.isArray(data) && (data.length === 0 || typeof (data[0] as WeeklyPlan).week === 'string')
}

export const VALIDATORS: Record<CollectionName, (d: unknown) => boolean> = {
  developers:  validateDevelopers,
  simulators:  validateSimulators,
  stories:     validateStories,
  assignments: validateAssignments,
  weeklyPlan:  validateWeeklyPlan,
}
