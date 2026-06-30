/**
 * Local adapter — reads bundled JSON files, persists overrides to localStorage.
 *
 * Read priority: localStorage override → bundled JSON.
 * Writes go to localStorage only (no server round-trip).
 */
import type { DataAdapter, DataCollection, AdapterStatus, CollectionName, SyncResult } from '../types'
import { VALIDATORS } from '../types'

// Static JSON imports (bundled at build time)
import developersRaw  from '../developers.json'
import simulatorsRaw  from '../simulators.json'
import storiesRaw     from '../stories.json'
import assignmentsRaw from '../assignments.json'
import weeklyPlanRaw  from '../weeklyPlan.json'

import type { Developer, Simulator, Story, Assignment, WeeklyPlan } from '../../types'

const BUNDLED: DataCollection = {
  developers:  developersRaw  as Developer[],
  simulators:  simulatorsRaw  as Simulator[],
  stories:     storiesRaw     as Story[],
  assignments: assignmentsRaw as Assignment[],
  weeklyPlan:  weeklyPlanRaw  as WeeklyPlan[],
}

const LS_PREFIX = 'ev_local_'

function lsKey(name: CollectionName): string {
  return `${LS_PREFIX}${name}`
}

function readFromLS<T>(name: CollectionName): T[] | null {
  try {
    const raw = localStorage.getItem(lsKey(name))
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    return VALIDATORS[name](parsed) ? (parsed as T[]) : null
  } catch {
    return null
  }
}

function writeToLS(name: CollectionName, data: unknown[]): void {
  try {
    localStorage.setItem(lsKey(name), JSON.stringify(data))
  } catch (e) {
    console.warn(`[localAdapter] localStorage write failed for ${name}:`, e)
  }
}

export class LocalAdapter implements DataAdapter {
  readonly mode = 'local' as const

  async loadAll(): Promise<DataCollection> {
    return {
      developers:  readFromLS<Developer>('developers')  ?? BUNDLED.developers,
      simulators:  readFromLS<Simulator>('simulators')  ?? BUNDLED.simulators,
      stories:     readFromLS<Story>('stories')         ?? BUNDLED.stories,
      assignments: readFromLS<Assignment>('assignments') ?? BUNDLED.assignments,
      weeklyPlan:  readFromLS<WeeklyPlan>('weeklyPlan') ?? BUNDLED.weeklyPlan,
    }
  }

  async save(collection: CollectionName, data: DataCollection[CollectionName]): Promise<void> {
    if (!VALIDATORS[collection](data)) {
      throw new Error(`[localAdapter] Schema validation failed for "${collection}"`)
    }
    writeToLS(collection, data)
  }

  /** Export all current data as downloadable JSON files (one per collection). */
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

  /** Import a JSON file and override a collection in localStorage. */
  async importFile(file: File, collection: CollectionName): Promise<void> {
    const text = await file.text()
    const data = JSON.parse(text) as unknown
    if (!VALIDATORS[collection](data)) {
      throw new Error(`Uploaded file failed schema validation for "${collection}"`)
    }
    writeToLS(collection, data as DataCollection[CollectionName])
  }

  /** Reset a collection to the bundled JSON default. */
  resetCollection(collection: CollectionName): void {
    localStorage.removeItem(lsKey(collection))
  }

  /** Reset all collections to bundled defaults. */
  resetAll(): void {
    const names: CollectionName[] = ['developers', 'simulators', 'stories', 'assignments', 'weeklyPlan']
    names.forEach(n => localStorage.removeItem(lsKey(n)))
  }

  getStatus(): AdapterStatus {
    return {
      connected:      true,
      lastSync:       null,
      syncInProgress: false,
      error:          null,
      rootFolderName: 'Local (bundled JSON + localStorage)',
      rootFolderId:   null,
    }
  }
}
