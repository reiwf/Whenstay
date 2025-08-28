import { useState } from 'react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  FileText,
  CheckCircle,
  AlertCircle,
  Users,
  Image,
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
  reservation = null,
  // Group booking props
  groupBooking = null,
  isGroupBooking = false,
  groupCheckInMode = false
}) {
  const { t } = useTranslation('guest')
  const [uploadErrors, setUploadErrors] = useState({})
  const [expandedGuests, setExpandedGuests] = useState(new Set([1]))
  const [expandedRooms, setExpandedRooms] = useState(new Set())

  const numGuests = reservation?.numGuests || formData?.guests?.length || 1
  const isReadOnly = checkinCompleted && !isModificationMode

  // Initialize expanded rooms with no rooms expanded by default in group mode
  React.useEffect(() => {
    if (groupCheckInMode && groupBooking?.rooms?.length > 0) {
      setExpandedRooms(new Set()) // Start with no rooms expanded
    }
  }, [groupCheckInMode, groupBooking])

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

  // Toggle room expansion for group mode
  const toggleRoomExpansion = (reservationId) => {
    setExpandedRooms(prev => {
      const ns = new Set(prev)
      if (ns.has(reservationId)) {
        ns.delete(reservationId)
      } else {
        ns.add(reservationId)
      }
      return ns
    })
  }

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

  // Handle group guest document upload
  const handleGroupFileUpload = (reservationId, guestNumber, file, url, filePath) => {
    const roomDocuments = formData.groupRoomDocuments || {}
    const currentRoomDocs = roomDocuments[reservationId] || []
    
    // Find existing guest document or create new one
    const existingDocIndex = currentRoomDocs.findIndex(d => d.guestNumber === guestNumber)
    let updatedCurrentRoomDocs
    
    if (existingDocIndex >= 0) {
      // Update existing document
      updatedCurrentRoomDocs = currentRoomDocs.map(doc =>
        doc.guestNumber === guestNumber 
          ? { ...doc, passportFile: file, passportUrl: url, passportFilePath: filePath, hasDocument: true }
          : doc
      )
    } else {
      // Create new document and add to array
      const newDoc = {
        guestNumber,
        passportFile: file,
        passportUrl: url,
        passportFilePath: filePath,
        hasDocument: true,
        isPrimaryGuest: guestNumber === 1
      }
      updatedCurrentRoomDocs = [...currentRoomDocs, newDoc]
    }
    
    const updatedRoomDocuments = {
      ...roomDocuments,
      [reservationId]: updatedCurrentRoomDocs
    }
    
    onUpdateFormData({ groupRoomDocuments: updatedRoomDocuments })

    // Clear errors
    const ek = `room${reservationId}.guest${guestNumber}`
    if (uploadErrors[ek]) setUploadErrors(prev => ({ ...prev, [ek]: '' }))
  }

  // Handle group guest document upload error
  const handleGroupUploadError = (reservationId, guestNumber, error) => {
    const ek = `room${reservationId}.guest${guestNumber}`
    setUploadErrors(prev => ({ ...prev, [ek]: error }))
  }

  // Handle group guest document deletion
  const handleGroupDeleteExisting = async (reservationId, guestNumber) => {
    const roomDocuments = formData.groupRoomDocuments || {}
    const currentRoomDocs = roomDocuments[reservationId] || []
    
    const updatedCurrentRoomDocs = currentRoomDocs.map(doc =>
      doc.guestNumber === guestNumber 
        ? { ...doc, passportFile: null, passportUrl: null, passportFilePath: null, hasDocument: false }
        : doc
    )
    
    const updatedRoomDocuments = {
      ...roomDocuments,
      [reservationId]: updatedCurrentRoomDocs
    }
    
    onUpdateFormData({ groupRoomDocuments: updatedRoomDocuments })

    // Clear errors
    const ek = `room${reservationId}.guest${guestNumber}`
    if (uploadErrors[ek]) setUploadErrors(prev => ({ ...prev, [ek]: '' }))
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
    
    if (groupCheckInMode) {
      // Validate group booking documents - require for ALL rooms and ALL guests
      const roomDocuments = formData.groupRoomDocuments || {}
      
      // Check all rooms have documents for all guests
      groupBooking?.rooms?.forEach(room => {
        const currentRoomDocs = roomDocuments[room.reservationId] || []
        
        // Check that all guests for this room have documents
        for (let guestNumber = 1; guestNumber <= room.numGuests; guestNumber++) {
          const guestDoc = currentRoomDocs.find(d => d.guestNumber === guestNumber)
          if (!guestDoc?.hasDocument && !guestDoc?.passportUrl && !guestDoc?.passportFile) {
            const key = `room${room.reservationId}.guest${guestNumber}`
            errs[key] = t('step3.errors.uploadRequired', { 
              name: `${t('step3.guest')} ${guestNumber}` 
            })
          }
        }
      })
    } else {
      // Validate single room documents
      guestDocuments.forEach(g => {
        if (!g.hasDocument && !g.passportUrl && !g.passportFile) {
          const label = g.firstName && g.lastName ? `${g.firstName} ${g.lastName}` : t('step3.guestNumber', { number: g.guestNumber })
          errs[`guest${g.guestNumber}`] = t('step3.errors.uploadRequired', { name: label })
        }
      })
    }
    
    setUploadErrors(errs)
    if (Object.keys(errs).length > 0) return

    if (groupCheckInMode) {
      // For group mode, data is already in formData.groupRoomDocuments
      onNext()
    } else {
      // For single room mode, update form data as before
      onUpdateFormData({
        guestDocuments,
        // back-compat
        passportFile: guestDocuments[0]?.passportFile,
        passportUrl: guestDocuments[0]?.passportUrl,
        passportFilePath: guestDocuments[0]?.passportFilePath
      })
      onNext()
    }
  }

  // Helper function to check if a room has any document upload errors
  const hasRoomDocumentErrors = (reservationId) =>
    Object.keys(uploadErrors).some(k => k.startsWith(`room${reservationId}`))

  const allDocumentsUploaded = groupCheckInMode 
    ? (() => {
        // For group mode, check ALL rooms and ALL guests have documents
        const roomDocuments = formData.groupRoomDocuments || {}
        
        // Check all rooms have all guests with documents
        for (const room of groupBooking?.rooms || []) {
          const roomDocs = roomDocuments[room.reservationId] || []
          for (let guestNumber = 1; guestNumber <= room.numGuests; guestNumber++) {
            const guestDoc = roomDocs.find(d => d.guestNumber === guestNumber)
            if (!guestDoc?.hasDocument && !guestDoc?.passportUrl && !guestDoc?.passportFile) {
              return false
            }
          }
        }
        return true
      })()
    : guestDocuments.every(g => g.hasDocument || g.passportUrl || g.passportFile)

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
      {(() => {
        const totalGuests = groupCheckInMode 
          ? groupBooking?.rooms?.reduce((sum, room) => sum + room.numGuests, 0) || 0
          : numGuests
        
        const uploadedCount = groupCheckInMode
          ? (() => {
              const roomDocuments = formData.groupRoomDocuments || {}
              let uploaded = 0
              groupBooking?.rooms?.forEach(room => {
                const roomDocs = roomDocuments[room.reservationId] || []
                for (let guestNumber = 1; guestNumber <= room.numGuests; guestNumber++) {
                  const guestDoc = roomDocs.find(d => d.guestNumber === guestNumber)
                  if (guestDoc?.hasDocument || guestDoc?.passportUrl || guestDoc?.passportFile) {
                    uploaded++
                  }
                }
              })
              return uploaded
            })()
          : guestDocuments.filter(g => g.hasDocument || g.passportUrl || g.passportFile).length

        return totalGuests > 1 && (
          <div className="mx-3 sm:mx-0 rounded-2xl bg-white/70 ring-1 ring-slate-200 p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Image className="w-5 h-5 text-slate-600" />
                <span className="text-sm font-medium text-slate-900">
                  {t('step3.documentUploadFor', { count: totalGuests })}
                </span>
              </div>
              <div className="text-sm text-slate-600">
                {t('step3.uploaded', { 
                  count: uploadedCount, 
                  total: totalGuests 
                })}
              </div>
            </div>
          </div>
        )
      })()}

      {groupCheckInMode ? (
        // Group check-in mode - show all rooms
        <div className="space-y-3">
          {groupBooking?.rooms && groupBooking.rooms.map((room, index) => {
            const isRoomExpanded = expandedRooms.has(room.reservationId)
            const roomDocuments = formData.groupRoomDocuments?.[room.reservationId] || []
            
            return (
              <div key={room.reservationId} className="rounded-2xl ring-1 ring-slate-200 bg-white/70 overflow-hidden">
                {/* Room header */}
                <button
                  type="button"
                  onClick={() => toggleRoomExpansion(room.reservationId)}
                  className="w-full px-3 sm:px-4 py-3 flex items-center justify-between hover:bg-white/80"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Image className="w-5 h-5 text-slate-600 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-slate-900 truncate">
                          {room.roomType} # {index + 1}
                        </h4>
                        {hasRoomDocumentErrors(room.reservationId) && (
                          <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                        )}
                      </div>
                      <p className="text-xs text-slate-600">
                        {room.numGuests} {room.numGuests === 1 ? 'guest' : 'guests'} • 
                        Documents: {roomDocuments.filter(d => d.hasDocument).length}/{room.numGuests}
                      </p>
                    </div>
                  </div>
                  {isRoomExpanded ? (
                    <ChevronUp className="w-5 h-5 text-slate-600" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-600" />
                  )}
                </button>

                {/* Room guests */}
                {isRoomExpanded && (
                  <div className="px-3 sm:px-4 pb-4 border-t border-slate-200/50">
                    <div className="mt-3 space-y-3">
                      {Array.from({ length: room.numGuests }, (_, i) => {
                        const guestNumber = i + 1
                        const guestDoc = roomDocuments.find(d => d.guestNumber === guestNumber) || {
                          guestNumber,
                          hasDocument: false,
                          passportUrl: null,
                          passportFile: null,
                          passportFilePath: null
                        }
                        const errorKey = `room${room.reservationId}.guest${guestNumber}`

                        return (
                          <div key={guestNumber} className="rounded-xl ring-1 ring-slate-200/50 bg-white/50 p-3">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-sm font-medium text-slate-900">
                                {guestNumber === 1 ? t('step3.primaryGuest') : `${t('step3.guest')} ${guestNumber}`}
                              </span>
                              {guestDoc.hasDocument && <CheckCircle className="w-4 h-4 text-emerald-600" />}
                            </div>

                            <div className="rounded-xl bg-white/80 ring-1 ring-slate-200 p-3">
                              <FileUpload
                                onFileUpload={(file, url, filePath) => handleGroupFileUpload(room.reservationId, guestNumber, file, url, filePath)}
                                onError={(error) => handleGroupUploadError(room.reservationId, guestNumber, error)}
                                onDeleteExisting={() => handleGroupDeleteExisting(room.reservationId, guestNumber)}
                                initialImageUrl={guestDoc.passportUrl}
                                initialFilePath={guestDoc.passportFilePath}
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
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        // Single room mode - show current room guests
        <div className="space-y-3">
          {guestDocuments.map(GuestRow)}
        </div>
      )}

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
      <div className="flex gap-2 mx-3 sm:mx-0 rounded-2xl bg-white/70 ring-1 ring-slate-200 p-3 sm:p-4">
      <div className="flex items-start mb-2">
          <Image className="w-4 h-4 text-slate-600 mr-2 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-slate-900 mb-1">{t('step3.documentRequirements')}</div>
            <ul className="text-xs sm:text-sm text-slate-600 space-y-1">
                <li>{t('step3.passport')}</li>
          <li>{t('step3.driversLicense')}</li>
          <li>{t('step3.governmentId')}</li>
            </ul>
          </div>
        </div>      
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
