import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { useAuthContext } from './contexts/AuthContext'
import { DataProvider } from './data/DataProvider'
import RequireAuth from './components/auth/RequireAuth'
import RequireCheckin from './components/auth/RequireCheckin'
import RoleGuard from './components/auth/RoleGuard'
import Layout from './components/layout/Layout'

// Auth pages (no layout)
import Login from './pages/Login'
import CompleteProfile from './pages/CompleteProfile'
import Unauthorized from './pages/Unauthorized'
import NotFound from './pages/NotFound'

// Platform pages
import Dashboard from './pages/Dashboard'
import WeeklyReview from './pages/WeeklyReview'
import FinalDemo from './pages/FinalDemo'

// Engineering pages
import Assignments from './pages/Assignments'
import AssignmentDetail from './pages/AssignmentDetail'
import Developers from './pages/Developers'
import DeveloperDetail from './pages/DeveloperDetail'
import Simulators from './pages/Simulators'
import SimulatorDetail from './pages/SimulatorDetail'
import Stories from './pages/Stories'
import StoryDetail from './pages/StoryDetail'
import QAReview from './pages/QAReview'
import ArchitectApproval from './pages/ArchitectApproval'
import Evidence from './pages/Evidence'
import EmailQueue from './pages/EmailQueue'
import Reports from './pages/Reports'
import Settings from './pages/Settings'

// IAM pages
import Profile from './pages/Profile'

// Role dashboards
import DeveloperDashboard from './pages/DeveloperDashboard'
import ManagerDashboard from './pages/ManagerDashboard'
import ArchitectDashboard from './pages/ArchitectDashboard'
import QADashboard from './pages/QADashboard'

// People Operations pages
import PeopleDashboard from './pages/people/PeopleDashboard'
import PeopleRecruitment from './pages/people/Recruitment'
import PeopleCandidates from './pages/people/Candidates'
import PeopleInterviews from './pages/people/Interviews'
import PeopleOffers from './pages/people/Offers'
import PeopleOnboarding from './pages/people/Onboarding'
import PeopleProfiles from './pages/people/Profiles'
import PeopleReviews from './pages/people/Reviews'
import PeopleLeave from './pages/people/Leave'
import PeoplePolicies from './pages/people/Policies'
import PeopleCulture from './pages/people/Culture'
import PeopleDocumentsHome from './pages/people/documents/DocumentsHome'
import PeopleDocumentsTemplates from './pages/people/documents/Templates'
import PeopleDocumentsOfferLetter from './pages/people/documents/OfferLetter'
import PeopleDocumentsJoiningLetter from './pages/people/documents/JoiningLetter'
import PeopleDocumentsGenerated from './pages/people/documents/GeneratedLetters'

// Admin pages
import AdminUsers from './pages/admin/Users'
import AdminInvitations from './pages/admin/Invitations'
import DeveloperSettings from './pages/admin/DeveloperSettings'
import AssignmentCreate from './pages/admin/AssignmentCreate'
import Capacity from './pages/admin/Capacity'
import DailyCheckin from './pages/DailyCheckin'
import Notifications from './pages/Notifications'

/**
 * Routes to the correct role-specific dashboard.
 * Falls back to the full platform Dashboard for Admin/Manager/Viewer.
 */
function RoleDashboard() {
  const { role } = useAuthContext()
  if (role === 'Developer')           return <DeveloperDashboard />
  if (role === 'QA Engineer')         return <QADashboard />
  if (role === 'Architect')           return <ArchitectDashboard />
  if (role === 'Engineering Manager') return <ManagerDashboard />
  return <Dashboard />                // Platform Admin, Viewer, fallback
}

/**
 * /my-dashboard — convenience alias that redirects to the root dashboard.
 * Keeping as a named route so header nav works.
 */
function MyDashboardRedirect() {
  return <Navigate to="/" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DataProvider>
        <Routes>
          {/* ── Public routes ──────────────────────────────────────── */}
          <Route path="/login" element={<Login />} />

          {/* ── Auth-only, no layout ───────────────────────────────── */}
          <Route
            path="/complete-profile"
            element={
              <RequireAuth>
                <CompleteProfile />
              </RequireAuth>
            }
          />
          <Route
            path="/checkin"
            element={
              <RequireAuth>
                <DailyCheckin />
              </RequireAuth>
            }
          />

          {/* ── Main app (with layout + auth + daily check-in gate) ── */}
          <Route
            path="/"
            element={
              <RequireAuth>
                <RequireCheckin>
                  <Layout />
                </RequireCheckin>
              </RequireAuth>
            }
          >
            {/* Platform */}
            <Route index element={<RoleDashboard />} />
            <Route path="my-dashboard" element={<MyDashboardRedirect />} />
            <Route path="weekly"       element={<WeeklyReview />} />
            <Route path="demo"         element={<FinalDemo />} />

            {/* Profile — every authenticated user */}
            <Route path="profile" element={<Profile />} />

            {/* Engineering — all roles except Viewer can read; writes are guarded at data layer */}
            <Route path="assignments"     element={<Assignments />} />
            <Route path="assignments/:id" element={<AssignmentDetail />} />
            <Route path="developers"      element={<Developers />} />
            <Route path="developers/:id"  element={<DeveloperDetail />} />
            <Route path="simulators"      element={<Simulators />} />
            <Route path="simulators/:id"  element={<SimulatorDetail />} />
            <Route path="stories"         element={<Stories />} />
            <Route path="stories/:id"     element={<StoryDetail />} />
            <Route path="qa"              element={<QAReview />} />
            <Route path="architect"       element={<ArchitectApproval />} />
            <Route path="evidence"        element={<Evidence />} />
            <Route path="email-queue"     element={<EmailQueue />} />
            <Route path="reports"         element={<Reports />} />
            <Route path="settings"        element={<Settings />} />

            {/* M05 — all authenticated users */}
            <Route path="notifications" element={<Notifications />} />

            {/* People Operations — dashboard/profiles/reviews/leave/culture are
                self-scoped at the data layer for Developer/Architect/QA Engineer;
                recruitment/candidates/interviews/offers/onboarding/policies are
                restricted to org/team/people-ops-level roles. */}
            <Route path="people" element={<PeopleDashboard />} />
            <Route
              path="people/recruitment"
              element={
                <RoleGuard allow={['Platform Admin', 'Engineering Manager', 'HR Manager']}>
                  <PeopleRecruitment />
                </RoleGuard>
              }
            />
            <Route
              path="people/candidates"
              element={
                <RoleGuard allow={['Platform Admin', 'Engineering Manager', 'HR Manager']}>
                  <PeopleCandidates />
                </RoleGuard>
              }
            />
            <Route
              path="people/interviews"
              element={
                <RoleGuard allow={['Platform Admin', 'Engineering Manager', 'HR Manager']}>
                  <PeopleInterviews />
                </RoleGuard>
              }
            />
            <Route
              path="people/offers"
              element={
                <RoleGuard allow={['Platform Admin', 'Engineering Manager', 'HR Manager']}>
                  <PeopleOffers />
                </RoleGuard>
              }
            />
            <Route
              path="people/onboarding"
              element={
                <RoleGuard allow={['Platform Admin', 'Engineering Manager', 'HR Manager']}>
                  <PeopleOnboarding />
                </RoleGuard>
              }
            />
            <Route path="people/profiles"     element={<PeopleProfiles />} />
            <Route path="people/reviews"      element={<PeopleReviews />} />
            <Route path="people/leave"        element={<PeopleLeave />} />
            <Route
              path="people/policies"
              element={
                <RoleGuard allow={['Platform Admin', 'Engineering Manager', 'HR Manager']}>
                  <PeoplePolicies />
                </RoleGuard>
              }
            />
            <Route path="people/culture"      element={<PeopleCulture />} />

            {/* People Operations — Documents (Offer/Joining Letter Generator, PEOPLE-002).
                Restricted to Platform Admin (Super Admin) and HR Manager only — no other
                role, including Engineering Manager, may access these routes. */}
            <Route
              path="people/documents"
              element={
                <RoleGuard allow={['Platform Admin', 'HR Manager']}>
                  <PeopleDocumentsHome />
                </RoleGuard>
              }
            />
            <Route
              path="people/documents/templates"
              element={
                <RoleGuard allow={['Platform Admin', 'HR Manager']}>
                  <PeopleDocumentsTemplates />
                </RoleGuard>
              }
            />
            <Route
              path="people/documents/offer-letter"
              element={
                <RoleGuard allow={['Platform Admin', 'HR Manager']}>
                  <PeopleDocumentsOfferLetter />
                </RoleGuard>
              }
            />
            <Route
              path="people/documents/joining-letter"
              element={
                <RoleGuard allow={['Platform Admin', 'HR Manager']}>
                  <PeopleDocumentsJoiningLetter />
                </RoleGuard>
              }
            />
            <Route
              path="people/documents/generated"
              element={
                <RoleGuard allow={['Platform Admin', 'HR Manager']}>
                  <PeopleDocumentsGenerated />
                </RoleGuard>
              }
            />

            {/* Admin — Platform Admin + Engineering Manager */}
            <Route
              path="admin/users"
              element={
                <RoleGuard allow={['Platform Admin']}>
                  <AdminUsers />
                </RoleGuard>
              }
            />
            <Route
              path="admin/invitations"
              element={
                <RoleGuard allow={['Platform Admin', 'Engineering Manager']}>
                  <AdminInvitations />
                </RoleGuard>
              }
            />
            <Route
              path="admin/developer-settings"
              element={
                <RoleGuard allow={['Platform Admin']}>
                  <DeveloperSettings />
                </RoleGuard>
              }
            />
            <Route
              path="admin/assignments/new"
              element={
                <RoleGuard allow={['Platform Admin', 'Engineering Manager']}>
                  <AssignmentCreate />
                </RoleGuard>
              }
            />
            <Route
              path="admin/capacity"
              element={
                <RoleGuard allow={['Platform Admin', 'Engineering Manager']}>
                  <Capacity />
                </RoleGuard>
              }
            />

            {/* Error pages inside layout */}
            <Route path="403" element={<Unauthorized />} />
            <Route path="404" element={<NotFound />} />

            {/* Catch-all → 404 */}
            <Route path="*" element={<NotFound />} />
          </Route>

          {/* Catch-all outside layout */}
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
