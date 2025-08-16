import React, { useState, useEffect, useMemo } from 'react'
import { 
  RefreshCw, 
  Building,
  MapPin,
  Home,
  Users,
  Edit,
  Plus,
  Trash2
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import DashboardLayout from '../components/layout/DashboardLayout'
import { DataTableAdvanced } from '../components/ui'
import toast from 'react-hot-toast'
import PropertyModal from '../components/modals/PropertyModal'
import { adminAPI } from '../services/api'
import { useNavigation } from '../hooks/useNavigation'

export default function PropertyPage() {
  const { hasAdminAccess, profile } = useAuth()
  const handleSectionChange = useNavigation('properties')
  
  // State management
  const [loading, setLoading] = useState(true)
  const [properties, setProperties] = useState([])
  const [showPropertyModal, setShowPropertyModal] = useState(false)
  const [editingProperty, setEditingProperty] = useState(null)

  // Load initial data
  useEffect(() => {
    if (hasAdminAccess()) {
      loadProperties()
    }
  }, [hasAdminAccess])

  const loadProperties = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getProperties(true)
      setProperties(response.data.properties || [])
    } catch (error) {
      console.error('Error loading properties:', error)
      toast.error('Failed to load properties')
    } finally {
      setLoading(false)
    }
  }

  const handleEditProperty = (property) => {
    setEditingProperty(property)
    setShowPropertyModal(true)
  }

  const handleCreateProperty = () => {
    setEditingProperty(null)
    setShowPropertyModal(true)
  }

  const handleDeleteProperty = async (propertyId) => {
    if (!confirm('Are you sure you want to delete this property? This action cannot be undone.')) {
      return
    }

    try {
      await adminAPI.deleteProperty(propertyId)
      await loadProperties()
      toast.success('Property deleted successfully')
    } catch (error) {
      console.error('Error deleting property:', error)
      toast.error('Failed to delete property')
    }
  }

  const handleSaveProperty = async (propertyData, propertyId) => {
    try {
      if (propertyId) {
        await adminAPI.updateProperty(propertyId, propertyData)
      } else {
        await adminAPI.createProperty(propertyData)
      }
      setShowPropertyModal(false)
      setEditingProperty(null)
      await loadProperties()
      toast.success(`Property ${propertyId ? 'updated' : 'created'} successfully`)
    } catch (error) {
      console.error('Error saving property:', error)
      toast.error(`Failed to ${propertyId ? 'update' : 'create'} property`)
    }
  }

  const renderPropertyName = (property) => {
    return (
      <div className="flex items-center space-x-2">
        <Building className="w-4 h-4 text-gray-500" />
        <div>
          <div className="text-sm font-medium text-gray-900">
            {property.name}
          </div>
          <div className="text-xs text-gray-500">
            {property.property_type || 'Apartment'}
          </div>
        </div>
      </div>
    )
  }

  const renderLocation = (property) => {
    return (
      <div className="flex items-center space-x-2">
        <MapPin className="w-4 h-4 text-gray-500" />
        <div className="text-sm text-gray-900 max-w-xs truncate">
          {property.address}
        </div>
      </div>
    )
  }

  const renderRoomType = (property) => {
    const roomTypes = property.stats?.totalRoomTypes || 0
    return (
      <div className="flex items-center space-x-2">
        <Home className="w-4 h-4 text-gray-500" />
        <span className="text-sm text-gray-900">
          {roomTypes} {roomTypes === 1 ? 'type' : 'types'}
        </span>
      </div>
    )
  }

  const renderUnits = (property) => {
    const units = property.stats?.totalRoomUnits || 0
    return (
      <div className="flex items-center space-x-2">
        <Users className="w-4 h-4 text-gray-500" />
        <span className="text-sm text-gray-900">
          {units} {units === 1 ? 'unit' : 'units'}
        </span>
      </div>
    )
  }

  // Define columns for the properties table
  const columns = useMemo(() => [
    {
      accessorKey: 'name',
      header: 'Property Name',
      cell: ({ row }) => renderPropertyName(row.original),
    },
    {
      accessorKey: 'address',
      header: 'Location',
      cell: ({ row }) => renderLocation(row.original),
    },
    {
      accessorKey: 'room_types',
      header: 'Room Type',
      cell: ({ row }) => renderRoomType(row.original),
    },
    {
      accessorKey: 'units',
      header: 'Unit',
      cell: ({ row }) => renderUnits(row.original),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const property = row.original
        return (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleEditProperty(property)}
              className="text-gray-500 hover:text-primary-600"
              title="Edit Property"
            >
              <Edit className="w-4 h-4" />
            </button>

            <button
              onClick={() => handleDeleteProperty(property.id)}
              className="text-gray-500 hover:text-red-600"
              title="Delete Property"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )
      },
    },
  ], [])

  // Define searchable fields for enhanced search
  const searchableFields = useMemo(() => [
    'name',
    'address',
    'property_type',
    {
      combiner: (row) => {
        // Combine property info for comprehensive search
        const parts = [];
        if (row.name) {
          parts.push(row.name);
        }
        if (row.address) {
          parts.push(row.address);
        }
        if (row.property_type) {
          parts.push(row.property_type);
        }
        return parts.join(' ');
      }
    }
  ], [])

  return (
    <DashboardLayout
      activeSection="properties"
      onSectionChange={handleSectionChange}
      pageTitle="Property Management"
      pageSubtitle={
        profile?.role === 'owner' 
          ? 'Manage your properties and room configurations' 
          : 'Manage all properties in the system'
      }
      pageAction={
        <div className="flex space-x-2">
          <button
            onClick={loadProperties}
            className="btn-secondary"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
          <button
            onClick={handleCreateProperty}
            className="btn-primary"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Property
          </button>
        </div>
      }
    >
      <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Properties Table */}
        <DataTableAdvanced
          data={properties || []}
          columns={columns}
          loading={loading}
          searchable={true}
          filterable={true}
          exportable={true}
          pageSize={10}
          emptyMessage="No properties found. Create your first property to get started."
          emptyIcon={Building}
          className="w-full"
          searchableFields={searchableFields}
        />

        {/* Property Modal */}
        {showPropertyModal && (
          <PropertyModal
            isOpen={showPropertyModal}
            property={editingProperty}
            onClose={() => {
              setShowPropertyModal(false)
              setEditingProperty(null)
            }}
            onPropertySaved={() => {
              setShowPropertyModal(false)
              setEditingProperty(null)
              loadProperties()
            }}
          />
        )}
      </div>
    </DashboardLayout>
  )
}
