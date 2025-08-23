import { 
  Globe 
} from 'lucide-react'
import Section from '../../ui/Section'
import { ListGroup, ListRowLarge } from '../../ui/ListGroup'

export default function SystemInfoSection({ 
  formData, 
  setFormData
}) {
  return (
    <div className="space-y-4">
      <Section title="Beds24 Webhook Data" subtitle="System information from booking platform">
        <ListGroup>
          <ListRowLarge
            left="API Reference"
            right={
              <input
                type="text"
                value={formData.apiReference}
                onChange={(e) => setFormData({ ...formData, apiReference: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="API reference"
              />
            }
          />
          <ListRowLarge
            left="Rate Description"
            right={
              <input
                type="text"
                value={formData.rateDescription}
                onChange={(e) => setFormData({ ...formData, rateDescription: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Rate description"
              />
            }
          />
          <ListRowLarge
            left="Language"
            right={
              <input
                type="text"
                value={formData.lang}
                onChange={(e) => setFormData({ ...formData, lang: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="en"
              />
            }
          />
          <ListRowLarge
            left="Booking Time"
            right={
              <input
                type="datetime-local"
                value={formData.bookingTime}
                onChange={(e) => setFormData({ ...formData, bookingTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            }
          />
          <ListRowLarge
            left="Timestamp"
            right={
              <input
                type="datetime-local"
                value={formData.timeStamp}
                onChange={(e) => setFormData({ ...formData, timeStamp: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            }
          />
          <ListRowLarge
            left="API Message"
            right={
              <textarea
                value={formData.apiMessage}
                onChange={(e) => setFormData({ ...formData, apiMessage: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="API message"
              />
            }
          />
        </ListGroup>
      </Section>
    </div>
  )
}
