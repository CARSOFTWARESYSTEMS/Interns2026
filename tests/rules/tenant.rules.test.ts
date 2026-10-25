// ════════════════════════════════════════════════════════════════════════════
//  Firestore security-rules tests for multi-tenant Partner isolation.
//  Runs the REAL firestore.rules in the emulator:
//      npm run test:rules
//  (needs Java + the Firestore emulator: `npx firebase setup:emulators:firestore`)
// ════════════════════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  initializeTestEnvironment, assertSucceeds, assertFails, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs, writeBatch, addDoc,
  type Firestore,
} from 'firebase/firestore'

let env: RulesTestEnvironment

const DAY = 24 * 60 * 60 * 1000
const TOKEN = 'T'.repeat(43)            // valid-shaped invitation token
const TOKEN_EXPIRED = 'E'.repeat(43)
const TOKEN_ADMIN = 'A'.repeat(43)

// ── Principals ──────────────────────────────────────────────────────────────
const USERS = {
  superAdmin: { uid: 'super',  email: 'carsoftwaresystems@gmail.com' },
  pa:         { uid: 'pa',     email: 'pa@example.com' },          // platformAdmins/pa
  gAdmin:     { uid: 'gAdmin', email: 'g-admin@example.com' },     // gamyaa Admin
  uAdmin:     { uid: 'uAdmin', email: 'u-admin@example.com' },     // uflight Admin
  multi:      { uid: 'multi',  email: 'multi@example.com' },       // gamyaa Admin, uflight Developer, ev Viewer
  gDev:       { uid: 'gDev',   email: 'g-dev@example.com' },       // gamyaa Developer
  gMgr:       { uid: 'gMgr',   email: 'g-mgr@example.com' },       // gamyaa Engineering Manager
  gPending:   { uid: 'gPend',  email: 'g-pending@example.com' },   // gamyaa Pending Admin
  gBlocked:   { uid: 'gBlock', email: 'g-blocked@example.com' },   // gamyaa Blocked Developer
  evDev:      { uid: 'evDev',  email: 'ev-dev@example.com' },      // ev-engineer Developer (legacy partner)
  newbie:     { uid: 'newbie', email: 'newbie@example.com' },      // invited to gamyaa, no membership
  stranger:   { uid: 'strange', email: 'stranger@example.com' },   // signed in, no memberships
}
type Who = keyof typeof USERS

function db(who: Who | null): Firestore {
  if (!who) return env.unauthenticatedContext().firestore() as unknown as Firestore
  const u = USERS[who]
  return env.authenticatedContext(u.uid, { email: u.email, email_verified: true }).firestore() as unknown as Firestore
}

function membership(partnerId: string, who: Who, role: string, status = 'Active') {
  const u = USERS[who]
  return {
    id: `${partnerId}_${u.uid}`, partnerId, uid: u.uid, email: u.email, displayName: who, photoURL: '',
    role, status, employeeId: '', designation: '', team: '', managerId: '', architectId: '',
    inviteId: '', invitedBy: '', approvedBy: '', createdAt: '', updatedAt: '', updatedBy: '',
  }
}

function partner(id: string) {
  return { id, slug: id, status: 'Active', displayName: id, defaultDomain: `login.${id}.test` }
}

// ── Fixtures ────────────────────────────────────────────────────────────────

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-tenant-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
})

afterAll(async () => { await env?.cleanup() })

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async ctx => {
    const f = ctx.firestore() as unknown as Firestore
    for (const id of ['gamyaa', 'uflight', 'itelematics', 'ev-engineer']) {
      await setDoc(doc(f, 'partners', id), partner(id))
      await setDoc(doc(f, 'partnerSettings', id), { partnerId: id, authPolicy: { allowAccessRequests: id !== 'itelematics' }, modules: {}, operational: {} })
      await setDoc(doc(f, 'partnerDomains', `login.${id}.test`), { hostname: `login.${id}.test`, partnerId: id, isPrimary: true, status: 'Active' })
    }
    await setDoc(doc(f, 'platformAdmins', USERS.pa.uid), { uid: USERS.pa.uid })

    const ms: Array<[string, Who, string, string?]> = [
      ['gamyaa', 'gAdmin', 'Admin'],
      ['uflight', 'uAdmin', 'Admin'],
      ['gamyaa', 'multi', 'Admin'],
      ['uflight', 'multi', 'Developer'],
      ['ev-engineer', 'multi', 'Viewer'],
      ['gamyaa', 'gDev', 'Developer'],
      ['gamyaa', 'gMgr', 'Engineering Manager'],
      ['gamyaa', 'gPending', 'Admin', 'Pending'],
      ['gamyaa', 'gBlocked', 'Developer', 'Blocked'],
      ['ev-engineer', 'evDev', 'Developer'],
    ]
    for (const [pid, who, role, status] of ms) {
      await setDoc(doc(f, 'partnerMemberships', `${pid}_${USERS[who].uid}`), membership(pid, who, role, status))
    }

    for (const who of Object.keys(USERS) as Who[]) {
      await setDoc(doc(f, 'users', USERS[who].uid), { uid: USERS[who].uid, email: USERS[who].email, displayName: who })
    }

    const inv = (token: string, over: Record<string, unknown> = {}) => ({
      id: token, email: USERS.newbie.email, name: 'Newbie', role: 'Developer', partnerId: 'gamyaa',
      invitedBy: USERS.gAdmin.uid, invitedByEmail: USERS.gAdmin.email, status: 'Pending',
      createdAt: new Date().toISOString(), expiresAt: '', expiresAtMs: Date.now() + 7 * DAY, ...over,
    })
    await setDoc(doc(f, 'invitations', TOKEN), inv(TOKEN))
    await setDoc(doc(f, 'invitations', TOKEN_EXPIRED), inv(TOKEN_EXPIRED, { expiresAtMs: Date.now() - DAY }))
    await setDoc(doc(f, 'invitations', TOKEN_ADMIN), inv(TOKEN_ADMIN, { role: 'Admin', invitedBy: USERS.pa.uid }))

    // Partner-owned data (Phase C)
    await setDoc(doc(f, 'assignments', 'a1'), { partnerId: 'ev-engineer', developerId: USERS.evDev.uid, title: 'EV work' })
    await setDoc(doc(f, 'assignments', 'a2'), { partnerId: 'gamyaa', developerId: USERS.gDev.uid, title: 'GAMYAA work' })
    await setDoc(doc(f, 'assignments', 'a3'), { developerId: USERS.evDev.uid, title: 'not backfilled' })   // no partnerId
    await setDoc(doc(f, 'partners/uflight/engineering/stories/items/s1'), { id: 's1', partnerId: 'uflight', title: 'UFlight story' })
    await setDoc(doc(f, 'partners/ev-engineer/engineering/stories/items/s2'), { id: 's2', partnerId: 'ev-engineer', title: 'EV story' })
    await setDoc(doc(f, 'peopleCandidates', 'c1'), { partnerId: 'uflight', name: 'UFlight candidate', createdBy: USERS.uAdmin.uid })
    await setDoc(doc(f, 'ev_data/stories/items/old'), { id: 'old', title: 'pre-Phase-C' })
  })
})

// ════════════════════════════════════════════════════════════════════════════

describe('Partner registry & domains', () => {
  it('branding and domain mappings are readable before sign-in', async () => {
    await assertSucceeds(getDoc(doc(db(null), 'partners/gamyaa')))
    await assertSucceeds(getDoc(doc(db(null), 'partnerDomains/login.gamyaa.test')))
  })

  it('Partners cannot be enumerated except by Platform Admin', async () => {
    await assertFails(getDocs(collection(db(null), 'partners')))
    await assertFails(getDocs(collection(db('gAdmin'), 'partners')))
    await assertSucceeds(getDocs(collection(db('pa'), 'partners')))
  })

  it('unknown hostname has no mapping (client fails closed)', async () => {
    const snap = await assertSucceeds(getDoc(doc(db(null), 'partnerDomains/login.example.com')))
    if (snap.exists()) throw new Error('unexpected mapping')
  })

  it('only Platform Admin can add/change domains or Partners', async () => {
    const d = { hostname: 'evil.gamyaa.test', partnerId: 'gamyaa', isPrimary: false, status: 'Active' }
    await assertFails(setDoc(doc(db('gAdmin'), 'partnerDomains/evil.gamyaa.test'), d))
    await assertSucceeds(setDoc(doc(db('pa'), 'partnerDomains/evil.gamyaa.test'), d))
    await assertFails(setDoc(doc(db('gAdmin'), 'partners/newco'), partner('newco')))
    await assertFails(updateDoc(doc(db('gAdmin'), 'partners/gamyaa'), { status: 'Inactive' }))
    await assertSucceeds(setDoc(doc(db('superAdmin'), 'partners/newco'), partner('newco')))
  })

  it('Partner settings are readable by members only', async () => {
    await assertSucceeds(getDoc(doc(db('gDev'), 'partnerSettings/gamyaa')))
    await assertFails(getDoc(doc(db('gDev'), 'partnerSettings/uflight')))
    await assertFails(getDoc(doc(db('gPending'), 'partnerSettings/gamyaa')))
    await assertFails(setDoc(doc(db('gAdmin'), 'partnerSettings/gamyaa'), { authPolicy: { allowAccessRequests: false } }))
  })
})

describe('Admin escalation', () => {
  it('a user cannot set their own global role (old self-promotion hole)', async () => {
    await assertFails(updateDoc(doc(db('gDev'), 'users', USERS.gDev.uid), { role: 'Platform Admin' }))
    await assertFails(updateDoc(doc(db('gDev'), 'users', USERS.gDev.uid), { status: 'Active' }))
    await assertSucceeds(updateDoc(doc(db('gDev'), 'users', USERS.gDev.uid), { bio: 'hello' }))
  })

  it('a new profile cannot be created with a role', async () => {
    await env.withSecurityRulesDisabled(async ctx => { await deleteDoc(doc(ctx.firestore() as unknown as Firestore, 'users', USERS.stranger.uid)) })
    await assertFails(setDoc(doc(db('stranger'), 'users', USERS.stranger.uid),
      { uid: USERS.stranger.uid, email: USERS.stranger.email, role: 'Platform Admin' }))
    await assertSucceeds(setDoc(doc(db('stranger'), 'users', USERS.stranger.uid),
      { uid: USERS.stranger.uid, email: USERS.stranger.email }))
  })

  it('Tenant Admin cannot promote self (or anyone) to Platform Admin', async () => {
    await assertFails(setDoc(doc(db('gAdmin'), 'platformAdmins', USERS.gAdmin.uid), { uid: USERS.gAdmin.uid }))
    await assertFails(setDoc(doc(db('gAdmin'), 'platformAdmins', USERS.gDev.uid), { uid: USERS.gDev.uid }))
    await assertSucceeds(setDoc(doc(db('pa'), 'platformAdmins', USERS.gDev.uid), { uid: USERS.gDev.uid }))
  })

  it('Tenant Admin cannot edit their own membership', async () => {
    await assertFails(updateDoc(doc(db('gAdmin'), 'partnerMemberships', 'gamyaa_gAdmin'), { status: 'Active', role: 'Admin', team: 'x' }))
  })

  it('Tenant Admin cannot grant Admin or touch another Admin', async () => {
    await assertFails(updateDoc(doc(db('gAdmin'), 'partnerMemberships', 'gamyaa_gDev'), { role: 'Admin' }))
    await assertFails(updateDoc(doc(db('gAdmin'), 'partnerMemberships', 'gamyaa_multi'), { status: 'Blocked' }))
    await assertSucceeds(updateDoc(doc(db('gAdmin'), 'partnerMemberships', 'gamyaa_gDev'), { role: 'QA Engineer', updatedAt: 'now', updatedBy: 'gAdmin' }))
  })

  it('Platform Admin can assign a Partner Admin', async () => {
    await assertSucceeds(updateDoc(doc(db('pa'), 'partnerMemberships', 'gamyaa_gDev'), { role: 'Admin' }))
  })

  it('a Pending Admin membership grants nothing', async () => {
    await assertFails(getDocs(query(collection(db('gPending'), 'partnerMemberships'), where('partnerId', '==', 'gamyaa'))))
    await assertFails(updateDoc(doc(db('gPending'), 'partnerMemberships', 'gamyaa_gPend'), { status: 'Active' }))
  })
})

describe('Horizontal tenant escalation', () => {
  it('GAMYAA Admin cannot list or read UFlight memberships', async () => {
    await assertSucceeds(getDocs(query(collection(db('gAdmin'), 'partnerMemberships'), where('partnerId', '==', 'gamyaa'))))
    await assertFails(getDocs(query(collection(db('gAdmin'), 'partnerMemberships'), where('partnerId', '==', 'uflight'))))
    await assertFails(getDoc(doc(db('gAdmin'), 'partnerMemberships', 'uflight_uAdmin')))
    await assertFails(getDocs(collection(db('gAdmin'), 'partnerMemberships')))   // unfiltered
  })

  it('GAMYAA Admin cannot modify UFlight memberships', async () => {
    await assertFails(updateDoc(doc(db('gAdmin'), 'partnerMemberships', 'uflight_multi'), { role: 'Viewer' }))
    await assertFails(deleteDoc(doc(db('gAdmin'), 'partnerMemberships', 'uflight_multi')))
  })

  it('Partner Admin cannot read global user profiles (no cross-Partner affiliation leak)', async () => {
    await assertFails(getDocs(collection(db('gAdmin'), 'users')))
    await assertFails(getDoc(doc(db('gAdmin'), 'users', USERS.gDev.uid)))
    await assertSucceeds(getDocs(collection(db('pa'), 'users')))
  })

  it('same user, different Partner: admin rights do not carry across', async () => {
    // multi is Admin of GAMYAA but only Developer of UFlight
    await assertSucceeds(getDocs(query(collection(db('multi'), 'partnerMemberships'), where('partnerId', '==', 'gamyaa'))))
    await assertFails(getDocs(query(collection(db('multi'), 'partnerMemberships'), where('partnerId', '==', 'uflight'))))
  })

  it('GAMYAA Admin requesting a UFlight/EV record by id gets nothing (§24 /project/123)', async () => {
    await assertFails(getDoc(doc(db('gAdmin'), 'assignments/a1')))
    await assertSucceeds(getDoc(doc(db('gAdmin'), 'assignments/a2')))
    await assertSucceeds(getDoc(doc(db('gDev'), 'assignments/a2')))
    await assertSucceeds(getDoc(doc(db('evDev'), 'assignments/a1')))
    await assertFails(getDoc(doc(db('stranger'), 'assignments/a1')))
  })

  it('Platform Admin has cross-Partner authority', async () => {
    await assertSucceeds(getDocs(query(collection(db('pa'), 'partnerMemberships'), where('partnerId', '==', 'uflight'))))
    await assertSucceeds(getDoc(doc(db('pa'), 'assignments/a1')))
  })
})

describe('API manipulation — forged partnerId / role', () => {
  const invite = (pid: string, role: string, by: Who) => ({
    id: 'X'.repeat(43), email: 'someone@example.com', name: 'S', role, partnerId: pid,
    invitedBy: USERS[by].uid, invitedByEmail: USERS[by].email, status: 'Pending',
    createdAt: '', expiresAt: '', expiresAtMs: Date.now() + DAY,
  })

  it('cannot create an invitation for another Partner by sending its partnerId', async () => {
    await assertFails(setDoc(doc(db('gAdmin'), 'invitations', 'X'.repeat(43)), invite('uflight', 'Developer', 'gAdmin')))
    await assertSucceeds(setDoc(doc(db('gAdmin'), 'invitations', 'X'.repeat(43)), invite('gamyaa', 'Developer', 'gAdmin')))
  })

  it('cannot invite with Admin or Platform Admin role unless Platform Admin', async () => {
    await assertFails(setDoc(doc(db('gAdmin'), 'invitations', 'X'.repeat(43)), invite('gamyaa', 'Admin', 'gAdmin')))
    await assertFails(setDoc(doc(db('gMgr'), 'invitations', 'X'.repeat(43)), invite('gamyaa', 'Admin', 'gMgr')))
    await assertFails(setDoc(doc(db('pa'), 'invitations', 'X'.repeat(43)), invite('gamyaa', 'Platform Admin', 'pa')))
    await assertSucceeds(setDoc(doc(db('pa'), 'invitations', 'X'.repeat(43)), invite('gamyaa', 'Admin', 'pa')))
  })

  it('Developer and Viewer cannot invite', async () => {
    await assertFails(setDoc(doc(db('gDev'), 'invitations', 'X'.repeat(43)), invite('gamyaa', 'Developer', 'gDev')))
  })

  it('cannot forge audit entries for another user or another Partner', async () => {
    const base = { action: 'login', resource: 'auth', details: '', timestamp: '' }
    await assertFails(addDoc(collection(db('gAdmin'), 'auditLogs'), { ...base, uid: USERS.gDev.uid }))
    await assertFails(addDoc(collection(db('gAdmin'), 'auditLogs'), { ...base, uid: USERS.gAdmin.uid, partnerId: 'uflight' }))
    await assertSucceeds(addDoc(collection(db('gAdmin'), 'auditLogs'), { ...base, uid: USERS.gAdmin.uid, partnerId: 'gamyaa' }))
  })
})

describe('Invitations', () => {
  async function redeem(token: string, as: Who, pid: string, role: string) {
    const f = db(as)
    const u = USERS[as]
    const b = writeBatch(f)
    b.update(doc(f, 'invitations', token), { status: 'Accepted', acceptedBy: u.uid, acceptedAt: 'now' })
    b.set(doc(f, 'partnerMemberships', `${pid}_${u.uid}`), {
      ...membership(pid, as, role), inviteId: token, invitedBy: USERS.gAdmin.uid, approvedBy: USERS.gAdmin.uid,
    })
    return b.commit()
  }

  it('invitee can read their own invitation; others cannot', async () => {
    await assertSucceeds(getDoc(doc(db('newbie'), 'invitations', TOKEN)))
    await assertFails(getDoc(doc(db('stranger'), 'invitations', TOKEN)))
    await assertFails(getDoc(doc(db('uAdmin'), 'invitations', TOKEN)))
  })

  it('a GAMYAA invitation creates a GAMYAA membership with the invited role', async () => {
    await assertSucceeds(redeem(TOKEN, 'newbie', 'gamyaa', 'Developer'))
  })

  it('a GAMYAA invitation can never create a UFlight membership', async () => {
    await assertFails(redeem(TOKEN, 'newbie', 'uflight', 'Developer'))
  })

  it('cannot upgrade the invited role while redeeming', async () => {
    await assertFails(redeem(TOKEN, 'newbie', 'gamyaa', 'Admin'))
  })

  it('cannot redeem someone else\'s invitation', async () => {
    await assertFails(redeem(TOKEN, 'stranger', 'gamyaa', 'Developer'))
  })

  it('cannot redeem an expired invitation', async () => {
    await assertFails(redeem(TOKEN_EXPIRED, 'newbie', 'gamyaa', 'Developer'))
  })

  it('cannot mark an invitation accepted without creating the membership', async () => {
    await assertFails(updateDoc(doc(db('newbie'), 'invitations', TOKEN), { status: 'Accepted', acceptedBy: USERS.newbie.uid, acceptedAt: 'x' }))
  })

  it('a Blocked member cannot use an invitation to reinstate themselves', async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await updateDoc(doc(ctx.firestore() as unknown as Firestore, 'invitations', TOKEN), { email: USERS.gBlocked.email })
    })
    const f = db('gBlocked')
    const b = writeBatch(f)
    b.update(doc(f, 'invitations', TOKEN), { status: 'Accepted', acceptedBy: USERS.gBlocked.uid, acceptedAt: 'now' })
    b.update(doc(f, 'partnerMemberships', 'gamyaa_gBlock'), { status: 'Active', inviteId: TOKEN })
    await assertFails(b.commit())
  })

  it('Admin invitations can only be cancelled by Platform Admin', async () => {
    await assertFails(updateDoc(doc(db('gAdmin'), 'invitations', TOKEN_ADMIN), { status: 'Cancelled' }))
    await assertSucceeds(updateDoc(doc(db('gAdmin'), 'invitations', TOKEN), { status: 'Cancelled' }))
  })

  it('invitation lists are Partner-scoped', async () => {
    await assertSucceeds(getDocs(query(collection(db('gMgr'), 'invitations'), where('partnerId', '==', 'gamyaa'))))
    await assertFails(getDocs(query(collection(db('uAdmin'), 'invitations'), where('partnerId', '==', 'gamyaa'))))
    await assertFails(getDocs(collection(db('gAdmin'), 'invitations')))
  })
})

describe('Self-service access requests', () => {
  const req = (pid: string, over: Record<string, unknown> = {}) =>
    ({ ...membership(pid, 'stranger', 'Viewer', 'Pending'), ...over })

  it('may request Pending Viewer access', async () => {
    await assertSucceeds(setDoc(doc(db('stranger'), 'partnerMemberships', 'gamyaa_strange'), req('gamyaa')))
  })

  it('cannot self-grant Active status or a higher role', async () => {
    await assertFails(setDoc(doc(db('stranger'), 'partnerMemberships', 'gamyaa_strange'), req('gamyaa', { status: 'Active' })))
    await assertFails(setDoc(doc(db('stranger'), 'partnerMemberships', 'gamyaa_strange'), req('gamyaa', { role: 'Admin' })))
    await assertFails(setDoc(doc(db('stranger'), 'partnerMemberships', 'gamyaa_strange'), req('gamyaa', { designation: 'CTO' })))
  })

  it('cannot create a membership for someone else', async () => {
    await assertFails(setDoc(doc(db('stranger'), 'partnerMemberships', 'gamyaa_newbie'), { ...membership('gamyaa', 'newbie', 'Viewer', 'Pending') }))
  })

  it('respects a Partner that disallows access requests', async () => {
    await assertFails(setDoc(doc(db('stranger'), 'partnerMemberships', 'itelematics_strange'), req('itelematics')))
  })

  it('can read own (even missing) membership but not other users\'', async () => {
    await assertSucceeds(getDoc(doc(db('stranger'), 'partnerMemberships', 'gamyaa_strange')))
    await assertFails(getDoc(doc(db('stranger'), 'partnerMemberships', 'gamyaa_gDev')))
  })
})

describe('Phase C — Partner-owned data', () => {
  it('records without a partnerId are unreadable (fail closed until backfilled)', async () => {
    await assertFails(getDoc(doc(db('evDev'), 'assignments/a3')))
    await assertSucceeds(getDoc(doc(db('pa'), 'assignments/a1')))
  })

  it('queries must be filtered to a Partner the caller belongs to', async () => {
    await assertSucceeds(getDocs(query(collection(db('gAdmin'), 'assignments'), where('partnerId', '==', 'gamyaa'))))
    await assertFails(getDocs(query(collection(db('gAdmin'), 'assignments'), where('partnerId', '==', 'ev-engineer'))))
    await assertFails(getDocs(collection(db('gAdmin'), 'assignments')))
  })

  it('a forged partnerId on create is rejected', async () => {
    await assertFails(setDoc(doc(db('gAdmin'), 'assignments/new1'), { partnerId: 'uflight', developerId: 'x' }))
    await assertSucceeds(setDoc(doc(db('gAdmin'), 'assignments/new1'), { partnerId: 'gamyaa', developerId: 'x' }))
  })

  it('an update can never move a record to another Partner', async () => {
    await assertFails(updateDoc(doc(db('gAdmin'), 'assignments/a2'), { partnerId: 'uflight' }))
    await assertFails(updateDoc(doc(db('pa'), 'assignments/a2'), { partnerId: 'uflight' }))
    await assertSucceeds(updateDoc(doc(db('gAdmin'), 'assignments/a2'), { title: 'renamed' }))
  })

  it('role is evaluated in the RECORD\'s Partner (Admin in GAMYAA, Developer in UFlight)', async () => {
    await assertSucceeds(setDoc(doc(db('multi'), 'assignments/m1'), { partnerId: 'gamyaa', developerId: 'x' }))
    await assertFails(setDoc(doc(db('multi'), 'assignments/m2'), { partnerId: 'uflight', developerId: 'x' }))
  })

  it('engineering data (stories, simulators, evidence, reports) is isolated per Partner', async () => {
    await assertFails(getDoc(doc(db('gDev'), 'partners/uflight/engineering/stories/items/s1')))
    await assertFails(getDocs(collection(db('gAdmin'), 'partners/uflight/engineering/stories/items')))
    await assertSucceeds(getDoc(doc(db('multi'), 'partners/uflight/engineering/stories/items/s1')))
    await assertSucceeds(getDocs(collection(db('evDev'), 'partners/ev-engineer/engineering/stories/items')))
  })

  it('engineering writes need a writing role in that Partner and a matching partnerId', async () => {
    const story = (pid: string) => ({ id: 'n', partnerId: pid, title: 't' })
    await assertSucceeds(setDoc(doc(db('gAdmin'), 'partners/gamyaa/engineering/stories/items/n'), story('gamyaa')))
    await assertFails(setDoc(doc(db('gAdmin'), 'partners/gamyaa/engineering/stories/items/n'), story('uflight')))
    await assertFails(setDoc(doc(db('gAdmin'), 'partners/uflight/engineering/stories/items/n'), story('uflight')))
    await assertFails(setDoc(doc(db('gDev'), 'partners/gamyaa/engineering/stories/items/n'), story('gamyaa')))
  })

  it('Viewer is read-only', async () => {
    await assertSucceeds(getDoc(doc(db('multi'), 'partners/ev-engineer/engineering/stories/items/s2')))
    await assertFails(setDoc(doc(db('multi'), 'partners/ev-engineer/engineering/stories/items/s2'), { id: 's2', partnerId: 'ev-engineer', title: 'x' }))
  })

  it('People Operations records are isolated per Partner', async () => {
    await assertFails(getDoc(doc(db('gAdmin'), 'peopleCandidates/c1')))
    await assertSucceeds(getDoc(doc(db('uAdmin'), 'peopleCandidates/c1')))
    await assertFails(getDocs(query(collection(db('gAdmin'), 'peopleCandidates'), where('partnerId', '==', 'uflight'))))
  })

  it('users of one Partner cannot be retrieved by another Partner\'s Admin', async () => {
    await assertFails(getDocs(query(collection(db('uAdmin'), 'partnerMemberships'), where('partnerId', '==', 'gamyaa'))))
    await assertFails(getDoc(doc(db('uAdmin'), 'users', USERS.gDev.uid)))
  })

  it('deterministic ids: own missing check-in is readable, another Partner\'s is not', async () => {
    await assertSucceeds(getDoc(doc(db('evDev'), 'dailyEngineeringCheckins', 'ev-engineer_evDev_2026-10-22')))
    await assertFails(getDoc(doc(db('gDev'), 'dailyEngineeringCheckins', 'ev-engineer_gDev_2026-10-22')))
    await assertFails(setDoc(doc(db('gDev'), 'dailyEngineeringCheckins', 'ev-engineer_gDev_2026-10-22'),
      { partnerId: 'gamyaa', developerId: USERS.gDev.uid }))   // id prefix must match partnerId
    await assertSucceeds(setDoc(doc(db('gDev'), 'dailyEngineeringCheckins', 'gamyaa_gDev_2026-10-22'),
      { partnerId: 'gamyaa', developerId: USERS.gDev.uid }))
  })

  it('letter counters are per Partner', async () => {
    await assertSucceeds(getDoc(doc(db('gAdmin'), 'peopleLetterCounters', 'gamyaa_offer-2026')))
    await assertFails(getDoc(doc(db('gAdmin'), 'peopleLetterCounters', 'uflight_offer-2026')))
    await assertFails(setDoc(doc(db('gAdmin'), 'peopleLetterCounters', 'uflight_offer-2026'), { partnerId: 'gamyaa', count: 1 }))
  })

  it('the pre-Phase-C ev_data location is closed to everyone but Platform Admin', async () => {
    await assertFails(getDoc(doc(db('evDev'), 'ev_data/stories/items/old')))
    await assertSucceeds(getDoc(doc(db('pa'), 'ev_data/stories/items/old')))
  })
})

describe('Removing members (User Management → Remove)', () => {
  const GDEV_INVITE = 'D'.repeat(43)

  // What removeMembership() sends: cancel the email's Pending invitations and
  // delete the membership in ONE batch.
  function removal(who: Who, membershipId: string, inviteTokens: string[] = []) {
    const f = db(who)
    const b = writeBatch(f)
    for (const t of inviteTokens) b.update(doc(f, 'invitations', t), { status: 'Cancelled' })
    b.delete(doc(f, 'partnerMemberships', membershipId))
    return b.commit()
  }

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      const f = ctx.firestore() as unknown as Firestore
      await setDoc(doc(f, 'invitations', GDEV_INVITE), {
        id: GDEV_INVITE, email: USERS.gDev.email, name: 'gDev', role: 'Developer', partnerId: 'gamyaa',
        invitedBy: USERS.gAdmin.uid, invitedByEmail: USERS.gAdmin.email, status: 'Pending',
        createdAt: new Date().toISOString(), expiresAt: '', expiresAtMs: Date.now() + 7 * DAY,
      })
    })
  })

  it('Partner Admin finds the email’s pending invitations, then removes the member and cancels them together', async () => {
    await assertSucceeds(getDocs(query(collection(db('gAdmin'), 'invitations'),
      where('partnerId', '==', 'gamyaa'), where('email', '==', USERS.gDev.email), where('status', '==', 'Pending'))))
    await assertSucceeds(removal('gAdmin', 'gamyaa_gDev', [GDEV_INVITE]))
    await env.withSecurityRulesDisabled(async ctx => {
      const f = ctx.firestore() as unknown as Firestore
      if ((await getDoc(doc(f, 'partnerMemberships', 'gamyaa_gDev'))).exists()) throw new Error('membership still exists')
      if ((await getDoc(doc(f, 'invitations', GDEV_INVITE))).data()?.status !== 'Cancelled') throw new Error('invitation not cancelled')
    })
  })

  it('the removed person is back to a non-member: no Partner data, but may request access again', async () => {
    await assertSucceeds(getDoc(doc(db('gDev'), 'assignments/a2')))
    await assertSucceeds(removal('gAdmin', 'gamyaa_gDev', [GDEV_INVITE]))
    await assertFails(getDoc(doc(db('gDev'), 'assignments/a2')))
    await assertSucceeds(setDoc(doc(db('gDev'), 'partnerMemberships', 'gamyaa_gDev'), membership('gamyaa', 'gDev', 'Viewer', 'Pending')))
  })

  it('Partner Admin cannot remove themselves, another Admin, or another Partner’s member', async () => {
    await assertFails(removal('gAdmin', 'gamyaa_gAdmin'))
    await assertFails(removal('gAdmin', 'gamyaa_multi'))         // multi is an Admin of GAMYAA
    await assertFails(removal('gAdmin', 'uflight_multi'))
  })

  it('Engineering Managers and Developers cannot remove anyone', async () => {
    await assertFails(removal('gMgr', 'gamyaa_gDev'))
    await assertFails(removal('gDev', 'gamyaa_gBlock'))
    await assertFails(removal('gDev', 'gamyaa_gDev'))            // not even themselves
  })

  it('Platform Admin (by record or super-admin email) can remove any member, Admins included', async () => {
    await assertSucceeds(removal('pa', 'gamyaa_gAdmin'))
    await assertSucceeds(removal('superAdmin', 'uflight_uAdmin'))
  })

  it('all-or-nothing: if an invitation can’t be cancelled, the member is not removed', async () => {
    // TOKEN_ADMIN is a Pending *Admin* invitation for newbie, which only a Platform Admin may cancel.
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore() as unknown as Firestore, 'partnerMemberships', 'gamyaa_newbie'), membership('gamyaa', 'newbie', 'Developer'))
    })
    await assertFails(removal('gAdmin', 'gamyaa_newbie', [TOKEN_ADMIN]))
    await assertSucceeds(getDoc(doc(db('newbie'), 'partnerMemberships', 'gamyaa_newbie')))   // still a member
    await assertSucceeds(removal('pa', 'gamyaa_newbie', [TOKEN_ADMIN]))
  })
})

describe('Multi-domain sign-in collections (server only)', () => {
  const COLLECTIONS = ['authSessions', 'authCodes', 'authEvents', 'authRateLimits']

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      const f = ctx.firestore() as unknown as Firestore
      for (const c of COLLECTIONS) await setDoc(doc(f, c, 'x'), { uid: USERS.gDev.uid })
    })
  })

  it('no client can read, list or write them — not the owner, not a Platform Admin', async () => {
    for (const who of [null, 'gDev', 'pa', 'superAdmin'] as const) {
      const f = db(who)
      for (const c of COLLECTIONS) {
        await assertFails(getDoc(doc(f, c, 'x')))
        await assertFails(getDocs(collection(f, c)))
        await assertFails(getDocs(query(collection(f, c), where('uid', '==', USERS.gDev.uid))))
        await assertFails(setDoc(doc(f, c, 'y'), { uid: USERS.gDev.uid }))
        await assertFails(updateDoc(doc(f, c, 'x'), { revokedAt: null }))
        await assertFails(deleteDoc(doc(f, c, 'x')))
      }
    }
  })
})
