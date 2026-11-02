import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'

// Admin Pages
import DashboardPage         from './pages/DashboardPage'
import StudentsPage          from './pages/StudentsPage'
import PredictPage           from './pages/PredictPage'
import PredictionHistoryPage from './pages/PredictionHistoryPage'
import AnalyticsPage         from './pages/AnalyticsPage'
import ModelInfoPage         from './pages/ModelInfoPage'
import ModelTrainingPage     from './pages/ModelTrainingPage'

// Student Pages
import StudentDashboardPage   from './pages/StudentDashboardPage'
import StudentProfilePage     from './pages/StudentProfilePage'
import StudentPredictionsPage from './pages/StudentPredictionsPage'

// Auth Pages
import LoginPage    from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'

// Common Layout
import Layout from './components/Layout'

// Route Guard: Ensures user is logged in
function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-screen">Loading session…</div>
  return user ? children : <Navigate to="/login" replace />
}

// Role-Based Route Guard: Ensures user has specific role
function RoleBasedRoute({ allowedRole, children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-screen">Checking permissions…</div>
  if (!user) return <Navigate to="/login" replace />

  if (user.role !== allowedRole) {
    // Redirect unauthorized user to their respective permitted dashboard
    return user.role === 'admin'
      ? <Navigate to="/dashboard" replace />
      : <Navigate to="/student-dashboard" replace />
  }

  return children
}

// Dynamic Root Redirect based on user's authenticated role
function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-screen">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  return user.role === 'admin'
    ? <Navigate to="/dashboard" replace />
    : <Navigate to="/student-dashboard" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected Routes enclosed within Layout */}
          <Route path="/" element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }>
            {/* Root path dynamic router */}
            <Route index element={<RootRedirect />} />

            {/* ── Admin Only Routes ───────────────────────────────────────── */}
            <Route path="dashboard" element={
              <RoleBasedRoute allowedRole="admin">
                <DashboardPage />
              </RoleBasedRoute>
            } />
            <Route path="students" element={
              <RoleBasedRoute allowedRole="admin">
                <StudentsPage />
              </RoleBasedRoute>
            } />
            <Route path="predict" element={
              <RoleBasedRoute allowedRole="admin">
                <PredictPage />
              </RoleBasedRoute>
            } />
            <Route path="history" element={
              <RoleBasedRoute allowedRole="admin">
                <PredictionHistoryPage />
              </RoleBasedRoute>
            } />
            <Route path="analytics" element={
              <RoleBasedRoute allowedRole="admin">
                <AnalyticsPage />
              </RoleBasedRoute>
            } />
            <Route path="model-info" element={
              <RoleBasedRoute allowedRole="admin">
                <ModelInfoPage />
              </RoleBasedRoute>
            } />
            <Route path="model-training" element={
              <RoleBasedRoute allowedRole="admin">
                <ModelTrainingPage />
              </RoleBasedRoute>
            } />

            {/* ── Student Only Routes ─────────────────────────────────────── */}
            <Route path="student-dashboard" element={
              <RoleBasedRoute allowedRole="student">
                <StudentDashboardPage />
              </RoleBasedRoute>
            } />
            <Route path="student/profile" element={
              <RoleBasedRoute allowedRole="student">
                <StudentProfilePage />
              </RoleBasedRoute>
            } />
            <Route path="student/history" element={
              <RoleBasedRoute allowedRole="student">
                <StudentPredictionsPage />
              </RoleBasedRoute>
            } />
          </Route>

          {/* Fallback Catch-All Route */}
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
