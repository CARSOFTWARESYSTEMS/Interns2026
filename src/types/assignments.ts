// ── M05 Assignment Management System ─────────────────────────────────────────
// Firestore-backed types. These coexist with the legacy JSON-based Assignment
// type in src/types.ts which powers the local/gdrive data modes.

export type AssignmentCategory =
  | 'Simulator' | 'Story' | 'QA' | 'Architect' | 'Research' | 'Mentor' | 'Support'

export type AssignmentRole =
  | 'Primary Developer' | 'Secondary Developer' | 'QA Reviewer'
  | 'Architect' | 'Observer' | 'Mentor'

export type M05AssignmentStatus =
  | 'Draft'
  | 'Assigned'
  | 'Accepted'
  | 'Declined'
  | 'In Progress'
  | 'Blocked'
  | 'Ready For QA'
  | 'QA Review'
  | 'QA Passed'
  | 'QA Failed'
  | 'Ready For Architect'
  | 'Architect Review'
  | 'Approved'
  | 'Released'
  | 'Archived'

export type RiskLevel = 'Green' | 'Yellow' | 'Red'

export type DeclineReason =
  | 'Already assigned'
  | 'Need clarification'
  | 'Lack of experience'
  | 'Timeline issue'
  | 'Personal reason'
  | 'Other'

export type AssignmentHistoryAction =
  | 'Assigned'
  | 'Accepted'
  | 'Declined'
  | 'Reassigned'
  | 'Blocked'
  | 'Completed'
  | 'QA Requested'
  | 'QA Passed'
  | 'QA Failed'
  | 'Architect Requested'
  | 'Approved'
  | 'Released'
  | 'Archived'
  | 'Note Added'
  | 'Risk Updated'
  | 'Hours Updated'

export type NotificationType =
  | 'assignment_received'
  | 'assignment_accepted'
  | 'assignment_declined'
  | 'qa_requested'
  | 'architect_review_requested'
  | 'deadline_reminder'
  | 'evidence_missing'
  | 'weekly_reminder'

// ── Core M05Assignment document (stored in `assignments` collection) ──────────

export interface M05Assignment {
  id: string                        // Firestore document ID
  assignmentId: string              // same as id
  developerId: string               // Firebase Auth UID
  developerName: string
  developerEmail: string
  productId: string
  productName: string
  workPackageId: string
  milestoneId: string
  storyId: string
  storyTitle: string
  simulatorId: string
  simulatorTitle: string
  assignmentCategory: AssignmentCategory
  assignmentRole: AssignmentRole
  status: M05AssignmentStatus
  priority: 'Critical' | 'High' | 'Medium' | 'Low'
  estimatedHours: number
  actualHours: number
  plannedStartDate: string          // ISO 8601
  plannedEndDate: string
  acceptedDate: string
  completedDate: string
  assignedBy: string                // UID of assigning manager
  assignedByName: string
  assignedDate: string
  lastUpdated: string
  declineReason: string
  managerNotes: string
  developerNotes: string
  riskLevel: RiskLevel
}

// ── AssignmentHistory document (stored in `assignmentHistory` collection) ─────

export interface AssignmentHistory {
  id: string
  assignmentId: string
  action: AssignmentHistoryAction
  performedBy: string               // UID
  performedByName: string
  performedByEmail: string
  performedByRole: string
  timestamp: string
  note: string
  previousStatus: string
  newStatus: string
}

// ── DailyCheckin document (stored in `dailyEngineeringCheckins` collection) ───
// Document ID format: `{developerId}_{YYYY-MM-DD}`

export interface DailyCheckin {
  id: string
  developerId: string
  developerName: string
  date: string                      // YYYY-MM-DD
  yesterdayWork: string
  todayPlan: string
  storyAssignments: string[]        // story IDs being worked on
  simulatorAssignments: string[]    // simulator IDs being worked on
  estimatedHours: number
  actualHoursYesterday: number
  progressPercentage: number        // 0–100
  blockers: string
  riskLevel: RiskLevel
  plannedEvidence: string
  submittedAt: string               // ISO 8601
}

// ── WeeklyEngineeringReport (`weeklyEngineeringReports` collection) ───────────

export interface WeeklyEngineeringReport {
  id: string
  developerId: string
  developerName: string
  weekStartDate: string             // YYYY-MM-DD (Monday)
  weekEndDate: string               // YYYY-MM-DD (Sunday)
  hoursWorked: number
  storiesProgress: number           // 0–100
  simulatorProgress: number
  evidenceUploaded: number
  qaStatus: string
  architectureStatus: string
  overallPercent: number
  managerComments: string
  developerComments: string
  generatedAt: string
  submittedAt: string
}

// ── DeveloperCapacity (`developerCapacity` collection) ───────────────────────

export interface DeveloperCapacity {
  developerId: string
  developerName: string
  weeklyCapacityHours: number       // default 40
  currentAssignedHours: number      // sum of estimatedHours for active assignments
  remainingHours: number
  capacityPercent: number           // 0–100
  activeAssignments: number
  lastUpdated: string
}

// ── M05Notification (`notifications` collection) ─────────────────────────────

export interface M05Notification {
  id: string
  recipientId: string               // Firebase Auth UID
  recipientEmail: string
  type: NotificationType
  title: string
  message: string
  assignmentId: string
  read: boolean
  createdAt: string
  readAt: string
}

// ── AssignmentComment (`assignmentComments` collection) ──────────────────────

export interface AssignmentComment {
  id: string
  assignmentId: string
  authorId: string
  authorName: string
  authorRole: string
  text: string
  createdAt: string
  edited: boolean
}

// ── Helper: empty M05Assignment (for form initialisation) ────────────────────

export function emptyM05Assignment(): Omit<M05Assignment, 'id' | 'assignmentId'> {
  const now = new Date().toISOString()
  return {
    developerId: '', developerName: '', developerEmail: '',
    productId: '', productName: '', workPackageId: '', milestoneId: '',
    storyId: '', storyTitle: '', simulatorId: '', simulatorTitle: '',
    assignmentCategory: 'Story', assignmentRole: 'Primary Developer',
    status: 'Draft', priority: 'High',
    estimatedHours: 40, actualHours: 0,
    plannedStartDate: '', plannedEndDate: '',
    acceptedDate: '', completedDate: '',
    assignedBy: '', assignedByName: '', assignedDate: now,
    lastUpdated: now, declineReason: '', managerNotes: '', developerNotes: '',
    riskLevel: 'Green',
  }
}

// ── Status colour helper ──────────────────────────────────────────────────────

export function m05StatusColor(status: M05AssignmentStatus): string {
  switch (status) {
    case 'Draft':               return 'bg-slate-100 text-slate-600'
    case 'Assigned':            return 'bg-blue-100 text-blue-700'
    case 'Accepted':            return 'bg-brand-100 text-brand-700'
    case 'Declined':            return 'bg-red-100 text-red-700'
    case 'In Progress':         return 'bg-indigo-100 text-indigo-700'
    case 'Blocked':             return 'bg-red-100 text-red-800'
    case 'Ready For QA':        return 'bg-amber-100 text-amber-700'
    case 'QA Review':           return 'bg-yellow-100 text-yellow-800'
    case 'QA Passed':           return 'bg-teal-100 text-teal-700'
    case 'QA Failed':           return 'bg-red-100 text-red-700'
    case 'Ready For Architect': return 'bg-purple-100 text-purple-700'
    case 'Architect Review':    return 'bg-violet-100 text-violet-700'
    case 'Approved':            return 'bg-green-100 text-green-700'
    case 'Released':            return 'bg-emerald-100 text-emerald-800'
    case 'Archived':            return 'bg-slate-100 text-slate-500'
  }
}

export function riskColor(risk: RiskLevel): string {
  return risk === 'Green' ? 'text-green-600' : risk === 'Yellow' ? 'text-amber-600' : 'text-red-600'
}

export function riskBg(risk: RiskLevel): string {
  return risk === 'Green' ? 'bg-green-100 border-green-200' : risk === 'Yellow' ? 'bg-amber-100 border-amber-200' : 'bg-red-100 border-red-200'
}

// ── Today's date key for check-in localStorage ────────────────────────────────

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10)   // YYYY-MM-DD
}

export function checkinLocalKey(uid: string): string {
  return `checkin_${uid}_${todayKey()}`
}
