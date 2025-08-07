import { useState, useEffect } from 'react'
import { Home, Box, Settings, Bed, Wifi, Plus, X, Edit, Trash2, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../LoadingSpinner'
import { adminAPI } from '../../../services/api'

const ROOM_AMENITIES = [
  { value: 'air_conditioning', label: 'Air Conditioning', icon: '❄️' },
  { value: 'heating', label: 'Heating', icon: '🔥' },
  { value: 'tv', label: 'TV', icon: '📺' },
  { value: 'wifi', label: 'WiFi', icon: '📶' },
  { value: 'mini_fridge', label: 'Mini Fridge', icon: '🧊' },
  { value: 'microwave', label: 'Microwave', icon: '📱' },
  { value: 'coffee_maker', label: 'Coffee Maker', icon: '☕' },
  { value: 'safe', label: 'Safe', icon: '🔒' },
  { value: 'hairdryer', label: 'Hair Dryer', icon: '💨' },
  { value: 'iron', label: 'Iron', icon: '👔' },
  { value: 'desk', label: 'Desk', icon: '📝' },
  { value: 'chair', label: 'Chair', icon: '🪑' },
  { value: 'wardrobe', label: 'Wardrobe', icon: '👗' },
  { value: 'private_bathroom', label: 'Private Bathroom', icon: '🚿' },
  { value: 'towels', label: 'Towels', icon: '🛁' },
  { value: 'toiletries', label: 'Toiletries', icon: '🧴' },
  { value: 'blackout_curtains', label: 'Blackout Curtains', icon: '🌙' },
  { value: 'soundproof', label: 'Soundproof', icon: '🔇' }
]

const TABS = [
  { id: 'units', label: 'Room', icon: Bed },
  { id: 'basic', label: 'Basic Info', icon: Home },
  { id: 'space', label: 'Space', icon: Box },
  { id: 'amenities', label: 'Amenities & Features', icon: Settings },
  { id: 'integration', label: 'Integration', icon: Wifi }
]

export default function RoomTypeModal({ 
  roomType, 
  propertyId, 
  onCreateRoomType,
  onUpdateRoomType,
  onClose, 
  onCreateRoomUnit,
  onUpdateRoomUnit,
  onDeleteRoomUnit,
  onDeleteRoomType 
}) {
  const [activeTab, setActiveTab] = useState('basic')
  const [loading, setLoading] = useState(false)
  const [loadingUnits, setLoadingUnits] = useState(false)
  const [loadingRoomTypes, setLoadingRoomTypes] = useState(false)
  const [propertyRoomTypes, setPropertyRoomTypes] = useState([])
  const [selectedRoomType, setSelectedRoomType] = useState(roomType)
  const [roomUnits, setRoomUnits] = useState([])
  const [editingUnit, setEditingUnit] = useState(null)
  const [showUnitForm, setShowUnitForm] = useState(false)
  const [isCreatingNew, setIsCreatingNew] = useState(!roomType)

  const [formData, setFormData] = useState({
    // Basic Information
    name: roomType?.name || '',
    description: roomType?.description || '',
    maxGuests: roomType?.max_guests || 2,
    isActive: roomType?.is_active !== undefined ? roomType.is_active : true,

    // Space
    bedConfiguration: roomType?.bed_configuration || '',
    roomSizeSqm: roomType?.room_size_sqm || '',

    // Amenities & Features
    roomAmenities: roomType?.room_amenities || [],
    hasBalcony: roomType?.has_balcony || false,
    hasKitchen: roomType?.has_kitchen || false,
    isAccessible: roomType?.is_accessible || false,

    // Integration
    beds24RoomtypeId: roomType?.beds24_roomtype_id || ''
  })

  const [unitFormData, setUnitFormData] = useState({
    unitNumber: '',
    floorNumber: '',
    accessCode: '',
    accessInstructions: '',
    wifiName: '',
    wifiPassword: '',
    unitAmenities: [],
    maintenanceNotes: '',
    isActive: true,
    beds24UnitId: ''
  })

  // Load property room types and room units when modal opens
  useEffect(() => {
    if (propertyId) {
      loadPropertyRoomTypes()
    }
  }, [propertyId])

  useEffect(() => {
    if (selectedRoomType?.id) {
      loadRoomUnits()
    }
  }, [selectedRoomType?.id])

  const loadPropertyRoomTypes = async () => {
    if (!propertyId) return

    try {
      setLoadingRoomTypes(true)
      const response = await adminAPI.getRoomTypes(propertyId)
      setPropertyRoomTypes(response.data?.roomTypes || [])
    } catch (error) {
      console.error('Error loading room types:', error)
      toast.error('Failed to load room types')
    } finally {
      setLoadingRoomTypes(false)
    }
  }

  const loadRoomUnits = async () => {
    if (!selectedRoomType?.id) return

    try {
      setLoadingUnits(true)
      const response = await adminAPI.getRoomUnits(selectedRoomType.id)
      setRoomUnits(response.data?.roomUnits || [])
    } catch (error) {
      console.error('Error loading room units:', error)
      toast.error('Failed to load room units')
    } finally {
      setLoadingUnits(false)
    }
  }

  const handleSelectRoomType = (roomType) => {
    // Clear room units immediately to prevent showing old data
    setRoomUnits([])
    setEditingUnit(null)
    setShowUnitForm(false)
    
    setSelectedRoomType(roomType)
    setIsCreatingNew(false)
    setFormData({
      name: roomType?.name || '',
      description: roomType?.description || '',
      maxGuests: roomType?.max_guests || 2,
      isActive: roomType?.is_active !== undefined ? roomType.is_active : true,
      bedConfiguration: roomType?.bed_configuration || '',
      roomSizeSqm: roomType?.room_size_sqm || '',
      roomAmenities: roomType?.room_amenities || [],
      hasBalcony: roomType?.has_balcony || false,
      hasKitchen: roomType?.has_kitchen || false,
      isAccessible: roomType?.is_accessible || false,
      beds24RoomtypeId: roomType?.beds24_roomtype_id || ''
    })
    
    // The useEffect will handle loading room units when selectedRoomType changes
  }

  const handleCreateNew = () => {
    setSelectedRoomType(null)
    setIsCreatingNew(true)
    setFormData({
      name: '',
      description: '',
      maxGuests: 2,
      isActive: true,
      bedConfiguration: '',
      roomSizeSqm: '',
      roomAmenities: [],
      hasBalcony: false,
      hasKitchen: false,
      isAccessible: false,
      beds24RoomtypeId: ''
    })
    setRoomUnits([])
  }

  const handleDeleteRoomType = async (roomTypeId) => {
    if (!confirm('Are you sure you want to delete this room type? This will also delete all associated room units.')) return

    try {
      await onDeleteRoomType(roomTypeId)
      toast.success('Room type deleted successfully')
      loadPropertyRoomTypes()
      if (selectedRoomType?.id === roomTypeId) {
        handleCreateNew()
      }
    } catch (error) {
      console.error('Error deleting room type:', error)
      toast.error('Failed to delete room type')
    }
  }

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleUnitInputChange = (field, value) => {
    setUnitFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleAmenityToggle = (amenityValue) => {
    setFormData(prev => ({
      ...prev,
      roomAmenities: prev.roomAmenities.includes(amenityValue)
        ? prev.roomAmenities.filter(a => a !== amenityValue)
        : [...prev.roomAmenities, amenityValue]
    }))
  }

  const handleUnitAmenityToggle = (amenityValue) => {
    setUnitFormData(prev => ({
      ...prev,
      unitAmenities: prev.unitAmenities.includes(amenityValue)
        ? prev.unitAmenities.filter(a => a !== amenityValue)
        : [...prev.unitAmenities, amenityValue]
    }))
  }

  const validateForm = () => {
    const errors = []
    
    if (!formData.name.trim()) errors.push('Room type name is required')
    if (formData.maxGuests < 1) errors.push('Max guests must be at least 1')
    if (formData.roomSizeSqm && formData.roomSizeSqm < 0) errors.push('Room size cannot be negative')
    
    if (errors.length > 0) {
      toast.error(errors[0])
      return false
    }
    
    return true
  }

  const validateUnitForm = () => {
    if (!unitFormData.unitNumber.trim()) {
      toast.error('Unit number is required')
      return false
    }
    
    // Check for duplicate unit numbers
    const existingUnit = roomUnits.find(unit => 
      unit.unit_number === unitFormData.unitNumber && 
      unit.id !== editingUnit?.id
    )
    if (existingUnit) {
      toast.error('Unit number already exists')
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
        propertyId: propertyId,
        name: formData.name,
        description: formData.description,
        maxGuests: parseInt(formData.maxGuests),
        bedConfiguration: formData.bedConfiguration,
        roomSizeSqm: formData.roomSizeSqm ? parseInt(formData.roomSizeSqm) : null,
        roomAmenities: formData.roomAmenities,
        hasBalcony: formData.hasBalcony,
        hasKitchen: formData.hasKitchen,
        isAccessible: formData.isAccessible,
        isActive: formData.isActive,
        beds24RoomtypeId: formData.beds24RoomtypeId || null
      }

      // Determine if we're creating new or updating existing
      const isUpdating = selectedRoomType && !isCreatingNew
      
      if (isUpdating) {
        await onUpdateRoomType(selectedRoomType.id, submitData)
      } else {
        await onCreateRoomType(submitData)
      }
      
      // Refresh the room types list to show updated data
      loadPropertyRoomTypes()
      
      if (!isUpdating) {
        // Reset to show the creation was successful
        setIsCreatingNew(false)
      }
    } catch (error) {
      console.error('Error saving room type:', error)
      toast.error('Failed to save room type')
    } finally {
      setLoading(false)
    }
  }

  const handleUnitSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateUnitForm()) return
    
    try {
      const submitData = {
        roomTypeId: selectedRoomType?.id,
        unitNumber: unitFormData.unitNumber,
        floorNumber: unitFormData.floorNumber ? parseInt(unitFormData.floorNumber) : null,
        accessCode: unitFormData.accessCode,
        accessInstructions: unitFormData.accessInstructions,
        wifiName: unitFormData.wifiName,
        wifiPassword: unitFormData.wifiPassword,
        unitAmenities: unitFormData.unitAmenities,
        maintenanceNotes: unitFormData.maintenanceNotes,
        isActive: unitFormData.isActive,
        beds24UnitId: unitFormData.beds24UnitId || null
      }

      if (editingUnit) {
        await onUpdateRoomUnit(editingUnit.id, submitData)
        toast.success('Room unit updated successfully')
      } else {
        await onCreateRoomUnit(selectedRoomType.id, submitData)
        toast.success('Room unit created successfully')
      }
      
      // Reset form and reload units
      setUnitFormData({
        unitNumber: '',
        floorNumber: '',
        accessCode: '',
        accessInstructions: '',
        wifiName: '',
        wifiPassword: '',
        unitAmenities: [],
        maintenanceNotes: '',
        isActive: true,
        beds24UnitId: ''
      })
      setEditingUnit(null)
      setShowUnitForm(false)
      loadRoomUnits()
    } catch (error) {
      console.error('Error saving room unit:', error)
      toast.error('Failed to save room unit')
    }
  }

  const handleDeleteUnit = async (unitId) => {
    if (!confirm('Are you sure you want to delete this room unit?')) return

    try {
      await onDeleteRoomUnit(unitId)
      toast.success('Room unit deleted successfully')
      loadRoomUnits()
    } catch (error) {
      console.error('Error deleting room unit:', error)
      toast.error('Failed to delete room unit')
    }
  }

  const handleEditUnit = (unit) => {
    setUnitFormData({
      unitNumber: unit.unit_number || '',
      floorNumber: unit.floor_number || '',
      accessCode: unit.access_code || '',
      accessInstructions: unit.access_instructions || '',
      wifiName: unit.wifi_name || '',
      wifiPassword: unit.wifi_password || '',
      unitAmenities: unit.unit_amenities || [],
      maintenanceNotes: unit.maintenance_notes || '',
      isActive: unit.is_active !== undefined ? unit.is_active : true,
      beds24UnitId: unit.beds24_unit_id || ''
    })
    setEditingUnit(unit)
    setShowUnitForm(true)
  }

  const renderBasicTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Room Type Name *
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            placeholder="e.g., Deluxe Suite, Standard Room, Penthouse"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="Brief description of this room type..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Maximum Guests *
          </label>
          <input
            type="number"
            required
            min="1"
            max="20"
            value={formData.maxGuests}
            onChange={(e) => handleInputChange('maxGuests', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <div className="flex items-center space-x-3">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => handleInputChange('isActive', e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="ml-2 text-sm text-gray-700">
                Active Room Type
              </span>
            </label>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Inactive room types won't appear in bookings
          </p>
        </div>
      </div>
    </div>
  )

  const renderSpaceTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Room Size (sqm)
          </label>
          <input
            type="number"
            min="0"
            value={formData.roomSizeSqm}
            onChange={(e) => handleInputChange('roomSizeSqm', e.target.value)}
            placeholder="e.g., 25"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Bed Configuration
          </label>
          <input
            type="text"
            value={formData.bedConfiguration}
            onChange={(e) => handleInputChange('bedConfiguration', e.target.value)}
            placeholder="e.g., 1 Queen Bed, 2 Single Beds, 1 King Bed + 1 Sofa Bed"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>
    </div>
  )

  const renderAmenitiesTab = () => (
    <div className="space-y-6">
      {/* Special Features */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 mb-3">Special Features</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="hasBalcony"
              checked={formData.hasBalcony}
              onChange={(e) => handleInputChange('hasBalcony', e.target.checked)}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="hasBalcony" className="ml-2 text-sm text-gray-700">
              Has Balcony/Terrace
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="hasKitchen"
              checked={formData.hasKitchen}
              onChange={(e) => handleInputChange('hasKitchen', e.target.checked)}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="hasKitchen" className="ml-2 text-sm text-gray-700">
              Has Kitchen/Kitchenette
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="isAccessible"
              checked={formData.isAccessible}
              onChange={(e) => handleInputChange('isAccessible', e.target.checked)}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="isAccessible" className="ml-2 text-sm text-gray-700">
              Wheelchair Accessible
            </label>
          </div>
        </div>
      </div>

      {/* Room Amenities */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 mb-3">Room Amenities</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {ROOM_AMENITIES.map((amenity) => (
            <label
              key={amenity.value}
              className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                formData.roomAmenities.includes(amenity.value)
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input
                type="checkbox"
                checked={formData.roomAmenities.includes(amenity.value)}
                onChange={() => handleAmenityToggle(amenity.value)}
                className="sr-only"
              />
              <span className="text-lg mr-2">{amenity.icon}</span>
              <span className="text-sm">{amenity.label}</span>
              {formData.roomAmenities.includes(amenity.value) && (
                <Check className="w-4 h-4 ml-auto text-primary-600" />
              )}
            </label>
          ))}
        </div>
      </div>
    </div>
  )

  const renderUnitsTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h4 className="text-sm font-medium text-gray-900">Room Units</h4>
          <p className="text-xs text-gray-500">
            {selectedRoomType && !isCreatingNew 
              ? `Total: ${roomUnits.length} room units for this room type`
              : 'Select a room type to manage its units'
            }
          </p>
        </div>
        {selectedRoomType && !isCreatingNew && (
          <button
            onClick={() => {
              setEditingUnit(null)
              setUnitFormData({
                unitNumber: '',
                floorNumber: '',
                accessCode: '',
                accessInstructions: '',
                wifiName: '',
                wifiPassword: '',
                unitAmenities: [],
                maintenanceNotes: '',
                isActive: true,
                beds24UnitId: ''
              })
              setShowUnitForm(true)
            }}
            className="inline-flex items-center px-3 py-1.5 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
          >
            <Plus className="w-3 h-3 mr-1" />
            Add Unit
          </button>
        )}
      </div>

      {(!selectedRoomType || isCreatingNew) && (
        <div className="text-center py-8 text-gray-500">
          <Bed className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <p>{isCreatingNew ? 'Please save the room type first to manage room units' : 'Select a room type to manage its units'}</p>
        </div>
      )}

      {selectedRoomType && !isCreatingNew && (
        <>
          {/* Unit Form */}
          {showUnitForm && (
            <div className="bg-gray-50 p-4 rounded-lg border">
              <div className="flex justify-between items-center mb-4">
                <h5 className="text-sm font-medium">
                  {editingUnit ? 'Edit Room Unit' : 'Add New Room Unit'}
                </h5>
                <button
                  onClick={() => {
                    setShowUnitForm(false)
                    setEditingUnit(null)
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleUnitSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Unit Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={unitFormData.unitNumber}
                      onChange={(e) => handleUnitInputChange('unitNumber', e.target.value)}
                      placeholder="e.g., 101, A1, Suite-1"
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>

                   <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Beds24 Unit ID
                    </label>
                    <input
                      type="number"
                      value={unitFormData.beds24UnitId}
                      onChange={(e) => handleUnitInputChange('beds24UnitId', e.target.value)}
                      placeholder="e.g., 789123"
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Access Code
                    </label>
                    <input
                      type="text"
                      value={unitFormData.accessCode}
                      onChange={(e) => handleUnitInputChange('accessCode', e.target.value)}
                      placeholder="Door/lock code"
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Floor Number
                    </label>
                    <input
                      type="number"
                      value={unitFormData.floorNumber}
                      onChange={(e) => handleUnitInputChange('floorNumber', e.target.value)}
                      placeholder="e.g., 1, 2, 3"
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Access Instructions
                    </label>
                    <textarea
                      value={unitFormData.accessInstructions}
                      onChange={(e) => handleUnitInputChange('accessInstructions', e.target.value)}
                      placeholder="Instructions for accessing this unit..."
                      rows={2}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUnitForm(false)
                      setEditingUnit(null)
                    }}
                    className="px-3 py-1.5 text-xs text-gray-600 bg-gray-200 rounded hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 text-xs text-white bg-primary-600 rounded hover:bg-primary-700"
                  >
                    {editingUnit ? 'Update Unit' : 'Add Unit'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Units List */}
          <div>
            {loadingUnits ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner size="small" className="mr-2" />
                <span className="text-sm text-gray-500">Loading room units...</span>
              </div>
            ) : roomUnits.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Bed className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">No room units yet</p>
                <p className="text-xs">Add your first room unit to get started</p>
              </div>
            ) : (
              <div className="space-y-2">
                {roomUnits.map((unit) => (
                  <div key={unit.id} className="flex items-center justify-between p-3 bg-white border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Bed className="w-4 h-4 text-gray-500" />
                      <div>
                        <div className="text-sm font-medium">
                          {unit.unit_number}
                          {unit.floor_number && ` (Floor ${unit.floor_number})`}
                        </div>
                        {unit.access_code && (
                          <div className="text-xs text-gray-500">
                            Access: {unit.access_code}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {!unit.is_active && (
                        <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded">
                          Inactive
                        </span>
                      )}
                      <button
                        onClick={() => handleEditUnit(unit)}
                        className="text-gray-500 hover:text-primary-600"
                        title="Edit Unit"
                      >
                        <Edit className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteUnit(unit.id)}
                        className="text-gray-500 hover:text-red-600"
                        title="Delete Unit"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )

  const renderIntegrationTab = () => (
    <div className="space-y-6">
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="text-sm font-medium text-gray-900 mb-2">External Integrations</h4>
        <p className="text-sm text-gray-600 mb-4">
          Connect this room type with external booking and management systems.
        </p>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Beds24 Room Type ID
          </label>
          <input
            type="number"
            value={formData.beds24RoomtypeId}
            onChange={(e) => handleInputChange('beds24RoomtypeId', e.target.value)}
            placeholder="e.g., 123456"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Link this room type to your Beds24 room type for automatic booking sync
          </p>
        </div>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-6xl w-full h-[90vh] overflow-hidden flex">
        {/* Room Type Selector Sidebar */}
        <div className="w-80 bg-gray-50 border-r border-gray-200 flex flex-col">
          <div className="px-4 py-4 border-b border-gray-200">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Room Types</h4>
            <button
              onClick={handleCreateNew}
              className={`w-full px-3 py-2 text-sm rounded-md border-2 border-dashed transition-colors ${
                isCreatingNew 
                  ? 'border-primary-500 bg-primary-50 text-primary-700' 
                  : 'border-gray-300 text-gray-600 hover:border-gray-400'
              }`}
            >
              <Plus className="w-4 h-4 mx-auto mb-1" />
              Create New Room Type
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            {loadingRoomTypes ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner size="small" />
              </div>
            ) : propertyRoomTypes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Home className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">No room types yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {propertyRoomTypes.map((rt) => (
                  <div
                    key={rt.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedRoomType?.id === rt.id
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                    onClick={() => handleSelectRoomType(rt)}
                  >
                    <div className="flex-1 min-w-0">
                      <h5 className="text-sm font-medium text-gray-900 truncate">
                        {rt.name}
                      </h5>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {isCreatingNew 
                  ? 'Create New Room Type' 
                  : selectedRoomType 
                    ? `Edit: ${selectedRoomType.name}`
                    : 'Select a Room Type'
                }
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-6 border-b border-gray-200">
            <nav className="flex space-x-8" aria-label="Tabs">
              {TABS.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                      activeTab === tab.id
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'units' ? (
              <div className="p-6">
                {renderUnitsTab()}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="h-full flex flex-col">
                <div className="p-6 flex-1">
                  {activeTab === 'basic' && renderBasicTab()}
                  {activeTab === 'space' && renderSpaceTab()}
                  {activeTab === 'amenities' && renderAmenitiesTab()}
                  {activeTab === 'integration' && renderIntegrationTab()}
                </div>

                {/* Footer for Room Type Form */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-4">
                      {selectedRoomType && !isCreatingNew && (
                        <button
                          type="button"
                          onClick={() => handleDeleteRoomType(selectedRoomType.id)}
                          className="flex items-center text-sm text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
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

                      {/* Save/Create and Next buttons */}
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md disabled:opacity-50 flex items-center"
                      >
                        {loading && <LoadingSpinner size="small" className="mr-2" />}
                        {selectedRoomType ? 'Update' : 'Create'}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            )}
           
          </div>
        </div>
      </div>
    </div>
  )
}
