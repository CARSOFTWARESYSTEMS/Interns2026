import { useCallback } from 'react'
import { writeAuditLog } from '../firebase/firestore'
import type { AuditAction } from '../types/auth'
import { useAuthContext } from '../contexts/AuthContext'
import { getActivePartnerId } from '../tenant/session'

/** Audit events carry the active Partner (observability) — never PII beyond the actor's email. */
export function useAuditLog() {
  const { userProfile } = useAuthContext()

  const log = useCallback(
    async (action: AuditAction, resource: string, details = '') => {
      if (!userProfile) return
      await writeAuditLog({
        uid: userProfile.uid,
        userEmail: userProfile.email,
        action,
        resource,
        details,
        partnerId: getActivePartnerId() ?? '',
        host: window.location.hostname,
      })
    },
    [userProfile]
  )

  return log
}
