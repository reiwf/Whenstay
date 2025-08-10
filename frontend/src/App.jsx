import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import CheckinPage from './pages/CheckinPage'
import Login from './pages/Login'
import AdminDashboard from './pages/AdminDashboard'
import ReservationPage from './pages/ReservationPage'
import HomePage from './pages/HomePage'
import NotFoundPage from './pages/NotFoundPage'
import GuestDashboard from './pages/GuestDashboard'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/checkin/:token" element={<CheckinPage />} />
          <Route path="/guest/:token" element={<GuestDashboard />} />
          <Route path="/login" element={<Login />} />
          
          {/* Protected Admin Routes - Allow admin, owner, and cleaner roles */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute requiredRoles={['admin', 'owner', 'cleaner']}>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/reservation" 
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <ReservationPage />
              </ProtectedRoute>
            } 
          />
          
          {/* Legacy route redirects */}
          <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
          <Route path="/admin-login" element={<Navigate to="/login" replace />} />
          
          <Route 
            path="/guest-dashboard" 
            element={
              <ProtectedRoute requiredRoles={['guest']}>
                <div className="p-8 text-center">
                  <h1 className="text-2xl font-bold">Guest Dashboard</h1>
                  <p className="text-gray-600 mt-2">Coming soon...</p>
                </div>
              </ProtectedRoute>
            } 
          />
          
          {/* 404 Route */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
    </AuthProvider>
  )
}

export default App
