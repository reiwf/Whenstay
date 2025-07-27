import axios from '../../$node_modules/axios/index.js'
import toast from '../../$node_modules/react-hot-toast/dist/index.js'

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
    const token = localStorage.getItem('adminToken')
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
      localStorage.removeItem('adminToken')
      if (window.location.pathname.startsWith('/admin') && window.location.pathname !== '/admin') {
        window.location.href = '/admin'
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
  login: (credentials) => api.post('/admin/login', credentials),
  
  // Get dashboard stats
  getDashboardStats: () => api.get('/admin/dashboard/stats'),
  
  // Get all check-ins
  getCheckins: (params = {}) => api.get('/admin/checkins', { params }),
  
  // Get specific check-in details
  getCheckinDetails: (reservationId) => api.get(`/admin/checkins/${reservationId}`),
  
  // Update verification status
  updateVerification: (checkinId, verified) => 
    api.patch(`/admin/checkins/${checkinId}/verify`, { verified }),
  
  // Get all reservations with filtering
  getReservations: (params = {}) => api.get('/admin/reservations', { params }),
  
  // Get reservation statistics
  getReservationStats: (params = {}) => api.get('/admin/reservations/stats', { params }),
  
  // Send invitation manually
  sendInvitation: (reservationId) => 
    api.post(`/admin/reservations/${reservationId}/send-invitation`),
  
  // Get specific reservation details
  getReservationDetails: (reservationId) => 
    api.get(`/admin/reservations/${reservationId}`),
  
  // Create new reservation
  createReservation: (reservationData) => 
    api.post('/admin/reservations', reservationData),
  
  // Update reservation
  updateReservation: (reservationId, reservationData) => 
    api.put(`/admin/reservations/${reservationId}`, reservationData),
  
  // Delete reservation
  deleteReservation: (reservationId) => 
    api.delete(`/admin/reservations/${reservationId}`),
  
  // Sync from Beds24
  syncBeds24: (daysBack = 7) => api.post('/admin/sync/beds24', { daysBack }),
  
  // Get webhook events
  getWebhookEvents: (params = {}) => api.get('/admin/webhooks/events', { params }),
  
  // Property Management
  getProperties: (withStats = false) => api.get('/admin/properties', { 
    params: { withStats: withStats.toString() } 
  }),
  
  getProperty: (id) => api.get(`/admin/properties/${id}`),
  
  createProperty: (propertyData) => api.post('/admin/properties', propertyData),
  
  updateProperty: (id, propertyData) => api.put(`/admin/properties/${id}`, propertyData),
  
  deleteProperty: (id) => api.delete(`/admin/properties/${id}`),
  
  // Room Management
  createRoom: (propertyId, roomData) => 
    api.post(`/admin/properties/${propertyId}/rooms`, roomData),
  
  updateRoom: (roomId, roomData) => api.put(`/admin/rooms/${roomId}`, roomData),
  
  deleteRoom: (roomId) => api.delete(`/admin/rooms/${roomId}`),
  
  // User Management
  getUsers: (params = {}) => api.get('/admin/users', { params }),
  
  getUserStats: () => api.get('/admin/users/stats'),
  
  getUser: (id) => api.get(`/admin/users/${id}`),
  
  createUser: (userData) => api.post('/admin/users', userData),
  
  updateUser: (id, userData) => api.put(`/admin/users/${id}`, userData),
  
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  
  updateUserRole: (id, role) => api.patch(`/admin/users/${id}/role`, { role }),
  
  updateUserStatus: (id, isActive) => api.patch(`/admin/users/${id}/status`, { isActive }),
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
    localStorage.setItem('adminToken', token)
  } else {
    localStorage.removeItem('adminToken')
  }
}

export const getAuthToken = () => {
  return localStorage.getItem('adminToken')
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
