import React, { useState, useEffect, useMemo } from 'react'
import { 
  RefreshCw, 
  Filter, 
  Calendar, 
  PlaneLanding,
  PlaneTakeoff,
  Users, 
  Clock, 
  Mail, 
  Bed,
  Edit,
  Plus,
  Copy,
  ExternalLink,
  Check,
  Building,
  Home,
  Key,
  Wifi,
  MapPin,
  MoonStar,
  User,
  FileText
} from 'lucide-react'
import { DataTableAdvanced, EmptyState } from '../../ui'
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
    roomTypeId: ''
  })
  const [dateFilters, setDateFilters] = useState({
    checkInDate: new Date().toISOString().split('T')[0] // Default to today's date
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
      roomTypeId: ''
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
            <div className="text-sm text-gray-600 flex items-center ml-5">
              <Home className="w-3 h-3 mr-1" />
              {roomInfo.roomType}
              <Bed className="w-3 h-3 ml-1 mr-1" />
              {roomInfo.unitNumber}
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
          <div className="text-sm  flex items-center">
            <Users className="w-3 h-3" />
            {reservation.num_guests || 1} <span className='text-blue-700 ml-1'>{guestName}</span>
          </div>
        )}
        <div className="text-sm text-gray-500">
          {reservation.booking_email || reservation.guest_email}
        </div>
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

  // Define columns for the reservations table
  const columns = useMemo(() => [
    {
      accessorKey: 'guest_info',
      header: 'Guest & Booking',
      cell: ({ row }) => renderGuestInfo(row.original),
    },
    {
      accessorKey: 'property_info',
      header: 'Property & Room',
      cell: ({ row }) => renderPropertyHierarchy(row.original),
    },
    {
      accessorKey: 'check_in_date',
      header: 'Check-in & Duration',
      cell: ({ row }) => {
        const reservation = row.original;
        const nights = Math.ceil((new Date(reservation.check_out_date) - new Date(reservation.check_in_date)) / (1000 * 60 * 60 * 24));
        return (
          <div className="space-y-1">
            <div className="text-sm text-gray-900 flex items-center">
              <PlaneLanding className="w-4 h-4 mr-1" />
              {new Date(reservation.check_in_date).toISOString().split('T')[0]}
            </div>
            <div className="text-sm text-gray-500 flex items-center">
              <PlaneTakeoff className="w-4 h-4 mr-1" />
              {new Date(reservation.check_out_date).toISOString().split('T')[0]}
            </div>
            <div className="text-sm text-gray-500 flex items-center">  
              <MoonStar className="w-4 h-4 mr-1" />            
              {nights}  
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => (
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(getValue())}`}>
          {getValue().replace('_', ' ')}
        </span>
      ),
    },
    {
      accessorKey: 'total_amount',
      header: 'Amount',
      cell: ({ getValue, row }) => (
        <div>
          <div className="text-sm font-medium text-gray-900">
            {getValue() || 0}
          </div>
          <div className="text-sm text-gray-500">
            {row.original.currency || 'JPY'}
          </div>
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const reservation = row.original;
        return (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleEditReservation(reservation)}
              className="text-gray-500 hover:text-primary-600"
              title="Edit Reservation"
            >
              <Edit className="w-4 h-4" />
            </button>
            
            {reservation.status === 'pending' && (
              <button
                onClick={() => handleSendInvitation(reservation.id)}
                className="inline-flex items-center px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
                title="Send Check-in Invitation"
              >
                <Mail className="w-3 h-3 mr-1" />
                Invite
              </button>
            )}
            
            {reservation.check_in_token && (
              <>
                <button
                  onClick={() => handleCopyCheckinUrl(reservation)}
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
                  onClick={() => openCheckinPage(reservation)}
                  className="text-green-600 hover:text-green-900"
                  title="Open Check-in Page"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        );
      },
    },
  ], [copiedTokens, handleEditReservation, handleSendInvitation, handleCopyCheckinUrl, openCheckinPage]);

  // Filter reservations based on current filters (date filtering is now handled by DataTableAdvanced)
  const filteredReservations = useMemo(() => {
    return reservations.filter(reservation => {
      if (filters.status && reservation.status !== filters.status) return false;
      if (filters.propertyId && reservation.property_id !== filters.propertyId) return false;
      if (filters.roomTypeId && reservation.room_type_id !== filters.roomTypeId) return false;
      return true;
    });
  }, [reservations, filters]);

  // Create default date range for today's check-in date
  const defaultDateRange = useMemo(() => {
    const today = new Date()
    return {
      from: today,
      to: today
    }
  }, [])

  // Handle date range changes from DataTableAdvanced
  const handleDateRangeChange = (newDateRange) => {
    // If date range is cleared (null/undefined), reset to today's date
    if (!newDateRange) {
      // The DataTableAdvanced component will handle resetting to defaultDateRange automatically
      // when newDateRange is null/undefined, but we can add any additional logic here if needed
      console.log('Date range cleared, will reset to today')
    } else {
      console.log('Date range changed:', newDateRange)
    }
  }

  // Define searchable fields for enhanced search
  const searchableFields = useMemo(() => [
    // Individual fields
    'booking_name',
    'guest_firstname', 
    'guest_lastname',
    'guest_email',
    'booking_email',
    'property_name',
    'room_type_name',
    'room_name',
    'unit_number',
    'room_number',
    
    // Combined search fields
    {
      combiner: (row) => {
        // Full guest name combination
        const bookingName = row.booking_name || row.guest_name || '';
        const guestName = row.guest_firstname && row.guest_lastname 
          ? `${row.guest_firstname} ${row.guest_lastname}`.trim()
          : '';
        return [bookingName, guestName].filter(Boolean).join(' ');
      }
    },
    {
      combiner: (row) => {
        // Property and room combination
        const parts = [];
        if (row.property_name && row.property_name !== 'N/A' && row.property_name !== 'Property Information Unavailable') {
          parts.push(row.property_name);
        }
        if (row.room_type_name) {
          parts.push(row.room_type_name);
        }
        if (row.unit_number) {
          parts.push(`Unit ${row.unit_number}`);
        } else if (row.room_number && row.room_number !== 'N/A') {
          parts.push(`Room ${row.room_number}`);
        }
        if (row.room_name && row.room_name !== 'N/A') {
          parts.push(row.room_name);
        }
        return parts.join(' ');
      }
    }
  ], []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Reservation Management</h2>
          <p className="text-gray-600">Manage guest reservations and check-ins</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => loadReservations(filters, currentPage)}
            className="btn-secondary"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
          <button
            onClick={handleCreateReservation}
            className="btn-primary"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Reservation
          </button>
        </div>
      </div>

      {/* Enhanced Filters */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            <Filter className="w-5 h-5 inline mr-2" />
            Filters
          </h3>
          <button
            onClick={clearFilters}
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            <RefreshCw className="w-4 h-4 inline mr-1" />
            Clear Filters
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="input-field"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="invited">Invited</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Property</label>
            <select
              value={filters.propertyId}
              onChange={(e) => handleFilterChange('propertyId', e.target.value)}
              className="input-field"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Room Type</label>
            <select
              value={filters.roomTypeId}
              onChange={(e) => handleFilterChange('roomTypeId', e.target.value)}
              className="input-field"
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
        </div>
      </div>

      {/* Reservations Table */}
      <DataTableAdvanced
        data={filteredReservations || []}
        columns={columns}
        loading={loading}
        searchable={true}
        filterable={true}
        exportable={true}
        pageSize={15}
        emptyMessage="No reservations found"
        emptyIcon={Calendar}
        className="w-full"
        searchableFields={searchableFields}
        defaultDateRange={defaultDateRange}
        onDateRangeChange={handleDateRangeChange}
      />

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
