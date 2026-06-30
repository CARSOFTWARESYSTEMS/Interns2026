import { useCallback } from 'react'
import { writeAuditLog } from '../firebase/firestore'
import type { AuditAction } from '../types/auth'
import { useAuthContext } from '../contexts/AuthContext'

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
        orgId: userProfile.orgId,
      })
    },
    [userProfile]
  )

  return log
}
