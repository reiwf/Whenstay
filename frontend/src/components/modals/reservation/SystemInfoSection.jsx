import { 
  Globe 
} from 'lucide-react'

export default function SystemInfoSection({ 
  formData, 
  setFormData
}) {
  return (
    <div className="space-y-6">
      <div>
        <h5 className="text-sm font-medium text-gray-800 mb-3 flex items-center">
          <Globe className="w-4 h-4 mr-2" />
          Beds24 Webhook Data
          <span className="ml-2 text-sm text-gray-600 font-normal">
            (System Information)
          </span>
        </h5>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Reference
            </label>
            <input
              type="text"
              value={formData.apiReference}
              onChange={(e) => setFormData({ ...formData, apiReference: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="API reference"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rate Description
            </label>
            <input
              type="text"
              value={formData.rateDescription}
              onChange={(e) => setFormData({ ...formData, rateDescription: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Rate description"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Language
            </label>
            <input
              type="text"
              value={formData.lang}
              onChange={(e) => setFormData({ ...formData, lang: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="en"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Booking Time
            </label>
            <input
              type="datetime-local"
              value={formData.bookingTime}
              onChange={(e) => setFormData({ ...formData, bookingTime: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Timestamp
            </label>
            <input
              type="datetime-local"
              value={formData.timeStamp}
              onChange={(e) => setFormData({ ...formData, timeStamp: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Message
            </label>
            <textarea
              value={formData.apiMessage}
              onChange={(e) => setFormData({ ...formData, apiMessage: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="API message"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
