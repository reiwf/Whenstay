import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FileText,
  CheckCircle,
  AlertCircle,
  Users,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import FileUpload from '../../FileUpload'
import StepNavigation from '../shared/StepNavigation'

// blended UI
import Section from '@/components/ui/Section'

export default function Step3DocumentUpload({
  formData,
  onUpdateFormData,
  onNext,
  onPrevious,
  checkinCompleted = false,
  isModificationMode = false,
  guestData = null,
  reservation = null
}) {
  const { t } = useTranslation('guest')
  const [uploadErrors, setUploadErrors] = useState({})
  const [expandedGuests, setExpandedGuests] = useState(new Set([1]))

  const numGuests = reservation?.numGuests || formData?.guests?.length || 1
  const isReadOnly = checkinCompleted && !isModificationMode

  const initializeGuestDocuments = () => {
    const guests = []
    for (let i = 1; i <= numGuests; i++) {
      const eg = guestData?.guests?.find(g => g.guestNumber === i)
      const fg = formData?.guests?.find(g => g.guestNumber === i)
      const fd = formData?.guestDocuments?.find(d => d.guestNumber === i)

      guests.push({
        guestNumber: i,
        firstName: eg?.firstName || fg?.firstName || '',
        lastName: eg?.lastName || fg?.lastName || '',
        passportUrl: eg?.passportUrl || fd?.passportUrl || (i === 1 ? formData.passportUrl : null),
        passportFile: fd?.passportFile || (i === 1 ? formData.passportFile : null),
        passportFilePath: fd?.passportFilePath || (i === 1 ? formData.passportFilePath : null),
        isPrimaryGuest: i === 1,
        hasDocument: !!(eg?.passportUrl || fd?.passportUrl || fd?.hasDocument || (i === 1 && formData.passportUrl))
      })
    }
    return guests
  }

  const [guestDocuments, setGuestDocuments] = useState(initializeGuestDocuments())

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

  const handleFileUpload = (guestNumber, file, url, filePath) => {
    setGuestDocuments(prev => prev.map(g =>
      g.guestNumber === guestNumber
        ? { ...g, passportFile: file, passportUrl: url, passportFilePath: filePath, hasDocument: true }
        : g
    ))

    if (guestNumber === 1) {
      onUpdateFormData({ passportFile: file, passportUrl: url, passportFilePath: filePath })
    }
    setUploadErrors(prev => ({ ...prev, [`guest${guestNumber}`]: '' }))
  }

  const handleUploadError = (guestNumber, error) => {
    setUploadErrors(prev => ({ ...prev, [`guest${guestNumber}`]: error }))
  }

  const handleDeleteExisting = async (guestNumber) => {
    setGuestDocuments(prev => prev.map(g =>
      g.guestNumber === guestNumber
        ? { ...g, passportFile: null, passportUrl: null, passportFilePath: null, hasDocument: false }
        : g
    ))
    if (guestNumber === 1) {
      onUpdateFormData({ passportFile: null, passportUrl: null, passportFilePath: null })
    }
    setUploadErrors(prev => ({ ...prev, [`guest${guestNumber}`]: '' }))
  }

  const handleNext = () => {
    const errs = {}
    guestDocuments.forEach(g => {
      if (!g.hasDocument && !g.passportUrl && !g.passportFile) {
        const label = g.firstName && g.lastName ? `${g.firstName} ${g.lastName}` : t('step3.guestNumber', { number: g.guestNumber })
        errs[`guest${g.guestNumber}`] = t('step3.errors.uploadRequired', { name: label })
      }
    })
    setUploadErrors(errs)
    if (Object.keys(errs).length > 0) return

    onUpdateFormData({
      guestDocuments,
      // back-compat
      passportFile: guestDocuments[0]?.passportFile,
      passportUrl: guestDocuments[0]?.passportUrl,
      passportFilePath: guestDocuments[0]?.passportFilePath
    })
    onNext()
  }

  const allDocumentsUploaded = guestDocuments.every(g => g.hasDocument || g.passportUrl || g.passportFile)

  const ErrorBox = ({ children }) => (
    <div className="mt-3 rounded-xl bg-rose-50/80 ring-1 ring-rose-200 p-2.5 sm:p-3 text-rose-800 text-sm flex items-start">
      <AlertCircle className="w-4 h-4 mr-2 mt-0.5 shrink-0 text-rose-500" />
      <div className="break-words">{children}</div>
    </div>
  )

  const GuestRow = (guest) => {
    const isExpanded = expandedGuests.has(guest.guestNumber)
    const errorKey = `guest${guest.guestNumber}`

    return (
      <div className="rounded-2xl ring-1 ring-slate-200 bg-white/70 overflow-hidden" key={guest.guestNumber}>
        {/* Header */}
        <button
          type="button"
          onClick={() => !guest.isPrimaryGuest && toggleGuestExpansion(guest.guestNumber)}
          className={`w-full px-3 sm:px-4 py-3 flex items-center justify-between ${guest.isPrimaryGuest ? 'cursor-default' : 'hover:bg-white/80'}`}
          aria-expanded={guest.isPrimaryGuest ? true : isExpanded}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Users className="w-5 h-5 text-slate-600 shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-slate-900 truncate">
                  {guest.isPrimaryGuest ? t('step3.primaryGuest') : t('step3.guestNumber', { number: guest.guestNumber })}
                </h4>
                {guest.hasDocument && <CheckCircle className="w-4 h-4 text-emerald-600" />}
              </div>
              <p className="text-xs text-slate-600 truncate">
                {guest.firstName && guest.lastName
                  ? `${guest.firstName} ${guest.lastName}`
                  : t('step3.guestNumber', { number: guest.guestNumber })}
              </p>
            </div>
          </div>
          {!guest.isPrimaryGuest && (
            isExpanded ? <ChevronUp className="w-5 h-5 text-slate-600" /> : <ChevronDown className="w-5 h-5 text-slate-600" />
          )}
        </button>

        {/* Body */}
        {(isExpanded || guest.isPrimaryGuest) && (
          <div className="px-3 sm:px-4 pb-4 sm:pb-5">
            <div className="rounded-xl bg-white/80 ring-1 ring-slate-200 p-3 sm:p-4">
              <FileUpload
                onFileUpload={(file, url, filePath) => handleFileUpload(guest.guestNumber, file, url, filePath)}
                onError={(error) => handleUploadError(guest.guestNumber, error)}
                onDeleteExisting={() => handleDeleteExisting(guest.guestNumber)}
                initialImageUrl={guest.passportUrl}
                initialFilePath={guest.passportFilePath}
                accept="image/*"
                maxSize={10 * 1024 * 1024}
                className="w-full"
                showFileName
                disabled={isReadOnly}
              />
              <p className="mt-2 text-[11px] text-slate-500">
                {t('step3.acceptedFormats')}
              </p>
            </div>

            {uploadErrors[errorKey] && <ErrorBox>{uploadErrors[errorKey]}</ErrorBox>}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <Section
        title={t('step3.title')}
        subtitle={
          isReadOnly
            ? t('step3.subtitleReadOnly')
            : isModificationMode
            ? t('step3.subtitleModification')
            : t('step3.subtitle', { guestType: numGuests > 1 ? t('step3.subtitleMultiple') : t('step3.subtitleSingle') })
        }
        className="pt-2"
      />

      {/* Read-only banner */}
      {isReadOnly && (
        <div className="mx-3 sm:mx-0 rounded-2xl bg-white/70 ring-1 ring-slate-200 p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm sm:text-base font-semibold text-slate-900">{t('step3.documentsSubmitted')}</h3>
          </div>
          <p className="text-sm text-slate-700">
            {t('step3.documentsSubmittedDesc')}
          </p>
        </div>
      )}

      {/* Multi-guest progress */}
      {numGuests > 1 && (
        <div className="mx-3 sm:mx-0 rounded-2xl bg-white/70 ring-1 ring-slate-200 p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-600" />
              <span className="text-sm font-medium text-slate-900">
                {t('step3.documentUploadFor', { count: numGuests })}
              </span>
            </div>
            <div className="text-sm text-slate-600">
              {t('step3.uploaded', { 
                count: guestDocuments.filter(g => g.hasDocument || g.passportUrl || g.passportFile).length, 
                total: numGuests 
              })}
            </div>
          </div>
        </div>
      )}

      {/* Requirements (soft sheet) */}
      <div className="mx-3 sm:mx-0 rounded-2xl bg-white/70 ring-1 ring-slate-200 p-3 sm:p-4">
        <div className="text-sm sm:text-base font-semibold text-slate-900 mb-2">{t('step3.documentRequirements')}</div>
        <ul className="text-sm text-slate-700 space-y-1">
          <li>{t('step3.passport')}</li>
          <li>{t('step3.driversLicense')}</li>
          <li>{t('step3.governmentId')}</li>
        </ul>
      </div>

      {/* Guest accordions */}
      <div className="space-y-3">
        {guestDocuments.map(GuestRow)}
      </div>

      {/* Expand/collapse helpers */}
      {numGuests > 1 && !isReadOnly && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              const allExpanded = guestDocuments.slice(1).every(g => expandedGuests.has(g.guestNumber))
              setExpandedGuests(allExpanded ? new Set([1]) : new Set(guestDocuments.map(g => g.guestNumber)))
            }}
            className="text-sm text-slate-700 hover:text-slate-900 inline-flex items-center"
          >
            <Users className="w-4 h-4 mr-2" />
            {guestDocuments.slice(1).every(g => expandedGuests.has(g.guestNumber))
              ? t('step3.collapseAdditionalGuests')
              : t('step3.expandAllAdditionalGuests')}
          </button>
        </div>
      )}

      {/* Security note */}
      <div className="mx-3 sm:mx-0 rounded-2xl bg-white/70 ring-1 ring-slate-200 p-3 sm:p-4">
        <div className="flex items-start">
          <FileText className="w-4 h-4 text-slate-600 mr-2 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-slate-900 mb-1">{t('step3.whyWeNeedThese')}</div>
            <ul className="text-xs sm:text-sm text-slate-600 space-y-1">
              <li>{t('step3.securityReasons.identity')}</li>
              <li>{t('step3.securityReasons.compliance')}</li>
              <li>{t('step3.securityReasons.safety')}</li>
            </ul>
          </div>
        </div>
      </div>

      <StepNavigation
        currentStep={3}
        totalSteps={4}
        onNext={handleNext}
        onPrevious={onPrevious}
        nextButtonText={t('step3.continue')}
        isNextDisabled={!allDocumentsUploaded}
      />
    </div>
  )
}
