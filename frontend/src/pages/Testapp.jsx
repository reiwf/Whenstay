import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
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
  Building,
  Utensils,
  Camera,
  Car,
  ShoppingBag,
  Coffee,
  Unlock,
  FileText,
  Menu,
  X,
  ArrowLeft
} from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import { 
  canAccessRoomTokyoTime, 
  getTokyoCountdown, 
  formatTokyoAccessTime 
} from '../utils/tokyoTime'

export default function GuestApp() {
  const { token } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [dashboardData, setDashboardData] = useState(null)
  const [checkinStatus, setCheckinStatus] = useState(null)
  const [activeSection, setActiveSection] = useState('overview')
  const [countdown, setCountdown] = useState(null)

  useEffect(() => {
    if (token) {
      loadGuestData()
    }
  }, [token])

  // Handle success message from check-in completion
  useEffect(() => {
    if (location.state?.justCompleted) {
      const message = location.state.message || 'Check-in completed successfully!'
      toast.success(message, {
        duration: 5000,
        icon: '🎉'
      })
      
      // Clear the state to prevent showing the message again on refresh
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state, navigate, location.pathname])

  const loadGuestData = useCallback(async () => {
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
  }, [token, navigate])

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

  const getRecommendationIcon = (category) => {
    switch (category.toLowerCase()) {
      case 'dining':
      case 'restaurants':
      case 'food':
        return <Utensils className="w-5 h-5" />
      case 'attractions':
      case 'sightseeing':
      case 'entertainment':
        return <Camera className="w-5 h-5" />
      case 'transportation':
      case 'transport':
      case 'travel':
        return <Car className="w-5 h-5" />
      case 'shopping':
      case 'stores':
        return <ShoppingBag className="w-5 h-5" />
      case 'cafes':
      case 'coffee':
        return <Coffee className="w-5 h-5" />
      default:
        return <MapPin className="w-5 h-5" />
    }
  }

  // Check if guest can access room details based on Tokyo time and check-in status
  const canAccessRoomDetails = useCallback(() => {
    if (!dashboardData || !checkinStatus?.completed) {
      return false
    }

    const { reservation, property } = dashboardData

    return canAccessRoomTokyoTime(
      reservation.check_in_date,
      property.access_time,
      checkinStatus.completed
    )
  }, [dashboardData, checkinStatus])

  // Format countdown display
  const formatCountdown = (countdown) => {
    if (!countdown || countdown.expired) return null
    
    const parts = []
    if (countdown.days > 0) parts.push(`${countdown.days}d`)
    if (countdown.hours > 0) parts.push(`${countdown.hours}h`)
    if (countdown.minutes > 0) parts.push(`${countdown.minutes}m`)
    if (countdown.seconds > 0 || parts.length === 0) parts.push(`${countdown.seconds}s`)
    
    return parts.join(' ')
  }

  // Tokyo time countdown effect with proper dependency management
  useEffect(() => {
    // Only run if we have the necessary data and check-in is completed
    if (!dashboardData?.property?.access_time || 
        !dashboardData?.reservation?.check_in_date ||
        !checkinStatus?.completed) {
      return
    }

    const { reservation, property } = dashboardData

    // Check if already accessible using Tokyo time
    if (canAccessRoomTokyoTime(reservation.check_in_date, property.access_time, checkinStatus.completed)) {
      return
    }

    // Set initial countdown using Tokyo time
    const initialCountdown = getTokyoCountdown(reservation.check_in_date, property.access_time)
    setCountdown(initialCountdown)

    // If already expired, don't start interval
    if (initialCountdown?.expired) {
      return
    }

    // Update countdown every second using Tokyo time
    const interval = setInterval(() => {
      const newCountdown = getTokyoCountdown(reservation.check_in_date, property.access_time)
      
      if (newCountdown?.expired || newCountdown === null) {
        setCountdown(null)
        clearInterval(interval)
      } else {
        setCountdown(newCountdown)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [dashboardData?.property?.access_time, dashboardData?.reservation?.check_in_date, checkinStatus?.completed])


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

  const renderOverviewSection = () => (
    <div className="space-y-8">
        {/* Reservation Overview */}
        <div className="card">
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
                  <p className="font-medium">{room.room_name}</p>
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

        {/* Time-based Room Access Section */}
        {canAccessRoomDetails() && (
          <div className="card border-green-200 bg-green-50">
            <div className="flex items-center mb-4">
              <Unlock className="w-6 h-6 text-green-600 mr-2" />
              <h2 className="text-lg font-semibold text-green-900">Enter Room Details</h2>
              <span className="ml-auto text-xs text-green-700 bg-green-200 px-2 py-1 rounded-full">
                Available Now
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="bg-green-100 border border-green-300 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-green-800">Room Access Code</span>
                    <Key className="w-4 h-4 text-green-600" />
                  </div>
                  <p className="text-3xl font-mono font-bold text-green-900">{room.access_code}</p>
                </div>
                
                {room.unit_number && (
                  <div className="flex items-center">
                    <Home className="w-5 h-5 text-green-600 mr-3" />
                    <div>
                      <p className="text-sm text-green-700">Unit Number</p>
                      <p className="font-medium text-green-900">{room.unit_number}</p>
                    </div>
                  </div>
                )}
                
                {room.floor_number && (
                  <div className="flex items-center">
                    <Building className="w-5 h-5 text-green-600 mr-3" />
                    <div>
                      <p className="text-sm text-green-700">Floor</p>
                      <p className="font-medium text-green-900">Floor {room.floor_number}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {room.access_instructions && (
                  <div>
                    <h3 className="text-sm font-medium text-green-900 mb-2">Detailed Access Instructions</h3>
                    <div className="bg-white border border-green-200 rounded-lg p-3">
                      <p className="text-sm text-green-800 whitespace-pre-line">{room.access_instructions}</p>
                    </div>
                  </div>
                )}
                
                {property.emergency_contact && (
                  <div>
                    <h3 className="text-sm font-medium text-green-900 mb-2">Emergency Contact</h3>
                    <div className="bg-white border border-green-200 rounded-lg p-3">
                      <div className="flex items-center">
                        <Phone className="w-4 h-4 text-green-600 mr-2" />
                        <p className="text-sm font-medium text-green-800">{property.emergency_contact}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Access Time Information with Countdown */}
        {!canAccessRoomDetails() && checkinStatus?.completed && property.access_time && (
          <div className="card border-yellow-200 bg-yellow-50">
            <div className="flex items-center mb-4">
              <Clock className="w-6 h-6 text-yellow-600 mr-2" />
              <h2 className="text-lg font-semibold text-yellow-900">Room Access Countdown</h2>
            </div>
            
            <div className="space-y-4">
              {/* Countdown Display */}
              {countdown && !countdown.expired && (
                <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-6 text-center">
                  <div className="mb-4">
                    <p className="text-sm text-yellow-700 mb-2">Room access available in:</p>
                    <div className="text-2xl font-mono font-bold text-yellow-900 mb-4">
                      {formatCountdown(countdown)}
                    </div>
                  </div>
                  
                  {/* Time breakdown - always show when countdown exists */}
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="bg-white border border-yellow-200 rounded-lg p-3">
                      <div className="text-xl font-bold text-yellow-900">{countdown.days || 0}</div>
                      <div className="text-xs text-yellow-700 font-medium">Days</div>
                    </div>
                    <div className="bg-white border border-yellow-200 rounded-lg p-3">
                      <div className="text-xl font-bold text-yellow-900">{countdown.hours || 0}</div>
                      <div className="text-xs text-yellow-700 font-medium">Hours</div>
                    </div>
                    <div className="bg-white border border-yellow-200 rounded-lg p-3">
                      <div className="text-xl font-bold text-yellow-900">{countdown.minutes || 0}</div>
                      <div className="text-xs text-yellow-700 font-medium">Minutes</div>
                    </div>
                    <div className="bg-white border border-yellow-200 rounded-lg p-3">
                      <div className="text-xl font-bold text-yellow-900">{countdown.seconds || 0}</div>
                      <div className="text-xs text-yellow-700 font-medium">Seconds</div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Access Time Information */}
              <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-4">
                <p className="text-yellow-800">
                  <strong>Room access details will be available at {formatTokyoAccessTime(property.access_time)} on {new Date(reservation.check_in_date).toLocaleDateString()}.</strong>
                </p>
                <p className="text-sm text-yellow-700 mt-2">
                  Your room access code and detailed instructions will automatically appear when the access time arrives.
                </p>
              </div>
            </div>
          </div>
        )}

    </div>
  )

  const renderPropertySection = () => (
    <div className="space-y-8">
      {/* Property Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Check-in Instructions</h2>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800">{property.check_in_instructions}</p>
          </div>
        </div>
      )}

      {/* House Rules */}
      {property.house_rules && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">House Rules</h2>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-gray-800 whitespace-pre-line">{property.house_rules}</p>
          </div>
        </div>
      )}

      {/* Property Amenities */}
      {property.amenities && Object.keys(property.amenities).length > 0 && (
        <div className="card">
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
    </div>
  )

  const renderLocalSection = () => (
    <div className="space-y-8">
      {/* Local Recommendations */}
      {property.location_info && (
        <div className="card">
            <div className="flex items-center mb-4">
              <MapPin className="w-6 h-6 text-blue-600 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">Local Recommendations</h2>
            </div>
            
            {typeof property.location_info === 'object' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(property.location_info).map(([category, items]) => (
                  <div key={category} className="space-y-3">
                    <div className="flex items-center mb-3">
                      {getRecommendationIcon(category)}
                      <h3 className="text-md font-semibold text-gray-900 ml-2 capitalize">
                        {category.replace('_', ' ')}
                      </h3>
                    </div>
                    
                    {Array.isArray(items) ? (
                      <div className="space-y-2">
                        {items.map((item, index) => (
                          <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                            {typeof item === 'object' ? (
                              <div>
                                <p className="font-medium text-gray-900">{item.name}</p>
                                {item.description && (
                                  <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                                )}
                                {item.address && (
                                  <p className="text-xs text-gray-500 mt-1">{item.address}</p>
                                )}
                                {item.distance && (
                                  <p className="text-xs text-blue-600 mt-1">{item.distance}</p>
                                )}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-700">{item}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <p className="text-sm text-gray-700">{items}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800">{property.location_info}</p>
              </div>
            )}
          </div>
        )}
    </div>
  )

  const renderDocumentsSection = () => (
    <div className="space-y-8">
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

      {/* Documents placeholder */}
      <div className="card">
        <div className="text-center py-8">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Documents</h3>
          <p className="text-gray-600">Important documents and agreements will appear here.</p>
        </div>
      </div>
    </div>
  )

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-96">
          <LoadingSpinner size="large" />
        </div>
      )
    }

    switch (activeSection) {
      case 'overview':
        return renderOverviewSection()
      case 'property':
        return renderPropertySection()
      case 'local':
        return renderLocalSection()
      case 'documents':
        return renderDocumentsSection()
      default:
        return renderOverviewSection()
    }
  }

  const navigationItems = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'property', label: 'Property', icon: Building },
    { id: 'local', label: 'Local', icon: MapPin },
    { id: 'documents', label: 'Support', icon: MessageCircle }
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Mobile Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate('/')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-lg font-semibold text-gray-900 truncate">
                  Welcome, {reservation?.guest_name}!
                </h1>
                <p className="text-sm text-gray-600 truncate">
                  {property?.name}
                </p>
              </div>
            </div>
            <div className="flex items-center">
              <Building className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 pb-20">
        <div className="px-4 py-6 max-w-4xl mx-auto">
          {renderContent()}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-10">
        <div className="grid grid-cols-4 gap-1">
          {navigationItems.map((item) => {
            const IconComponent = item.icon
            const isActive = activeSection === item.id
            
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`flex flex-col items-center py-3 px-2 transition-colors ${
                  isActive
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <IconComponent className={`w-5 h-5 mb-1 ${
                  isActive ? 'text-blue-600' : 'text-gray-400'
                }`} />
                <span className="text-xs font-medium truncate">
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
