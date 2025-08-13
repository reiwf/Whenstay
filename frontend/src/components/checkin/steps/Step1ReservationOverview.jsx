import { Calendar, MapPin, Users, Home, Clock, CheckCircle, Edit, AlertTriangle, ExternalLink } from 'lucide-react'
import { useParams } from 'react-router-dom'
import StepNavigation from '../shared/StepNavigation'

export default function Step1ReservationOverview({ 
  reservation, 
  onNext, 
  checkinCompleted, 
  existingCheckin, 
  guestData, 
  isModificationMode, 
  onEnterModificationMode, 
  onExitModificationMode 
}) {
  const { token } = useParams()

  console.log('Reservation data:', reservation)
  if (!reservation) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Loading reservation details...</p>
      </div>
    )
  }

  const checkInDate = new Date(reservation.checkInDate)
  const checkOutDate = new Date(reservation.checkOutDate)
  const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24))

  // Format submission date if available
  const submissionDate = guestData?.submittedAt ? new Date(guestData.submittedAt) : null

  return (
    <div>
      {/* Header - changes based on state */}
      <div className="text-center mb-2">
        <h2 className="text-xl font-bold text-primary-900 mb-2">
          Welcome, {reservation.guestName}!
        </h2>
        {checkinCompleted && !isModificationMode ? (
          <p className="text-primary-600 font-medium">
            Your check-in has been completed
          </p>
        ) : isModificationMode ? (
          <p className="text-primary-600 font-medium">
            You are modifying your check-in information
          </p>
        ) : (
          <p className="text-primary-600">
            Let's complete your online register
          </p>
        )}
      </div>

      {/* Check-in Completion Status */}
      {checkinCompleted && !isModificationMode && (
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-6 mb-8 relative">
          {/* Resubmit button in top right */}
          <button
            onClick={onEnterModificationMode}
            className="absolute top-4 right-4 inline-flex items-center px-3 py-1.5 border border-primary-300 bg-primary-200 text-primary-900 text-xs font-medium rounded-md hover:bg-primary-500 focus:outline-none focus:ring-1 focus:ring-offset-2 focus:ring-primary-500"
          >
            <Edit className="w-3 h-3 mr-1" />
            Modify Info
          </button>
          
          <div className="flex items-start pr-20">
            <CheckCircle className="w-6 h-6 text-primary-600 mr-3 mt-1" />
            <div className="flex-1">
              <h3 className="text-l font-semibold text-primary-900 mb-2">
                Check-in Complete!
              </h3>
              <div className="space-y-2 text-primary-800">
                <p>
                  <strong>Guest Name:</strong> {guestData?.firstName} {guestData?.lastName}
                </p>
                <p>
                  <strong>Contact:</strong> {guestData?.personalEmail}
                </p>
                {submissionDate && (
                  <p>
                    <strong>Submitted:</strong> {submissionDate.toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                )}
                <p>
                  <strong>Status:</strong> 
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                    guestData?.adminVerified 
                      ? 'bg-primary-100 text-primary-800' 
                      : 'bg-primary-100 text-primary-800'
                  }`}>
                    {guestData?.adminVerified ? 'Verified by Admin' : 'Pending Review'}
                  </span>
                </p>
              </div>
              
              <div className="mt-4">
                <button
                  onClick={() => window.location.href = `/guest/${token}`}
                  className="inline-flex items-center px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 focus:outline-none focus:ring-1 focus:ring-offset-2 focus:ring-primary-500"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Go to Guest Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modification Mode Warning */}
      {isModificationMode && (
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-6 mb-8">
          <div className="flex items-start">
            <AlertTriangle className="w-6 h-6 text-primary-600 mr-3 mt-1" />
            <div className="flex-1">
              <h3 className="text-l font-semibold text-primary-900 mb-2">
                Modification Mode
              </h3>
              <p className="text-primary-800 mb-4">
                You are now modifying your existing check-in information. Any changes you make will overwrite your previously submitted data.
              </p>
              <button
                onClick={onExitModificationMode}
                className="inline-flex items-center px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 focus:outline-none focus:ring-1 focus:ring-offset-2 focus:ring-primary-500"
              >
                Cancel Modification
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reservation Details Card */}
      <div className="bg-primary-50 border border-primary-200 rounded-lg p-6 mb-8">
        <h3 className="text-l font-semibold text-primary-900 mb-4">
          Your Reservation Details
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Check-in Information */}
          <div className="space-y-4">
            <div className="flex items-center">
              <Calendar className="w-5 h-5 text-primary-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-900">Check-in Date</p>
                <p className="text-l text-primary-700">
                  {checkInDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-center">
              <Clock className="w-5 h-5 text-primary-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-900">Check-out Date</p>
                <p className="text-l text-primary-700">
                  {checkOutDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-center">
              <Users className="w-5 h-5 text-primary-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-900">Guests</p>
                <p className="text-l text-primary-700">
                  {reservation.numGuests} {reservation.numGuests === 1 ? 'Guest' : 'Guests'}
                </p>
              </div>
            </div>
          </div>

          {/* Property Information */}
          <div className="space-y-4">
            <div className="flex items-start">
              <Home className="w-5 h-5 text-primary-600 mr-3 mt-1" />
              <div>
                <p className="text-sm font-medium text-gray-900">Property</p>
                <p className="text-l text-primary-700">
                  {reservation.propertyName || 'Property Name'}
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <MapPin className="w-5 h-5 text-primary-600 mr-3 mt-1" />
              <div>
                <p className="text-sm font-medium text-gray-900">Room</p>
                <p className="text-l text-primary-700">
                  {reservation.roomTypeName || reservation.roomTypes}
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <Clock className="w-5 h-5 text-primary-600 mr-3 mt-1" />
              <div>
                <p className="text-sm font-medium text-gray-900">Duration</p>
                <p className="text-l text-primary-700">
                  {nights} {nights === 1 ? 'Night' : 'Nights'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Room Details - show if available */}
        {(reservation.roomTypeDescription || reservation.bedConfiguration || reservation.roomSizeSqm || reservation.hasBalcony || reservation.hasKitchen) && (
          <div className="mt-6 pt-6 border-t border-primary-200">
            <h4 className="text-md font-semibold text-primary-900 mb-3">
              Room Features
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reservation.roomTypeDescription && (
                <div>
                  <p className="text-sm font-medium text-primary-900">Description</p>
                  <p className="text-sm text-primary-700">{reservation.roomTypeDescription}</p>
                </div>
              )}
              
              {reservation.bedConfiguration && (
                <div>
                  <p className="text-sm font-medium text-primary-900">Bed Configuration</p>
                  <p className="text-sm text-primary-700">{reservation.bedConfiguration}</p>
                </div>
              )}
              
              {reservation.roomSizeSqm && (
                <div>
                  <p className="text-sm font-medium text-primary-900">Room Size</p>
                  <p className="text-sm text-primary-700">{reservation.roomSizeSqm} sq m</p>
                </div>
              )}
              
              {reservation.maxGuests && (
                <div>
                  <p className="text-sm font-medium text-primary-900">Maximum Guests</p>
                  <p className="text-sm text-primary-700">{reservation.maxGuests} guests</p>
                </div>
              )}
            </div>
            
            {/* Room Amenities */}
            {(reservation.hasBalcony || reservation.hasKitchen) && (
              <div className="mt-3">
                <p className="text-sm font-medium text-gray-900 mb-2">Amenities</p>
                <div className="flex flex-wrap gap-2">
                  {reservation.hasBalcony && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Balcony
                    </span>
                  )}
                  {reservation.hasKitchen && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Kitchen
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

{/* Important Information */}
<div className="bg-primary-200 border border-primary-300 rounded-lg p-4 mt-4">
  <h4 className="text-lg font-semibold text-red-900 mb-2">
    Important Information
  </h4>
  <p className="text-red-800 text-m">
    Guests must complete the online check-in in order to receive the access code to enter the apartment.
  </p>
</div>


      <StepNavigation
        currentStep={1}
        totalSteps={4}
        onNext={onNext}
        nextButtonText={
          checkinCompleted && !isModificationMode 
            ? "View Details" 
            : isModificationMode 
              ? "Continue Modification" 
              : "Start Check-in"
        }
        showPrevious={false}
        disabled={checkinCompleted && !isModificationMode}
      />
    </div>
  )
}
