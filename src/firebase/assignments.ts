import {
  doc, getDoc, setDoc, updateDoc, addDoc,
  collection, query, where, orderBy, limit,
  getDocs,
} from 'firebase/firestore'
import { db } from './config'
import type {
  M05Assignment, AssignmentHistory, AssignmentHistoryAction,
  DailyCheckin, WeeklyEngineeringReport, DeveloperCapacity,
  M05Notification, NotificationType, AssignmentComment,
  M05AssignmentStatus, RiskLevel,
} from '../types/assignments'

// ── Assignments ───────────────────────────────────────────────────────────────

export async function createM05Assignment(
  assignment: Omit<M05Assignment, 'id' | 'assignmentId'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'assignments'), {
    ...assignment,
    lastUpdated: new Date().toISOString(),
  })
  await updateDoc(ref, { id: ref.id, assignmentId: ref.id })
  return ref.id
}

export async function getM05Assignment(id: string): Promise<M05Assignment | null> {
  const snap = await getDoc(doc(db, 'assignments', id))
  return snap.exists() ? (snap.data() as M05Assignment) : null
}

export async function updateM05Assignment(
  id: string,
  data: Partial<M05Assignment>
): Promise<void> {
  await updateDoc(doc(db, 'assignments', id), {
    ...data,
    lastUpdated: new Date().toISOString(),
  })
}

export async function getAssignmentsForDeveloper(developerId: string): Promise<M05Assignment[]> {
  const q = query(
    collection(db, 'assignments'),
    where('developerId', '==', developerId),
    orderBy('assignedDate', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => d.data() as M05Assignment)
}

export async function getAssignmentsForStory(storyId: string): Promise<M05Assignment[]> {
  const q = query(
    collection(db, 'assignments'),
    where('storyId', '==', storyId),
    orderBy('assignedDate', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => d.data() as M05Assignment)
}

export async function getAssignmentsForSimulator(simulatorId: string): Promise<M05Assignment[]> {
  const q = query(
    collection(db, 'assignments'),
    where('simulatorId', '==', simulatorId),
    orderBy('assignedDate', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => d.data() as M05Assignment)
}

export async function getAllM05Assignments(maxResults = 200): Promise<M05Assignment[]> {
  const q = query(
    collection(db, 'assignments'),
    orderBy('assignedDate', 'desc'),
    limit(maxResults)
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => d.data() as M05Assignment)
}

// ── Accept / Decline workflow ─────────────────────────────────────────────────

export async function acceptAssignment(
  assignmentId: string,
  developerId: string,
  developerName: string,
  developerEmail: string
): Promise<void> {
  const now = new Date().toISOString()
  await updateDoc(doc(db, 'assignments', assignmentId), {
    status: 'Accepted' as M05AssignmentStatus,
    acceptedDate: now,
    lastUpdated: now,
  })
  await recordHistory({
    assignmentId,
    action: 'Accepted',
    performedBy: developerId,
    performedByName: developerName,
    performedByEmail: developerEmail,
    performedByRole: 'Developer',
    note: 'Developer accepted the assignment.',
    previousStatus: 'Assigned',
    newStatus: 'Accepted',
  })
  // Notify assigning manager
  const snap = await getDoc(doc(db, 'assignments', assignmentId))
  if (snap.exists()) {
    const a = snap.data() as M05Assignment
    await createNotification({
      recipientId: a.assignedBy,
      recipientEmail: '',
      type: 'assignment_accepted',
      title: 'Assignment Accepted',
      message: `${developerName} has accepted the assignment for ${a.storyTitle || a.simulatorTitle || assignmentId}.`,
      assignmentId,
    })
  }
}

export async function declineAssignment(
  assignmentId: string,
  developerId: string,
  developerName: string,
  developerEmail: string,
  reason: string
): Promise<void> {
  const now = new Date().toISOString()
  await updateDoc(doc(db, 'assignments', assignmentId), {
    status: 'Declined' as M05AssignmentStatus,
    declineReason: reason,
    lastUpdated: now,
  })
  await recordHistory({
    assignmentId,
    action: 'Declined',
    performedBy: developerId,
    performedByName: developerName,
    performedByEmail: developerEmail,
    performedByRole: 'Developer',
    note: `Declined. Reason: ${reason}`,
    previousStatus: 'Assigned',
    newStatus: 'Declined',
  })
  const snap = await getDoc(doc(db, 'assignments', assignmentId))
  if (snap.exists()) {
    const a = snap.data() as M05Assignment
    await createNotification({
      recipientId: a.assignedBy,
      recipientEmail: '',
      type: 'assignment_declined',
      title: 'Assignment Declined',
      message: `${developerName} declined the assignment for ${a.storyTitle || a.simulatorTitle}. Reason: ${reason}`,
      assignmentId,
    })
  }
}

export async function updateAssignmentStatus(
  assignmentId: string,
  newStatus: M05AssignmentStatus,
  performedBy: string,
  performedByName: string,
  note = ''
): Promise<void> {
  const snap = await getDoc(doc(db, 'assignments', assignmentId))
  const previousStatus = snap.exists() ? (snap.data() as M05Assignment).status : ''
  await updateM05Assignment(assignmentId, { status: newStatus })
  await recordHistory({
    assignmentId,
    action: 'Note Added',
    performedBy,
    performedByName,
    performedByEmail: '',
    performedByRole: '',
    note: note || `Status changed to ${newStatus}`,
    previousStatus,
    newStatus,
  })
}

export async function updateRiskLevel(
  assignmentId: string,
  riskLevel: RiskLevel,
  performedBy: string,
  performedByName: string,
  note = ''
): Promise<void> {
  await updateM05Assignment(assignmentId, { riskLevel })
  await recordHistory({
    assignmentId,
    action: 'Risk Updated',
    performedBy,
    performedByName,
    performedByEmail: '',
    performedByRole: '',
    note: note || `Risk updated to ${riskLevel}`,
    previousStatus: '',
    newStatus: '',
  })
}

// ── Assignment History ────────────────────────────────────────────────────────

export async function recordHistory(
  entry: Omit<AssignmentHistory, 'id' | 'timestamp'>
): Promise<void> {
  await addDoc(collection(db, 'assignmentHistory'), {
    ...entry,
    timestamp: new Date().toISOString(),
  })
}

export async function getAssignmentHistory(
  assignmentId: string,
  maxResults = 50
): Promise<AssignmentHistory[]> {
  const q = query(
    collection(db, 'assignmentHistory'),
    where('assignmentId', '==', assignmentId),
    orderBy('timestamp', 'desc'),
    limit(maxResults)
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as AssignmentHistory)
}

// ── Daily Engineering Check-in ────────────────────────────────────────────────

export async function submitDailyCheckin(
  checkin: Omit<DailyCheckin, 'id'>
): Promise<void> {
  const docId = `${checkin.developerId}_${checkin.date}`
  await setDoc(doc(db, 'dailyEngineeringCheckins', docId), {
    ...checkin,
    id: docId,
  })
}

export async function getTodayCheckin(
  developerId: string,
  date: string
): Promise<DailyCheckin | null> {
  const docId = `${developerId}_${date}`
  const snap = await getDoc(doc(db, 'dailyEngineeringCheckins', docId))
  return snap.exists() ? (snap.data() as DailyCheckin) : null
}

export async function getCheckinHistory(
  developerId: string,
  maxResults = 14
): Promise<DailyCheckin[]> {
  const q = query(
    collection(db, 'dailyEngineeringCheckins'),
    where('developerId', '==', developerId),
    orderBy('date', 'desc'),
    limit(maxResults)
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => d.data() as DailyCheckin)
}

// ── Weekly Reports ────────────────────────────────────────────────────────────

export async function saveWeeklyReport(
  report: Omit<WeeklyEngineeringReport, 'id'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'weeklyEngineeringReports'), report)
  await updateDoc(ref, { id: ref.id })
  return ref.id
}

export async function getWeeklyReports(
  developerId: string,
  maxResults = 12
): Promise<WeeklyEngineeringReport[]> {
  const q = query(
    collection(db, 'weeklyEngineeringReports'),
    where('developerId', '==', developerId),
    orderBy('weekStartDate', 'desc'),
    limit(maxResults)
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => d.data() as WeeklyEngineeringReport)
}

// ── Developer Capacity ────────────────────────────────────────────────────────

export async function getDeveloperCapacity(
  developerId: string
): Promise<DeveloperCapacity | null> {
  const snap = await getDoc(doc(db, 'developerCapacity', developerId))
  return snap.exists() ? (snap.data() as DeveloperCapacity) : null
}

export async function upsertDeveloperCapacity(cap: DeveloperCapacity): Promise<void> {
  await setDoc(doc(db, 'developerCapacity', cap.developerId), {
    ...cap,
    lastUpdated: new Date().toISOString(),
  })
}

export async function recalculateCapacity(
  developerId: string,
  developerName: string,
  weeklyCapacityHours = 40
): Promise<DeveloperCapacity> {
  // Load all active assignments for this developer
  const q = query(
    collection(db, 'assignments'),
    where('developerId', '==', developerId),
    where('status', 'in', ['Assigned', 'Accepted', 'In Progress', 'Blocked', 'Ready For QA', 'QA Review', 'Ready For Architect', 'Architect Review'])
  )
  const snap = await getDocs(q)
  const activeAssignments = snap.docs.length
  const currentAssignedHours = snap.docs.reduce((sum, d) => sum + ((d.data() as M05Assignment).estimatedHours ?? 0), 0)
  const remainingHours = Math.max(0, weeklyCapacityHours - currentAssignedHours)
  const capacityPercent = Math.min(100, Math.round((currentAssignedHours / weeklyCapacityHours) * 100))

  const cap: DeveloperCapacity = {
    developerId,
    developerName,
    weeklyCapacityHours,
    currentAssignedHours,
    remainingHours,
    capacityPercent,
    activeAssignments,
    lastUpdated: new Date().toISOString(),
  }
  await upsertDeveloperCapacity(cap)
  return cap
}

export async function getAllCapacities(): Promise<DeveloperCapacity[]> {
  const snap = await getDocs(collection(db, 'developerCapacity'))
  return snap.docs.map(d => d.data() as DeveloperCapacity)
}

// ── Notifications ─────────────────────────────────────────────────────────────

export async function createNotification(
  n: Omit<M05Notification, 'id' | 'read' | 'createdAt' | 'readAt'>
): Promise<void> {
  await addDoc(collection(db, 'notifications'), {
    ...n,
    read: false,
    createdAt: new Date().toISOString(),
    readAt: '',
  })
}

export async function getNotifications(
  recipientId: string,
  maxResults = 30
): Promise<M05Notification[]> {
  const q = query(
    collection(db, 'notifications'),
    where('recipientId', '==', recipientId),
    orderBy('createdAt', 'desc'),
    limit(maxResults)
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as M05Notification)
}

export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(db, 'notifications', id), {
    read: true,
    readAt: new Date().toISOString(),
  })
}

export async function markAllNotificationsRead(recipientId: string): Promise<void> {
  const notifications = await getNotifications(recipientId)
  const unread = notifications.filter(n => !n.read)
  await Promise.all(unread.map(n => markNotificationRead(n.id)))
}

export async function getUnreadCount(recipientId: string): Promise<number> {
  const q = query(
    collection(db, 'notifications'),
    where('recipientId', '==', recipientId),
    where('read', '==', false)
  )
  const snap = await getDocs(q)
  return snap.size
}

// ── Comments ──────────────────────────────────────────────────────────────────

export async function addComment(
  comment: Omit<AssignmentComment, 'id' | 'createdAt' | 'edited'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'assignmentComments'), {
    ...comment,
    createdAt: new Date().toISOString(),
    edited: false,
  })
  return ref.id
}

export async function getComments(assignmentId: string): Promise<AssignmentComment[]> {
  const q = query(
    collection(db, 'assignmentComments'),
    where('assignmentId', '==', assignmentId),
    orderBy('createdAt', 'asc')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as AssignmentComment)
}

// ── Notification type label helper ────────────────────────────────────────────

export function notificationTypeLabel(type: NotificationType): string {
  switch (type) {
    case 'assignment_received':          return 'New Assignment'
    case 'assignment_accepted':          return 'Assignment Accepted'
    case 'assignment_declined':          return 'Assignment Declined'
    case 'qa_requested':                 return 'QA Review Requested'
    case 'architect_review_requested':   return 'Architect Review Requested'
    case 'deadline_reminder':            return 'Deadline Reminder'
    case 'evidence_missing':             return 'Evidence Missing'
    case 'weekly_reminder':              return 'Weekly Report Due'
  }
}

// ── History action helper ─────────────────────────────────────────────────────

export async function recordAssignAction(
  assignmentId: string,
  action: AssignmentHistoryAction,
  performedBy: string,
  performedByName: string,
  performedByEmail: string,
  performedByRole: string,
  note: string,
  previousStatus = '',
  newStatus = ''
): Promise<void> {
  await recordHistory({
    assignmentId,
    action,
    performedBy,
    performedByName,
    performedByEmail,
    performedByRole,
    note,
    previousStatus,
    newStatus,
  })
}
