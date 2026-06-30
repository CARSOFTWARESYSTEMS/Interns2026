/**
 * Firebase adapter — reads/writes engineering data collections via Firestore.
 *
 * Collections: developers, simulators, stories, assignments, weeklyPlan
 * Falls back to bundled JSON when Firestore is unconfigured or read fails.
 * Does NOT touch the IAM collections (users, roles, audit) — those stay in
 * the existing src/firebase/firestore.ts layer.
 */

import {
  collection, doc, getDocs, setDoc, deleteDoc,
  writeBatch, serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../../firebase/config'
import type { DataAdapter, DataCollection, AdapterStatus, CollectionName, SyncResult } from '../types'
import { VALIDATORS } from '../types'

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

// Firestore uses a top-level "ev_data" namespace to separate engineering data
// from IAM collections.
const NS = 'ev_data'

function colRef(name: CollectionName) {
  return collection(db, NS, name, 'items')
}

async function readCollection<T>(name: CollectionName): Promise<T[]> {
  const snap = await getDocs(colRef(name))
  if (snap.empty) return []
  return snap.docs.map(d => d.data() as T)
}

async function writeCollection(name: CollectionName, data: unknown[]): Promise<void> {
  const col  = colRef(name)
  // Clear existing docs then batch-write new ones (Firestore limit: 500/batch)
  const existing = await getDocs(col)
  const BATCH_LIMIT = 400
  let batch = writeBatch(db)
  let ops = 0

  for (const d of existing.docs) {
    batch.delete(d.ref)
    if (++ops >= BATCH_LIMIT) { await batch.commit(); batch = writeBatch(db); ops = 0 }
  }
  for (const item of data) {
    const id = (item as Record<string, unknown>).id as string | undefined ?? doc(col).id
    batch.set(doc(col, id), { ...(item as object), _updatedAt: serverTimestamp() })
    if (++ops >= BATCH_LIMIT) { await batch.commit(); batch = writeBatch(db); ops = 0 }
  }
  if (ops > 0) await batch.commit()
}

function stripServerFields(items: unknown[]): unknown[] {
  return items.map(item => {
    if (!item || typeof item !== 'object') return item
    const clone = { ...(item as Record<string, unknown>) }
    delete clone._updatedAt
    return clone
  })
}

export class FirebaseAdapter implements DataAdapter {
  readonly mode = 'firebase' as const

  private lastSync: string | null = null
  private error: string | null = null

  async loadAll(): Promise<DataCollection> {
    if (!isFirebaseConfigured) {
      this.error = 'Firebase is not configured — using bundled defaults'
      return { ...BUNDLED_DEFAULTS }
    }
    try {
      const [developers, simulators, stories, assignments, weeklyPlan] = await Promise.all([
        readCollection<Developer>('developers'),
        readCollection<Simulator>('simulators'),
        readCollection<Story>('stories'),
        readCollection<Assignment>('assignments'),
        readCollection<WeeklyPlan>('weeklyPlan'),
      ])

      // If Firestore collection is empty, seed from bundled JSON
      const seeded: Partial<DataCollection> = {}
      const toSeed: Promise<void>[] = []

      if (developers.length === 0)  { toSeed.push(writeCollection('developers', BUNDLED_DEFAULTS.developers));  seeded.developers  = BUNDLED_DEFAULTS.developers  }
      if (simulators.length === 0)  { toSeed.push(writeCollection('simulators', BUNDLED_DEFAULTS.simulators));  seeded.simulators  = BUNDLED_DEFAULTS.simulators  }
      if (stories.length === 0)     { toSeed.push(writeCollection('stories', BUNDLED_DEFAULTS.stories));        seeded.stories     = BUNDLED_DEFAULTS.stories     }
      if (assignments.length === 0) { toSeed.push(writeCollection('assignments', BUNDLED_DEFAULTS.assignments));seeded.assignments = BUNDLED_DEFAULTS.assignments }
      if (weeklyPlan.length === 0)  { toSeed.push(writeCollection('weeklyPlan', BUNDLED_DEFAULTS.weeklyPlan)); seeded.weeklyPlan  = BUNDLED_DEFAULTS.weeklyPlan  }

      if (toSeed.length > 0) await Promise.allSettled(toSeed)

      this.lastSync = new Date().toISOString()
      this.error = null
      return {
        developers:  stripServerFields(seeded.developers  ?? developers)  as Developer[],
        simulators:  stripServerFields(seeded.simulators  ?? simulators)  as Simulator[],
        stories:     stripServerFields(seeded.stories     ?? stories)     as Story[],
        assignments: stripServerFields(seeded.assignments ?? assignments) as Assignment[],
        weeklyPlan:  stripServerFields(seeded.weeklyPlan  ?? weeklyPlan)  as WeeklyPlan[],
      }
    } catch (e) {
      this.error = (e as Error).message
      return { ...BUNDLED_DEFAULTS }
    }
  }

  async save(collection: CollectionName, data: DataCollection[CollectionName]): Promise<void> {
    if (!isFirebaseConfigured) throw new Error('Firebase is not configured')
    if (!VALIDATORS[collection](data)) {
      throw new Error(`Schema validation failed for "${collection}"`)
    }
    await writeCollection(collection, data)
    this.lastSync = new Date().toISOString()
  }

  async sync(): Promise<SyncResult> {
    try {
      await this.loadAll()
      return { success: true, timestamp: this.lastSync!, filesUpdated: 5 }
    } catch (e) {
      return { success: false, timestamp: new Date().toISOString(), filesUpdated: 0, error: (e as Error).message }
    }
  }

  async exportAll(): Promise<void> {
    const all = await this.loadAll()
    for (const [name, data] of Object.entries(all)) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `${name}.json`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  async importFile(file: File, col: CollectionName): Promise<void> {
    if (!isFirebaseConfigured) throw new Error('Firebase is not configured')
    const text = await file.text()
    const data = JSON.parse(text) as unknown
    if (!VALIDATORS[col](data)) {
      throw new Error(`Uploaded file failed schema validation for "${col}"`)
    }
    await writeCollection(col, data as unknown[])
  }

  getStatus(): AdapterStatus {
    return {
      connected:      isFirebaseConfigured,
      lastSync:       this.lastSync,
      syncInProgress: false,
      error:          this.error,
      rootFolderName: isFirebaseConfigured ? 'Firestore (ev_data)' : null,
      rootFolderId:   null,
    }
  }
}

// Firestore Timestamp → ISO string helper (exported for pages that need it)
export function tsToISO(ts: unknown): string {
  if (ts instanceof Timestamp) return ts.toDate().toISOString()
  if (typeof ts === 'string') return ts
  return new Date().toISOString()
}
