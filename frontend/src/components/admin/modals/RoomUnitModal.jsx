import { useState } from 'react'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../LoadingSpinner'

export default function RoomUnitModal({ roomUnit, roomType, onSave, onClose }) {
  const [formData, setFormData] = useState({
    unitNumber: roomUnit?.unit_number || '',
    floorNumber: roomUnit?.floor_number || '',
    accessCode: roomUnit?.access_code || '',
    accessInstructions: roomUnit?.access_instructions || '',
    wifiName: roomUnit?.wifi_name || '',
    wifiPassword: roomUnit?.wifi_password || '',
    unitAmenities: roomUnit?.unit_amenities || '',
    maintenanceNotes: roomUnit?.maintenance_notes || ''
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      await onSave({
        unitNumber: formData.unitNumber,
        floorNumber: formData.floorNumber ? parseInt(formData.floorNumber) : null,
        accessCode: formData.accessCode,
        accessInstructions: formData.accessInstructions,
        wifiName: formData.wifiName,
        wifiPassword: formData.wifiPassword,
        unitAmenities: formData.unitAmenities,
        maintenanceNotes: formData.maintenanceNotes
      })
    } catch (error) {
      console.error('Error saving room unit:', error)
      toast.error('Failed to save room unit')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {roomUnit ? 'Edit Room Unit' : 'Add New Room Unit'}
            </h3>
            {roomType && (
              <p className="text-sm text-gray-600 mt-1">
                Room Type: <span className="font-medium">{roomType.name}</span>
              </p>
            )}
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unit Number *
                </label>
                <input
                  type="text"
                  required
                  value={formData.unitNumber}
                  onChange={(e) => setFormData({ ...formData, unitNumber: e.target.value })}
                  placeholder="e.g., 201, A1, Suite-A"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Floor Number
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.floorNumber}
                  onChange={(e) => setFormData({ ...formData, floorNumber: e.target.value })}
                  placeholder="e.g., 2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Access Code
                </label>
                <input
                  type="text"
                  value={formData.accessCode}
                  onChange={(e) => setFormData({ ...formData, accessCode: e.target.value })}
                  placeholder="e.g., 1234, #5678"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  WiFi Network Name
                </label>
                <input
                  type="text"
                  value={formData.wifiName}
                  onChange={(e) => setFormData({ ...formData, wifiName: e.target.value })}
                  placeholder="e.g., Room201_WiFi"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  WiFi Password
                </label>
                <input
                  type="text"
                  value={formData.wifiPassword}
                  onChange={(e) => setFormData({ ...formData, wifiPassword: e.target.value })}
                  placeholder="WiFi password for this unit"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Access Instructions
                </label>
                <textarea
                  value={formData.accessInstructions}
                  onChange={(e) => setFormData({ ...formData, accessInstructions: e.target.value })}
                  placeholder="Specific instructions for accessing this unit..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unit-Specific Amenities
                </label>
                <textarea
                  value={formData.unitAmenities}
                  onChange={(e) => setFormData({ ...formData, unitAmenities: e.target.value })}
                  placeholder="Additional amenities specific to this unit..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Maintenance Notes
                </label>
                <textarea
                  value={formData.maintenanceNotes}
                  onChange={(e) => setFormData({ ...formData, maintenanceNotes: e.target.value })}
                  placeholder="Any maintenance notes or special considerations..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md disabled:opacity-50 flex items-center"
              >
                {loading && <LoadingSpinner size="small" className="mr-2" />}
                {roomUnit ? 'Update Room Unit' : 'Create Room Unit'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
