import { 
  Clock, 
  BookImage, 
  FileText, 
  ExternalLink, 
  Check 
} from 'lucide-react'
import Section from '../../ui/Section'
import { ListGroup, ListRowLarge } from '../../ui/ListGroup'

export default function CheckinDetailsSection({ 
  formData, 
  setFormData, 
  reservation
}) {
  return (
    <div className="space-y-4">
      {/* Check-in Preferences */}
      <Section title="Check-in Preferences" subtitle="Preferences & arrival details">
        <ListGroup>
          <ListRowLarge
            left="Estimated Check-in Time"
            right={
              <input
                type="time"
                value={formData.estimatedCheckinTime}
                onChange={(e) => setFormData({ ...formData, estimatedCheckinTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            }
          />
          <ListRowLarge
            left="Travel Purpose"
            right={
              <select
                value={formData.travelPurpose}
                onChange={(e) => setFormData({ ...formData, travelPurpose: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select purpose</option>
                <option value="Business">Business</option>
                <option value="Leisure">Leisure</option>
                <option value="Family Visit">Family Visit</option>
                <option value="Medical">Medical</option>
                <option value="Education">Education</option>
                <option value="Other">Other</option>
              </select>
            }
          />
        </ListGroup>
      </Section>

      {/* Document Upload */}
      <Section title="Identity Document" subtitle="Uploaded identification">
        <ListGroup>
          <ListRowLarge
            left="Document Status"
            right={
              formData.passportUrl ? (
                <a
                  href={formData.passportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 text-sm underline flex items-center"
                >
                  <ExternalLink className="w-4 h-4 mr-1" />
                  View Document
                </a>
              ) : (
                <span className="text-sm text-gray-500">No document uploaded</span>
              )
            }
          />
          {formData.passportUrl && (
            <ListRowLarge
              left="Document URL"
              right={
                <input
                  type="url"
                  value={formData.passportUrl}
                  onChange={(e) => setFormData({ ...formData, passportUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="https://..."
                />
              }
            />
          )}
        </ListGroup>
      </Section>

      {/* Agreement Status */}
      <Section title="Agreement Status" subtitle="Guest agreement and check-in status">
        <ListGroup>
          <ListRowLarge
            left="Guest Agreement"
            right={
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="agreementAccepted"
                  checked={formData.agreementAccepted}
                  onChange={(e) => setFormData({ ...formData, agreementAccepted: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="agreementAccepted" className="text-sm font-medium text-gray-700">
                  Agreement Accepted
                </label>
                {formData.agreementAccepted && (
                  <Check className="w-4 h-4 text-green-600" />
                )}
              </div>
            }
          />
          {reservation?.checkin_submitted_at && (
            <ListRowLarge
              left="Check-in Submitted"
              right={
                <div className="text-sm">
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                    Submitted
                  </span>
                  <div className="text-gray-600 mt-1">
                    {new Date(reservation.checkin_submitted_at).toLocaleString()}
                  </div>
                </div>
              }
            />
          )}
        </ListGroup>
      </Section>
    </div>
  )
}
