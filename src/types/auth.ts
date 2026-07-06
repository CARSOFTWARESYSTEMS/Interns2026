// ── Super Admins ──────────────────────────────────────────────────────────
// These emails always receive Platform Admin role regardless of Firestore.
export const SUPER_ADMIN_EMAILS: ReadonlySet<string> = new Set([
  'carsoftwaresystems@gmail.com',
  'sudarshana.karkala@gmail.com',
])

// ── Roles & Permissions ───────────────────────────────────────────────────

export type UserRole =
  | 'Platform Admin'
  | 'Engineering Manager'
  | 'Architect'
  | 'QA Engineer'
  | 'Developer'
  | 'Viewer'
  | 'HR Manager'

export type UserStatus = 'Pending' | 'Active' | 'Blocked' | 'Inactive' | 'Deleted' | 'Suspended'

// ── People Operations role mapping ──────────────────────────────────────────
// People Operations MVP does not introduce a full new role hierarchy — it maps
// onto existing platform roles plus one new role ('HR Manager'). This mapping
// is consumed by People Operations pages/services and firestore.rules; it does
// not alter behaviour of any existing (non-People) route or permission.
export type PeopleAccessLevel = 'full' | 'org' | 'team' | 'people_ops' | 'self' | 'read_only' | 'none'

export const PEOPLE_ROLE_ACCESS: Record<UserRole, PeopleAccessLevel> = {
  'Platform Admin':      'full',        // full access
  'Engineering Manager': 'team',        // team people access (treated as "Manager")
  'HR Manager':          'people_ops',  // people operations access
  'Architect':           'self',        // self profile, self leave, self reviews only
  'QA Engineer':         'self',
  'Developer':           'self',        // covers intern/employee/contractor engineers
  'Viewer':              'read_only',   // read-only if allowed
}

// Flat permission strings checked by RoleGuard
const _ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  'Platform Admin':       ['*'],
  'Engineering Manager':  ['assignments:write', 'reports:read', 'users:read', 'stories:write', 'developers:write', 'qa:assign', 'architect:assign', 'weekly:approve', 'people:team'],
  'Architect':            ['architecture:approve', 'evidence:approve', 'stories:read', 'simulators:read', 'assignments:read', 'people:self'],
  'QA Engineer':          ['stories:qa', 'evidence:verify', 'assigned:read', 'people:self'],
  'Developer':            ['own:read', 'own:write', 'people:self'],
  'Viewer':               ['dashboard:read', 'stories:read', 'simulators:read', 'reports:read', 'people:read'],
  'HR Manager':           ['people:write', 'people:read', 'people:recruitment', 'people:leave:approve', 'people:policies:write'],
}

export function hasPermission(role: UserRole, action: string): boolean {
  const perms = _ROLE_PERMISSIONS[role] ?? []
  return perms.includes('*') || perms.includes(action) || perms.includes(action.split(':')[0] + ':*')
}

// People Operations routes that require org/team/people_ops-level access.
// Self-level roles (Developer/Architect/QA Engineer) are restricted to their
// own profile, leave and reviews — enforced at the data layer, not the route
// layer, since /people/profiles etc. render a single-person view for them.
const PEOPLE_MANAGED_ROUTES = [
  '/people/recruitment', '/people/candidates', '/people/interviews',
  '/people/offers', '/people/onboarding', '/people/policies',
]

export function canAccessRoute(role: UserRole, path: string): boolean {
  // Routes openly accessible to authenticated users with a complete profile
  const publicRoutes = ['/', '/profile', '/my-dashboard', '/403', '/404']
  if (publicRoutes.includes(path)) return true

  // Admin-only routes
  if (path.startsWith('/admin')) return role === 'Platform Admin'

  // People Operations — recruitment/pipeline/policy management routes are
  // restricted to full/org/team/people_ops access levels.
  if (PEOPLE_MANAGED_ROUTES.some(r => path === r || path.startsWith(r + '/'))) {
    const level = PEOPLE_ROLE_ACCESS[role]
    return level === 'full' || level === 'org' || level === 'team' || level === 'people_ops'
  }

  // Developer can only see own story/simulator (enforced at data layer)
  if (role === 'Developer') {
    const allowed = ['/assignments', '/stories', '/simulators', '/evidence', '/qa', '/weekly', '/demo', '/people']
    return allowed.some(r => path === r || path.startsWith(r + '/'))
  }

  // Viewer: read-only access to main pages
  if (role === 'Viewer') {
    const allowed = ['/', '/stories', '/simulators', '/developers', '/assignments', '/reports', '/evidence', '/people']
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
  profileComplete: boolean    // @deprecated — kept for backward compat; use profileCompleted
  profileCompleted: boolean   // true once the wizard is finished and persisted to Firestore
  profileCompletedAt: string  // ISO 8601 timestamp of first completion
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
    profileComplete: false, profileCompleted: false, profileCompletedAt: '',
  }
}

// ── Engineering Competencies ──────────────────────────────────────────────

export const COMPETENCY_KEYS = [
  'aerospaceEngineering',
  'electricVehicleEngineering',
  'batteryIntelligence',
  'batteryCybersecurity',
  'artificialIntelligence',
  'quantumComputing',
  'digitalTwinEngineering',
  'batterySafetyReliability',
  'connectedSystemsTelematics',
  'systemsEngineeringArchitecture',
] as const

export type EngineeringCompetencyKey = (typeof COMPETENCY_KEYS)[number]

export const COMPETENCY_LABELS: Record<EngineeringCompetencyKey, string> = {
  aerospaceEngineering:           'Aerospace Engineering',
  electricVehicleEngineering:     'EV Engineering',
  batteryIntelligence:            'Battery Intelligence',
  batteryCybersecurity:           'Battery Cybersecurity',
  artificialIntelligence:         'AI / ML',
  quantumComputing:               'Quantum Computing',
  digitalTwinEngineering:         'Digital Twin',
  batterySafetyReliability:       'Battery Safety',
  connectedSystemsTelematics:     'Connected Systems',
  systemsEngineeringArchitecture: 'Systems Architecture',
}

export const COMPETENCY_FULL_LABELS: Record<EngineeringCompetencyKey, string> = {
  aerospaceEngineering:           'Aerospace Engineering',
  electricVehicleEngineering:     'Electric Vehicle Engineering',
  batteryIntelligence:            'Battery Intelligence',
  batteryCybersecurity:           'Battery Cybersecurity',
  artificialIntelligence:         'Artificial Intelligence (AI/ML)',
  quantumComputing:               'Quantum Computing',
  digitalTwinEngineering:         'Digital Twin Engineering',
  batterySafetyReliability:       'Battery Safety & Reliability',
  connectedSystemsTelematics:     'Connected Systems & Telematics',
  systemsEngineeringArchitecture: 'Systems Engineering & Software Architecture',
}

export const COMPETENCY_DESCRIPTIONS: Record<EngineeringCompetencyKey, string> = {
  aerospaceEngineering:           'Flight dynamics, propulsion, avionics, and space systems applied to EV and UAV platforms.',
  electricVehicleEngineering:     'End-to-end EV design: powertrain, charging systems, BMS, and motor control.',
  batteryIntelligence:            'Electrochemistry, SoC/SoH estimation, cell modelling, and battery data analytics.',
  batteryCybersecurity:           'Attack surface analysis, V2G security, BMS firmware hardening, and CAN bus protection.',
  artificialIntelligence:         'ML models, deep learning, and predictive analytics applied to battery and EV systems.',
  quantumComputing:               'Quantum algorithms, optimisation, and simulation for battery chemistry and materials.',
  digitalTwinEngineering:         'Physics-based modelling, simulation, virtual validation, and HIL/SIL testing.',
  batterySafetyReliability:       'Thermal runaway prevention, FMEA, ISO 26262, and functional safety engineering.',
  connectedSystemsTelematics:     'OTA updates, telematics protocols, fleet management, and V2X communication.',
  systemsEngineeringArchitecture: 'MBSE, RTOS, distributed architecture, and CI/CD for embedded systems.',
}

/** Labels for the 1–5 competency rating scale */
export const COMPETENCY_LEVEL_LABELS = [
  '',                           // 0 — not rated
  'Foundation',                 // 1
  'Practitioner',               // 2
  'Advanced Engineer',          // 3
  'Technical Lead',             // 4
  'Subject Matter Expert (SME)',// 5
]

export type EngineeringCompetencyRatings = Record<EngineeringCompetencyKey, number> // 1–5, 0 = not rated

export interface UserSkills {
  uid: string
  ratings: EngineeringCompetencyRatings
  managerOverrides: Partial<EngineeringCompetencyRatings>
  updatedAt: string
}

export function emptyCompetencyRatings(): EngineeringCompetencyRatings {
  return Object.fromEntries(COMPETENCY_KEYS.map(k => [k, 0])) as EngineeringCompetencyRatings
}

// Legacy aliases — kept so old Firestore documents don't break reads
/** @deprecated use EngineeringCompetencyKey */
export type SkillKey = EngineeringCompetencyKey
/** @deprecated use EngineeringCompetencyRatings */
export type SkillRatings = EngineeringCompetencyRatings
/** @deprecated use COMPETENCY_KEYS */
export const SKILL_KEYS = COMPETENCY_KEYS
/** @deprecated use COMPETENCY_LABELS */
export const SKILL_LABELS = COMPETENCY_LABELS
/** @deprecated use emptyCompetencyRatings */
export const emptySkillRatings = emptyCompetencyRatings

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
