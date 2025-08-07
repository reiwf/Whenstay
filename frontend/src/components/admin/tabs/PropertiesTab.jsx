import { useState, useMemo } from 'react'
import { Plus, Building, MapPin, Wifi, Edit, Trash2, Home, Bed, ChevronDown, ChevronRight, Eye } from 'lucide-react'
import { DataTableAdvanced, EmptyState } from '../../ui'
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

  // Define columns for the properties table
  const columns = useMemo(() => [
    {
      accessorKey: 'name',
      header: 'Property Name',
      cell: ({ getValue, row }) => (
        <div className="flex items-center">
          <Building className="w-4 h-4 mr-2 text-primary-600" />
          <span className="font-medium text-gray-900">{getValue()}</span>
        </div>
      ),
    },
    {
      accessorKey: 'address',
      header: 'Location',
      cell: ({ getValue }) => (
        <div className="flex items-center text-gray-600">
          <MapPin className="w-4 h-4 mr-1" />
          {getValue()}
        </div>
      ),
    },
    {
      accessorKey: 'room_types',
      header: 'Room Types & Units',
      cell: ({ getValue, row }) => {
        const roomTypes = getValue() || [];
        const property = row.original;
        const isExpanded = expandedRoomTypes.has(property.id);
        
        if (roomTypes.length === 0) {
          return (
            <div className="flex items-center space-x-2 text-gray-400">
              <Home className="w-4 h-4" />
              <span>No room types</span>
            </div>
          );
        }

        const totalUnits = roomTypes.reduce((sum, rt) => sum + (rt.room_units?.length || 0), 0);
        
        return (
          <div className="space-y-2">
            {/* Summary row */}
            <div 
              className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
              onClick={() => toggleRoomType(property.id)}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              )}
              <Home className="w-4 h-4 text-gray-500" />
              <span className="text-sm">{roomTypes.length} types</span>
              <Bed className="w-3 h-3 text-gray-400 ml-2" />
              <span className="text-sm text-gray-500">{totalUnits} units</span>
            </div>
            
            {/* Expanded details */}
            {isExpanded && (
              <div className="ml-6 space-y-3 border-l-2 border-gray-200 pl-3">
                {roomTypes.map((roomType) => (
                  <div key={roomType.id} className="space-y-2">
                    {/* Room Type */}
                    <div className="flex items-center justify-between bg-blue-50 p-2 rounded">
                      <div className="flex items-center space-x-2">
                        <Home className="w-3 h-3 text-blue-600" />
                        <span className="text-sm font-medium text-blue-900">
                          {roomType.name}
                        </span>
                        <span className="text-xs text-blue-600">
                          ({roomType.room_units?.length || 0} units)
                        </span>
                      </div>
                      {!isReadOnly && (
                        <div className="flex space-x-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingRoomType(roomType);
                              setShowRoomTypeModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-800"
                            title="Edit Room Type"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Delete room type "${roomType.name}"?`)) {
                                onDeleteRoomType(roomType.id);
                              }
                            }}
                            className="text-red-600 hover:text-red-800"
                            title="Delete Room Type"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {/* Room Units */}
                    {roomType.room_units && roomType.room_units.length > 0 && (
                      <div className="ml-4 space-y-1">
                        {roomType.room_units.map((unit) => (
                          <div key={unit.id} className="flex items-center justify-between bg-green-50 p-1.5 rounded text-xs">
                            <div className="flex items-center space-x-2">
                              <Bed className="w-3 h-3 text-green-600" />
                              <span className="text-green-900">
                                {unit.unit_number}
                                {unit.floor_number && ` (Floor ${unit.floor_number})`}
                              </span>
                            </div>
                            {!isReadOnly && (
                              <div className="flex space-x-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingRoomUnit(unit);
                                    setShowRoomUnitModal(true);
                                  }}
                                  className="text-green-600 hover:text-green-800"
                                  title="Edit Room Unit"
                                >
                                  <Edit className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm(`Delete unit ${unit.unit_number}?`)) {
                                      onDeleteRoomUnit(unit.id);
                                    }
                                  }}
                                  className="text-red-600 hover:text-red-800"
                                  title="Delete Room Unit"
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
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'stats',
      header: 'Performance',
      cell: ({ getValue }) => {
        const stats = getValue();
        if (!stats) return <span className="text-gray-400">-</span>;
        return (
          <div className="space-y-1">
            <div className="text-sm">
              <span className="text-gray-600">Revenue: </span>
              <span className="font-medium">${stats.totalRevenue?.toFixed(0) || 0}</span>
            </div>
            <div className="text-xs text-gray-500">
              {stats.upcomingReservations} upcoming
            </div>
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const property = row.original;
        const hasRoomTypes = property.room_types && property.room_types.length > 0;
        
        return (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setSelectedPropertyId(property.id)
                setEditingRoomType(null)
                setShowRoomTypeModal(true)
              }}
              className="inline-flex items-center px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
              title="Manage Room Types"
            >
              <Home className="w-3 h-3 mr-1" />
              Rooms
            </button>
            
            {!isReadOnly && hasRoomTypes && (
              <button
                onClick={() => {
                  // If property has multiple room types, use the first one or show a selection
                  const firstRoomType = property.room_types[0];
                  setSelectedRoomTypeId(firstRoomType.id);
                  setEditingRoomUnit(null);
                  setShowRoomUnitModal(true);
                }}
                className="inline-flex items-center px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                title="Add Room Unit"
              >
                <Bed className="w-3 h-3 mr-1" />
                Add Unit
              </button>
            )}
            
            {!isReadOnly && (
              <>
                <button
                  onClick={() => {
                    setEditingProperty(property)
                    setShowPropertyModal(true)
                  }}
                  className="text-gray-500 hover:text-primary-600"
                  title="Edit Property"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDeleteProperty(property.id)}
                  className="text-gray-500 hover:text-red-600"
                  title="Delete Property"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        );
      },
    },
  ], [
    isReadOnly, 
    onDeleteProperty, 
    onDeleteRoomType, 
    onDeleteRoomUnit, 
    expandedRoomTypes, 
    toggleRoomType,
    setEditingRoomType,
    setShowRoomTypeModal,
    setEditingRoomUnit,
    setShowRoomUnitModal,
    setSelectedPropertyId,
    setSelectedRoomTypeId,
    setEditingProperty,
    setShowPropertyModal
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {isReadOnly ? 'My Properties' : 'Property Management'}
          </h2>
          <p className="text-gray-600">
            {isReadOnly 
              ? 'View and manage your property portfolio' 
              : 'Manage properties, room types, and units'
            }
          </p>
        </div>
        {!isReadOnly && (
          <button
            onClick={() => {
              setEditingProperty(null)
              setShowPropertyModal(true)
            }}
            className="btn-primary"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Property
          </button>
        )}
      </div>

      {/* Properties Table */}
      <DataTableAdvanced
        data={properties || []}
        columns={columns}
        loading={false}
        searchable={true}
        filterable={true}
        exportable={true}
        pageSize={15}
        emptyMessage="No properties found"
        emptyIcon={Building}
        className="w-full"
      />

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
