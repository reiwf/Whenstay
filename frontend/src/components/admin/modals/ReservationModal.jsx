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
  UserPlus
} from 'lucide-react'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../LoadingSpinner'

export default function ReservationModal({ reservation, properties, onSave, onClose }) {
  const [formData, setFormData] = useState({
    // Basic booking info (maps to booking_* fields in DB)
    bookingName: reservation?.booking_name || reservation?.guest_name || '',
    bookingEmail: reservation?.booking_email || reservation?.guest_email || '',
    bookingPhone: reservation?.booking_phone || reservation?.guest_phone || '',
    
    // Guest personal info (maps to guest_* fields in DB)
    guestFirstname: reservation?.guest_firstname || '',
    guestLastname: reservation?.guest_lastname || '',
    guestPersonalEmail: reservation?.guest_mail || reservation?.guest_personal_email || '',
    guestContact: reservation?.guest_contact || '',
    guestAddress: reservation?.guest_address || '',
    
    // Booking details
    checkInDate: reservation?.check_in_date || '',
    checkOutDate: reservation?.check_out_date || '',
    numGuests: reservation?.num_guests || 1,
    numAdults: reservation?.num_adults || 1,
    numChildren: reservation?.num_children || 0,
    totalAmount: reservation?.total_amount || '',
    currency: reservation?.currency || 'USD',
    status: reservation?.status || 'pending',
    specialRequests: reservation?.special_requests || '',
    bookingSource: reservation?.booking_source || '',
    beds24BookingId: reservation?.beds24_booking_id || '',
    
    // V5 Room assignment
    propertyId: reservation?.property_id || '',
    roomTypeId: reservation?.room_type_id || '',
    roomUnitId: reservation?.room_unit_id || '',
    roomId: reservation?.room_id || '', // Legacy support
    
    // Check-in information
    estimatedCheckinTime: reservation?.estimated_checkin_time || '',
    travelPurpose: reservation?.travel_purpose || '',
    passportUrl: reservation?.passport_url || '',
    
    // Emergency contact
    emergencyContactName: reservation?.emergency_contact_name || '',
    emergencyContactPhone: reservation?.emergency_contact_phone || '',
    
    // Administrative
    agreementAccepted: reservation?.agreement_accepted || false,
    adminVerified: reservation?.admin_verified || false
  })
  
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [errors, setErrors] = useState({})
  const [collapsedSections, setCollapsedSections] = useState({
    booking: false,
    checkin: false,
    admin: false
  })

  // Get available rooms from properties (V5 schema: room_types -> room_units)
  const availableRooms = properties.reduce((rooms, property) => {
    // V5 structure: room_types -> room_units
    if (property.room_types) {
      property.room_types.forEach(roomType => {
        if (roomType.room_units) {
          roomType.room_units.forEach(roomUnit => {
            rooms.push({
              id: roomUnit.id,
              roomUnitId: roomUnit.id,
              roomTypeId: roomType.id,
              propertyId: property.id,
              label: `${property.name} - ${roomType.name} - Unit ${roomUnit.unit_number}${roomUnit.floor_number ? ` (Floor ${roomUnit.floor_number})` : ''}`,
              propertyName: property.name,
              roomTypeName: roomType.name,
              unitNumber: roomUnit.unit_number,
              floorNumber: roomUnit.floor_number
            })
          })
        }
      })
    }
    
    // Legacy support: direct rooms
    if (property.rooms) {
      property.rooms.forEach(room => {
        rooms.push({
          id: room.id,
          roomId: room.id, // Legacy room ID
          propertyId: property.id,
          label: `${property.name} - Room ${room.room_number}${room.room_name ? ` (${room.room_name})` : ''}`,
          propertyName: property.name,
          roomNumber: room.room_number,
          roomName: room.room_name,
          isLegacy: true
        })
      })
    }
    
    return rooms
  }, [])

  const validateForm = () => {
    const newErrors = {}

    // Required fields - using correct field names
    if (!formData.bookingName.trim()) {
      newErrors.bookingName = 'Guest name is required'
    }
    if (!formData.bookingEmail.trim()) {
      newErrors.bookingEmail = 'Guest email is required'
    } else if (!/\S+@\S+\.\S+/.test(formData.bookingEmail)) {
      newErrors.bookingEmail = 'Please enter a valid email address'
    }
    if (!formData.checkInDate) {
      newErrors.checkInDate = 'Check-in date is required'
    }
    if (!formData.checkOutDate) {
      newErrors.checkOutDate = 'Check-out date is required'
    }
    
    // Room assignment validation - check for either V5 or legacy room assignment
    if (!formData.roomUnitId && !formData.roomId) {
      newErrors.roomAssignment = 'Room selection is required'
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
      const submitData = {
        // Basic booking info (maps to booking_* fields in DB)
        bookingName: formData.bookingName,
        bookingEmail: formData.bookingEmail,
        bookingPhone: formData.bookingPhone || null,
        
        // Guest personal info (maps to guest_* fields in DB)
        guestFirstname: formData.guestFirstname || null,
        guestLastname: formData.guestLastname || null,
        guestPersonalEmail: formData.guestPersonalEmail || null,
        guestContact: formData.guestContact || null,
        guestAddress: formData.guestAddress || null,
        
        // Booking details
        checkInDate: formData.checkInDate,
        checkOutDate: formData.checkOutDate,
        numGuests: parseInt(formData.numGuests),
        numAdults: parseInt(formData.numAdults),
        numChildren: parseInt(formData.numChildren),
        totalAmount: formData.totalAmount ? parseFloat(formData.totalAmount) : null,
        currency: formData.currency,
        status: formData.status,
        specialRequests: formData.specialRequests || null,
        bookingSource: formData.bookingSource || null,
        beds24BookingId: formData.beds24BookingId || null,
        
        // V5 Room assignment
        propertyId: formData.propertyId || null,
        roomTypeId: formData.roomTypeId || null,
        roomUnitId: formData.roomUnitId || null,
        // Note: roomId field removed in V5 schema
        
        // Check-in information
        estimatedCheckinTime: formData.estimatedCheckinTime || null,
        travelPurpose: formData.travelPurpose || null,
        passportUrl: formData.passportUrl || null,
        
        // Emergency contact
        emergencyContactName: formData.emergencyContactName || null,
        emergencyContactPhone: formData.emergencyContactPhone || null,
        
        // Administrative
        agreementAccepted: formData.agreementAccepted,
        adminVerified: formData.adminVerified
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
      case 'invited': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
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
    reservation?.guest_personal_email ||
    reservation?.passport_url ||
    reservation?.guest_address

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
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
            {/* 1. BOOKING DETAILS SECTION */}
            <div className="border border-blue-200 rounded-lg overflow-hidden">
              <div 
                className="bg-blue-50 p-4 cursor-pointer"
                onClick={() => toggleSection('booking')}
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-md font-medium text-blue-900 flex items-center">
                    <Building2 className="w-5 h-5 mr-2 text-blue-600" />
                    Booking Details
                    <span className="ml-2 text-sm text-blue-600 font-normal">
                      (System/Admin Managed Data)
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
                  {/* Booking System Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {reservation?.beds24_booking_id && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Beds24 Booking ID
                        </label>
                        <input
                          type="text"
                          value={formData.beds24BookingId}
                          readOnly
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-100 text-gray-600"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Booking Source
                      </label>
                      <select
                        value={formData.bookingSource}
                        onChange={(e) => setFormData({ ...formData, bookingSource: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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

                  {/* Primary Guest Information */}
                  <div className="mb-6">
                    <h5 className="text-sm font-medium text-gray-800 mb-3 flex items-center">
                      <User className="w-4 h-4 mr-2" />
                      Primary Guest (Booking Contact)
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Guest Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.bookingName}
                          onChange={(e) => setFormData({ ...formData, bookingName: e.target.value })}
                          className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
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
                          Email Address *
                        </label>
                        <input
                          type="email"
                          required
                          value={formData.bookingEmail}
                          onChange={(e) => setFormData({ ...formData, bookingEmail: e.target.value })}
                          className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
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
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          value={formData.bookingPhone}
                          onChange={(e) => setFormData({ ...formData, bookingPhone: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                          className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
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
                          className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
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
                          className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
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
                          className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Room Assignment */}
                  <div className="mb-6">
                    <h5 className="text-sm font-medium text-gray-800 mb-3 flex items-center">
                      <MapPin className="w-4 h-4 mr-2" />
                      Room Assignment
                    </h5>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Room *
                      </label>
                      <select
                        required
                        value={formData.roomUnitId || formData.roomId || ''}
                        onChange={(e) => {
                          const selectedRoom = availableRooms.find(room => room.id === e.target.value)
                          if (selectedRoom) {
                            if (selectedRoom.isLegacy) {
                              // Legacy room selection
                              setFormData({ 
                                ...formData, 
                                roomId: selectedRoom.id,
                                roomUnitId: '',
                                roomTypeId: '',
                                propertyId: selectedRoom.propertyId
                              })
                            } else {
                              // V5 room unit selection
                              setFormData({ 
                                ...formData, 
                                roomUnitId: selectedRoom.roomUnitId,
                                roomTypeId: selectedRoom.roomTypeId,
                                propertyId: selectedRoom.propertyId,
                                roomId: '' // Clear legacy room ID
                              })
                            }
                          }
                        }}
                        className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          errors.roomAssignment ? 'border-red-300' : 'border-gray-300'
                        }`}
                      >
                        <option value="">Select a room</option>
                        {availableRooms.map((room) => (
                          <option key={room.id} value={room.id}>
                            {room.label}
                          </option>
                        ))}
                      </select>
                      {errors.roomAssignment && (
                        <p className="text-red-500 text-xs mt-1 flex items-center">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          {errors.roomAssignment}
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                          className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
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
                          Currency
                        </label>
                        <select
                          value={formData.currency}
                          onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                          <option value="GBP">GBP</option>
                          <option value="CAD">CAD</option>
                          <option value="AUD">AUD</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Status
                        </label>
                        <select
                          value={formData.status}
                          onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="pending">Pending</option>
                          <option value="invited">Invited</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Special Requests */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Special Requests
                    </label>
                    <textarea
                      value={formData.specialRequests}
                      onChange={(e) => setFormData({ ...formData, specialRequests: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Any special requests or notes..."
                    />
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
                  {/* Check-in Token */}
                  {reservation?.check_in_token && (
                    <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-md">
                      <h5 className="text-sm font-medium text-gray-800 mb-2 flex items-center">
                        <FileText className="w-4 h-4 mr-2" />
                        Check-in Token
                      </h5>
                      <div className="text-sm text-gray-600">
                        Token: <span className="font-mono bg-white px-2 py-1 rounded border">{reservation.check_in_token}</span>
                      </div>
                    </div>
                  )}

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
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="John"
                          readOnly={!reservation || hasCheckinData}
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="Smith"
                          readOnly={!reservation || hasCheckinData}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Personal Email
                        </label>
                        <input
                          type="email"
                          value={formData.guestPersonalEmail}
                          onChange={(e) => setFormData({ ...formData, guestPersonalEmail: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="personal@example.com"
                          readOnly={!reservation || hasCheckinData}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Contact Number
                        </label>
                        <input
                          type="tel"
                          value={formData.guestContact}
                          onChange={(e) => setFormData({ ...formData, guestContact: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="+1 (555) 123-4567"
                          readOnly={!reservation || hasCheckinData}
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="123 Main St, City, State, Country"
                          readOnly={!reservation || hasCheckinData}
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          readOnly={!reservation || hasCheckinData}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Travel Purpose
                        </label>
                        <select
                          value={formData.travelPurpose}
                          onChange={(e) => setFormData({ ...formData, travelPurpose: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          disabled={!reservation || hasCheckinData}
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="Emergency contact person"
                          readOnly={!reservation || hasCheckinData}
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="+1 (555) 123-4567"
                          readOnly={!reservation || hasCheckinData}
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
                        disabled={!reservation || hasCheckinData}
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

            {/* 3. ADMINISTRATIVE SECTION */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div 
                className="bg-gray-50 p-4 cursor-pointer"
                onClick={() => toggleSection('admin')}
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-md font-medium text-gray-900 flex items-center">
                    <Shield className="w-5 h-5 mr-2 text-gray-600" />
                    Administrative
                    <span className="ml-2 text-sm text-gray-600 font-normal">
                      (Admin Controls & Verification)
                    </span>
                  </h4>
                  {collapsedSections.admin ? 
                    <ChevronDown className="w-5 h-5 text-gray-600" /> : 
                    <ChevronUp className="w-5 h-5 text-gray-600" />
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
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="adminVerified" className="text-sm font-medium text-gray-700">
                          Admin Verified
                        </label>
                        {formData.adminVerified && (
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
