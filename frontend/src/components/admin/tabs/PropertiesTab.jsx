import { useState } from 'react'
import { Plus, Building, MapPin, Wifi, Edit, Trash2, Home, Bed, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import PropertyModal from '../modals/PropertyModal'
import RoomTypeModal from '../modals/RoomTypeModal'
import RoomUnitModal from '../modals/RoomUnitModal'

export default function PropertiesTab({ 
  properties, 
  onCreateProperty, 
  onUpdateProperty, 
  onDeleteProperty,
  onCreateRoomType,
  onUpdateRoomType,
  onDeleteRoomType,
  onCreateRoomUnit,
  onUpdateRoomUnit,
  onDeleteRoomUnit,
  onRefresh,
  userRole
}) {
  const [showPropertyModal, setShowPropertyModal] = useState(false)
  const [showRoomTypeModal, setShowRoomTypeModal] = useState(false)
  const [showRoomUnitModal, setShowRoomUnitModal] = useState(false)
  const [editingProperty, setEditingProperty] = useState(null)
  const [editingRoomType, setEditingRoomType] = useState(null)
  const [editingRoomUnit, setEditingRoomUnit] = useState(null)
  const [selectedPropertyId, setSelectedPropertyId] = useState(null)
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState(null)
  const [expandedRoomTypes, setExpandedRoomTypes] = useState(new Set())

  const handleCreateProperty = async (propertyData) => {
    await onCreateProperty(propertyData)
    setShowPropertyModal(false)
    setEditingProperty(null)
  }

  const handleUpdateProperty = async (propertyData) => {
    await onUpdateProperty(editingProperty.id, propertyData)
    setShowPropertyModal(false)
    setEditingProperty(null)
  }


  const handleCreateRoomType = async (roomTypeData) => {
    await onCreateRoomType(selectedPropertyId, roomTypeData)
    setShowRoomTypeModal(false)
    setEditingRoomType(null)
    setSelectedPropertyId(null)
  }

  const handleUpdateRoomType = async (roomTypeData) => {
    await onUpdateRoomType(editingRoomType.id, roomTypeData)
    setShowRoomTypeModal(false)
    setEditingRoomType(null)
  }

  const handleCreateRoomUnit = async (roomUnitData) => {
    await onCreateRoomUnit(selectedRoomTypeId, roomUnitData)
    setShowRoomUnitModal(false)
    setEditingRoomUnit(null)
    setSelectedRoomTypeId(null)
  }

  const handleUpdateRoomUnit = async (roomUnitData) => {
    await onUpdateRoomUnit(editingRoomUnit.id, roomUnitData)
    setShowRoomUnitModal(false)
    setEditingRoomUnit(null)
  }

  const toggleRoomType = (roomTypeId) => {
    const newExpanded = new Set(expandedRoomTypes)
    if (newExpanded.has(roomTypeId)) {
      newExpanded.delete(roomTypeId)
    } else {
      newExpanded.add(roomTypeId)
    }
    setExpandedRoomTypes(newExpanded)
  }

  // Check if user has admin permissions (not owner role)
  const isReadOnly = userRole === 'owner'

  return (
    <div className="space-y-6">
      {/* Properties Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">
          {isReadOnly ? 'My Properties' : 'Property Management'}
        </h2>
        {!isReadOnly && (
          <button
            onClick={() => {
              setEditingProperty(null)
              setShowPropertyModal(true)
            }}
            className="btn-primary"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Property
          </button>
        )}
      </div>

      {/* Properties List */}
      {properties.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {properties.map((property) => (
            <div key={property.id} className="card">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{property.name}</h3>
                  <p className="text-sm text-gray-600 flex items-center mt-1">
                    <MapPin className="w-4 h-4 mr-1" />
                    {property.address}
                  </p>
                </div>
                {!isReadOnly && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        setEditingProperty(property)
                        setShowPropertyModal(true)
                      }}
                      className="text-gray-400 hover:text-primary-600"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDeleteProperty(property.id)}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Property Stats */}
              {property.stats && (
                <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-900">{property.stats.totalRooms}</p>
                    <p className="text-xs text-gray-600">Rooms</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-900">{property.stats.upcomingReservations}</p>
                    <p className="text-xs text-gray-600">Upcoming</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-900">${property.stats.totalRevenue?.toFixed(0) || 0}</p>
                    <p className="text-xs text-gray-600">Revenue</p>
                  </div>
                </div>
              )}

              {/* Property Details */}
              <div className="space-y-2 mb-4">
                {property.wifi_name && (
                  <p className="text-sm text-gray-600 flex items-center">
                    <Wifi className="w-4 h-4 mr-2" />
                    {property.wifi_name}
                  </p>
                )}
                {property.description && (
                  <p className="text-sm text-gray-600">{property.description}</p>
                )}
              </div>

              {/* Room Types (V5 Structure) */}
              {property.room_types && property.room_types.length > 0 && (
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-sm font-medium text-gray-900">
                      Room Types ({property.room_types.length})
                    </h4>
                    {!isReadOnly && (
                      <button
                        onClick={() => {
                          setSelectedPropertyId(property.id)
                          setEditingRoomType(null)
                          setShowRoomTypeModal(true)
                        }}
                        className="text-primary-600 hover:text-primary-700 text-sm"
                      >
                        <Plus className="w-3 h-3 inline mr-1" />
                        Add Room Type
                      </button>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    {property.room_types.map((roomType) => (
                      <div key={roomType.id} className="border border-gray-200 rounded-lg">
                        <div className="flex justify-between items-center p-3 bg-gray-50">
                          <div className="flex items-center">
                            <button
                              onClick={() => toggleRoomType(roomType.id)}
                              className="mr-2 text-gray-400 hover:text-gray-600"
                            >
                              {expandedRoomTypes.has(roomType.id) ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                            <Home className="w-4 h-4 mr-2 text-primary-600" />
                            <div>
                              <span className="text-sm font-medium">{roomType.name}</span>
                              <span className="text-xs text-gray-500 ml-2">
                                ({roomType.room_units?.length || 0} units)
                              </span>
                            </div>
                          </div>
                          {!isReadOnly && (
                            <div className="flex space-x-1">
                              <button
                                onClick={() => {
                                  setSelectedRoomTypeId(roomType.id)
                                  setEditingRoomUnit(null)
                                  setShowRoomUnitModal(true)
                                }}
                                className="text-primary-600 hover:text-primary-700 text-xs px-2 py-1 rounded"
                              >
                                Add Unit
                              </button>
                              <button
                                onClick={() => {
                                  setEditingRoomType(roomType)
                                  setShowRoomTypeModal(true)
                                }}
                                className="text-gray-400 hover:text-primary-600"
                              >
                                <Edit className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => onDeleteRoomType(roomType.id)}
                                className="text-gray-400 hover:text-red-600"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                        
                        {expandedRoomTypes.has(roomType.id) && roomType.room_units && (
                          <div className="p-3 space-y-2">
                            {roomType.room_units.map((unit) => (
                              <div key={unit.id} className="flex justify-between items-center p-2 bg-white border border-gray-100 rounded">
                                <div className="flex items-center">
                                  <Bed className="w-3 h-3 mr-2 text-gray-400" />
                                  <span className="text-sm">{unit.unit_number}</span>
                                  {unit.floor_number && (
                                    <span className="text-xs text-gray-500 ml-2">
                                      Floor {unit.floor_number}
                                    </span>
                                  )}
                                </div>
                                {!isReadOnly && (
                                  <div className="flex space-x-1">
                                    <button
                                      onClick={() => {
                                        setEditingRoomUnit(unit)
                                        setShowRoomUnitModal(true)
                                      }}
                                      className="text-gray-400 hover:text-primary-600"
                                    >
                                      <Edit className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => onDeleteRoomUnit(unit.id)}
                                      className="text-gray-400 hover:text-red-600"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Guidance for properties without room types */}
              {(!property.room_types || property.room_types.length === 0) && (
                <div className="text-center py-6 bg-blue-50 rounded-lg border border-blue-200">
                  <Home className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-blue-900 mb-1">No room types configured</p>
                  <p className="text-xs text-blue-700 mb-3">
                    Create room types to organize your rooms efficiently
                  </p>
                  {!isReadOnly && (
                    <button
                      onClick={() => {
                        setSelectedPropertyId(property.id)
                        setEditingRoomType(null)
                        setShowRoomTypeModal(true)
                      }}
                      className="btn-primary text-sm"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Create Room Type
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Building className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No properties found</p>
          <p className="text-sm text-gray-400 mt-2">
            Create your first property to get started
          </p>
        </div>
      )}

      {/* Property Modal */}
      {showPropertyModal && (
        <PropertyModal
          property={editingProperty}
          onSave={editingProperty ? handleUpdateProperty : handleCreateProperty}
          onClose={() => {
            setShowPropertyModal(false)
            setEditingProperty(null)
          }}
        />
      )}


      {/* Room Type Modal */}
      {showRoomTypeModal && (
        <RoomTypeModal
          roomType={editingRoomType}
          onSave={editingRoomType ? handleUpdateRoomType : handleCreateRoomType}
          onClose={() => {
            setShowRoomTypeModal(false)
            setEditingRoomType(null)
            setSelectedPropertyId(null)
          }}
        />
      )}

      {/* Room Unit Modal */}
      {showRoomUnitModal && (
        <RoomUnitModal
          roomUnit={editingRoomUnit}
          roomType={editingRoomUnit ? null : { id: selectedRoomTypeId }}
          onSave={editingRoomUnit ? handleUpdateRoomUnit : handleCreateRoomUnit}
          onClose={() => {
            setShowRoomUnitModal(false)
            setEditingRoomUnit(null)
            setSelectedRoomTypeId(null)
          }}
        />
      )}
    </div>
  )
}
