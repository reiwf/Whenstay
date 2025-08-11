import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  RefreshCw, 
  Users,
  User,
  Mail,
  Phone,
  UserCheck,
  UserX,
  Edit,
  Plus,
  Trash2,
  Shield,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import DashboardLayout from '../components/layout/DashboardLayout'
import { DataTableAdvanced } from '../components/ui'
import toast from 'react-hot-toast'
import UserModal from '../components/admin/modals/UserModal'
import { adminAPI } from '../services/api'

export default function UserPage() {
  const { hasAdminAccess, profile } = useAuth()
  const navigate = useNavigate()
  
  // State management
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])
  const [userStats, setUserStats] = useState({})
  const [showUserModal, setShowUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)

  // Navigation handler for sidebar
  const handleSectionChange = (section) => {
    if (section === 'dashboard') {
      navigate('/dashboard')
    } else if (section === 'user-management') {
      // Already on user page
      return
    } else if (section === 'cleaning' || section === 'cleaning-management') {
      navigate('/cleaning')
    } else if (section === 'reservation-management') {
      navigate('/reservation')
    } else if (section === 'property-management') {
      navigate('/property')
    } else {
      navigate('/dashboard') // Default fallback
    }
  }

  // Load initial data
  useEffect(() => {
    if (hasAdminAccess()) {
      loadInitialData()
    }
  }, [hasAdminAccess])

  const loadInitialData = async () => {
    try {
      setLoading(true)
      await Promise.all([
        loadUsers(),
        loadUserStats()
      ])
    } catch (error) {
      console.error('Error loading initial data:', error)
      toast.error('Failed to load initial data')
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getUsers({ withDetails: true })
      setUsers(response.data.users || [])
    } catch (error) {
      console.error('Error loading users:', error)
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const loadUserStats = async () => {
    try {
      const response = await adminAPI.getUserStats()
      setUserStats(response.data.stats || {})
    } catch (error) {
      console.error('Error loading user stats:', error)
    }
  }

  const handleCreateUser = () => {
    setEditingUser(null)
    setShowUserModal(true)
  }

  const handleEditUser = (user) => {
    setEditingUser(user)
    setShowUserModal(true)
  }

  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return
    }

    try {
      await adminAPI.deleteUser(userId)
      await loadUsers()
      toast.success('User deleted successfully')
    } catch (error) {
      console.error('Error deleting user:', error)
      toast.error('Failed to delete user')
    }
  }

  const handleToggleUserStatus = async (userId, currentStatus) => {
    try {
      const newStatus = !currentStatus
      await adminAPI.updateUserStatus(userId, newStatus)
      await loadUsers()
      toast.success(`User ${newStatus ? 'activated' : 'deactivated'} successfully`)
    } catch (error) {
      console.error('Error updating user status:', error)
      toast.error('Failed to update user status')
    }
  }

  const handleSaveUser = async (userData, userId) => {
    try {
      if (userId) {
        await adminAPI.updateUser(userId, userData)
      } else {
        await adminAPI.createUser(userData)
      }
      setShowUserModal(false)
      setEditingUser(null)
      await loadUsers()
      toast.success(`User ${userId ? 'updated' : 'created'} successfully`)
    } catch (error) {
      console.error('Error saving user:', error)
      toast.error(`Failed to ${userId ? 'update' : 'create'} user`)
    }
  }

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800'
      case 'owner': return 'bg-blue-100 text-blue-800'
      case 'cleaner': return 'bg-green-100 text-green-800'
      case 'guest': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin': return Shield
      case 'owner': return UserCheck
      case 'cleaner': return Users
      case 'guest': return User
      default: return User
    }
  }

  const renderUserInfo = (user) => {
    return (
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
          <User className="w-5 h-5 text-gray-500" />
        </div>
        <div>
          <div className="font-medium text-gray-900">
            {user.first_name} {user.last_name}
          </div>
          <div className="text-sm text-gray-500">
            ID: {user.id.substring(0, 8)}...
          </div>
        </div>
      </div>
    )
  }

  const renderEmail = (user) => {
    return (
      <div className="flex items-center space-x-2">
        <Mail className="w-4 h-4 text-gray-500" />
        <span className="text-sm text-gray-900">{user.email || 'No email'}</span>
      </div>
    )
  }

  const renderContact = (user) => {
    return (
      <div className="flex items-center space-x-2">
        <Phone className="w-4 h-4 text-gray-500" />
        <span className="text-sm text-gray-900">{user.phone || 'No phone'}</span>
      </div>
    )
  }

  const renderRole = (user) => {
    const RoleIcon = getRoleIcon(user.role)
    return (
      <div className="flex items-center space-x-2">
        <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(user.role)}`}>
          <RoleIcon className="w-3 h-3 mr-1" />
          {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
        </span>
        {!user.is_active && (
          <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            Inactive
          </span>
        )}
      </div>
    )
  }

  const renderActions = (user) => {
    return (
      <div className="flex items-center space-x-2">
        <button
          onClick={() => handleEditUser(user)}
          className="text-gray-500 hover:text-primary-600"
          title="Edit User"
        >
          <Edit className="w-4 h-4" />
        </button>

        <button
          onClick={() => handleToggleUserStatus(user.id, user.is_active)}
          className={`text-gray-500 hover:${user.is_active ? 'text-red-600' : 'text-green-600'}`}
          title={user.is_active ? 'Deactivate User' : 'Activate User'}
        >
          {user.is_active ? (
            <UserX className="w-4 h-4" />
          ) : (
            <UserCheck className="w-4 h-4" />
          )}
        </button>

        {/* Only show delete for non-admin users or if current user is super admin */}
        {(user.role !== 'admin' || profile?.role === 'admin') && user.id !== profile?.id && (
          <button
            onClick={() => handleDeleteUser(user.id)}
            className="text-gray-500 hover:text-red-600"
            title="Delete User"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    )
  }

  // Define columns for the users table
  const columns = useMemo(() => [
    {
      accessorKey: 'user_info',
      header: 'User',
      cell: ({ row }) => renderUserInfo(row.original),
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => renderEmail(row.original),
    },
    {
      accessorKey: 'phone',
      header: 'Contact',
      cell: ({ row }) => renderContact(row.original),
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ row }) => renderRole(row.original),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => renderActions(row.original),
    },
  ], [profile?.id, profile?.role])

  // Define searchable fields for enhanced search
  const searchableFields = useMemo(() => [
    'first_name',
    'last_name',
    'email',
    'phone',
    'role',
    'company_name',
    {
      combiner: (row) => {
        // Full name combination
        return `${row.first_name || ''} ${row.last_name || ''}`.trim()
      }
    },
    {
      combiner: (row) => {
        // ID partial search
        return row.id || ''
      }
    }
  ], [])

  // Filter active users by default, but allow showing all
  const [showInactiveUsers, setShowInactiveUsers] = useState(false)
  const filteredUsers = useMemo(() => {
    if (showInactiveUsers) {
      return users
    }
    return users.filter(user => user.is_active)
  }, [users, showInactiveUsers])

  return (
    <DashboardLayout
      activeSection="user-management"
      onSectionChange={handleSectionChange}
      pageTitle="User Management"
      pageSubtitle="Manage system users and their roles"
      pageAction={
        <div className="flex space-x-2">
          <button
            onClick={() => loadUsers()}
            className="btn-secondary"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
          <button
            onClick={handleCreateUser}
            className="btn-primary"
          >
            <Plus className="w-4 h-4 mr-2" />
            New User
          </button>
        </div>
      }
    >
      <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">       
        {/* Users Table */}
        <DataTableAdvanced
          data={filteredUsers || []}
          columns={columns}
          loading={loading}
          searchable={true}
          filterable={true}
          exportable={true}
          pageSize={10}
          emptyMessage="No users found. Create your first user to get started."
          emptyIcon={Users}
          className="w-full"
          searchableFields={searchableFields}
        />

        {/* User Modal */}
        {showUserModal && (
          <UserModal
            isOpen={showUserModal}
            user={editingUser}
            onClose={() => {
              setShowUserModal(false)
              setEditingUser(null)
            }}
            onUserSaved={handleSaveUser}
          />
        )}
      </div>
    </DashboardLayout>
  )
}
