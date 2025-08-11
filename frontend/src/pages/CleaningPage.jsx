import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  RefreshCw, 
  Calendar, 
  Building,
  Home,
  Bed,
  Key,
  Edit,
  Plus,
  Trash2,
  UserCheck,
  Play,
  Pause,
  CheckCircle,
  AlertCircle,
  Zap,
  Clock
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import DashboardLayout from '../components/layout/DashboardLayout'
import { DataTableAdvanced } from '../components/ui'
import { DateRangePicker } from '../components/ui/date-range-picker'
import toast from 'react-hot-toast'
import CleaningTaskModal from '../components/admin/modals/CleaningTaskModal'
import { adminAPI } from '../services/api'

const tokyoTodayYMD = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });

export default function CleaningPage() {
  const { hasAdminAccess, profile } = useAuth()
  const navigate = useNavigate()
  
  // State management
  const [loading, setLoading] = useState(true)
  const [cleaningTasks, setCleaningTasks] = useState([])
  const [cleaners, setCleaners] = useState([])
  const [properties, setProperties] = useState([])
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  
  // Date range state - separate from the problematic DataTableAdvanced component
  const [dateRange, setDateRange] = useState({
    from: null,
    to: null
  })

  // Safe date range handler to ensure we always have an object
  const handleDateRangeChange = (range) => {
    if (range === undefined || range === null) {
      setDateRange({ from: null, to: null })
    } else {
      setDateRange(range)
    }
  }

  const filterTimeoutRef = useRef(null)

  // Navigation handler for sidebar
  const handleSectionChange = (section) => {
    if (section === 'dashboard') {
      navigate('/dashboard')
    } else if (section === 'cleaning' || section === 'cleaning-management') {
      // Already on cleaning page
      return
    } else if (section === 'reservation-management') {
      navigate('/reservations')
    } else {
      navigate('/dashboard') // Default fallback
    }
  }

  // Load initial data
  useEffect(() => {
    if (hasAdminAccess() || profile?.role === 'cleaner') {
      loadInitialData()
    }
  }, [hasAdminAccess, profile])

  const loadInitialData = async () => {
    try {
      setLoading(true)
      await Promise.all([
        loadCleaningTasksWithFilters(undefined, { defaultToToday: true }),
        loadCleaners(),
        loadProperties()
      ])
    } catch (error) {
      console.error('Error loading initial data:', error)
      toast.error('Failed to load initial data')
    } finally {
      setLoading(false)
    }
  }

  // Clean helper function to load cleaning tasks with date filters
  const loadCleaningTasksWithFilters = async (
    dateRangeToUse = dateRange,
    opts = { defaultToToday: true } // 👈 default Tokyo today when empty
  ) => {
    try {
      setLoading(true)
      let from, to;

      if (dateRangeToUse?.from) {
        from = dateRangeToUse.from.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
        to = (dateRangeToUse.to || dateRangeToUse.from).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
      } else if (opts.defaultToToday) {
        const t = tokyoTodayYMD();
        from = t; to = t;
      }

      const apiParams = {
        ...(from && { taskDateFrom: from, taskDateTo: to }),
        includeCancelled: false // Exclude cancelled tasks as requested
      };

      // If user is a cleaner, filter tasks assigned to them
      if (profile?.role === 'cleaner') {
        apiParams.cleanerId = profile.id;
      }

      // Debug API call
      console.log('Filtering cleaning tasks with (Tokyo):', apiParams);
      console.log('Making API call to:', '/cleaning/tasks');

      const response = await adminAPI.getCleaningTasks(apiParams)
      setCleaningTasks(response.data.tasks || [])
    } catch (error) {
      console.error('Error loading cleaning tasks:', error)
      toast.error('Failed to load cleaning tasks')
    } finally {
      setLoading(false)
    }
  }

  const loadCleaners = async () => {
    try {
      const response = await adminAPI.getAvailableCleaners()
      setCleaners(response.data.cleaners || [])
    } catch (error) {
      console.error('Error loading cleaners:', error)
    }
  }

  const loadProperties = async () => {
    try {
      const response = await adminAPI.getProperties()
      setProperties(response.data.properties || [])
    } catch (error) {
      console.error('Error loading properties:', error)
    }
  }

  const applyDateFilter = () => {
    // user picked explicit dates → don't override with today
    loadCleaningTasksWithFilters(dateRange, { defaultToToday: false })
  }

  const clearDateFilter = () => {
    const cleared = { from: null, to: null };
    setDateRange(cleared);
    // cleared → go back to Tokyo today
    loadCleaningTasksWithFilters(cleared, { defaultToToday: true })
  }

  const handleUpdateTaskStatus = async (taskId, status) => {
    try {
      await adminAPI.updateCleaningTask(taskId, { status })
      await loadCleaningTasksWithFilters(dateRange)
      toast.success(`Task status updated to ${status}`)
    } catch (error) {
      console.error('Error updating task status:', error)
      toast.error('Failed to update task status')
    }
  }

  const handleAssignCleaner = async (taskId, cleanerId) => {
    try {
      await adminAPI.assignCleanerToTask(taskId, cleanerId)
      await loadCleaningTasksWithFilters(dateRange)
      toast.success('Cleaner assigned successfully')
    } catch (error) {
      console.error('Error assigning cleaner:', error)
      toast.error('Failed to assign cleaner')
    }
  }

  const handleEditTask = (task) => {
    setEditingTask(task)
    setShowTaskModal(true)
  }

  const handleCreateTask = () => {
    setEditingTask(null)
    setShowTaskModal(true)
  }

  const handleDeleteTask = async (taskId) => {
    if (!confirm('Are you sure you want to delete this cleaning task?')) {
      return
    }

    try {
      await adminAPI.deleteCleaningTask(taskId)
      await loadCleaningTasksWithFilters(dateRange)
      toast.success('Task deleted successfully')
    } catch (error) {
      console.error('Error deleting task:', error)
      toast.error('Failed to delete task')
    }
  }

  const handleSaveTask = async (taskData, taskId) => {
    try {
      if (taskId) {
        await adminAPI.updateCleaningTask(taskId, taskData)
      } else {
        await adminAPI.createCleaningTask(taskData)
      }
      setShowTaskModal(false)
      setEditingTask(null)
      await loadCleaningTasksWithFilters(dateRange)
      toast.success(`Task ${taskId ? 'updated' : 'created'} successfully`)
    } catch (error) {
      console.error('Error saving task:', error)
      toast.error(`Failed to ${taskId ? 'update' : 'create'} task`)
    }
  }

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTaskTypeDisplay = (taskType) => {
    if (!taskType) return 'Standard Clean'
    return taskType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const renderPropertyAndRoom = (task) => {
    return (
      <div className="space-y-1">
        <div className="text-sm font-medium text-gray-900 flex items-center">
          <Building className="w-4 h-4 mr-1 text-gray-500" />
          {task.property_name || 'Unknown Property'}
        </div>
        <div className="text-sm text-gray-900 flex items-center ml-5">
          <Home className="w-3 h-3 mr-1" />
          {task.room_type_name || 'Standard Room'}
          <Bed className="w-3 h-3 ml-2 mr-1" />
          {task.room_unit_number || 'Room TBD'}
          {task.access_code && (
            <>
              <Key className="w-3 h-3 ml-2 mr-1" />
              {task.access_code}
            </>
          )}
        </div>
      </div>
    )
  }

  const renderTaskDateAndBooking = (task) => {
    const bookingName = task.display_booking_name || task.booking_name || 'Unknown Guest'
    const bookingLastname = task.booking_lastname || ''
    const fullBookingName = bookingLastname ? `${bookingName} ${bookingLastname}` : bookingName
    
    return (
      <div className="space-y-1">
        <div className="text-sm font-medium text-gray-900 flex items-center">
          <Calendar className="w-4 h-4 mr-1 text-gray-500" />
          {new Date(task.task_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })}
        </div>
        <div className="text-sm text-gray-600 ml-5">
          {fullBookingName}
        </div>
      </div>
    )
  }

  const renderTaskTypeAndPriority = (task) => {
    return (
      <div className="space-y-1">
        <div className="text-sm font-medium text-gray-900">
          {getTaskTypeDisplay(task.task_type)}
          {task.priority === 'high' && (
            <span className="ml-1 inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
              <Zap className="w-3 h-3" />
            </span>
          )}
        </div>
      </div>
    )
  }

  const renderStatus = (task) => {
    return (
      <div className="flex items-center space-x-2">
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(task.status)}`}>
          {task.status.replace('_', ' ')}
        </span>
        {task.is_overdue && (
          <span className="text-red-600 flex items-center">
            <AlertCircle className="w-3 h-3" />
          </span>
        )}
      </div>
    )
  }

  const renderAssignedTo = (task) => {
    return (
      <div className="flex items-center">
        <UserCheck className="w-4 h-4 mr-1 text-gray-500" />
        {task.cleaner_name || 'Unassigned'}
      </div>
    )
  }

  // Define columns for the cleaning tasks table
  const columns = useMemo(() => [
    {
      accessorKey: 'property_room',
      header: 'Property & Room',
      cell: ({ row }) => renderPropertyAndRoom(row.original),
    },
    {
      accessorKey: 'task_date_booking',
      header: 'Task Date & Booking',
      cell: ({ row }) => renderTaskDateAndBooking(row.original),
    },
    {
      accessorKey: 'task_type_priority',
      header: 'Task Type & Priority',
      cell: ({ row }) => renderTaskTypeAndPriority(row.original),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => renderStatus(row.original),
    },
    {
      accessorKey: 'assigned_to',
      header: 'Assigned To',
      cell: ({ row }) => renderAssignedTo(row.original),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const task = row.original
        return (
          <div className="flex items-center space-x-2">
            {task.status === 'pending' && (
              <button
                onClick={() => handleUpdateTaskStatus(task.id, 'in_progress')}
                className="inline-flex items-center px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
                title="Start Task"
              >
                <Play className="w-3 h-3 mr-1" />
                Start
              </button>
            )}
            
            {task.status === 'in_progress' && (
              <>
                <button
                  onClick={() => handleUpdateTaskStatus(task.id, 'pending')}
                  className="inline-flex items-center px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                  title="Pause Task"
                >
                  <Pause className="w-3 h-3 mr-1" />
                  Pause
                </button>
                <button
                  onClick={() => handleUpdateTaskStatus(task.id, 'completed')}
                  className="inline-flex items-center px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                  title="Complete Task"
                >
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Complete
                </button>
              </>
            )}

            {/* Admin Actions - Hide for cleaners */}
            {profile?.role !== 'cleaner' && (
              <>
                {!task.cleaner_id && (
                  <select
                    onChange={(e) => e.target.value && handleAssignCleaner(task.id, e.target.value)}
                    className="text-xs border border-gray-300 rounded px-2 py-1 max-w-32"
                    defaultValue=""
                  >
                    <option value="">Assign...</option>
                    {cleaners.map(cleaner => (
                      <option key={cleaner.id} value={cleaner.id}>
                        {cleaner.first_name}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  onClick={() => handleEditTask(task)}
                  className="text-gray-500 hover:text-primary-600"
                  title="Edit Task"
                >
                  <Edit className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleDeleteTask(task.id)}
                  className="text-gray-500 hover:text-red-600"
                  title="Delete Task"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        )
      },
    },
  ], [profile?.role, cleaners, handleUpdateTaskStatus, handleAssignCleaner, handleEditTask, handleDeleteTask])

  // Since we excluded cancelled tasks in the API call, we use cleaningTasks directly
  const filteredTasks = cleaningTasks

  // Define searchable fields for enhanced search
  const searchableFields = useMemo(() => [
    'property_name',
    'room_type_name',
    'room_unit_number',
    'access_code',
    'task_type',
    'cleaner_name',
    'display_booking_name',
    'booking_name',
    'booking_lastname',
    {
      combiner: (row) => {
        // Property and room combination
        const parts = [];
        if (row.property_name) {
          parts.push(row.property_name);
        }
        if (row.room_type_name) {
          parts.push(row.room_type_name);
        }
        if (row.room_unit_number) {
          parts.push(`Unit ${row.room_unit_number}`);
        }
        if (row.access_code) {
          parts.push(`Code ${row.access_code}`);
        }
        return parts.join(' ');
      }
    },
    {
      combiner: (row) => {
        // Full booking name
        const bookingName = row.display_booking_name || row.booking_name || '';
        const bookingLastname = row.booking_lastname || '';
        return bookingLastname ? `${bookingName} ${bookingLastname}` : bookingName;
      }
    },
    {
      combiner: (row) => {
        // Task type formatted for display
        const taskType = row.task_type || '';
        return taskType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      }
    }
  ], [])

  return (
    <DashboardLayout
      activeSection={profile?.role === 'admin' ? 'cleaning-management' : 'cleaning'}
      onSectionChange={handleSectionChange}
      pageTitle="Cleaning Management"
      pageSubtitle={
        profile?.role === 'cleaner' 
          ? 'View and manage your assigned cleaning tasks' 
          : 'Manage cleaning tasks and assignments'
      }
      pageAction={
        <div className="flex space-x-2">
          <button
            onClick={() => loadCleaningTasksWithFilters(dateRange)}
            className="btn-secondary"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
          {/* Hide create button for cleaners */}
          {profile?.role !== 'cleaner' && (
            <button
              onClick={handleCreateTask}
              className="btn-primary"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Task
            </button>
          )}
        </div>
      }
    >
      <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Date Range Filter */}
        <div className="card">
          <div className="flex flex-col gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Date
              </label>
              <DateRangePicker
                dateRange={dateRange}
                onDateRangeChange={handleDateRangeChange}
                placeholder="Select task date range"
                className="w-full"
                showClear={true}
              />
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={applyDateFilter}
                className="btn-ghost border text-sm"
                disabled={!dateRange.from}
              >
                Apply Filter
              </button>
              
              {(dateRange.from || dateRange.to) && (
                <button
                  onClick={clearDateFilter}
                  className="btn-ghost border text-sm"
                >
                  Clear Filter
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tasks Table */}
        <DataTableAdvanced
          data={filteredTasks || []}
          columns={columns}
          loading={loading}
          searchable={true}
          filterable={true}
          exportable={true}
          pageSize={10}
          emptyMessage="No cleaning tasks found. Try adjusting your filters or date range."
          emptyIcon={Calendar}
          className="w-full"
          searchableFields={searchableFields}
        />

        {/* Task Modal */}
        {showTaskModal && (
          <CleaningTaskModal
            isOpen={showTaskModal}
            task={editingTask}
            properties={properties}
            cleaners={cleaners}
            onClose={() => {
              setShowTaskModal(false)
              setEditingTask(null)
            }}
            onTaskSaved={() => {
              setShowTaskModal(false)
              setEditingTask(null)
              loadCleaningTasksWithFilters(dateRange)
            }}
          />
        )}
      </div>
    </DashboardLayout>
  )
}
