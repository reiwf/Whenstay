import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { initGuestLanguage } from '../i18n/config'
import { 
  MapPin, 
  Wifi, 
  Phone,
  Luggage, 
  Clock, 
  Users, 
  Key,
  Info,
  AlertCircle,
  CheckCircle,
  Home,
  KeyRound,
  MessageCircle,
  PlaneLanding,
  PlaneTakeoff,
  Building,
  Utensils,
  Car,
  MapPinned,
  ShoppingBag,
  Coffee,
  Unlock,
  FileText,
  ArrowLeft,
  CreditCard,
  UserCircle,
  TrainFront,
  Eye,
  EyeOff
} from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import GuestMessagePanel from '../components/communication/GuestMessagePanel'
import JourneyRoadmap from '../components/guest/JourneyRoadmap'
import GuestProfile from '../components/guest/GuestProfile'
import CheckinModal from '../components/guest/CheckinModal'
import LayoutShell from '../components/layout/LayoutShell'
import Section from '../components/ui/Section'
import { ListGroup, ListRow, PlainGroup  } from '../components/ui/ListGroup'
import TaxDescription from '../components/payment/TaxDescription'
import LongTextRow from '@/components/ui/LongTextRow'
import { usePropertyTranslations } from '../hooks/usePropertyTranslations'
import useRoomTypeTranslations from '../hooks/useRoomTypeTranslations'
import Markdown from '@/components/ui/Markdown'

export default function GuestApp() {
  const { token } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { t, i18n } = useTranslation('guest')
  const [loading, setLoading] = useState(true)
  const [dashboardData, setDashboardData] = useState(null)
  const [checkinStatus, setCheckinStatus] = useState(null)
  const [activeSection, setActiveSection] = useState('reservation')
  const [accessCodeRevealed, setAccessCodeRevealed] = useState(false)
  const [paymentRefreshTrigger, setPaymentRefreshTrigger] = useState(0)
  const [services, setServices] = useState([])
  const [servicesLoading, setServicesLoading] = useState(false)
  const [checkinModalOpen, setCheckinModalOpen] = useState(false)

  // Use property translations hook - must be called at the top level
  // Pass the guest token and enable guest mode for translation access
  const { translatedContent, getTranslatedText, translations, loading: translationsLoading, error: translationsError } = usePropertyTranslations(token, true)

  // Use room type translations hook with guest token
  const { 
    getCachedTranslation: getRoomTypeTranslation, 
    loadRoomTypeTranslations,
    loading: roomTypeTranslationsLoading 
  } = useRoomTypeTranslations(token, true)

  // Debug logging for translations
  useEffect(() => {
    if (dashboardData?.property?.id) {

      // Test the getTranslatedText function
      const checkInInstructions = getTranslatedText('check_in_instructions', dashboardData.property.check_in_instructions)
    }
  }, [dashboardData, translations, i18n.language, translatedContent, getTranslatedText, translationsLoading, translationsError])

  // Load room type translations when dashboard data is available
  useEffect(() => {
    if (dashboardData?.room?.room_type_id && i18n.language) {
      loadRoomTypeTranslations(dashboardData.room.room_type_id, i18n.language)
    }
  }, [dashboardData?.room?.room_type_id, i18n.language, loadRoomTypeTranslations])

  // Function to get translated room type name
  const getTranslatedRoomTypeName = (room) => {
    if (!room?.room_type_id || !room?.room_name) {
      return room?.room_name || '-'
    }

    // Try to get translated name
    const translatedName = getRoomTypeTranslation(room.room_type_id, i18n.language, 'name')
    
    // Return translated name if available, otherwise fallback to original
    return translatedName || room.room_name
  }
  
  useEffect(() => {
    if (token) {
      loadGuestData()
    }
  }, [token])

  // Handle success message from check-in completion
  useEffect(() => {
    if (location.state?.justCompleted) {
      const message = location.state.message || t('checkinModal.checkinCompletedSuccessfully')
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
        toast.success(t('guestApp.paymentCompleted'), {
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
        toast.error(t('guestApp.paymentCanceled'), {
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
      
      setDashboardData(data)

      // Initialize guest language based on phone number
      if (data.reservation?.booking_phone) {
        try {
          initGuestLanguage(data.reservation.booking_phone, token)
        } catch (error) {
          console.error('Error initializing guest language:', error)
        }
      }
      
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
      toast.error(t('guestApp.failedToLoadReservation'))
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
        toast.error(errorData.message || t('additionalStrings.failedToInitiatePayment'))
      }
    } catch (error) {
      console.error('Error purchasing service:', error)
      toast.error(t('additionalStrings.failedToInitiatePayment'))
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
    toast.success(t('contactFeature.comingSoon'))
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
        toast.success(t('guestApp.accessCodeRevealed'))
      } else {
        toast.error(t('guestApp.failedToRevealAccessCode'))
      }
    } catch (error) {
      console.error('Error revealing access code:', error)
      toast.error(t('guestApp.failedToRevealAccessCode'))
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

  // Modal handlers
  const handleOpenCheckinModal = () => {
    setCheckinModalOpen(true)
  }

  const handleCloseCheckinModal = () => {
    setCheckinModalOpen(false)
  }

  const handleCheckinComplete = async () => {
    // Refresh guest data to update check-in status
    await loadGuestData()
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
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">{t('guestApp.reservationNotFound')}</h1>
          <p className="text-gray-600">{t('guestApp.reservationNotFoundDesc')}</p>
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
          onStartCheckin={handleOpenCheckinModal}
        />

        {/* Time-based Room Access Section */}
        {canAccessRoomDetails() && (
          <div className="card border-primary-200">
            <div className="flex items-center mb-4">
              <Unlock className="w-5 h-5 sm:w-6 sm:h-6 text-primary-600 mr-2 flex-shrink-0" />
              <h2 className="text-base sm:text-lg font-semibold text-primary-900 flex-1 min-w-0">{t('guestApp.roomAccessDetails')}</h2>
              <span className="ml-auto text-xs sm:text-sm text-primary-50 bg-primary-500 px-2 py-1 rounded-full flex-shrink-0">
                {t('guestApp.availableNow')}
              </span>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-4">
                <div className="bg-primary-100 border border-primary-300 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-primary-800">{t('guestApp.roomAccessCode')}</span>
                    <Key className="w-4 h-4 text-primary-600" />
                  </div>
                  
                  {/* Show button to reveal code if access_read is false, otherwise show the code */}
                  {!checkinStatus?.access_read && !accessCodeRevealed ? (
                    <div className="text-center py-4">
                      <button
                        onClick={handleRevealAccessCode}
                        className="bg-primary-600 hover:bg-primary-700 text-white font-medium px-6 py-3 rounded-lg transition-colors"
                      >
                        {t('guestApp.getCode')}
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
                      <p className="text-sm text-primary-700">{t('additionalStrings.roomNumber')}</p>
                      <p className="font-medium text-primary-900">{room.unit_number}</p>
                    </div>
                  </div>
                )}
                
                {room.floor_number && (
                  <div className="flex items-center">
                    <Building className="w-5 h-5 text-primary-600 mr-3" />
                    <div>
                      <p className="text-sm text-primary-700">{t('additionalStrings.floor')}</p>
                      <p className="font-medium text-primary-900">{t('additionalStrings.floorWithNumber', { number: room.floor_number })}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {room.access_instructions && (
                  <div>
                    <h3 className="text-sm font-medium text-primary-900 mb-2">{t('additionalStrings.accessInstructions')}</h3>
                    <div className="bg-white border border-primary-200 rounded-lg p-3">
                      <p className="text-sm text-primary-800 whitespace-pre-line">{room.access_instructions}</p>
                    </div>
                  </div>
                )}
                
                {property.emergency_contact && (
                  <div>
                    <h3 className="text-sm font-medium text-primary-900 mb-2">{t('additionalStrings.emergencyContact')}</h3>
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
      mandatoryServices.every(service => service.payment_status === 'paid' || service.payment_status === 'exempted' )
    
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
          onStartCheckin={handleOpenCheckinModal}
        />



       {/* PUBLIC INFO (blended) */}
        <Section title={t('guestApp.apartmentInfo')}>
          {/* Reservation basics */}
          <ListGroup inset className="mb-3">
            <ListRow
              left={<div className="flex items-center gap-2"><PlaneLanding className="w-4 h-4 text-slate-500" /> {t('guestApp.checkIn')}</div>}
              right={
                <div className="text-right">
                  <div className="font-medium">
                    {checkInDate.toLocaleDateString(i18n.language, { year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                  <div className="text-xs text-slate-500">{t('guestApp.checkInFrom', { time: formatAccessTime(property.access_time) })}</div>
                </div>
              }
            />
            <ListRow
              left={<div className="flex items-center gap-2"><PlaneTakeoff className="w-4 h-4 text-slate-500" /> {t('guestApp.checkOut')}</div>}
              right={
                <div className="text-right">
                  <div className="font-medium">
                    {checkOutDate.toLocaleDateString(i18n.language, { year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                  <div className="text-xs text-slate-500">{t('guestApp.checkoutBefore', { time: formatAccessTime(property.departure_time) })}</div>
                </div>
              }
            />
            <ListRow
              left={<div className="flex items-center gap-2"><Clock className="w-4 h-4 text-slate-500" /> {t('guestApp.duration')}</div>}
              right={<span className="font-medium">{nights} {nights === 1 ? t('guestApp.night') : t('guestApp.nights')}</span>}
            />
            <ListRow
              left={<div className="flex items-center gap-2"><Users className="w-4 h-4 text-slate-500" /> {t('guestApp.guests')}</div>}
              right={<span className="font-medium">{reservation.num_guests} {reservation.num_guests === 1 ? t('guestApp.guest') : t('guestApp.guests')}</span>}
            />            
          </ListGroup>

          {/* Property Details */}
          <ListGroup inset className="mb-3">
            <ListRow
              left={<div className="flex items-center gap-2"><Building className="w-4 h-4 text-slate-500" /> {t('guestApp.property')}</div>}
              right={property?.name || '-'}
              rightTitle={property?.name}
              rightLines={2}
              rightClass="font-medium"
          />
           {(getTranslatedText('description', property.address) || property.address) && (
            <ListRow
              left={<div className="flex items-center gap-2"><MapPinned className="w-4 h-4 text-slate-500" /> {t('guestApp.address')}</div>}
              right={
                  <div className="text-right">
                    <div className="font-medium">
                      {getTranslatedText('address', property.address)}
                    </div>
                    {/* <div className="text-xs text-slate-500">{getTranslatedText('address', property.address)}</div> */}
                  </div>
                }
              rightLines={3}
            />
            )}
            
            <ListRow
              left={<div className="flex items-center gap-2"><Home className="w-4 h-4 text-slate-500" /> {t('guestApp.room')}</div>}
              right={getTranslatedRoomTypeName(room)}
              rightTitle={getTranslatedRoomTypeName(room)}
              rightLines={1}
              rightClass="font-medium"
          />
          
            {(getTranslatedText('description', property.description) || property.description) && (
                <LongTextRow
                  dialog="center"
                  icon={<TrainFront className="w-4 h-4 text-slate-500" />}
                  label={t('additionalStrings.description')}
                  text={getTranslatedText('description', property.description)}
                  lines={2}
                  title={t('additionalStrings.description')}
                  showPreview={false} 
                  renderRich={(txt) => (
                    <Markdown>{String(txt || '')}</Markdown>
                  )}
                />
              )}
             {(getTranslatedText('check_in_instructions', property.check_in_instructions) || property.check_in_instructions) && (
              <LongTextRow
                dialog="center"
                icon={<KeyRound className="w-4 h-4 text-slate-500" />}
                label={t('additionalStrings.selfCheckIn')}
                text={getTranslatedText('check_in_instructions', property.check_in_instructions)}
                lines={2}
                title={t('additionalStrings.selfCheckIn')}
                showPreview={false} 
                renderRich={(txt) => (
                  <Markdown>{String(txt || '')}</Markdown>
                )}
              />
            )}
            {(getTranslatedText('luggage_info', property.luggage_info) || property.luggage_info) && (
              <LongTextRow
                dialog="center"
                icon={<Luggage className="w-4 h-4 text-slate-500" />}
                label={t('additionalStrings.luggageInfo')}
                text={getTranslatedText('luggage_info', property.luggage_info)}
                lines={2}
                title={t('additionalStrings.luggageInfo')}
                showPreview={false} 
                renderRich={(txt) => (
                    <Markdown>{String(txt || '')}</Markdown>
                  )}
              />
            )}
            {(getTranslatedText('house_rules', property.house_rules) || property.house_rules) && (
              <LongTextRow
                dialog="center"
                icon={<FileText className="w-4 h-4 text-slate-500" />}
                label={t('additionalStrings.houseRulesPolicy')}
                text={getTranslatedText('house_rules', property.house_rules)}
                lines={2}
                title={t('additionalStrings.houseRulesPolicy')}
                showPreview={false} 
                renderRich={(txt) => (
                    <Markdown>{String(txt || '')}</Markdown>
                  )}
              />
            )}
          </ListGroup>
        </Section>


        {/* Stay information (blended) */}
          <Section
            title={t('guestApp.stayInformation')}
            subtitle={canAccessStayInfo() ? t('guestApp.stayInfoSubtitle') : t('guestApp.stayInfoRestricted')}
          >
            {canAccessStayInfo() ? (
              <>
                {/* Access group */}
                <ListGroup inset className="mb-3">
                  <ListRow
                    left={<div className="flex items-center gap-2"><Key className="w-4 h-4 text-slate-500" /> {t('guestApp.roomAccess')}</div>}
                    right={
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setAccessCodeRevealed(!accessCodeRevealed)}
                          className="text-slate-700 hover:text-slate-900"
                          aria-label={accessCodeRevealed ? t('additionalStrings.hideCode') : t('additionalStrings.revealCode')}
                        >
                          {accessCodeRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    }
                  />
                  <div className="px-4 py-3">
                    {!checkinStatus?.access_read && !accessCodeRevealed ? (
                      <button
                        onClick={handleRevealAccessCode}
                        className="w-full rounded-xl bg-slate-900 text-white py-2.5 text-sm font-medium active:opacity-90"
                      >
                        {t('guestApp.revealCode')}
                      </button>
                    ) : (
                      <div className="font-mono text-2xl font-semibold tracking-wider text-slate-900">
                        {accessCodeRevealed ? room.access_code : '••••••'}
                      </div>
                    )}
                  </div>

                  {(room.unit_number || room.floor_number) && <div className="hairline" />}

                  {room.unit_number && (
                    <ListRow
                      left={<div className="flex items-center gap-2"><Home className="w-4 h-4 text-slate-500" /> {t('additionalStrings.roomNumberLower')}</div>}
                      right={<span className="font-medium">{room.unit_number}</span>}
                    />
                  )}
                  {room.floor_number && (
                    <ListRow
                      left={<div className="flex items-center gap-2"><Building className="w-4 h-4 text-slate-500" /> {t('additionalStrings.floorLower')}</div>}
                      right={<span className="font-medium">{t('additionalStrings.floorWithNumber', { number: room.floor_number })}</span>}
                    />
                  )}
                </ListGroup>

                {/* Wi-Fi group */}
                <ListGroup inset className="mb-3">
                  <ListRow
                    left={<div className="flex items-center gap-2"><Wifi className="w-4 h-4 text-slate-500" /> {t('additionalStrings.network')}</div>}
                    right={<code className="text-xs">{property.wifi_name || '-'}</code>}
                  />
                  <ListRow
                    left={<span className="pl-6">{t('additionalStrings.password')}</span>}
                    right={<code className="text-xs">{property.wifi_password || '-'}</code>}
                  />
                </ListGroup>

                {/* Manuals / during stay */}
                {!!property.house_manual && (
                  <div className="mt-2">
                    <h4 className="text-sm font-semibold text-slate-900 mb-1">{t('additionalStrings.houseManual')}</h4>
                    <p className="text-sm text-slate-700 whitespace-pre-line">{property.house_manual}</p>
                  </div>
                )}

                <div className="mt-3">
                  <h4 className="text-sm font-semibold text-slate-900 mb-1">{t('additionalStrings.duringYourStay')}</h4>
                  {!!property.emergency_contact && (
                    <p className="text-sm text-slate-700 mb-2"><Phone className="inline w-4 h-4 mr-1 text-slate-500" /> {property.emergency_contact}</p>
                  )}
                  {property.amenities && Object.keys(property.amenities).length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.entries(property.amenities).map(([amenity, ok]) => ok && (
                        <div key={amenity} className="flex items-center px-3 py-2 rounded-xl bg-slate-100">
                          <CheckCircle className="w-3 h-3 text-emerald-500 mr-2" />
                          <span className="text-xs text-slate-700 truncate">{amenity.replace('_',' ')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>                
              </>
            ) : (
              // Restricted message (blended)
              <ListGroup inset>
                <div className="px-4 py-5 text-center">
                  <AlertCircle className="w-7 h-7 text-red-500 mx-auto mb-2" />
                  <h4 className="text-sm font-semibold text-slate-900 mb-1">{t('additionalStrings.stayInfoNotAvailable')}</h4>
                  <div className="text-xs text-slate-600 space-y-1">
                    {!checkinStatus?.completed && <p>{t('additionalStrings.completeCheckinProcess')}</p>}
                    {services.filter(s => s.is_mandatory && s.payment_status !== 'paid').length > 0 && (
                      <p>{t('additionalStrings.payServices', { services: services.filter(s => s.is_mandatory && s.payment_status !== 'paid').map(s => s.name).join(', ') })}</p>
                    )}
                    {!canAccessRoomDetails() && checkinStatus?.completed && (
                      <p>{t('additionalStrings.waitUntilTime', { time: formatAccessTime(property.access_time), date: checkInDate.toLocaleDateString() })}</p>
                    )}
                  </div>
                </div>
              </ListGroup>
            )}
          </Section>

        <Section title={t('guestApp.addOns')}>
          {servicesLoading ? (
            <ListGroup inset>
              <div className="px-4 py-8 flex items-center justify-center">
                <LoadingSpinner />
                <span className="ml-2 text-sm text-slate-600">{t('additionalStrings.loadingServices')}</span>
              </div>
            </ListGroup>
          ) : services.length > 0 ? (
            <ListGroup inset>
              {services.map((s, i) => (
                <div key={s.id} className={i ? '' : ''}>
                  <div className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="text-slate-600 mt-0.5">{getServiceIcon(s.service_type)}</div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-semibold text-slate-900 truncate">{s.name}</h4>
                            {s.is_mandatory && (
                              <span className="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded-full">{t('additionalStrings.required')}</span>
                            )}
                            {s.requires_admin_approval && !s.admin_enabled && (
                              <span className="text-[10px] bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">{t('additionalStrings.pending')}</span>
                            )}
                          </div>
                          {s.service_type === 'accommodation_tax'
                            ? <TaxDescription desc={s.description} />
                            : (s.description && (
                                <p className="text-sm text-slate-600 mt-1 break-words leading-6 whitespace-pre-wrap">
                                  {s.description}
                                </p>
                              ))
                          }
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-sm font-semibold text-slate-900">¥{s.price}</div>
                        {s.payment_status === 'paid' && (
                          <div className="mt-1 text-xs text-emerald-600 flex items-center justify-end">
                            <CheckCircle className="w-3.5 h-3.5 mr-1" /> {t('additionalStrings.paid')}
                          </div>
                        )}
                        {s.payment_status === 'pending' && (
                          <div className="mt-1 text-xs text-amber-600 flex items-center justify-end">
                            <Clock className="w-3.5 h-3.5 mr-1" /> {t('additionalStrings.processing')}
                          </div>
                        )}
                        
                      </div>
                    </div>

                    {s.payment_status !== 'paid' && s.payment_status !== 'exempted' && (
                      <div className="mt-3">
                        {s.requires_admin_approval && !s.admin_enabled ? (
                          <button disabled className="w-full rounded-xl bg-slate-200 text-slate-500 py-2 text-sm cursor-not-allowed">
                            {t('additionalStrings.awaitingApproval')}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleServicePurchase(s.id)}
                            className="w-full rounded-xl bg-slate-900 text-white py-2 text-sm active:opacity-90"
                          >
                            {s.payment_status === 'pending' ? t('additionalStrings.completePayment') : t('additionalStrings.payNow')}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Effects */}
                    {s.service_type === 'early_checkin' && s.payment_status === 'paid' && (
                      <p className="mt-3 text-[11px] text-emerald-700">
                        {t('guestApp.earlyCheckInEnabled', {
                          time: s.access_time_offset
                            ? formatAccessTime(calculateEarlyTime(property.access_time, s.access_time_offset))
                            : t('timeAndDate.earlier')
                        })}
                      </p>
                    )}
                    {s.service_type === 'late_checkout' && s.payment_status === 'paid' && (
                      <p className="mt-3 text-[11px] text-emerald-700">
                        {t('guestApp.lateCheckoutEnabled', {
                          time: s.departure_time_offset
                            ? formatAccessTime(calculateLateTime(property.departure_time, s.departure_time_offset))
                            : t('timeAndDate.later')
                        })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </ListGroup>
          ) : (
            <ListGroup inset>
              <div className="px-4 py-8 text-center">
                <ShoppingBag className="w-7 h-7 text-slate-500 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-slate-900 mb-1">{t('additionalStrings.noAdditionalServices')}</h4>
                <p className="text-xs text-slate-600">{t('additionalStrings.thereAreCurrentlyNoAddOns')}</p>
              </div>
            </ListGroup>
          )}
        </Section>

      </div>
    )
  }


  const renderChatSection = () => (
    <div className="h-full">
      {/* Guest Message Panel */}
      <GuestMessagePanel 
        token={token} 
        guestName={reservation?.guest_name} 
      />
    </div>
  )

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
      case 'reservation':
        return renderReservationSection()
      case 'chat':
        return renderChatSection()
      case 'profile':
        return renderProfileSection()
    }
  }

  const navigationItems = [
    { id: 'reservation', label: t('navigation.reservation'), icon: Home },
    { id: 'chat', label: t('navigation.chat'), icon: MessageCircle },
    { id: 'profile', label: t('navigation.profile'), icon: UserCircle }
  ]

  return (
    <>
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

      {/* Check-in Modal */}
      <CheckinModal
        isOpen={checkinModalOpen}
        onClose={handleCloseCheckinModal}
        token={token}
        onCheckInComplete={handleCheckinComplete}
      />
    </>
  )


}
