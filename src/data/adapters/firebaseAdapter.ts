/**
 * Firebase adapter — engineering data collections, PARTNER-SCOPED.
 *
 * Path: partners/{partnerId}/engineering/{collection}/items/{docId}
 * The partnerId is the active tenant session's; firestore.rules require an
 * active membership in that Partner for every read and write.
 *
 * Seeding: an empty Partner stays empty. Bundled demo JSON is written only in
 * local development (`vite dev`) — production never invents data and never
 * ships the seed files.
 *
 * Does NOT touch IAM collections (users, memberships, audit) — see
 * src/firebase/firestore.ts and src/firebase/partners.ts.
 */

import {
  collection, doc, getDocs, writeBatch, serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../../firebase/config'
import type { DataAdapter, DataCollection, AdapterStatus, CollectionName, SyncResult } from '../types'
import { VALIDATORS } from '../types'
import { requirePartnerId } from '../../tenant/session'
import type { Developer, Simulator, Story, Assignment, WeeklyPlan } from '../../types'

const EMPTY: DataCollection = { developers: [], simulators: [], stories: [], assignments: [], weeklyPlan: [] }

/** Dev-only demo data. In production builds this branch is removed with the JSON it imports. */
async function devSeed(): Promise<DataCollection | null> {
  if (!import.meta.env.DEV) return null
  const [developers, simulators, stories, assignments, weeklyPlan] = await Promise.all([
    import('../developers.json'), import('../simulators.json'), import('../stories.json'),
    import('../assignments.json'), import('../weeklyPlan.json'),
  ])
  return {
    developers:  developers.default  as Developer[],
    simulators:  simulators.default  as Simulator[],
    stories:     stories.default     as Story[],
    assignments: assignments.default as Assignment[],
    weeklyPlan:  weeklyPlan.default  as WeeklyPlan[],
  }
}

function colRef(name: CollectionName) {
  return collection(db, 'partners', requirePartnerId(), 'engineering', name, 'items')
}

async function readCollection<T>(name: CollectionName): Promise<T[]> {
  const snap = await getDocs(colRef(name))
  if (snap.empty) return []
  return snap.docs.map(d => d.data() as T)
}

async function writeCollection(name: CollectionName, data: unknown[]): Promise<void> {
  const col  = colRef(name)
  const partnerId = requirePartnerId()
  // Clear existing docs then batch-write new ones (Firestore limit: 500/batch).
  // Scoped to this Partner's subtree, so it can never touch another Partner.
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
    batch.set(doc(col, id), { ...(item as object), partnerId, _updatedAt: serverTimestamp() })
    if (++ops >= BATCH_LIMIT) { await batch.commit(); batch = writeBatch(db); ops = 0 }
  }
  if (ops > 0) await batch.commit()
}

function stripServerFields(items: unknown[]): unknown[] {
  return items.map(item => {
    if (!item || typeof item !== 'object') return item
    const clone = { ...(item as Record<string, unknown>) }
    delete clone._updatedAt
    delete clone.partnerId
    return clone
  })
}

export class FirebaseAdapter implements DataAdapter {
  readonly mode = 'firebase' as const

  private lastSync: string | null = null
  private error: string | null = null

  async loadAll(): Promise<DataCollection> {
    if (!isFirebaseConfigured) {
      this.error = 'Firebase is not configured'
      return { ...EMPTY }
    }
    try {
      const [developers, simulators, stories, assignments, weeklyPlan] = await Promise.all([
        readCollection<Developer>('developers'),
        readCollection<Simulator>('simulators'),
        readCollection<Story>('stories'),
        readCollection<Assignment>('assignments'),
        readCollection<WeeklyPlan>('weeklyPlan'),
      ])
      let result: DataCollection = { developers, simulators, stories, assignments, weeklyPlan }

      // Dev only: seed an entirely empty Partner with demo data.
      const isEmpty = Object.values(result).every(list => list.length === 0)
      const seed = isEmpty ? await devSeed() : null
      if (seed) {
        await Promise.allSettled((Object.keys(seed) as CollectionName[]).map(k => writeCollection(k, seed[k])))
        result = seed
      }

      this.lastSync = new Date().toISOString()
      this.error = null
      return {
        developers:  stripServerFields(result.developers)  as Developer[],
        simulators:  stripServerFields(result.simulators)  as Simulator[],
        stories:     stripServerFields(result.stories)     as Story[],
        assignments: stripServerFields(result.assignments) as Assignment[],
        weeklyPlan:  stripServerFields(result.weeklyPlan)  as WeeklyPlan[],
      }
    } catch (e) {
      // Fail closed: never substitute bundled data for a Partner's real data.
      this.error = (e as Error).message
      throw e
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
      rootFolderName: isFirebaseConfigured ? 'Firestore (Partner engineering data)' : null,
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
