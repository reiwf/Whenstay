import {
  Calendar,
  MapPin,
  Users,
  Home,
  Clock,
  CheckCircle,
  Edit,
  AlertTriangle,
  LayoutPanelLeft,
  Crown,
  Building,
} from 'lucide-react'
import { useParams } from 'react-router-dom'
import StepNavigation from '../shared/StepNavigation'

// NEW
import Section from '../../ui/Section'
import { ListGroup } from '../../ui/ListGroup'

export default function Step1ReservationOverview({
  reservation,
  onNext,
  checkinCompleted,
  existingCheckin,
  guestData,
  isModificationMode,
  onEnterModificationMode,
  onExitModificationMode,
  // Group booking props
  groupBooking,
  isGroupBooking,
  groupCheckInMode,
  onToggleGroupCheckInMode,
}) {
  const { token } = useParams()
  if (!reservation) {
    return (
      <div className="text-center py-10 text-slate-500">
        Loading reservation details…
      </div>
    )
  }

  const checkInDate = new Date(reservation.checkInDate)
  const checkOutDate = new Date(reservation.checkOutDate)
  const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24))
  const submissionDate = guestData?.submittedAt ? new Date(guestData.submittedAt) : null

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header (blended) */}
      <Section
        title={`Welcome, ${reservation.guestName}!`}
        subtitle={
          checkinCompleted && !isModificationMode
            ? 'Your check-in has been completed'
            : isModificationMode
            ? 'You are modifying your check-in information'
            : "Let's complete your online register"
        }
        className="pt-3"
      />

      {/* Completed banner / Edit */}
      {checkinCompleted && !isModificationMode && (
        <div
          className="
          mx-3 sm:mx-0 rounded-2xl bg-white/70 backdrop-blur
          supports-[backdrop-filter]:bg-white/60 ring-1 ring-slate-200/70
          p-3 sm:p-4 relative"
        >
          <button
            onClick={onEnterModificationMode}
            className="absolute top-2 right-2 inline-flex items-center px-2 py-1 text-[11px]
                       rounded-full ring-1 ring-slate-300 bg-white hover:bg-slate-50"
          >
            <Edit className="w-3.5 h-3.5 mr-1" />
            Edit
          </button>

          <div className="flex items-start pr-16">
            <CheckCircle className="w-5 h-5 text-emerald-600 mr-2 mt-0.5" />
            <div className="text-sm text-slate-800">
              <div className="font-medium text-slate-900 mb-1">Check-in Complete</div>
              <div className="space-y-1">
                <div>
                  <span className="text-slate-500">Guest:</span>{' '}
                  {guestData?.firstName} {guestData?.lastName}
                </div>
                {guestData?.personalEmail && (
                  <div>
                    <span className="text-slate-500">Contact:</span> {guestData.personalEmail}
                  </div>
                )}
                {submissionDate && (
                  <div>
                    <span className="text-slate-500">Submitted:</span>{' '}
                    {submissionDate.toLocaleDateString('en-US', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Status:</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-900 text-white">
                    {guestData?.adminVerified ? 'Verified by Admin' : 'Pending Review'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-200/70">
            <button
              onClick={() => (window.location.href = `/guest/${token}`)}
              className="inline-flex items-center px-3 py-2 rounded-xl bg-slate-900 text-white text-sm
                         hover:opacity-90 focus:outline-none focus:ring-1 focus:ring-offset-2 focus:ring-slate-900"
            >
              <LayoutPanelLeft className="w-4 h-4 mr-2" />
              Guest App
            </button>
          </div>
        </div>
      )}

      {/* Modification mode banner */}
      {isModificationMode && (
        <div className="mx-3 sm:mx-0 rounded-2xl bg-amber-50/80 ring-1 ring-amber-200 p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
            <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 text-amber-600 mr-2 mt-0.5" />
              <div className="text-sm text-amber-900">
                <div className="font-semibold">Modification mode</div>
                Any changes you make will overwrite your previously submitted data.
              </div>
            </div>
            <button
              onClick={onExitModificationMode}
              className="shrink-0 inline-flex items-center px-3 py-2 rounded-xl bg-slate-900 text-white text-sm
                         hover:opacity-90 focus:outline-none focus:ring-1 focus:ring-offset-2 focus:ring-slate-900"
            >
              Cancel modification
            </button>
          </div>
        </div>
      )}

      {/* Group booking (soft) */}
      {isGroupBooking && (
        <div className="mx-3 sm:mx-0 rounded-2xl bg-gradient-to-tr from-amber-50 to-orange-50 ring-1 ring-amber-200 p-3 sm:p-4">
          <div className="flex items-start mb-3">
            <Crown className="w-5 h-5 text-amber-600 mr-2 mt-0.5" />
            <div>
              <div className="font-semibold text-amber-900">Group booking detected</div>
              <p className="text-sm text-amber-800">
                This reservation is part of a group. You can check in individually or use unified
                group check-in.
              </p>
            </div>
          </div>

          {groupBooking && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <Stat label="Total Rooms" value={groupBooking.summary?.totalRooms || groupBooking.rooms?.length || 0} />
              <Stat
                label="Total Guests"
                value={
                  groupBooking.groupCheckInStatus?.totalGuests ||
                  groupBooking.summary?.totalGuests ||
                  groupBooking.rooms?.reduce((s, r) => s + (r.numGuests || 0), 0) ||
                  0
                }
              />
              <Stat label="Completed Rooms" value={groupBooking.groupCheckInStatus?.completedRooms || 0} ok />
              <Stat label="Completed Guests" value={groupBooking.groupCheckInStatus?.completedGuests || 0} ok />
            </div>
          )}

          {groupCheckInMode && groupBooking?.rooms && (
            <div className="mt-3 rounded-xl ring-1 ring-amber-200 bg-white/70 p-2 divide-y divide-amber-100">
              {groupBooking.rooms.map((room) => (
                <div key={room.reservationId} className="py-2 px-1 flex items-center justify-between">
                  <div className="flex items-center min-w-0">
                    {room.isMaster && <Crown className="w-4 h-4 text-amber-600 mr-1.5" />}
                    <Building className="w-4 h-4 text-amber-600 mr-1.5" />
                    <div className="truncate">
                      <div className="text-sm font-medium text-slate-900 truncate">
                        Room {room.roomNumber} — {room.roomType}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {room.numGuests} {room.numGuests === 1 ? 'guest' : 'guests'}
                        {room.isMaster && <span className="ml-1 text-amber-600">(Master)</span>}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {room.completionStatus?.isComplete ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <span className="text-[11px] text-amber-700">
                        {room.completionStatus?.completedGuests || 0}/{room.numGuests}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {onToggleGroupCheckInMode && (
            <div className="mt-3 text-center">
              <button
                onClick={onToggleGroupCheckInMode}
                className={`inline-flex items-center px-3 py-2 rounded-xl text-sm
                  ${groupCheckInMode
                    ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-300 hover:bg-amber-200'
                    : 'bg-amber-600 text-white hover:bg-amber-700'}`}
              >
                {groupCheckInMode ? (
                  <>
                    <Users className="w-4 h-4 mr-2" />
                    Single room mode
                  </>
                ) : (
                  <>
                    <Crown className="w-4 h-4 mr-2" />
                    Unified group check-in
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Reservation details (inset list) */}
      <Section title="Your reservation" className="pt-1">
        <ListGroup>
          <li className="px-3 py-3 flex items-start gap-3">
            <Calendar className="w-4 h-4 text-slate-600 mt-0.5" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900">Check-in</div>
              <div className="text-sm text-slate-600">
                {checkInDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>
          </li>
          <li className="px-3 py-3 flex items-start gap-3">
            <Clock className="w-4 h-4 text-slate-600 mt-0.5" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900">Check-out</div>
              <div className="text-sm text-slate-600">
                {checkOutDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>
          </li>
          <li className="px-3 py-3 flex items-start gap-3">
            <Users className="w-4 h-4 text-slate-600 mt-0.5" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900">Guests</div>
              <div className="text-sm text-slate-600">
                {reservation.numGuests} {reservation.numGuests === 1 ? 'Guest' : 'Guests'}
              </div>
            </div>
          </li>
          <li className="px-3 py-3 flex items-start gap-3">
            <Home className="w-4 h-4 text-slate-600 mt-0.5" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900">Property</div>
              <div className="text-sm text-slate-600 break-words">{reservation.propertyName || 'Property'}</div>
            </div>
          </li>
          <li className="px-3 py-3 flex items-start gap-3">
            <MapPin className="w-4 h-4 text-slate-600 mt-0.5" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900">Room</div>
              <div className="text-sm text-slate-600 break-words">
                {reservation.roomTypeName || reservation.roomTypes}
              </div>
            </div>
          </li>
          <li className="px-3 py-3 flex items-start gap-3">
            <Clock className="w-4 h-4 text-slate-600 mt-0.5" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900">Duration</div>
              <div className="text-sm text-slate-600">
                {nights} {nights === 1 ? 'Night' : 'Nights'}
              </div>
            </div>
          </li>
        </ListGroup>

        {(reservation.roomTypeDescription ||
          reservation.bedConfiguration ||
          reservation.roomSizeSqm ||
          reservation.hasBalcony ||
          reservation.hasKitchen ||
          reservation.maxGuests) && (
          <div className="mt-3">
            <div className="text-sm font-semibold text-slate-900 mb-2">Room features</div>
            <div className="rounded-xl ring-1 ring-slate-200/70 bg-white/70 p-3 space-y-2">
              {reservation.roomTypeDescription && (
                <p className="text-sm text-slate-700">{reservation.roomTypeDescription}</p>
              )}
              <div className="flex flex-wrap gap-2 text-[12px]">
                {reservation.bedConfiguration && (
                  <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-800">
                    {reservation.bedConfiguration}
                  </span>
                )}
                {reservation.roomSizeSqm && (
                  <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-800">
                    {reservation.roomSizeSqm}㎡
                  </span>
                )}
                {reservation.maxGuests && (
                  <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-800">
                    up to {reservation.maxGuests}
                  </span>
                )}
                {reservation.hasBalcony && (
                  <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-800">Balcony</span>
                )}
                {reservation.hasKitchen && (
                  <span className="px-2 py-1 rounded-full bg-green-100 text-green-800">Kitchen</span>
                )}
              </div>
            </div>
          </div>
        )}
      </Section>

      <StepNavigation
        currentStep={1}
        totalSteps={4}
        onNext={onNext}
        nextButtonText={
          checkinCompleted && !isModificationMode
            ? 'View Details'
            : isModificationMode
            ? 'Continue Modification'
            : 'Start Check-in'
        }
        showPrevious={false}
        disabled={checkinCompleted && !isModificationMode}
      />
    </div>
  )
}

/* tiny helper */
function Stat({ label, value, ok = false }) {
  return (
    <div>
      <div className={`text-lg font-bold ${ok ? 'text-emerald-700' : 'text-amber-900'}`}>{value}</div>
      <div className="text-[11px] text-amber-700">{label}</div>
    </div>
  )
}
