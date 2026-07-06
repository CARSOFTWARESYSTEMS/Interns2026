import { useEffect, useState } from 'react'
import {
  Contact, Briefcase, Users, MessagesSquare, Handshake, UserCheck,
  GraduationCap, Building2, HardHat, Plane, MessageCircle, BookOpen, Sparkles,
} from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import StatCard from '../../components/ui/StatCard'
import SectionCard from '../../components/ui/SectionCard'
import {
  getAllJobOpenings, getAllCandidates, getAllInterviews, getAllOffers,
  getAllOnboarding, getAllPeopleProfiles, getAllLeaveRequests, getAllReviews,
  getAllPolicies, getAllPolicyAcknowledgements, getAllCultureSignals,
} from '../../firebase/people'
import {
  SEED_JOB_OPENINGS, SEED_CANDIDATES, SEED_INTERVIEWS, SEED_OFFERS,
  SEED_ONBOARDING, SEED_PEOPLE_PROFILES, SEED_LEAVE_REQUESTS, SEED_REVIEWS,
  SEED_POLICIES, SEED_CULTURE_SIGNALS,
} from '../../data/peopleSeed'
import type { PeopleDashboardCounts } from '../../types/people'

export default function PeopleDashboard() {
  const [counts, setCounts] = useState<PeopleDashboardCounts | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const [openings, candidates, interviews, offers, onboarding, profiles, leave, reviews, policies, acks, culture] =
          await Promise.all([
            getAllJobOpenings(), getAllCandidates(), getAllInterviews(), getAllOffers(),
            getAllOnboarding(), getAllPeopleProfiles(), getAllLeaveRequests(), getAllReviews(),
            getAllPolicies(), getAllPolicyAcknowledgements(), getAllCultureSignals(),
          ])

        const o = openings.length ? openings : SEED_JOB_OPENINGS
        const c = candidates.length ? candidates : SEED_CANDIDATES
        const iv = interviews.length ? interviews : SEED_INTERVIEWS
        const of = offers.length ? offers : SEED_OFFERS
        const ob = onboarding.length ? onboarding : SEED_ONBOARDING
        const p = profiles.length ? profiles : SEED_PEOPLE_PROFILES
        const lv = leave.length ? leave : SEED_LEAVE_REQUESTS
        const rv = reviews.length ? reviews : SEED_REVIEWS
        const pol = policies.length ? policies : SEED_POLICIES
        const cs = culture.length ? culture : SEED_CULTURE_SIGNALS

        setCounts({
          openRoles: o.filter(x => x.openingStatus === 'Open').length,
          candidates: c.length,
          interviewsPending: iv.filter(x => x.outcome === 'Pending').length,
          offersPending: of.filter(x => x.offerStatus === 'Sent').length,
          onboarding: ob.filter(x => !x.onboardingComplete).length,
          activeInterns: p.filter(x => x.employmentType === 'intern' && x.personStatus === 'active').length,
          activeEmployees: p.filter(x => x.employmentType === 'employee' && x.personStatus === 'active').length,
          activeContractors: p.filter(x => x.employmentType === 'contractor' && x.personStatus === 'active').length,
          leaveRequests: lv.filter(x => x.leaveStatus === 'Requested').length,
          reviewsDue: Math.max(0, p.filter(x => x.personStatus === 'active').length - rv.length),
          policiesPendingAck: Math.max(0, pol.filter(x => x.acknowledgementRequired).length * p.length - acks.length),
          cultureSignals: cs.length,
        })
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="People Dashboard"
        subtitle="Interns · Employees · Contractors — hiring, lifecycle, reviews, leave, policies, culture"
        icon={<Contact size={18}/>}
      />

      {loading || !counts ? (
        <p className="text-sm text-slate-400 text-center py-10">Loading People Operations data…</p>
      ) : (
        <>
          <SectionCard title="Recruitment" icon={<Briefcase size={14}/>}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard title="Open Roles" value={counts.openRoles} icon={<Briefcase size={16}/>} color="bg-blue-50 text-blue-700" />
              <StatCard title="Candidates" value={counts.candidates} icon={<Users size={16}/>} color="bg-indigo-50 text-indigo-700" />
              <StatCard title="Interviews Pending" value={counts.interviewsPending} icon={<MessagesSquare size={16}/>} color="bg-amber-50 text-amber-700" />
              <StatCard title="Offers Pending" value={counts.offersPending} icon={<Handshake size={16}/>} color="bg-teal-50 text-teal-700" />
            </div>
          </SectionCard>

          <SectionCard title="Workforce" icon={<Building2 size={14}/>}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard title="Onboarding" value={counts.onboarding} icon={<UserCheck size={16}/>} color="bg-purple-50 text-purple-700" />
              <StatCard title="Active Interns" value={counts.activeInterns} icon={<GraduationCap size={16}/>} color="bg-brand-50 text-brand-700" />
              <StatCard title="Active Employees" value={counts.activeEmployees} icon={<Building2 size={16}/>} color="bg-green-50 text-green-700" />
              <StatCard title="Active Contractors" value={counts.activeContractors} icon={<HardHat size={16}/>} color="bg-orange-50 text-orange-700" />
            </div>
          </SectionCard>

          <SectionCard title="Lifecycle & Culture" icon={<Sparkles size={14}/>}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard title="Leave Requests" value={counts.leaveRequests} icon={<Plane size={16}/>} color="bg-cyan-50 text-cyan-700" />
              <StatCard title="1:1 Reviews Due" value={counts.reviewsDue} icon={<MessageCircle size={16}/>} color="bg-pink-50 text-pink-700" />
              <StatCard title="Policies Pending Ack" value={counts.policiesPendingAck} icon={<BookOpen size={16}/>} color="bg-red-50 text-red-600" />
              <StatCard title="Culture Signals" value={counts.cultureSignals} icon={<Sparkles size={16}/>} color="bg-yellow-50 text-yellow-700" />
            </div>
          </SectionCard>
        </>
      )}
    </div>
  )
}
