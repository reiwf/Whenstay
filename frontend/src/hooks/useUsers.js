import { useState, useCallback } from 'react'
import { adminAPI } from '../services/api'
import toast from 'react-hot-toast'

export function useUsers() {
  const [users, setUsers] = useState([])
  const [userStats, setUserStats] = useState(null)
  const [loading, setLoading] = useState(false)

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true)
      const [usersResponse, statsResponse] = await Promise.all([
        adminAPI.getUsers({ withDetails: 'true' }),
        adminAPI.getUserStats()
      ])
      setUsers(usersResponse.data.users)
      setUserStats(statsResponse.data.stats)
    } catch (error) {
      console.error('Error loading users:', error)
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  const createUser = useCallback(async (userData) => {
    try {
      await adminAPI.createUser(userData)
      toast.success('User created successfully')
      await loadUsers()
    } catch (error) {
      console.error('Error creating user:', error)
      toast.error('Failed to create user')
      throw error
    }
  }, [loadUsers])

  const updateUser = useCallback(async (userData, userId) => {
    try {
      if (!userId) {
        toast.error('No user selected for editing')
        return
      }
      await adminAPI.updateUser(userId, userData)
      toast.success('User updated successfully')
      await loadUsers()
    } catch (error) {
      console.error('Error updating user:', error)
      toast.error('Failed to update user')
      throw error
    }
  }, [loadUsers])

  const deleteUser = useCallback(async (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) return
    
    try {
      await adminAPI.deleteUser(userId)
      toast.success('User deleted successfully')
      await loadUsers()
    } catch (error) {
      console.error('Error deleting user:', error)
      toast.error('Failed to delete user')
    }
  }, [loadUsers])

  const updateUserRole = useCallback(async (userId, role) => {
    try {
      await adminAPI.updateUserRole(userId, role)
      toast.success('User role updated successfully')
      await loadUsers()
    } catch (error) {
      console.error('Error updating user role:', error)
      toast.error('Failed to update user role')
    }
  }, [loadUsers])

  const updateUserStatus = useCallback(async (userId, isActive) => {
    try {
      await adminAPI.updateUserStatus(userId, isActive)
      toast.success(`User ${isActive ? 'activated' : 'deactivated'} successfully`)
      await loadUsers()
    } catch (error) {
      console.error('Error updating user status:', error)
      toast.error('Failed to update user status')
    }
  }, [loadUsers])

  return {
    users,
    userStats,
    loading,
    loadUsers,
    createUser,
    updateUser,
    deleteUser,
    updateUserRole,
    updateUserStatus
  }
}




