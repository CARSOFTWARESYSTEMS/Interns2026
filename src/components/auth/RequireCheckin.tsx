import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthContext } from '../../contexts/AuthContext'
import { checkinLocalKey, todayKey } from '../../types/assignments'
import { getTodayCheckin } from '../../firebase/assignments'

interface RequireCheckinProps {
  children: React.ReactNode
}

export default function RequireCheckin({ children }: RequireCheckinProps) {
  const { role, uid } = useAuthContext()
  const location = useLocation()
  const [checked, setChecked] = useState<boolean | null>(null)

  const isDev = role === 'Developer'

  useEffect(() => {
    if (!isDev || !uid) {
      setChecked(true)
      return
    }

    // Fast path: localStorage
    const key = checkinLocalKey(uid)
    if (localStorage.getItem(key) === 'done') {
      setChecked(true)
      return
    }

    // Slow path: Firestore (handles page refresh after cache clear)
    getTodayCheckin(uid, todayKey()).then(doc => {
      if (doc) {
        localStorage.setItem(key, 'done')
        setChecked(true)
      } else {
        setChecked(false)
      }
    }).catch(() => setChecked(false))
  }, [isDev, uid])

  if (checked === null) return null  // brief loading — no spinner needed

  if (isDev && checked === false && location.pathname !== '/checkin') {
    return <Navigate to="/checkin" state={{ from: location }} replace />
  }

  return <>{children}</>
}
