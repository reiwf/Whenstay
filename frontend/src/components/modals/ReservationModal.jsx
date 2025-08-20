import { useState, useEffect } from 'react'
import { 
  Copy, 
  ExternalLink,
  Check,
  MessageSquare,
  Building2,
  User,
  UserCheck,
  Phone,
  Settings,
  Shield
} from 'lucide-react'
import toast from 'react-hot-toast'
import LoadingSpinner from '../LoadingSpinner'
import ScheduledMessagesPanel from '../communication/ScheduledMessagesPanel'
import { adminAPI } from '../../services/api'
import {
  BookingInfoSection,
  GuestInfoSection,
  CheckinDetailsSection,
  EmergencyContactSection,
  SystemInfoSection,
  AdminSection
} from './reservation'

export default function ReservationModal({ reservation, properties, onSave, onClose }) {
  const [formData, setFormData] = useState({
    // Basic booking information - maps directly to database columns
    beds24BookingId: '',
    bookingFirstname: '', // Changed from bookingName - DB trigger will build booking_name
    bookingEmail: '',
    bookingPhone: '',
    bookingLastname: '',
    
    // Booking details
    checkInDate: '',
    checkOutDate: '',
    numGuests: 1,
    numAdults: 1,
    numChildren: 0,
    totalAmount: '',
    price: '',
    commission: '',
    status: 'pending',
    specialRequests: '',
    bookingSource: '',
    comments: '',
    
    // Beds24 webhook specific fields
    apiReference: '',
    rateDescription: '',
    apiMessage: '',
    bookingTime: '',
    timeStamp: '',
    lang: '',
    
    // Room assignment (V5 structure)
    propertyId: '',
    roomTypeId: '',
    roomUnitId: '',
    
    // Guest personal information (from check-in process)
    guestFirstname: '',
    guestLastname: '',
    guestMail: '', 
    guestContact: '',
    guestAddress: '',
    
    // Check-in specific information
    estimatedCheckinTime: '',
    travelPurpose: '',
    passportUrl: '',
    
    // Emergency contact
    emergencyContactName: '',
    emergencyContactPhone: '',
    
    // Administrative fields
    agreementAccepted: false,
    adminVerified: false,
    accessRead: false
  })

  // Update formData when reservation changes (proper data fetching from database)
  useEffect(() => {
    if (reservation) {
      setFormData({
        // Basic booking information - maps directly to database columns
        beds24BookingId: reservation.beds24_booking_id || '',
        bookingFirstname: reservation.booking_firstname || '', // Changed from booking_name
        bookingEmail: reservation.booking_email || '',
        bookingPhone: reservation.booking_phone || '',
        bookingLastname: reservation.booking_lastname || '',
        
        // Booking details
        checkInDate: reservation.check_in_date || '',
        checkOutDate: reservation.check_out_date || '',
        numGuests: reservation.num_guests || 1,
        numAdults: reservation.num_adults || 1,
        numChildren: reservation.num_children || 0,
        totalAmount: reservation.total_amount || '',
        price: reservation.price || '',
        commission: reservation.commission || '',
        status: reservation.status || 'pending',
        specialRequests: reservation.special_requests || '',
        bookingSource: reservation.booking_source || '',
        comments: reservation.comments || '',
        
        // Beds24 webhook specific fields
        apiReference: reservation.apiReference || '',
        rateDescription: reservation.rateDescription || '',
        apiMessage: reservation.apiMessage || '',
        bookingTime: reservation.bookingTime || '',
        timeStamp: reservation.timeStamp || '',
        lang: reservation.lang || '',
        
        // Room assignment (V5 structure)
        propertyId: reservation.property_id || '',
        roomTypeId: reservation.room_type_id || '',
        roomUnitId: reservation.room_unit_id || '',
        
        // Guest personal information (from check-in process)
        guestFirstname: reservation.guest_firstname || '',
        guestLastname: reservation.guest_lastname || '',
        guestMail: reservation.guest_mail || '', 
        guestContact: reservation.guest_contact || '',
        guestAddress: reservation.guest_address || '',
        
        // Check-in specific information
        estimatedCheckinTime: reservation.estimated_checkin_time || '',
        travelPurpose: reservation.travel_purpose || '',
        passportUrl: reservation.passport_url || '',
        
        // Emergency contact
        emergencyContactName: reservation.emergency_contact_name || '',
        emergencyContactPhone: reservation.emergency_contact_phone || '',
        
        // Administrative fields
        agreementAccepted: reservation.agreement_accepted || false,
        adminVerified: reservation.admin_verified || false,
        accessRead: reservation.access_read || false
      })
    } else {
      // Reset form for new reservation
      setFormData({
        beds24BookingId: '',
        bookingFirstname: '', // Changed from bookingName
        bookingEmail: '',
        bookingPhone: '',
        bookingLastname: '',
        checkInDate: '',
        checkOutDate: '',
        numGuests: 1,
        numAdults: 1,
        numChildren: 0,
        totalAmount: '',
        price: '',
        commission: '',
        status: 'pending',
        specialRequests: '',
        bookingSource: '',
        comments: '',
        apiReference: '',
        rateDescription: '',
        apiMessage: '',
        bookingTime: '',
        timeStamp: '',
        lang: '',
        propertyId: '',
        roomTypeId: '',
        roomUnitId: '',
        guestFirstname: '',
        guestLastname: '',
        guestMail: '',
        guestContact: '',
        guestAddress: '',
        estimatedCheckinTime: '',
        travelPurpose: '',
        passportUrl: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
        agreementAccepted: false,
        adminVerified: false,
        accessRead: false
      })
    }
  }, [reservation])
  
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [errors, setErrors] = useState({})
  const [activeTab, setActiveTab] = useState('booking')

  // Define tabs with icons and labels
  const tabs = [
    { id: 'booking', label: 'Booking Info', icon: Building2 },
    { id: 'guest', label: 'Guest Info', icon: User },
    { id: 'checkin', label: 'Check-in Details', icon: UserCheck },
    { id: 'emergency', label: 'Emergency Contact', icon: Phone },
    { id: 'system', label: 'System Info', icon: Settings },
    { id: 'admin', label: 'Admin', icon: Shield },
    ...(reservation ? [{ id: 'scheduled', label: 'Scheduled Messages', icon: MessageSquare }] : [])
  ]

  // Available status options based on database enum
  const statusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'checked_in', label: 'Checked In' },
    { value: 'checked_out', label: 'Checked Out' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'completed', label: 'Completed' },
    { value: 'no_show', label: 'No Show' }
  ]

  const validateForm = () => {
    const newErrors = {}

    // Required fields based on database schema
    if (!formData.beds24BookingId.trim()) {
      newErrors.beds24BookingId = 'Beds24 Booking ID is required'
    }
    if (!formData.bookingFirstname.trim()) {
      newErrors.bookingFirstname = 'Booking first name is required'
    }
    if (formData.bookingEmail && !/\S+@\S+\.\S+/.test(formData.bookingEmail)) {
      newErrors.bookingEmail = 'Please enter a valid email address'
    }
    if (!formData.checkInDate) {
      newErrors.checkInDate = 'Check-in date is required'
    }
    if (!formData.checkOutDate) {
      newErrors.checkOutDate = 'Check-out date is required'
    }
    
    // Room assignment validation (V5 structure)
    if (!formData.propertyId) {
      newErrors.propertyId = 'Property selection is required'
    }
    if (!formData.roomTypeId) {
      newErrors.roomTypeId = 'Room type selection is required'
    }
    if (!formData.roomUnitId) {
      newErrors.roomUnitId = 'Room unit selection is required'
    }

    // Date validation
    if (formData.checkInDate && formData.checkOutDate) {
      const checkIn = new Date(formData.checkInDate)
      const checkOut = new Date(formData.checkOutDate)
      
      if (checkOut <= checkIn) {
        newErrors.checkOutDate = 'Check-out date must be after check-in date'
      }
    }

    // Guest count validation
    if (formData.numGuests < 1) {
      newErrors.numGuests = 'At least 1 guest is required'
    }
    if (formData.numAdults < 1) {
      newErrors.numAdults = 'At least 1 adult is required'
    }
    if (formData.numAdults + formData.numChildren !== formData.numGuests) {
      newErrors.numGuests = 'Total guests must equal adults + children'
    }

    // Amount validation
    if (formData.totalAmount && isNaN(parseFloat(formData.totalAmount))) {
      newErrors.totalAmount = 'Please enter a valid amount'
    }
    if (formData.price && isNaN(parseFloat(formData.price))) {
      newErrors.price = 'Please enter a valid price'
    }
    if (formData.commission && isNaN(parseFloat(formData.commission))) {
      newErrors.commission = 'Please enter a valid commission'
    }

    // Email validation for guest personal email
    if (formData.guestMail && !/\S+@\S+\.\S+/.test(formData.guestMail)) {
      newErrors.guestMail = 'Please enter a valid email address'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      toast.error('Please fix the errors before saving')
      return
    }

    setLoading(true)
    
    try {
      // Map form data to database fields exactly
      const submitData = {
        // Core booking information
        beds24BookingId: formData.beds24BookingId,
        bookingFirstname: formData.bookingFirstname, // Changed from bookingName - trigger will build booking_name
        bookingEmail: formData.bookingEmail,
        bookingPhone: formData.bookingPhone || null,
        bookingLastname: formData.bookingLastname || null,
        
        // Booking details
        checkInDate: formData.checkInDate,
        checkOutDate: formData.checkOutDate,
        numGuests: parseInt(formData.numGuests),
        numAdults: parseInt(formData.numAdults),
        numChildren: parseInt(formData.numChildren),
        totalAmount: formData.totalAmount ? parseFloat(formData.totalAmount) : null,
        price: formData.price ? parseFloat(formData.price) : null,
        commission: formData.commission ? parseFloat(formData.commission) : null,
        status: formData.status,
        specialRequests: formData.specialRequests || null,
        bookingSource: formData.bookingSource || null,
        comments: formData.comments || null,
        
        // Beds24 webhook fields
        apiReference: formData.apiReference || null,
        rateDescription: formData.rateDescription || null,
        apiMessage: formData.apiMessage || null,
        bookingTime: formData.bookingTime || null,
        timeStamp: formData.timeStamp || null,
        lang: formData.lang || null,
        
        // V5 Room assignment
        propertyId: formData.propertyId || null,
        roomTypeId: formData.roomTypeId || null,
        roomUnitId: formData.roomUnitId || null,
        
        // Guest personal information
        guestFirstname: formData.guestFirstname || null,
        guestLastname: formData.guestLastname || null,
        guestMail: formData.guestMail || null, // Fixed field name
        guestContact: formData.guestContact || null,
        guestAddress: formData.guestAddress || null,
        
        // Check-in information
        estimatedCheckinTime: formData.estimatedCheckinTime || null,
        travelPurpose: formData.travelPurpose || null,
        passportUrl: formData.passportUrl || null,
        
        // Emergency contact
        emergencyContactName: formData.emergencyContactName || null,
        emergencyContactPhone: formData.emergencyContactPhone || null,
        
        // Administrative
        agreementAccepted: formData.agreementAccepted,
        adminVerified: formData.adminVerified,
        accessRead: formData.accessRead
      }

      await onSave(submitData, reservation?.id)
    } catch (error) {
      console.error('Error saving reservation:', error)
      toast.error('Failed to save reservation')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyCheckinUrl = async () => {
    if (!reservation?.check_in_token) return
    
    const checkinUrl = `${window.location.origin}/checkin/${reservation.check_in_token}`
    
    try {
      await navigator.clipboard.writeText(checkinUrl)
      setCopied(true)
      toast.success('Check-in URL copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy URL:', error)
      toast.error('Failed to copy URL')
    }
  }

  const openCheckinPage = () => {
    if (!reservation?.check_in_token) return
    const checkinUrl = `/checkin/${reservation.check_in_token}`
    window.open(checkinUrl, '_blank')
  }

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'confirmed': return 'bg-blue-100 text-blue-800'
      case 'checked_in': return 'bg-green-100 text-green-800'
      case 'checked_out': return 'bg-purple-100 text-purple-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      case 'no_show': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const hasCheckinData = reservation?.checkin_submitted_at || 
    reservation?.guest_firstname || 
    reservation?.guest_lastname || 
    reservation?.guest_mail ||
    reservation?.passport_url ||
    reservation?.guest_address

  // Render tab content based on activeTab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'booking':
        return (
          <BookingInfoSection
            formData={formData}
            setFormData={setFormData}
            errors={errors}
            properties={properties}
            statusOptions={statusOptions}
            reservation={reservation}
          />
        )
      case 'guest':
        return (
          <GuestInfoSection
            formData={formData}
            setFormData={setFormData}
            errors={errors}
            hasCheckinData={hasCheckinData}
          />
        )
      case 'checkin':
        return (
          <CheckinDetailsSection
            formData={formData}
            setFormData={setFormData}
            reservation={reservation}
          />
        )
      case 'emergency':
        return (
          <EmergencyContactSection
            formData={formData}
            setFormData={setFormData}
          />
        )
      case 'system':
        return (
          <SystemInfoSection
            formData={formData}
            setFormData={setFormData}
          />
        )
      case 'admin':
        return (
          <AdminSection
            formData={formData}
            setFormData={setFormData}
            reservation={reservation}
            copied={copied}
            handleCopyCheckinUrl={handleCopyCheckinUrl}
          />
        )
      case 'scheduled':
        return reservation ? (
          <div className="bg-white p-6 rounded-lg">
            <ScheduledMessagesPanel
              reservationId={reservation.id}
              onTriggerAutomation={handleTriggerAutomation}
              onCancelMessages={handleCancelMessages}
            />
          </div>
        ) : null
      default:
        return null
    }
  }

  // Automation handlers
  const handleTriggerAutomation = async (reservationId) => {
    if (!reservationId) return;
    
    try {
      const response = await adminAPI.triggerAutomationForReservation(reservationId, false);
      console.log('Automation triggered:', response.data);
      
      // Return success to trigger refresh in ScheduledMessagesPanel
      return Promise.resolve();
    } catch (error) {
      console.error('Error triggering automation:', error);
      throw error;
    }
  };

  const handleCancelMessages = async (reservationId) => {
    if (!reservationId) return;
    
    try {
      const response = await adminAPI.cancelScheduledMessagesForReservation(reservationId, 'Manual cancellation via reservation modal');
      console.log('Messages cancelled:', response.data);
      
      // Return success to trigger refresh in ScheduledMessagesPanel
      return Promise.resolve();
    } catch (error) {
      console.error('Error cancelling messages:', error);
      throw error;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {reservation ? 'Edit Reservation' : 'Create Reservation'}
              </h3>
              {reservation && (
                <div className="flex items-center space-x-4 mt-2">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(reservation.status)}`}>
                    {reservation.status}
                  </span>
                  <span className="text-sm text-gray-500">
                    ID: {reservation.id?.slice(0, 8)}...
                  </span>
                  {reservation.checkin_submitted_at && (
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                      Check-in Submitted
                    </span>
                  )}
                  {reservation.admin_verified && (
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      Admin Verified
                    </span>
                  )}
                </div>
              )}
            </div>
            
            {/* Check-in Token Actions */}
            {reservation?.check_in_token && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCopyCheckinUrl}
                  className="flex items-center px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                  title="Copy check-in URL"
                >
                  {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                  {copied ? 'Copied!' : 'Copy URL'}
                </button>
                <button
                  onClick={openCheckinPage}
                  className="flex items-center px-3 py-2 text-sm bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors"
                  title="Open check-in page"
                >
                  <ExternalLink className="w-4 h-4 mr-1" />
                  Open
                </button>
              </div>
            )}
          </div>
          
          {/* Tab Navigation */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8 overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center transition-colors ${
                      isActive
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mr-2 ${isActive ? 'text-primary-600' : 'text-gray-400'}`} />
                    {tab.label}
                  </button>
                )
              })}
            </nav>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Tab Content */}
            <div className="min-h-[400px]">
              {renderTabContent()}
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 mt-8">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-6 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md disabled:opacity-50 flex items-center transition-colors"
              >
                {loading && <LoadingSpinner size="small" className="mr-2" />}
                {reservation ? 'Update Reservation' : 'Create Reservation'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
