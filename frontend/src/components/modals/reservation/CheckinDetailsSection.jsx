import { 
  Clock, 
  BookImage, 
  FileText, 
  ExternalLink, 
  Check 
} from 'lucide-react'

export default function CheckinDetailsSection({ 
  formData, 
  setFormData, 
  reservation
}) {
  return (
    <div className="space-y-6">
      {/* Check-in Preferences */}
      <div>
        <h5 className="text-sm font-medium text-gray-800 mb-3 flex items-center">
          <Clock className="w-4 h-4 mr-2" />
          Check-in Preferences
          <span className="ml-2 text-sm text-gray-600 font-normal">
            (Preferences & Documents)
          </span>
        </h5>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estimated Check-in Time
            </label>
            <input
              type="time"
              value={formData.estimatedCheckinTime}
              onChange={(e) => setFormData({ ...formData, estimatedCheckinTime: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Travel Purpose
            </label>
            <select
              value={formData.travelPurpose}
              onChange={(e) => setFormData({ ...formData, travelPurpose: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">Select purpose</option>
              <option value="Business">Business</option>
              <option value="Leisure">Leisure</option>
              <option value="Family Visit">Family Visit</option>
              <option value="Medical">Medical</option>
              <option value="Education">Education</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* Document Upload */}
      {formData.passportUrl && (
        <div>
          <h5 className="text-sm font-medium text-gray-800 mb-3 flex items-center">
            <BookImage className="w-4 h-4 mr-2" />
            Identity Document
          </h5>
          <div className="flex items-center space-x-2">
            <a
              href={formData.passportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:text-primary-800 text-sm underline flex items-center"
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              View Document
            </a>
          </div>
        </div>
      )}

      {/* Agreement Status */}
      <div>
        <h5 className="text-sm font-medium text-gray-800 mb-3 flex items-center">
          <FileText className="w-4 h-4 mr-2" />
          Agreement Status
        </h5>
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="agreementAccepted"
            checked={formData.agreementAccepted}
            onChange={(e) => setFormData({ ...formData, agreementAccepted: e.target.checked })}
            className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
          />
          <label htmlFor="agreementAccepted" className="text-sm font-medium text-gray-700">
            Guest Agreement Accepted
          </label>
          {formData.agreementAccepted && (
            <Check className="w-4 h-4 text-green-600" />
          )}
        </div>

        {reservation?.checkin_submitted_at && (
          <div className="mt-3 p-2 bg-green-100 border border-green-200 rounded-md">
            <div className="text-sm text-green-800">
              <strong>Check-in Submitted:</strong> {new Date(reservation.checkin_submitted_at).toLocaleString()}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
