#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  Phase C backfill — give every pre-existing record an owning partnerId.
//
//  Run AFTER scripts/tenant-bootstrap.mjs and BEFORE deploying Phase C rules
//  (records without partnerId are unreadable under the new rules).
//
//  What it does (choices come from scripts/tenant-migration.config.json → backfill):
//    1. Flat collections: partnerId missing → defaultPartnerId;
//       partnerId in remapPartnerIds → mapped value. Original kept in legacyPartnerId.
//    2. Re-keyed collections (deterministic ids are now {partnerId}_…): COPIED
//       to the new id; the original document is left in place, untouched.
//    3. ev_data/{col}/items/* COPIED to partners/{pid}/engineering/{col}/items/*.
//
//  Safety: DRY RUN by default · copies never overwrite an existing target ·
//  a rollback manifest records every field change (with previous values) and
//  every created document · --rollback restores exactly that.
//
//  Usage:
//    export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
//    node scripts/tenant-backfill.mjs --project <id>             # dry run
//    node scripts/tenant-backfill.mjs --project <id> --apply
//    node scripts/tenant-backfill.mjs --project <id> --rollback migration-reports/<file>.json [--apply]
// ════════════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const args = process.argv.slice(2)
const flag = n => args.includes(n)
const opt = (n, d) => { const i = args.indexOf(n); return i !== -1 && args[i + 1] ? args[i + 1] : d }

const PROJECT  = opt('--project', process.env.GCLOUD_PROJECT)
const APPLY    = flag('--apply')
const ROLLBACK = opt('--rollback', null)
const CONFIG   = JSON.parse(readFileSync(resolve(opt('--config', 'scripts/tenant-migration.config.json')), 'utf8')).backfill
const PARTNER_ID = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/

if (!PROJECT) { console.error('Missing --project <firebase-project-id>'); process.exit(1) }
if (!CONFIG || !PARTNER_ID.test(CONFIG.defaultPartnerId)) { console.error('Invalid backfill config'); process.exit(1) }
for (const [from, to] of Object.entries(CONFIG.remapPartnerIds ?? {})) {
  if (!PARTNER_ID.test(to)) { console.error(`Invalid remap target "${to}" for "${from}"`); process.exit(1) }
}

initializeApp({ credential: applicationDefault(), projectId: PROJECT })
const db = getFirestore()
const now = new Date().toISOString()
const stamp = now.replace(/[:.]/g, '-')

// Collections whose records carry partnerId as a plain field.
const FIELD_COLLECTIONS = [
  'assignments', 'assignmentHistory', 'weeklyEngineeringReports', 'notifications', 'assignmentComments',
  'peopleProfiles', 'peopleJobOpenings', 'peopleCandidates', 'peopleApplications', 'peopleInterviews',
  'peopleOffers', 'peopleOnboarding', 'peopleOneOnOneReviews', 'peopleLeaveRequests', 'peoplePolicies',
  'peoplePolicyAcknowledgements', 'peopleCultureSignals', 'peopleAuditLogs',
  'peopleLetterTemplates', 'peopleGeneratedLetters', 'peopleLetterApprovals', 'peopleLetterAuditLogs',
]
// People collections also mirror partnerId into organisationId.
const MIRROR_ORG = c => c.startsWith('people')

// Collections whose deterministic ids gained a {partnerId}_ prefix.
// legacyId(docId) returns true for an id in the OLD format.
const REKEYED = {
  dailyEngineeringCheckins: id => id.split('_').length === 2,   // {dev}_{date}
  developerCapacity:        id => !id.includes('_'),            // {dev}
  peopleLetterCounters:     id => !id.includes('_'),            // {type}-{year}
}
const LEGACY_DEFAULT_TEMPLATE_ID = 'default'
const EV_DATA_COLLECTIONS = ['developers', 'simulators', 'stories', 'assignments', 'weeklyPlan']

const fieldUpdates = []   // { path, set: {...}, before: {...} }
const copies = []         // { from, to, data }
const skipped = []

function targetPartner(current) {
  if (current === undefined || current === null || current === '') return CONFIG.defaultPartnerId
  if (CONFIG.remapPartnerIds?.[current]) return CONFIG.remapPartnerIds[current]
  return current
}

async function planFieldCollection(col) {
  const snap = await db.collection(col).get()
  const counts = {}
  for (const d of snap.docs) {
    const data = d.data()
    const current = data.partnerId
    const next = targetPartner(current)
    // Re-keyed default template is handled as a copy below.
    if (col === 'peopleLetterTemplates' && d.id === LEGACY_DEFAULT_TEMPLATE_ID) continue
    const key = `${current ?? '(none)'} → ${next}`
    counts[key] = (counts[key] ?? 0) + 1
    if (current === next && (!MIRROR_ORG(col) || data.organisationId === next)) continue
    const set = { partnerId: next, legacyPartnerId: current ?? null }
    const before = { partnerId: current ?? null, legacyPartnerId: data.legacyPartnerId ?? null }
    if (MIRROR_ORG(col)) { set.organisationId = next; before.organisationId = data.organisationId ?? null }
    fieldUpdates.push({ path: d.ref.path, set, before })
  }
  return { total: snap.size, mapping: counts }
}

async function planCopy(from, to, data) {
  const exists = (await db.doc(to).get()).exists
  if (exists) { skipped.push({ from, to, reason: 'target exists — left untouched' }); return }
  copies.push({ from, to, data })
}

async function buildPlan() {
  const inventory = {}
  for (const col of FIELD_COLLECTIONS) inventory[col] = await planFieldCollection(col)

  for (const [col, isLegacy] of Object.entries(REKEYED)) {
    const snap = await db.collection(col).get()
    let n = 0
    for (const d of snap.docs) {
      if (!isLegacy(d.id)) continue
      const pid = targetPartner(d.get('partnerId'))
      const newId = `${pid}_${d.id}`
      await planCopy(d.ref.path, `${col}/${newId}`, { ...d.data(), id: newId, partnerId: pid, legacyId: d.id })
      n++
    }
    inventory[col] = { total: snap.size, rekeyed: n }
  }

  const tpl = await db.doc(`peopleLetterTemplates/${LEGACY_DEFAULT_TEMPLATE_ID}`).get()
  if (tpl.exists) {
    const pid = targetPartner(tpl.get('partnerId'))
    const newId = `${pid}_${LEGACY_DEFAULT_TEMPLATE_ID}`
    await planCopy(tpl.ref.path, `peopleLetterTemplates/${newId}`,
      { ...tpl.data(), id: newId, partnerId: pid, organisationId: pid, legacyId: LEGACY_DEFAULT_TEMPLATE_ID })
  }

  for (const col of EV_DATA_COLLECTIONS) {
    const snap = await db.collection(`ev_data/${col}/items`).get()
    for (const d of snap.docs) {
      const pid = CONFIG.defaultPartnerId
      await planCopy(d.ref.path, `partners/${pid}/engineering/${col}/items/${d.id}`, { ...d.data(), partnerId: pid })
    }
    inventory[`ev_data/${col}`] = { total: snap.size, copiedTo: `partners/${CONFIG.defaultPartnerId}/engineering/${col}` }
  }
  return inventory
}

async function commitInBatches(ops) {
  for (let i = 0; i < ops.length; i += 400) {
    const batch = db.batch()
    ops.slice(i, i + 400).forEach(fn => fn(batch))
    await batch.commit()
  }
}

async function rollback(manifestPath) {
  const m = JSON.parse(readFileSync(resolve(manifestPath), 'utf8'))
  if (m.project !== PROJECT) { console.error(`Manifest is for "${m.project}", not "${PROJECT}"`); process.exit(1) }
  console.log(`${APPLY ? 'Rolling back' : '[dry run] Would roll back'}: ${m.fieldUpdates.length} field updates, ${m.created.length} created docs`)
  if (!APPLY) { console.log('Re-run with --apply.'); return }
  await commitInBatches([
    ...m.fieldUpdates.map(u => b => b.update(db.doc(u.path), Object.fromEntries(
      Object.entries(u.before).map(([k, v]) => [k, v === null ? FieldValue.delete() : v])))),
    ...m.created.map(p => b => b.delete(db.doc(p))),
  ])
  console.log('Rollback complete.')
}

async function main() {
  if (ROLLBACK) return rollback(ROLLBACK)
  console.log(`Project: ${PROJECT}   Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`)
  console.log(`Default partner: ${CONFIG.defaultPartnerId}   Remap: ${JSON.stringify(CONFIG.remapPartnerIds ?? {})}\n`)

  const inventory = await buildPlan()
  for (const [col, v] of Object.entries(inventory)) console.log(`  ${col}: ${JSON.stringify(v)}`)
  console.log(`\nField updates: ${fieldUpdates.length}   Copies: ${copies.length}   Skipped: ${skipped.length}`)
  for (const s of skipped) console.log(`  ! ${JSON.stringify(s)}`)

  if (APPLY) {
    await commitInBatches([
      ...fieldUpdates.map(u => b => b.update(db.doc(u.path), u.set)),
      ...copies.map(c => b => b.create(db.doc(c.to), c.data)),   // create(): never overwrites
    ])
  }

  mkdirSync('migration-reports', { recursive: true })
  const report = `migration-reports/tenant-backfill-${PROJECT}-${stamp}${APPLY ? '' : '-dryrun'}.json`
  writeFileSync(report, JSON.stringify({
    project: PROJECT, applied: APPLY, at: now, config: CONFIG, inventory,
    fieldUpdates: APPLY ? fieldUpdates.map(({ path, before }) => ({ path, before })) : [],
    created: APPLY ? copies.map(c => c.to) : [],
    planned: { fieldUpdates: fieldUpdates.map(u => ({ path: u.path, set: u.set })), copies: copies.map(c => ({ from: c.from, to: c.to })) },
    skipped,
  }, null, 2))
  console.log(`\nReport${APPLY ? ' + rollback manifest' : ''}: ${report}`)
  if (!APPLY) console.log('Dry run only. Re-run with --apply to write.')
}

main().catch(e => { console.error(e); process.exit(1) })
