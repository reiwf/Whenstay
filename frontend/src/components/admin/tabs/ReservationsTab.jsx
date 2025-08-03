import React, { useState, useEffect } from 'react'
import { 
  RefreshCw, 
  Download, 
  Filter, 
  Calendar, 
  Users, 
  CheckCircle, 
  Clock, 
  Mail, 
  Search,
  DollarSign,
  Edit,
  Plus,
  Copy,
  ExternalLink,
  Check,
  Building,
  Home,
  Key,
  Wifi,
  Info,
  MapPin,
  Phone,
  User,
  FileText,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { adminAPI } from '../../../services/api'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../LoadingSpinner'
import ReservationModal from '../modals/ReservationModal'
import useReservations from '../../../hooks/useReservations'

export default function ReservationsTab() {
  const {
    loading,
    reservations,
    currentPage,
    hasMore,
    loadReservations,
    updateReservation,
    createReservation,
    sendInvitation,
    setCurrentPage
  } = useReservations()

  const [properties, setProperties] = useState([])
  const [roomTypes, setRoomTypes] = useState([])
  const [filters, setFilters] = useState({
    status: '',
    propertyId: '',
    roomTypeId: '',
    checkInDateFrom: '',
    checkInDateTo: '',
    checkInDate: ''
  })
  const [showReservationModal, setShowReservationModal] = useState(false)
  const [editingReservation, setEditingReservation] = useState(null)
  const [copiedTokens, setCopiedTokens] = useState({})
  const [expandedRows, setExpandedRows] = useState({})

  useEffect(() => {
    loadReservations(filters)
    loadProperties()
  }, [])

  useEffect(() => {
    loadReservations(filters, currentPage)
  }, [filters, currentPage])

  useEffect(() => {
    if (filters.propertyId) {
      loadRoomTypes(filters.propertyId)
    } else {
      setRoomTypes([])
    }
  }, [filters.propertyId])

  const loadProperties = async () => {
    try {
      const response = await adminAPI.getProperties(true) // Load with stats
      setProperties(response.data.properties)
    } catch (error) {
      console.error('Error loading properties:', error)
    }
  }

  const loadRoomTypes = async (propertyId) => {
    try {
      const response = await adminAPI.getRoomTypesByProperty(propertyId, true) // Load with units
      setRoomTypes(response.data.roomTypes)
    } catch (error) {
      console.error('Error loading room types:', error)
      setRoomTypes([])
    }
  }

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ 
      ...prev, 
      [key]: value,
      // Clear room type filter when property changes
      ...(key === 'propertyId' && { roomTypeId: '' })
    }))
    setCurrentPage(1) // Reset to first page when filters change
  }

  const clearFilters = () => {
    setFilters({
      status: '',
      propertyId: '',
      roomTypeId: '',
      checkInDateFrom: '',
      checkInDateTo: '',
      checkInDate: ''
    })
    setCurrentPage(1)
  }

  const handleSendInvitation = async (reservationId) => {
    try {
      await sendInvitation(reservationId)
    } catch (error) {
      console.error('Error sending invitation:', error)
    }
  }

  const handleEditReservation = (reservation) => {
    setEditingReservation(reservation)
    setShowReservationModal(true)
  }

  const handleCreateReservation = () => {
    setEditingReservation(null)
    setShowReservationModal(true)
  }

  const handleSaveReservation = async (reservationData, reservationId) => {
    try {
      if (reservationId) {
        await updateReservation(reservationId, reservationData)
      } else {
        await createReservation(reservationData)
      }
      setShowReservationModal(false)
      setEditingReservation(null)
      await loadReservations(filters, currentPage)
    } catch (error) {
      console.error('Error saving reservation:', error)
    }
  }

  const handleCopyCheckinUrl = async (reservation) => {
    if (!reservation.check_in_token) return
    
    const checkinUrl = `${window.location.origin}/checkin/${reservation.check_in_token}`
    
    try {
      await navigator.clipboard.writeText(checkinUrl)
      setCopiedTokens(prev => ({ ...prev, [reservation.id]: true }))
      toast.success('Check-in URL copied to clipboard')
      setTimeout(() => {
        setCopiedTokens(prev => ({ ...prev, [reservation.id]: false }))
      }, 2000)
    } catch (error) {
      console.error('Failed to copy URL:', error)
      toast.error('Failed to copy URL')
    }
  }

  const openCheckinPage = (reservation) => {
    if (!reservation.check_in_token) return
    const checkinUrl = `/checkin/${reservation.check_in_token}`
    window.open(checkinUrl, '_blank')
  }

  const toggleRowExpansion = (reservationId) => {
    setExpandedRows(prev => ({
      ...prev,
      [reservationId]: !prev[reservationId]
    }))
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


  const renderPropertyHierarchy = (reservation) => {
    const hasV5Structure = reservation.room_type_name || reservation.unit_number
    
    // Handle property name with better fallbacks
    const getPropertyName = () => {
      if (reservation.property_name && reservation.property_name !== 'N/A' && reservation.property_name !== 'Property Information Unavailable') {
        return reservation.property_name;
      }
      return 'Property Information Unavailable';
    };

    // Handle room information with better fallbacks
    const getRoomInfo = () => {
      if (hasV5Structure) {
        return {
          roomType: reservation.room_type_name || 'Standard Room',
          unitNumber: reservation.unit_number,
          floorNumber: reservation.floor_number,
          description: reservation.room_type_description
        };
      } else {
        return {
          roomNumber: reservation.room_number && reservation.room_number !== 'N/A' ? reservation.room_number : 'TBD',
          roomName: reservation.room_name && reservation.room_name !== 'N/A' ? reservation.room_name : null
        };
      }
    };

    const propertyName = getPropertyName();
    const roomInfo = getRoomInfo();
    
    if (hasV5Structure) {
      return (
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-900 flex items-center">
            <Building className="w-4 h-4 mr-1 text-gray-500" />
            <span className={propertyName === 'Property Information Unavailable' ? 'text-gray-500 italic' : ''}>
              {propertyName}
            </span>
          </div>
          {roomInfo.roomType && (
            <div className="text-sm text-blue-600 flex items-center ml-5">
              <Home className="w-3 h-3 mr-1" />
              {roomInfo.roomType}
              {roomInfo.description && (
                <span className="text-gray-500 ml-1">
                  ({roomInfo.description})
                </span>
              )}
            </div>
          )}
          {roomInfo.unitNumber && (
            <div className="text-sm text-gray-600 flex items-center ml-5">
              <Key className="w-3 h-3 mr-1" />
              {roomInfo.unitNumber}
              {roomInfo.floorNumber && (
                <span className="text-gray-500 ml-1">
                  (Floor {roomInfo.floorNumber})
                </span>
              )}
            </div>
          )}
        </div>
      )
    } else {
      // Legacy structure
      return (
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-900 flex items-center">
            <Building className="w-4 h-4 mr-1 text-gray-500" />
            <span className={propertyName === 'Property Information Unavailable' ? 'text-gray-500 italic' : ''}>
              {propertyName}
            </span>
          </div>
          <div className="text-sm text-gray-600 flex items-center ml-5">
            <Key className="w-3 h-3 mr-1" />
            <span className={roomInfo.roomNumber === 'TBD' ? 'text-gray-500 italic' : ''}>
              Room {roomInfo.roomNumber}
            </span>
            {roomInfo.roomName && ` - ${roomInfo.roomName}`}
          </div>
        </div>
      )
    }
  }

  const renderGuestInfo = (reservation) => {
    const bookingName = reservation.booking_name || reservation.guest_name
    const guestName = reservation.guest_firstname && reservation.guest_lastname 
      ? `${reservation.guest_firstname} ${reservation.guest_lastname}`.trim()
      : null
    
    return (
      <div className="space-y-1">
        <div className="text-sm font-medium text-gray-900">
          {bookingName}
        </div>
        {guestName && guestName !== bookingName && (
          <div className="text-sm text-blue-600 flex items-center">
            <User className="w-3 h-3 mr-1" />
            Guest: {guestName}
          </div>
        )}
        <div className="text-sm text-gray-500">
          {reservation.booking_email || reservation.guest_email}
        </div>
        {(reservation.booking_phone || reservation.guest_phone || reservation.guest_contact) && (
          <div className="text-sm text-gray-500 flex items-center">
            <Phone className="w-3 h-3 mr-1" />
            {reservation.booking_phone || reservation.guest_phone || reservation.guest_contact}
          </div>
        )}
      </div>
    )
  }

  const renderExpandedDetails = (reservation) => {
    if (!expandedRows[reservation.id]) return null

    return (
      <tr key={`${reservation.id}-expanded`}>
        <td colSpan="8" className="px-6 py-4 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Room Details */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 flex items-center">
                <Home className="w-4 h-4 mr-2" />
                Accommodation Details
              </h4>
              <div className="space-y-2 text-sm">
                {reservation.bed_configuration && (
                  <div className="flex items-center text-gray-600">
                    <span className="font-medium mr-2">Beds:</span>
                    {reservation.bed_configuration}
                  </div>
                )}
                {reservation.room_size_sqm && (
                  <div className="flex items-center text-gray-600">
                    <span className="font-medium mr-2">Size:</span>
                    {reservation.room_size_sqm} sqm
                  </div>
                )}
                {reservation.has_balcony && (
                  <div className="text-green-600">✓ Balcony</div>
                )}
                {reservation.has_kitchen && (
                  <div className="text-green-600">✓ Kitchen</div>
                )}
                {reservation.is_accessible && (
                  <div className="text-green-600">✓ Accessible</div>
                )}
                {reservation.room_type_amenities && (
                  <div>
                    <span className="font-medium text-gray-600">Amenities:</span>
                    <div className="text-gray-600 mt-1">
                      {Array.isArray(reservation.room_type_amenities) 
                        ? reservation.room_type_amenities.join(', ')
                        : typeof reservation.room_type_amenities === 'object'
                        ? Object.keys(reservation.room_type_amenities).join(', ')
                        : reservation.room_type_amenities}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Access Information */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 flex items-center">
                <Key className="w-4 h-4 mr-2" />
                Access Information
              </h4>
              <div className="space-y-2 text-sm">
                {reservation.access_code && (
                  <div className="flex items-center text-gray-600">
                    <span className="font-medium mr-2">Access Code:</span>
                    <code className="bg-gray-200 px-2 py-1 rounded text-xs">
                      {reservation.access_code}
                    </code>
                  </div>
                )}
                {reservation.access_instructions && (
                  <div>
                    <span className="font-medium text-gray-600">Instructions:</span>
                    <div className="text-gray-600 mt-1">
                      {reservation.access_instructions}
                    </div>
                  </div>
                )}
                {(reservation.wifi_name || reservation.property_wifi_name) && (
                  <div className="flex items-center text-gray-600">
                    <Wifi className="w-3 h-3 mr-1" />
                    <span className="font-medium mr-2">WiFi:</span>
                    {reservation.wifi_name || reservation.property_wifi_name}
                  </div>
                )}
              </div>
            </div>

            {/* Guest Information */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 flex items-center">
                <User className="w-4 h-4 mr-2" />
                Guest Information
              </h4>
              <div className="space-y-2 text-sm">
                {reservation.guest_personal_email && (
                  <div className="flex items-center text-gray-600">
                    <span className="font-medium mr-2">Personal Email:</span>
                    {reservation.guest_personal_email}
                  </div>
                )}
                {reservation.guest_address && (
                  <div className="flex items-start text-gray-600">
                    <MapPin className="w-3 h-3 mr-1 mt-0.5" />
                    <div>
                      <span className="font-medium">Address:</span>
                      <div className="mt-1">{reservation.guest_address}</div>
                    </div>
                  </div>
                )}
                {reservation.estimated_checkin_time && (
                  <div className="flex items-center text-gray-600">
                    <Clock className="w-3 h-3 mr-1" />
                    <span className="font-medium mr-2">Est. Check-in:</span>
                    {reservation.estimated_checkin_time}
                  </div>
                )}
                {reservation.travel_purpose && (
                  <div className="flex items-center text-gray-600">
                    <span className="font-medium mr-2">Travel Purpose:</span>
                    {reservation.travel_purpose}
                  </div>
                )}
                {reservation.emergency_contact_name && (
                  <div className="text-gray-600">
                    <span className="font-medium">Emergency Contact:</span>
                    <div className="mt-1">
                      {reservation.emergency_contact_name}
                      {reservation.emergency_contact_phone && (
                        <div className="text-sm">{reservation.emergency_contact_phone}</div>
                      )}
                    </div>
                  </div>
                )}
                {reservation.passport_url && (
                  <div className="flex items-center text-blue-600">
                    <FileText className="w-3 h-3 mr-1" />
                    <a 
                      href={reservation.passport_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      View Passport Document
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <div className="card">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Reservation Management</h2>
          <div className="flex space-x-2">
            <button
              onClick={() => loadReservations(filters, currentPage)}
              className="btn-secondary text-sm"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </button>
            <button
              onClick={() => {/* TODO: Export functionality */}}
              className="btn-secondary text-sm"
            >
              <Download className="w-4 h-4 mr-1" />
              Export
            </button>
            <button
              onClick={handleCreateReservation}
              className="btn-primary text-sm"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Reservation
            </button>
          </div>
        </div>

        {/* Enhanced Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="invited">Invited</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Property
            </label>
            <select
              value={filters.propertyId}
              onChange={(e) => handleFilterChange('propertyId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Properties</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Room Type
            </label>
            <select
              value={filters.roomTypeId}
              onChange={(e) => handleFilterChange('roomTypeId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              disabled={!filters.propertyId}
            >
              <option value="">All Room Types</option>
              {roomTypes.map((roomType) => (
                <option key={roomType.id} value={roomType.id}>
                  {roomType.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Check-in Date
            </label>
            <input
              type="date"
              value={filters.checkInDate}
              onChange={(e) => handleFilterChange('checkInDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={filters.checkInDateFrom}
              onChange={(e) => handleFilterChange('checkInDateFrom', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={filters.checkInDateTo}
              onChange={(e) => handleFilterChange('checkInDateTo', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="flex justify-between items-center">
          <button
            onClick={clearFilters}
            className="text-sm text-gray-600 hover:text-gray-800 flex items-center"
          >
            <Filter className="w-4 h-4 mr-1" />
            Clear Filters
          </button>
          <p className="text-sm text-gray-600">
            {reservations.length} reservation{reservations.length !== 1 ? 's' : ''} found
          </p>
        </div>
      </div>

      {/* Enhanced Reservations Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="large" />
          </div>
        ) : reservations.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Booking & Guest
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Property & Accommodation
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dates & Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Guests
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reservations.map((reservation) => (
                  <React.Fragment key={reservation.id}>
                    <tr 
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => toggleRowExpansion(reservation.id)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        {renderGuestInfo(reservation)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {renderPropertyHierarchy(reservation)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm text-gray-900">
                            <Calendar className="w-4 h-4 inline mr-1" />
                            {new Date(reservation.check_in_date).toLocaleDateString()}
                          </div>
                          <div className="text-sm text-gray-500">
                            to {new Date(reservation.check_out_date).toLocaleDateString()}
                          </div>
                          <div className="text-sm text-gray-500">
                            {Math.ceil((new Date(reservation.check_out_date) - new Date(reservation.check_in_date)) / (1000 * 60 * 60 * 24))} nights
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <Users className="w-4 h-4 mr-1" />
                          {reservation.num_guests || 1}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          ${reservation.total_amount || 0}
                        </div>
                        <div className="text-sm text-gray-500">
                          {reservation.currency || 'USD'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleRowExpansion(reservation.id)
                            }}
                            className="text-gray-600 hover:text-primary-900"
                            title="Toggle Details"
                          >
                            {expandedRows[reservation.id] ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEditReservation(reservation)
                            }}
                            className="text-gray-600 hover:text-primary-900"
                            title="Edit Reservation"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          
                          {reservation.status === 'pending' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleSendInvitation(reservation.id)
                              }}
                              className="text-primary-600 hover:text-primary-900"
                              title="Send Check-in Invitation"
                            >
                              <Mail className="w-4 h-4" />
                            </button>
                          )}
                          
                          {reservation.check_in_token && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleCopyCheckinUrl(reservation)
                                }}
                                className="text-blue-600 hover:text-blue-900"
                                title="Copy Check-in URL"
                              >
                                {copiedTokens[reservation.id] ? (
                                  <Check className="w-4 h-4" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openCheckinPage(reservation)
                                }}
                                className="text-green-600 hover:text-green-900"
                                title="Open Check-in Page"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {renderExpandedDetails(reservation)}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No reservations found</p>
            <p className="text-sm text-gray-400 mt-2">
              Try adjusting your filters or create a test reservation
            </p>
          </div>
        )}

        {/* Pagination */}
        {reservations.length > 0 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(prev => prev + 1)}
                disabled={!hasMore}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Page <span className="font-medium">{currentPage}</span>
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    disabled={!hasMore}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reservation Modal */}
      {showReservationModal && (
        <ReservationModal
          reservation={editingReservation}
          properties={properties}
          onSave={handleSaveReservation}
          onClose={() => {
            setShowReservationModal(false)
            setEditingReservation(null)
          }}
        />
      )}
    </div>
  )
}
