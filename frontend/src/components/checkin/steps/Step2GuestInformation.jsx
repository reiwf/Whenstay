import { useState } from 'react'
import {
  User,
  Mail,
  Phone as PhoneIcon,
  MapPin,
  Briefcase,
  UserCheck,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Users
} from 'lucide-react'
import PhoneInput from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import flags from 'react-phone-number-input/flags'
import './PhoneInput.css'
import { useTranslation } from 'react-i18next'

import StepNavigation from '../shared/StepNavigation'
import TimePicker from '@/components/ui/timepick'

// NEW – blended sections
import Section from '@/components/ui/Section'
import { ListGroup } from '@/components/ui/ListGroup'

export default function Step2GuestInformation({
  reservation,
  formData,
  onUpdateFormData,
  onNext,
  onPrevious,
  checkinCompleted = false,
  isModificationMode = false,
  guestData = null
}) {
  const { t } = useTranslation('guest')
  const [errors, setErrors] = useState({})
  const [expandedGuests, setExpandedGuests] = useState(new Set([1]))
  const numGuests = reservation?.numGuests || 1

  // Build guests from reservation + existing data + step1 fields
  const initializeGuests = () => {
    const guests = []
    for (let i = 1; i <= numGuests; i++) {
      const eg = guestData?.guests?.find(g => g.guestNumber === i)
      const fg = formData?.guests?.find(g => g.guestNumber === i)
      guests.push({
        guestNumber: i,
        firstName: eg?.firstName || fg?.firstName || (i === 1 ? formData.firstName : '') || '',
        lastName: eg?.lastName || fg?.lastName || (i === 1 ? formData.lastName : '') || '',
        personalEmail: eg?.personalEmail || fg?.personalEmail || (i === 1 ? formData.personalEmail : '') || '',
        contactNumber: eg?.contactNumber || fg?.contactNumber || (i === 1 ? formData.contactNumber : '') || '',
        address: eg?.address || fg?.address || (i === 1 ? formData.address : '') || '',
        estimatedCheckinTime: eg?.estimatedCheckinTime || fg?.estimatedCheckinTime || (i === 1 ? formData.estimatedCheckinTime : '') || '',
        travelPurpose: eg?.travelPurpose || fg?.travelPurpose || (i === 1 ? formData.travelPurpose : '') || '',
        emergencyContactName: eg?.emergencyContactName || fg?.emergencyContactName || (i === 1 ? formData.emergencyContactName : '') || '',
        emergencyContactPhone: eg?.emergencyContactPhone || fg?.emergencyContactPhone || (i === 1 ? formData.emergencyContactPhone : '') || '',
        isCompleted: eg?.isCompleted || fg?.isCompleted || false,
        isPrimaryGuest: i === 1
      })
    }
    return guests
  }
  const [guests, setGuests] = useState(initializeGuests())

  const toggleGuestExpansion = (guestNumber) => {
    setExpandedGuests(prev => {
      const ns = new Set(prev)
      if (ns.has(guestNumber)) {
        if (guestNumber !== 1) ns.delete(guestNumber)
      } else {
        ns.add(guestNumber)
      }
      return ns
    })
  }

  const validateForm = () => {
    const next = {}
    guests.forEach((g) => {
      const key = `guest${g.guestNumber}`
      if (!g.firstName?.trim()) next[`${key}.firstName`] = t('step2.errors.firstNameRequired', { number: g.guestNumber })
      if (!g.lastName?.trim())  next[`${key}.lastName`]  = t('step2.errors.lastNameRequired', { number: g.guestNumber })
      if (g.isPrimaryGuest) {
        if (!g.personalEmail?.trim()) {
          next[`${key}.personalEmail`] = t('step2.errors.emailRequired')
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(g.personalEmail)) {
          next[`${key}.personalEmail`] = t('step2.errors.emailInvalid')
        }
        if (!g.contactNumber?.trim()) {
          next[`${key}.contactNumber`] = t('step2.errors.contactRequired')
        }
        if (g.address && !g.address.trim()) {
          next[`${key}.address`] = t('step2.errors.addressInvalid')
        }
      }
    })
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleNext = () => {
    if (!validateForm()) return
    onUpdateFormData({
      guests,
      // Back-compat single-guest fields
      firstName: guests[0]?.firstName,
      lastName: guests[0]?.lastName,
      personalEmail: guests[0]?.personalEmail,
      contactNumber: guests[0]?.contactNumber,
      address: guests[0]?.address,
      estimatedCheckinTime: guests[0]?.estimatedCheckinTime,
      travelPurpose: guests[0]?.travelPurpose,
      emergencyContactName: guests[0]?.emergencyContactName,
      emergencyContactPhone: guests[0]?.emergencyContactPhone
    })
    onNext()
  }

  const handleGuestInputChange = (guestNumber, field, value) => {
    setGuests(prev => prev.map(g => (g.guestNumber === guestNumber ? { ...g, [field]: value } : g)))
    const ek = `guest${guestNumber}.${field}`
    if (errors[ek]) setErrors(prev => ({ ...prev, [ek]: '' }))
    if (guestNumber === 1) onUpdateFormData({ [field]: value }) // back-compat
  }

  const handleInputChange = (field, value) => handleGuestInputChange(1, field, value)

  const hasGuestErrors = (guestNumber) =>
    Object.keys(errors).some(k => k.startsWith(`guest${guestNumber}`))

  const isReadOnly = checkinCompleted && !isModificationMode

  const FieldLabel = ({ children }) => (
    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">{children}</label>
  )
  const ErrorText = ({ children }) => (
    <p className="mt-1 text-xs sm:text-sm text-rose-600 flex items-center">
      <AlertCircle className="w-3 h-3 mr-1 shrink-0" /> {children}
    </p>
  )
  const inputCls = (hasError, disabled) =>
    [
      'w-full rounded-xl bg-white/80 px-3 py-2.5 text-sm',
      'ring-1 ring-slate-300 placeholder-slate-400',
      'focus:outline-none focus:ring-2 focus:ring-slate-900',
      hasError ? 'ring-rose-300' : '',
      disabled ? 'opacity-60 cursor-not-allowed' : ''
    ].join(' ')

  const renderGuestForm = (guest) => {
    const isExpanded = expandedGuests.has(guest.guestNumber)
    const key = `guest${guest.guestNumber}`
    const hasErrors = hasGuestErrors(guest.guestNumber)

    return (
      <div key={guest.guestNumber} className="rounded-2xl ring-1 ring-slate-200 bg-white/70 overflow-hidden">
        {/* Header row */}
        <button
          type="button"
          onClick={() => !guest.isPrimaryGuest && toggleGuestExpansion(guest.guestNumber)}
          className={`w-full px-3 sm:px-4 py-3 flex items-center justify-between
                      ${guest.isPrimaryGuest ? 'cursor-default' : 'hover:bg-white/80'}`}
          aria-expanded={guest.isPrimaryGuest ? true : isExpanded}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Users className="w-5 h-5 text-slate-600 shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-slate-900 truncate">
                  {guest.isPrimaryGuest ? t('step2.primaryGuest') : t('step2.guestNumber', { number: guest.guestNumber })}
                </h4>
                {guest.isPrimaryGuest && (
                  <span className="px-2 py-0.5 text-[11px] rounded-full bg-slate-900 text-white">
                    {t('step2.mainContact')}
                  </span>
                )}
                {guest.isCompleted && !hasErrors && (
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                )}
                {hasErrors && <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />}
              </div>
              <p className="text-xs text-slate-600 truncate">
                {guest.firstName && guest.lastName
                  ? `${guest.firstName} ${guest.lastName}`
                  : guest.isPrimaryGuest ? t('step2.pleaseFillDetails') : t('step2.tapToFillDetails')}
              </p>
            </div>
          </div>
          {!guest.isPrimaryGuest && (
            isExpanded
              ? <ChevronUp className="w-5 h-5 text-slate-600" />
              : <ChevronDown className="w-5 h-5 text-slate-600" />
          )}
        </button>

        {/* Body */}
        {(isExpanded || guest.isPrimaryGuest) && (
          <div className="px-3 sm:px-4 pb-4 sm:pb-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* First name */}
              <div>
                <FieldLabel>{t('step2.firstName')} {t('step2.required')}</FieldLabel>
                <input
                  type="text"
                  value={guest.firstName || ''}
                  onChange={(e) => handleGuestInputChange(guest.guestNumber, 'firstName', e.target.value)}
                  disabled={isReadOnly}
                  className={inputCls(!!errors[`${key}.firstName`], isReadOnly)}
                  placeholder={t('step2.enterFirstName')}
                />
                {errors[`${key}.firstName`] && <ErrorText>{errors[`${key}.firstName`]}</ErrorText>}
              </div>

              {/* Last name */}
              <div>
                <FieldLabel>{t('step2.lastName')} {t('step2.required')}</FieldLabel>
                <input
                  type="text"
                  value={guest.lastName || ''}
                  onChange={(e) => handleGuestInputChange(guest.guestNumber, 'lastName', e.target.value)}
                  disabled={isReadOnly}
                  className={inputCls(!!errors[`${key}.lastName`], isReadOnly)}
                  placeholder={t('step2.enterLastName')}
                />
                {errors[`${key}.lastName`] && <ErrorText>{errors[`${key}.lastName`]}</ErrorText>}
              </div>

              {/* Primary-only fields */}
              {guest.isPrimaryGuest && (
                <>
                  {/* Email */}
                  <div className="sm:col-span-2">
                    <FieldLabel>{t('step2.emailAddress')} {t('step2.required')}</FieldLabel>
                    <input
                      type="email"
                      value={guest.personalEmail || ''}
                      onChange={(e) => handleGuestInputChange(guest.guestNumber, 'personalEmail', e.target.value)}
                      disabled={isReadOnly}
                      className={inputCls(!!errors[`${key}.personalEmail`], isReadOnly)}
                      placeholder="personal@email.com"
                    />
                    {errors[`${key}.personalEmail`] && <ErrorText>{errors[`${key}.personalEmail`]}</ErrorText>}
                  </div>

                  {/* Phone */}
                  <div className="sm:col-span-2">
                    <FieldLabel>{t('step2.contactNumber')} {t('step2.required')}</FieldLabel>

                    <div
                      className={[
                        'h-10 rounded-xl bg-white/80 ring-1 ring-slate-300 px-3',
                        'focus-within:ring-2 focus-within:ring-slate-900',
                        errors[`${key}.contactNumber`] ? 'ring-rose-300' : '',
                        isReadOnly ? 'opacity-60 cursor-not-allowed' : ''
                      ].join(' ')}
                      style={{ background: isReadOnly ? '#f5f5f5' : undefined }}
                    >
                      <PhoneInput
                        className="PhoneInput w-full min-w-0"  // <- fill shell, allow shrink
                        international
                        countryCallingCodeEditable={false}
                        defaultCountry="JP"
                        flags={flags}
                        value={guest.contactNumber || ''}
                        onChange={(v) => handleGuestInputChange(guest.guestNumber,'contactNumber', v || '')}
                        disabled={isReadOnly}
                        placeholder={t('step2.enterPhoneNumber')}
                      />
                    </div>

                    {errors[`${key}.contactNumber`] && (
                      <ErrorText>{errors[`${key}.contactNumber`]}</ErrorText>
                    )}
                  </div>

                  {/* ETA */}
                  <div>
                    <FieldLabel className="pt-2">{t('step2.estimatedCheckInTime')}</FieldLabel>

                    <div>
                      {/* Input shell */}
                      <div
                        className={[
                          'h-10 w-full rounded-xl bg-white/80 ring-1 ring-slate-300 px-3',
                          'focus-within:ring-2 focus-within:ring-slate-900',
                          errors[`${key}.estimatedCheckinTime`] ? 'ring-rose-300' : '',
                          isReadOnly ? 'opacity-60 cursor-not-allowed' : ''
                        ].join(' ')}
                      >
                        <TimePicker
                          className="w-full"              // <- make picker fill the shell
                          value={guest.estimatedCheckinTime || null}
                          onChange={(val) => handleGuestInputChange(guest.guestNumber, 'estimatedCheckinTime', val || '')}
                          disabled={isReadOnly}
                          format="24"
                          step={60}
                          placeholder="HH:mm"
                          clearable
                          overnightRange={{ start: '16:00', end: '03:00' }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{t('step2.whatTimeArrive')}</p>
                    </div>
                  </div>
                  {/* Purpose */}
                  {/* <div>
                    <FieldLabel>
                      <Briefcase className="w-3.5 h-3.5 inline mr-1.5" /> Travel Purpose
                    </FieldLabel>
                    <select
                      value={guest.travelPurpose || ''}
                      onChange={(e) => handleGuestInputChange(guest.guestNumber, 'travelPurpose', e.target.value)}
                      disabled={isReadOnly}
                      className={inputCls(false, isReadOnly)}
                    >
                      <option value="">Select purpose</option>
                      <option value="Business">Business</option>
                      <option value="Leisure">Leisure</option>
                      <option value="Family Visit">Family Visit</option>
                      <option value="Medical">Medical</option>
                      <option value="Education">Education</option>
                      <option value="Other">Other</option>
                    </select>
                    <p className="mt-1 text-xs text-slate-500">Purpose of your visit</p>
                  </div> */}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Completed banner
  const ReadOnlyBanner = () => (
    <div className="mx-3 sm:mx-0 rounded-2xl bg-white/70 ring-1 ring-slate-200 p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-1">
        <CheckCircle className="w-5 h-5 text-emerald-600" />
        <h3 className="text-sm sm:text-base font-semibold text-slate-900">{t('step2.informationSubmitted')}</h3>
      </div>
      <p className="text-sm text-slate-700">
        {t('step2.informationSubmittedDesc')}
      </p>
    </div>
  )

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <Section
        title={t('step2.title')}
        subtitle={
          isReadOnly
            ? t('step2.subtitleReadOnly')
            : isModificationMode
            ? t('step2.subtitleModification')
            : t('step2.subtitle')
        }
        className="pt-2"
      />

      {isReadOnly && <ReadOnlyBanner />}

      {/* Multi-guest progress */}
      {numGuests > 1 && (
        <div className="mx-3 sm:mx-0 rounded-2xl bg-white/70 ring-1 ring-slate-200 p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-slate-600" />
              <span className="text-sm font-medium text-slate-900">
                {t('step2.guestInformationFor', { count: numGuests })}
              </span>
            </div>
            <div className="text-sm text-slate-600">
              {t('step2.completed', {
                count: guests.filter(g => g.isPrimaryGuest
                  ? (g.firstName && g.lastName && g.personalEmail && g.contactNumber)
                  : (g.firstName && g.lastName)
                ).length,
                total: numGuests
              })}
            </div>
          </div>
        </div>
      )}

      {/* Guest accordions */}
      <div className="space-y-3">
        {guests.map(renderGuestForm)}
      </div>

      {/* Expand/collapse helpers */}
      {numGuests > 1 && !isReadOnly && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              const allExpanded = guests.slice(1).every(g => expandedGuests.has(g.guestNumber))
              setExpandedGuests(allExpanded ? new Set([1]) : new Set(guests.map(g => g.guestNumber)))
            }}
            className="text-sm text-slate-700 hover:text-slate-900 inline-flex items-center"
          >
            <Users className="w-4 h-4 mr-2" />
            {guests.slice(1).every(g => expandedGuests.has(g.guestNumber))
              ? t('step2.collapseAdditionalGuests')
              : t('step2.expandAllAdditionalGuests')}
          </button>
        </div>
      )}

      <StepNavigation
        currentStep={2}
        totalSteps={4}
        onNext={handleNext}
        onPrevious={onPrevious}
        nextButtonText={t('step2.continue')}
      />
    </div>
  )
}
