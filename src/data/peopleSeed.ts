// ── People Operations — Deterministic Sample Data ───────────────────────────
// JSON-first seed data used as a display fallback when Firestore has no
// People Operations documents yet (fresh project / offline demo). Not written
// to Firestore automatically — pages read this only when a live query
// returns an empty list, so real data always takes precedence.

import type {
  PeopleProfile, PeopleJobOpening, PeopleCandidate, PeopleInterview,
  PeopleOffer, PeopleOnboarding, PeopleOneOnOneReview, PeopleLeaveRequest,
  PeoplePolicy, PeopleCultureSignal,
} from '../types/people'
import { DEFAULT_PARTNER_ID, DEFAULT_ORGANISATION_ID, emptyAskiScore, defaultOnboardingTasks } from '../types/people'

const base = {
  partnerId: DEFAULT_PARTNER_ID,
  organisationId: DEFAULT_ORGANISATION_ID,
  createdAt: '2026-06-01T09:00:00.000Z',
  updatedAt: '2026-06-01T09:00:00.000Z',
  createdBy: 'seed',
}

export const SEED_PEOPLE_PROFILES: PeopleProfile[] = [
  {
    ...base, id: 'profile-seed-1', uid: '', displayName: 'Ananya Rao', email: 'ananya.rao@example.com',
    photoURL: '', employmentType: 'intern', personStatus: 'active', department: 'Engineering',
    role: 'Battery Intelligence Intern', managerId: 'mgr-seed-1', startDate: '2026-01-12', endDate: '',
    skills: ['Python', 'Data Analysis'], knowledgeAreas: ['Battery Intelligence'], assignedWorkPackages: ['WP-104'],
    policyAcknowledgements: [], performanceNotes: 'Strong ownership on Story-104.', status: 'active',
  },
  {
    ...base, id: 'profile-seed-2', uid: '', displayName: 'Rohit Sharma', email: 'rohit.sharma@example.com',
    photoURL: '', employmentType: 'employee', personStatus: 'active', department: 'Engineering',
    role: 'Senior Software Engineer', managerId: 'mgr-seed-1', startDate: '2024-08-01', endDate: '',
    skills: ['TypeScript', 'Firebase', 'Systems Architecture'], knowledgeAreas: ['Connected Systems'],
    assignedWorkPackages: ['WP-100', 'WP-101'], policyAcknowledgements: [], performanceNotes: '', status: 'active',
  },
  {
    ...base, id: 'profile-seed-3', uid: '', displayName: 'Meera Iyer', email: 'meera.iyer@example.com',
    photoURL: '', employmentType: 'contractor', personStatus: 'active', department: 'QA',
    role: 'QA Contractor', managerId: 'mgr-seed-1', startDate: '2026-02-01', endDate: '2026-12-31',
    skills: ['Test Automation'], knowledgeAreas: ['Battery Safety'], assignedWorkPackages: [],
    policyAcknowledgements: [], performanceNotes: '', status: 'active',
  },
]

export const SEED_JOB_OPENINGS: PeopleJobOpening[] = [
  {
    ...base, id: 'opening-seed-1', title: 'EV Engineering Intern', department: 'Engineering',
    employmentType: 'intern', openings: 3, description: 'Work on EV powertrain simulators.',
    requirements: ['Python', 'Control Systems basics'], location: 'Bangalore (Remote)', openingStatus: 'Open',
    hiringManagerId: 'mgr-seed-1', status: 'Open',
  },
  {
    ...base, id: 'opening-seed-2', title: 'Battery Cybersecurity Contractor', department: 'Security',
    employmentType: 'contractor', openings: 1, description: 'BMS firmware hardening engagement.',
    requirements: ['Embedded Security', 'CAN bus'], location: 'Remote', openingStatus: 'Open',
    hiringManagerId: 'mgr-seed-1', status: 'Open',
  },
]

export const SEED_CANDIDATES: PeopleCandidate[] = [
  {
    ...base, id: 'candidate-seed-1', name: 'Kiran Kumar', email: 'kiran.kumar@example.com', mobile: '',
    appliedForOpeningId: 'opening-seed-1', employmentType: 'intern', resumeLink: '',
    stage: 'Technical Interview', askiScore: { ...emptyAskiScore(), attitude: 8, skills: 7, knowledge: 7, integrity: 9, communication: 8, ownership: 7, learningAbility: 8 },
    source: 'Campus Drive', notes: '', status: 'Technical Interview',
  },
  {
    ...base, id: 'candidate-seed-2', name: 'Sara Fernandes', email: 'sara.fernandes@example.com', mobile: '',
    appliedForOpeningId: 'opening-seed-1', employmentType: 'intern', resumeLink: '',
    stage: 'Shortlisted', askiScore: emptyAskiScore(), source: 'Referral', notes: '', status: 'Shortlisted',
  },
  {
    ...base, id: 'candidate-seed-3', name: 'Devansh Patel', email: 'devansh.patel@example.com', mobile: '',
    appliedForOpeningId: 'opening-seed-2', employmentType: 'contractor', resumeLink: '',
    stage: 'Offer Sent', askiScore: { ...emptyAskiScore(), attitude: 9, skills: 9, knowledge: 8, integrity: 9, communication: 7, ownership: 8, learningAbility: 8 },
    source: 'LinkedIn', notes: '', status: 'Offer Sent',
  },
]

export const SEED_INTERVIEWS: PeopleInterview[] = [
  {
    ...base, id: 'interview-seed-1', candidateId: 'candidate-seed-1', interviewType: 'Technical',
    scheduledAt: '2026-07-10T10:00:00.000Z', interviewerId: 'mgr-seed-1', outcome: 'Pending',
    askiScore: emptyAskiScore(), feedback: '', status: 'Pending',
  },
]

export const SEED_OFFERS: PeopleOffer[] = [
  {
    ...base, id: 'offer-seed-1', candidateId: 'candidate-seed-3', employmentType: 'contractor',
    role: 'Battery Cybersecurity Contractor', department: 'Security', proposedStartDate: '2026-08-01',
    offerStatus: 'Sent', sentAt: '2026-07-01T09:00:00.000Z', respondedAt: '', notes: '', status: 'Sent',
  },
]

export const SEED_ONBOARDING: PeopleOnboarding[] = [
  {
    ...base, id: 'onboarding-seed-1', candidateId: '', personId: 'profile-seed-1', employmentType: 'intern',
    startDate: '2026-01-12', tasks: defaultOnboardingTasks().map((t, i) => i < 5 ? { ...t, status: 'Completed', completedAt: base.createdAt } : t),
    buddyId: 'profile-seed-2', onboardingComplete: false, status: 'in_progress',
  },
]

export const SEED_REVIEWS: PeopleOneOnOneReview[] = [
  {
    ...base, id: 'review-seed-1', personId: 'profile-seed-1', managerId: 'mgr-seed-1', month: '2026-06',
    whatWentWell: 'Delivered Story-104 simulator ahead of schedule.', whatDidNotGoWell: 'Documentation lagged.',
    blockers: 'None', learningProgress: 'Completed battery SoC estimation module.', engineeringProgress: 'On track',
    behaviourFeedback: 'Collaborative, asks good questions.', managerFeedback: 'Keep pushing on documentation discipline.',
    employeeFeedback: 'Would like more architecture exposure.', nextMonthGoals: 'Own README + API docs for WP-104.',
    resultGoals: 'Ship WP-104 to QA.', askiGoals: { ...emptyAskiScore(), attitude: 8, skills: 8, knowledge: 7, integrity: 9, communication: 7, ownership: 8, learningAbility: 8 },
    overallNotes: '', status: 'submitted',
  },
]

export const SEED_LEAVE_REQUESTS: PeopleLeaveRequest[] = [
  {
    ...base, id: 'leave-seed-1', personId: 'profile-seed-1', leaveType: 'Casual Leave',
    startDate: '2026-07-15', endDate: '2026-07-16', days: 2, reason: 'Personal', leaveStatus: 'Requested',
    approverId: '', approverComments: '', status: 'Requested',
  },
]

export const SEED_POLICIES: PeoplePolicy[] = [
  {
    ...base, id: 'policy-seed-1', policyType: 'NDA', version: 1, effectiveDate: '2026-01-01',
    owner: 'Platform Admin', contentSummary: 'Confidentiality obligations for all interns, employees and contractors.',
    acknowledgementRequired: true, status: 'active',
  },
  {
    ...base, id: 'policy-seed-2', policyType: 'Code of Conduct', version: 1, effectiveDate: '2026-01-01',
    owner: 'Platform Admin', contentSummary: 'Expected behaviour, respectful communication, and accountability standards.',
    acknowledgementRequired: true, status: 'active',
  },
  {
    ...base, id: 'policy-seed-3', policyType: 'Data Privacy', version: 1, effectiveDate: '2026-01-01',
    owner: 'Platform Admin', contentSummary: 'Handling of personal and battery telemetry data.',
    acknowledgementRequired: true, status: 'active',
  },
]

export const SEED_CULTURE_SIGNALS: PeopleCultureSignal[] = [
  {
    ...base, id: 'culture-seed-1', personId: 'profile-seed-1', signalType: 'Recognition',
    cultureValue: 'Evidence Over Opinion', note: 'Backed the SoC estimation change with a full test report.',
    raisedBy: 'mgr-seed-1', visibleToPerson: true, status: 'logged',
  },
  {
    ...base, id: 'culture-seed-2', personId: 'profile-seed-2', signalType: 'Feedback',
    cultureValue: 'Documentation Discipline', note: 'Encouraged to keep API docs current with each PR.',
    raisedBy: 'mgr-seed-1', visibleToPerson: true, status: 'logged',
  },
]
