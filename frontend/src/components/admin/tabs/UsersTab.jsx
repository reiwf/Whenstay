import { useState, useMemo } from 'react'
import { Plus, Users, RefreshCw, Edit, Trash2 } from 'lucide-react'
import { DataTableAdvanced } from '../../ui'
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

  const columns = useMemo(() => [
    {
      accessorKey: 'name',
      header: 'User',
      cell: ({ row }) => (
        <div>
          <div className="text-sm font-medium text-gray-900">
            {row.original.first_name} {row.original.last_name}
          </div>
          <div className="text-sm text-gray-500">
            ID: {row.original.id.slice(0, 8)}...
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ getValue }) => (
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(getValue())}`}>
          {getValue()}
        </span>
      ),
    },
    {
      accessorKey: 'phone',
      header: 'Contact',
      cell: ({ getValue }) => getValue() || 'No phone',
    },
    {
      accessorKey: 'company_name',
      header: 'Company',
      cell: ({ getValue }) => getValue() || '-',
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ getValue, row }) => (
        <button
          onClick={() => onUpdateUserStatus(row.original.id, !getValue())}
          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            getValue() 
              ? 'bg-green-100 text-green-800 hover:bg-green-200' 
              : 'bg-red-100 text-red-800 hover:bg-red-200'
          }`}
        >
          {getValue() ? 'Active' : 'Inactive'}
        </button>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex space-x-2">
          <button
            onClick={() => {
              setEditingUser(row.original)
              setShowUserModal(true)
            }}
            className="text-primary-600 hover:text-primary-900"
          >
            <Edit className="w-4 h-4" />
          </button>
          <select
            value={row.original.role}
            onChange={(e) => onUpdateUserRole(row.original.id, e.target.value)}
            className="text-xs border border-gray-300 rounded px-2 py-1"
          >
            <option value="admin">Admin</option>
            <option value="owner">Owner</option>
            <option value="guest">Guest</option>
            <option value="cleaner">Cleaner</option>
          </select>
          <button
            onClick={() => onDeleteUser(row.original.id)}
            className="text-red-600 hover:text-red-900"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ], [onUpdateUserStatus, onUpdateUserRole, onDeleteUser])

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
      <div>
          <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
          <p className="text-gray-600">Manage user</p>
        </div>


      {/* Users Table */}
      <DataTableAdvanced
        data={filteredUsers || []}
        columns={columns}
        loading={loading}
        searchable={true}
        filterable={true}
        exportable={true}
        pageSize={15}
        emptyMessage={roleFilter ? `No users with role "${roleFilter}"` : "No users found"}
        emptyIcon={Users}
        className="w-full"
      />

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
