import type { Auth } from 'firebase-admin/auth'
import type { Firestore } from 'firebase-admin/firestore'
import { SUPER_ADMIN_EMAILS } from '../../src/types/auth.js'
import { isPartnerRole, membershipId } from '../../src/types/partner.js'
import type { Directory } from './types.js'

// Intern2026 stays the authority: identities come from Firebase Auth, roles
// from the same documents firestore.rules use (platformAdmins/{uid},
// partnerMemberships/{partnerId}_{uid}, the super-admin emails). Roles are
// read on every session check, so suspending or removing a member applies
// at once without waiting for their session to expire.

export function createFirebaseDirectory(auth: Auth, db: Firestore): Directory {
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
      const [grant, membership] = await Promise.all([
        db.doc(`platformAdmins/${user.uid}`).get(),
        db.doc(`partnerMemberships/${membershipId(partnerId, user.uid)}`).get(),
      ])
      const roles: string[] = []
      if ((user.emailVerified && SUPER_ADMIN_EMAILS.has(user.email)) || grant.exists) roles.push('Platform Admin')
      const role: unknown = membership.get('role')
      if (membership.get('status') === 'Active' && isPartnerRole(role)) roles.push(role)
      return roles
    },
  }
}
