import { useState } from '../../../../$node_modules/@types/react/index.js'
import { Upload, FileText, CheckCircle, AlertCircle } from '../../../../$node_modules/lucide-react/dist/lucide-react.js'
import FileUpload from '../../FileUpload'
import StepNavigation from '../shared/StepNavigation'

export default function Step3DocumentUpload({ 
  formData, 
  onUpdateFormData, 
  onNext, 
  onPrevious 
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

  const handleNext = () => {
    if (!formData.passportFile && !formData.passportUrl) {
      setUploadError('Please upload a photo of your passport or ID document')
      return
    }
    onNext()
  }

  const isDocumentUploaded = formData.passportFile || formData.passportUrl

  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Document Upload
        </h2>
        <p className="text-gray-600">
          Please upload a clear photo of your passport or government-issued ID
        </p>
      </div>

      {/* Upload Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">
          Document Requirements
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-blue-800 mb-2">Accepted Documents:</h4>
            <ul className="text-blue-700 space-y-1">
              <li>• Passport (preferred)</li>
              <li>• Driver's License</li>
              <li>• National ID Card</li>
              <li>• Government-issued Photo ID</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-blue-800 mb-2">Photo Guidelines:</h4>
            <ul className="text-blue-700 space-y-1">
              <li>• Clear, well-lit photo</li>
              <li>• All text must be readable</li>
              <li>• No glare or shadows</li>
              <li>• Document must be flat</li>
            </ul>
          </div>
        </div>
      </div>

      {/* File Upload Section */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 mb-6">
        {isDocumentUploaded ? (
          <div className="text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Document Uploaded Successfully
            </h3>
            <p className="text-gray-600 mb-4">
              Your {formData.passportFile?.name || 'document'} has been uploaded
            </p>
            <button
              onClick={() => onUpdateFormData({ passportFile: null, passportUrl: null })}
              className="text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              Upload a different document
            </button>
          </div>
        ) : (
          <div>
            <div className="text-center mb-6">
              <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Upload Your Document
              </h3>
              <p className="text-gray-600">
                Drag and drop your file here, or click to browse
              </p>
            </div>
            
            <FileUpload
              onFileUpload={handleFileUpload}
              onError={handleUploadError}
              accept="image/*"
              maxSize={10 * 1024 * 1024} // 10MB
              className="w-full"
            />
          </div>
        )}
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
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8">
        <div className="flex items-start">
          <FileText className="w-5 h-5 text-gray-500 mr-3 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">
              Privacy & Security
            </h4>
            <p className="text-gray-700 text-sm mb-2">
              Your document is encrypted and securely stored. We use this information only for:
            </p>
            <ul className="text-gray-600 text-sm space-y-1">
              <li>• Identity verification and security purposes</li>
              <li>• Compliance with local registration laws</li>
              <li>• Property access and safety requirements</li>
            </ul>
            <p className="text-gray-600 text-sm mt-2">
              Your document will be automatically deleted after your stay unless required by law.
            </p>
          </div>
        </div>
      </div>

      {/* Tips for Good Photos */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8">
        <h4 className="text-sm font-semibold text-yellow-900 mb-2">
          Tips for a Good Photo
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-yellow-800 text-sm">
          <ul className="space-y-1">
            <li>• Use good lighting (natural light works best)</li>
            <li>• Place document on a flat, dark surface</li>
            <li>• Hold camera directly above the document</li>
          </ul>
          <ul className="space-y-1">
            <li>• Ensure all corners are visible</li>
            <li>• Avoid shadows and reflections</li>
            <li>• Make sure text is sharp and readable</li>
          </ul>
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
