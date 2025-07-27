import { useState } from 'react'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../LoadingSpinner'

export default function RoomTypeModal({ roomType, onSave, onClose }) {
  const [formData, setFormData] = useState({
    name: roomType?.name || '',
    description: roomType?.description || '',
    maxGuests: roomType?.max_guests || 2,
    basePrice: roomType?.base_price || '',
    currency: roomType?.currency || 'USD',
    roomAmenities: roomType?.room_amenities || '',
    bedConfiguration: roomType?.bed_configuration || '',
    roomSizeSqm: roomType?.room_size_sqm || '',
    hasBalcony: roomType?.has_balcony || false,
    hasKitchen: roomType?.has_kitchen || false,
    isAccessible: roomType?.is_accessible || false
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      await onSave({
        name: formData.name,
        description: formData.description,
        maxGuests: parseInt(formData.maxGuests),
        basePrice: formData.basePrice ? parseFloat(formData.basePrice) : null,
        currency: formData.currency,
        roomAmenities: formData.roomAmenities,
        bedConfiguration: formData.bedConfiguration,
        roomSizeSqm: formData.roomSizeSqm ? parseFloat(formData.roomSizeSqm) : null,
        hasBalcony: formData.hasBalcony,
        hasKitchen: formData.hasKitchen,
        isAccessible: formData.isAccessible
      })
    } catch (error) {
      console.error('Error saving room type:', error)
      toast.error('Failed to save room type')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {roomType ? 'Edit Room Type' : 'Add New Room Type'}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Room Type Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Double Room, Suite, Studio"
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
                  placeholder="Brief description of this room type..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Guests *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max="20"
                  value={formData.maxGuests}
                  onChange={(e) => setFormData({ ...formData, maxGuests: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Base Price
                </label>
                <div className="flex">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.basePrice}
                    onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                    placeholder="0.00"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="px-3 py-2 border border-l-0 border-gray-300 rounded-r-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="JPY">JPY</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bed Configuration
                </label>
                <input
                  type="text"
                  value={formData.bedConfiguration}
                  onChange={(e) => setFormData({ ...formData, bedConfiguration: e.target.value })}
                  placeholder="e.g., 1 Queen Bed, 2 Single Beds"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Room Size (sqm)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.roomSizeSqm}
                  onChange={(e) => setFormData({ ...formData, roomSizeSqm: e.target.value })}
                  placeholder="e.g., 25.5"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Room Amenities
                </label>
                <textarea
                  value={formData.roomAmenities}
                  onChange={(e) => setFormData({ ...formData, roomAmenities: e.target.value })}
                  placeholder="e.g., Air conditioning, TV, Mini fridge, Safe..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Features
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="hasBalcony"
                      checked={formData.hasBalcony}
                      onChange={(e) => setFormData({ ...formData, hasBalcony: e.target.checked })}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="hasBalcony" className="ml-2 text-sm text-gray-700">
                      Has Balcony
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="hasKitchen"
                      checked={formData.hasKitchen}
                      onChange={(e) => setFormData({ ...formData, hasKitchen: e.target.checked })}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="hasKitchen" className="ml-2 text-sm text-gray-700">
                      Has Kitchen
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isAccessible"
                      checked={formData.isAccessible}
                      onChange={(e) => setFormData({ ...formData, isAccessible: e.target.checked })}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="isAccessible" className="ml-2 text-sm text-gray-700">
                      Wheelchair Accessible
                    </label>
                  </div>
                </div>
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
                {roomType ? 'Update Room Type' : 'Create Room Type'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
