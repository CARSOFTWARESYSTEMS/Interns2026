import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { useAuthContext } from './contexts/AuthContext'
import { DataProvider } from './data/DataProvider'
import RequireAuth from './components/auth/RequireAuth'
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

// Admin pages
import AdminUsers from './pages/admin/Users'
import AdminInvitations from './pages/admin/Invitations'
import DeveloperSettings from './pages/admin/DeveloperSettings'

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

          {/* ── Main app (with layout + auth required) ──────────────── */}
          <Route
            path="/"
            element={
              <RequireAuth>
                <Layout />
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

            {/* Admin — Platform Admin only */}
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
