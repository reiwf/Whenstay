import axios from 'axios'
import toast from 'react-hot-toast'

// Create axios instance with base configuration
const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('authToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    // Handle common errors
    if (error.response?.status === 401) {
      // Unauthorized - clear token and redirect to login
      localStorage.removeItem('authToken')
      if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
        window.location.href = '/login'
      }
    }
    
    // Show error toast for non-401 errors
    if (error.response?.status !== 401) {
      const message = error.response?.data?.error || error.message || 'An error occurred'
      toast.error(message)
    }
    
    return Promise.reject(error)
  }
)

// API methods
export const checkinAPI = {
  // Get reservation details by token
  getReservation: (token) => api.get(`/checkin/${token}`),
  
  // Submit check-in form
  submitCheckin: (token, formData) => {
    const config = {
      headers: {
        'Content-Type': 'application/json',
      },
    }
    // Convert FormData to regular object for API
    const data = {}
    if (formData instanceof FormData) {
      for (let [key, value] of formData.entries()) {
        data[key] = value
      }
    } else {
      Object.assign(data, formData)
    }
    return api.post(`/checkin/${token}/submit`, data, config)
  },
  
  // Get check-in status
  getStatus: (token) => api.get(`/checkin/${token}/status`),
  
  // Resend invitation
  resendInvitation: (token) => api.post(`/checkin/${token}/resend-invitation`),
}

export const adminAPI = {
  // Admin login
  login: (credentials) => api.post('/dashboard/login', credentials),
  
  // Get dashboard stats
  getDashboardStats: () => api.get('/dashboard/dashboard/stats'),
  
  // Get all check-ins
  getCheckins: (params = {}) => api.get('/dashboard/checkins', { params }),
  
  // Get specific check-in details
  getCheckinDetails: (reservationId) => api.get(`/dashboard/checkins/${reservationId}`),
  
  // Update verification status
  updateVerification: (checkinId, verified) => 
    api.patch(`/dashboard/checkins/${checkinId}/verify`, { verified }),
  
  // Get all reservations with filtering
  getReservations: (params = {}) => api.get('/dashboard/reservations', { params }),
  
  
  // Send invitation manually
  sendInvitation: (reservationId) => 
    api.post(`/dashboard/reservations/${reservationId}/send-invitation`),
  
  // Get specific reservation details
  getReservationDetails: (reservationId) => 
    api.get(`/dashboard/reservations/${reservationId}`),
  
  // Create new reservation
  createReservation: (reservationData) => 
    api.post('/dashboard/reservations', reservationData),
  
  // Update reservation
  updateReservation: (reservationId, reservationData) => 
    api.put(`/dashboard/reservations/${reservationId}`, reservationData),
  
  // Delete reservation
  deleteReservation: (reservationId) => 
    api.delete(`/dashboard/reservations/${reservationId}`),
  
  // Sync from Beds24
  syncBeds24: (daysBack = 7) => api.post('/dashboard/sync/beds24', { daysBack }),
  
  // Get webhook events
  getWebhookEvents: (params = {}) => api.get('/dashboard/webhooks/events', { params }),
  
  // Property Management
  getProperties: (withStats = false) => api.get('/dashboard/properties', { 
    params: { withStats: withStats.toString() } 
  }),
  
  getProperty: (id) => api.get(`/dashboard/properties/${id}`),
  
  createProperty: (propertyData) => api.post('/dashboard/properties', propertyData),
  
  updateProperty: (id, propertyData) => api.put(`/dashboard/properties/${id}`, propertyData),
  
  deleteProperty: (id) => api.delete(`/dashboard/properties/${id}`),
  
  // Room Type Management
  getRoomTypes: (propertyId, withUnits = false) => 
    api.get(`/dashboard/properties/${propertyId}/room-types`, { 
      params: { withUnits: withUnits.toString() } 
    }),
  
  getRoomTypesByProperty: (propertyId, withUnits = false) => 
    api.get(`/dashboard/properties/${propertyId}/room-types`, { 
      params: { withUnits: withUnits.toString() } 
    }),
  
  createRoomType: (propertyId, roomTypeData) => 
    api.post(`/dashboard/properties/${propertyId}/room-types`, roomTypeData),
  
  updateRoomType: (roomTypeId, roomTypeData) => 
    api.put(`/dashboard/room-types/${roomTypeId}`, roomTypeData),
  
  deleteRoomType: (roomTypeId) => api.delete(`/dashboard/room-types/${roomTypeId}`),
  
  // Room Unit Management
  getRoomUnits: (roomTypeId) => 
    api.get(`/dashboard/room-types/${roomTypeId}/room-units`),
  
  createRoomUnit: (roomTypeId, roomUnitData) => 
    api.post(`/dashboard/room-types/${roomTypeId}/room-units`, roomUnitData),
  
  updateRoomUnit: (roomUnitId, roomUnitData) => 
    api.put(`/dashboard/room-units/${roomUnitId}`, roomUnitData),
  
  deleteRoomUnit: (roomUnitId) => api.delete(`/dashboard/room-units/${roomUnitId}`),
  
  // Legacy Room Management (for backward compatibility)
  createRoom: (propertyId, roomData) => 
    api.post(`/dashboard/properties/${propertyId}/rooms`, roomData),
  
  updateRoom: (roomId, roomData) => api.put(`/dashboard/rooms/${roomId}`, roomData),
  
  deleteRoom: (roomId) => api.delete(`/dashboard/rooms/${roomId}`),
  
  // User Management
  getUsers: (params = {}) => api.get('/dashboard/users', { params }),
  
  getUserStats: () => api.get('/dashboard/users/stats'),
  
  getUser: (id) => api.get(`/dashboard/users/${id}`),
  
  createUser: (userData) => api.post('/dashboard/users', userData),
  
  updateUser: (id, userData) => api.put(`/dashboard/users/${id}`, userData),
  
  deleteUser: (id) => api.delete(`/dashboard/users/${id}`),
  
  updateUserRole: (id, role) => api.patch(`/dashboard/users/${id}/role`, { role }),
  
  updateUserStatus: (id, isActive) => api.patch(`/dashboard/users/${id}/status`, { isActive }),
  
  // Cleaning Task Management
  getCleaningTasks: (params = {}) => api.get('/dashboard/cleaning-tasks', { params }),
  
  createCleaningTask: (taskData) => api.post('/dashboard/cleaning-tasks', taskData),
  
  updateCleaningTask: (id, taskData) => api.put(`/dashboard/cleaning-tasks/${id}`, taskData),
  
  deleteCleaningTask: (id) => api.delete(`/dashboard/cleaning-tasks/${id}`),
  
  assignCleanerToTask: (id, cleanerId) => 
    api.patch(`/dashboard/cleaning-tasks/${id}/assign`, { cleanerId }),
  
  // Get available cleaners
  getAvailableCleaners: () => api.get('/dashboard/cleaners'),
  
  // Get cleaning task statistics
  getCleaningTaskStats: (params = {}) => api.get('/dashboard/cleaning-tasks/stats', { params }),
}

export const reservationAPI = {
  // Create test reservation
  createTest: (data) => api.post('/reservations/test', data),
  
  // Sync reservations
  sync: (daysBack = 7) => api.post('/reservations/sync', { daysBack }),
  
  // Get Beds24 bookings (for testing)
  getBeds24Bookings: (params = {}) => api.get('/reservations/beds24', { params }),
}

export const webhookAPI = {
  // Test webhook
  test: (data) => api.post('/webhooks/test', data),
}

// Utility functions
export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem('authToken', token)
  } else {
    localStorage.removeItem('authToken')
  }
}

export const clearAuthToken = () => {
  localStorage.removeItem('authToken')
}

export const getAuthToken = () => {
  return localStorage.getItem('authToken')
}

export const isAuthenticated = () => {
  return !!getAuthToken()
}

// File upload helper
export const createFormData = (data, fileField = 'passport') => {
  const formData = new FormData()
  
  Object.keys(data).forEach(key => {
    if (key === fileField && data[key] instanceof File) {
      formData.append(fileField, data[key])
    } else if (data[key] !== null && data[key] !== undefined) {
      formData.append(key, data[key])
    }
  })
  
  return formData
}

export default api
