import type { Auth } from 'firebase-admin/auth'
import type { Firestore } from 'firebase-admin/firestore'
import type { AccessResult } from '../../src/types/activation.js'
import { SUPER_ADMIN_EMAILS } from '../../src/types/auth.js'
import { isPartnerRole, membershipId } from '../../src/types/partner.js'
import type { Directory } from './types.js'

// Intern2026 stays the authority: identities come from Firebase Auth, roles
// from the same documents firestore.rules use (platformAdmins/{uid},
// partnerMemberships/{partnerId}_{uid}, the super-admin emails). Roles are
// read on every session check, so suspending or removing a member applies
// at once without waiting for their session to expire.

export function createFirebaseDirectory(auth: Auth, db: Firestore): Directory {
  async function standing(user: { uid: string; email: string; emailVerified: boolean }, partnerId: string) {
    const [grant, membership] = await Promise.all([
      db.doc(`platformAdmins/${user.uid}`).get(),
      db.doc(`partnerMemberships/${membershipId(partnerId, user.uid)}`).get(),
    ])
    const role: unknown = membership.get('role')
    const status: unknown = membership.get('status')
    return {
      platformAdmin: (user.emailVerified && SUPER_ADMIN_EMAILS.has(user.email)) || grant.exists,
      member: membership.exists,
      status,
      activeRole: status === 'Active' && isPartnerRole(role) ? role : null,
    }
  }

  return {
    async verifyIdToken(idToken) {
      // checkRevoked: also rejects disabled accounts and revoked refresh tokens.
      const t = await auth.verifyIdToken(idToken, true)
      return {
        uid: t.uid,
        email: (t.email ?? '').toLowerCase(),
        emailVerified: t.email_verified === true,
        name: typeof t.name === 'string' ? t.name : '',
        authTime: t.auth_time * 1000,
      }
    },

    async isUserEnabled(uid) {
      try {
        return !(await auth.getUser(uid)).disabled
      } catch (err) {
        if ((err as { code?: string }).code === 'auth/user-not-found') return false
        throw err
      }
    },

    async rolesFor(user, partnerId) {
      const s = await standing(user, partnerId)
      const roles: string[] = []
      if (s.platformAdmin) roles.push('Platform Admin')
      if (s.activeRole) roles.push(s.activeRole)
      return roles
    },

    async accessFor(user, partnerId): Promise<AccessResult> {
      const s = await standing(user, partnerId)
      if (s.activeRole) return 'granted'
      if (s.platformAdmin) return 'platform_admin'
      if (!s.member) return 'no_membership'
      if (s.status === 'Pending') return 'pending'
      if (s.status === 'Suspended') return 'suspended'
      return 'blocked' // Blocked, or anything unrecognised: fail closed
    },

    async profileLocation(uid) {
      const profile = await db.doc(`users/${uid}`).get()
      if (!profile.exists) return null
      return { country: profile.get('country'), stateOrRegion: profile.get('stateOrRegion'), city: profile.get('city') }
    },
  }
}
