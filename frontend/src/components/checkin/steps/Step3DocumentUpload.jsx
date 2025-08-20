import { useState } from 'react'
import { Upload, FileText, CheckCircle, AlertCircle, Users, ChevronDown, ChevronUp } from 'lucide-react'
import FileUpload from '../../FileUpload'
import StepNavigation from '../shared/StepNavigation'

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
  const [uploadErrors, setUploadErrors] = useState({})
  const [expandedGuests, setExpandedGuests] = useState(new Set([1])) // Guest 1 always expanded

  // Initialize guests array with document upload info
  const numGuests = reservation?.numGuests || formData?.guests?.length || 1
  const initializeGuestDocuments = () => {
    const guests = []
    for (let i = 1; i <= numGuests; i++) {
      const existingGuest = guestData?.guests?.find(g => g.guestNumber === i)
      const formDataGuest = formData?.guests?.find(g => g.guestNumber === i)
      const formDataDocument = formData?.guestDocuments?.find(d => d.guestNumber === i)
      
      guests.push({
        guestNumber: i,
        firstName: existingGuest?.firstName || formDataGuest?.firstName || '',
        lastName: existingGuest?.lastName || formDataGuest?.lastName || '',
        passportUrl: existingGuest?.passportUrl || formDataDocument?.passportUrl || (i === 1 ? formData.passportUrl : null),
        passportFile: formDataDocument?.passportFile || (i === 1 ? formData.passportFile : null),
        passportFilePath: formDataDocument?.passportFilePath || (i === 1 ? formData.passportFilePath : null),
        isPrimaryGuest: i === 1,
        hasDocument: !!(existingGuest?.passportUrl || formDataDocument?.passportUrl || formDataDocument?.hasDocument || (i === 1 && formData.passportUrl))
      })
    }
    return guests
  }

  const [guestDocuments, setGuestDocuments] = useState(initializeGuestDocuments())

  const toggleGuestExpansion = (guestNumber) => {
    setExpandedGuests(prev => {
      const newSet = new Set(prev)
      if (newSet.has(guestNumber)) {
        // Don't allow collapsing guest 1
        if (guestNumber !== 1) {
          newSet.delete(guestNumber)
        }
      } else {
        newSet.add(guestNumber)
      }
      return newSet
    })
  }

  const handleFileUpload = (guestNumber, file, url, filePath) => {
    setGuestDocuments(prev => prev.map(guest => 
      guest.guestNumber === guestNumber 
        ? { 
            ...guest, 
            passportFile: file,
            passportUrl: url,
            passportFilePath: filePath,
            hasDocument: true
          }
        : guest
    ))
    
    // For backward compatibility, update formData for guest #1
    if (guestNumber === 1) {
      onUpdateFormData({ 
        passportFile: file,
        passportUrl: url,
        passportFilePath: filePath
      })
    }
    
    // Clear error for this guest
    setUploadErrors(prev => ({ ...prev, [`guest${guestNumber}`]: '' }))
  }

  const handleUploadError = (guestNumber, error) => {
    setUploadErrors(prev => ({ ...prev, [`guest${guestNumber}`]: error }))
  }

  const handleDeleteExisting = async (guestNumber) => {
    setGuestDocuments(prev => prev.map(guest => 
      guest.guestNumber === guestNumber 
        ? { 
            ...guest, 
            passportFile: null,
            passportUrl: null,
            passportFilePath: null,
            hasDocument: false
          }
        : guest
    ))
    
    // For backward compatibility, update formData for guest #1
    if (guestNumber === 1) {
      onUpdateFormData({ 
        passportFile: null,
        passportUrl: null,
        passportFilePath: null
      })
    }
    
    // Clear error for this guest
    setUploadErrors(prev => ({ ...prev, [`guest${guestNumber}`]: '' }))
  }

  const handleNext = () => {
    const newErrors = {}
    
    // Validate that all guests have documents uploaded
    guestDocuments.forEach(guest => {
      if (!guest.hasDocument && !guest.passportUrl && !guest.passportFile) {
        newErrors[`guest${guest.guestNumber}`] = `Please upload an ID document for ${guest.firstName && guest.lastName ? `${guest.firstName} ${guest.lastName}` : `Guest ${guest.guestNumber}`}`
      }
    })

    setUploadErrors(newErrors)
    
    if (Object.keys(newErrors).length === 0) {
      // Update formData with all guest documents for submission
      onUpdateFormData({ 
        guestDocuments: guestDocuments,
        // Keep backward compatibility
        passportFile: guestDocuments[0]?.passportFile,
        passportUrl: guestDocuments[0]?.passportUrl,
        passportFilePath: guestDocuments[0]?.passportFilePath
      })
      onNext()
    }
  }

  const allDocumentsUploaded = guestDocuments.every(g => g.hasDocument || g.passportUrl || g.passportFile)

  const renderGuestDocumentUpload = (guest) => {
    const isExpanded = expandedGuests.has(guest.guestNumber)
    const errorKey = `guest${guest.guestNumber}`
    
    return (
      <div key={guest.guestNumber} className="border border-primary-200 rounded-lg overflow-hidden">
        {/* Guest Header */}
        <div 
          className={`p-4 cursor-pointer transition-colors ${
            guest.isPrimaryGuest 
              ? 'bg-primary-100 border-b border-primary-200' 
              : 'bg-gray-50 hover:bg-gray-100'
          }`}
          onClick={() => !guest.isPrimaryGuest && toggleGuestExpansion(guest.guestNumber)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Users className="w-5 h-5 mr-3 text-primary-600" />
              <div>
                <h4 className="font-semibold text-primary-900">
                  {guest.isPrimaryGuest ? 'Primary Guest' : `Additional Guest ${guest.guestNumber}`}
                </h4>
                <p className="text-sm text-primary-600">
                  {guest.firstName && guest.lastName 
                    ? `${guest.firstName} ${guest.lastName}` 
                    : `Guest ${guest.guestNumber}`
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center">
              {guest.hasDocument && (
                <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
              )}
              {!guest.isPrimaryGuest && (
                isExpanded ? 
                  <ChevronUp className="w-5 h-5 text-primary-600" /> :
                  <ChevronDown className="w-5 h-5 text-primary-600" />
              )}
            </div>
          </div>
        </div>

        {/* Document Upload Section - Always expanded for primary guest */}
        {(isExpanded || guest.isPrimaryGuest) && (
          <div className="p-4 sm:p-6 bg-white">
            <FileUpload
              onFileUpload={(file, url, filePath) => handleFileUpload(guest.guestNumber, file, url, filePath)}
              onError={(error) => handleUploadError(guest.guestNumber, error)}
              onDeleteExisting={() => handleDeleteExisting(guest.guestNumber)}
              initialImageUrl={guest.passportUrl}
              accept="image/*"
              maxSize={10 * 1024 * 1024} // 10MB
              className="w-full"
              showFileName={true}
              disabled={isReadOnly}
            />
            
            {/* Upload Error for this guest */}
            {uploadErrors[errorKey] && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-4">
                <div className="flex items-start">
                  <AlertCircle className="w-4 h-4 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-800 break-words">{uploadErrors[errorKey]}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }
  
  // Determine if we should show read-only view
  const isReadOnly = checkinCompleted && !isModificationMode

  return (
    <div>
      <div className="text-center mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-primary-900 mb-2">
          Document Upload
        </h2>
        <p className="text-sm sm:text-base text-primary-600">
          {isReadOnly 
            ? "Your submitted identification documents" 
            : isModificationMode 
              ? "Update identification documents"
              : `Please upload ID documents for ${numGuests > 1 ? 'all guests' : 'check-in'}`
          }
        </p>
      </div>

      {/* Read-only confirmation when check-in is completed */}
      {isReadOnly && (
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 sm:p-6 mb-6">
          <div className="flex items-center mb-4">
            <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-primary-600 mr-3 flex-shrink-0" />
            <h3 className="text-base sm:text-lg font-semibold text-primary-900">
              Documents Submitted
            </h3>
          </div>
          <p className="text-sm sm:text-base text-primary-800">
            All identification documents have been successfully uploaded and are currently under review.
          </p>
        </div>
      )}

      {/* Multi-guest progress indicator */}
      {numGuests > 1 && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <FileText className="w-5 h-5 text-blue-600 mr-2" />
              <span className="text-sm font-medium text-blue-900">
                Document Upload for {numGuests} guests
              </span>
            </div>
            <div className="text-sm text-blue-700">
              {guestDocuments.filter(g => g.hasDocument || g.passportUrl || g.passportFile).length} of {numGuests} uploaded
            </div>
          </div>
        </div>
      )}

      {/* Upload Instructions */}
      <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 sm:p-6 mb-6 sm:mb-8">
        <h3 className="text-base sm:text-lg font-semibold text-primary-900 mb-4">
          Document Requirements
        </h3>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <ul className="text-sm sm:text-base text-primary-700 space-y-2">
              <li>• Passport (preferred)</li>
              <li>• Driver's License</li>
              <li>• Government-issued ID</li>
            </ul>
          </div>          
        </div>
      </div>

      {/* Multi-Guest Document Upload Forms */}
      <div className="space-y-4 mb-6">
        <h3 className="text-base sm:text-lg font-semibold text-primary-900 mb-4 flex items-center">
          <FileText className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
          Upload Documents
          {numGuests > 1 && (
            <span className="ml-2 text-sm text-primary-600 font-normal">
              ({numGuests} guests)
            </span>
          )}
        </h3>
        
        {guestDocuments.map(renderGuestDocumentUpload)}
      </div>

      {/* Expand all additional guests button */}
      {numGuests > 1 && !isReadOnly && (
        <div className="text-center mb-6">
          <button
            type="button"
            onClick={() => {
              const allExpanded = guestDocuments.slice(1).every(g => expandedGuests.has(g.guestNumber))
              if (allExpanded) {
                // Collapse all except guest 1
                setExpandedGuests(new Set([1]))
              } else {
                // Expand all guests
                setExpandedGuests(new Set(guestDocuments.map(g => g.guestNumber)))
              }
            }}
            className="text-sm text-primary-600 hover:text-primary-800 flex items-center mx-auto"
          >
            <Users className="w-4 h-4 mr-2" />
            {guestDocuments.slice(1).every(g => expandedGuests.has(g.guestNumber)) 
              ? 'Collapse additional guests' 
              : 'Expand all additional guests'
            }
          </button>
        </div>
      )}

      {/* Security Notice */}
      <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 sm:p-4 mb-6 sm:mb-8">
        <div className="flex items-start">
          <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-primary-500 mr-3 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-semibold text-primary-900 mb-2">Why do we need these documents?</h4>
            <ul className="text-primary-600 text-xs sm:text-sm space-y-1">
              <li>• Identity verification and security purposes</li>
              <li>• Compliance with local registration laws</li>
              <li>• Property access and safety requirements</li>
            </ul>
          </div>
        </div>
      </div>

      <StepNavigation
        currentStep={3}
        totalSteps={4}
        onNext={handleNext}
        onPrevious={onPrevious}
        nextButtonText="Continue"
        isNextDisabled={!allDocumentsUploaded}
      />
    </div>
  )
}
