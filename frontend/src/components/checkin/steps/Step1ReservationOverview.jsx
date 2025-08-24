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
import { useTranslation } from 'react-i18next'
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
  const { t , i18n } = useTranslation('guest')
  
  if (!reservation) {
    return (
      <div className="text-center py-10 text-slate-500">
        {t('step1.loadingReservation')}
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
        title={t('step1.title', { name: reservation.guestName })}
        subtitle={
          checkinCompleted && !isModificationMode
            ? t('step1.subtitleCompleted')
            : isModificationMode
            ? t('step1.subtitleModification')
            : t('step1.subtitle')
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
            {t('common.edit')}
          </button>

          <div className="flex items-start pr-16">
            <CheckCircle className="w-5 h-5 text-emerald-600 mr-2 mt-0.5" />
            <div className="text-sm text-slate-800">
              <div className="font-medium text-slate-900 mb-1">{t('step1.checkInComplete')}</div>
              <div className="space-y-1">
                <div>
                  <span className="text-slate-500">{t('step1.guest')}:</span>{' '}
                  {guestData?.firstName} {guestData?.lastName}
                </div>
                {guestData?.personalEmail && (
                  <div>
                    <span className="text-slate-500">{t('step1.contact')}:</span> {guestData.personalEmail}
                  </div>
                )}
                {submissionDate && (
                  <div>
                    <span className="text-slate-500">{t('step1.submitted')}:</span>{' '}
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
                  <span className="text-slate-500">{t('step1.status')}:</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-900 text-white">
                    {guestData?.adminVerified ? t('step1.verifiedByAdmin') : t('step1.pendingReview')}
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
              {t('step1.guestApp')}
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
                <div className="font-semibold">{t('step1.modificationMode')}</div>
                {t('step1.modificationModeDesc')}
              </div>
            </div>
            <button
              onClick={onExitModificationMode}
              className="shrink-0 inline-flex items-center px-3 py-2 rounded-xl bg-slate-900 text-white text-sm
                         hover:opacity-90 focus:outline-none focus:ring-1 focus:ring-offset-2 focus:ring-slate-900"
            >
              {t('step1.cancelModification')}
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
              <div className="font-semibold text-amber-900">{t('step1.groupBookingDetected')}</div>
              <p className="text-sm text-amber-800">
                {t('step1.groupBookingDesc')}
              </p>
            </div>
          </div>

          {groupBooking && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <Stat label={t('step1.totalRooms')} value={groupBooking.summary?.totalRooms || groupBooking.rooms?.length || 0} />
              <Stat
                label={t('step1.totalGuests')}
                value={
                  groupBooking.groupCheckInStatus?.totalGuests ||
                  groupBooking.summary?.totalGuests ||
                  groupBooking.rooms?.reduce((s, r) => s + (r.numGuests || 0), 0) ||
                  0
                }
              />
              <Stat label={t('step1.completedRooms')} value={groupBooking.groupCheckInStatus?.completedRooms || 0} ok />
              <Stat label={t('step1.completedGuests')} value={groupBooking.groupCheckInStatus?.completedGuests || 0} ok />
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
                        {room.numGuests} {room.numGuests === 1 ? t('guestApp.guest') : t('step1.guests')}
                        {room.isMaster && <span className="ml-1 text-amber-600">{t('step1.masterRoom')}</span>}
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
                    {t('step1.singleRoomMode')}
                  </>
                ) : (
                  <>
                    <Crown className="w-4 h-4 mr-2" />
                    {t('step1.unifiedGroupCheckIn')}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Reservation details (inset list) */}
      <Section title={t('step1.yourReservation')} className="pt-1">
        <ListGroup>
          <li className="px-3 py-3 flex items-start gap-3">
            <Calendar className="w-4 h-4 text-slate-600 mt-0.5" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900">{t('step1.checkIn')}</div>
              <div className="text-sm text-slate-600">
                {checkInDate.toLocaleDateString(i18n.language, { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>
          </li>
          <li className="px-3 py-3 flex items-start gap-3">
            <Clock className="w-4 h-4 text-slate-600 mt-0.5" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900">{t('step1.checkOut')}</div>
              <div className="text-sm text-slate-600">
                {checkInDate.toLocaleDateString(i18n.language, { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>
          </li>
          <li className="px-3 py-3 flex items-start gap-3">
            <Users className="w-4 h-4 text-slate-600 mt-0.5" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900">{t('step1.guests')}</div>
              <div className="text-sm text-slate-600">
                {reservation.numGuests} {reservation.numGuests === 1 ? t('guestApp.guest') : t('step1.guests')}
              </div>
            </div>
          </li>
          <li className="px-3 py-3 flex items-start gap-3">
            <Home className="w-4 h-4 text-slate-600 mt-0.5" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900">{t('step1.property')}</div>
              <div className="text-sm text-slate-600 break-words">{reservation.propertyName || t('step1.property')}</div>
            </div>
          </li>
          <li className="px-3 py-3 flex items-start gap-3">
            <MapPin className="w-4 h-4 text-slate-600 mt-0.5" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900">{t('step1.room')}</div>
              <div className="text-sm text-slate-600 break-words">
                {reservation.roomTypeName || reservation.roomTypes}
              </div>
            </div>
          </li>
          <li className="px-3 py-3 flex items-start gap-3">
            <Clock className="w-4 h-4 text-slate-600 mt-0.5" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900">{t('step1.duration')}</div>
              <div className="text-sm text-slate-600">
                {nights} {nights === 1 ? t('step1.night') : t('step1.nights')}
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
            <div className="text-sm font-semibold text-slate-900 mb-2">{t('step1.roomFeatures')}</div>
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
                    {t('step1.upTo', { count: reservation.maxGuests })}
                  </span>
                )}
                {reservation.hasBalcony && (
                  <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-800">{t('step1.balcony')}</span>
                )}
                {reservation.hasKitchen && (
                  <span className="px-2 py-1 rounded-full bg-green-100 text-green-800">{t('step1.kitchen')}</span>
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
            ? t('step1.viewDetails')
            : isModificationMode
            ? t('step1.continueModification')
            : t('step1.startCheckIn')
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
