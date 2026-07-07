#!/usr/bin/env node
// Live Firestore Rules Emulator test for the Offer/Joining Letter Generator
// (PEOPLE-002) collections. Unlike scripts/verify-people-letter-generator.mjs
// (which only greps source files), this actually spins up the Firestore
// emulator, loads the real firestore.rules, and issues real reads/writes as
// tokens with each platform role to prove access control is enforced data-
// side, not just in the client UI.
//
// Requires: firebase emulator (Java) — already a devDependency via
// @firebase/rules-unit-testing. Run with:
//   node scripts/test-people-letter-rules.mjs

import { readFileSync } from 'node:fs'
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing'
import { setDoc, getDoc, doc } from 'firebase/firestore'

const PROJECT_ID = 'people-letter-rules-test'
const RULES = readFileSync('firestore.rules', 'utf8')

let passes = 0
let failures = 0

async function check(label, fn) {
  try {
    await fn()
    console.log(`  PASS  ${label}`)
    passes++
  } catch (e) {
    console.log(`  FAIL  ${label} (${e.message.split('\n')[0]})`)
    failures++
  }
}

const ROLES = ['Platform Admin', 'Engineering Manager', 'HR Manager', 'Architect', 'QA Engineer', 'Developer', 'Viewer']

const NEW_COLLECTIONS = [
  'peopleLetterTemplates', 'peopleGeneratedLetters', 'peopleLetterApprovals',
  'peopleLetterCounters', 'peopleLetterAuditLogs',
]

async function main() {
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: RULES, host: '127.0.0.1', port: 8080 },
  })

  // Seed a `users/{uid}` doc per role so callerRole() resolves correctly.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    for (const role of ROLES) {
      await setDoc(doc(db, 'users', uidFor(role)), { role })
    }
  })

  console.log('People Letter Generator — Firestore Rules Emulator Verification\n')

  console.log('Access control — every role × every new collection (read)')
  for (const role of ROLES) {
    const asRole = testEnv.authenticatedContext(uidFor(role), { email: `${role.replace(/\s/g, '.').toLowerCase()}@example.com` }).firestore()
    const allowed = role === 'Platform Admin' || role === 'HR Manager'
    for (const col of NEW_COLLECTIONS) {
      const ref = doc(asRole, col, 'probe-doc')
      await check(`${role} → read ${col}: expect ${allowed ? 'ALLOW' : 'DENY'}`, async () => {
        if (allowed) await assertSucceeds(getDoc(ref))
        else await assertFails(getDoc(ref))
      })
    }
  }

  console.log('\nAccess control — every role × every new collection (write)')
  for (const role of ROLES) {
    const asRole = testEnv.authenticatedContext(uidFor(role), { email: `${role.replace(/\s/g, '.').toLowerCase()}@example.com` }).firestore()
    const allowed = role === 'Platform Admin' || role === 'HR Manager'
    for (const col of NEW_COLLECTIONS) {
      const ref = doc(asRole, col, `probe-write-${role.replace(/\s/g, '')}`)
      await check(`${role} → write ${col}: expect ${allowed ? 'ALLOW' : 'DENY'}`, async () => {
        const payload = { id: 'probe', partnerId: 'itelematics', organisationId: 'ev-engineer', createdAt: '', updatedAt: '', createdBy: uidFor(role), status: 'Draft' }
        if (allowed) await assertSucceeds(setDoc(ref, payload))
        else await assertFails(setDoc(ref, payload))
      })
    }
  }

  console.log('\nUnauthenticated access')
  const anon = testEnv.unauthenticatedContext().firestore()
  for (const col of NEW_COLLECTIONS) {
    await check(`Unauthenticated → read ${col}: expect DENY`, async () => {
      await assertFails(getDoc(doc(anon, col, 'probe-doc')))
    })
  }

  console.log('\nImmutability — approvals & audit logs cannot be updated or deleted')
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'peopleLetterApprovals', 'approval-1'), { id: 'approval-1', letterId: 'letter-1', decision: 'Approved' })
    await setDoc(doc(db, 'peopleLetterAuditLogs', 'log-1'), { id: 'log-1', action: 'letter_drafted' })
  })
  const hr = testEnv.authenticatedContext(uidFor('HR Manager'), { email: 'hr.manager@example.com' }).firestore()
  await check('HR Manager cannot update an existing approval record (immutable)', async () => {
    const { updateDoc } = await import('firebase/firestore')
    await assertFails(updateDoc(doc(hr, 'peopleLetterApprovals', 'approval-1'), { decision: 'Rejected' }))
  })
  await check('HR Manager cannot update an existing audit log (immutable)', async () => {
    const { updateDoc } = await import('firebase/firestore')
    await assertFails(updateDoc(doc(hr, 'peopleLetterAuditLogs', 'log-1'), { action: 'tampered' }))
  })

  console.log('\nRegression — existing PEOPLE-001 collections still enforce their original rules')
  const engManager = testEnv.authenticatedContext(uidFor('Engineering Manager'), { email: 'engineering.manager@example.com' }).firestore()
  await check('Engineering Manager CAN still write peopleOffers (unchanged by this story)', async () => {
    await assertSucceeds(setDoc(doc(engManager, 'peopleOffers', 'offer-probe'), { id: 'offer-probe', offerStatus: 'Draft' }))
  })
  const dev = testEnv.authenticatedContext(uidFor('Developer'), { email: 'developer@example.com' }).firestore()
  await check('Developer still CANNOT write peopleOffers (unchanged by this story)', async () => {
    await assertFails(setDoc(doc(dev, 'peopleOffers', 'offer-probe-2'), { id: 'offer-probe-2', offerStatus: 'Draft' }))
  })

  await testEnv.cleanup()

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`${passes} passed, ${failures} failed`)
  if (failures > 0) {
    console.log('\nRules Verification FAILED')
    process.exitCode = 1
  } else {
    console.log('\nRules Verification PASS')
  }
}

function uidFor(role) {
  return `uid-${role.replace(/\s/g, '-').toLowerCase()}`
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
