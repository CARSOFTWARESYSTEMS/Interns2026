#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  Tenant bootstrap + Phase A–B migration
//
//  Creates the initial Partners, their domains and settings, migrates every
//  existing global user to ONE membership in the legacy Partner, and grants
//  platformAdmins only to explicitly confirmed emails.
//
//  Safety:
//    • DRY RUN by default. Nothing is written without --apply.
//    • Create-only. Existing documents are never overwritten or deleted.
//    • Every created document is recorded in a rollback manifest;
//      --rollback <manifest> deletes exactly those documents.
//    • Reports contain emails → written to migration-reports/ (git-ignored).
//
//  Usage (Admin SDK — bypasses security rules, run from a trusted machine):
//    export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
//    node scripts/tenant-bootstrap.mjs --project <firebase-project-id>            # dry run
//    node scripts/tenant-bootstrap.mjs --project <firebase-project-id> --apply    # write
//    node scripts/tenant-bootstrap.mjs --project <id> --rollback migration-reports/<file>.json
//
//  Options:
//    --config <path>   default scripts/tenant-migration.config.json
//    --seed <path>     default src/tenant/partners.seed.json
// ════════════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// ── Args ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const flag = name => args.includes(name)
const opt = (name, def) => {
  const i = args.indexOf(name)
  return i !== -1 && args[i + 1] ? args[i + 1] : def
}

const PROJECT  = opt('--project', process.env.GCLOUD_PROJECT)
const APPLY    = flag('--apply')
const ROLLBACK = opt('--rollback', null)
const CONFIG   = JSON.parse(readFileSync(resolve(opt('--config', 'scripts/tenant-migration.config.json')), 'utf8'))
const SEED     = JSON.parse(readFileSync(resolve(opt('--seed', 'src/tenant/partners.seed.json')), 'utf8'))

// Mirrors SUPER_ADMIN_EMAILS in src/types/auth.ts and isSuperAdminEmail() in firestore.rules.
const SUPER_ADMIN_EMAILS = new Set(['carsoftwaresystems@gmail.com', 'sudarshana.karkala@gmail.com'])
const PARTNER_ROLES = ['Admin', 'Engineering Manager', 'HR Manager', 'Architect', 'QA Engineer', 'Developer', 'Viewer']
const STATUSES = ['Pending', 'Active', 'Suspended', 'Blocked']

if (!PROJECT) {
  console.error('Missing --project <firebase-project-id>')
  process.exit(1)
}

initializeApp({ credential: applicationDefault(), projectId: PROJECT })
const db = getFirestore()

const now = new Date().toISOString()
const stamp = now.replace(/[:.]/g, '-')
const ACTOR = 'tenant-bootstrap'

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Planned writes: { path, data, reason } — create-only. */
const plan = []
const skipped = []
const flags = []

async function planCreate(path, data, reason) {
  const snap = await db.doc(path).get()
  if (snap.exists) {
    skipped.push({ path, reason: 'already exists — left untouched' })
    return false
  }
  plan.push({ path, data, reason })
  return true
}

function lower(s) { return String(s ?? '').trim().toLowerCase() }

// ── Rollback ────────────────────────────────────────────────────────────────

async function rollback(manifestPath) {
  const manifest = JSON.parse(readFileSync(resolve(manifestPath), 'utf8'))
  if (manifest.project !== PROJECT) {
    console.error(`Manifest is for project "${manifest.project}", not "${PROJECT}". Aborting.`)
    process.exit(1)
  }
  const paths = manifest.created ?? []
  console.log(`${APPLY ? 'Deleting' : '[dry run] Would delete'} ${paths.length} documents created by ${manifestPath}`)
  for (const p of paths) console.log(`  - ${p}`)
  if (!APPLY) { console.log('\nRe-run with --apply to delete.'); return }
  for (let i = 0; i < paths.length; i += 400) {
    const batch = db.batch()
    paths.slice(i, i + 400).forEach(p => batch.delete(db.doc(p)))
    await batch.commit()
  }
  console.log('Rollback complete.')
}

// ── Plan ────────────────────────────────────────────────────────────────────

async function buildPlan() {
  // 1. Partners, settings, domains
  for (const p of SEED.partners) {
    await planCreate(`partners/${p.id}`, {
      ...p, createdAt: now, updatedAt: now, createdBy: ACTOR, updatedBy: ACTOR,
    }, 'seed Partner')
    await planCreate(`partnerSettings/${p.id}`, {
      partnerId: p.id, ...SEED.defaultSettings, updatedAt: now, updatedBy: ACTOR,
    }, 'seed Partner settings')
  }

  for (const d of SEED.domains) {
    const host = lower(d.hostname)
    const existing = await db.doc(`partnerDomains/${host}`).get()
    if (existing.exists && existing.data().partnerId !== d.partnerId) {
      flags.push({ type: 'DOMAIN_CONFLICT', host, existingPartnerId: existing.data().partnerId, seedPartnerId: d.partnerId })
      continue
    }
    await planCreate(`partnerDomains/${host}`, {
      ...d, hostname: host, createdAt: now, updatedAt: now,
    }, 'seed domain')
  }

  // 2. Users → memberships in the legacy Partner
  const legacyPid = CONFIG.legacyUserPartnerId
  if (!SEED.partners.some(p => p.id === legacyPid)) throw new Error(`legacyUserPartnerId "${legacyPid}" is not a seeded Partner`)
  const confirmed = new Set((CONFIG.confirmedPlatformAdminEmails ?? []).map(lower))

  const users = await db.collection('users').get()
  for (const u of users.docs) {
    const d = u.data()
    const uid = u.id
    const email = lower(d.email)
    const legacyRole = d.role ?? ''
    const legacyStatus = d.status ?? ''

    let role = PARTNER_ROLES.includes(legacyRole) ? legacyRole : 'Viewer'
    if (legacyRole === 'Platform Admin') {
      if (SUPER_ADMIN_EMAILS.has(email) || confirmed.has(email)) {
        if (!SUPER_ADMIN_EMAILS.has(email)) {
          await planCreate(`platformAdmins/${uid}`, {
            uid, email, grantedBy: ACTOR, grantedAt: now, source: 'confirmedPlatformAdminEmails',
          }, 'confirmed legacy Platform Admin')
        }
        role = 'Admin' // also an Admin of the legacy Partner; Platform Admin is global anyway
      } else {
        role = CONFIG.unconfirmedLegacyPlatformAdminRole
        flags.push({ type: 'UNCONFIRMED_LEGACY_PLATFORM_ADMIN', uid, email, mappedRole: role })
      }
    } else if (!PARTNER_ROLES.includes(legacyRole) && legacyRole) {
      flags.push({ type: 'UNKNOWN_LEGACY_ROLE', uid, email, legacyRole, mappedRole: role })
    }
    if ((CONFIG.flagElevatedLegacyRoles ?? []).includes(role)) {
      flags.push({ type: 'ELEVATED_ROLE_REVIEW', uid, email, role })
    }

    const status = CONFIG.statusMap[legacyStatus] ?? 'Pending'
    if (!STATUSES.includes(status)) throw new Error(`statusMap produced invalid status "${status}"`)

    await planCreate(`partnerMemberships/${legacyPid}_${uid}`, {
      id: `${legacyPid}_${uid}`,
      partnerId: legacyPid,
      uid,
      email,
      displayName: d.displayName ?? '',
      photoURL: d.photoURL ?? '',
      role,
      status,
      employeeId: '',
      designation: '',
      team: '',
      managerId: d.managerId ?? '',
      architectId: d.architectId ?? '',
      inviteId: '',
      invitedBy: '',
      approvedBy: ACTOR,
      createdAt: now,
      updatedAt: now,
      updatedBy: ACTOR,
      migratedFrom: { legacyRole, legacyStatus, legacyOrgId: d.orgId ?? '' },
    }, `migrate user (legacy role "${legacyRole}", status "${legacyStatus}")`)
  }

  // 3. Inventory (report only — Phase C will backfill partnerId on these)
  const inventory = {}
  for (const col of [
    'assignments', 'dailyEngineeringCheckins', 'weeklyEngineeringReports', 'notifications',
    'assignmentComments', 'peopleProfiles', 'peopleCandidates', 'peopleOffers', 'peopleLeaveRequests',
    'peopleGeneratedLetters', 'invitations',
  ]) {
    const snap = await db.collection(col).get()
    const byPartner = {}
    snap.docs.forEach(doc => {
      const key = doc.get('partnerId') ?? '(none)'
      byPartner[key] = (byPartner[key] ?? 0) + 1
    })
    inventory[col] = { total: snap.size, byPartnerId: byPartner }
    if (byPartner.itelematics) {
      flags.push({ type: 'PEOPLE_PARTNER_DECISION_NEEDED', collection: col, count: byPartner.itelematics,
        note: "Records carry partnerId 'itelematics' from a hard-coded default. Decide their owner before Phase C." })
    }
  }
  return { usersScanned: users.size, inventory }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (ROLLBACK) return rollback(ROLLBACK)

  console.log(`Project: ${PROJECT}   Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}\n`)
  const { usersScanned, inventory } = await buildPlan()

  console.log(`Planned creates: ${plan.length}`)
  for (const p of plan) console.log(`  + ${p.path}   (${p.reason})`)
  console.log(`\nSkipped (already exist): ${skipped.length}`)
  console.log(`Users scanned: ${usersScanned}`)
  console.log(`\nFlags needing review: ${flags.length}`)
  for (const f of flags) console.log(`  ! ${JSON.stringify(f)}`)
  console.log('\nInventory of legacy-scoped collections (no changes in this phase):')
  for (const [col, v] of Object.entries(inventory)) console.log(`  ${col}: ${JSON.stringify(v)}`)

  mkdirSync('migration-reports', { recursive: true })
  const report = `migration-reports/tenant-bootstrap-${PROJECT}-${stamp}${APPLY ? '' : '-dryrun'}.json`

  if (APPLY) {
    for (let i = 0; i < plan.length; i += 400) {
      const batch = db.batch()
      // create() fails if the doc appeared since planning — never overwrites.
      plan.slice(i, i + 400).forEach(p => batch.create(db.doc(p.path), p.data))
      await batch.commit()
    }
  }

  writeFileSync(report, JSON.stringify({
    project: PROJECT, applied: APPLY, at: now,
    created: APPLY ? plan.map(p => p.path) : [],
    planned: plan.map(p => ({ path: p.path, reason: p.reason })),
    skipped, flags, inventory,
  }, null, 2))

  console.log(`\nReport${APPLY ? ' + rollback manifest' : ''}: ${report}`)
  if (!APPLY) console.log('Dry run only. Re-run with --apply to write.')
}

main().catch(e => { console.error(e); process.exit(1) })
