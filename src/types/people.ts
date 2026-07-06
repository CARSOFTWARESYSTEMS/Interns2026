// ── People Operations — Core Data Model ────────────────────────────────────
// Foundation types for the People Operations module (interns, employees,
// contractors). Deterministic, JSON-first, Firestore-ready. No AI provider
// integration of any kind belongs in this file or its consumers.

// ── Shared envelope ─────────────────────────────────────────────────────────
// Every People Operations document carries this envelope in addition to its
// own fields.
export interface PeopleDocBase {
  partnerId: string
  organisationId: string
  createdAt: string   // ISO 8601
  updatedAt: string   // ISO 8601
  createdBy: string   // uid
  status: string       // per-collection status enum, stored loosely here
}

export const DEFAULT_PARTNER_ID = 'itelematics'
export const DEFAULT_ORGANISATION_ID = 'ev-engineer'

// ── Person / Employment ──────────────────────────────────────────────────────

export type EmploymentType = 'intern' | 'employee' | 'contractor'

export type PersonStatus =
  | 'candidate' | 'onboarding' | 'active' | 'inactive'
  | 'on_notice' | 'exited' | 'blocked'

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  intern:     'Intern',
  employee:   'Full-Time Employee',
  contractor: 'Contractor',
}

export const PERSON_STATUS_LABELS: Record<PersonStatus, string> = {
  candidate:  'Candidate',
  onboarding: 'Onboarding',
  active:     'Active',
  inactive:   'Inactive',
  on_notice:  'On Notice',
  exited:     'Exited',
  blocked:    'Blocked',
}

export interface PolicyAcknowledgementRef {
  policyId: string
  version: number
  acknowledgedAt: string
}

export interface PeopleProfile extends PeopleDocBase {
  id: string
  uid: string                 // linked platform user, if any
  displayName: string
  email: string
  photoURL: string
  employmentType: EmploymentType
  personStatus: PersonStatus
  department: string
  role: string
  managerId: string
  startDate: string
  endDate: string
  skills: string[]
  knowledgeAreas: string[]
  assignedWorkPackages: string[]
  policyAcknowledgements: PolicyAcknowledgementRef[]
  performanceNotes: string
}

// ── A.S.K.I. Score ───────────────────────────────────────────────────────────

export interface AskiScore {
  attitude: number          // /10
  skills: number            // /10
  knowledge: number         // /10
  integrity: number         // /10 — mandatory for hiring decisions
  communication: number     // /10
  ownership: number         // /10
  learningAbility: number   // /10
}

export function emptyAskiScore(): AskiScore {
  return { attitude: 0, skills: 0, knowledge: 0, integrity: 0, communication: 0, ownership: 0, learningAbility: 0 }
}

export function askiAverage(score: AskiScore): number {
  const vals = Object.values(score)
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
}

// ── Recruitment: Job Openings ────────────────────────────────────────────────

export type JobOpeningStatus = 'Open' | 'On Hold' | 'Closed' | 'Filled'

export interface PeopleJobOpening extends PeopleDocBase {
  id: string
  title: string
  department: string
  employmentType: EmploymentType
  openings: number
  description: string
  requirements: string[]
  location: string
  openingStatus: JobOpeningStatus
  hiringManagerId: string
}

// ── Recruitment: Candidate Pipeline ──────────────────────────────────────────

export type CandidateStage =
  | 'Applied' | 'Screening' | 'Shortlisted' | 'Assignment Sent'
  | 'Assignment Submitted' | 'Technical Interview' | 'HR Interview'
  | 'Offer Sent' | 'Offer Accepted' | 'Onboarding' | 'Joined'
  | 'Rejected' | 'Withdrawn' | 'Do Not Rehire'

export const CANDIDATE_STAGES: CandidateStage[] = [
  'Applied', 'Screening', 'Shortlisted', 'Assignment Sent',
  'Assignment Submitted', 'Technical Interview', 'HR Interview',
  'Offer Sent', 'Offer Accepted', 'Onboarding', 'Joined',
  'Rejected', 'Withdrawn', 'Do Not Rehire',
]

export interface PeopleCandidate extends PeopleDocBase {
  id: string
  name: string
  email: string
  mobile: string
  appliedForOpeningId: string
  employmentType: EmploymentType
  resumeLink: string
  stage: CandidateStage
  askiScore: AskiScore
  source: string
  notes: string
}

export interface PeopleApplication extends PeopleDocBase {
  id: string
  candidateId: string
  jobOpeningId: string
  appliedAt: string
  coverNote: string
  stage: CandidateStage
}

// ── Recruitment: Interviews ──────────────────────────────────────────────────

export type InterviewType = 'Technical' | 'HR' | 'Assignment Review' | 'Final'
export type InterviewOutcome = 'Pending' | 'Passed' | 'Failed' | 'On Hold'

export interface PeopleInterview extends PeopleDocBase {
  id: string
  candidateId: string
  interviewType: InterviewType
  scheduledAt: string
  interviewerId: string
  outcome: InterviewOutcome
  askiScore: AskiScore
  feedback: string
}

// ── Recruitment: Offers ──────────────────────────────────────────────────────

export type OfferStatus = 'Draft' | 'Sent' | 'Accepted' | 'Declined' | 'Withdrawn'

export interface PeopleOffer extends PeopleDocBase {
  id: string
  candidateId: string
  employmentType: EmploymentType
  role: string
  department: string
  proposedStartDate: string
  offerStatus: OfferStatus
  sentAt: string
  respondedAt: string
  notes: string
}

// ── Onboarding ────────────────────────────────────────────────────────────────

export type OnboardingTaskStatus = 'Pending' | 'In Progress' | 'Completed'

export interface OnboardingTask {
  key: string
  label: string
  status: OnboardingTaskStatus
  completedAt: string
}

export interface PeopleOnboarding extends PeopleDocBase {
  id: string
  candidateId: string
  personId: string
  employmentType: EmploymentType
  startDate: string
  tasks: OnboardingTask[]
  buddyId: string
  onboardingComplete: boolean
}

export function defaultOnboardingTasks(): OnboardingTask[] {
  const labels = [
    'Offer letter signed',
    'NDA acknowledged',
    'Laptop / equipment issued',
    'Accounts provisioned',
    'Policy acknowledgements collected',
    'Manager introduction',
    'First work package assigned',
  ]
  return labels.map((label, i) => ({ key: `task-${i}`, label, status: 'Pending', completedAt: '' }))
}

// ── 1:1 Reviews ───────────────────────────────────────────────────────────────

export interface AskiGoals extends AskiScore {}

export interface PeopleOneOnOneReview extends PeopleDocBase {
  id: string
  personId: string
  managerId: string
  month: string               // YYYY-MM
  whatWentWell: string
  whatDidNotGoWell: string
  blockers: string
  learningProgress: string
  engineeringProgress: string
  behaviourFeedback: string
  managerFeedback: string
  employeeFeedback: string
  nextMonthGoals: string
  resultGoals: string
  askiGoals: AskiGoals
  overallNotes: string
}

// ── Leave Management ──────────────────────────────────────────────────────────

export type LeaveType =
  | 'Casual Leave' | 'Sick Leave' | 'Emergency Leave' | 'Exam Leave'
  | 'Unpaid Leave' | 'Work From Home' | 'Comp Off'

export const LEAVE_TYPES: LeaveType[] = [
  'Casual Leave', 'Sick Leave', 'Emergency Leave', 'Exam Leave',
  'Unpaid Leave', 'Work From Home', 'Comp Off',
]

export type LeaveRequestStatus = 'Requested' | 'Manager Approved' | 'Rejected' | 'Cancelled'

export interface PeopleLeaveRequest extends PeopleDocBase {
  id: string
  personId: string
  leaveType: LeaveType
  startDate: string
  endDate: string
  days: number
  reason: string
  leaveStatus: LeaveRequestStatus
  approverId: string
  approverComments: string
}

// ── Policies ──────────────────────────────────────────────────────────────────

export type PolicyType =
  | 'NDA' | 'Confidentiality' | 'Code of Conduct' | 'Anti-Harassment'
  | 'Cybersecurity Policy' | 'Data Privacy' | 'IP Ownership'
  | 'Attendance Policy' | 'Remote Work Policy' | 'Leave Policy'
  | 'Performance Review Policy' | 'Termination Policy'

export const POLICY_TYPES: PolicyType[] = [
  'NDA', 'Confidentiality', 'Code of Conduct', 'Anti-Harassment',
  'Cybersecurity Policy', 'Data Privacy', 'IP Ownership',
  'Attendance Policy', 'Remote Work Policy', 'Leave Policy',
  'Performance Review Policy', 'Termination Policy',
]

export interface PeoplePolicy extends PeopleDocBase {
  id: string
  policyType: PolicyType
  version: number
  effectiveDate: string
  owner: string
  contentSummary: string
  acknowledgementRequired: boolean
}

export interface PeoplePolicyAcknowledgement extends PeopleDocBase {
  id: string
  policyId: string
  personId: string
  version: number
  acknowledgedAt: string
}

// ── Culture ───────────────────────────────────────────────────────────────────

export type CultureValue =
  | 'Integrity First' | 'Evidence Over Opinion' | 'Respectful Communication'
  | 'Learning Mindset' | 'Mission Ownership' | 'Security Discipline'
  | 'Documentation Discipline' | 'Accountability'

export const CULTURE_VALUES: CultureValue[] = [
  'Integrity First', 'Evidence Over Opinion', 'Respectful Communication',
  'Learning Mindset', 'Mission Ownership', 'Security Discipline',
  'Documentation Discipline', 'Accountability',
]

export type CultureSignalType = 'Recognition' | 'Concern' | 'Feedback' | 'Improvement' | 'Policy Violation'

export const CULTURE_SIGNAL_TYPES: CultureSignalType[] = [
  'Recognition', 'Concern', 'Feedback', 'Improvement', 'Policy Violation',
]

export interface PeopleCultureSignal extends PeopleDocBase {
  id: string
  personId: string
  signalType: CultureSignalType
  cultureValue: CultureValue
  note: string
  raisedBy: string
  visibleToPerson: boolean
}

// ── Audit Logs ────────────────────────────────────────────────────────────────

export type PeopleAuditAction =
  | 'candidate_stage_changed' | 'interview_scheduled' | 'offer_sent'
  | 'offer_responded' | 'onboarding_task_completed' | 'profile_created'
  | 'profile_updated' | 'review_submitted' | 'leave_requested'
  | 'leave_status_changed' | 'policy_acknowledged' | 'culture_signal_raised'

export interface PeopleAuditLog extends PeopleDocBase {
  id: string
  uid: string
  action: PeopleAuditAction
  resource: string
  details: string
}

// ── People Dashboard aggregate ────────────────────────────────────────────────

export interface PeopleDashboardCounts {
  openRoles: number
  candidates: number
  interviewsPending: number
  offersPending: number
  onboarding: number
  activeInterns: number
  activeEmployees: number
  activeContractors: number
  leaveRequests: number
  reviewsDue: number
  policiesPendingAck: number
  cultureSignals: number
}
