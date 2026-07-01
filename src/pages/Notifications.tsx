import { useEffect, useState } from 'react'
import { Bell, CheckCheck, Loader2 } from 'lucide-react'
import { useAuthContext } from '../contexts/AuthContext'
import {
  getNotifications, markNotificationRead, markAllNotificationsRead,
  notificationTypeLabel,
} from '../firebase/assignments'
import type { M05Notification } from '../types/assignments'
import PageHeader from '../components/ui/PageHeader'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const TYPE_COLOR: Record<string, string> = {
  assignment_received:        'bg-blue-100 text-blue-700',
  assignment_accepted:        'bg-green-100 text-green-700',
  assignment_declined:        'bg-red-100 text-red-700',
  qa_requested:               'bg-amber-100 text-amber-700',
  architect_review_requested: 'bg-purple-100 text-purple-700',
  deadline_reminder:          'bg-orange-100 text-orange-700',
  evidence_missing:           'bg-rose-100 text-rose-700',
  weekly_reminder:            'bg-slate-100 text-slate-600',
}

export default function Notifications() {
  const { uid } = useAuthContext()
  const [notifications, setNotifications] = useState<M05Notification[]>([])
  const [loading, setLoading]             = useState(true)
  const [markingAll, setMarkingAll]       = useState(false)

  useEffect(() => {
    if (!uid) return
    setLoading(true)
    getNotifications(uid, 50).then(data => {
      setNotifications(data)
      setLoading(false)
    })
  }, [uid])

  async function handleMarkRead(n: M05Notification) {
    if (n.read) return
    await markNotificationRead(n.id)
    setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
  }

  async function handleMarkAll() {
    if (!uid) return
    setMarkingAll(true)
    await markAllNotificationsRead(uid)
    setNotifications(prev => prev.map(x => ({ ...x, read: true })))
    setMarkingAll(false)
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up'}
        icon={<Bell size={18} />}
      />

      <div className="flex justify-end">
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAll}
            disabled={markingAll}
            className="btn-secondary gap-1.5 text-xs"
          >
            {markingAll
              ? <Loader2 size={12} className="animate-spin" />
              : <CheckCheck size={12} />}
            Mark all as read
          </button>
        )}
      </div>

      {loading ? (
        <div className="card p-12 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-slate-400" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="card p-12 text-center">
          <Bell size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500 text-sm font-medium">No notifications yet</p>
          <p className="text-slate-400 text-xs mt-1">Assignment updates and reminders will appear here.</p>
        </div>
      ) : (
        <div className="card divide-y divide-slate-50 overflow-hidden">
          {notifications.map(n => (
            <button
              key={n.id}
              onClick={() => handleMarkRead(n)}
              className={`w-full text-left px-5 py-4 flex items-start gap-4 hover:bg-slate-50 transition-colors ${!n.read ? 'bg-blue-50/40' : ''}`}
            >
              {/* Unread dot */}
              <div className="flex-shrink-0 mt-1">
                {n.read
                  ? <div className="w-2 h-2 rounded-full bg-transparent" />
                  : <div className="w-2 h-2 rounded-full bg-brand-500" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TYPE_COLOR[n.type] ?? 'bg-slate-100 text-slate-600'}`}>
                    {notificationTypeLabel(n.type)}
                  </span>
                  {n.assignmentId && (
                    <span className="text-[10px] text-slate-400 font-mono">{n.assignmentId}</span>
                  )}
                </div>
                <p className={`text-sm font-semibold ${n.read ? 'text-slate-700' : 'text-slate-900'}`}>{n.title}</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{n.message}</p>
              </div>

              <span className="text-[10px] text-slate-400 flex-shrink-0 mt-1">{timeAgo(n.createdAt)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
