import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { PropertyProvider } from './contexts/PropertyContext'
import CheckinPage from './pages/CheckinPage'
import Login from './pages/Login'
import AdminDashboard from './pages/AdminDashboard'
import ReservationPage from './pages/ReservationPage'
import CleaningPage from './pages/CleaningPage'
import PropertyPage from './pages/PropertyPage'
import UserPage from './pages/UserPage'
import HomePage from './pages/HomePage'
import NotFoundPage from './pages/NotFoundPage'
import GuestApp from './pages/GuestApp'
import CommunicationPage from './pages/CommunicationPage'
import PricingPage from './pages/PricingPage'
import MarketSettingsPage from './pages/MarketSettingsPage'
import CalendarPage from './pages/CalendarPage'
import AutomationPage from './pages/AutomationPage'
import AcceptInvitationPage from './pages/AcceptInvitationPage'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <AuthProvider>
      <PropertyProvider>
        <div className="min-h-screen bg-gray-50">
          <Routes>
          {/* Public Routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/checkin/:token" element={<CheckinPage />} />
          <Route path="/guest/:token" element={<GuestApp />} />
          <Route path="/accept-invitation/:token" element={<AcceptInvitationPage />} />
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
          
          <Route 
            path="/cleaning" 
            element={
              <ProtectedRoute requiredRoles={['admin', 'cleaner']}>
                <CleaningPage />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/property" 
            element={
              <ProtectedRoute requiredRoles={['admin', 'owner']}>
                <PropertyPage />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/user" 
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <UserPage />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/messages" 
            element={<Navigate to="/communication" replace />}
          />
          
          <Route 
            path="/communication" 
            element={
              <ProtectedRoute requiredRoles={['admin', 'owner']}>
                <CommunicationPage />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/calendar" 
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <CalendarPage />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/pricing" 
            element={
              <ProtectedRoute requiredRoles={['admin', 'owner']}>
                <PricingPage />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/pricing/:roomTypeId" 
            element={
              <ProtectedRoute requiredRoles={['admin', 'owner']}>
                <PricingPage />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/market-settings" 
            element={
              <ProtectedRoute requiredRoles={['admin', 'owner']}>
                <MarketSettingsPage />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/automation/*" 
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <AutomationPage />
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
      </PropertyProvider>
    </AuthProvider>
  )
}

export default App
