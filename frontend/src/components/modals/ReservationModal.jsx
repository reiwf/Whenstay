import { useState, useEffect } from 'react'
import { 
  Calendar, 
  Users, 
  DollarSign, 
  MapPin, 
  Mail, 
  Phone, 
  Copy, 
  ExternalLink,
  Check,
  AlertCircle,
  Clock,
  FileText,
  Shield,
  ChevronDown,
  ChevronUp,
  User,
  UserCheck,
  Building2,
  CreditCard,
  BookImage,
  UserPlus,
  Globe,
  MessageSquare,
  Hash
} from 'lucide-react'
import toast from 'react-hot-toast'
import LoadingSpinner from '../LoadingSpinner'
import ScheduledMessagesPanel from '../communication/ScheduledMessagesPanel'
import { adminAPI } from '../../services/api'

export default function ReservationModal({ reservation, properties, onSave, onClose }) {
  const [formData, setFormData] = useState({
    // Basic booking information - maps directly to database columns
    beds24BookingId: '',
    bookingName: '',
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
        bookingName: reservation.booking_name || '',
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
        bookingName: '',
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
  const [collapsedSections, setCollapsedSections] = useState({
    booking: false,
    checkin: false,
    system: false,
    admin: false,
    scheduled: false
  })

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


  // Get available rooms from properties (V5 structure)
  const availableRooms = properties.reduce((rooms, property) => {
    if (property.room_types) {
      property.room_types.forEach(roomType => {
        if (roomType.room_units) {
          roomType.room_units.forEach(roomUnit => {
            rooms.push({
              id: roomUnit.id,
              propertyId: property.id,
              roomTypeId: roomType.id,
              roomUnitId: roomUnit.id,
              label: `${property.name} → ${roomType.name} → Unit ${roomUnit.unit_number}${roomUnit.floor_number ? ` (Floor ${roomUnit.floor_number})` : ''}`,
              propertyName: property.name,
              roomTypeName: roomType.name,
              unitNumber: roomUnit.unit_number,
              floorNumber: roomUnit.floor_number,
              maxGuests: roomType.max_guests,
              basePrice: roomType.base_price
            })
          })
        }
      })
    }
    return rooms
  }, [])

  const validateForm = () => {
    const newErrors = {}

    // Required fields based on database schema
    if (!formData.beds24BookingId.trim()) {
      newErrors.beds24BookingId = 'Beds24 Booking ID is required'
    }
    if (!formData.bookingName.trim()) {
      newErrors.bookingName = 'Booking name is required'
    }
    if (!formData.bookingEmail.trim()) {
      newErrors.bookingEmail = 'Booking email is required'
    } else if (!/\S+@\S+\.\S+/.test(formData.bookingEmail)) {
      newErrors.bookingEmail = 'Please enter a valid email address'
    }
    if (!formData.checkInDate) {
      newErrors.checkInDate = 'Check-in date is required'
    }
    if (!formData.checkOutDate) {
      newErrors.checkOutDate = 'Check-out date is required'
    }
    
    // Room assignment validation (V5 structure)
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
        bookingName: formData.bookingName,
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

  const handleRoomSelection = (roomUnitId) => {
    const selectedRoom = availableRooms.find(room => room.roomUnitId === roomUnitId)
    if (selectedRoom) {
      setFormData({
        ...formData,
        roomUnitId: selectedRoom.roomUnitId,
        roomTypeId: selectedRoom.roomTypeId,
        propertyId: selectedRoom.propertyId
      })
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

  const calculateNights = () => {
    if (!formData.checkInDate || !formData.checkOutDate) return 0
    const checkIn = new Date(formData.checkInDate)
    const checkOut = new Date(formData.checkOutDate)
    return Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24))
  }

  const toggleSection = (section) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const hasCheckinData = reservation?.checkin_submitted_at || 
    reservation?.guest_firstname || 
    reservation?.guest_lastname || 
    reservation?.guest_mail ||
    reservation?.passport_url ||
    reservation?.guest_address

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
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 1. BOOKING INFORMATION SECTION */}
            <div className="border border-blue-200 rounded-lg overflow-hidden">
              <div 
                className="bg-blue-50 p-4 cursor-pointer"
                onClick={() => toggleSection('booking')}
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-md font-medium text-blue-900 flex items-center">
                    <Building2 className="w-5 h-5 mr-2 text-blue-600" />
                    Booking Information
                    <span className="ml-2 text-sm text-blue-600 font-normal">
                      (Core reservation data)
                    </span>
                  </h4>
                  {collapsedSections.booking ? 
                    <ChevronDown className="w-5 h-5 text-blue-600" /> : 
                    <ChevronUp className="w-5 h-5 text-blue-600" />
                  }
                </div>
              </div>
              
              {!collapsedSections.booking && (
                <div className="p-4 bg-white">
                  {/* Booking System Information */}
                  <div className="mb-6">
                    <h5 className="text-sm font-medium text-gray-800 mb-3 flex items-center">
                      <Hash className="w-4 h-4 mr-2" />
                      System Information
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Beds24 Booking ID *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.beds24BookingId}
                          readOnly={!!reservation}
                          onChange={(e) => !reservation && setFormData({ ...formData, beds24BookingId: e.target.value })}
                          className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none ${reservation ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : 'focus:ring-1 focus:ring-blue-500'} ${
                            errors.beds24BookingId ? 'border-red-300' : 'border-gray-300'
                          }`}
                          placeholder="Beds24 booking reference"
                        />
                        {errors.beds24BookingId && (
                          <p className="text-red-500 text-xs mt-1 flex items-center">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            {errors.beds24BookingId}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Booking Source
                        </label>
                        <select
                          value={formData.bookingSource}
                          onChange={(e) => setFormData({ ...formData, bookingSource: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Select source</option>
                          <option value="Airbnb">Airbnb</option>
                          <option value="Booking.com">Booking.com</option>
                          <option value="Expedia">Expedia</option>
                          <option value="Direct">Direct Booking</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Primary Guest Information */}
                  <div className="mb-6">
                    <h5 className="text-sm font-medium text-gray-800 mb-3 flex items-center">
                      <User className="w-4 h-4 mr-2" />
                      Primary Guest (Booking Contact)
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Booking Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.bookingName}
                          onChange={(e) => setFormData({ ...formData, bookingName: e.target.value })}
                          className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                            errors.bookingName ? 'border-red-300' : 'border-gray-300'
                          }`}
                          placeholder="John Smith"
                        />
                        {errors.bookingName && (
                          <p className="text-red-500 text-xs mt-1 flex items-center">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            {errors.bookingName}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Booking Last Name
                        </label>
                        <input
                          type="text"
                          value={formData.bookingLastname}
                          onChange={(e) => setFormData({ ...formData, bookingLastname: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Smith"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Booking Email *
                        </label>
                        <input
                          type="email"
                          required
                          value={formData.bookingEmail}
                          onChange={(e) => setFormData({ ...formData, bookingEmail: e.target.value })}
                          className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                            errors.bookingEmail ? 'border-red-300' : 'border-gray-300'
                          }`}
                          placeholder="john@example.com"
                        />
                        {errors.bookingEmail && (
                          <p className="text-red-500 text-xs mt-1 flex items-center">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            {errors.bookingEmail}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Booking Phone
                        </label>
                        <input
                          type="tel"
                          value={formData.bookingPhone}
                          onChange={(e) => setFormData({ ...formData, bookingPhone: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="+1 (555) 123-4567"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Dates & Guests */}
                  <div className="mb-6">
                    <h5 className="text-sm font-medium text-gray-800 mb-3 flex items-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      Stay Details
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Check-in Date *
                        </label>
                        <input
                          type="date"
                          required
                          value={formData.checkInDate}
                          onChange={(e) => setFormData({ ...formData, checkInDate: e.target.value })}
                          className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                            errors.checkInDate ? 'border-red-300' : 'border-gray-300'
                          }`}
                        />
                        {errors.checkInDate && (
                          <p className="text-red-500 text-xs mt-1 flex items-center">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            {errors.checkInDate}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Check-out Date *
                        </label>
                        <input
                          type="date"
                          required
                          value={formData.checkOutDate}
                          onChange={(e) => setFormData({ ...formData, checkOutDate: e.target.value })}
                          className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                            errors.checkOutDate ? 'border-red-300' : 'border-gray-300'
                          }`}
                        />
                        {errors.checkOutDate && (
                          <p className="text-red-500 text-xs mt-1 flex items-center">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            {errors.checkOutDate}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Nights
                        </label>
                        <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm text-gray-700">
                          {calculateNights()} night{calculateNights() !== 1 ? 's' : ''}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Total Guests *
                        </label>
                        <input
                          type="number"
                          required
                          min="1"
                          max="20"
                          value={formData.numGuests}
                          onChange={(e) => setFormData({ ...formData, numGuests: parseInt(e.target.value) || 1 })}
                          className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                            errors.numGuests ? 'border-red-300' : 'border-gray-300'
                          }`}
                        />
                        {errors.numGuests && (
                          <p className="text-red-500 text-xs mt-1 flex items-center">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            {errors.numGuests}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Adults *
                        </label>
                        <input
                          type="number"
                          required
                          min="1"
                          max="20"
                          value={formData.numAdults}
                          onChange={(e) => setFormData({ ...formData, numAdults: parseInt(e.target.value) || 1 })}
                          className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                            errors.numAdults ? 'border-red-300' : 'border-gray-300'
                          }`}
                        />
                        {errors.numAdults && (
                          <p className="text-red-500 text-xs mt-1 flex items-center">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            {errors.numAdults}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Children
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          value={formData.numChildren}
                          onChange={(e) => setFormData({ ...formData, numChildren: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Room Assignment */}
                  <div className="mb-6">
                    <h5 className="text-sm font-medium text-gray-800 mb-3 flex items-center">
                      <MapPin className="w-4 h-4 mr-2" />
                      Room Assignment (V5 Structure)
                    </h5>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Room Unit *
                      </label>
                      <select
                        required
                        value={formData.roomUnitId}
                        onChange={(e) => handleRoomSelection(e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                          errors.roomUnitId ? 'border-red-300' : 'border-gray-300'
                        }`}
                      >
                        <option value="">Select a room unit</option>
                        {availableRooms.map((room) => (
                          <option key={room.roomUnitId} value={room.roomUnitId}>
                            {room.label} (Max: {room.maxGuests} guests)
                          </option>
                        ))}
                      </select>
                      {errors.roomUnitId && (
                        <p className="text-red-500 text-xs mt-1 flex items-center">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          {errors.roomUnitId}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Financial Details */}
                  <div className="mb-6">
                    <h5 className="text-sm font-medium text-gray-800 mb-3 flex items-center">
                      <CreditCard className="w-4 h-4 mr-2" />
                      Financial Details
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Total Amount
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.totalAmount}
                          onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                          className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                            errors.totalAmount ? 'border-red-300' : 'border-gray-300'
                          }`}
                          placeholder="0.00"
                        />
                        {errors.totalAmount && (
                          <p className="text-red-500 text-xs mt-1 flex items-center">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            {errors.totalAmount}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Price
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.price}
                          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                          className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                            errors.price ? 'border-red-300' : 'border-gray-300'
                          }`}
                          placeholder="0.00"
                        />
                        {errors.price && (
                          <p className="text-red-500 text-xs mt-1 flex items-center">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            {errors.price}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Commission
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.commission}
                          onChange={(e) => setFormData({ ...formData, commission: e.target.value })}
                          className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                            errors.commission ? 'border-red-300' : 'border-gray-300'
                          }`}
                          placeholder="0.00"
                        />
                        {errors.commission && (
                          <p className="text-red-500 text-xs mt-1 flex items-center">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            {errors.commission}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status and Comments */}
                  <div className="mb-6">
                    <h5 className="text-sm font-medium text-gray-800 mb-3 flex items-center">
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Status & Notes
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Status
                        </label>
                        <select
                          value={formData.status}
                          onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {statusOptions.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    
                    <div className="mt-4 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Special Requests
                        </label>
                        <textarea
                          value={formData.specialRequests}
                          onChange={(e) => setFormData({ ...formData, specialRequests: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Any special requests or notes..."
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Comments
                        </label>
                        <textarea
                          value={formData.comments}
                          onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Internal comments..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 2. CHECK-IN DETAILS SECTION */}
            <div className="border border-green-200 rounded-lg overflow-hidden">
              <div 
                className="bg-green-50 p-4 cursor-pointer"
                onClick={() => toggleSection('checkin')}
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-md font-medium text-green-900 flex items-center">
                    <UserPlus className="w-5 h-5 mr-2 text-green-600" />
                    Check-in Details
                    <span className="ml-2 text-sm text-green-600 font-normal">
                      (Guest-Provided Data)
                    </span>
                    {hasCheckinData && (
                      <span className="ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        Data Available
                      </span>
                    )}
                  </h4>
                  {collapsedSections.checkin ? 
                    <ChevronDown className="w-5 h-5 text-green-600" /> : 
                    <ChevronUp className="w-5 h-5 text-green-600" />
                  }
                </div>
              </div>
              
              {!collapsedSections.checkin && (
                <div className="p-4 bg-white">
                  {!hasCheckinData && (
                    <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                      <div className="flex items-center">
                        <AlertCircle className="w-5 h-5 text-yellow-600 mr-2" />
                        <span className="text-sm text-yellow-800">
                          No check-in data submitted yet. Guest information will appear here once they complete online check-in.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Guest Personal Information */}
                  <div className="mb-6">
                    <h5 className="text-sm font-medium text-gray-800 mb-3 flex items-center">
                      <User className="w-4 h-4 mr-2" />
                      Guest Personal Information
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          First Name
                        </label>
                        <input
                          type="text"
                          value={formData.guestFirstname}
                          onChange={(e) => setFormData({ ...formData, guestFirstname: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                          placeholder="John"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Last Name
                        </label>
                        <input
                          type="text"
                          value={formData.guestLastname}
                          onChange={(e) => setFormData({ ...formData, guestLastname: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                          placeholder="Smith"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Personal Email
                        </label>
                        <input
                          type="email"
                          value={formData.guestMail}
                          onChange={(e) => setFormData({ ...formData, guestMail: e.target.value })}
                          className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500 ${
                            errors.guestMail ? 'border-red-300' : 'border-gray-300'
                          }`}
                          placeholder="personal@example.com"
                        />
                        {errors.guestMail && (
                          <p className="text-red-500 text-xs mt-1 flex items-center">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            {errors.guestMail}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Contact Number
                        </label>
                        <input
                          type="tel"
                          value={formData.guestContact}
                          onChange={(e) => setFormData({ ...formData, guestContact: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                          placeholder="+1 (555) 123-4567"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Address
                        </label>
                        <textarea
                          value={formData.guestAddress}
                          onChange={(e) => setFormData({ ...formData, guestAddress: e.target.value })}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                          placeholder="123 Main St, City, State, Country"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Check-in Preferences */}
                  <div className="mb-6">
                    <h5 className="text-sm font-medium text-gray-800 mb-3 flex items-center">
                      <Clock className="w-4 h-4 mr-2" />
                      Check-in Preferences
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Estimated Check-in Time
                        </label>
                        <input
                          type="time"
                          value={formData.estimatedCheckinTime}
                          onChange={(e) => setFormData({ ...formData, estimatedCheckinTime: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Travel Purpose
                        </label>
                        <select
                          value={formData.travelPurpose}
                          onChange={(e) => setFormData({ ...formData, travelPurpose: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                        >
                          <option value="">Select purpose</option>
                          <option value="Business">Business</option>
                          <option value="Leisure">Leisure</option>
                          <option value="Family Visit">Family Visit</option>
                          <option value="Medical">Medical</option>
                          <option value="Education">Education</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Document Upload */}
                  {formData.passportUrl && (
                    <div className="mb-6">
                      <h5 className="text-sm font-medium text-gray-800 mb-3 flex items-center">
                        <BookImage className="w-4 h-4 mr-2" />
                        Identity Document
                      </h5>
                      <div className="flex items-center space-x-2">
                        <a
                          href={formData.passportUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 hover:text-green-800 text-sm underline flex items-center"
                        >
                          <ExternalLink className="w-4 h-4 mr-1" />
                          View Document
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Emergency Contact */}
                  <div className="mb-6">
                    <h5 className="text-sm font-medium text-gray-800 mb-3 flex items-center">
                      <Phone className="w-4 h-4 mr-2" />
                      Emergency Contact
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Emergency Contact Name
                        </label>
                        <input
                          type="text"
                          value={formData.emergencyContactName}
                          onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                          placeholder="Emergency contact person"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Emergency Contact Phone
                        </label>
                        <input
                          type="tel"
                          value={formData.emergencyContactPhone}
                          onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                          placeholder="+1 (555) 123-4567"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Agreement Status */}
                  <div>
                    <h5 className="text-sm font-medium text-gray-800 mb-3 flex items-center">
                      <FileText className="w-4 h-4 mr-2" />
                      Agreement Status
                    </h5>
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="agreementAccepted"
                        checked={formData.agreementAccepted}
                        onChange={(e) => setFormData({ ...formData, agreementAccepted: e.target.checked })}
                        className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                      />
                      <label htmlFor="agreementAccepted" className="text-sm font-medium text-gray-700">
                        Guest Agreement Accepted
                      </label>
                      {formData.agreementAccepted && (
                        <Check className="w-4 h-4 text-green-600" />
                      )}
                    </div>

                    {reservation?.checkin_submitted_at && (
                      <div className="mt-3 p-2 bg-green-100 border border-green-200 rounded-md">
                        <div className="text-sm text-green-800">
                          <strong>Check-in Submitted:</strong> {new Date(reservation.checkin_submitted_at).toLocaleString()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 3. SYSTEM INFORMATION SECTION */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div 
                className="bg-gray-50 p-4 cursor-pointer"
                onClick={() => toggleSection('system')}
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-md font-medium text-gray-900 flex items-center">
                    <Globe className="w-5 h-5 mr-2 text-gray-600" />
                    System Information
                    <span className="ml-2 text-sm text-gray-600 font-normal">
                      (Beds24 Webhook Data)
                    </span>
                  </h4>
                  {collapsedSections.system ? 
                    <ChevronDown className="w-5 h-5 text-gray-600" /> : 
                    <ChevronUp className="w-5 h-5 text-gray-600" />
                  }
                </div>
              </div>
              
              {!collapsedSections.system && (
                <div className="p-4 bg-white">
                  {/* Beds24 Webhook Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        API Reference
                      </label>
                      <input
                        type="text"
                        value={formData.apiReference}
                        onChange={(e) => setFormData({ ...formData, apiReference: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-gray-500"
                        placeholder="API reference"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Rate Description
                      </label>
                      <input
                        type="text"
                        value={formData.rateDescription}
                        onChange={(e) => setFormData({ ...formData, rateDescription: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-gray-500"
                        placeholder="Rate description"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Language
                      </label>
                      <input
                        type="text"
                        value={formData.lang}
                        onChange={(e) => setFormData({ ...formData, lang: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-gray-500"
                        placeholder="en"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Booking Time
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.bookingTime}
                        onChange={(e) => setFormData({ ...formData, bookingTime: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-gray-500"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        API Message
                      </label>
                      <textarea
                        value={formData.apiMessage}
                        onChange={(e) => setFormData({ ...formData, apiMessage: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-gray-500"
                        placeholder="API message"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 4. ADMINISTRATIVE SECTION */}
            <div className="border border-red-200 rounded-lg overflow-hidden">
              <div 
                className="bg-red-50 p-4 cursor-pointer"
                onClick={() => toggleSection('admin')}
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-md font-medium text-red-900 flex items-center">
                    <Shield className="w-5 h-5 mr-2 text-red-600" />
                    Administrative
                    <span className="ml-2 text-sm text-red-600 font-normal">
                      (Admin Controls & Verification)
                    </span>
                  </h4>
                  {collapsedSections.admin ? 
                    <ChevronDown className="w-5 h-5 text-red-600" /> : 
                    <ChevronUp className="w-5 h-5 text-red-600" />
                  }
                </div>
              </div>
              
              {!collapsedSections.admin && reservation && (
                <div className="p-4 bg-white">
                  {/* Verification Status */}
                  <div className="mb-6">
                    <h5 className="text-sm font-medium text-gray-800 mb-3 flex items-center">
                      <UserCheck className="w-4 h-4 mr-2" />
                      Verification Status
                    </h5>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          id="adminVerified"
                          checked={formData.adminVerified}
                          onChange={(e) => setFormData({ ...formData, adminVerified: e.target.checked })}
                          className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                        />
                        <label htmlFor="adminVerified" className="text-sm font-medium text-gray-700">
                          Admin Verified
                        </label>
                        {formData.adminVerified && (
                          <Check className="w-4 h-4 text-green-600" />
                        )}
                      </div>

                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          id="accessRead"
                          checked={formData.accessRead}
                          onChange={(e) => setFormData({ ...formData, accessRead: e.target.checked })}
                          className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                        />
                        <label htmlFor="accessRead" className="text-sm font-medium text-gray-700">
                          Access Read
                        </label>
                        {formData.accessRead && (
                          <Check className="w-4 h-4 text-green-600" />
                        )}
                      </div>

                      {reservation.verified_at && (
                        <div className="p-2 bg-blue-50 border border-blue-200 rounded-md">
                          <div className="text-sm text-blue-800">
                            <strong>Verified At:</strong> {new Date(reservation.verified_at).toLocaleString()}
                          </div>
                          {reservation.verified_by_name && (
                            <div className="text-sm text-blue-700">
                              <strong>Verified By:</strong> {reservation.verified_by_name} {reservation.verified_by_lastname}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* System Information */}
                  <div className="mb-6">
                    <h5 className="text-sm font-medium text-gray-800 mb-3 flex items-center">
                      <Clock className="w-4 h-4 mr-2" />
                      System Information
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {reservation.created_at && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Created At
                          </label>
                          <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm text-gray-600">
                            {new Date(reservation.created_at).toLocaleString()}
                          </div>
                        </div>
                      )}

                      {reservation.updated_at && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Last Updated
                          </label>
                          <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm text-gray-600">
                            {new Date(reservation.updated_at).toLocaleString()}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Check-in URL Management */}
                  {reservation.check_in_token && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-800 mb-3 flex items-center">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Check-in URL Management
                      </h5>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Check-in URL
                          </label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="text"
                              value={`${window.location.origin}/checkin/${reservation.check_in_token}`}
                              readOnly
                              className="flex-1 px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm text-gray-600"
                            />
                            <button
                              type="button"
                              onClick={handleCopyCheckinUrl}
                              className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                            >
                              {copied ? 'Copied!' : 'Copy'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 5. SCHEDULED MESSAGES SECTION */}
            {reservation && (
              <div className="border border-purple-200 rounded-lg overflow-hidden">
                <div 
                  className="bg-purple-50 p-4 cursor-pointer"
                  onClick={() => toggleSection('scheduled')}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-md font-medium text-purple-900 flex items-center">
                      <MessageSquare className="w-5 h-5 mr-2 text-purple-600" />
                      Scheduled Messages
                      <span className="ml-2 text-sm text-purple-600 font-normal">
                        (Automation System)
                      </span>
                    </h4>
                    {collapsedSections.scheduled ? 
                      <ChevronDown className="w-5 h-5 text-purple-600" /> : 
                      <ChevronUp className="w-5 h-5 text-purple-600" />
                    }
                  </div>
                </div>
                
                {!collapsedSections.scheduled && (
                  <div className="p-4 bg-white">
                    <ScheduledMessagesPanel
                      reservationId={reservation.id}
                      onTriggerAutomation={handleTriggerAutomation}
                      onCancelMessages={handleCancelMessages}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 flex items-center"
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
