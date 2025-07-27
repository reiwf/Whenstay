import { Routes, Route } from '../$node_modules/react-router-dom/dist/index.js'
import CheckinPage from './pages/CheckinPage'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import HomePage from './pages/HomePage'
import NotFoundPage from './pages/NotFoundPage'
import GuestDashboard from './pages/GuestDashboard'
import OwnerDashboard from './pages/OwnerDashboard'
import OwnerLogin from './pages/OwnerLogin'
import CleanerDashboard from './pages/CleanerDashboard'
import CleanerLogin from './pages/CleanerLogin'

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        {/* Guest Routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/checkin/:token" element={<CheckinPage />} />
        <Route path="/guest/:token" element={<GuestDashboard />} />
        
        {/* Admin Routes */}
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        
        {/* Owner Routes */}
        <Route path="/owner/login" element={<OwnerLogin />} />
        <Route path="/owner/dashboard" element={<OwnerDashboard />} />
        
        {/* Cleaner Routes */}
        <Route path="/cleaner/login" element={<CleanerLogin />} />
        <Route path="/cleaner/dashboard" element={<CleanerDashboard />} />
        
        {/* 404 Route */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  )
}

export default App
