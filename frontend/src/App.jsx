import { Routes, Route } from 'react-router-dom'
import CheckinPage from './pages/CheckinPage'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import HomePage from './pages/HomePage'
import NotFoundPage from './pages/NotFoundPage'
import GuestDashboard from './pages/GuestDashboard'

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
        <Route path="/dashboard" element={<AdminDashboard />} />
        
        {/* 404 Route */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  )
}

export default App
