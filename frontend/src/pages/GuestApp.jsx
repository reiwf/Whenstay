import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import { 
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
  PlaneLanding,
  PlaneTakeoff,
  Building,
  Utensils,
  Camera,
  Car,
  ShoppingBag,
  Coffee,
  Unlock,
  FileText,
  ArrowLeft,
  CreditCard,
  UserCircle,
  Eye,
  EyeOff
} from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import GuestMessagePanel from '../components/communication/GuestMessagePanel'
import JourneyRoadmap from '../components/guest/JourneyRoadmap'
import GuestProfile from '../components/guest/GuestProfile'
import LayoutShell from '../components/layout/LayoutShell'

export default function GuestApp() {
  const { token } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [dashboardData, setDashboardData] = useState(null)
  const [checkinStatus, setCheckinStatus] = useState(null)
  const [activeSection, setActiveSection] = useState('reservation')
  const [accessCodeRevealed, setAccessCodeRevealed] = useState(false)
  const [paymentRefreshTrigger, setPaymentRefreshTrigger] = useState(0)
  const [services, setServices] = useState([])
  const [servicesLoading, setServicesLoading] = useState(false)

  function StatusChip({ ok, okText = 'Ready', waitText = 'Pending' }) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium
        ${ok ? 'bg-white/15 text-white' : 'bg-black/10 text-white/90'} backdrop-blur`}>
        {ok ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
        {ok ? okText : waitText}
      </span>
    )
  }

  function SegmentedTabs({ items, active, onSelect }) {
    return (
      <div className="px-4">
        <div className="mx-auto -mt-4 w-full max-w-[430px]">
          <div className="rounded-full bg-white shadow ring-1 ring-black/5 overflow-hidden">
            <nav className="grid grid-cols-3">
              {items.map(({ id, label, icon: Icon }) => {
                const isActive = active === id
                return (
                  <button
                    key={id}
                    onClick={() => onSelect(id)}
                    className={`flex items-center justify-center gap-2 py-2.5 text-sm transition
                      ${isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-500 hover:bg-gray-50'}`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-primary-600' : 'text-gray-400'}`} />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                )
              })}
            </nav>
          </div>
        </div>
      </div>
    )
  }

  function FloatingBottomNav({ items, active, onSelect }) {
    return (
      <div className="fixed left-1/2 bottom-4 z-20 -translate-x-1/2 w-full px-4">
        <div className="mx-auto max-w-[430px]">
          <div className="pointer-events-auto rounded-full bg-white/90 backdrop-blur shadow-lg ring-1 ring-black/5">
            <div className="grid grid-cols-3">
              {items.map(({ id, label, icon: Icon }) => {
                const isActive = active === id
                return (
                  <button
                    key={id}
                    onClick={() => onSelect(id)}
                    className={`flex flex-col items-center py-3 px-3 text-[11px] transition
                      ${isActive ? 'text-primary-700' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-primary-600' : 'text-gray-400'}`} />
                    <span className="truncate">{label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )
  }


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

  // Handle payment return from Stripe
  useEffect(() => {
    const handlePaymentReturn = async () => {
      const urlParams = new URLSearchParams(location.search)
      const paymentSuccess = urlParams.get('payment_success')
      const paymentCanceled = urlParams.get('payment_canceled')

      if (paymentSuccess === 'true') {
        toast.success('Payment completed successfully! 🎉', {
          duration: 6000,
        })
        
        // Clear the URL parameters
        navigate(location.pathname, { replace: true })
        
        // Trigger a refresh of BOTH the page data AND services data to update payment status
        if (token) {
          await loadGuestData()
          await loadServices() // This is crucial - refresh services after payment
          // Also trigger payment widget refresh
          setPaymentRefreshTrigger(prev => prev + 1)
        }
      } else if (paymentCanceled === 'true') {
        toast.error('Payment was canceled. You can try again anytime.', {
          duration: 4000,
        })
        
        // Clear the URL parameters
        navigate(location.pathname, { replace: true })
      }
    }

    handlePaymentReturn()
  }, [location.search, location.pathname, navigate, token])

  const loadGuestData = async () => {
    try {
      setLoading(true)
      
      // Get complete guest dashboard data using new multi-guest schema
      const response = await fetch(`/api/guest/${token}`)
      if (!response.ok) {
        throw new Error('Reservation not found')
      }
      
      const data = await response.json()
      console.log('GuestApp loaded data:', data)
      
      setDashboardData(data)
      
      // Update completion detection for multi-guest structure
      const allGuestsCompleted = data.reservation?.all_guests_completed || false
      const primaryGuestCompleted = data.guests?.find(g => g.is_primary_guest)?.is_completed || false
      
      setCheckinStatus({ 
        completed: allGuestsCompleted || data.checkin_status === 'completed',
        access_read: data.reservation?.access_read || false,
        allGuestsCompleted: allGuestsCompleted,
        primaryGuestCompleted: primaryGuestCompleted
      })
      
      // If access_read is true, show the access code immediately
      if (data.reservation?.access_read) {
        setAccessCodeRevealed(true)
      }

      // Load services for this reservation
      await loadServices()
      
    } catch (error) {
      console.error('Error loading guest data:', error)
      toast.error('Failed to load reservation details')
      navigate('/')
    } finally {
      setLoading(false)
    }
  }

  const loadServices = async () => {
    try {
      setServicesLoading(true)
      const response = await fetch(`/api/guest/${token}/services`)
      if (response.ok) {
        const servicesData = await response.json()
        setServices(servicesData)
      }
    } catch (error) {
      console.error('Error loading services:', error)
    } finally {
      setServicesLoading(false)
    }
  }

  const handleServicePurchase = async (serviceId) => {
    try {
      const response = await fetch(`/api/guest/${token}/services/${serviceId}/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const { checkout_url } = await response.json()
        // Redirect to Stripe checkout
        window.location.href = checkout_url
      } else {
        const errorData = await response.json()
        toast.error(errorData.message || 'Failed to initiate payment')
      }
    } catch (error) {
      console.error('Error purchasing service:', error)
      toast.error('Failed to initiate payment')
    }
  }

  const getServiceIcon = (serviceType) => {
    switch (serviceType?.toLowerCase()) {
      case 'accommodation_tax':
        return <CreditCard className="w-5 h-5" />
      case 'early_checkin':
        return <Clock className="w-5 h-5" />
      case 'late_checkout':
        return <Clock className="w-5 h-5" />
      case 'extra_cleaning':
        return <Home className="w-5 h-5" />
      case 'breakfast':
        return <Coffee className="w-5 h-5" />
      case 'parking':
        return <Car className="w-5 h-5" />
      default:
        return <ShoppingBag className="w-5 h-5" />
    }
  }

  const handleContactcontact = () => {
    toast.success('contact contact feature coming soon!')
  }

  const handleRevealAccessCode = async () => {
    try {
      const response = await fetch(`/api/guest/${token}/access-read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        setAccessCodeRevealed(true)
        toast.success('Access code revealed!')
      } else {
        toast.error('Failed to reveal access code')
      }
    } catch (error) {
      console.error('Error revealing access code:', error)
      toast.error('Failed to reveal access code')
    }
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

  // Check if guest can access room details based on time and check-in status
  const canAccessRoomDetails = () => {
    if (!dashboardData || !checkinStatus?.completed) {
      return false
    }

    const { reservation, property } = dashboardData

    // Get current date in local timezone (YYYY-MM-DD format)
    const now = new Date()
    const today = now.getFullYear() + '-' + 
                 String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                 String(now.getDate()).padStart(2, '0')
    
    // Get check-in date in local timezone (YYYY-MM-DD format)
    const checkinDateObj = new Date(reservation.check_in_date)
    const checkinDate = checkinDateObj.getFullYear() + '-' + 
                       String(checkinDateObj.getMonth() + 1).padStart(2, '0') + '-' + 
                       String(checkinDateObj.getDate()).padStart(2, '0')
    
    // Check if today is before the check-in date
    if (today < checkinDate) {
      return false
    }

    // If today is after the check-in date, allow full access
    if (today > checkinDate) {
      return true
    }


    
    // If there's an access time specified, check if current time is past access time
    if (property.access_time) {
      const currentHour = now.getHours()
      const currentMinute = now.getMinutes()
      const currentTimeInMinutes = currentHour * 60 + currentMinute

      // Parse access time (format: "14:00:00" or "14:00")
      const [accessHour, accessMinute] = property.access_time.split(':').map(num => parseInt(num, 10))
      const accessTimeInMinutes = accessHour * 60 + accessMinute
      
      const canAccess = currentTimeInMinutes >= accessTimeInMinutes
      
      return canAccess
    }

    return true
  }


  const formatAccessTime = (timeString) => {
    if (!timeString) return ''
    try {
      const [hours, minutes] = timeString.split(':')
      const time = new Date()
      time.setHours(parseInt(hours), parseInt(minutes))
      return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch (error) {
      return timeString
    }
  }

  const calculateEarlyTime = (originalTime, offsetMinutes) => {
    if (!originalTime || !offsetMinutes) return originalTime
    try {
      const [hours, minutes] = originalTime.split(':').map(num => parseInt(num, 10))
      const totalMinutes = (hours * 60) + minutes - offsetMinutes
      const newHours = Math.floor(totalMinutes / 60)
      const newMinutes = totalMinutes % 60
      return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`
    } catch (error) {
      return originalTime
    }
  }

  const calculateLateTime = (originalTime, offsetMinutes) => {
    if (!originalTime || !offsetMinutes) return originalTime
    try {
      const [hours, minutes] = originalTime.split(':').map(num => parseInt(num, 10))
      const totalMinutes = (hours * 60) + minutes + offsetMinutes
      const newHours = Math.floor(totalMinutes / 60)
      const newMinutes = totalMinutes % 60
      return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`
    } catch (error) {
      return originalTime
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
          <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Reservation Not Found</h1>
          <p className="text-gray-600">The reservation link may be invalid or expired.</p>
        </div>
      </div>
    )
  }

  const { reservation, property, room } = dashboardData

  const renderOverviewSection = () => {
    return (
      <div className="space-y-8">
        
        {/* Journey Roadmap */}
        <JourneyRoadmap 
          checkinCompleted={checkinStatus?.completed}
          taxPaid={dashboardData?.accommodation_tax_paid}
          canAccessStayInfo={canAccessRoomDetails()}
          property={property}
          reservation={reservation}
        />

        {/* Check-in Action Card */}
        {!checkinStatus?.completed && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 sm:p-6">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600 mr-3 mt-1 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-semibold text-yellow-900 mb-2">
                  Complete Your Check-in
                </h3>
                <p className="text-sm sm:text-base text-yellow-800 mb-4 break-words">
                  Please complete your online check-in process to receive your room access details. You must complete check-in before your arrival to get the access code.
                </p>
                <button 
                  onClick={() => navigate(`/checkin/${token}`)}
                  className="inline-flex items-center px-3 py-2 sm:px-4 sm:py-2 bg-yellow-600 text-white text-sm sm:text-base font-medium rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-1 focus:ring-offset-2 focus:ring-yellow-500 w-full sm:w-auto justify-center"
                >
                  <ArrowLeft className="w-4 h-4 mr-2 flex-shrink-0" />
                  Complete Check-in Now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Time-based Room Access Section */}
        {canAccessRoomDetails() && (
          <div className="card border-primary-200">
            <div className="flex items-center mb-4">
              <Unlock className="w-5 h-5 sm:w-6 sm:h-6 text-primary-600 mr-2 flex-shrink-0" />
              <h2 className="text-base sm:text-lg font-semibold text-primary-900 flex-1 min-w-0">Room Access Details</h2>
              <span className="ml-auto text-xs sm:text-sm text-primary-50 bg-primary-500 px-2 py-1 rounded-full flex-shrink-0">
                Available Now
              </span>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-4">
                <div className="bg-primary-100 border border-primary-300 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-primary-800">Room Access Code</span>
                    <Key className="w-4 h-4 text-primary-600" />
                  </div>
                  
                  {/* Show button to reveal code if access_read is false, otherwise show the code */}
                  {!checkinStatus?.access_read && !accessCodeRevealed ? (
                    <div className="text-center py-4">
                      <button
                        onClick={handleRevealAccessCode}
                        className="bg-primary-600 hover:bg-primary-700 text-white font-medium px-6 py-3 rounded-lg transition-colors"
                      >
                        Get Code
                      </button>
                    </div>
                  ) : (
                    <p className="text-2xl md:text-3xl font-mono font-bold text-primary-900">{room.access_code}</p>
                  )}
                </div>
                
                {room.unit_number && (
                  <div className="flex items-center">
                    <Home className="w-5 h-5 text-primary-600 mr-3" />
                    <div>
                      <p className="text-sm text-primary-700">Room Number</p>
                      <p className="font-medium text-primary-900">{room.unit_number}</p>
                    </div>
                  </div>
                )}
                
                {room.floor_number && (
                  <div className="flex items-center">
                    <Building className="w-5 h-5 text-primary-600 mr-3" />
                    <div>
                      <p className="text-sm text-primary-700">Floor</p>
                      <p className="font-medium text-primary-900">Floor {room.floor_number}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {room.access_instructions && (
                  <div>
                    <h3 className="text-sm font-medium text-primary-900 mb-2">Access Instructions</h3>
                    <div className="bg-white border border-primary-200 rounded-lg p-3">
                      <p className="text-sm text-primary-800 whitespace-pre-line">{room.access_instructions}</p>
                    </div>
                  </div>
                )}
                
                {property.emergency_contact && (
                  <div>
                    <h3 className="text-sm font-medium text-primary-900 mb-2">Emergency Contact</h3>
                    <div className="bg-white border border-primary-200 rounded-lg p-3">
                      <div className="flex items-center">
                        <Phone className="w-4 h-4 text-primary-600 mr-2" />
                        <p className="text-sm font-medium text-primary-800">{property.emergency_contact}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>    
    )
  }

  const canAccessStayInfo = () => {
    // Check if check-in is completed
    if (!checkinStatus?.completed) {
      return false
    }
    
    // Check if all mandatory services are paid
    const mandatoryServices = services.filter(service => service.is_mandatory)
    const allMandatoryServicesPaid = mandatoryServices.length === 0 || 
      mandatoryServices.every(service => service.payment_status === 'paid')
    
    if (!allMandatoryServicesPaid) {
      return false
    }
    
    // Check if within access time window
    return canAccessRoomDetails()
  }

  const renderReservationSection = () => {
    const checkInDate = new Date(reservation.check_in_date)
    const checkOutDate = new Date(reservation.check_out_date)
    const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24))

    return (
      <div className="space-y-6">
       
        {/* Journey Roadmap */}
        <JourneyRoadmap 
          checkinCompleted={checkinStatus?.completed}
          services={services}
          canAccessStayInfo={canAccessStayInfo()}
          property={property}
          reservation={reservation}
        />

        {/* Check-in Action Card */}
        {!checkinStatus?.completed && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 sm:p-6">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600 mr-3 mt-1 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-semibold text-yellow-900 mb-2">
                  Complete Your Check-in
                </h3>
                <p className="text-sm sm:text-base text-yellow-800 mb-4 break-words">
                  Please complete your online check-in process to receive your room access details. You must complete check-in before your arrival to get the access code.
                </p>
                <button 
                  onClick={() => navigate(`/checkin/${token}`)}
                  className="inline-flex items-center px-3 py-2 sm:px-4 sm:py-2 bg-yellow-600 text-white text-sm sm:text-base font-medium rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-1 focus:ring-offset-2 focus:ring-yellow-500 w-full sm:w-auto justify-center"
                >
                  <ArrowLeft className="w-4 h-4 mr-2 flex-shrink-0" />
                  Complete Check-in Now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PUBLIC INFO SECTION - Always Visible */}
        <div className="card border-blue-200 bg-blue-50">
          <div className="flex items-center mb-4">
            <Info className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 mr-2 flex-shrink-0" />
            <h2 className="text-lg sm:text-xl font-semibold text-blue-900">Public Information</h2>
          </div>

          {/* Reservation Information */}
          <div className="bg-white border border-blue-200 rounded-lg p-4 sm:p-6 mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
              Reservation Details
            </h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Check-in Information */}
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <PlaneLanding className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">Check-in Date</p>
                    <p className="text-base sm:text-lg text-blue-700 break-words">
                      {checkInDate.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                    <p className="text-sm text-gray-600">
                      Access available: {formatAccessTime(property.access_time)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <PlaneTakeoff className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">Check-out Date</p>
                    <p className="text-base sm:text-lg text-blue-700 break-words">
                      {checkOutDate.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                    <p className="text-sm text-gray-600">
                      Departure: {formatAccessTime(property.departure_time) || '11:00 AM'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">Guests</p>
                    <p className="text-base sm:text-lg text-blue-700">
                      {reservation.num_guests} {reservation.num_guests === 1 ? 'Guest' : 'Guests'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Property Information */}
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Building className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">Property</p>
                    <p className="text-base sm:text-lg text-blue-700 break-words">
                      {property?.name || 'Property Name'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Home className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">Room Type</p>
                    <p className="text-base sm:text-lg text-blue-700 break-words">
                      {room?.room_name || 'Room'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">Duration</p>
                    <p className="text-base sm:text-lg text-blue-700">
                      {nights} {nights === 1 ? 'Night' : 'Nights'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Transport Access */}
          {property.transport_access && (
            <div className="bg-white border border-blue-200 rounded-lg p-4 sm:p-6 mb-4">
              <div className="flex items-center mb-3">
                <Car className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0" />
                <h4 className="text-base font-semibold text-gray-900">Transport Access</h4>
              </div>
              <p className="text-sm sm:text-base text-gray-700 whitespace-pre-line break-words">
                {property.transport_access}
              </p>
            </div>
          )}

          {/* Property Details */}
          {property.property_details && (
            <div className="bg-white border border-blue-200 rounded-lg p-4 sm:p-6 mb-4">
              <div className="flex items-center mb-3">
                <Building className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0" />
                <h4 className="text-base font-semibold text-gray-900">Property Details</h4>
              </div>
              <p className="text-sm sm:text-base text-gray-700 whitespace-pre-line break-words">
                {property.property_details}
              </p>
            </div>
          )}

          {/* Self Check-in Instructions */}
          {property.check_in_instructions && (
            <div className="bg-white border border-blue-200 rounded-lg p-4 sm:p-6 mb-4">
              <div className="flex items-center mb-3">
                <Key className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0" />
                <h4 className="text-base font-semibold text-gray-900">Self Check-in Instructions</h4>
              </div>
              <p className="text-sm sm:text-base text-gray-700 whitespace-pre-line break-words">
                {property.check_in_instructions}
              </p>
            </div>
          )}

          {/* House Rules */}
          {property.house_rules && (
            <div className="bg-white border border-blue-200 rounded-lg p-4 sm:p-6">
              <div className="flex items-center mb-3">
                <FileText className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0" />
                <h4 className="text-base font-semibold text-gray-900">House Rules & Policy</h4>
              </div>
              <p className="text-sm sm:text-base text-gray-700 whitespace-pre-line break-words">
                {property.house_rules}
              </p>
            </div>
          )}
        </div>

        {/* STAY INFO SECTION - Conditionally Visible */}
        <div className="card border-green-200 bg-green-50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Unlock className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 mr-2 flex-shrink-0" />
              <h2 className="text-lg sm:text-xl font-semibold text-green-900">Stay Information</h2>
            </div>
            {canAccessStayInfo() ? (
              <span className="text-xs sm:text-sm text-green-50 bg-green-500 px-2 py-1 rounded-full flex-shrink-0">
                Available Now
              </span>
            ) : (
              <span className="text-xs sm:text-sm text-red-50 bg-red-500 px-2 py-1 rounded-full flex-shrink-0">
                Access Restricted
              </span>
            )}
          </div>

          {canAccessStayInfo() ? (
            <div className="space-y-4">
              {/* Room Access Code */}
              <div className="bg-white border border-green-200 rounded-lg p-4 sm:p-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-base font-semibold text-gray-900">Room Access</h4>
                  <Key className="w-5 h-5 text-green-600" />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Access Code */}
                  <div className="bg-green-100 border border-green-300 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-green-800">Access Code</span>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setAccessCodeRevealed(!accessCodeRevealed)}
                          className="text-green-600 hover:text-green-700"
                        >
                          {accessCodeRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    
                    {!checkinStatus?.access_read && !accessCodeRevealed ? (
                      <div className="text-center py-2">
                        <button
                          onClick={handleRevealAccessCode}
                          className="bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2 rounded-lg transition-colors"
                        >
                          Reveal Code
                        </button>
                      </div>
                    ) : (
                      <p className="text-xl sm:text-2xl font-mono font-bold text-green-900">
                        {accessCodeRevealed ? room.access_code : '••••••'}
                      </p>
                    )}
                  </div>
                  
                  {/* Room Unit Info */}
                  <div className="space-y-3">
                    {room.unit_number && (
                      <div className="flex items-center">
                        <Home className="w-4 h-4 text-green-600 mr-2" />
                        <div>
                          <p className="text-xs text-gray-600">Room Number</p>
                          <p className="font-medium text-gray-900">{room.unit_number}</p>
                        </div>
                      </div>
                    )}
                    
                    {room.floor_number && (
                      <div className="flex items-center">
                        <Building className="w-4 h-4 text-green-600 mr-2" />
                        <div>
                          <p className="text-xs text-gray-600">Floor</p>
                          <p className="font-medium text-gray-900">Floor {room.floor_number}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Access Instructions */}
                {room.access_instructions && (
                  <div className="mt-4 pt-4 border-t border-green-200">
                    <h5 className="text-sm font-medium text-gray-900 mb-2">Access Instructions</h5>
                    <p className="text-sm text-gray-700 whitespace-pre-line break-words">
                      {room.access_instructions}
                    </p>
                  </div>
                )}
              </div>

              {/* House Manual */}
              {property.house_manual && (
                <div className="bg-white border border-green-200 rounded-lg p-4 sm:p-6">
                  <div className="flex items-center mb-3">
                    <FileText className="w-5 h-5 text-green-600 mr-2 flex-shrink-0" />
                    <h4 className="text-base font-semibold text-gray-900">House Manual</h4>
                  </div>
                  <p className="text-sm sm:text-base text-gray-700 whitespace-pre-line break-words">
                    {property.house_manual}
                  </p>
                </div>
              )}

              {/* WiFi Information */}
              <div className="bg-white border border-green-200 rounded-lg p-4 sm:p-6">
                <div className="flex items-center mb-3">
                  <Wifi className="w-5 h-5 text-green-600 mr-2 flex-shrink-0" />
                  <h4 className="text-base font-semibold text-gray-900">WiFi Information</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Network Name</p>
                    <p className="font-mono text-sm sm:text-base font-medium break-all text-gray-900">
                      {property.wifi_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Password</p>
                    <p className="font-mono text-sm sm:text-base font-medium break-all text-gray-900">
                      {property.wifi_password}
                    </p>
                  </div>
                </div>
              </div>

              {/* During Stay Information */}
              <div className="bg-white border border-green-200 rounded-lg p-4 sm:p-6">
                <div className="flex items-center mb-3">
                  <Info className="w-5 h-5 text-green-600 mr-2 flex-shrink-0" />
                  <h4 className="text-base font-semibold text-gray-900">During Your Stay</h4>
                </div>
                
                {/* Emergency Contact */}
                {property.emergency_contact && (
                  <div className="mb-4">
                    <div className="flex items-center mb-2">
                      <Phone className="w-4 h-4 text-green-600 mr-2" />
                      <p className="text-sm font-medium text-gray-900">Emergency Contact</p>
                    </div>
                    <p className="text-sm text-gray-700 font-medium">{property.emergency_contact}</p>
                  </div>
                )}

                {/* Property Amenities */}
                {property.amenities && Object.keys(property.amenities).length > 0 && (
                  <div className="mb-4">
                    <h5 className="text-sm font-medium text-gray-900 mb-2">Available Amenities</h5>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.entries(property.amenities).map(([amenity, available]) => (
                        available && (
                          <div key={amenity} className="flex items-center p-2 bg-green-100 rounded-lg">
                            <CheckCircle className="w-3 h-3 text-green-500 mr-2 flex-shrink-0" />
                            <span className="text-xs text-gray-700 capitalize truncate">
                              {amenity.replace('_', ' ')}
                            </span>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                )}

                {/* Local Recommendations */}
                {property.location_info && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-900 mb-2">Local Recommendations</h5>
                    {typeof property.location_info === 'object' ? (
                      <div className="space-y-3">
                        {Object.entries(property.location_info).map(([category, items]) => (
                          <div key={category}>
                            <div className="flex items-center mb-2">
                              {getRecommendationIcon(category)}
                              <h6 className="text-sm font-medium text-gray-800 ml-2 capitalize">
                                {category.replace('_', ' ')}
                              </h6>
                            </div>
                            
                            {Array.isArray(items) ? (
                              <div className="space-y-1">
                                {items.slice(0, 3).map((item, index) => (
                                  <div key={index} className="bg-green-100 rounded-lg p-2">
                                    {typeof item === 'object' ? (
                                      <div>
                                        <p className="text-sm font-medium text-gray-900 break-words">{item.name}</p>
                                        {item.description && (
                                          <p className="text-xs text-gray-600 mt-1 break-words">{item.description}</p>
                                        )}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-gray-700 break-words">{item}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="bg-green-100 rounded-lg p-2">
                                <p className="text-xs text-gray-700 break-words">{items}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-green-100 rounded-lg p-2">
                        <p className="text-sm text-gray-700 break-words">{property.location_info}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Access Restricted Message */
            <div className="bg-white border border-red-200 rounded-lg p-4 sm:p-6">
              <div className="text-center">
                <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
                <h4 className="text-base font-semibold text-red-900 mb-2">
                  Stay Information Not Available
                </h4>
                <div className="text-sm text-red-700 space-y-1">
                  {!checkinStatus?.completed && (
                    <p>• Complete your check-in process</p>
                  )}
                  {services.filter(s => s.is_mandatory && s.payment_status !== 'paid').length > 0 && (
                    <p>• Pay required services: {services.filter(s => s.is_mandatory && s.payment_status !== 'paid').map(s => s.name).join(', ')}</p>
                  )}
                  {!canAccessRoomDetails() && checkinStatus?.completed && (
                    <p>• Wait until {formatAccessTime(property.access_time)} on {checkInDate.toLocaleDateString()}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Addon Services Section */}
        <div className="card border-purple-200 bg-purple-50">
          <div className="flex items-center mb-4">
            <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 mr-2 flex-shrink-0" />
            <h2 className="text-lg sm:text-xl font-semibold text-purple-900">Addon</h2>
          </div>

          {servicesLoading ? (
            <div className="bg-white border border-purple-200 rounded-lg p-4 sm:p-6">
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner />
                <span className="ml-2 text-sm text-gray-600">Loading services...</span>
              </div>
            </div>
          ) : services.length > 0 ? (
            <div className="space-y-4">
              {services.map((service) => (
                <div key={service.id} className="bg-white border border-purple-200 rounded-lg p-4 sm:p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className="text-purple-600 mt-1">
                        {getServiceIcon(service.service_type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="text-base font-semibold text-gray-900">
                            {service.name}
                          </h4>
                          {service.is_mandatory && (
                            <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">
                              Required
                            </span>
                          )}
                          {service.requires_admin_approval && !service.admin_enabled && (
                            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                              Pending Approval
                            </span>
                          )}
                        </div>
                        
                        {service.description && (
                          <p className="text-sm text-gray-600 mb-3 break-words">
                            {service.description}
                          </p>
                        )}
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <span className="text-lg font-bold text-purple-900">
                              €{service.price}
                            </span>
                            
                            {service.payment_status === 'paid' && (
                              <span className="flex items-center text-sm text-green-600">
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Paid
                              </span>
                            )}
                            
                            {service.payment_status === 'pending' && (
                              <span className="flex items-center text-sm text-yellow-600">
                                <Clock className="w-4 h-4 mr-1" />
                                Processing
                              </span>
                            )}
                          </div>
                          
                          {/* Purchase Button */}
                          {service.payment_status !== 'paid' && (
                            <div className="flex-shrink-0">
                              {service.requires_admin_approval && !service.admin_enabled ? (
                                <button
                                  disabled
                                  className="px-4 py-2 bg-gray-300 text-gray-500 text-sm font-medium rounded-lg cursor-not-allowed"
                                >
                                  Awaiting Approval
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleServicePurchase(service.id)}
                                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
                                >
                                  {service.payment_status === 'pending' ? 'Complete Payment' : 'Pay Now'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {/* Service Time Effects */}
                        {service.service_type === 'early_checkin' && service.payment_status === 'paid' && (
                          <div className="mt-3 p-2 bg-green-100 border border-green-200 rounded-lg">
                            <p className="text-xs text-green-700">
                              ✓ Early check-in enabled - Access available {service.access_time_offset ? 
                                formatAccessTime(calculateEarlyTime(property.access_time, service.access_time_offset)) : 
                                'earlier'}
                            </p>
                          </div>
                        )}
                        
                        {service.service_type === 'late_checkout' && service.payment_status === 'paid' && (
                          <div className="mt-3 p-2 bg-green-100 border border-green-200 rounded-lg">
                            <p className="text-xs text-green-700">
                              ✓ Late checkout enabled - Departure extended {service.departure_time_offset ? 
                                formatAccessTime(calculateLateTime(property.departure_time, service.departure_time_offset)) : 
                                'later'}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white border border-purple-200 rounded-lg p-4 sm:p-6">
              <div className="text-center py-8">
                <div className="text-purple-600 mb-2">
                  <ShoppingBag className="w-8 h-8 mx-auto" />
                </div>
                <h4 className="text-base font-semibold text-purple-900 mb-2">
                  No Additional Services Available
                </h4>
                <p className="text-sm text-purple-700">
                  There are currently no additional services available for your reservation.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderPropertySection = () => (
    <div className="space-y-8">
      {/* Property Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Basic Property Info */}
        <div className="card">
          <div className="space-y-4">
               <div className="flex items-start gap-3">
                <Building className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-gray-600">Property</p>
                  <p className="font-medium break-words">{property.name}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Home className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-gray-600">Room</p>
                  <p className="font-medium break-words">{room.room_name}</p>
                </div>
              </div>
            </div>
        </div>

        {/* WiFi Information */}
        <div className="card">
          <div className="flex items-center mb-3">
            <Wifi className="w-4 h-4 sm:w-5 sm:h-5 text-primary-600 mr-2 flex-shrink-0" />
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">WiFi Information</h3>
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-sm text-gray-600">Network Name</p>
              <p className="font-mono text-sm sm:text-base font-medium break-all">{property.wifi_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Password</p>
              <p className="font-mono text-sm sm:text-base font-medium break-all">{property.wifi_password}</p>
            </div>
          </div>
        </div>

        {/* Emergency Contact */}
        {property.emergency_contact && (
          <div className="card">
            <div className="flex items-start gap-3 mb-3">
               <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-primary-600 flex-shrink-0" />
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Emergency Contact</h3>
            </div>
            <p className="font-medium break-words">{property.emergency_contact}</p>
          </div>
        )}

        {/* Check-in Instructions */}
        {property.check_in_instructions && (
          <div className="card">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Check-in Instructions</h2>
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 sm:p-4">
              <p className="text-sm sm:text-base text-primary-800 break-words">{property.check_in_instructions}</p>
            </div>
          </div>
        )}
      </div>

      {/* House Rules */}
      {property.house_rules && (
        <div className="card">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">House Rules</h2>
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 sm:p-4">
            <p className="text-sm sm:text-base text-gray-800 whitespace-pre-line break-words">{property.house_rules}</p>
          </div>
        </div>
      )}

      {/* Property Amenities */}
      {property.amenities && Object.keys(property.amenities).length > 0 && (
        <div className="card">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Property Amenities</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {Object.entries(property.amenities).map(([amenity, available]) => (
              available && (
                <div key={amenity} className="flex items-center p-2 bg-primary-50 rounded-lg">
                  <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-500 mr-2 flex-shrink-0" />
                  <span className="text-xs sm:text-sm text-gray-700 capitalize truncate">{amenity.replace('_', ' ')}</span>
                </div>
              )
            ))}
          </div>
        </div>
      )}

      {/* Local Recommendations */}
      {property.location_info && (
        <div className="card">
            <div className="flex items-center mb-4">
              <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-primary-600 mr-2 flex-shrink-0" />
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">Local Recommendations</h2>
            </div>
            
            {typeof property.location_info === 'object' ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {Object.entries(property.location_info).map(([category, items]) => (
                  <div key={category} className="space-y-3">
                    <div className="flex items-center mb-3">
                      {getRecommendationIcon(category)}
                      <h3 className="text-sm sm:text-base font-semibold text-gray-900 ml-2 capitalize">
                        {category.replace('_', ' ')}
                      </h3>
                    </div>
                    
                    {Array.isArray(items) ? (
                      <div className="space-y-2">
                        {items.map((item, index) => (
                          <div key={index} className="bg-primary-50 border border-primary-200 rounded-lg p-2 sm:p-3">
                            {typeof item === 'object' ? (
                              <div>
                                <p className="text-sm sm:text-base font-medium text-gray-900 break-words">{item.name}</p>
                                {item.description && (
                                  <p className="text-xs sm:text-sm text-gray-600 mt-1 break-words">{item.description}</p>
                                )}
                                {item.address && (
                                  <p className="text-xs text-gray-500 mt-1 break-words">{item.address}</p>
                                )}
                                {item.distance && (
                                  <p className="text-xs text-primary-600 mt-1">{item.distance}</p>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs sm:text-sm text-gray-700 break-words">{item}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-primary-50 border border-primary-200 rounded-lg p-2 sm:p-3">
                        <p className="text-xs sm:text-sm text-gray-700 break-words">{items}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 sm:p-4">
                <p className="text-sm sm:text-base text-primary-800 break-words">{property.location_info}</p>
              </div>
            )}
          </div>
        )}
    </div>
  )

  const renderDocumentsSection = () => (
    <div className="h-full">
      {/* Guest Message Panel */}
      <GuestMessagePanel 
        token={token} 
        guestName={reservation?.guest_name} 
      />
    </div>
  )

  const renderPaymentSection = () => {
    return (
      <div className="space-y-6">
        {/* Payment Section Header */}
        <div className="card">
          <div className="flex items-center mb-4">
            <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-primary-600 mr-3 flex-shrink-0" />
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Service Payments</h2>
              <p className="text-sm text-gray-600">Manage additional service payments for your stay</p>
            </div>
          </div>

          {/* Migration Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 sm:p-6">
            <div className="text-center py-8">
              <div className="text-blue-600 mb-2">
                <CreditCard className="w-8 h-8 mx-auto" />
              </div>
              <h4 className="text-base font-semibold text-blue-900 mb-2">
                Service Payments Moved
              </h4>
              <p className="text-sm text-blue-700">
                All service payments, including accommodation tax, have been moved to the "Additional Services" section in the Reservation tab for a better experience.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderProfileSection = () => {
    return (
      <div className="space-y-6">
        <GuestProfile 
          guestToken={token}
        />
      </div>
    )
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
      case 'overview':
        return renderOverviewSection()
      case 'reservation':
        return renderReservationSection()
      case 'property':
        return renderPropertySection()
      case 'payment':
        return renderPaymentSection()
      case 'documents':
        return renderDocumentsSection()
      case 'profile':
        return renderProfileSection()
      default:
        return renderOverviewSection()
    }
  }

  const navigationItems = [
    { id: 'reservation', label: 'Reservation', icon: Home },
    { id: 'documents', label: 'Contact', icon: MessageCircle },
    { id: 'profile', label: 'Profile', icon: UserCircle }
  ]

  return (
  <LayoutShell
    headerVariant="compact"
    token={token} 
    guestName={reservation?.guest_name}
    navigationItems={navigationItems}       
    activeSection={activeSection}          
    setActiveSection={setActiveSection}     
    checkinCompleted={!!checkinStatus?.completed}
    accessUnlocked={canAccessRoomDetails()} 
  >
    {/* Keep your current section render as-is */}
    {renderContent()}
  </LayoutShell>
)


}
