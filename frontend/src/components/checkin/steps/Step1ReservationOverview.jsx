import { Calendar, MapPin, Users, Home, Clock, CheckCircle, Edit, AlertTriangle } from 'lucide-react'
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
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Welcome, {reservation.guestName}!
        </h2>
        {checkinCompleted && !isModificationMode ? (
          <p className="text-green-600 font-medium">
            Your check-in has been completed
          </p>
        ) : isModificationMode ? (
          <p className="text-orange-600 font-medium">
            You are modifying your check-in information
          </p>
        ) : (
          <p className="text-gray-600">
            Let's get you checked in for your upcoming stay
          </p>
        )}
      </div>

      {/* Check-in Completion Status */}
      {checkinCompleted && !isModificationMode && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
          <div className="flex items-start">
            <CheckCircle className="w-6 h-6 text-green-600 mr-3 mt-1" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-green-900 mb-2">
                Check-in Complete!
              </h3>
              <div className="space-y-2 text-green-800">
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
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {guestData?.adminVerified ? 'Verified by Admin' : 'Pending Review'}
                  </span>
                </p>
              </div>
              
              <div className="mt-4 flex gap-3">
                <button
                  onClick={onEnterModificationMode}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Modify Check-in
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modification Mode Warning */}
      {isModificationMode && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 mb-8">
          <div className="flex items-start">
            <AlertTriangle className="w-6 h-6 text-orange-600 mr-3 mt-1" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-orange-900 mb-2">
                Modification Mode
              </h3>
              <p className="text-orange-800 mb-4">
                You are now modifying your existing check-in information. Any changes you make will overwrite your previously submitted data.
              </p>
              <button
                onClick={onExitModificationMode}
                className="inline-flex items-center px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Cancel Modification
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reservation Details Card */}
      <div className="bg-primary-50 border border-primary-200 rounded-lg p-6 mb-8">
        <h3 className="text-lg font-semibold text-primary-900 mb-4">
          Your Reservation Details
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Check-in Information */}
          <div className="space-y-4">
            <div className="flex items-center">
              <Calendar className="w-5 h-5 text-primary-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-900">Check-in Date</p>
                <p className="text-lg text-primary-700">
                  {checkInDate.toLocaleDateString('en-US', {
                    weekday: 'long',
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
                <p className="text-lg text-primary-700">
                  {checkOutDate.toLocaleDateString('en-US', {
                    weekday: 'long',
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
                <p className="text-lg text-primary-700">
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
                <p className="text-sm font-medium text-gray-900">Room</p>
                <p className="text-lg text-primary-700">
                  Room {reservation.roomNumber}
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <MapPin className="w-5 h-5 text-primary-600 mr-3 mt-1" />
              <div>
                <p className="text-sm font-medium text-gray-900">Duration</p>
                <p className="text-lg text-primary-700">
                  {nights} {nights === 1 ? 'Night' : 'Nights'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* What's Next - only show for fresh check-ins or modification mode */}
      {(!checkinCompleted || isModificationMode) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h4 className="text-lg font-semibold text-blue-900 mb-2">
            {isModificationMode ? "Modify Your Information" : "What's Next?"}
          </h4>
          <p className="text-blue-800 mb-4">
            {isModificationMode 
              ? "You can update any of your previously submitted information. All fields will be pre-filled with your current data."
              : "To complete your check-in, we'll need to collect some information and documents. This process should take just a few minutes and will help ensure a smooth arrival."
            }
          </p>
          <ul className="text-blue-700 space-y-1">
            <li>• {isModificationMode ? "Update" : "Verify"} your personal information</li>
            <li>• {isModificationMode ? "Replace" : "Upload"} a photo of your passport or ID</li>
            <li>• Review and accept our guest agreement</li>
          </ul>
        </div>
      )}

      {/* Important Information - only show for fresh check-ins or modification mode */}
      {(!checkinCompleted || isModificationMode) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8">
          <h4 className="text-sm font-semibold text-yellow-900 mb-2">
            Important Information
          </h4>
          <p className="text-yellow-800 text-sm">
            Please ensure you have a valid government-issued photo ID (passport, driver's license, 
            or national ID card) ready to upload during the check-in process.
          </p>
        </div>
      )}

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
