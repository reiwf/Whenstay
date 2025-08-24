import { useState, useEffect } from 'react'
import { FileText, Download, Calendar, MapPin, Users, CreditCard, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import LoadingSpinner from '../LoadingSpinner'
import Section from '../ui/Section'
import { ListGroup, ListRow, PlainGroup }  from '../ui/ListGroup'

const GuestProfile = ({ guestToken }) => {
  const { t } = useTranslation('guest')
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
        console.warn('Guest token is missing')
        return
      }

      const response = await fetch(`/api/guest/${guestToken}/profile`)
      
      if (!response.ok) {
        if (response.status === 404) {
          // Guest profile not found - this is expected for some cases
          console.log('Guest profile not found (404) - showing empty state')
          setGuestProfile(null)
        } else {
          // Other errors should show toast
          console.error('Failed to load guest profile:', response.status, response.statusText)
          toast.error(t('guestProfile.errors.failedToLoad'))
        }
        return
      }

      const profileData = await response.json()
      setGuestProfile(profileData)
      
    } catch (error) {
      console.error('Error loading guest profile:', error)
      toast.error(t('guestProfile.errors.failedToLoad'))
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status, isCurrent = false) => {
    if (isCurrent) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          <Clock className="w-3 h-3 mr-1" />
          {t('guestProfile.status.currentStay')}
        </span>
      )
    }

    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            {t('guestProfile.status.completed')}
          </span>
        )
      case 'confirmed':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            {t('guestProfile.status.confirmed')}
          </span>
        )
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <AlertCircle className="w-3 h-3 mr-1" />
            {t('guestProfile.status.cancelled')}
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
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('guestProfile.errors.noGuestData')}</h3>
          <p className="text-gray-500">{t('guestProfile.errors.unableToLoad')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <Section
        title={t('guestProfile.title')}
        subtitle={t('guestProfile.welcomeBack', { name: guestProfile.guestInfo?.displayName || t('guestProfile.guest') })}
        >
        <div className="text-right text-sm">
          <span className="text-slate-500">{t('guestProfile.totalReservations')}</span>
          <span className="ml-2 font-semibold text-slate-900">
            {guestProfile.statistics?.totalReservations || 0}
          </span>
        </div>
      </Section>

      {/* Guest Information */}
       <Section title={t('guestProfile.contactInformation')}>
          <ListGroup inset>
            <ListRow
              left={<span className="text-slate-600">{t('guestProfile.name')}</span>}
              right={<span className="font-medium">{guestProfile.guestInfo?.displayName || t('guestProfile.notAvailable')}</span>}
            />
            <ListRow
              left={<span className="text-slate-600">{t('guestProfile.email')}</span>}
              right={<span className="font-medium">{guestProfile.guestInfo?.email || t('guestProfile.notAvailable')}</span>}
            />
            {guestProfile.guestInfo?.phone && (
              <ListRow
                left={<span className="text-slate-600">{t('guestProfile.phone')}</span>}
                right={<span className="font-medium">{guestProfile.guestInfo.phone}</span>}
              />
            )}
          </ListGroup>
        </Section>

      {/* Current Stay (if applicable) */}
       {guestProfile.currentReservation && (
        <Section title={t('guestProfile.currentStay')} subtitle={t('guestProfile.ongoingReservation')}>
          <ListGroup inset className="mb-2">
            <ListRow
              left={t('guestProfile.property')}
              right={<span className="font-medium">
                {guestProfile.currentReservation.properties?.name || t('guestProfile.property')}
              </span>}
            />
            <ListRow
              left={t('guestProfile.room')}
              right={<span className="font-medium">
                {guestProfile.currentReservation.room_units?.room_types?.name || t('guestProfile.room')}
              </span>}
            />
            <ListRow
              left={t('guestProfile.dates')}
              right={
                <span className="font-medium">
                  {new Date(guestProfile.currentReservation.check_in_date).toLocaleDateString()}
                  {' – '}
                  {new Date(guestProfile.currentReservation.check_out_date).toLocaleDateString()}
                </span>
              }
            />
          </ListGroup>
        </Section>
      )}
      {/* Reservation History */}
      <Section
   title={t('guestProfile.reservationHistory')}
   subtitle={t('guestProfile.reservationCount', { count: guestProfile.reservationHistory?.length || 0 })}
 >
   <div className="space-y-3">
     {guestProfile.reservationHistory?.map((reservation, index) => {
       const { dateRange, nights } = formatDateRange(reservation.check_in_date, reservation.check_out_date)
       const totalWithServices = calculateTotalWithServices(reservation)
       const isCurrentStay = guestProfile.currentReservation?.id === reservation.id
       return (
         <ListGroup key={reservation.id || index} inset>
           <ListRow
             left={<div className="truncate">
               <div className="font-medium">{reservation.properties?.name || t('guestProfile.property')}</div>
               <div className="text-xs text-slate-500">{reservation.room_units?.room_types?.name || t('guestProfile.room')}</div>
             </div>}
             right={<div className="text-right">
               <div className="font-semibold">¥{(totalWithServices || 0).toLocaleString()}</div>
               <div className="text-[11px] text-slate-500">{t('guestProfile.nightCount', { count: nights })}</div>
             </div>}
           />
           <div className="hairline" />
           <div className="px-4 py-2 text-xs text-slate-600 flex items-center justify-between">
             <span>{dateRange}</span>
             {/* <button
               onClick={() => handleDownloadInvoice(reservation.id)}
               disabled={downloadingInvoice === reservation.id}
               className="text-slate-700 hover:text-slate-900 disabled:opacity-50"
             >
               {downloadingInvoice === reservation.id ? 'Downloading…' : 'Download invoice'}
             </button> */}
           </div>
         </ListGroup>
       )
     })}
   </div>
 </Section>

      {/* Help & Support */}
      {/* <Section title="Need help?" subtitle="Questions about your reservation">
        <PlainGroup>
          <p className="text-sm text-slate-700 mb-3">
            If you have any questions about your reservation or need assistance, feel free to contact us.
          </p>
          <button className="text-sm font-medium text-primary-700">
            Contact support →
          </button>
        </PlainGroup>
      </Section> */}
    </div>
  )
}

export default GuestProfile
