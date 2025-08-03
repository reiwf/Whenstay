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
  const [taskFormData, setTaskFormData] = useState({
    property_id: '',
    room_unit_id: '',
    task_type: 'checkout',
    task_date: '',
    priority: 'normal',
    cleaner_id: '',
    special_notes: ''
  });
  const [roomUnits, setRoomUnits] = useState([]);
  const [loadingRoomUnits, setLoadingRoomUnits] = useState(false);
  const [reservations, setReservations] = useState([]);
  const [loadingReservations, setLoadingReservations] = useState(false);

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

  const loadRoomUnits = async (propertyId) => {
    if (!propertyId) {
      setRoomUnits([]);
      return;
    }

    try {
      setLoadingRoomUnits(true);
      console.log('Loading room units for property:', propertyId);
      
      const response = await adminAPI.getRoomTypes(propertyId, true);
      console.log('Room types response:', response.data);
      
      const allRoomUnits = [];
      
      // Check if we have roomTypes in the response
      if (response.data && response.data.roomTypes) {
        response.data.roomTypes.forEach(roomType => {
          console.log('Processing room type:', roomType);
          
          // Check if roomType has room_units (snake_case from backend)
          if (roomType.room_units && Array.isArray(roomType.room_units)) {
            roomType.room_units.forEach(unit => {
              allRoomUnits.push({
                id: unit.id,
                number: unit.unit_number || unit.number,
                roomTypeName: roomType.name,
                accessCode: unit.access_code,
                floorNumber: unit.floor_number
              });
            });
          }
          // Also check for camelCase version for backward compatibility
          else if (roomType.roomUnits && Array.isArray(roomType.roomUnits)) {
            roomType.roomUnits.forEach(unit => {
              allRoomUnits.push({
                id: unit.id,
                number: unit.unit_number || unit.number,
                roomTypeName: roomType.name,
                accessCode: unit.access_code,
                floorNumber: unit.floor_number
              });
            });
          }
        });
      }
      
      console.log('Processed room units:', allRoomUnits);
      setRoomUnits(allRoomUnits);
    } catch (error) {
      console.error('Error loading room units:', error);
      setRoomUnits([]);
    } finally {
      setLoadingRoomUnits(false);
    }
  };

  const resetTaskForm = () => {
    setTaskFormData({
      property_id: '',
      room_unit_id: '',
      task_type: 'checkout',
      task_date: '',
      priority: 'normal',
      cleaner_id: '',
      special_notes: ''
    });
    setRoomUnits([]);
  };

  const handleOpenTaskModal = (task = null) => {
    if (task) {
      // Edit mode - populate form with task data
      setSelectedTask(task);
      setTaskFormData({
        property_id: task.property_id || '',
        room_unit_id: task.room_unit_id || '',
        task_type: task.task_type || 'checkout',
        task_date: task.task_date ? task.task_date.split('T')[0] : '',
        priority: task.priority || 'normal',
        cleaner_id: task.cleaner_id || '',
        special_notes: task.special_notes || ''
      });
      
      // Load room units for the property
      if (task.property_id) {
        loadRoomUnits(task.property_id);
      }
    } else {
      // Create mode - reset form
      setSelectedTask(null);
      resetTaskForm();
    }
    setShowTaskModal(true);
  };

  const handleCloseTaskModal = () => {
    setShowTaskModal(false);
    setSelectedTask(null);
    resetTaskForm();
  };

  const handleFormChange = (field, value) => {
    setTaskFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Load room units when property changes
    if (field === 'property_id') {
      loadRoomUnits(value);
      setTaskFormData(prev => ({
        ...prev,
        room_unit_id: '' // Reset room unit selection
      }));
    }
  };

  const handleSubmitTask = async (e) => {
    e.preventDefault();
    
    try {
      // Map frontend field names to backend expected field names
      const submitData = {
        propertyId: taskFormData.property_id,
        roomUnitId: taskFormData.room_unit_id,
        taskType: taskFormData.task_type,
        taskDate: taskFormData.task_date,
        priority: taskFormData.priority,
        cleanerId: taskFormData.cleaner_id || null,
        specialNotes: taskFormData.special_notes || null,
        reservationId: null // Make reservation ID nullable
      };

      if (selectedTask) {
        // Update existing task
        await adminAPI.updateCleaningTask(selectedTask.id, submitData);
      } else {
        // Create new task
        await adminAPI.createCleaningTask(submitData);
      }

      handleCloseTaskModal();
      await loadCleaningTasks();
    } catch (error) {
      console.error('Error saving task:', error);
      alert(`Failed to ${selectedTask ? 'update' : 'create'} task`);
    }
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
      {showTaskModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmitTask}>
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedTask ? 'Edit Cleaning Task' : 'Create New Cleaning Task'}
                </h3>
              </div>

              {/* Modal Body */}
              <div className="px-6 py-4 space-y-4">
                {/* Property Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Property *
                  </label>
                  {selectedTask ? (
                    <div className="input-field bg-gray-50 text-gray-600">
                      {selectedTask.property_name || 'Unknown Property'}
                    </div>
                  ) : (
                    <select
                      value={taskFormData.property_id}
                      onChange={(e) => handleFormChange('property_id', e.target.value)}
                      className="input-field"
                      required
                    >
                      <option value="">Select a property</option>
                      {properties.map(property => (
                        <option key={property.id} value={property.id}>
                          {property.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Room Unit Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Room Unit *
                  </label>
                  {selectedTask ? (
                    <div className="input-field bg-gray-50 text-gray-600">
                      {selectedTask.room_unit_number || 'Unknown'} - {selectedTask.room_type_name || 'Standard Room'}
                      {selectedTask.room_floor_number && ` (Floor ${selectedTask.room_floor_number})`}
                    </div>
                  ) : (
                    <select
                      value={taskFormData.room_unit_id}
                      onChange={(e) => handleFormChange('room_unit_id', e.target.value)}
                      className="input-field"
                      required
                      disabled={!taskFormData.property_id || loadingRoomUnits}
                    >
                      <option value="">
                        {loadingRoomUnits ? 'Loading rooms...' : 'Select a room unit'}
                      </option>
                      {roomUnits.map(unit => (
                        <option key={unit.id} value={unit.id}>
                          {unit.number} - {unit.roomTypeName}
                          {unit.floorNumber && ` (Floor ${unit.floorNumber})`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Task Type and Date Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Task Type *
                    </label>
                    <select
                      value={taskFormData.task_type}
                      onChange={(e) => handleFormChange('task_type', e.target.value)}
                      className="input-field"
                      required
                    >
                      <option value="checkout">Checkout Cleaning</option>
                      <option value="checkin_preparation">Check-in Preparation</option>
                      <option value="maintenance">Maintenance</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Task Date *
                    </label>
                    <input
                      type="date"
                      value={taskFormData.task_date}
                      onChange={(e) => handleFormChange('task_date', e.target.value)}
                      className="input-field"
                      required
                    />
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={taskFormData.priority}
                    onChange={(e) => handleFormChange('priority', e.target.value)}
                    className="input-field"
                  >
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </select>
                </div>

                {/* Cleaner Assignment */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assign Cleaner
                  </label>
                  <select
                    value={taskFormData.cleaner_id}
                    onChange={(e) => handleFormChange('cleaner_id', e.target.value)}
                    className="input-field"
                  >
                    <option value="">Assign later</option>
                    {cleaners.map(cleaner => (
                      <option key={cleaner.id} value={cleaner.id}>
                        {cleaner.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Special Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Special Notes
                  </label>
                  <textarea
                    value={taskFormData.special_notes}
                    onChange={(e) => handleFormChange('special_notes', e.target.value)}
                    className="input-field"
                    rows="3"
                    placeholder="Any special instructions or notes for this cleaning task..."
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseTaskModal}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={!taskFormData.property_id || !taskFormData.room_unit_id || !taskFormData.task_date}
                >
                  {selectedTask ? 'Update Task' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
