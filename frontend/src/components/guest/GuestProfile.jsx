import { useState, useEffect } from 'react'
import { FileText, Download, Calendar, MapPin, Users, CreditCard, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import LoadingSpinner from '../LoadingSpinner'

const GuestProfile = ({ guestToken }) => {
  const [guestProfile, setGuestProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [downloadingInvoice, setDownloadingInvoice] = useState(null)

  useEffect(() => {
    loadGuestProfile()
  }, [guestToken])

  const loadGuestProfile = async () => {
    try {
      setLoading(true)
      
      if (!guestToken) {
        toast.error('Invalid guest token')
        return
      }

      const response = await fetch(`/api/guest/${guestToken}/profile`)
      
      if (!response.ok) {
        if (response.status === 404) {
          toast.error('Guest profile not found')
        } else {
          toast.error('Failed to load guest profile')
        }
        return
      }

      const profileData = await response.json()
      setGuestProfile(profileData)
      
    } catch (error) {
      console.error('Error loading guest profile:', error)
      toast.error('Failed to load guest profile')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status, isCurrent = false) => {
    if (isCurrent) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          <Clock className="w-3 h-3 mr-1" />
          Current Stay
        </span>
      )
    }

    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </span>
        )
      case 'confirmed':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Confirmed
          </span>
        )
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <AlertCircle className="w-3 h-3 mr-1" />
            Cancelled
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            <Clock className="w-3 h-3 mr-1" />
            {status}
          </span>
        )
    }
  }

  const calculateTotalWithServices = (reservation) => {
    let total = reservation.total_amount || 0
    
    // Add accommodation tax if paid
    if (reservation.accommodation_tax && reservation.accommodation_tax.status === 'paid') {
      total += reservation.accommodation_tax.amount || 0
    }
    
    // Add services total
    if (reservation.services && reservation.services.length > 0) {
      const servicesTotal = reservation.services.reduce((sum, service) => sum + (service.amount || 0), 0)
      total += servicesTotal
    }
    
    return total
  }

  const handleDownloadInvoice = async (reservationId) => {
    try {
      setDownloadingInvoice(reservationId)
      
      // Mock download functionality
      // In a real implementation, this would call: /api/guest/${guestToken}/reservations/${reservationId}/invoice
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API call
      
      toast.success('Invoice download started!', {
        icon: '📄',
        duration: 3000
      })
      
      // Here you would normally trigger the actual file download
      // For now, we'll just show a success message
      
    } catch (error) {
      console.error('Error downloading invoice:', error)
      toast.error('Failed to download invoice')
    } finally {
      setDownloadingInvoice(null)
    }
  }

  const formatDateRange = (checkIn, checkOut) => {
    const startDate = new Date(checkIn)
    const endDate = new Date(checkOut)
    const nights = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))
    
    return {
      dateRange: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
      nights: nights
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="large" />
      </div>
    )
  }

  // Check if guest profile exists before rendering
  if (!guestProfile) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Guest Data</h3>
          <p className="text-gray-500">Unable to load guest profile information.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Guest Profile</h2>
            <p className="text-sm text-gray-600 mt-1">
              Welcome back, {guestProfile.guestInfo?.displayName || 'Guest'}!
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Total Reservations</p>
            <p className="text-2xl font-bold text-primary-600">{guestProfile.statistics?.totalReservations || 0}</p>
          </div>
        </div>
      </div>

      {/* Guest Information */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Name</p>
            <p className="font-medium text-gray-900">
              {guestProfile.guestInfo?.displayName || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Email</p>
            <p className="font-medium text-gray-900">{guestProfile.guestInfo?.email || 'N/A'}</p>
          </div>
          {guestProfile.guestInfo?.phone && (
            <div>
              <p className="text-sm text-gray-600">Phone</p>
              <p className="font-medium text-gray-900">{guestProfile.guestInfo.phone}</p>
            </div>
          )}
          <div>
            <p className="text-sm text-gray-600">Guest ID</p>
            <p className="font-medium text-gray-900 font-mono">{guestToken}</p>
          </div>
        </div>
      </div>

      {/* Current Stay (if applicable) */}
      {guestProfile.currentReservation && (
        <div className="card bg-blue-50 border-blue-200">
          <div className="flex items-start">
            <Clock className="w-5 h-5 text-blue-600 mr-3 mt-1 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-base font-semibold text-blue-900 mb-2">Current Stay</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-blue-700 font-medium">{guestProfile.currentReservation.properties?.name || 'Property'}</p>
                  <p className="text-blue-600">{guestProfile.currentReservation.room_units?.room_types?.name || 'Room'}</p>
                </div>
                <div>
                  <p className="text-blue-600">
                    {new Date(guestProfile.currentReservation.check_in_date).toLocaleDateString()} - {new Date(guestProfile.currentReservation.check_out_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reservation History */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Reservation History</h3>
          <span className="text-sm text-gray-500">{guestProfile.reservationHistory?.length || 0} reservations</span>
        </div>

        <div className="space-y-4">
          {guestProfile.reservationHistory?.map((reservation, index) => {
            const { dateRange, nights } = formatDateRange(reservation.check_in_date, reservation.check_out_date)
            const totalWithServices = calculateTotalWithServices(reservation)
            
            const isCurrentStay = guestProfile.currentReservation?.id === reservation.id

            return (
              <div key={reservation.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold text-gray-900">{reservation.properties?.name || 'Property'}</h4>
                      {getStatusBadge(reservation.status, isCurrentStay)}
                    </div>
                    <p className="text-sm text-gray-600">{reservation.room_units?.room_types?.name || 'Room'}</p>
                  </div>
                  
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-lg text-gray-900">
                      ¥{totalWithServices.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">{reservation.currency || 'JPY'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="w-4 h-4 mr-2" />
                    <span>{dateRange}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Clock className="w-4 h-4 mr-2" />
                    <span>{nights} {nights === 1 ? 'night' : 'nights'}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Users className="w-4 h-4 mr-2" />
                    <span>{reservation.num_guests} {reservation.num_guests === 1 ? 'guest' : 'guests'}</span>
                  </div>
                </div>

                {/* Breakdown of charges */}
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <h5 className="text-sm font-medium text-gray-900 mb-2">Charges Breakdown</h5>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Room charges</span>
                      <span className="text-gray-900">¥{(reservation.total_amount || 0).toLocaleString()}</span>
                    </div>
                    
                    {reservation.accommodation_tax && reservation.accommodation_tax.status === 'paid' && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Accommodation tax</span>
                        <span className="text-gray-900">¥{reservation.accommodation_tax.amount.toLocaleString()}</span>
                      </div>
                    )}
                    
                    {reservation.services && reservation.services.length > 0 && (
                      <>
                        {reservation.services.map((service, serviceIndex) => (
                          <div key={serviceIndex} className="flex justify-between">
                            <span className="text-gray-600">{service.service_name}</span>
                            <span className="text-gray-900">¥{service.amount.toLocaleString()}</span>
                          </div>
                        ))}
                      </>
                    )}
                    
                    <div className="border-t pt-1 mt-2">
                      <div className="flex justify-between font-medium">
                        <span className="text-gray-900">Total</span>
                        <span className="text-gray-900">¥{totalWithServices.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    Booking ID: {reservation.beds24_booking_id || reservation.id}
                  </div>
                  
                  <button
                    onClick={() => handleDownloadInvoice(reservation.id)}
                    disabled={downloadingInvoice === reservation.id}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {downloadingInvoice === reservation.id ? (
                      <>
                        <LoadingSpinner size="small" className="mr-2" />
                        Downloading...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Download Invoice
                      </>
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Help & Support */}
      <div className="card bg-primary-50 border-primary-200">
        <div className="flex items-start">
          <FileText className="w-5 h-5 text-primary-600 mr-3 mt-1 flex-shrink-0" />
          <div>
            <h3 className="text-base font-semibold text-primary-900 mb-2">Need Help?</h3>
            <p className="text-sm text-primary-700 mb-3">
              If you have any questions about your reservation or need assistance, feel free to contact us.
            </p>
            <button className="text-sm font-medium text-primary-600 hover:text-primary-700">
              Contact Support →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GuestProfile
