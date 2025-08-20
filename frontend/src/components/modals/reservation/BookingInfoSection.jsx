import { 
  Building2, 
  Hash, 
  User, 
  Calendar, 
  MapPin, 
  CreditCard, 
  MessageSquare, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle 
} from 'lucide-react'
import { useEffect } from 'react'

export default function BookingInfoSection({ 
  formData, 
  setFormData, 
  errors, 
  properties, 
  statusOptions,
  reservation,
  collapsed, 
  onToggle 
}) {
  // Get available properties
  const availableProperties = properties?.filter(property => property.is_active) || []

  // Get available room types for selected property
  const availableRoomTypes = formData.propertyId 
    ? properties.find(p => p.id === formData.propertyId)?.room_types?.filter(rt => rt.is_active) || []
    : []

  // Get available room units for selected room type
  const availableRoomUnits = formData.roomTypeId 
    ? availableRoomTypes.find(rt => rt.id === formData.roomTypeId)?.room_units?.filter(ru => ru.is_active) || []
    : []

  // Prefill room assignment for new reservations
  useEffect(() => {
    // Only prefill for new reservations (not editing existing ones)
    if (!reservation && availableProperties.length > 0 && !formData.propertyId) {
      const firstProperty = availableProperties[0]
      const firstRoomType = firstProperty.room_types?.filter(rt => rt.is_active)?.[0]
      const firstRoomUnit = firstRoomType?.room_units?.filter(ru => ru.is_active)?.[0]
      
      if (firstProperty && firstRoomType && firstRoomUnit) {
        setFormData(prev => ({
          ...prev,
          propertyId: firstProperty.id,
          roomTypeId: firstRoomType.id,
          roomUnitId: firstRoomUnit.id
        }))
      }
    }
  }, [availableProperties, reservation, formData.propertyId, setFormData])

  const handlePropertySelection = (propertyId) => {
    setFormData({
      ...formData,
      propertyId,
      roomTypeId: '', // Reset room type when property changes
      roomUnitId: ''   // Reset room unit when property changes
    })
  }

  const handleRoomTypeSelection = (roomTypeId) => {
    setFormData({
      ...formData,
      roomTypeId,
      roomUnitId: '' // Reset room unit when room type changes
    })
  }

  const handleRoomUnitSelection = (roomUnitId) => {
    setFormData({
      ...formData,
      roomUnitId
    })
  }

  const calculateNights = () => {
    if (!formData.checkInDate || !formData.checkOutDate) return 0
    const checkIn = new Date(formData.checkInDate)
    const checkOut = new Date(formData.checkOutDate)
    return Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24))
  }

  return (
    <div className="space-y-6">
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
                  Booking First Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.bookingFirstname}
                  onChange={(e) => setFormData({ ...formData, bookingFirstname: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    errors.bookingFirstname ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="John"
                />
                {errors.bookingFirstname && (
                  <p className="text-red-500 text-xs mt-1 flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    {errors.bookingFirstname}
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
                  Booking Email
                </label>
                <input
                  type="email"
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Property Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Property *
                </label>
                <select
                  required
                  value={formData.propertyId}
                  onChange={(e) => handlePropertySelection(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    errors.propertyId ? 'border-red-300' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select a property</option>
                  {availableProperties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </select>
                {errors.propertyId && (
                  <p className="text-red-500 text-xs mt-1 flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    {errors.propertyId}
                  </p>
                )}
              </div>

              {/* Room Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Room Type *
                </label>
                <select
                  required
                  value={formData.roomTypeId}
                  onChange={(e) => handleRoomTypeSelection(e.target.value)}
                  disabled={!formData.propertyId}
                  className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    !formData.propertyId ? 'bg-gray-100 cursor-not-allowed' : ''
                  } ${errors.roomTypeId ? 'border-red-300' : 'border-gray-300'}`}
                >
                  <option value="">Select a room type</option>
                  {availableRoomTypes.map((roomType) => (
                    <option key={roomType.id} value={roomType.id}>
                      {roomType.name} (Max: {roomType.max_guests} guests)
                    </option>
                  ))}
                </select>
                {errors.roomTypeId && (
                  <p className="text-red-500 text-xs mt-1 flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    {errors.roomTypeId}
                  </p>
                )}
              </div>

              {/* Room Unit Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Room Unit *
                </label>
                <select
                  required
                  value={formData.roomUnitId}
                  onChange={(e) => handleRoomUnitSelection(e.target.value)}
                  disabled={!formData.roomTypeId}
                  className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    !formData.roomTypeId ? 'bg-gray-100 cursor-not-allowed' : ''
                  } ${errors.roomUnitId ? 'border-red-300' : 'border-gray-300'}`}
                >
                  <option value="">Select a room unit</option>
                  {availableRoomUnits.map((roomUnit) => (
                    <option key={roomUnit.id} value={roomUnit.id}>
                      Unit {roomUnit.unit_number}
                      {roomUnit.floor_number ? ` (Floor ${roomUnit.floor_number})` : ''}
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
  )
}
