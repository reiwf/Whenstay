import { 
  UserCheck, 
  Clock, 
  ExternalLink, 
  Check 
} from 'lucide-react'
import Section from '../../ui/Section'
import { ListGroup, ListRowLarge } from '../../ui/ListGroup'

export default function AdminSection({ 
  formData, 
  setFormData, 
  reservation,
  copied,
  handleCopyCheckinUrl 
}) {
  return (
    <div className="space-y-4">
      {/* Verification Status */}
      <Section title="Verification Status" subtitle="Admin controls & verification">
        <ListGroup>
          <ListRowLarge
            left="Admin Verified"
            right={
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="adminVerified"
                  checked={formData.adminVerified}
                  onChange={(e) => setFormData({ ...formData, adminVerified: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="adminVerified" className="text-sm font-medium text-gray-700">
                  Verified by Admin
                </label>
                {formData.adminVerified && (
                  <Check className="w-4 h-4 text-green-600" />
                )}
              </div>
            }
          />
          <ListRowLarge
            left="Access Read"
            right={
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="accessRead"
                  checked={formData.accessRead}
                  onChange={(e) => setFormData({ ...formData, accessRead: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="accessRead" className="text-sm font-medium text-gray-700">
                  Access Read Flag
                </label>
                {formData.accessRead && (
                  <Check className="w-4 h-4 text-green-600" />
                )}
              </div>
            }
          />
          {reservation?.verified_at && (
            <ListRowLarge
              left="Verification Details"
              right={
                <div className="text-sm">
                  <div className="text-gray-800">
                    <strong>Verified At:</strong> {new Date(reservation.verified_at).toLocaleString()}
                  </div>
                  {reservation.verified_by_name && (
                    <div className="text-gray-600 mt-1">
                      <strong>Verified By:</strong> {reservation.verified_by_name} {reservation.verified_by_lastname}
                    </div>
                  )}
                </div>
              }
            />
          )}
        </ListGroup>
      </Section>

      {/* System Information */}
      {reservation && (
        <Section title="System Information" subtitle="Creation and update timestamps">
          <ListGroup>
            {reservation.created_at && (
              <ListRowLarge
                left="Created At"
                right={
                  <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm text-gray-600">
                    {new Date(reservation.created_at).toLocaleString()}
                  </div>
                }
              />
            )}
            {reservation.updated_at && (
              <ListRowLarge
                left="Last Updated"
                right={
                  <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm text-gray-600">
                    {new Date(reservation.updated_at).toLocaleString()}
                  </div>
                }
              />
            )}
          </ListGroup>
        </Section>
      )}

      {/* Check-in URL Management */}
      {reservation?.check_in_token && (
        <Section title="Check-in URL Management" subtitle="Guest check-in URL controls">
          <ListGroup>
            <ListRowLarge
              left="Check-in URL"
              right={
                <div className="flex items-center space-x-2 w-full">
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
              }
            />
            <ListRowLarge
              left="Check-in Token"
              right={
                <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm text-gray-600 font-mono">
                  {reservation.check_in_token}
                </div>
              }
            />
          </ListGroup>
        </Section>
      )}
    </div>
  )
}
