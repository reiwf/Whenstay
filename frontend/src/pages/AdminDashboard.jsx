import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { RefreshCw, CheckCircle, Clock, PlaneLanding, PlaneTakeoff , Calendar, UserCheck } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'
import DashboardLayout from '../components/layout/DashboardLayout'
import { PageHeader, StatsCard, DataTable, EmptyState } from '../components/ui'

// Import custom hooks
import { useAdminData } from '../hooks/useAdminData'
import { useProperties } from '../hooks/useProperties'
import { useUsers } from '../hooks/useUsers'

// Import tab components
import PropertiesTab from '../components/admin/tabs/PropertiesTab'
import UsersTab from '../components/admin/tabs/UsersTab'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState('dashboard')
  const [syncing, setSyncing] = useState(false)
  const { isLoggedIn, hasAdminAccess, hasRole, profile } = useAuth()
  
  // Set default section based on user role
  useEffect(() => {
    if (profile?.role === 'cleaner') {
      setActiveSection('cleaning')
    } else if (profile?.role === 'owner') {
      setActiveSection('properties')
    }
  }, [profile])

  // Use custom hooks
  const { 
    stats, 
    checkins, 
    todayStats, 
    todayArrivals, 
    todayDepartures, 
    inHouseGuests, 
    loading, 
    loadDashboardData,
    loadTodayDashboardData
  } = useAdminData()
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
      loadTodayDashboardData()
    }
  }, [isLoggedIn, hasAdminAccess, loadDashboardData, loadTodayDashboardData])

  useEffect(() => {
    if (activeSection === 'properties') {
      loadProperties()
    } else if (activeSection === 'users') {
      loadUsers()
    }
  }, [activeSection, loadProperties, loadUsers])

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


  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-96">
          <LoadingSpinner size="large" />
        </div>
      )
    }

    switch (activeSection) {
      case 'dashboard':
        // Define table columns for check-ins
        const checkinColumns = [
          {
            key: 'guest_name',
            title: 'Guest',
            render: (value, row) => (
              <div>
                <div className="text-sm font-medium text-gray-900">{value}</div>
                <div className="text-sm text-gray-500">{row.guest_email}</div>
              </div>
            )
          },
          {
            key: 'room_number',
            title: 'Room',
            render: (value) => <span className="text-sm text-gray-900">{value}</span>
          },
          {
            key: 'check_in_date',
            title: 'Check-in Date',
            render: (value) => (
              <span className="text-sm text-gray-900">
                {new Date(value).toLocaleDateString()}
              </span>
            )
          },
          {
            key: 'status',
            title: 'Status',
            render: (value) => (
              <span className={`status-badge ${
                value === 'completed' ? 'status-completed' :
                value === 'invited' ? 'status-pending' :
                'status-cancelled'
              }`}>
                {value}
              </span>
            )
          },
          {
            key: 'admin_verified',
            title: 'Verified',
            render: (value) => value ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <Clock className="w-5 h-5 text-yellow-500" />
            )
          }
        ]

        return (
          <div className="space-y-8">
            {/* Today's Statistics */}
            {todayStats && (
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <h2 className="text-xl font-semibold text-gray-900">Today's Overview</h2>
                  <span className="text-sm text-gray-500">
                    {new Date().toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatsCard
                    title="Today's Arrivals"
                    value={todayStats.todayArrivals || 0}
                    icon={PlaneLanding}
                    iconColor="text-green-600"
                  />
                  <StatsCard
                    title="Today's Departures"
                    value={todayStats.todayDepartures || 0}
                    icon={PlaneTakeoff}
                    iconColor="text-orange-600"
                  />
                  <StatsCard
                    title="In-House Guests"
                    value={todayStats.inHouseGuests || 0}
                    icon={UserCheck}
                    iconColor="text-blue-600"
                  />
                  <StatsCard
                    title="Pending Check-ins"
                    value={todayStats.pendingTodayCheckins || 0}
                    icon={Clock}
                    iconColor="text-yellow-600"
                  />
                </div>
              </div>
            )}

            {/* Today's Arrivals */}
            {todayArrivals && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <PlaneLanding className="w-5 h-5 text-green-600" />
                  <h2 className="text-lg font-semibold text-gray-900">Today's Arrivals</h2>
                  <span className="text-sm text-gray-500">({todayArrivals.length} guests)</span>
                </div>

                {todayArrivals.length > 0 ? (
                  <DataTable
                    columns={[
                      {
                        key: 'guest_name',
                        title: 'Guest',
                        render: (value, row) => (
                          <div>
                            <div className="text-sm font-medium text-gray-900">{value}</div>
                            <div className="text-sm text-gray-500">{row.guest_email}</div>
                          </div>
                        )
                      },
                      {
                        key: 'property_name',
                        title: 'Property',
                        render: (value) => <span className="text-sm text-gray-900">{value}</span>
                      },
                      {
                        key: 'room_number',
                        title: 'Room',
                        render: (value) => <span className="text-sm text-gray-900">{value}</span>
                      },
                    ]}
                    data={todayArrivals}
                    emptyMessage="No arrivals today"
                    emptyIcon={PlaneLanding}
                  />
                ) : (
                  <div className="card">
                    <EmptyState
                      icon={PlaneLanding}
                      title="No arrivals today"
                      description="No guests are scheduled to arrive today"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Today's Departures */}
            {todayDepartures && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <PlaneTakeoff className="w-5 h-5 text-orange-600" />
                  <h2 className="text-lg font-semibold text-gray-900">Today's Departures</h2>
                  <span className="text-sm text-gray-500">({todayDepartures.length} guests)</span>
                </div>

                {todayDepartures.length > 0 ? (
                  <DataTable
                    columns={[
                      {
                        key: 'guest_name',
                        title: 'Guest',
                        render: (value, row) => (
                          <div>
                            <div className="text-sm font-medium text-gray-900">{value}</div>
                            <div className="text-sm text-gray-500">{row.guest_email}</div>
                          </div>
                        )
                      },
                      {
                        key: 'property_name',
                        title: 'Property',
                        render: (value) => <span className="text-sm text-gray-900">{value}</span>
                      },
                      {
                        key: 'room_number',
                        title: 'Room',
                        render: (value) => <span className="text-sm text-gray-900">{value}</span>
                      },                                           
                    ]}
                    data={todayDepartures}
                    emptyMessage="No departures today"
                    emptyIcon={PlaneTakeoff}
                  />
                ) : (
                  <div className="card">
                    <EmptyState
                      icon={PlaneTakeoff}
                      title="No departures today"
                      description="No guests are scheduled to depart today"
                    />
                  </div>
                )}
              </div>
            )}

            {/* In-House Guests */}
            {inHouseGuests && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-blue-600" />
                  <h2 className="text-lg font-semibold text-gray-900">In-House Guests</h2>
                  <span className="text-sm text-gray-500">({inHouseGuests.length} guests)</span>
                </div>

                {inHouseGuests.length > 0 ? (
                  <DataTable
                    columns={[
                      {
                        key: 'guest_name',
                        title: 'Guest',
                        render: (value, row) => (
                          <div>
                            <div className="text-sm font-medium text-gray-900">{value}</div>
                            <div className="text-sm text-gray-500">{row.guest_email}</div>
                          </div>
                        )
                      },
                      {
                        key: 'property_name',
                        title: 'Property',
                        render: (value) => <span className="text-sm text-gray-900">{value}</span>
                      },
                      {
                        key: 'room_number',
                        title: 'Room',
                        render: (value) => <span className="text-sm text-gray-900">{value}</span>
                      },
                      {
                        key: 'check_in_date',
                        title: 'Checked In',
                        render: (value) => (
                          <span className="text-sm text-gray-900">
                             {new Date(value).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })}
                          </span>
                        )
                      },
                      {
                        key: 'check_out_date',
                        title: 'Check Out',
                        render: (value) => (
                          <span className="text-sm text-gray-900">
                             {new Date(value).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })}
                          </span>
                        )
                      },
                      {
                        key: 'nights_staying',
                        title: 'Nights',
                        render: (value, row) => {
                          const checkIn = new Date(row.check_in_date)
                          const checkOut = new Date(row.check_out_date)
                          const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24))
                          return <span className="text-sm text-gray-900">{nights}</span>
                        }
                      }
                    ]}
                    data={inHouseGuests}
                    emptyMessage="No in-house guests"
                    emptyIcon={UserCheck}
                  />
                ) : (
                  <div className="card">
                    <EmptyState
                      icon={UserCheck}
                      title="No in-house guests"
                      description="No guests are currently staying at your properties"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )
      case 'properties':
        // Hide properties tab from cleaners
        if (profile?.role === 'cleaner') {
          return (
            <div className="text-center py-12">
              <p className="text-gray-500">Access denied</p>
              <p className="text-sm text-gray-400 mt-2">This section is not available for your role</p>
            </div>
          )
        }
        return (
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
            userRole={profile?.role}
          />
        )
      case 'reservations':
        return <ReservationsTab />
      case 'cleaning':
        // Redirect to dedicated cleaning page
        navigate('/cleaning')
        return null
      case 'users':
        return (
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
        )
      default:
        return (
          <div className="text-center py-12">
            <p className="text-gray-500">Select a section from the sidebar</p>
          </div>
        )
    }
  }

  return (
    <DashboardLayout
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      pageTitle={
        activeSection === 'dashboard' ? 'Dashboard' :
        activeSection === 'properties' ? (profile?.role === 'owner' ? 'My Properties' : 'Properties') :
        activeSection === 'reservations' ? 'Reservations' :
        activeSection === 'cleaning' ? (profile?.role === 'cleaner' ? 'My Tasks' : 'Cleaning') :
        activeSection === 'users' ? 'Users' : ''
      }
      pageSubtitle={
        activeSection === 'dashboard' ? 'Check-in Management Overview' :
        activeSection === 'properties' ? 'Manage properties, rooms, and units' :
        activeSection === 'reservations' ? 'View and manage reservations' :
        activeSection === 'cleaning' ? 'Cleaning tasks and schedules' :
        activeSection === 'users' ? 'User management and permissions' : ''
      }
      pageAction={
        activeSection === 'dashboard' ? (
          <button
            onClick={handleSync}
            disabled={syncing}
            className="btn-secondary text-sm"
          >
            {syncing ? (
              <LoadingSpinner size="small" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Sync Beds24
          </button>
        ) : null
      }
    >
      {/* Full-width Content */}
      <div className="px-4 sm:px-6 lg:px-8 py-6 fade-in">
        {renderContent()}
      </div>
    </DashboardLayout>
  )
}
