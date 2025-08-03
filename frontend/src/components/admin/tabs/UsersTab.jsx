import { useState } from 'react'
import { Plus, Users, RefreshCw, Edit, Trash2 } from 'lucide-react'
import UserModal from '../modals/UserModal'
import LoadingSpinner from '../../LoadingSpinner'

export default function UsersTab({ 
  users, 
  userStats, 
  loading = false,
  onLoadUsers, 
  onCreateUser, 
  onUpdateUser, 
  onDeleteUser, 
  onUpdateUserRole, 
  onUpdateUserStatus 
}) {
  const [showUserModal, setShowUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [roleFilter, setRoleFilter] = useState('')

  const filteredUsers = roleFilter 
    ? users.filter(user => user.role === roleFilter)
    : users

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800'
      case 'owner': return 'bg-blue-100 text-blue-800'
      case 'guest': return 'bg-green-100 text-green-800'
      case 'cleaner': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const handleCreateUser = async (userData) => {
    await onCreateUser(userData)
    setShowUserModal(false)
    setEditingUser(null)
  }

  const handleUpdateUser = async (userData, userId) => {
    await onUpdateUser(userData, userId)
    setShowUserModal(false)
    setEditingUser(null)
  }

  return (
    <div className="space-y-6">
      {/* User Stats */}
      {userStats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="card text-center">
            <p className="text-2xl font-bold text-gray-900">{userStats.totalUsers}</p>
            <p className="text-sm text-gray-600">Total Users</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-red-600">{userStats.adminUsers}</p>
            <p className="text-sm text-gray-600">Admins</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-blue-600">{userStats.ownerUsers}</p>
            <p className="text-sm text-gray-600">Owners</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-green-600">{userStats.guestUsers}</p>
            <p className="text-sm text-gray-600">Guests</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-yellow-600">{userStats.cleanerUsers}</p>
            <p className="text-sm text-gray-600">Cleaners</p>
          </div>
        </div>
      )}

      {/* Users Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-semibold text-gray-900">User Management</h2>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm"
          >
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="owner">Owner</option>
            <option value="guest">Guest</option>
            <option value="cleaner">Cleaner</option>
          </select>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={onLoadUsers}
            className="btn-secondary text-sm"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </button>
          <button
            onClick={() => {
              setEditingUser(null)
              setShowUserModal(true)
            }}
            className="btn-primary"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add User
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="large" />
          </div>
        ) : filteredUsers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {user.first_name} {user.last_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          ID: {user.id.slice(0, 8)}...
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(user.role)}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.phone || 'No phone'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.company_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => onUpdateUserStatus(user.id, !user.is_active)}
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user.is_active 
                            ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                            : 'bg-red-100 text-red-800 hover:bg-red-200'
                        }`}
                      >
                        {user.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setEditingUser(user)
                            setShowUserModal(true)
                          }}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <select
                          value={user.role}
                          onChange={(e) => onUpdateUserRole(user.id, e.target.value)}
                          className="text-xs border border-gray-300 rounded px-2 py-1"
                        >
                          <option value="admin">Admin</option>
                          <option value="owner">Owner</option>
                          <option value="guest">Guest</option>
                          <option value="cleaner">Cleaner</option>
                        </select>
                        <button
                          onClick={() => onDeleteUser(user.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No users found</p>
            <p className="text-sm text-gray-400 mt-2">
              {roleFilter ? `No users with role "${roleFilter}"` : 'Create your first user to get started'}
            </p>
          </div>
        )}
      </div>

      {/* User Modal */}
      {showUserModal && (
        <UserModal
          user={editingUser}
          onSave={editingUser ? handleUpdateUser : handleCreateUser}
          onClose={() => {
            setShowUserModal(false)
            setEditingUser(null)
          }}
        />
      )}
    </div>
  )
}
