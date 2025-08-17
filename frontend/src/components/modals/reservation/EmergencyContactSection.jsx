import { 
  Phone 
} from 'lucide-react'

export default function EmergencyContactSection({ 
  formData, 
  setFormData
}) {
  return (
    <div className="space-y-6">
      <div>
        <h5 className="text-sm font-medium text-gray-800 mb-3 flex items-center">
          <Phone className="w-4 h-4 mr-2" />
          Emergency Contact Information
          <span className="ml-2 text-sm text-gray-600 font-normal">
            (Emergency Information)
          </span>
        </h5>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Emergency Contact Name
            </label>
            <input
              type="text"
              value={formData.emergencyContactName}
              onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Emergency contact person"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Emergency Contact Phone
            </label>
            <input
              type="tel"
              value={formData.emergencyContactPhone}
              onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="+1 (555) 123-4567"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
