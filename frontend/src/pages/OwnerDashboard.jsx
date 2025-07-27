import { useState, useEffect } from '../../$node_modules/@types/react/index.js'
import { useNavigate } from '../../$node_modules/react-router-dom/dist/index.js'
import toast from '../../$node_modules/react-hot-toast/dist/index.js'
import { 
  DollarSign, 
  TrendingUp, 
  Calendar, 
  Home, 
  Users, 
  CheckCircle, 
  Clock, 
  LogOut,
  Plus,
  Edit,
  Eye,
  BarChart3,
  PieChart
} from '../../$node_modules/lucide-react/dist/lucide-react.js'
import LoadingSpinner from '../components/LoadingSpinner'

export default function OwnerDashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [apartments, setApartments] = useState([])
  const [recentReservations, setRecentReservations] = useState([])
  const [cleaningTasks, setCleaningTasks] = useState([])

  useEffect(() => {
    // Check if user is authenticated as owner
    const userRole = localStorage.getItem('userRole')
    if (userRole !== 'owner') {
      navigate('/owner/login')
      return
    }
    
    loadOwnerData()
  }, [navigate])

  const loadOwnerData = async () => {
    try {
      setLoading(true)
      
      // Mock owner data - in real implementation, these would be API calls
      const mockStats = {
        monthlyRevenue: 4250.00,
        occupancyRate: 78.5,
        averageDailyRate: 125.00,
        upcomingReservations: 8,
        totalApartments: 3,
        pendingCleaningTasks: 2
      }
      setStats(mockStats)
      
      const mockApartments = [
        {
          id: 1,
          name: 'Downtown Loft',
          address: '123 Main St, Downtown',
          roomNumber: '101',
          maxGuests: 4,
          isActive: true,
          currentOccupancy: 'Occupied until Jan 28',
          nextReservation: 'Jan 30 - Feb 3'
        },
        {
          id: 2,
          name: 'Seaside Studio',
          address: '456 Ocean Ave, Beachfront',
          roomNumber: '102',
          maxGuests: 2,
          isActive: true,
          currentOccupancy: 'Available',
          nextReservation: 'Feb 1 - Feb 5'
        },
        {
          id: 3,
          name: 'Garden Apartment',
          address: '789 Park Rd, Garden District',
          roomNumber: '103',
          maxGuests: 6,
          isActive: false,
          currentOccupancy: 'Under Maintenance',
          nextReservation: 'Feb 10 - Feb 15'
        }
      ]
      setApartments(mockApartments)
      
      const mockReservations = [
        {
          id: 1,
          guestName: 'John Smith',
          apartmentName: 'Downtown Loft',
          checkInDate: '2024-01-25',
          checkOutDate: '2024-01-28',
          status: 'completed',
          totalAmount: 375.00
        },
        {
          id: 2,
          guestName: 'Sarah Johnson',
          apartmentName: 'Seaside Studio',
          checkInDate: '2024-02-01',
          checkOutDate: '2024-02-05',
          status: 'invited',
          totalAmount: 500.00
        },
        {
          id: 3,
          guestName: 'Mike Wilson',
          apartmentName: 'Garden Apartment',
          checkInDate: '2024-02-10',
          checkOutDate: '2024-02-15',
          status: 'pending',
          totalAmount: 750.00
        }
      ]
      setRecentReservations(mockReservations)
      
      const mockCleaningTasks = [
        {
          id: 1,
          apartmentName: 'Downtown Loft',
          taskDate: '2024-01-28',
          status: 'pending',
          taskType: 'checkout_cleaning',
          guestName: 'John Smith'
        },
        {
          id: 2,
          apartmentName: 'Seaside Studio',
          taskDate: '2024-01-31',
          status: 'pending',
          taskType: 'maintenance_cleaning',
          guestName: null
        }
      ]
      setCleaningTasks(mockCleaningTasks)
      
    } catch (error) {
      console.error('Error loading owner data:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('userRole')
    localStorage.removeItem('authToken')
    toast.success('Logged out successfully')
    navigate('/owner/login')
  }

  const handleAddApartment = () => {
    toast.success('Add apartment feature coming soon!')
  }

  const handleEditApartment = (apartmentId) => {
    toast.success(`Edit apartment ${apartmentId} feature coming soon!`)
  }

  const handleViewApartment = (apartmentId) => {
    toast.success(`View apartment ${apartmentId} details feature coming soon!`)
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
              <h1 className="text-2xl font-bold text-primary-600">Owner Dashboard</h1>
              <p className="text-sm text-gray-600">Property Management & Analytics</p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleAddApartment}
                className="btn-primary text-sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Property
              </button>
              <button
                onClick={handleLogout}
                className="text-gray-600 hover:text-red-600 transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <div className="card">
              <div className="flex items-center">
                <DollarSign className="w-8 h-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Monthly Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">${stats.monthlyRevenue.toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center">
                <TrendingUp className="w-8 h-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Occupancy Rate</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.occupancyRate}%</p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center">
                <BarChart3 className="w-8 h-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Average Daily Rate</p>
                  <p className="text-2xl font-bold text-gray-900">${stats.averageDailyRate.toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center">
                <Calendar className="w-8 h-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Upcoming Reservations</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.upcomingReservations}</p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center">
                <Home className="w-8 h-8 text-indigo-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Properties</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalApartments}</p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center">
                <Clock className="w-8 h-8 text-yellow-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pending Cleaning</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.pendingCleaningTasks}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Properties Management */}
        <div className="card mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Your Properties</h2>
            <button
              onClick={handleAddApartment}
              className="btn-secondary text-sm"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Property
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {apartments.map((apartment) => (
              <div key={apartment.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{apartment.name}</h3>
                    <p className="text-sm text-gray-600">Room {apartment.roomNumber}</p>
                  </div>
                  <span className={`status-badge ${apartment.isActive ? 'status-completed' : 'status-cancelled'}`}>
                    {apartment.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                
                <p className="text-sm text-gray-600 mb-2">{apartment.address}</p>
                <p className="text-sm text-gray-600 mb-3">Max Guests: {apartment.maxGuests}</p>
                
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Current:</span>
                    <span className="font-medium">{apartment.currentOccupancy}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Next:</span>
                    <span className="font-medium">{apartment.nextReservation}</span>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleViewApartment(apartment.id)}
                    className="flex-1 btn-secondary text-xs"
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    View
                  </button>
                  <button
                    onClick={() => handleEditApartment(apartment.id)}
                    className="flex-1 btn-secondary text-xs"
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Reservations */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Recent Reservations</h2>
            
            <div className="space-y-4">
              {recentReservations.map((reservation) => (
                <div key={reservation.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{reservation.guestName}</p>
                    <p className="text-sm text-gray-600">{reservation.apartmentName}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(reservation.checkInDate).toLocaleDateString()} - {new Date(reservation.checkOutDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">${reservation.totalAmount.toFixed(2)}</p>
                    <span className={`status-badge ${
                      reservation.status === 'completed' ? 'status-completed' :
                      reservation.status === 'invited' ? 'status-pending' :
                      'status-cancelled'
                    }`}>
                      {reservation.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cleaning Tasks */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Cleaning Status</h2>
            
            <div className="space-y-4">
              {cleaningTasks.map((task) => (
                <div key={task.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{task.apartmentName}</p>
                    <p className="text-sm text-gray-600">
                      {task.taskType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </p>
                    <p className="text-sm text-gray-600">
                      {new Date(task.taskDate).toLocaleDateString()}
                      {task.guestName && ` - After ${task.guestName}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`status-badge ${
                      task.status === 'completed' ? 'status-completed' :
                      task.status === 'in_progress' ? 'status-pending' :
                      'status-cancelled'
                    }`}>
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
              
              {cleaningTasks.length === 0 && (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <p className="text-gray-500">All cleaning tasks completed!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
