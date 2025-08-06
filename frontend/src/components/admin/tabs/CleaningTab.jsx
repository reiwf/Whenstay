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
import { PageHeader, EmptyState } from '../../ui';
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
      <div className="space-y-3">
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <div key={task.id} className="bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
              {/* Desktop Layout: First Row - Main Info */}
              <div className="hidden md:flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-4 flex-1 min-w-0">
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
                      className="h-4 w-4 text-primary-600 rounded border-gray-300 flex-shrink-0"
                    />
                  )}
                  
                  {/* Property & Room */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="bg-primary-50 border border-primary-200 rounded-md px-3 py-1">
                      <div className="text-sm font-bold text-primary-900 whitespace-nowrap">
                        {task.room_unit_number || 'Room TBD'}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 text-sm truncate">
                        {task.property_name || 'Unknown Property'}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {task.room_type_name || 'Standard Room'}
                      </div>
                    </div>
                  </div>

                  {/* Priority Badge */}
                  {task.priority === 'high' && (
                    <div className="flex items-center bg-red-100 text-red-700 px-2 py-1 rounded-full flex-shrink-0">
                      <Zap className="w-3 h-3 mr-1" />
                      <span className="text-xs font-medium">HIGH</span>
                    </div>
                  )}

                  {/* Task Details */}
                  <div className="hidden lg:flex items-center gap-4 text-sm text-gray-600 min-w-0">
                    <div className="flex items-center gap-1 whitespace-nowrap">
                      <Calendar className="w-4 h-4 flex-shrink-0" />
                      {new Date(task.task_date).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-1 whitespace-nowrap">
                      <Home className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{getTaskTypeDisplay(task.task_type)}</span>
                    </div>
                    {task.cleaner_name && (
                      <div className="flex items-center gap-1 whitespace-nowrap">
                        <UserCheck className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{task.cleaner_name}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Status Badge */}
                <span className={`status-badge ${getStatusColor(task.status)} text-xs px-3 py-1 flex-shrink-0 ml-2`}>
                  {task.status.replace('_', ' ')}
                </span>
              </div>

              {/* Desktop Layout: Second Row - Actions & Additional Info */}
              <div className="hidden md:flex items-center justify-between px-4 py-2">
                <div className="flex items-center gap-3 text-xs text-gray-500 min-w-0 flex-1">
                  {task.room_access_code && (
                    <span className="whitespace-nowrap">Access: {task.room_access_code}</span>
                  )}
                  {task.started_at && (
                    <span className="whitespace-nowrap">Started: {new Date(task.started_at).toLocaleTimeString()}</span>
                  )}
                  {task.completed_at && (
                    <span className="whitespace-nowrap">Completed: {new Date(task.completed_at).toLocaleTimeString()}</span>
                  )}
                  {task.is_overdue && (
                    <span className="text-red-600 flex items-center gap-1 whitespace-nowrap">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      Overdue
                    </span>
                  )}
                  {task.special_notes && (
                    <span className="text-yellow-600 flex items-center gap-1 whitespace-nowrap">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      Has Notes
                    </span>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {task.status === 'pending' && (
                    <button
                      onClick={() => handleUpdateTaskStatus(task.id, 'in_progress')}
                      className="inline-flex items-center px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 whitespace-nowrap"
                    >
                      <Play className="w-3 h-3 mr-1" />
                      Start
                    </button>
                  )}
                  
                  {task.status === 'in_progress' && (
                    <>
                      <button
                        onClick={() => handleUpdateTaskStatus(task.id, 'pending')}
                        className="inline-flex items-center px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 whitespace-nowrap"
                      >
                        <Pause className="w-3 h-3 mr-1" />
                        Pause
                      </button>
                      <button
                        onClick={() => handleUpdateTaskStatus(task.id, 'completed')}
                        className="inline-flex items-center px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 whitespace-nowrap"
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Complete
                      </button>
                    </>
                  )}

                  {/* Admin Actions */}
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
                              {cleaner.full_name.split(' ')[0]}
                            </option>
                          ))}
                        </select>
                      )}

                      <button
                        onClick={() => handleOpenTaskModal(task)}
                        className="p-1 text-gray-500 hover:text-primary-600"
                        title="Edit Task"
                      >
                        <Edit className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-1 text-gray-500 hover:text-red-600"
                        title="Delete Task"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Mobile Layout */}
              <div className="md:hidden">
                {/* Mobile Header */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
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
                          className="h-5 w-5 text-primary-600 rounded border-gray-300 mt-1"
                        />
                      )}
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="bg-primary-50 border border-primary-200 rounded-md px-2 py-1">
                            <div className="text-sm font-bold text-primary-900">
                              {task.room_unit_number || 'Room TBD'}
                            </div>
                          </div>
                          {task.priority === 'high' && (
                            <div className="flex items-center bg-red-100 text-red-700 px-2 py-1 rounded-full">
                              <Zap className="w-3 h-3 mr-1" />
                              <span className="text-xs font-medium">HIGH</span>
                            </div>
                          )}
                        </div>
                        <div className="font-medium text-gray-900 text-sm">
                          {task.property_name || 'Unknown Property'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {task.room_type_name || 'Standard Room'}
                        </div>
                      </div>
                    </div>
                    <span className={`status-badge ${getStatusColor(task.status)} text-xs px-2 py-1 ml-2`}>
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Mobile Task Details */}
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-3">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(task.task_date).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <Home className="w-3 h-3" />
                      <span className="truncate">{getTaskTypeDisplay(task.task_type)}</span>
                    </div>
                    {task.cleaner_name && (
                      <div className="flex items-center gap-1 col-span-2">
                        <UserCheck className="w-3 h-3" />
                        <span className="truncate">{task.cleaner_name}</span>
                      </div>
                    )}
                  </div>

                  {/* Mobile Additional Info */}
                  <div className="flex flex-wrap gap-2 text-xs text-gray-500 mb-3">
                    {task.room_access_code && (
                      <span className="bg-gray-100 px-2 py-1 rounded">Access: {task.room_access_code}</span>
                    )}
                    {task.is_overdue && (
                      <span className="text-red-600 flex items-center gap-1 bg-red-50 px-2 py-1 rounded">
                        <AlertCircle className="w-3 h-3" />
                        Overdue
                      </span>
                    )}
                    {task.special_notes && (
                      <span className="text-yellow-600 flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded">
                        <AlertCircle className="w-3 h-3" />
                        Has Notes
                      </span>
                    )}
                  </div>

                  {/* Mobile Action Buttons */}
                  <div className="flex flex-wrap gap-2">
                    {task.status === 'pending' && (
                      <button
                        onClick={() => handleUpdateTaskStatus(task.id, 'in_progress')}
                        className="inline-flex items-center px-3 py-2 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 min-h-[44px]"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Start
                      </button>
                    )}
                    
                    {task.status === 'in_progress' && (
                      <>
                        <button
                          onClick={() => handleUpdateTaskStatus(task.id, 'pending')}
                          className="inline-flex items-center px-3 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 min-h-[44px]"
                        >
                          <Pause className="w-4 h-4 mr-2" />
                          Pause
                        </button>
                        <button
                          onClick={() => handleUpdateTaskStatus(task.id, 'completed')}
                          className="inline-flex items-center px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 min-h-[44px]"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Complete
                        </button>
                      </>
                    )}

                    {/* Mobile Admin Actions */}
                    {profile?.role !== 'cleaner' && (
                      <>
                        {!task.cleaner_id && (
                          <select
                            onChange={(e) => e.target.value && handleAssignCleaner(task.id, e.target.value)}
                            className="text-sm border border-gray-300 rounded px-3 py-2 min-h-[44px] flex-1 min-w-[120px]"
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
                          className="inline-flex items-center justify-center p-3 text-gray-500 hover:text-primary-600 border border-gray-300 rounded min-h-[44px] min-w-[44px]"
                          title="Edit Task"
                        >
                          <Edit className="w-5 h-5" />
                        </button>

                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="inline-flex items-center justify-center p-3 text-gray-500 hover:text-red-600 border border-gray-300 rounded min-h-[44px] min-w-[44px]"
                          title="Delete Task"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
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

        {/* Pagination */}
        {tasks.length > 0 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(prev => prev + 1)}
                disabled={!hasMore}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div className="flex items-center space-x-4">
                <p className="text-sm text-gray-700">
                  Page <span className="font-medium">{currentPage}</span> - Showing {tasks.length} of {totalTasks} tasks
                </p>
                <div className="flex items-center space-x-2">
                  <label className="text-sm text-gray-700">Items per page:</label>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="border border-gray-300 rounded px-2 py-1 text-sm"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                  </select>
                </div>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    disabled={!hasMore}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </nav>
              </div>
            </div>
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
