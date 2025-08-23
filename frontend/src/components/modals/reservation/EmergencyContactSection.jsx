import { 
  Phone 
} from 'lucide-react'
import Section from '../../ui/Section'
import { ListGroup, ListRowLarge } from '../../ui/ListGroup'

export default function EmergencyContactSection({ 
  formData, 
  setFormData
}) {
  return (
    <div className="space-y-4">
      {/* Emergency Contact Information */}
      <Section title="Emergency Contact Information" subtitle="Emergency contact details">
        <ListGroup>
          <ListRowLarge
            left="Emergency Contact Name"
            right={
              <input
                type="text"
                value={formData.emergencyContactName}
                onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Emergency contact person"
              />
            }
          />
          <ListRowLarge
            left="Emergency Contact Phone"
            right={
              <input
                type="tel"
                value={formData.emergencyContactPhone}
                onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="+1 (555) 123-4567"
              />
            }
          />
        </ListGroup>
      </Section>
    </div>
  )
}
