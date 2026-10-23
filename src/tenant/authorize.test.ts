import { describe, it, expect } from 'vitest'
import {
  accessStateFor, effectiveRole, authorize, canWriteIn, canAdministerPartner,
  canManagePartnerRegistry, canInviteWithRole, canChangeMembership, canRemoveMembership, canGrantPlatformAdmin,
  type Principal,
} from './authorize'

// Spec §30: the SAME global user with different roles per Partner.
const sameUser: Principal = {
  uid: 'u1',
  isPlatformAdmin: false,
  memberships: {
    gamyaa:        { role: 'Admin',     status: 'Active' },
    uflight:       { role: 'Developer', status: 'Active' },
    'ev-engineer': { role: 'Viewer',    status: 'Active' },
  },
}

const platformAdmin: Principal = { uid: 'pa', isPlatformAdmin: true, memberships: {} }

const gamyaaAdmin: Principal = {
  uid: 'ga', isPlatformAdmin: false,
  memberships: { gamyaa: { role: 'Admin', status: 'Active' } },
}

describe('one user, different role per Partner', () => {
  it('resolves the role from the ACTIVE Partner only', () => {
    expect(effectiveRole(sameUser, 'gamyaa')).toBe('Admin')
    expect(effectiveRole(sameUser, 'uflight')).toBe('Developer')
    expect(effectiveRole(sameUser, 'ev-engineer')).toBe('Viewer')
    expect(effectiveRole(sameUser, 'itelematics')).toBeNull()
  })

  it('is Admin on GAMYAA but cannot administer UFlight', () => {
    expect(canAdministerPartner(sameUser, 'gamyaa')).toBe(true)
    expect(canAdministerPartner(sameUser, 'uflight')).toBe(false)
  })

  it('has no access at all on a Partner without membership', () => {
    expect(accessStateFor(sameUser, 'itelematics')).toBe('no-membership')
  })
})

describe('tenant isolation — authorize(user, activePartner, resource.partnerId)', () => {
  it('allows a member on their own active Partner', () => {
    expect(authorize(sameUser, 'gamyaa', 'gamyaa')).toBe(true)
  })

  it('denies cross-Partner resources even for an Admin', () => {
    // GAMYAA Admin browsing login.gamyaa.in requests a UFlight record (§24 horizontal escalation)
    expect(authorize(gamyaaAdmin, 'gamyaa', 'uflight')).toBe(false)
    // Even a user who IS a UFlight member cannot pull UFlight data inside the GAMYAA context
    expect(authorize(sameUser, 'gamyaa', 'uflight')).toBe(false)
  })

  it('denies when the resource has no partnerId', () => {
    expect(authorize(sameUser, 'gamyaa', '')).toBe(false)
  })

  it('Platform Admin has cross-Partner authority', () => {
    expect(authorize(platformAdmin, 'gamyaa', 'uflight')).toBe(true)
    expect(effectiveRole(platformAdmin, 'anything')).toBe('Platform Admin')
  })
})

describe('membership status gates access', () => {
  for (const status of ['Pending', 'Suspended', 'Blocked'] as const) {
    it(`${status} membership grants no role`, () => {
      const p: Principal = { uid: 'x', isPlatformAdmin: false, memberships: { gamyaa: { role: 'Admin', status } } }
      expect(effectiveRole(p, 'gamyaa')).toBeNull()
      expect(authorize(p, 'gamyaa', 'gamyaa')).toBe(false)
      expect(accessStateFor(p, 'gamyaa')).toBe(status.toLowerCase())
    })
  }

  it('unknown status fails closed', () => {
    const p = { uid: 'x', isPlatformAdmin: false, memberships: { gamyaa: { role: 'Admin', status: 'Weird' } } } as unknown as Principal
    expect(accessStateFor(p, 'gamyaa')).toBe('blocked')
    expect(effectiveRole(p, 'gamyaa')).toBeNull()
  })
})

describe('role authorization matrix (spec §30)', () => {
  it('Viewer is read-only', () => {
    expect(authorize(sameUser, 'ev-engineer', 'ev-engineer')).toBe(true)
    expect(canWriteIn(sameUser, 'ev-engineer', 'ev-engineer')).toBe(false)
  })

  it('Developer has limited write access in their Partner only', () => {
    expect(canWriteIn(sameUser, 'uflight', 'uflight')).toBe(true)
    expect(canAdministerPartner(sameUser, 'uflight')).toBe(false)
    expect(canWriteIn(sameUser, 'uflight', 'gamyaa')).toBe(false)
  })

  it('Admin has full access to their Partner only', () => {
    expect(canWriteIn(gamyaaAdmin, 'gamyaa', 'gamyaa')).toBe(true)
    expect(canAdministerPartner(gamyaaAdmin, 'gamyaa')).toBe(true)
    expect(canAdministerPartner(gamyaaAdmin, 'uflight')).toBe(false)
  })

  it('only Platform Admin manages the Partner registry (create Partner, domains, auth policy)', () => {
    expect(canManagePartnerRegistry(platformAdmin)).toBe(true)
    expect(canManagePartnerRegistry(gamyaaAdmin)).toBe(false)
  })
})

describe('admin escalation', () => {
  it('Partner Admin cannot grant Platform Admin', () => {
    expect(canGrantPlatformAdmin(gamyaaAdmin)).toBe(false)
    expect(canInviteWithRole(gamyaaAdmin, 'gamyaa', 'Platform Admin')).toBe(false)
    expect(canInviteWithRole(platformAdmin, 'gamyaa', 'Platform Admin')).toBe(false) // never via Partner invite
  })

  it('Partner Admin cannot create another Admin', () => {
    expect(canInviteWithRole(gamyaaAdmin, 'gamyaa', 'Admin')).toBe(false)
    expect(canChangeMembership(gamyaaAdmin, { targetUid: 'z', partnerId: 'gamyaa', beforeRole: 'Developer', afterRole: 'Admin' })).toBe(false)
  })

  it('Partner Admin cannot change their own membership', () => {
    expect(canChangeMembership(gamyaaAdmin, { targetUid: 'ga', partnerId: 'gamyaa', beforeRole: 'Admin', afterRole: 'Admin' })).toBe(false)
  })

  it('Partner Admin cannot demote or edit another Admin', () => {
    expect(canChangeMembership(gamyaaAdmin, { targetUid: 'z', partnerId: 'gamyaa', beforeRole: 'Admin', afterRole: 'Viewer' })).toBe(false)
  })

  it('Partner Admin can manage ordinary members of their own Partner only', () => {
    expect(canChangeMembership(gamyaaAdmin, { targetUid: 'z', partnerId: 'gamyaa', beforeRole: 'Developer', afterRole: 'QA Engineer' })).toBe(true)
    expect(canChangeMembership(gamyaaAdmin, { targetUid: 'z', partnerId: 'uflight', beforeRole: 'Developer', afterRole: 'QA Engineer' })).toBe(false)
  })

  it('Engineering Manager may invite non-admin roles but not Admin', () => {
    const mgr: Principal = { uid: 'm', isPlatformAdmin: false, memberships: { gamyaa: { role: 'Engineering Manager', status: 'Active' } } }
    expect(canInviteWithRole(mgr, 'gamyaa', 'Developer')).toBe(true)
    expect(canInviteWithRole(mgr, 'gamyaa', 'Admin')).toBe(false)
    expect(canInviteWithRole(mgr, 'uflight', 'Developer')).toBe(false)
  })

  it('Platform Admin can assign Partner Admins', () => {
    expect(canInviteWithRole(platformAdmin, 'gamyaa', 'Admin')).toBe(true)
    expect(canChangeMembership(platformAdmin, { targetUid: 'z', partnerId: 'gamyaa', beforeRole: null, afterRole: 'Admin' })).toBe(true)
  })
})

describe('removing members (mirrors the partnerMemberships delete rule)', () => {
  it('Platform Admin can remove anyone, Admins included', () => {
    expect(canRemoveMembership(platformAdmin, { targetUid: 'z', partnerId: 'gamyaa', role: 'Developer' })).toBe(true)
    expect(canRemoveMembership(platformAdmin, { targetUid: 'ga', partnerId: 'gamyaa', role: 'Admin' })).toBe(true)
  })

  it('Partner Admin can remove ordinary members of their own Partner only', () => {
    expect(canRemoveMembership(gamyaaAdmin, { targetUid: 'z', partnerId: 'gamyaa', role: 'Developer' })).toBe(true)
    expect(canRemoveMembership(gamyaaAdmin, { targetUid: 'z', partnerId: 'uflight', role: 'Developer' })).toBe(false)
  })

  it('Partner Admin cannot remove themselves or another Admin', () => {
    expect(canRemoveMembership(gamyaaAdmin, { targetUid: 'ga', partnerId: 'gamyaa', role: 'Admin' })).toBe(false)
    expect(canRemoveMembership(gamyaaAdmin, { targetUid: 'z', partnerId: 'gamyaa', role: 'Admin' })).toBe(false)
  })

  it('non-admins cannot remove anyone, wherever they are Admin', () => {
    expect(canRemoveMembership(sameUser, { targetUid: 'z', partnerId: 'uflight', role: 'Viewer' })).toBe(false)   // Developer there
    const mgr: Principal = { uid: 'm', isPlatformAdmin: false, memberships: { gamyaa: { role: 'Engineering Manager', status: 'Active' } } }
    expect(canRemoveMembership(mgr, { targetUid: 'z', partnerId: 'gamyaa', role: 'Developer' })).toBe(false)
  })
})
