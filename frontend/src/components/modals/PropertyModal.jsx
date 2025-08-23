import { useState, useEffect } from 'react'
import { X, Trash2, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import LoadingSpinner from '../LoadingSpinner'
import { adminAPI } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import Section from '../ui/Section'
import { ListGroup, ListRow, ListRowLarge } from '../ui/ListGroup'

const PROPERTY_TYPES = [
  { value: 'apartment', label: 'Apartment' },
  { value: 'house', label: 'House' },
  { value: 'villa', label: 'Villa' },
  { value: 'studio', label: 'Studio' },
  { value: 'condo', label: 'Condo' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'hostel', label: 'Hostel' },
  { value: 'guesthouse', label: 'Guest House' },
  { value: 'resort', label: 'Resort' },
  { value: 'other', label: 'Other' }
]

const PROPERTY_AMENITIES = [
  { value: 'pool', label: 'Swimming Pool', icon: '🏊' },
  { value: 'gym', label: 'Gym/Fitness Center', icon: '💪' },
  { value: 'parking', label: 'Parking', icon: '🚗' },
  { value: 'wifi', label: 'WiFi', icon: '📶' },
  { value: 'air_conditioning', label: 'Air Conditioning', icon: '❄️' },
  { value: 'heating', label: 'Heating', icon: '🔥' },
  { value: 'kitchen', label: 'Kitchen', icon: '🍳' },
  { value: 'laundry', label: 'Laundry', icon: '👕' },
  { value: 'balcony', label: 'Balcony/Terrace', icon: '🌅' },
  { value: 'garden', label: 'Garden', icon: '🌱' },
  { value: 'bbq', label: 'BBQ Area', icon: '🔥' },
  { value: 'elevator', label: 'Elevator', icon: '⬆️' },
  { value: 'concierge', label: 'Concierge', icon: '🤵' },
  { value: 'security', label: 'Security', icon: '🔒' },
  { value: 'cleaning', label: 'Cleaning Service', icon: '🧹' },
  { value: 'pets_allowed', label: 'Pets Allowed', icon: '🐕' },
  { value: 'smoking_allowed', label: 'Smoking Allowed', icon: '🚬' },
  { value: 'wheelchair_accessible', label: 'Wheelchair Accessible', icon: '♿' }
]

export default function PropertyModal({ property, onSave, onClose, onDelete }) {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [owners, setOwners] = useState([])
  const [cleaners, setCleaners] = useState([])
  const [loadingData, setLoadingData] = useState(true)

  const [formData, setFormData] = useState({
    // Basic Information
    name: property?.name || '',
    address: property?.address || '',
    description: property?.description || '',
    propertyType: property?.property_type || 'apartment',
    isActive: property?.is_active !== undefined ? property.is_active : true,
    accessTime: property?.access_time || '',
    departureTime: property?.departure_time || '',

    // Management
    ownerId: property?.owner_id || (profile?.role === 'owner' ? profile.id : ''),
    defaultCleanerId: property?.default_cleaner_id || '',
    entranceCode: property?.entrance_code || '',

    // Contact Information
    propertyEmail: property?.property_email || '',
    contactNumber: property?.contact_number || '',

    // Guest Experience
    wifiName: property?.wifi_name || '',
    wifiPassword: property?.wifi_password || '',
    checkInInstructions: property?.check_in_instructions || '',
    houseRules: property?.house_rules || '',

    // Location & Coordinates
    locationInfo: property?.location_info || {
      googlemaplink: '',
      trainstation: '',
      accessfromkix: '',
      landmarks: '',
      luggagestorage: ''
    },

    // Amenities
    propertyAmenities: property?.property_amenities || [],

    // Integration
    beds24PropertyId: property?.beds24_property_id || ''
  })

  // Load dependent data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingData(true)
        
        const promises = []
        
        // Load cleaners
        promises.push(adminAPI.getAvailableCleaners())
        
        // Load owners only for admins
        if (profile?.role === 'admin') {
          promises.push(adminAPI.getUsers({ role: 'owner' }))
        }
        
        const results = await Promise.all(promises)
        
        setCleaners(results[0]?.data?.cleaners || [])
        if (profile?.role === 'admin' && results[1]) {
          setOwners(results[1]?.data?.users || [])
        }
      } catch (error) {
        console.error('Error loading data:', error)
        toast.error('Failed to load required data')
      } finally {
        setLoadingData(false)
      }
    }

    loadData()
  }, [profile?.role])

  const handleInputChange = (field, value) => {
    if (field.includes('.')) {
      // Handle nested object fields (like locationInfo.latitude)
      const [parent, child] = field.split('.')
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }))
    }
  }

  const handleAmenityToggle = (amenityValue) => {
    setFormData(prev => ({
      ...prev,
      propertyAmenities: prev.propertyAmenities.includes(amenityValue)
        ? prev.propertyAmenities.filter(a => a !== amenityValue)
        : [...prev.propertyAmenities, amenityValue]
    }))
  }

  const validateForm = () => {
    const errors = []
    
    if (!formData.name.trim()) errors.push('Property name is required')
    if (!formData.address.trim()) errors.push('Address is required')
    if (profile?.role === 'admin' && !formData.ownerId) errors.push('Owner selection is required')
    
    if (errors.length > 0) {
      toast.error(errors[0])
      return false
    }
    
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) return
    
    setLoading(true)
    
    try {
      const submitData = {
        name: formData.name,
        address: formData.address,
        description: formData.description,
        propertyType: formData.propertyType,
        isActive: formData.isActive,
        ownerId: formData.ownerId,
        defaultCleanerId: formData.defaultCleanerId || null,
        accessTime: formData.accessTime,
        departureTime: formData.departureTime,
        entranceCode: formData.entranceCode,
        propertyEmail: formData.propertyEmail,
        contactNumber: formData.contactNumber,
        wifiName: formData.wifiName,
        wifiPassword: formData.wifiPassword,
        checkInInstructions: formData.checkInInstructions,
        houseRules: formData.houseRules,
        propertyAmenities: formData.propertyAmenities,
        locationInfo: formData.locationInfo,
        beds24PropertyId: formData.beds24PropertyId || null
      }

      await onSave(submitData)
      toast.success(property ? 'Property updated successfully' : 'Property created successfully')
    } catch (error) {
      console.error('Error saving property:', error)
      toast.error('Failed to save property')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!property || !onDelete) return
    
    if (!confirm(`Are you sure you want to delete "${property.name}"? This will also delete all associated room types and units. This action cannot be undone.`)) {
      return
    }

    try {
      await onDelete(property.id)
      toast.success('Property deleted successfully')
      onClose()
    } catch (error) {
      console.error('Error deleting property:', error)
      toast.error('Failed to delete property')
    }
  }

  if (loadingData) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-8 flex items-center space-x-3">
          <LoadingSpinner size="medium" />
          <span>Loading property data...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              {property ? 'Edit Property' : 'Add New Property'}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="space-y-1">
            {/* Basic Information Section */}
            <Section title="Basic Information" subtitle="Core property details and timing">
              <ListGroup>
                <ListRowLarge
                  left="Property Name *"
                  right={
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder="Abc Aparthotel"
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md 
                                focus:outline-none focus:ring-1 focus:ring-primary-500 text-right"
                    />
                  }
                />
                <ListRowLarge
                  left="Address *"
                  right={
                    <input
                      type="text"
                      required
                      value={formData.address}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      placeholder="Minamihorie 1-2-3"
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md 
                                focus:outline-none focus:ring-1 focus:ring-primary-500 text-right"
                    />
                  }
                />
                <ListRow
                  left="Property Type"
                  right={
                    <select
                      value={formData.propertyType}
                      onChange={(e) => handleInputChange('propertyType', e.target.value)}
                      className="w-48 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                    >
                      {PROPERTY_TYPES.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  }
                />
                <ListRow
                  left="Access Time"
                  right={
                    <input
                      type="time"
                      value={formData.accessTime}
                      onChange={(e) => handleInputChange('accessTime', e.target.value)}
                      className="w-48 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  }
                />
                <ListRow
                  left="Departure Time"
                  right={
                    <input
                      type="time"
                      value={formData.departureTime}
                      onChange={(e) => handleInputChange('departureTime', e.target.value)}
                      className="w-48 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  }
                />
                <ListRow
                  left="Active Property"
                  right={
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => handleInputChange('isActive', e.target.checked)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        {formData.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </label>
                  }
                />
              </ListGroup>
              <div className="px-4">
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Brief description of the property..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </Section>            

            {/* Contact Information Section */}
            <Section title="Contact Information" subtitle="Property contact details">
              <ListGroup>
                <ListRow
                  left="Property Email"
                  right={
                    <input
                      type="email"
                      value={formData.propertyEmail}
                      onChange={(e) => handleInputChange('propertyEmail', e.target.value)}
                      placeholder="e.g., info@property.com"
                      className="w-48 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  }
                />
                <ListRow
                  left="Contact Number"
                  right={
                    <input
                      type="tel"
                      value={formData.contactNumber}
                      onChange={(e) => handleInputChange('contactNumber', e.target.value)}
                      placeholder="e.g., +1 (555) 123-4567"
                      className="w-48 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  }
                />
              </ListGroup>
            </Section>

            {/* Guest Experience Section */}
            <Section title="Guest Experience" subtitle="WiFi and guest instructions">
              <ListGroup>
                <ListRow
                  left="Entrance Code"
                  right={
                    <input
                      type="text"
                      value={formData.entranceCode}
                      onChange={(e) => handleInputChange('entranceCode', e.target.value)}
                      placeholder="e.g., 1234 or A567B"
                      className="w-48 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  }
                />
                <ListRow
                  left="WiFi Network Name"
                  right={
                    <input
                      type="text"
                      value={formData.wifiName}
                      onChange={(e) => handleInputChange('wifiName', e.target.value)}
                      placeholder="e.g., SunsetBeach_WiFi"
                      className="w-48 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  }
                />
                <ListRow
                  left="WiFi Password"
                  right={
                    <input
                      type="text"
                      value={formData.wifiPassword}
                      onChange={(e) => handleInputChange('wifiPassword', e.target.value)}
                      placeholder="WiFi password"
                      className="w-48 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  }
                />
              </ListGroup>
              <div className="px-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Check-in Instructions
                  </label>
                  <textarea
                    value={formData.checkInInstructions}
                    onChange={(e) => handleInputChange('checkInInstructions', e.target.value)}
                    placeholder="Instructions for guests during check-in..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    House Rules
                  </label>
                  <textarea
                    value={formData.houseRules}
                    onChange={(e) => handleInputChange('houseRules', e.target.value)}
                    placeholder="Property rules and guidelines for guests..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              </div>
            </Section>

            {/* Location & Coordinates Section */}
            <Section title="Location & Coordinates" subtitle="Geographic information and local details">
              <ListGroup>
                <ListRow
                  left="Google Map Link"
                  right={
                    <input
                      type="text"
                      value={formData.locationInfo.googlemaplink}
                      onChange={(e) => handleInputChange('locationInfo.googlemaplink', e.target.value)}
                      placeholder="https://"
                      className="w-48 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  }
                />
                <ListRow
                  left="Train Station"
                  right={
                    <input
                      type="text"
                      value={formData.locationInfo.trainstation}
                      onChange={(e) => handleInputChange('locationInfo.trainstation', e.target.value)}
                      placeholder="Nippombashi"
                      className="w-48 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  }
                />
              </ListGroup>
              <div className="px-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Access from KIX
                  </label>
                  <textarea
                    value={formData.locationInfo.landmarks}
                    onChange={(e) => handleInputChange('locationInfo.landmarks', e.target.value)}
                    placeholder="from nankai line"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>                
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Nearby Landmarks
                  </label>
                  <textarea
                    value={formData.locationInfo.landmarks}
                    onChange={(e) => handleInputChange('locationInfo.landmarks', e.target.value)}
                    placeholder="e.g., 5 minutes walk to Shinsaibashi, near Glico"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Luggage Storage
                  </label>
                  <textarea
                    value={formData.locationInfo.transportation}
                    onChange={(e) => handleInputChange('locationInfo.transportation', e.target.value)}
                    placeholder="luggage storage"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              </div>
            </Section>

            {/* Amenities Section */}
            <Section title="Property Amenities" subtitle="Available facilities and services">
              <div className="px-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {PROPERTY_AMENITIES.map((amenity) => (
                    <label
                      key={amenity.value}
                      className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                        formData.propertyAmenities.includes(amenity.value)
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.propertyAmenities.includes(amenity.value)}
                        onChange={() => handleAmenityToggle(amenity.value)}
                        className="sr-only"
                      />
                      <span className="text-lg mr-2">{amenity.icon}</span>
                      <span className="text-sm flex-1">{amenity.label}</span>
                      {formData.propertyAmenities.includes(amenity.value) && (
                        <Check className="w-4 h-4 text-primary-600 flex-shrink-0" />
                      )}
                    </label>
                  ))}
                </div>
              </div>
            </Section>

            {/* Management Section */}
            <Section title="Management" subtitle="Property management settings">
              <ListGroup>
                {profile?.role === 'admin' && (
                  <ListRow
                    left="Property Owner *"
                    right={
                      loadingData ? (
                        <div className="flex items-center">
                          <LoadingSpinner size="small" className="mr-2" />
                          <span className="text-sm text-gray-500">Loading...</span>
                        </div>
                      ) : (
                        <select
                          value={formData.ownerId}
                          onChange={(e) => handleInputChange('ownerId', e.target.value)}
                          required
                          className="w-48 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                        >
                          <option value="">Select an owner</option>
                          {owners.map((owner) => (
                            <option key={owner.id} value={owner.id}>
                              {owner.first_name} {owner.last_name}
                              {owner.company_name && ` (${owner.company_name})`}
                            </option>
                          ))}
                        </select>
                      )
                    }
                  />
                )}
                <ListRow
                  left="Default Cleaner"
                  right={
                    loadingData ? (
                      <div className="flex items-center">
                        <LoadingSpinner size="small" className="mr-2" />
                        <span className="text-sm text-gray-500">Loading...</span>
                      </div>
                    ) : (
                      <select
                        value={formData.defaultCleanerId}
                        onChange={(e) => handleInputChange('defaultCleanerId', e.target.value)}
                        className="w-48 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                      >
                        <option value="">No default cleaner</option>
                        {cleaners.map((cleaner) => (
                          <option key={cleaner.id} value={cleaner.id}>
                            {cleaner.full_name || `${cleaner.first_name} ${cleaner.last_name}`}
                          </option>
                        ))}
                      </select>
                    )
                  }
                />                
              </ListGroup>
            </Section>

            {/* Integration Section */}
            <Section title="Integration" subtitle="External system connections">
              <ListGroup>
                <ListRow
                  left="Beds24 Property ID"
                  right={
                    <input
                      type="number"
                      value={formData.beds24PropertyId}
                      onChange={(e) => handleInputChange('beds24PropertyId', e.target.value)}
                      placeholder="e.g., 123456"
                      className="w-48 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  }
                />
              </ListGroup>
              <div className="px-4">
                <p className="text-xs text-slate-500">
                  Link this property to your Beds24 property for automatic booking sync
                </p>
              </div>
            </Section>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                {property && onDelete && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="flex items-center px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete Property
                  </button>
                )}
              </div>
              
              <div className="flex space-x-3">
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
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
