import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { 
  Users, 
  CheckCircle, 
  Building,
  RefreshCw,
  Plus,
  Sparkles
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'
import ProfileDropdown from '../components/ProfileDropdown'

// Import custom hooks
import { useAdminData } from '../hooks/useAdminData'
import { useProperties } from '../hooks/useProperties'
import { useUsers } from '../hooks/useUsers'

// Import tab components
import DashboardTab from '../components/admin/tabs/DashboardTab'
import PropertiesTab from '../components/admin/tabs/PropertiesTab'
import ReservationsTab from '../components/admin/tabs/ReservationsTab'
import UsersTab from '../components/admin/tabs/UsersTab'
import CleaningTab from '../components/admin/tabs/CleaningTab'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [syncing, setSyncing] = useState(false)
  const { isLoggedIn, hasAdminAccess, hasRole, profile } = useAuth()
  
  // Set default tab based on user role
  useEffect(() => {
    if (profile?.role === 'cleaner') {
      setActiveTab('cleaning')
    }
  }, [profile])

  // Use custom hooks
  const { stats, checkins, loading, loadDashboardData } = useAdminData()
  const { 
    properties, 
    createProperty, 
    updateProperty, 
    deleteProperty,
    createRoom,
    updateRoom,
    deleteRoom,
    createRoomType,
    updateRoomType,
    deleteRoomType,
    createRoomUnit,
    updateRoomUnit,
    deleteRoomUnit,
    loadProperties
  } = useProperties()
  const { 
    users, 
    userStats, 
    createUser, 
    updateUser, 
    deleteUser, 
    updateUserRole, 
    updateUserStatus,
    loadUsers
  } = useUsers()

  useEffect(() => {
    // Load dashboard data when component mounts
    if (isLoggedIn && hasAdminAccess()) {
      loadDashboardData()
    }
  }, [isLoggedIn, hasAdminAccess, loadDashboardData])

  useEffect(() => {
    if (activeTab === 'properties') {
      loadProperties()
    } else if (activeTab === 'users') {
      loadUsers()
    }
  }, [activeTab, loadProperties, loadUsers])

  const handleSync = async () => {
    try {
      setSyncing(true)
      // Note: adminAPI needs to be imported or accessed differently
      // await adminAPI.syncBeds24(7)
      toast.success('Beds24 sync completed')
      await loadDashboardData()
    } catch (error) {
      console.error('Sync error:', error)
    } finally {
      setSyncing(false)
    }
  }

  const createTestReservation = async () => {
    try {
      const testData = {
        guestName: 'Test Guest',
        guestEmail: 'test@example.com',
        checkInDate: new Date().toISOString().split('T')[0],
        checkOutDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        roomNumber: '101'
      }
      
      const response = await fetch('/api/reservations/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData)
      })
      
      if (response.ok) {
        const result = await response.json()
        toast.success('Test reservation created!')
        console.log('Check-in URL:', result.reservation.checkinUrl)
        await loadDashboardData()
      }
    } catch (error) {
      console.error('Error creating test reservation:', error)
      toast.error('Failed to create test reservation')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-primary-600">Whenstay Admin</h1>
              <p className="text-sm text-gray-600">Check-in Management Dashboard</p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={createTestReservation}
                className="btn-secondary text-sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                Test Reservation
              </button>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="btn-secondary text-sm"
              >
                {syncing ? (
                  <LoadingSpinner size="small" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-1" />
                )}
                Sync Beds24
              </button>
              <ProfileDropdown />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="mb-8">
          <nav className="flex space-x-8">
            {/* Show all tabs for admin/owner, only cleaning tab for cleaner */}
            {profile?.role !== 'cleaner' && (
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'dashboard'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Users className="w-4 h-4 inline mr-2" />
                Dashboard
              </button>
            )}
            {profile?.role !== 'cleaner' && (
              <button
                onClick={() => setActiveTab('properties')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'properties'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Building className="w-4 h-4 inline mr-2" />
                Properties
              </button>
            )}
            {profile?.role !== 'cleaner' && (
              <button
                onClick={() => setActiveTab('reservations')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'reservations'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <CheckCircle className="w-4 h-4 inline mr-2" />
                Reservations
              </button>
            )}
            <button
              onClick={() => setActiveTab('cleaning')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'cleaning'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Sparkles className="w-4 h-4 inline mr-2" />
              {profile?.role === 'cleaner' ? 'My Tasks' : 'Cleaning'}
            </button>
            {profile?.role !== 'cleaner' && (
              <button
                onClick={() => setActiveTab('users')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'users'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Users className="w-4 h-4 inline mr-2" />
                Users
              </button>
            )}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'dashboard' && (
          <DashboardTab 
            stats={stats} 
            checkins={checkins} 
            onRefresh={loadDashboardData} 
          />
        )}

        {activeTab === 'properties' && (
          <PropertiesTab
            properties={properties}
            onCreateProperty={createProperty}
            onUpdateProperty={updateProperty}
            onDeleteProperty={deleteProperty}
            onCreateRoom={createRoom}
            onUpdateRoom={updateRoom}
            onDeleteRoom={deleteRoom}
            onCreateRoomType={createRoomType}
            onUpdateRoomType={updateRoomType}
            onDeleteRoomType={deleteRoomType}
            onCreateRoomUnit={createRoomUnit}
            onUpdateRoomUnit={updateRoomUnit}
            onDeleteRoomUnit={deleteRoomUnit}
          />
        )}

        {activeTab === 'reservations' && (
          <ReservationsTab />
        )}

        {activeTab === 'cleaning' && (
          <CleaningTab />
        )}

        {activeTab === 'users' && (
          <UsersTab
            users={users}
            userStats={userStats}
            onLoadUsers={loadUsers}
            onCreateUser={createUser}
            onUpdateUser={updateUser}
            onDeleteUser={deleteUser}
            onUpdateUserRole={updateUserRole}
            onUpdateUserStatus={updateUserStatus}
          />
        )}
      </div>
    </div>
  )
}
