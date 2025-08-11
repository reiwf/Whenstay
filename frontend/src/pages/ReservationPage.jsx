import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  RefreshCw, 
  Calendar, 
  PlaneLanding,
  PlaneTakeoff,
  MoonStar,
  Edit,
  Plus,
  Copy,
  ExternalLink,
  Check,
  Building,
  Home,
  Bed,
  Mail
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import DashboardLayout from '../components/layout/DashboardLayout'
import { DataTableAdvanced } from '../components/ui'
import { DateRangePicker } from '../components/ui/date-range-picker'
import toast from 'react-hot-toast'
import ReservationModal from '../components/modals/ReservationModal'
import useReservations from '../hooks/useReservations'

const tokyoTodayYMD = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });

export default function ReservationPage() {
  const { hasAdminAccess, profile } = useAuth()
  const navigate = useNavigate()
  
  const {
    loading,
    reservations,
    currentPage,
    loadReservations,
    updateReservation,
    createReservation,
    sendInvitation,
    setCurrentPage
  } = useReservations()

  
  // Date range state - separate from the problematic DataTableAdvanced component
  const [dateRange, setDateRange] = useState({
    from: null,
    to: null
  })

  // Safe date range handler to ensure we always have an object
  const handleDateRangeChange = (range) => {
    if (range === undefined || range === null) {
      setDateRange({ from: null, to: null })
    } else {
      setDateRange(range)
    }
  }
  const [showReservationModal, setShowReservationModal] = useState(false)
  const [editingReservation, setEditingReservation] = useState(null)
  const [copiedTokens, setCopiedTokens] = useState({})
  const filterTimeoutRef = useRef(null)

  // Navigation handler for sidebar
  const handleSectionChange = (section) => {
    if (section === 'dashboard') {
      navigate('/dashboard')
    } else if (section === 'reservation-management') {
      // Already on reservation page
      return
    } else if (section === 'reservations') {
      navigate('/dashboard') // Go to dashboard reservations tab
    } else {
      navigate('/dashboard') // Default fallback
    }
  }

  // Load initial data
  useEffect(() => {
    if (hasAdminAccess()) {
      loadReservationsWithFilters(undefined, 1, { defaultToToday: true });
    }
  }, [hasAdminAccess, loadReservations]);


  // Clean helper function to load reservations with date filters
  const loadReservationsWithFilters = (
      dateRangeToUse = dateRange,
      page = currentPage,
      opts = { defaultToToday: true } // 👈 default Tokyo today when empty
    ) => {
      let from, to;

      if (dateRangeToUse?.from) {
        from = dateRangeToUse.from.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
        to   = (dateRangeToUse.to || dateRangeToUse.from).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
      } else if (opts.defaultToToday) {
        const t = tokyoTodayYMD();
        from = t; to = t;
      }

      const apiParams = {
        ...(from && { checkInDateFrom: from, checkInDateTo: to }),
      };

      // Debug (remove later)
      console.log('Filtering with (Tokyo):', apiParams);

      loadReservations(apiParams, page);
    };

    const applyDateFilter = () => {
    setCurrentPage(1);
    // user picked explicit dates → don't override with today
    loadReservationsWithFilters(dateRange, 1, { defaultToToday: false })
  }

    const clearDateFilter = () => {
    const cleared = { from: null, to: null };
    setDateRange(cleared);
    setCurrentPage(1);
    // cleared → go back to Tokyo today
    loadReservationsWithFilters(cleared, 1, { defaultToToday: true })
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
      await loadReservationsWithFilters(dateRange, currentPage)
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

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'invited': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const renderGuestInfo = (reservation) => {
    const bookingName = reservation.booking_name || reservation.guest_name
    const bookingLastname = reservation.booking_lastname || ''
    const fullName = bookingLastname ? `${bookingName} ${bookingLastname}` : bookingName
    
    return (
      <div className="space-y-1">
        <div className="text-sm font-medium text-gray-900">
          {fullName}
        </div>
        <div className="text-sm text-gray-500">
          {reservation.booking_email || reservation.guest_email}
        </div>
      </div>
    )
  }

  const renderPropertyHierarchy = (reservation) => {
    const hasV5Structure = reservation.room_type_name || reservation.unit_number
    
    const getPropertyName = () => {
      if (reservation.property_name && reservation.property_name !== 'N/A' && reservation.property_name !== 'Property Information Unavailable') {
        return reservation.property_name
      }
      return 'Property Information Unavailable'
    }

    const getRoomInfo = () => {
      if (hasV5Structure) {
        return {
          roomType: reservation.room_type_name || 'Standard Room',
          unitNumber: reservation.unit_number,
          description: reservation.room_type_description
        }
      } else {
        return {
          roomNumber: reservation.room_number && reservation.room_number !== 'N/A' ? reservation.room_number : 'TBD',
          roomName: reservation.room_name && reservation.room_name !== 'N/A' ? reservation.room_name : null
        }
      }
    }

    const propertyName = getPropertyName()
    const roomInfo = getRoomInfo()
    
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
              <Home className="w-4 h-4 mr-1 text-gray-500" />
              <span className="mr-1">{roomInfo.roomType}</span>
              <Bed className="w-4 h-4 ml-2 mr-1 text-gray-500" />
              {roomInfo.unitNumber && <span className="mr-1">{roomInfo.unitNumber}</span>}
            </div>
          )}
        </div>
      )
    } else {
      return (
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-900 flex items-center">
            <Building className="w-4 h-4 mr-1 text-gray-500" />
            <span className={propertyName === 'Property Information Unavailable' ? 'text-gray-500 italic' : ''}>
              {propertyName}
            </span>
          </div>
          <div className="text-sm text-gray-600 flex items-center ml-5">
            <span className={roomInfo.roomNumber === 'TBD' ? 'text-gray-500 italic' : ''}>
              Room {roomInfo.roomNumber}
            </span>
            {roomInfo.roomName && ` - ${roomInfo.roomName}`}
          </div>
        </div>
      )
    }
  }

  // Define columns for the reservations table
  
  const columns = useMemo(() => [
    {
      accessorKey: 'guest_info',
      header: 'Booking Name & Lastname',
      cell: ({ row }) => renderGuestInfo(row.original),
    },
    {
      accessorKey: 'property_info',
      header: 'Property & Room',
      cell: ({ row }) => renderPropertyHierarchy(row.original),
    },
    {
      accessorKey: 'check_in_duration',
      header: 'Check-in Duration',
      cell: ({ row }) => {
        const reservation = row.original
        const nights = Math.ceil((new Date(reservation.check_out_date) - new Date(reservation.check_in_date)) / (1000 * 60 * 60 * 24))
        return (
          <div className="space-y-1">
        {/* First row: Check-in → Check-out */}
        <div className="text-sm text-gray-900 flex items-center">
          <PlaneLanding className="w-4 h-4 mr-1" />
          {new Date(reservation.check_in_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })}
          <span className="mx-2 text-gray-500">→</span>
          <PlaneTakeoff className="w-4 h-4 mr-1" />
          {new Date(reservation.check_out_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })}
          
        </div>
      
        {/* Second row: Nights */}
        <div className="text-sm text-gray-500 flex items-center">
          <MoonStar className="w-4 h-4 mr-1" />
          {nights} night{nights > 1 ? 's' : ''}
        </div>
      </div>
        )
      },
    },
    {
      accessorKey: 'total_amount',
      header: 'Amount',
      cell: ({ getValue, row }) => {
        const amount = Number(getValue() || 0)

        return (
          <div>
            <div className="text-sm font-medium text-gray-900">
              {amount.toLocaleString()}               
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'access_read',
      header: 'Access Read',
      cell: ({ getValue }) => (
        <div className="flex items-center">
          {getValue() ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <span className="w-4 h-4 text-gray-300">-</span>
          )}
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const reservation = row.original
        return (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleEditReservation(reservation)}
              className="text-gray-500 hover:text-primary-600"
              title="View/Modify Reservation"
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
        )
      },
    },
  ], [copiedTokens, handleEditReservation, handleSendInvitation, handleCopyCheckinUrl, openCheckinPage])

  // Since we removed all filters except date range, we just use reservations directly
  const filteredReservations = reservations

  // Define searchable fields for enhanced search
  const searchableFields = useMemo(() => [
    'booking_name',
    'booking_lastname', 
    'guest_firstname', 
    'guest_lastname',
    'guest_email',
    'booking_email',
    'property_name',
    'room_type_name',
    'room_name',
    'unit_number',
    'room_number',
    {
      combiner: (row) => {
        const bookingName = row.booking_name || row.guest_name || ''
        const bookingLastname = row.booking_lastname || ''
        const guestName = row.guest_firstname && row.guest_lastname 
          ? `${row.guest_firstname} ${row.guest_lastname}`.trim()
          : ''
        return [bookingName, bookingLastname, guestName].filter(Boolean).join(' ')
      }
    },
    {
      combiner: (row) => {
        const parts = []
        if (row.property_name && row.property_name !== 'N/A' && row.property_name !== 'Property Information Unavailable') {
          parts.push(row.property_name)
        }
        if (row.room_type_name) {
          parts.push(row.room_type_name)
        }
        if (row.unit_number) {
          parts.push(`Unit ${row.unit_number}`)
        } else if (row.room_number && row.room_number !== 'N/A') {
          parts.push(`Room ${row.room_number}`)
        }
        if (row.room_name && row.room_name !== 'N/A') {
          parts.push(row.room_name)
        }
        return parts.join(' ')
      }
    }
  ], [])

  return (
    <DashboardLayout
      activeSection="reservation-management"
      onSectionChange={handleSectionChange}
      pageTitle="Reservation Management"
      pageSubtitle="Manage guest reservations and search by date range"
      pageAction={
        <div className="flex space-x-2">
          <button
            onClick={() => loadReservationsWithFilters(dateRange, currentPage)}
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
      }
    >
      <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Date Range Filter */}
        <div className="card">
          

          <div className="flex flex-col gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Date
              </label>
              <DateRangePicker
                dateRange={dateRange}
                onDateRangeChange={handleDateRangeChange}
                placeholder="Select check-in date range"
                className="w-full"
                showClear={true}
              />
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={applyDateFilter}
                className="btn-ghost border text-sm"
                disabled={!dateRange.from}
              >
                Apply Filter
              </button>
              
              {(dateRange.from || dateRange.to) && (
                <button
                  onClick={clearDateFilter}
                  className="btn-ghost border text-sm"
                >
                  Clear Filter
                </button>
              )}
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
          pageSize={10}
          emptyMessage="No reservations found. Try adjusting your filters or date range."
          emptyIcon={Calendar}
          className="w-full"
          searchableFields={searchableFields}
        />

        {/* Reservation Modal */}
        {showReservationModal && (
          <ReservationModal
            reservation={editingReservation}
            properties={[]}
            onSave={handleSaveReservation}
            onClose={() => {
              setShowReservationModal(false)
              setEditingReservation(null)
            }}
          />
        )}
      </div>
    </DashboardLayout>
  )
}
