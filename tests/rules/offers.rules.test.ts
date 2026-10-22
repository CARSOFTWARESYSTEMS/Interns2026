// Offer Letter Draft Review — Firestore + Storage rules (emulators).
//   npm run test:rules
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  initializeTestEnvironment, assertSucceeds, assertFails, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, serverTimestamp, type Firestore,
} from 'firebase/firestore'
import { ref, uploadBytes, getBytes, type FirebaseStorage } from 'firebase/storage'

// Must match the emulator project: storage rules read Firestore in the same project.
const PROJECT = 'demo-tenant-rules'
let env: RulesTestEnvironment

const U = {
  pa:     { uid: 'pa',     email: 'pa@example.com' },
  gAdmin: { uid: 'gAdmin', email: 'g-admin@example.com' },
  gHR:    { uid: 'gHR',    email: 'g-hr@example.com' },
  gDev:   { uid: 'gDev',   email: 'g-dev@example.com' },
  uAdmin: { uid: 'uAdmin', email: 'u-admin@example.com' },
  cand:   { uid: 'cand',   email: 'cand@example.com' },     // candidate, no membership
  other:  { uid: 'other',  email: 'other@example.com' },    // another candidate
}
type Who = keyof typeof U

const ctx = (who: Who, verified = true) =>
  env.authenticatedContext(U[who].uid, { email: U[who].email, email_verified: verified })
const fs = (who: Who, verified = true) => ctx(who, verified).firestore() as unknown as Firestore
const st = (who: Who | null) => (who ? ctx(who).storage() : env.unauthenticatedContext().storage()) as unknown as FirebaseStorage

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])   // "%PDF-"
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47])

function offer(id: string, pid: string, email: string, status: string, extra: Record<string, unknown> = {}) {
  return {
    id, partnerId: pid, viewerEmail: email, candidateName: 'C', version: 1, status,
    file: { path: `partners/${pid}/offerDrafts/${id}/1-offer.pdf`, name: 'offer.pdf', size: 5, contentType: 'application/pdf', uploadedAt: '' },
    createdBy: 'gAdmin', createdByEmail: '', createdAt: '', updatedAt: '', sentForReviewAt: '',
    confirmedAt: null, confirmedBy: '', ...extra,
  }
}

const LOGO_URL = (pid: string) =>
  `https://firebasestorage.googleapis.com/v0/b/${PROJECT}.appspot.com/o/partners%2F${pid}%2Fbranding%2Flogo-1.png?alt=media&token=t`

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    storage: { rules: readFileSync('storage.rules', 'utf8') },
  })
})
afterAll(async () => { await env?.cleanup() })

beforeEach(async () => {
  await env.clearFirestore()
  await env.clearStorage()
  await env.withSecurityRulesDisabled(async c => {
    const f = c.firestore() as unknown as Firestore
    const s = c.storage() as unknown as FirebaseStorage
    for (const id of ['gamyaa', 'uflight']) {
      await setDoc(doc(f, 'partners', id), {
        id, status: 'Active', displayName: id,
        branding: { logoUrl: '', logoDarkUrl: '', faviconUrl: '', primaryColor: '#2563eb', secondaryColor: '#0f172a', accentColor: '#60a5fa' },
      })
    }
    await setDoc(doc(f, 'platformAdmins', 'pa'), { uid: 'pa' })
    const m = (pid: string, who: Who, role: string) =>
      setDoc(doc(f, 'partnerMemberships', `${pid}_${U[who].uid}`), { id: `${pid}_${U[who].uid}`, partnerId: pid, uid: U[who].uid, role, status: 'Active' })
    await m('gamyaa', 'gAdmin', 'Admin')
    await m('gamyaa', 'gHR', 'HR Manager')
    await m('gamyaa', 'gDev', 'Developer')
    await m('uflight', 'uAdmin', 'Admin')

    await setDoc(doc(f, 'offerDrafts', 'o1'), offer('o1', 'gamyaa', U.cand.email, 'In Review'))
    await setDoc(doc(f, 'offerDrafts', 'o2'), offer('o2', 'gamyaa', U.other.email, 'In Review'))
    await setDoc(doc(f, 'offerDrafts', 'o3'), offer('o3', 'gamyaa', U.cand.email, 'Draft'))
    await setDoc(doc(f, 'offerDrafts', 'o4'), offer('o4', 'uflight', U.cand.email, 'In Review'))
    await setDoc(doc(f, 'offerDrafts', 'o5'), offer('o5', 'gamyaa', U.cand.email, 'Confirmed', { confirmedBy: 'cand' }))

    for (const [id, pid] of [['o1', 'gamyaa'], ['o2', 'gamyaa'], ['o3', 'gamyaa'], ['o4', 'uflight'], ['o5', 'gamyaa']]) {
      await uploadBytes(ref(s, `partners/${pid}/offerDrafts/${id}/1-offer.pdf`), PDF, { contentType: 'application/pdf' })
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════

describe('Firestore — candidate (viewer)', () => {
  it('reads only their own offer once it is in review', async () => {
    await assertSucceeds(getDoc(doc(fs('cand'), 'offerDrafts/o1')))
    await assertFails(getDoc(doc(fs('cand'), 'offerDrafts/o3')))          // still Draft
    await assertFails(getDoc(doc(fs('cand'), 'offerDrafts/o2')))          // someone else's (changing the id)
    await assertFails(getDoc(doc(fs('other'), 'offerDrafts/o1')))
  })

  it('needs a verified email', async () => {
    await assertFails(getDoc(doc(fs('cand', false), 'offerDrafts/o1')))
  })

  it('can list only with their own email filter', async () => {
    await assertSucceeds(getDocs(query(collection(fs('cand'), 'offerDrafts'),
      where('partnerId', '==', 'gamyaa'), where('viewerEmail', '==', U.cand.email), where('status', 'in', ['In Review', 'Confirmed']))))
    await assertFails(getDocs(query(collection(fs('cand'), 'offerDrafts'), where('partnerId', '==', 'gamyaa'))))
  })

  it('confirms with the server time only', async () => {
    await assertFails(updateDoc(doc(fs('cand'), 'offerDrafts/o1'),
      { status: 'Confirmed', confirmedAt: new Date('2020-01-01'), confirmedBy: 'cand', updatedAt: 'x' }))
    await assertSucceeds(updateDoc(doc(fs('cand'), 'offerDrafts/o1'),
      { status: 'Confirmed', confirmedAt: serverTimestamp(), confirmedBy: 'cand', updatedAt: 'x' }))
  })

  it('cannot confirm a draft, someone else’s offer, or confirm twice', async () => {
    const c = { status: 'Confirmed', confirmedAt: serverTimestamp(), confirmedBy: 'cand', updatedAt: 'x' }
    await assertFails(updateDoc(doc(fs('cand'), 'offerDrafts/o3'), c))
    await assertFails(updateDoc(doc(fs('cand'), 'offerDrafts/o2'), c))
    await assertFails(updateDoc(doc(fs('cand'), 'offerDrafts/o5'), c))
  })

  it('cannot edit anything else (file, email, status back)', async () => {
    await assertFails(updateDoc(doc(fs('cand'), 'offerDrafts/o1'),
      { status: 'Confirmed', confirmedAt: serverTimestamp(), confirmedBy: 'cand', viewerEmail: 'x@example.com' }))
    await assertFails(updateDoc(doc(fs('cand'), 'offerDrafts/o1'), { status: 'Draft' }))
    await assertFails(setDoc(doc(fs('cand'), 'offerDrafts/new'), offer('new', 'gamyaa', U.cand.email, 'Draft', { createdBy: 'cand' })))
  })
})

describe('Firestore — managers', () => {
  it('Admin and HR Manager manage offers in their own Partner only', async () => {
    await assertSucceeds(setDoc(doc(fs('gAdmin'), 'offerDrafts/n1'), offer('n1', 'gamyaa', 'a@example.com', 'Draft', { createdBy: 'gAdmin' })))
    await assertSucceeds(updateDoc(doc(fs('gHR'), 'offerDrafts/o3'), { status: 'In Review', sentForReviewAt: 'now', updatedAt: 'now' }))
    await assertFails(setDoc(doc(fs('gAdmin'), 'offerDrafts/n2'), offer('n2', 'uflight', 'a@example.com', 'Draft', { createdBy: 'gAdmin' })))
    await assertFails(getDoc(doc(fs('uAdmin'), 'offerDrafts/o1')))
    await assertFails(getDocs(query(collection(fs('uAdmin'), 'offerDrafts'), where('partnerId', '==', 'gamyaa'))))
  })

  it('Developers cannot manage offers', async () => {
    await assertFails(getDoc(doc(fs('gDev'), 'offerDrafts/o1')))
    await assertFails(setDoc(doc(fs('gDev'), 'offerDrafts/n3'), offer('n3', 'gamyaa', 'a@example.com', 'Draft', { createdBy: 'gDev' })))
  })

  it('new offers start as Draft with a file in their own folder', async () => {
    await assertFails(setDoc(doc(fs('gAdmin'), 'offerDrafts/n4'), offer('n4', 'gamyaa', 'a@example.com', 'Confirmed', { createdBy: 'gAdmin' })))
    await assertFails(setDoc(doc(fs('gAdmin'), 'offerDrafts/n5'), offer('n5', 'gamyaa', 'a@example.com', 'Draft',
      { createdBy: 'gAdmin', file: { path: 'partners/uflight/offerDrafts/n5/1-x.pdf' } })))
    await assertFails(setDoc(doc(fs('gAdmin'), 'offerDrafts/n6'), offer('n6', 'gamyaa', 'A@Example.com', 'Draft', { createdBy: 'gAdmin' })))
  })

  it('managers can never confirm, and confirmed offers are locked', async () => {
    await assertFails(updateDoc(doc(fs('gAdmin'), 'offerDrafts/o1'), { status: 'Confirmed' }))
    await assertFails(updateDoc(doc(fs('gAdmin'), 'offerDrafts/o5'), { candidateName: 'changed' }))
    await assertFails(updateDoc(doc(fs('gAdmin'), 'offerDrafts/o1'), { partnerId: 'uflight' }))
  })

  it('Platform Admin has global authority', async () => {
    await assertSucceeds(getDoc(doc(fs('pa'), 'offerDrafts/o4')))
  })
})

describe('Firestore — Partner logo', () => {
  it('a Partner Admin may set only their own logo, only to their Storage folder', async () => {
    await assertSucceeds(updateDoc(doc(fs('gAdmin'), 'partners/gamyaa'), { 'branding.logoUrl': LOGO_URL('gamyaa'), updatedAt: 'x', updatedBy: 'gAdmin' }))
    await assertFails(updateDoc(doc(fs('gAdmin'), 'partners/gamyaa'), { 'branding.logoUrl': 'https://evil.example.com/x.png' }))
    await assertFails(updateDoc(doc(fs('gAdmin'), 'partners/gamyaa'), { 'branding.logoUrl': LOGO_URL('uflight') }))
    await assertFails(updateDoc(doc(fs('gAdmin'), 'partners/gamyaa'), { 'branding.primaryColor': '#ff0000' }))
    await assertFails(updateDoc(doc(fs('gAdmin'), 'partners/gamyaa'), { displayName: 'Hijacked' }))
    await assertFails(updateDoc(doc(fs('uAdmin'), 'partners/gamyaa'), { 'branding.logoUrl': LOGO_URL('gamyaa') }))
    await assertFails(updateDoc(doc(fs('gHR'), 'partners/gamyaa'), { 'branding.logoUrl': LOGO_URL('gamyaa') }))
  })
})

describe('Storage — offer PDFs', () => {
  const path = (pid: string, id: string) => `partners/${pid}/offerDrafts/${id}/1-offer.pdf`

  it('the candidate can download their own offer once in review, nothing else', async () => {
    await assertSucceeds(getBytes(ref(st('cand'), path('gamyaa', 'o1'))))
    await assertFails(getBytes(ref(st('cand'), path('gamyaa', 'o3'))))      // Draft
    await assertFails(getBytes(ref(st('cand'), path('gamyaa', 'o2'))))      // someone else's
    await assertFails(getBytes(ref(st('other'), path('gamyaa', 'o1'))))
    await assertFails(getBytes(ref(st('cand'), path('gamyaa', 'o4'))))      // record belongs to uflight
    await assertFails(getBytes(ref(st(null), path('gamyaa', 'o1'))))
  })

  it('managers read and upload PDFs in their own Partner only', async () => {
    await assertSucceeds(getBytes(ref(st('gHR'), path('gamyaa', 'o3'))))
    await assertFails(getBytes(ref(st('uAdmin'), path('gamyaa', 'o1'))))
    await assertSucceeds(uploadBytes(ref(st('gAdmin'), 'partners/gamyaa/offerDrafts/o9/1-new.pdf'), PDF, { contentType: 'application/pdf' }))
    await assertFails(uploadBytes(ref(st('gAdmin'), 'partners/uflight/offerDrafts/o9/1-new.pdf'), PDF, { contentType: 'application/pdf' }))
    await assertFails(uploadBytes(ref(st('gDev'), 'partners/gamyaa/offerDrafts/o9/1-new.pdf'), PDF, { contentType: 'application/pdf' }))
  })

  it('only PDFs, and stored files are never overwritten', async () => {
    await assertFails(uploadBytes(ref(st('gAdmin'), 'partners/gamyaa/offerDrafts/o9/1-new.pdf'), PNG, { contentType: 'image/png' }))
    await assertFails(uploadBytes(ref(st('gAdmin'), path('gamyaa', 'o1')), PDF, { contentType: 'application/pdf' }))
  })
})

describe('Storage — Partner logos and everything else', () => {
  it('logos are public; only that Partner’s Admin can upload', async () => {
    await assertSucceeds(uploadBytes(ref(st('gAdmin'), 'partners/gamyaa/branding/logo-1.png'), PNG, { contentType: 'image/png' }))
    await assertSucceeds(getBytes(ref(st(null), 'partners/gamyaa/branding/logo-1.png')))
    await assertFails(uploadBytes(ref(st('gDev'), 'partners/gamyaa/branding/logo-2.png'), PNG, { contentType: 'image/png' }))
    await assertFails(uploadBytes(ref(st('uAdmin'), 'partners/gamyaa/branding/logo-3.png'), PNG, { contentType: 'image/png' }))
    await assertFails(uploadBytes(ref(st('gAdmin'), 'partners/gamyaa/branding/logo-4.pdf'), PDF, { contentType: 'application/pdf' }))
  })

  it('any other path is denied', async () => {
    await assertFails(uploadBytes(ref(st('pa'), 'anything/else.pdf'), PDF, { contentType: 'application/pdf' }))
  })
})
