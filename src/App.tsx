import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Developers from './pages/Developers'
import DeveloperDetail from './pages/DeveloperDetail'
import Simulators from './pages/Simulators'
import SimulatorDetail from './pages/SimulatorDetail'
import Stories from './pages/Stories'
import StoryDetail from './pages/StoryDetail'
import Evidence from './pages/Evidence'
import QAReview from './pages/QAReview'
import ArchitectApproval from './pages/ArchitectApproval'
import WeeklyReview from './pages/WeeklyReview'
import FinalDemo from './pages/FinalDemo'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="developers" element={<Developers />} />
          <Route path="developers/:id" element={<DeveloperDetail />} />
          <Route path="simulators" element={<Simulators />} />
          <Route path="simulators/:id" element={<SimulatorDetail />} />
          <Route path="stories" element={<Stories />} />
          <Route path="stories/:id" element={<StoryDetail />} />
          <Route path="evidence" element={<Evidence />} />
          <Route path="qa" element={<QAReview />} />
          <Route path="architect" element={<ArchitectApproval />} />
          <Route path="weekly" element={<WeeklyReview />} />
          <Route path="demo" element={<FinalDemo />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
