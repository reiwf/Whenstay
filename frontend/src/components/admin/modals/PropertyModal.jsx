import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../LoadingSpinner'
import { adminAPI } from '../../../services/api'

export default function PropertyModal({ property, onSave, onClose }) {
  const [formData, setFormData] = useState({
    name: property?.name || '',
    address: property?.address || '',
    description: property?.description || '',
    propertyType: property?.property_type || 'apartment',
    wifiName: property?.wifi_name || '',
    wifiPassword: property?.wifi_password || '',
    checkInInstructions: property?.check_in_instructions || '',
    houseRules: property?.house_rules || '',
    emergencyContact: property?.emergency_contact || '',
    accessTime: property?.access_time || '',
    defaultCleanerId: property?.default_cleaner_id || ''
  })
  const [loading, setLoading] = useState(false)
  const [cleaners, setCleaners] = useState([])
  const [loadingCleaners, setLoadingCleaners] = useState(true)

  // Load available cleaners when component mounts
  useEffect(() => {
    const loadCleaners = async () => {
      try {
        setLoadingCleaners(true)
        const response = await adminAPI.getAvailableCleaners()
        setCleaners(response.data.cleaners || [])
      } catch (error) {
        console.error('Error loading cleaners:', error)
        toast.error('Failed to load cleaners')
      } finally {
        setLoadingCleaners(false)
      }
    }

    loadCleaners()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      await onSave({
        name: formData.name,
        address: formData.address,
        description: formData.description,
        propertyType: formData.propertyType,
        wifiName: formData.wifiName,
        wifiPassword: formData.wifiPassword,
        checkInInstructions: formData.checkInInstructions,
        houseRules: formData.houseRules,
        emergencyContact: formData.emergencyContact,
        accessTime: formData.accessTime,
        defaultCleanerId: formData.defaultCleanerId || null
      })
    } catch (error) {
      console.error('Error saving property:', error)
      toast.error('Failed to save property')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {property ? 'Edit Property' : 'Add New Property'}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Property Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Sunset Beach Villa"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address *
                </label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g., 123 Ocean Drive, Miami Beach, FL 33139"
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
                  placeholder="Brief description of the property..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Property Type
                </label>
                <select
                  value={formData.propertyType}
                  onChange={(e) => setFormData({ ...formData, propertyType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="apartment">Apartment</option>
                  <option value="house">House</option>
                  <option value="villa">Villa</option>
                  <option value="studio">Studio</option>
                  <option value="condo">Condo</option>
                  <option value="hotel">Hotel</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Access Time *
                </label>
                <input
                  type="time"
                  value={formData.accessTime}
                  onChange={(e) => setFormData({ ...formData, accessTime: e.target.value })}
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
                  placeholder="e.g., SunsetBeach_WiFi"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  WiFi Password
                </label>
                <input
                  type="text"
                  value={formData.wifiPassword}
                  onChange={(e) => setFormData({ ...formData, wifiPassword: e.target.value })}
                  placeholder="WiFi password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Emergency Contact
                </label>
                <input
                  type="text"
                  value={formData.emergencyContact}
                  onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                  placeholder="e.g., +1 (555) 123-4567"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Default Cleaner
                </label>
                {loadingCleaners ? (
                  <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 flex items-center">
                    <LoadingSpinner size="small" className="mr-2" />
                    <span className="text-sm text-gray-500">Loading cleaners...</span>
                  </div>
                ) : (
                  <select
                    value={formData.defaultCleanerId}
                    onChange={(e) => setFormData({ ...formData, defaultCleanerId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">No default cleaner</option>
                    {cleaners.map((cleaner) => (
                      <option key={cleaner.id} value={cleaner.id}>
                        {cleaner.full_name || `${cleaner.first_name} ${cleaner.last_name}`}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Check-in Instructions
                </label>
                <textarea
                  value={formData.checkInInstructions}
                  onChange={(e) => setFormData({ ...formData, checkInInstructions: e.target.value })}
                  placeholder="Instructions for guests during check-in..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  House Rules
                </label>
                <textarea
                  value={formData.houseRules}
                  onChange={(e) => setFormData({ ...formData, houseRules: e.target.value })}
                  placeholder="Property rules and guidelines for guests..."
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
                {property ? 'Update Property' : 'Create Property'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
