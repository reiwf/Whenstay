import { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { 
  Calendar, 
  Clock, 
  CheckCircle, 
  Camera, 
  MapPin, 
  Users, 
  LogOut,
  Filter,
  Upload,
  AlertCircle,
  Home,
  Play,
  Pause
} from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import api from '../services/api'

export default function CleanerDashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [statusFilter, setStatusFilter] = useState('all')
  const [uploadingPhoto, setUploadingPhoto] = useState(null)

  useEffect(() => {
    // Check if user is authenticated as cleaner
    const userRole = localStorage.getItem('userRole')
    if (userRole !== 'cleaner') {
      navigate('/cleaner/login')
      return
    }
    
    loadCleaningTasks()
  }, [navigate, selectedDate, statusFilter])

  const loadCleaningTasks = async () => {
    try {
      setLoading(true)
      
      // Build query parameters
      const params = new URLSearchParams()
      if (selectedDate) {
        params.append('date', selectedDate)
      }
      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter)
      }
      
      // Fetch cleaning tasks from API
      const response = await api.get(`/admin/cleaning-tasks?${params.toString()}`)
      setTasks(response.data || [])
      
    } catch (error) {
      console.error('Error loading cleaning tasks:', error)
      toast.error('Failed to load cleaning tasks')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('userRole')
    localStorage.removeItem('authToken')
    toast.success('Logged out successfully')
    navigate('/cleaner/login')
  }

  const handleStartTask = async (taskId) => {
    try {
      await api.put(`/admin/cleaning-tasks/${taskId}/start`)
      
      // Update local state
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === taskId 
            ? { ...task, status: 'in_progress', startedAt: new Date().toISOString() }
            : task
        )
      )
      toast.success('Task started!')
    } catch (error) {
      console.error('Error starting task:', error)
      toast.error('Failed to start task')
    }
  }

  const handlePauseTask = async (taskId) => {
    try {
      await api.put(`/admin/cleaning-tasks/${taskId}/pause`)
      
      // Update local state
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === taskId 
            ? { ...task, status: 'pending', startedAt: null }
            : task
        )
      )
      toast.success('Task paused')
    } catch (error) {
      console.error('Error pausing task:', error)
      toast.error('Failed to pause task')
    }
  }

  const handleCompleteTask = async (taskId) => {
    try {
      await api.put(`/admin/cleaning-tasks/${taskId}/complete`)
      
      // Update local state
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === taskId 
            ? { ...task, status: 'completed', completedAt: new Date().toISOString() }
            : task
        )
      )
      toast.success('Task completed!')
    } catch (error) {
      console.error('Error completing task:', error)
      toast.error('Failed to complete task')
    }
  }

  const handlePhotoUpload = async (taskId, file) => {
    try {
      setUploadingPhoto(taskId)
      
      // Mock photo upload - in real implementation, upload to storage
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const mockPhotoUrl = `/uploaded-photos/${taskId}-${Date.now()}.jpg`
      
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === taskId 
            ? { ...task, completionPhotoUrl: mockPhotoUrl }
            : task
        )
      )
      
      toast.success('Photo uploaded successfully!')
    } catch (error) {
      console.error('Error uploading photo:', error)
      toast.error('Failed to upload photo')
    } finally {
      setUploadingPhoto(null)
    }
  }

  const getTaskTypeDisplay = (taskType) => {
    return taskType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'status-completed'
      case 'in_progress': return 'status-pending'
      case 'pending': return 'status-cancelled'
      default: return 'status-cancelled'
    }
  }

  const todayTasks = tasks.filter(task => task.taskDate === new Date().toISOString().split('T')[0])
  const completedToday = todayTasks.filter(task => task.status === 'completed').length
  const pendingToday = todayTasks.filter(task => task.status === 'pending').length
  const inProgressToday = todayTasks.filter(task => task.status === 'in_progress').length

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-primary-600">Cleaner Dashboard</h1>
              <p className="text-sm text-gray-600">Daily Cleaning Tasks</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-gray-600 hover:text-red-600 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Completed Today</p>
                <p className="text-2xl font-bold text-gray-900">{completedToday}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <Play className="w-8 h-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">In Progress</p>
                <p className="text-2xl font-bold text-gray-900">{inProgressToday}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <Clock className="w-8 h-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending Today</p>
                <p className="text-2xl font-bold text-gray-900">{pendingToday}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <Calendar className="w-8 h-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Today</p>
                <p className="text-2xl font-bold text-gray-900">{todayTasks.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="card mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Filter by Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="input-field"
              />
            </div>
            
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Filter className="w-4 h-4 inline mr-1" />
                Filter by Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input-field"
              >
                <option value="all">All Tasks</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tasks List */}
        <div className="space-y-6">
          {tasks.length > 0 ? (
            tasks.map((task) => (
              <div key={task.id} className="card">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{task.apartmentName}</h3>
                    <p className="text-sm text-gray-600">Room {task.roomNumber}</p>
                  </div>
                  <span className={`status-badge ${getStatusColor(task.status)}`}>
                    {task.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <MapPin className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-600">{task.apartmentAddress}</span>
                    </div>
                    
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-600">
                        {new Date(task.taskDate).toLocaleDateString()}
                      </span>
                    </div>
                    
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-600">
                        {task.estimatedDuration} minutes
                      </span>
                    </div>
                    
                    <div className="flex items-center">
                      <Home className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-600">
                        {getTaskTypeDisplay(task.taskType)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {task.guestName && (
                      <div className="flex items-center">
                        <Users className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-600">
                          After: {task.guestName}
                        </span>
                      </div>
                    )}
                    
                    {task.startedAt && (
                      <div className="flex items-center">
                        <Play className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-600">
                          Started: {new Date(task.startedAt).toLocaleTimeString()}
                        </span>
                      </div>
                    )}
                    
                    {task.completedAt && (
                      <div className="flex items-center">
                        <CheckCircle className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-600">
                          Completed: {new Date(task.completedAt).toLocaleTimeString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {task.specialNotes && (
                  <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start">
                      <AlertCircle className="w-4 h-4 text-yellow-600 mr-2 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-yellow-800">Special Notes:</p>
                        <p className="text-sm text-yellow-700">{task.specialNotes}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Task Actions */}
                <div className="flex flex-col sm:flex-row gap-3">
                  {task.status === 'pending' && (
                    <button
                      onClick={() => handleStartTask(task.id)}
                      className="btn-primary"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Start Task
                    </button>
                  )}
                  
                  {task.status === 'in_progress' && (
                    <>
                      <button
                        onClick={() => handlePauseTask(task.id)}
                        className="btn-secondary"
                      >
                        <Pause className="w-4 h-4 mr-2" />
                        Pause
                      </button>
                      <button
                        onClick={() => handleCompleteTask(task.id)}
                        className="btn-primary"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Complete
                      </button>
                    </>
                  )}
                  
                  {task.status === 'completed' && !task.completionPhotoUrl && (
                    <div className="flex items-center gap-3">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files[0]) {
                            handlePhotoUpload(task.id, e.target.files[0])
                          }
                        }}
                        className="hidden"
                        id={`photo-upload-${task.id}`}
                      />
                      <label
                        htmlFor={`photo-upload-${task.id}`}
                        className="btn-secondary cursor-pointer"
                      >
                        {uploadingPhoto === task.id ? (
                          <LoadingSpinner size="small" />
                        ) : (
                          <>
                            <Camera className="w-4 h-4 mr-2" />
                            Upload Photo
                          </>
                        )}
                      </label>
                    </div>
                  )}
                  
                  {task.completionPhotoUrl && (
                    <div className="flex items-center text-green-600">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      <span className="text-sm">Photo uploaded</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="card text-center py-12">
              <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks found</h3>
              <p className="text-gray-600">
                {selectedDate === new Date().toISOString().split('T')[0] 
                  ? "No cleaning tasks scheduled for today."
                  : "No tasks found for the selected date and filters."
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
