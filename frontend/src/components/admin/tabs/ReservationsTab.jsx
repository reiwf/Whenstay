import { useState, useEffect } from '../../../../$node_modules/@types/react/index.js'
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
  Check
} from '../../../../$node_modules/lucide-react/dist/lucide-react.js'
import { adminAPI } from '../../../services/api'
import toast from '../../../../$node_modules/react-hot-toast/dist/index.js'
import LoadingSpinner from '../../LoadingSpinner'
import ReservationModal from '../modals/ReservationModal'
import useReservations from '../../../hooks/useReservations'

export default function ReservationsTab() {
  const {
    loading,
    reservations,
    stats,
    currentPage,
    hasMore,
    loadReservations,
    updateReservation,
    createReservation,
    sendInvitation,
    setCurrentPage
  } = useReservations()

  const [properties, setProperties] = useState([])
  const [filters, setFilters] = useState({
    status: '',
    propertyId: '',
    checkInDateFrom: '',
    checkInDateTo: '',
    checkInDate: ''
  })
  const [showReservationModal, setShowReservationModal] = useState(false)
  const [editingReservation, setEditingReservation] = useState(null)
  const [copiedTokens, setCopiedTokens] = useState({})

  useEffect(() => {
    loadReservations(filters)
    loadProperties()
  }, [])

  useEffect(() => {
    loadReservations(filters, currentPage)
  }, [filters, currentPage])

  const loadProperties = async () => {
    try {
      const response = await adminAPI.getProperties(true) // Load with rooms
      setProperties(response.data.properties)
    } catch (error) {
      console.error('Error loading properties:', error)
    }
  }

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setCurrentPage(1) // Reset to first page when filters change
  }

  const clearFilters = () => {
    setFilters({
      status: '',
      propertyId: '',
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

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'invited': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0)
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="card text-center">
            <p className="text-2xl font-bold text-gray-900">{stats.totalReservations}</p>
            <p className="text-sm text-gray-600">Total</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-yellow-600">{stats.pendingReservations}</p>
            <p className="text-sm text-gray-600">Pending</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.invitedReservations}</p>
            <p className="text-sm text-gray-600">Invited</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-green-600">{stats.completedReservations}</p>
            <p className="text-sm text-gray-600">Completed</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-red-600">{stats.cancelledReservations}</p>
            <p className="text-sm text-gray-600">Cancelled</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-primary-600">{formatCurrency(stats.totalRevenue)}</p>
            <p className="text-sm text-gray-600">Revenue</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-purple-600">{formatCurrency(stats.averageReservationValue)}</p>
            <p className="text-sm text-gray-600">Avg Value</p>
          </div>
        </div>
      )}

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

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
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

      {/* Reservations Table */}
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
                    Guest
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Property & Room
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dates
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Guests
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Check-in
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reservations.map((reservation) => (
                  <tr key={reservation.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {reservation.guest_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {reservation.guest_email}
                        </div>
                        {reservation.guest_phone && (
                          <div className="text-sm text-gray-500">
                            {reservation.guest_phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {reservation.property_name || 'Unknown Property'}
                        </div>
                        <div className="text-sm text-gray-500">
                          Room {reservation.room_number || 'N/A'}
                          {reservation.room_name && ` - ${reservation.room_name}`}
                        </div>
                      </div>
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
                        {formatCurrency(reservation.total_amount)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {reservation.currency || 'USD'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(reservation.status)}`}>
                        {reservation.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {reservation.admin_verified ? (
                        <div className="flex items-center text-green-600">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          <span className="text-sm">Verified</span>
                        </div>
                      ) : reservation.checkin_id ? (
                        <div className="flex items-center text-yellow-600">
                          <Clock className="w-4 h-4 mr-1" />
                          <span className="text-sm">Submitted</span>
                        </div>
                      ) : (
                        <div className="flex items-center text-gray-400">
                          <Clock className="w-4 h-4 mr-1" />
                          <span className="text-sm">Pending</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditReservation(reservation)}
                          className="text-gray-600 hover:text-primary-900"
                          title="Edit Reservation"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        
                        {reservation.status === 'pending' && (
                          <button
                            onClick={() => handleSendInvitation(reservation.id)}
                            className="text-primary-600 hover:text-primary-900"
                            title="Send Check-in Invitation"
                          >
                            <Mail className="w-4 h-4" />
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
                    </td>
                  </tr>
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
