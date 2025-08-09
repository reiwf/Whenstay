import { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, 
  CheckCircle, 
  AlertCircle, 
  Filter,
  Plus,
  Edit,
  Trash2,
  UserCheck,
  Home,
  Bed,
  Play,
  Pause,
  RotateCcw,
  Zap,
  Building,
  Key
} from 'lucide-react';
import { DataTableAdvanced } from '../../ui';
import LoadingSpinner from '../../LoadingSpinner';
import CleaningTaskModal from '../modals/CleaningTaskModal';
import { adminAPI } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';

export default function CleaningTab() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [cleaners, setCleaners] = useState([]);
  const [properties, setProperties] = useState([]);
  const [filters, setFilters] = useState({
    status: 'all',
    cleanerId: '',
    propertyId: '',
    taskDate: '',
    taskDateFrom: '',
    taskDateTo: '',
    taskType: 'all'
  });
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [bulkAssignMode, setBulkAssignMode] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [hasMore, setHasMore] = useState(false);
  const [totalTasks, setTotalTasks] = useState(0);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadCleaningTasks();
  }, [filters, currentPage, pageSize]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadCleaningTasks(),
        loadCleaners(),
        loadProperties()
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCleaningTasks = async () => {
    try {
      // Prepare filter parameters
      const params = {
        page: currentPage,
        limit: pageSize
      };
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') {
          params[key] = value;
        }
      });

      // If user is a cleaner, filter tasks assigned to them
      if (profile?.role === 'cleaner') {
        params.cleanerId = profile.id;
      }

      const response = await adminAPI.getCleaningTasks(params);
      const data = response.data;
      
      setTasks(data.tasks || []);
      setTotalTasks(data.total || 0);
      setHasMore(data.hasMore || false);
    } catch (error) {
      console.error('Error loading cleaning tasks:', error);
    }
  };


  const loadCleaners = async () => {
    try {
      const response = await adminAPI.getAvailableCleaners();
      setCleaners(response.data.cleaners || []);
    } catch (error) {
      console.error('Error loading cleaners:', error);
    }
  };

  const loadProperties = async () => {
    try {
      const response = await adminAPI.getProperties();
      setProperties(response.data.properties || []);
    } catch (error) {
      console.error('Error loading properties:', error);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      status: 'all',
      cleanerId: '',
      propertyId: '',
      taskDate: '',
      taskDateFrom: '',
      taskDateTo: '',
      taskType: 'all'
    });
  };

  const handleUpdateTaskStatus = async (taskId, status) => {
    try {
      await adminAPI.updateCleaningTask(taskId, { status });
      await loadCleaningTasks();
    } catch (error) {
      console.error('Error updating task status:', error);
      alert('Failed to update task status');
    }
  };

  const handleAssignCleaner = async (taskId, cleanerId) => {
    try {
      await adminAPI.assignCleanerToTask(taskId, cleanerId);
      await loadCleaningTasks();
    } catch (error) {
      console.error('Error assigning cleaner:', error);
      alert('Failed to assign cleaner');
    }
  };

  const handleBulkAssign = async (cleanerId) => {
    try {
      await Promise.all(
        selectedTasks.map(taskId =>
          adminAPI.assignCleanerToTask(taskId, cleanerId)
        )
      );

      setSelectedTasks([]);
      setBulkAssignMode(false);
      await loadCleaningTasks();
    } catch (error) {
      console.error('Error bulk assigning cleaner:', error);
      alert('Failed to bulk assign cleaner');
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!confirm('Are you sure you want to delete this cleaning task?')) {
      return;
    }

    try {
      await adminAPI.deleteCleaningTask(taskId);
      await loadCleaningTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task');
    }
  };

  const handleOpenTaskModal = (task = null) => {
    setSelectedTask(task);
    setShowTaskModal(true);
  };

  const handleCloseTaskModal = () => {
    setShowTaskModal(false);
    setSelectedTask(null);
  };

  const handleTaskSaved = () => {
    loadCleaningTasks();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'status-completed';
      case 'in_progress': return 'status-pending';
      case 'pending': return 'status-cancelled';
      default: return 'status-cancelled';
    }
  };

  const getTaskTypeDisplay = (taskType) => {
    return taskType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'normal': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  };

  const columns = useMemo(() => [
    {
      accessorKey: 'room_property',
      header: 'Property & Room',
      cell: ({ row }) => (
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-900 flex items-center">
            <Building className="w-4 h-4 mr-1 text-gray-500" />
            {row.original.property_name || 'Unknown Property'}
          </div>
          <div className="text-sm text-gray-900 flex items-center ml-5">
            <Home className="w-3 h-3 mr-1" />
            {row.original.room_type_name || 'Standard Room'} <Bed className="w-3 h-3 ml-2" />{row.original.room_unit_number || 'Room TBD'} <Key className="w-3 h-3 ml-2" />{row.original.room_access_code || ''}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'task_type',
      header: 'Task Type',
      cell: ({ getValue, row }) => (
        <div className="flex items-center space-x-2">
          <span>{getTaskTypeDisplay(getValue())}</span>
          {(row.original.priority === 'high' || getValue() === 'request-high') && (
            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
              <Zap className="w-3 h-3"/>
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'task_date',
      header: 'Date',
      cell: ({ getValue }) => (
        <div className="flex items-center">
          <Calendar className="w-4 h-4 mr-1 text-gray-500" />
          {new Date(getValue()).toLocaleDateString()}
        </div>
      ),
    },
    {
      accessorKey: 'cleaner_name',
      header: 'Assigned To',
      cell: ({ getValue }) => (
        <div className="flex items-center">
          <UserCheck className="w-4 h-4 mr-1 text-gray-500" />
          {getValue() || 'Unassigned'}
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue, row }) => (
        <div className="flex items-center space-x-2">
          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(getValue())}`}>
            {getValue().replace('_', ' ')}
          </span>
          {row.original.is_overdue && (
            <span className="text-red-600 flex items-center">
              <AlertCircle className="w-3 h-3" />
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center space-x-2">
          {row.original.status === 'pending' && (
            <button
              onClick={() => handleUpdateTaskStatus(row.original.id, 'in_progress')}
              className="inline-flex items-center px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
            >
              <Play className="w-3 h-3 mr-1" />
              Start
            </button>
          )}
          
          {row.original.status === 'in_progress' && (
            <>
              <button
                onClick={() => handleUpdateTaskStatus(row.original.id, 'pending')}
                className="inline-flex items-center px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                <Pause className="w-3 h-3 mr-1" />
                Pause
              </button>
              <button
                onClick={() => handleUpdateTaskStatus(row.original.id, 'completed')}
                className="inline-flex items-center px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
              >
                <CheckCircle className="w-3 h-3 mr-1" />
                Complete
              </button>
            </>
          )}

          {/* Admin Actions */}
          {profile?.role !== 'cleaner' && (
            <>
              {!row.original.cleaner_id && (
                <select
                  onChange={(e) => e.target.value && handleAssignCleaner(row.original.id, e.target.value)}
                  className="text-xs border border-gray-300 rounded px-2 py-1 max-w-32"
                  defaultValue=""
                >
                  <option value="">Assign...</option>
                  {cleaners.map(cleaner => (
                    <option key={cleaner.id} value={cleaner.id}>
                      {cleaner.full_name.split(' ')[0]}
                    </option>
                  ))}
                </select>
              )}

              <button
                onClick={() => handleOpenTaskModal(row.original)}
                className="text-gray-500 hover:text-primary-600"
                title="Edit Task"
              >
                <Edit className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleDeleteTask(row.original.id)}
                className="text-gray-500 hover:text-red-600"
                title="Delete Task"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ], [profile?.role, cleaners, handleUpdateTaskStatus, handleAssignCleaner, handleOpenTaskModal, handleDeleteTask]);

  // Filter tasks based on current filters
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (filters.status !== 'all' && task.status !== filters.status) return false;
      if (filters.propertyId && task.property_id !== filters.propertyId) return false;
      if (filters.cleanerId && task.cleaner_id !== filters.cleanerId) return false;
      if (filters.taskType !== 'all' && task.task_type !== filters.taskType) return false;
      if (filters.taskDate && new Date(task.task_date).toDateString() !== new Date(filters.taskDate).toDateString()) return false;
      if (filters.taskDateFrom && new Date(task.task_date) < new Date(filters.taskDateFrom)) return false;
      if (filters.taskDateTo && new Date(task.task_date) > new Date(filters.taskDateTo)) return false;
      return true;
    });
  }, [tasks, filters]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {profile?.role === 'cleaner' ? 'My Cleaning Tasks' : 'Cleaning Management'}
          </h2>
          <p className="text-gray-600">
            {profile?.role === 'cleaner' 
              ? 'View and manage your assigned cleaning tasks' 
              : 'Manage cleaning tasks and assignments'
            }
          </p>
        </div>
        {/* Hide admin controls for cleaners */}
        {profile?.role !== 'cleaner' && (
          <div className="flex gap-3">
            {bulkAssignMode && selectedTasks.length > 0 && (
              <div className="flex items-center gap-2">
                <select
                  onChange={(e) => e.target.value && handleBulkAssign(e.target.value)}
                  className="input-field"
                  defaultValue=""
                >
                  <option value="">Assign to cleaner...</option>
                  {cleaners.map(cleaner => (
                    <option key={cleaner.id} value={cleaner.id}>
                      {cleaner.full_name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    setBulkAssignMode(false);
                    setSelectedTasks([]);
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            )}
            <button
              onClick={() => setBulkAssignMode(!bulkAssignMode)}
              className={`btn-secondary ${bulkAssignMode ? 'bg-blue-100 text-blue-700' : ''}`}
            >
              <UserCheck className="w-4 h-4 mr-2" />
              Bulk Assign
            </button>
            <button
              onClick={() => handleOpenTaskModal()}
              className="btn-primary"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Task
            </button>
          </div>
        )}
      </div>


      {/* Filters */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            <Filter className="w-5 h-5 inline mr-2" />
            Filters
          </h3>
          <button
            onClick={clearFilters}
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            <RotateCcw className="w-4 h-4 inline mr-1" />
            Clear Filters
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
             <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Task Date</label>
            <input
              type="date"
              value={filters.taskDate}
              onChange={(e) => handleFilterChange('taskDate', e.target.value)}
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
            <input
              type="date"
              value={filters.taskDateFrom}
              onChange={(e) => handleFilterChange('taskDateFrom', e.target.value)}
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
            <input
              type="date"
              value={filters.taskDateTo}
              onChange={(e) => handleFilterChange('taskDateTo', e.target.value)}
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Task Type</label>
            <select
              value={filters.taskType}
              onChange={(e) => handleFilterChange('taskType', e.target.value)}
              className="input-field"
            >
              <option value="all">All Types</option>
              <option value="checkout">Checkout</option>
              <option value="eco">Eco</option>
              <option value="request-high">Request High</option>
              <option value="deep-clean">Deep Clean</option>
            </select>
          </div>
        </div>
      </div>

      {/* Cleaning Tasks Table */}
      <DataTableAdvanced
        data={filteredTasks || []}
        columns={columns}
        loading={loading}
        searchable={true}
        filterable={true}
        exportable={true}
        pageSize={15}
        emptyMessage="No cleaning tasks found"
        emptyIcon={Calendar}
        className="w-full"
      />

      {/* Task Modal */}
      <CleaningTaskModal
        isOpen={showTaskModal}
        onClose={handleCloseTaskModal}
        task={selectedTask}
        properties={properties}
        cleaners={cleaners}
        onTaskSaved={handleTaskSaved}
      />
    </div>
  );
}
