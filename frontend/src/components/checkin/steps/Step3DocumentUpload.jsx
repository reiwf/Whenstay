import { useState } from 'react'
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react'
import FileUpload from '../../FileUpload'
import StepNavigation from '../shared/StepNavigation'

export default function Step3DocumentUpload({ 
  formData, 
  onUpdateFormData, 
  onNext, 
  onPrevious,
  checkinCompleted = false,
  isModificationMode = false,
  guestData = null
}) {
  const [uploadError, setUploadError] = useState('')

  const handleFileUpload = (file, url, filePath) => {
    onUpdateFormData({ 
      passportFile: file,
      passportUrl: url,
      passportFilePath: filePath
    })
    setUploadError('')
  }

  const handleUploadError = (error) => {
    setUploadError(error)
  }

  const handleDeleteExisting = async () => {
    // Clear the existing passport URL from form data
    onUpdateFormData({ 
      passportFile: null,
      passportUrl: null,
      passportFilePath: null
    })
    setUploadError('')
  }

  const handleNext = () => {
    if (!formData.passportFile && !formData.passportUrl) {
      setUploadError('Please upload a photo of your passport or ID document')
      return
    }
    onNext()
  }

  const isDocumentUploaded = formData.passportFile || formData.passportUrl
  
  // Determine if we should show read-only view
  const isReadOnly = checkinCompleted && !isModificationMode

  return (
    <div>
      <div className="text-center mb-2">
        <h2 className="text-xl font-bold text-primary-900 mb-2">
          Document Upload
        </h2>
        <p className="text-primary-600">
          {isReadOnly 
            ? "Your submitted identification document" 
            : isModificationMode 
              ? "Update your identification document"
              : "Please upload a clear photo of your passport or government-issued ID"
          }
        </p>
      </div>

      {/* Read-only confirmation when check-in is completed */}
      {isReadOnly && (
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-6 mb-6">
          <div className="flex items-center mb-4">
            <CheckCircle className="w-6 h-6 text-primary-600 mr-3" />
            <h3 className="text-lg font-semibold text-primary-900">
              Document Submitted
            </h3>
          </div>
          <p className="text-primary-800">
            Your identification document has been successfully uploaded and is currently under review.
          </p>
        </div>
      )}

      {/* Upload Instructions */}
      <div className="bg-primary-50 border border-primary-200 rounded-lg p-6 mb-8">
        <h3 className="text-lg font-semibold text-primary-900 mb-4">
          Document Requirements
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <ul className="text-primary-700 space-y-1">
              <li>• Passport (preferred)</li>
              <li>• Driver's License</li>
            </ul>
          </div>          
        </div>
      </div>

      {/* File Upload Section */}
      <div className="mb-6">
        <FileUpload
          onFileUpload={handleFileUpload}
          onError={handleUploadError}
          onDeleteExisting={handleDeleteExisting}
          initialImageUrl={formData.passportUrl}
          accept="image/*"
          maxSize={10 * 1024 * 1024} // 10MB
          className="w-full"
          showFileName={true}
          disabled={isReadOnly}
        />
      </div>

      {/* Upload Error */}
      {uploadError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
            <p className="text-red-800">{uploadError}</p>
          </div>
        </div>
      )}

      {/* Security Notice */}
      <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-8">
          <div className="flex items-start">
            <FileText className="w-5 h-5 text-primary-500 mr-3 mt-0.5" />
            <div>
            <ul className="text-primary-600 text-sm space-y-1">
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
        isNextDisabled={!isDocumentUploaded}
      />
    </div>
  )
}
