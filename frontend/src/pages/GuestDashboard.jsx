import { useState, useEffect } from '../../$node_modules/@types/react/index.js'
import { useParams, useNavigate } from '../../$node_modules/react-router-dom/dist/index.js'
import toast from '../../$node_modules/react-hot-toast/dist/index.js'
import { 
  Calendar, 
  MapPin, 
  Wifi, 
  Phone, 
  Clock, 
  Users, 
  Key,
  Info,
  AlertCircle,
  CheckCircle,
  Home,
  MessageCircle,
  Bed,
  Star,
  Building
} from '../../$node_modules/lucide-react/dist/lucide-react.js'
import LoadingSpinner from '../components/LoadingSpinner'

export default function GuestDashboard() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [dashboardData, setDashboardData] = useState(null)
  const [checkinStatus, setCheckinStatus] = useState(null)

  useEffect(() => {
    if (token) {
      loadGuestData()
    }
  }, [token])

  const loadGuestData = async () => {
    try {
      setLoading(true)
      
      // Get complete guest dashboard data using new schema
      const response = await fetch(`/api/guest/${token}`)
      if (!response.ok) {
        throw new Error('Reservation not found')
      }
      
      const data = await response.json()
      setDashboardData(data)
      setCheckinStatus({ completed: data.checkin_status === 'completed' })
      
    } catch (error) {
      console.error('Error loading guest data:', error)
      toast.error('Failed to load reservation details')
      navigate('/')
    } finally {
      setLoading(false)
    }
  }

  const handleContactSupport = () => {
    toast.success('Support contact feature coming soon!')
  }

  const getContentIcon = (type) => {
    switch (type) {
      case 'wifi': return <Wifi className="w-5 h-5" />
      case 'amenities': return <Home className="w-5 h-5" />
      case 'local_info': return <MapPin className="w-5 h-5" />
      case 'emergency': return <AlertCircle className="w-5 h-5" />
      default: return <Info className="w-5 h-5" />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    )
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Reservation Not Found</h1>
          <p className="text-gray-600">The reservation link may be invalid or expired.</p>
        </div>
      </div>
    )
  }

  const { reservation, property, room } = dashboardData

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-primary-600">Welcome, {reservation.guest_name}!</h1>
                <p className="text-sm text-gray-600">Your stay at {property.name}</p>
              </div>
              <div className="text-right">
                <Building className="w-8 h-8 text-primary-600 mx-auto mb-1" />
                <p className="text-xs text-gray-500">Property</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Reservation Overview */}
        <div className="card mb-8">
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Your Reservation</h2>
            {checkinStatus?.completed ? (
              <span className="status-badge status-completed">
                <CheckCircle className="w-4 h-4 mr-1" />
                Check-in Complete
              </span>
            ) : (
              <span className="status-badge status-pending">
                <Clock className="w-4 h-4 mr-1" />
                Check-in Pending
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center">
                <Calendar className="w-5 h-5 text-gray-400 mr-3" />
                <div>
                  <p className="text-sm text-gray-600">Check-in Date</p>
                  <p className="font-medium">{new Date(reservation.check_in_date).toLocaleDateString()}</p>
                </div>
              </div>
              
              <div className="flex items-center">
                <Calendar className="w-5 h-5 text-gray-400 mr-3" />
                <div>
                  <p className="text-sm text-gray-600">Check-out Date</p>
                  <p className="font-medium">{new Date(reservation.check_out_date).toLocaleDateString()}</p>
                </div>
              </div>
              
              <div className="flex items-center">
                <Users className="w-5 h-5 text-gray-400 mr-3" />
                <div>
                  <p className="text-sm text-gray-600">Guests</p>
                  <p className="font-medium">{reservation.num_guests} {reservation.num_guests === 1 ? 'Guest' : 'Guests'}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center">
                <Building className="w-5 h-5 text-gray-400 mr-3" />
                <div>
                  <p className="text-sm text-gray-600">Property</p>
                  <p className="font-medium">{property.name}</p>
                </div>
              </div>
              
              <div className="flex items-center">
                <Home className="w-5 h-5 text-gray-400 mr-3" />
                <div>
                  <p className="text-sm text-gray-600">Room</p>
                  <p className="font-medium">{room.room_number} - {room.room_name}</p>
                </div>
              </div>
              
              <div className="flex items-center">
                <MapPin className="w-5 h-5 text-gray-400 mr-3" />
                <div>
                  <p className="text-sm text-gray-600">Address</p>
                  <p className="font-medium">{property.address}</p>
                </div>
              </div>
            </div>
          </div>

          {!checkinStatus?.completed && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-yellow-600 mr-2" />
                <p className="text-yellow-800">
                  Please complete your check-in process before your arrival.{' '}
                  <button 
                    onClick={() => navigate(`/checkin/${token}`)}
                    className="font-medium underline hover:no-underline"
                  >
                    Complete Check-in
                  </button>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Room Details */}
        <div className="card mb-8">
          <div className="flex items-center mb-4">
            <Key className="w-6 h-6 text-primary-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Your Room Details</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-primary-800">Room Access Code</span>
                  <Key className="w-4 h-4 text-primary-600" />
                </div>
                <p className="text-2xl font-mono font-bold text-primary-900">{room.access_code}</p>
              </div>
              
              {room.bed_configuration && (
                <div className="flex items-center">
                  <Bed className="w-5 h-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm text-gray-600">Bed Configuration</p>
                    <p className="font-medium">{room.bed_configuration}</p>
                  </div>
                </div>
              )}
              
              <div className="flex items-center">
                <Users className="w-5 h-5 text-gray-400 mr-3" />
                <div>
                  <p className="text-sm text-gray-600">Room Capacity</p>
                  <p className="font-medium">Up to {room.max_guests} guests</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {room.access_instructions && (
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Access Instructions</h3>
                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{room.access_instructions}</p>
                </div>
              )}
              
              {room.amenities && Object.keys(room.amenities).length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Room Amenities</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(room.amenities).map(([amenity, available]) => (
                      available && (
                        <div key={amenity} className="flex items-center text-sm">
                          <CheckCircle className="w-3 h-3 text-green-500 mr-1" />
                          <span className="capitalize">{amenity.replace('_', ' ')}</span>
                        </div>
                      )
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Property Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* WiFi Information */}
          <div className="card">
            <div className="flex items-center mb-3">
              <Wifi className="w-5 h-5 text-blue-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">WiFi Information</h3>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-gray-600">Network Name</p>
                <p className="font-mono font-medium">{property.wifi_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Password</p>
                <p className="font-mono font-medium">{property.wifi_password}</p>
              </div>
            </div>
          </div>

          {/* Emergency Contact */}
          {property.emergency_contact && (
            <div className="card">
              <div className="flex items-center mb-3">
                <Phone className="w-5 h-5 text-red-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">Emergency Contact</h3>
              </div>
              <p className="font-medium">{property.emergency_contact}</p>
            </div>
          )}
        </div>

        {/* Check-in Instructions */}
        {property.check_in_instructions && (
          <div className="card mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Check-in Instructions</h2>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-800">{property.check_in_instructions}</p>
            </div>
          </div>
        )}

        {/* House Rules */}
        {property.house_rules && (
          <div className="card mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">House Rules</h2>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-gray-800 whitespace-pre-line">{property.house_rules}</p>
            </div>
          </div>
        )}

        {/* Property Amenities */}
        {property.amenities && Object.keys(property.amenities).length > 0 && (
          <div className="card mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Property Amenities</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(property.amenities).map(([amenity, available]) => (
                available && (
                  <div key={amenity} className="flex items-center p-2 bg-gray-50 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    <span className="text-sm text-gray-700 capitalize">{amenity.replace('_', ' ')}</span>
                  </div>
                )
              ))}
            </div>
          </div>
        )}

        {/* Contact Support */}
        <div className="card">
          <div className="text-center">
            <MessageCircle className="w-12 h-12 text-primary-600 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Need Help?</h2>
            <p className="text-gray-600 mb-4">
              Our support team is here to help with any questions or issues during your stay.
            </p>
            <button
              onClick={handleContactSupport}
              className="btn-primary"
            >
              <Phone className="w-4 h-4 mr-2" />
              Contact Support
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
