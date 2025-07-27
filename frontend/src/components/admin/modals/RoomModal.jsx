import { useState } from 'react'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../LoadingSpinner'

export default function RoomModal({ room, onSave, onClose }) {
  const [formData, setFormData] = useState({
    roomNumber: room?.room_number || '',
    roomName: room?.room_name || '',
    roomType: room?.room_type || 'standard',
    maxOccupancy: room?.max_occupancy || 2,
    bedConfiguration: room?.bed_configuration || '',
    amenities: room?.amenities || '',
    description: room?.description || '',
    basePrice: room?.base_price || '',
    beds24RoomId: room?.beds24_room_id || '',
    isActive: room?.is_active !== undefined ? room.is_active : true
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      await onSave({
        room_number: formData.roomNumber,
        room_name: formData.roomName,
        room_type: formData.roomType,
        max_occupancy: parseInt(formData.maxOccupancy),
        bed_configuration: formData.bedConfiguration,
        amenities: formData.amenities,
        description: formData.description,
        base_price: formData.basePrice ? parseFloat(formData.basePrice) : null,
        beds24_room_id: formData.beds24RoomId,
        is_active: formData.isActive
      })
    } catch (error) {
      console.error('Error saving room:', error)
      toast.error('Failed to save room')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {room ? 'Edit Room' : 'Add New Room'}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Room Number *
                </label>
                <input
                  type="text"
                  required
                  value={formData.roomNumber}
                  onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                  placeholder="e.g., 101, A1, Suite-1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Room Name
                </label>
                <input
                  type="text"
                  value={formData.roomName}
                  onChange={(e) => setFormData({ ...formData, roomName: e.target.value })}
                  placeholder="e.g., Ocean View Suite, Standard Room"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Room Type *
                </label>
                <select
                  required
                  value={formData.roomType}
                  onChange={(e) => setFormData({ ...formData, roomType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="standard">Standard</option>
                  <option value="deluxe">Deluxe</option>
                  <option value="suite">Suite</option>
                  <option value="penthouse">Penthouse</option>
                  <option value="studio">Studio</option>
                  <option value="apartment">Apartment</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Occupancy *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max="20"
                  value={formData.maxOccupancy}
                  onChange={(e) => setFormData({ ...formData, maxOccupancy: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bed Configuration
                </label>
                <input
                  type="text"
                  value={formData.bedConfiguration}
                  onChange={(e) => setFormData({ ...formData, bedConfiguration: e.target.value })}
                  placeholder="e.g., 1 King, 2 Queen, 1 King + 1 Sofa bed"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Base Price ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.basePrice}
                  onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                  placeholder="e.g., 150.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Beds24 Room ID
                </label>
                <input
                  type="text"
                  value={formData.beds24RoomId}
                  onChange={(e) => setFormData({ ...formData, beds24RoomId: e.target.value })}
                  placeholder="Beds24 room identifier"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="mr-2"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700">
                  Room is active and available for booking
                </label>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amenities
                </label>
                <input
                  type="text"
                  value={formData.amenities}
                  onChange={(e) => setFormData({ ...formData, amenities: e.target.value })}
                  placeholder="e.g., WiFi, TV, Air Conditioning, Mini Fridge"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detailed description of the room..."
                  rows={3}
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
                {room ? 'Update Room' : 'Create Room'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}




