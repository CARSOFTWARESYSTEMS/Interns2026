// ── Roles & Permissions ───────────────────────────────────────────────────

export type UserRole =
  | 'Platform Admin'
  | 'Engineering Manager'
  | 'Architect'
  | 'QA Engineer'
  | 'Developer'
  | 'Viewer'

export type UserStatus = 'Pending' | 'Active' | 'Blocked' | 'Inactive' | 'Deleted' | 'Suspended'

// Flat permission strings checked by RoleGuard
const _ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  'Platform Admin':       ['*'],
  'Engineering Manager':  ['assignments:write', 'reports:read', 'users:read', 'stories:write', 'developers:write', 'qa:assign', 'architect:assign', 'weekly:approve'],
  'Architect':            ['architecture:approve', 'evidence:approve', 'stories:read', 'simulators:read', 'assignments:read'],
  'QA Engineer':          ['stories:qa', 'evidence:verify', 'assigned:read'],
  'Developer':            ['own:read', 'own:write'],
  'Viewer':               ['dashboard:read', 'stories:read', 'simulators:read', 'reports:read'],
}

export function hasPermission(role: UserRole, action: string): boolean {
  const perms = _ROLE_PERMISSIONS[role] ?? []
  return perms.includes('*') || perms.includes(action) || perms.includes(action.split(':')[0] + ':*')
}

export function canAccessRoute(role: UserRole, path: string): boolean {
  // Routes openly accessible to authenticated users with a complete profile
  const publicRoutes = ['/', '/profile', '/my-dashboard', '/403', '/404']
  if (publicRoutes.includes(path)) return true

  // Admin-only routes
  if (path.startsWith('/admin')) return role === 'Platform Admin'

  // Developer can only see own story/simulator (enforced at data layer)
  if (role === 'Developer') {
    const allowed = ['/assignments', '/stories', '/simulators', '/evidence', '/qa', '/weekly', '/demo']
    return allowed.some(r => path === r || path.startsWith(r + '/'))
  }

  // Viewer: read-only access to main pages
  if (role === 'Viewer') {
    const allowed = ['/', '/stories', '/simulators', '/developers', '/assignments', '/reports', '/evidence']
    return allowed.some(r => path === r || path.startsWith(r + '/'))
  }

  return true
}

// ── User Profile ──────────────────────────────────────────────────────────

export interface UserProfile {
  uid: string
  displayName: string
  email: string
  photoURL: string
  mobile: string
  linkedin: string
  github: string
  portfolio: string
  college: string
  degree: string
  specialization: string
  semester: string
  graduationYear: string
  city: string
  country: string
  resumeDriveLink: string
  bio: string
  experience: string          // e.g. "Fresher" | "1 year" | "2 years"
  createdAt: string           // ISO 8601
  updatedAt: string
  lastLogin: string
  status: UserStatus
  role: UserRole
  managerId: string
  architectId: string
  orgId: string
  profileComplete: boolean    // false until wizard is finished
}

export function calcProfileCompletion(p: UserProfile): number {
  const fields: (keyof UserProfile)[] = [
    'displayName', 'email', 'mobile', 'linkedin', 'github',
    'college', 'degree', 'specialization', 'graduationYear',
    'city', 'country', 'bio',
  ]
  const filled = fields.filter(f => p[f] && String(p[f]).trim().length > 0).length
  return Math.round((filled / fields.length) * 100)
}

export function buildEmptyProfile(uid: string, displayName: string, email: string, photoURL: string): UserProfile {
  const now = new Date().toISOString()
  return {
    uid, displayName, email, photoURL,
    mobile: '', linkedin: '', github: '', portfolio: '',
    college: '', degree: '', specialization: '', semester: '',
    graduationYear: '', city: '', country: '',
    resumeDriveLink: '', bio: '', experience: '',
    createdAt: now, updatedAt: now, lastLogin: now,
    status: 'Pending', role: 'Developer',
    managerId: '', architectId: '', orgId: 'ev-engineer',
    profileComplete: false,
  }
}

// ── Skills ────────────────────────────────────────────────────────────────

export const SKILL_KEYS = [
  'python', 'react', 'typescript', 'firebase', 'cybersecurity',
  'batteryEngineering', 'mqtt', 'fastapi', 'testing', 'git', 'ai', 'machineLearning',
] as const

export type SkillKey = (typeof SKILL_KEYS)[number]

export const SKILL_LABELS: Record<SkillKey, string> = {
  python:           'Python',
  react:            'React',
  typescript:       'TypeScript',
  firebase:         'Firebase',
  cybersecurity:    'Cybersecurity',
  batteryEngineering: 'Battery Eng.',
  mqtt:             'MQTT',
  fastapi:          'FastAPI',
  testing:          'Testing',
  git:              'Git',
  ai:               'AI',
  machineLearning:  'Machine Learning',
}

export type SkillRatings = Record<SkillKey, number> // 1–5, 0 = not rated

export interface UserSkills {
  uid: string
  ratings: SkillRatings
  managerOverrides: Partial<SkillRatings>  // manager can adjust ratings
  updatedAt: string
}

export function emptySkillRatings(): SkillRatings {
  return Object.fromEntries(SKILL_KEYS.map(k => [k, 0])) as SkillRatings
}

// ── Resume ────────────────────────────────────────────────────────────────

export type ResumeStatus = 'Active' | 'Archived' | 'Pending Review'

export interface ResumeVersion {
  version: number
  driveLink: string
  driveFolderId: string
  fileName: string
  fileSizeKB: number
  uploadDate: string
  status: ResumeStatus
}

export interface UserResume {
  uid: string
  current: ResumeVersion | null
  history: ResumeVersion[]
}

// ── Organization ──────────────────────────────────────────────────────────

export type OrgStatus = 'Active' | 'Inactive' | 'Suspended'

export interface Organization {
  id: string
  name: string
  logo: string
  domain: string
  status: OrgStatus
  managerId: string
  products: string[]
  createdAt: string
}

export interface OrganizationMember {
  uid: string
  orgId: string
  role: UserRole
  joinedAt: string
  invitedBy: string
}

// ── Audit Logs ────────────────────────────────────────────────────────────

export type AuditAction =
  | 'login' | 'logout' | 'profile_updated' | 'resume_uploaded'
  | 'role_changed' | 'story_assigned' | 'qa_assigned'
  | 'evidence_updated' | 'review_completed' | 'approval_given'
  | 'user_invited' | 'user_blocked' | 'user_deleted'

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  login:             'Signed In',
  logout:            'Signed Out',
  profile_updated:   'Profile Updated',
  resume_uploaded:   'Resume Uploaded',
  role_changed:      'Role Changed',
  story_assigned:    'Story Assigned',
  qa_assigned:       'QA Assigned',
  evidence_updated:  'Evidence Updated',
  review_completed:  'Review Completed',
  approval_given:    'Approval Given',
  user_invited:      'User Invited',
  user_blocked:      'User Blocked',
  user_deleted:      'User Deleted',
}

export interface AuditLog {
  id: string
  uid: string
  userEmail: string
  action: AuditAction
  resource: string
  details: string
  timestamp: string
  orgId: string
}

// ── Login History ─────────────────────────────────────────────────────────

export interface LoginHistory {
  id: string
  uid: string
  loginAt: string
  logoutAt: string
  browser: string
  device: string
  success: boolean
}

// ── Invitations ───────────────────────────────────────────────────────────

export type InvitationStatus = 'Pending' | 'Accepted' | 'Expired' | 'Cancelled'

export interface Invitation {
  id: string
  email: string
  name: string
  role: UserRole
  orgId: string
  invitedBy: string
  token: string
  status: InvitationStatus
  createdAt: string
  expiresAt: string
}
