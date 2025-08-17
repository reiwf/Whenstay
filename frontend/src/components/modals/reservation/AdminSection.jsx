import { 
  UserCheck, 
  Clock, 
  ExternalLink, 
  Check 
} from 'lucide-react'

export default function AdminSection({ 
  formData, 
  setFormData, 
  reservation,
  copied,
  handleCopyCheckinUrl 
}) {
  return (
    <div className="space-y-6">
      {/* Verification Status */}
      <div>
        <h5 className="text-sm font-medium text-gray-800 mb-3 flex items-center">
          <UserCheck className="w-4 h-4 mr-2" />
          Verification Status
          <span className="ml-2 text-sm text-gray-600 font-normal">
            (Admin Controls & Verification)
          </span>
        </h5>
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="adminVerified"
              checked={formData.adminVerified}
              onChange={(e) => setFormData({ ...formData, adminVerified: e.target.checked })}
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <label htmlFor="adminVerified" className="text-sm font-medium text-gray-700">
              Admin Verified
            </label>
            {formData.adminVerified && (
              <Check className="w-4 h-4 text-green-600" />
            )}
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="accessRead"
              checked={formData.accessRead}
              onChange={(e) => setFormData({ ...formData, accessRead: e.target.checked })}
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <label htmlFor="accessRead" className="text-sm font-medium text-gray-700">
              Access Read
            </label>
            {formData.accessRead && (
              <Check className="w-4 h-4 text-green-600" />
            )}
          </div>

          {reservation?.verified_at && (
            <div className="p-2 bg-blue-50 border border-blue-200 rounded-md">
              <div className="text-sm text-blue-800">
                <strong>Verified At:</strong> {new Date(reservation.verified_at).toLocaleString()}
              </div>
              {reservation.verified_by_name && (
                <div className="text-sm text-blue-700">
                  <strong>Verified By:</strong> {reservation.verified_by_name} {reservation.verified_by_lastname}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* System Information */}
      {reservation && (
        <div>
          <h5 className="text-sm font-medium text-gray-800 mb-3 flex items-center">
            <Clock className="w-4 h-4 mr-2" />
            System Information
          </h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reservation.created_at && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Created At
                </label>
                <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm text-gray-600">
                  {new Date(reservation.created_at).toLocaleString()}
                </div>
              </div>
            )}

            {reservation.updated_at && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Updated
                </label>
                <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm text-gray-600">
                  {new Date(reservation.updated_at).toLocaleString()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Check-in URL Management */}
      {reservation?.check_in_token && (
        <div>
          <h5 className="text-sm font-medium text-gray-800 mb-3 flex items-center">
            <ExternalLink className="w-4 h-4 mr-2" />
            Check-in URL Management
          </h5>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Check-in URL
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={`${window.location.origin}/checkin/${reservation.check_in_token}`}
                  readOnly
                  className="flex-1 px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm text-gray-600"
                />
                <button
                  type="button"
                  onClick={handleCopyCheckinUrl}
                  className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
