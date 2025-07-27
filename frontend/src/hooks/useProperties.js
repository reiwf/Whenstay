import { useState, useCallback } from '../../$node_modules/@types/react/index.js'
import { adminAPI } from '../services/api'
import toast from '../../$node_modules/react-hot-toast/dist/index.js'

export function useProperties() {
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(false)

  const loadProperties = useCallback(async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getProperties(true)
      setProperties(response.data.properties)
    } catch (error) {
      console.error('Error loading properties:', error)
      toast.error('Failed to load properties')
    } finally {
      setLoading(false)
    }
  }, [])

  const createProperty = useCallback(async (propertyData) => {
    try {
      await adminAPI.createProperty(propertyData)
      toast.success('Property created successfully')
      await loadProperties()
    } catch (error) {
      console.error('Error creating property:', error)
      toast.error('Failed to create property')
      throw error
    }
  }, [loadProperties])

  const updateProperty = useCallback(async (propertyId, propertyData) => {
    try {
      await adminAPI.updateProperty(propertyId, propertyData)
      toast.success('Property updated successfully')
      await loadProperties()
    } catch (error) {
      console.error('Error updating property:', error)
      toast.error('Failed to update property')
      throw error
    }
  }, [loadProperties])

  const deleteProperty = useCallback(async (propertyId) => {
    if (!confirm('Are you sure you want to delete this property?')) return
    
    try {
      await adminAPI.deleteProperty(propertyId)
      toast.success('Property deleted successfully')
      await loadProperties()
    } catch (error) {
      console.error('Error deleting property:', error)
      toast.error('Failed to delete property')
    }
  }, [loadProperties])

  const createRoom = useCallback(async (propertyId, roomData) => {
    try {
      await adminAPI.createRoom(propertyId, roomData)
      toast.success('Room created successfully')
      await loadProperties()
    } catch (error) {
      console.error('Error creating room:', error)
      toast.error('Failed to create room')
      throw error
    }
  }, [loadProperties])

  const updateRoom = useCallback(async (roomId, roomData) => {
    try {
      await adminAPI.updateRoom(roomId, roomData)
      toast.success('Room updated successfully')
      await loadProperties()
    } catch (error) {
      console.error('Error updating room:', error)
      toast.error('Failed to update room')
      throw error
    }
  }, [loadProperties])

  const deleteRoom = useCallback(async (roomId) => {
    if (!confirm('Are you sure you want to delete this room?')) return
    
    try {
      await adminAPI.deleteRoom(roomId)
      toast.success('Room deleted successfully')
      await loadProperties()
    } catch (error) {
      console.error('Error deleting room:', error)
      toast.error('Failed to delete room')
    }
  }, [loadProperties])

  return {
    properties,
    loading,
    loadProperties,
    createProperty,
    updateProperty,
    deleteProperty,
    createRoom,
    updateRoom,
    deleteRoom
  }
}
