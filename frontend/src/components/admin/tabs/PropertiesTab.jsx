import { useState, useMemo } from 'react'
import { Plus, Building, MapPin, Edit, Trash2, Home, Bed } from 'lucide-react'
import { DataTableAdvanced, EmptyState } from '../../ui'
import PropertyModal from '../modals/PropertyModal'
import RoomTypeModal from '../modals/RoomTypeModal'

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
  const [editingProperty, setEditingProperty] = useState(null)
  const [editingRoomType, setEditingRoomType] = useState(null)
  const [selectedPropertyId, setSelectedPropertyId] = useState(null)

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

  const handleUpdateRoomType = async (roomTypeId, roomTypeData) => {
    await onUpdateRoomType(roomTypeId, roomTypeData)
    // Don't close modal after update - let user continue editing
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
      cell: ({ getValue }) => {
        const roomTypes = getValue() || [];
        
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
          <div className="flex items-center space-x-2">
            <Home className="w-4 h-4 text-gray-500" />
            <span className="text-sm">{roomTypes.length} types</span>
            <Bed className="w-3 h-3 text-gray-400 ml-2" />
            <span className="text-sm text-gray-500">{totalUnits} units</span>
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
        
        return (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setSelectedPropertyId(property.id)
                setEditingRoomType(null)
                setShowRoomTypeModal(true)
              }}
              className="inline-flex items-center px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
              title="Manage Room Types & Units"
            >
              <Home className="w-3 h-3 mr-1" />
              Room
            </button>
            
            {!isReadOnly && (
              <>
                <button
                  onClick={() => {
                    setEditingProperty(property)
                    setShowPropertyModal(true)
                  }}
                  className="inline-flex items-center px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                  title="Edit Property"
                >
                  <Building className="w-4 h-4 mr-1" />
                  Property
                </button>
              </>
            )}
          </div>
        );
      },
    },
  ], [isReadOnly, onDeleteProperty]);

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
          onDelete={onDeleteProperty}
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
          propertyId={selectedPropertyId}
          onCreateRoomType={handleCreateRoomType}
          onUpdateRoomType={handleUpdateRoomType}
          onCreateRoomUnit={onCreateRoomUnit}
          onUpdateRoomUnit={onUpdateRoomUnit}
          onDeleteRoomUnit={onDeleteRoomUnit}
          onDeleteRoomType={onDeleteRoomType}
          onClose={() => {
            setShowRoomTypeModal(false)
            setEditingRoomType(null)
            setSelectedPropertyId(null)
          }}
        />
      )}
    </div>
  )
}
