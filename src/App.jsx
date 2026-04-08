import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import JoinScreen from './screens/JoinScreen'
import LabScreen from './screens/LabScreen'
import PresentScreen from './screens/PresentScreen'
import ProjectorPresentScreen from './screens/ProjectorPresentScreen'
import RescuePresentScreen from './screens/RescuePresentScreen'
import FeedScreen from './screens/FeedScreen'
import AdminScreen from './screens/AdminScreen'
import { useSession } from './hooks/useSession'

function ProtectedRoute({ children, requireTeam, requireSessionParam }) {
  const { team, isRestoring } = useSession()
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const sessionParam = params.get('session')

  if (isRestoring && location.pathname !== '/join') return null

  if (requireTeam && !team && !isRestoring) return <Navigate to="/join" replace />
  if (requireSessionParam && !sessionParam) return <Navigate to="/join" replace />
  if (location.pathname === '/join' && team) return <Navigate to="/lab" replace />
  return children
}

function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg0 text-text0">
      <div className="text-6xl font-bold text-accent mb-4">404</div>
      <div className="text-text1 mb-6">Page not found</div>
      <a href="/join" className="rounded-lg border border-accent/50 px-4 py-2 text-sm text-accent hover:bg-accent/10 transition-colors">
        Go to Join Screen
      </a>
    </main>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/join" replace />} />
      <Route path="/admin" element={<AdminScreen />} />
      <Route path="/join" element={
        <ProtectedRoute>
          <JoinScreen />
        </ProtectedRoute>
      } />
      <Route path="/lab" element={
        <ProtectedRoute requireTeam>
          <LabScreen />
        </ProtectedRoute>
      } />
      <Route path="/present" element={
        <ProtectedRoute requireTeam>
          <PresentScreen />
        </ProtectedRoute>
      } />
      <Route path="/project" element={<ProjectorPresentScreen />} />
      <Route path="/rescue" element={<RescuePresentScreen />} />
      <Route path="/feed" element={
        <ProtectedRoute requireSessionParam>
          <FeedScreen />
        </ProtectedRoute>
      } />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App
