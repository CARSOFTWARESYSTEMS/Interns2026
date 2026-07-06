import {
  doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc,
  collection, query, where, orderBy,
  getDocs,
} from 'firebase/firestore'
import { db } from './config'
import type {
  PeopleProfile, PeopleJobOpening, PeopleCandidate, PeopleApplication,
  PeopleInterview, PeopleOffer, PeopleOnboarding, PeopleOneOnOneReview,
  PeopleLeaveRequest, PeoplePolicy, PeoplePolicyAcknowledgement,
  PeopleCultureSignal, PeopleAuditLog, PeopleAuditAction,
  CandidateStage, LeaveRequestStatus, OfferStatus,
} from '../types/people'
import { DEFAULT_PARTNER_ID, DEFAULT_ORGANISATION_ID } from '../types/people'

// ── Envelope helper ───────────────────────────────────────────────────────────

function withEnvelope<T extends Record<string, unknown>>(
  data: T,
  createdBy: string,
  status: string
) {
  const now = new Date().toISOString()
  return {
    ...data,
    partnerId: DEFAULT_PARTNER_ID,
    organisationId: DEFAULT_ORGANISATION_ID,
    createdAt: now,
    updatedAt: now,
    createdBy,
    status,
  }
}

async function touch(collectionName: string, id: string, data: Record<string, unknown>) {
  await updateDoc(doc(db, collectionName, id), {
    ...data,
    updatedAt: new Date().toISOString(),
  })
}

// ── People Profiles ───────────────────────────────────────────────────────────

const PROFILES = 'peopleProfiles'

export async function createPeopleProfile(
  profile: Omit<PeopleProfile, 'id' | 'partnerId' | 'organisationId' | 'createdAt' | 'updatedAt' | 'status' | 'createdBy'>,
  createdBy: string
): Promise<string> {
  const ref = await addDoc(collection(db, PROFILES), withEnvelope(profile, createdBy, profile.personStatus))
  await updateDoc(ref, { id: ref.id })
  return ref.id
}

export async function getPeopleProfile(id: string): Promise<PeopleProfile | null> {
  const snap = await getDoc(doc(db, PROFILES, id))
  return snap.exists() ? (snap.data() as PeopleProfile) : null
}

export async function getAllPeopleProfiles(): Promise<PeopleProfile[]> {
  const snap = await getDocs(query(collection(db, PROFILES), orderBy('createdAt', 'desc')))
  return snap.docs.map(d => d.data() as PeopleProfile)
}

export async function updatePeopleProfile(id: string, data: Partial<PeopleProfile>): Promise<void> {
  await touch(PROFILES, id, data)
}

// ── Job Openings ───────────────────────────────────────────────────────────────

const OPENINGS = 'peopleJobOpenings'

export async function createJobOpening(
  opening: Omit<PeopleJobOpening, 'id' | 'partnerId' | 'organisationId' | 'createdAt' | 'updatedAt' | 'status' | 'createdBy'>,
  createdBy: string
): Promise<string> {
  const ref = await addDoc(collection(db, OPENINGS), withEnvelope(opening, createdBy, opening.openingStatus))
  await updateDoc(ref, { id: ref.id })
  return ref.id
}

export async function getAllJobOpenings(): Promise<PeopleJobOpening[]> {
  const snap = await getDocs(query(collection(db, OPENINGS), orderBy('createdAt', 'desc')))
  return snap.docs.map(d => d.data() as PeopleJobOpening)
}

export async function updateJobOpening(id: string, data: Partial<PeopleJobOpening>): Promise<void> {
  await touch(OPENINGS, id, data)
}

// ── Candidates ─────────────────────────────────────────────────────────────────

const CANDIDATES = 'peopleCandidates'

export async function createCandidate(
  candidate: Omit<PeopleCandidate, 'id' | 'partnerId' | 'organisationId' | 'createdAt' | 'updatedAt' | 'status' | 'createdBy'>,
  createdBy: string
): Promise<string> {
  const ref = await addDoc(collection(db, CANDIDATES), withEnvelope(candidate, createdBy, candidate.stage))
  await updateDoc(ref, { id: ref.id })
  await writePeopleAuditLog({ uid: createdBy, action: 'candidate_stage_changed', resource: `candidates/${ref.id}`, details: `Candidate created at stage ${candidate.stage}` })
  return ref.id
}

export async function getAllCandidates(): Promise<PeopleCandidate[]> {
  const snap = await getDocs(query(collection(db, CANDIDATES), orderBy('createdAt', 'desc')))
  return snap.docs.map(d => d.data() as PeopleCandidate)
}

export async function getCandidate(id: string): Promise<PeopleCandidate | null> {
  const snap = await getDoc(doc(db, CANDIDATES, id))
  return snap.exists() ? (snap.data() as PeopleCandidate) : null
}

export async function updateCandidateStage(
  id: string, stage: CandidateStage, performedBy: string
): Promise<void> {
  await touch(CANDIDATES, id, { stage })
  await writePeopleAuditLog({ uid: performedBy, action: 'candidate_stage_changed', resource: `candidates/${id}`, details: `Stage changed to ${stage}` })
}

export async function updateCandidate(id: string, data: Partial<PeopleCandidate>): Promise<void> {
  await touch(CANDIDATES, id, data)
}

// ── Applications ───────────────────────────────────────────────────────────────

const APPLICATIONS = 'peopleApplications'

export async function createApplication(
  application: Omit<PeopleApplication, 'id' | 'partnerId' | 'organisationId' | 'createdAt' | 'updatedAt' | 'status' | 'createdBy'>,
  createdBy: string
): Promise<string> {
  const ref = await addDoc(collection(db, APPLICATIONS), withEnvelope(application, createdBy, application.stage))
  await updateDoc(ref, { id: ref.id })
  return ref.id
}

export async function getApplicationsForCandidate(candidateId: string): Promise<PeopleApplication[]> {
  const q = query(collection(db, APPLICATIONS), where('candidateId', '==', candidateId))
  const snap = await getDocs(q)
  return snap.docs.map(d => d.data() as PeopleApplication)
}

// ── Interviews ─────────────────────────────────────────────────────────────────

const INTERVIEWS = 'peopleInterviews'

export async function createInterview(
  interview: Omit<PeopleInterview, 'id' | 'partnerId' | 'organisationId' | 'createdAt' | 'updatedAt' | 'status' | 'createdBy'>,
  createdBy: string
): Promise<string> {
  const ref = await addDoc(collection(db, INTERVIEWS), withEnvelope(interview, createdBy, interview.outcome))
  await updateDoc(ref, { id: ref.id })
  await writePeopleAuditLog({ uid: createdBy, action: 'interview_scheduled', resource: `interviews/${ref.id}`, details: `${interview.interviewType} interview scheduled` })
  return ref.id
}

export async function getAllInterviews(): Promise<PeopleInterview[]> {
  const snap = await getDocs(query(collection(db, INTERVIEWS), orderBy('scheduledAt', 'desc')))
  return snap.docs.map(d => d.data() as PeopleInterview)
}

export async function getInterviewsForCandidate(candidateId: string): Promise<PeopleInterview[]> {
  const q = query(collection(db, INTERVIEWS), where('candidateId', '==', candidateId))
  const snap = await getDocs(q)
  return snap.docs.map(d => d.data() as PeopleInterview)
}

export async function updateInterview(id: string, data: Partial<PeopleInterview>): Promise<void> {
  await touch(INTERVIEWS, id, data)
}

// ── Offers ─────────────────────────────────────────────────────────────────────

const OFFERS = 'peopleOffers'

export async function createOffer(
  offer: Omit<PeopleOffer, 'id' | 'partnerId' | 'organisationId' | 'createdAt' | 'updatedAt' | 'status' | 'createdBy'>,
  createdBy: string
): Promise<string> {
  const ref = await addDoc(collection(db, OFFERS), withEnvelope(offer, createdBy, offer.offerStatus))
  await updateDoc(ref, { id: ref.id })
  await writePeopleAuditLog({ uid: createdBy, action: 'offer_sent', resource: `offers/${ref.id}`, details: `Offer created (${offer.offerStatus})` })
  return ref.id
}

export async function getAllOffers(): Promise<PeopleOffer[]> {
  const snap = await getDocs(query(collection(db, OFFERS), orderBy('createdAt', 'desc')))
  return snap.docs.map(d => d.data() as PeopleOffer)
}

export async function updateOfferStatus(
  id: string, offerStatus: OfferStatus, performedBy: string
): Promise<void> {
  await touch(OFFERS, id, { offerStatus, respondedAt: new Date().toISOString() })
  await writePeopleAuditLog({ uid: performedBy, action: 'offer_responded', resource: `offers/${id}`, details: `Offer status changed to ${offerStatus}` })
}

// ── Onboarding ───────────────────────────────────────────────────────────────

const ONBOARDING = 'peopleOnboarding'

export async function createOnboarding(
  onboarding: Omit<PeopleOnboarding, 'id' | 'partnerId' | 'organisationId' | 'createdAt' | 'updatedAt' | 'status' | 'createdBy'>,
  createdBy: string
): Promise<string> {
  const ref = await addDoc(collection(db, ONBOARDING), withEnvelope(onboarding, createdBy, onboarding.onboardingComplete ? 'complete' : 'in_progress'))
  await updateDoc(ref, { id: ref.id })
  return ref.id
}

export async function getAllOnboarding(): Promise<PeopleOnboarding[]> {
  const snap = await getDocs(query(collection(db, ONBOARDING), orderBy('createdAt', 'desc')))
  return snap.docs.map(d => d.data() as PeopleOnboarding)
}

export async function updateOnboardingTask(
  id: string, tasks: PeopleOnboarding['tasks'], performedBy: string
): Promise<void> {
  const onboardingComplete = tasks.every(t => t.status === 'Completed')
  await touch(ONBOARDING, id, { tasks, onboardingComplete, status: onboardingComplete ? 'complete' : 'in_progress' })
  await writePeopleAuditLog({ uid: performedBy, action: 'onboarding_task_completed', resource: `onboarding/${id}`, details: 'Onboarding task list updated' })
}

// ── 1:1 Reviews ──────────────────────────────────────────────────────────────

const REVIEWS = 'peopleOneOnOneReviews'

export async function createOneOnOneReview(
  review: Omit<PeopleOneOnOneReview, 'id' | 'partnerId' | 'organisationId' | 'createdAt' | 'updatedAt' | 'status' | 'createdBy'>,
  createdBy: string
): Promise<string> {
  const ref = await addDoc(collection(db, REVIEWS), withEnvelope(review, createdBy, 'submitted'))
  await updateDoc(ref, { id: ref.id })
  await writePeopleAuditLog({ uid: createdBy, action: 'review_submitted', resource: `reviews/${ref.id}`, details: `1:1 review submitted for ${review.month}` })
  return ref.id
}

export async function getReviewsForPerson(personId: string): Promise<PeopleOneOnOneReview[]> {
  const q = query(collection(db, REVIEWS), where('personId', '==', personId), orderBy('month', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => d.data() as PeopleOneOnOneReview)
}

export async function getAllReviews(): Promise<PeopleOneOnOneReview[]> {
  const snap = await getDocs(query(collection(db, REVIEWS), orderBy('createdAt', 'desc')))
  return snap.docs.map(d => d.data() as PeopleOneOnOneReview)
}

// ── Leave Requests ─────────────────────────────────────────────────────────────

const LEAVE = 'peopleLeaveRequests'

export async function createLeaveRequest(
  leave: Omit<PeopleLeaveRequest, 'id' | 'partnerId' | 'organisationId' | 'createdAt' | 'updatedAt' | 'status' | 'createdBy'>,
  createdBy: string
): Promise<string> {
  const ref = await addDoc(collection(db, LEAVE), withEnvelope(leave, createdBy, leave.leaveStatus))
  await updateDoc(ref, { id: ref.id })
  await writePeopleAuditLog({ uid: createdBy, action: 'leave_requested', resource: `leave/${ref.id}`, details: `${leave.leaveType} requested (${leave.days} day(s))` })
  return ref.id
}

export async function getAllLeaveRequests(): Promise<PeopleLeaveRequest[]> {
  const snap = await getDocs(query(collection(db, LEAVE), orderBy('createdAt', 'desc')))
  return snap.docs.map(d => d.data() as PeopleLeaveRequest)
}

export async function getLeaveRequestsForPerson(personId: string): Promise<PeopleLeaveRequest[]> {
  const q = query(collection(db, LEAVE), where('personId', '==', personId), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => d.data() as PeopleLeaveRequest)
}

export async function updateLeaveStatus(
  id: string, leaveStatus: LeaveRequestStatus, approverId: string, approverComments = ''
): Promise<void> {
  await touch(LEAVE, id, { leaveStatus, approverId, approverComments, status: leaveStatus })
  await writePeopleAuditLog({ uid: approverId, action: 'leave_status_changed', resource: `leave/${id}`, details: `Leave ${leaveStatus}` })
}

// ── Policies ───────────────────────────────────────────────────────────────────

const POLICIES = 'peoplePolicies'

export async function createPolicy(
  policy: Omit<PeoplePolicy, 'id' | 'partnerId' | 'organisationId' | 'createdAt' | 'updatedAt' | 'status' | 'createdBy'>,
  createdBy: string
): Promise<string> {
  const ref = await addDoc(collection(db, POLICIES), withEnvelope(policy, createdBy, 'active'))
  await updateDoc(ref, { id: ref.id })
  return ref.id
}

export async function getAllPolicies(): Promise<PeoplePolicy[]> {
  const snap = await getDocs(query(collection(db, POLICIES), orderBy('effectiveDate', 'desc')))
  return snap.docs.map(d => d.data() as PeoplePolicy)
}

export async function updatePolicy(id: string, data: Partial<PeoplePolicy>): Promise<void> {
  await touch(POLICIES, id, data)
}

// ── Policy Acknowledgements ────────────────────────────────────────────────────

const POLICY_ACKS = 'peoplePolicyAcknowledgements'

export async function acknowledgePolicy(
  policyId: string, personId: string, version: number, createdBy: string
): Promise<string> {
  const ack: Omit<PeoplePolicyAcknowledgement, 'id' | 'partnerId' | 'organisationId' | 'createdAt' | 'updatedAt' | 'status' | 'createdBy'> = {
    policyId, personId, version, acknowledgedAt: new Date().toISOString(),
  }
  const ref = await addDoc(collection(db, POLICY_ACKS), withEnvelope(ack, createdBy, 'acknowledged'))
  await updateDoc(ref, { id: ref.id })
  await writePeopleAuditLog({ uid: createdBy, action: 'policy_acknowledged', resource: `policies/${policyId}`, details: `Acknowledged v${version}` })
  return ref.id
}

export async function getAcknowledgementsForPolicy(policyId: string): Promise<PeoplePolicyAcknowledgement[]> {
  const q = query(collection(db, POLICY_ACKS), where('policyId', '==', policyId))
  const snap = await getDocs(q)
  return snap.docs.map(d => d.data() as PeoplePolicyAcknowledgement)
}

export async function getAllPolicyAcknowledgements(): Promise<PeoplePolicyAcknowledgement[]> {
  const snap = await getDocs(collection(db, POLICY_ACKS))
  return snap.docs.map(d => d.data() as PeoplePolicyAcknowledgement)
}

// ── Culture Signals ────────────────────────────────────────────────────────────

const CULTURE = 'peopleCultureSignals'

export async function createCultureSignal(
  signal: Omit<PeopleCultureSignal, 'id' | 'partnerId' | 'organisationId' | 'createdAt' | 'updatedAt' | 'status' | 'createdBy'>,
  createdBy: string
): Promise<string> {
  const ref = await addDoc(collection(db, CULTURE), withEnvelope(signal, createdBy, 'logged'))
  await updateDoc(ref, { id: ref.id })
  await writePeopleAuditLog({ uid: createdBy, action: 'culture_signal_raised', resource: `culture/${ref.id}`, details: `${signal.signalType} signal for ${signal.cultureValue}` })
  return ref.id
}

export async function getAllCultureSignals(): Promise<PeopleCultureSignal[]> {
  const snap = await getDocs(query(collection(db, CULTURE), orderBy('createdAt', 'desc')))
  return snap.docs.map(d => d.data() as PeopleCultureSignal)
}

export async function getCultureSignalsForPerson(personId: string): Promise<PeopleCultureSignal[]> {
  const q = query(collection(db, CULTURE), where('personId', '==', personId), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => d.data() as PeopleCultureSignal)
}

// ── Audit Logs ─────────────────────────────────────────────────────────────────

const AUDIT = 'peopleAuditLogs'

export async function writePeopleAuditLog(
  log: { uid: string; action: PeopleAuditAction; resource: string; details: string }
): Promise<void> {
  await addDoc(collection(db, AUDIT), withEnvelope(log, log.uid, 'logged'))
}

export async function getPeopleAuditLogs(maxResults = 50): Promise<PeopleAuditLog[]> {
  const q = query(collection(db, AUDIT), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.slice(0, maxResults).map(d => ({ id: d.id, ...d.data() }) as PeopleAuditLog)
}

// ── Deletion (Platform Admin only, guarded by firestore.rules) ────────────────

export async function deletePeopleDoc(collectionName: string, id: string): Promise<void> {
  await deleteDoc(doc(db, collectionName, id))
}
