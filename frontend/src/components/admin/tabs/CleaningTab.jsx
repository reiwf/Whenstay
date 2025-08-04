import { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Users, 
  Filter,
  Plus,
  Edit,
  Trash2,
  UserCheck,
  Home,
  MapPin,
  Play,
  Pause,
  RotateCcw,
  Zap
} from 'lucide-react';
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
    taskType: 'all',
    priority: 'all'
  });
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [bulkAssignMode, setBulkAssignMode] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadCleaningTasks();
  }, [filters]);

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
      const params = {};
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
      setTasks(response.data.tasks || []);
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
      taskType: 'all',
      priority: 'all'
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="input-field"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Property</label>
            <select
              value={filters.propertyId}
              onChange={(e) => handleFilterChange('propertyId', e.target.value)}
              className="input-field"
            >
              <option value="">All Properties</option>
              {properties.map(property => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cleaner</label>
            <select
              value={filters.cleanerId}
              onChange={(e) => handleFilterChange('cleanerId', e.target.value)}
              className="input-field"
            >
              <option value="">All Cleaners</option>
              {cleaners.map(cleaner => (
                <option key={cleaner.id} value={cleaner.id}>
                  {cleaner.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Task Type</label>
            <select
              value={filters.taskType}
              onChange={(e) => handleFilterChange('taskType', e.target.value)}
              className="input-field"
            >
              <option value="all">All Types</option>
              <option value="checkout">Checkout Cleaning</option>
              <option value="checkin_preparation">Check-in Preparation</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>

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
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <select
              value={filters.priority}
              onChange={(e) => handleFilterChange('priority', e.target.value)}
              className="input-field"
            >
              <option value="all">All Priorities</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tasks List */}
      <div className="space-y-4">
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <div key={task.id} className="card">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-start gap-3">
                  {bulkAssignMode && profile?.role !== 'cleaner' && (
                    <input
                      type="checkbox"
                      checked={selectedTasks.includes(task.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTasks(prev => [...prev, task.id]);
                        } else {
                          setSelectedTasks(prev => prev.filter(id => id !== task.id));
                        }
                      }}
                      className="mt-1"
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {task.property_name || 'Unknown Property'}
                      </h3>
                      {task.priority === 'high' && (
                        <div className="flex items-center bg-red-100 text-red-700 px-2 py-1 rounded-full">
                          <Zap className="w-4 h-4 mr-1" />
                          <span className="text-xs font-medium">HIGH PRIORITY</span>
                        </div>
                      )}
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 inline-block">
                      <p className="text-lg font-bold text-blue-900">
                      {task.room_unit_number || 'Unknown'}
                      </p>
                      <p className="text-sm text-blue-700">
                        {task.room_type_name || 'Standard Room'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`status-badge ${getStatusColor(task.status)}`}>
                    {task.status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                <div className="space-y-2">
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="w-4 h-4 mr-2" />
                    {new Date(task.task_date).toLocaleDateString()}
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Home className="w-4 h-4 mr-2" />
                    {getTaskTypeDisplay(task.task_type)}
                  </div>
                </div>

                <div className="space-y-2">
                  {task.cleaner_name && (
                    <div className="flex items-center text-sm text-gray-600">
                      <UserCheck className="w-4 h-4 mr-2" />
                      Cleaner: {task.cleaner_name}
                    </div>
                  )}
                  {task.room_access_code && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Home className="w-4 h-4 mr-2" />
                      Access Code: {task.room_access_code}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {task.started_at && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Play className="w-4 h-4 mr-2" />
                      Started: {new Date(task.started_at).toLocaleTimeString()}
                    </div>
                  )}
                  {task.completed_at && (
                    <div className="flex items-center text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Completed: {new Date(task.completed_at).toLocaleTimeString()}
                    </div>
                  )}
                  {task.is_overdue && (
                    <div className="flex items-center text-sm text-red-600">
                      <AlertCircle className="w-4 h-4 mr-2" />
                      Overdue
                    </div>
                  )}
                </div>
              </div>

              {task.special_notes && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start">
                    <AlertCircle className="w-4 h-4 text-yellow-600 mr-2 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-yellow-800">Special Notes:</p>
                      <p className="text-sm text-yellow-700">{task.special_notes}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Task Actions */}
              <div className="flex flex-wrap gap-2">
                {task.status === 'pending' && (
                  <button
                    onClick={() => handleUpdateTaskStatus(task.id, 'in_progress')}
                    className="btn-primary text-sm"
                  >
                    <Play className="w-4 h-4 mr-1" />
                    Start
                  </button>
                )}
                
                {task.status === 'in_progress' && (
                  <>
                    <button
                      onClick={() => handleUpdateTaskStatus(task.id, 'pending')}
                      className="btn-secondary text-sm"
                    >
                      <Pause className="w-4 h-4 mr-1" />
                      Pause
                    </button>
                    <button
                      onClick={() => handleUpdateTaskStatus(task.id, 'completed')}
                      className="btn-primary text-sm"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Complete
                    </button>
                  </>
                )}

                {/* Hide admin-only actions for cleaners */}
                {profile?.role !== 'cleaner' && (
                  <>
                    {!task.cleaner_id && (
                      <select
                        onChange={(e) => e.target.value && handleAssignCleaner(task.id, e.target.value)}
                        className="text-sm border border-gray-300 rounded px-2 py-1"
                        defaultValue=""
                      >
                        <option value="">Assign cleaner...</option>
                        {cleaners.map(cleaner => (
                          <option key={cleaner.id} value={cleaner.id}>
                            {cleaner.full_name}
                          </option>
                        ))}
                      </select>
                    )}

                    <button
                      onClick={() => handleOpenTaskModal(task)}
                      className="btn-secondary text-sm"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </button>

                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="text-red-600 hover:text-red-800 text-sm px-2 py-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="card text-center py-12">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No cleaning tasks found</h3>
            <p className="text-gray-600">
              No tasks match your current filters. Try adjusting the filters or create a new task.
            </p>
          </div>
        )}
      </div>

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
