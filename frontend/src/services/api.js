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

// Create axios instance for long-running operations (like market demand calculations)
const longRunningApi = axios.create({
  baseURL: '/api',
  timeout: 120000, // 2 minutes timeout for intensive operations
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for both APIs
const requestInterceptor = (config) => {
  // Add auth token if available
  const token = localStorage.getItem('authToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
}

const requestErrorInterceptor = (error) => {
  return Promise.reject(error)
}

// Response interceptor for both APIs
const responseInterceptor = (response) => {
  return response
}

const responseErrorInterceptor = (error) => {
  // Handle common errors
  if (error.response?.status === 401) {
    // Unauthorized - clear token
    localStorage.removeItem('authToken')
    
    // Define public routes that should not redirect to login on 401
    const publicRoutes = [
      '/',
      '/login',
      '/checkin',
      '/guest',
      '/accept-invitation'
    ]
    
    const isPublicRoute = publicRoutes.some(route => {
      if (route === '/') {
        return window.location.pathname === '/'
      }
      return window.location.pathname.startsWith(route)
    })
    
    // Only redirect to login if we're not on a public route
    // Add a small delay to prevent immediate redirect during context initialization
    if (!isPublicRoute && window.location.pathname !== '/login') {
      setTimeout(() => {
        // Double-check we're still not authenticated before redirecting
        if (!localStorage.getItem('authToken')) {
          window.location.href = '/login'
        }
      }, 100)
    }
  }
  
  // Show error toast for non-401 errors
  if (error.response?.status !== 401) {
    const message = error.response?.data?.error || error.message || 'An error occurred'
    toast.error(message)
  }
  
  return Promise.reject(error)
}

// Apply interceptors to both API instances
api.interceptors.request.use(requestInterceptor, requestErrorInterceptor)
api.interceptors.response.use(responseInterceptor, responseErrorInterceptor)

longRunningApi.interceptors.request.use(requestInterceptor, requestErrorInterceptor)
longRunningApi.interceptors.response.use(responseInterceptor, responseErrorInterceptor)

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
  login: (credentials) => api.post('/auth/login', credentials),
  
  // Get dashboard stats
  getDashboardStats: () => api.get('/dashboard/stats'),
  
  // Get today's dashboard stats
  getTodayStats: () => api.get('/dashboard/today-stats'),
  
  // Get today's arrivals
  getTodayArrivals: () => api.get('/dashboard/today-arrivals'),
  
  // Get today's departures
  getTodayDepartures: () => api.get('/dashboard/today-departures'),
  
  // Get in-house guests
  getInHouseGuests: () => api.get('/dashboard/in-house-guests'),
  
  // Get all check-ins
  getCheckins: (params = {}) => api.get('/checkins', { params }),
  
  // Get specific check-in details
  getCheckinDetails: (reservationId) => api.get(`/checkins/${reservationId}`),
  
  // Update verification status
  updateVerification: (checkinId, verified) => 
    api.patch(`/checkins/${checkinId}/verify`, { verified }),
  
  // Get all reservations with filtering
  getReservations: (params = {}) => api.get('/reservations', { params }),
  
  
  // Send invitation manually
  sendInvitation: (reservationId) => 
    api.post(`/reservations/${reservationId}/send-invitation`),
  
  // Get specific reservation details
  getReservationDetails: (reservationId) => 
    api.get(`/reservations/${reservationId}`),
  
  // Addon Services Management
  getReservationServices: (reservationId) => 
    api.get(`/reservations/${reservationId}/services`),
  
  getPurchasedServices: (reservationId) => 
    api.get(`/reservations/${reservationId}/services/purchased`),
  
  getAllServices: () => 
    api.get('/reservations/services/all'),
  
  enableServiceForReservation: (reservationId, serviceId, enabledBy) => 
    api.post(`/reservations/${reservationId}/services/${serviceId}/enable`, { enabled_by: enabledBy }),
  
  disableServiceForReservation: (reservationId, serviceId) => 
    api.delete(`/reservations/${reservationId}/services/${serviceId}/enable`),
  
  // Refund/Void Operations
  refundServicePayment: (reservationId, serviceId, refundData) => 
    api.post(`/reservations/${reservationId}/services/${serviceId}/refund`, refundData),
  
  voidServicePayment: (reservationId, serviceId, voidData) => 
    api.post(`/reservations/${reservationId}/services/${serviceId}/void`, voidData),
  
  getServiceRefundHistory: (reservationId, serviceId) => 
    api.get(`/reservations/${reservationId}/services/${serviceId}/refund-history`),
  
  // Create new reservation
  createReservation: (reservationData) => 
    api.post('/reservations', reservationData),
  
  // Update reservation
  updateReservation: (reservationId, reservationData) => 
    api.put(`/reservations/${reservationId}`, reservationData),
  
  // Delete reservation
  deleteReservation: (reservationId) => 
    api.delete(`/reservations/${reservationId}`),
  
  // Sync from Beds24
  syncBeds24: (daysBack = 7) => api.post('/sync/beds24', { daysBack }),
  
  // Get webhook events
  getWebhookEvents: (params = {}) => api.get('/webhooks/events', { params }),
  
  // Property Management
  getProperties: (withStats = false) => api.get('/properties', { 
    params: { withStats: withStats.toString() } 
  }),
  
  getProperty: (id) => api.get(`/properties/${id}`),
  
  createProperty: (propertyData) => api.post('/properties', propertyData),
  
  updateProperty: (id, propertyData) => api.put(`/properties/${id}`, propertyData),
  
  deleteProperty: (id) => api.delete(`/properties/${id}`),
  
  // Room Type Management
  getRoomTypes: (propertyId, withUnits = false) => 
    api.get(`/properties/${propertyId}/room-types`, { 
      params: { withUnits: withUnits.toString() } 
    }),
  
  getRoomTypesByProperty: (propertyId, withUnits = false) => 
    api.get(`/properties/${propertyId}/room-types`, { 
      params: { withUnits: withUnits.toString() } 
    }),
  
  createRoomType: (propertyId, roomTypeData) => 
    api.post(`/properties/${propertyId}/room-types`, roomTypeData),
  
  updateRoomType: (roomTypeId, roomTypeData) => 
    api.put(`/room-types/${roomTypeId}`, roomTypeData),
  
  deleteRoomType: (roomTypeId) => api.delete(`/room-types/${roomTypeId}`),
  
  // Room Unit Management
  getRoomUnits: (roomTypeId) => 
    api.get(`/room-types/${roomTypeId}/room-units`),
  
  createRoomUnit: (roomTypeId, roomUnitData) => 
    api.post(`/room-types/${roomTypeId}/room-units`, roomUnitData),
  
  updateRoomUnit: (roomUnitId, roomUnitData) => 
    api.put(`/room-units/${roomUnitId}`, roomUnitData),
  
  deleteRoomUnit: (roomUnitId) => api.delete(`/room-units/${roomUnitId}`),
  
  // Legacy Room Management (for backward compatibility)
  createRoom: (propertyId, roomData) => 
    api.post(`/properties/${propertyId}/rooms`, roomData),
  
  updateRoom: (roomId, roomData) => api.put(`/rooms/${roomId}`, roomData),
  
  deleteRoom: (roomId) => api.delete(`/rooms/${roomId}`),
  
  // User Management
  getUsers: (params = {}) => api.get('/users', { params }),
  
  getUserStats: () => api.get('/users/stats'),
  
  getUser: (id) => api.get(`/users/${id}`),
  
  createUser: (userData) => api.post('/users', userData),
  
  updateUser: (id, userData) => api.put(`/users/${id}`, userData),
  
  deleteUser: (id) => api.delete(`/users/${id}`),
  
  updateUserRole: (id, role) => api.patch(`/users/${id}/role`, { role }),
  
  updateUserStatus: (id, isActive) => api.patch(`/users/${id}/status`, { isActive }),
  
  // User Invitation Management
  inviteUser: (invitationData) => api.post('/users/invite', invitationData),
  
  getPendingInvitations: () => api.get('/users/invitations/pending'),
  
  cleanupExpiredInvitations: () => api.post('/users/invitations/cleanup'),
  
  // Cleaning Task Management
  getCleaningTasks: (params = {}) => api.get('/cleaning/tasks', { params }),
  
  createCleaningTask: (taskData) => api.post('/cleaning/tasks', taskData),
  
  updateCleaningTask: (id, taskData) => api.put(`/cleaning/tasks/${id}`, taskData),
  
  deleteCleaningTask: (id) => api.delete(`/cleaning/tasks/${id}`),
  
  assignCleanerToTask: (id, cleanerId) => 
    api.patch(`/cleaning/tasks/${id}/assign`, { cleanerId }),
  
  // Get available cleaners
  getAvailableCleaners: () => api.get('/cleaning/cleaners'),
  
  // Get cleaning task statistics
  getCleaningTaskStats: (params = {}) => api.get('/cleaning/tasks/stats', { params }),
  
  // Communication Management
  getCommunicationThreads: (params = {}) => api.get('/communication/threads', { params }),
  
  getCommunicationMessages: (threadId, params = {}) => 
    api.get(`/communication/threads/${threadId}/messages`, { params }),
  
  sendCommunicationMessage: (threadId, messageData) => 
    api.post(`/communication/threads/${threadId}/messages`, messageData),
  
  updateCommunicationThreadStatus: (threadId, status) => 
    api.put(`/communication/threads/${threadId}/status`, { status }),
  
  getCommunicationThreadChannels: (threadId) => 
    api.get(`/communication/threads/${threadId}/channels`),
  
  markCommunicationMessagesRead: (threadId, lastMessageId) => 
    api.post(`/communication/threads/${threadId}/read`, { last_message_id: lastMessageId }),
  
  markCommunicationMessageRead: (messageId, channel = 'inapp') => 
    api.post(`/communication/messages/${messageId}/read`, { channel }),
  
  getCommunicationTemplates: (params = {}) => 
    api.get('/communication/templates', { params }),
  
  scheduleCommunicationMessage: (scheduleData) => 
    api.post('/communication/schedule', scheduleData),
  
  createCommunicationThread: (threadData) => 
    api.post('/communication/threads', threadData),

  // Group booking communication
  sendGroupMessage: (messageData) => 
    api.post('/communication/group-message', messageData),
  
  getGroupBookingThreads: (masterReservationId) => 
    api.get(`/communication/group/${masterReservationId}/threads`),
  
  getGroupBookingInfo: (reservationId) => 
    api.get(`/communication/reservation/${reservationId}/group-info`),
  
  // Get or create thread for a specific reservation
  getThreadByReservation: (reservationId, autoCreate = true) => 
    api.get(`/communication/threads/by-reservation/${reservationId}`, { 
      params: { auto_create: autoCreate.toString() } 
    }),
  
  // Unlinked thread management
  linkThread: (threadId, reservationId) => 
    api.put(`/communication/threads/${threadId}/link`, { reservation_id: reservationId }),
  
  mergeThreads: (sourceThreadId, targetThreadId) => 
    api.post(`/communication/threads/${sourceThreadId}/merge`, { target_thread_id: targetThreadId }),
  
  rejectThread: (threadId, reason = 'spam') => 
    api.put(`/communication/threads/${threadId}/reject`, { reason }),
  
  getThreadSuggestions: (threadId) => 
    api.get(`/communication/threads/${threadId}/suggestions`),
  
  // Automation Management
  getAutomationRules: (params = {}) => api.get('/automation/rules', { params }),
  
  getScheduledMessages: (params = {}) => api.get('/automation/scheduled-messages', { params }),
  
  getScheduledMessagesForReservation: (reservationId) => 
    api.get(`/automation/scheduled-messages/${reservationId}`),
  
  getAutomationStats: () => api.get('/automation/stats'),
  
  triggerAutomationForReservation: (reservationId, isUpdate = false) => 
    api.post(`/automation/test-reservation/${reservationId}`, { isUpdate }),
  
  cancelScheduledMessagesForReservation: (reservationId, reason = 'Manual cancellation') => 
    api.post(`/automation/cancel-reservation/${reservationId}`, { reason }),
  
  triggerBackfill: (options = {}) => api.post('/automation/backfill', options),
  
  processScheduledMessages: () => api.post('/automation/process-scheduled'),
  
  getDueMessages: (params = {}) => api.get('/automation/due-messages', { params }),
  
  getCronStatus: () => api.get('/automation/cron-status'),
  
  // Template Management
  getAutomationTemplates: (params = {}) => api.get('/automation/templates', { params }),
  
  getAutomationTemplateStats: () => api.get('/automation/templates/stats'),
  
  
  getAutomationTemplate: (templateId) => 
    api.get(`/automation/templates/${templateId}`),

  createAutomationTemplate: (templateData) => 
    api.post('/automation/templates', templateData),

  updateAutomationTemplate: (templateId, templateData) => 
    api.put(`/automation/templates/${templateId}`, templateData),

  getAvailableTemplateVariables: () => 
    api.get('/automation/templates/variables/available'),

  getAutomationTemplateUsage: (templateId) => 
    api.get(`/automation/templates/${templateId}/usage`),

  // Associate template with rule
  associateTemplateWithRule: (ruleId, templateId, options = {}) => 
    api.post(`/automation/rules/${ruleId}/templates`, { 
      templateId, 
      isPrimary: options.isPrimary || false,
      priority: options.priority || 0 
    }),
}

// Message Rules Management - New Architecture
export const messageRulesAPI = {
  // Get all message rules
  getRules: (params = {}) => api.get('/message-rules/rules', { params }),
  
  // Update a message rule
  updateRule: (ruleId, updates) => api.put(`/message-rules/rules/${ruleId}`, updates),
  
  // Get scheduled messages for a reservation
  getScheduledMessagesForReservation: (reservationId, params = {}) => 
    api.get(`/message-rules/scheduled/${reservationId}`, { params }),
  
  // Preview messages for a reservation (without creating them)
  previewMessagesForReservation: (reservationId) => 
    api.get(`/message-rules/preview/${reservationId}`),
  
  // Generate scheduled messages for a reservation manually
  generateMessagesForReservation: (reservationId, options = {}) => 
    api.post(`/message-rules/generate/${reservationId}`, options),
  
  // Cancel scheduled messages for a reservation
  cancelMessagesForReservation: (reservationId) => 
    api.delete(`/message-rules/cancel/${reservationId}`),
  
  // Get system status and stats
  getSystemStatus: () => api.get('/message-rules/status'),
  
  // Get summary for admin dashboard
  getSystemSummary: () => api.get('/message-rules/summary'),
  
  // Test utilities
  testRecentReservations: (minutesBack = 60) => 
    api.post('/message-rules/test/recent', { minutes_back: minutesBack }),
  
  testReconciliation: (daysAhead = 30) => 
    api.post('/message-rules/test/reconcile', { days_ahead: daysAhead }),
  
  cleanupLeases: () => api.post('/message-rules/cleanup/leases'),
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

export const guestAPI = {
  // Validate guest token
  validateToken: (token) => api.get(`/guest/${token}`),
}

// Public invitation API (no auth required)
export const invitationAPI = {
  // Validate invitation token
  validateToken: (token) => api.get(`/users/invitation/${token}`),
  
  // Accept invitation and complete setup
  acceptInvitation: (token, setupData) => 
    api.post(`/users/accept-invitation`, { token, ...setupData }),
}

// Market Demand Management - optimized for performance
export const marketDemandAPI = {
  // Market factor calculations (uses long-running API to prevent timeouts)
  triggerCalculateFactors: () => longRunningApi.post('/market-demand/trigger/calculate-factors'),
  
  // Market factor breakdown for specific date
  getFactorBreakdown: (locationId, date) => 
    api.get(`/market-demand/factors/${locationId}/${date}/breakdown`),
  
  // Set manual override for specific date
  setFactorOverride: (locationId, date, data) => 
    api.post(`/market-demand/factors/${locationId}/${date}/override`, data),
  
  // Calculate factors for specific room type and date range
  calculateRoomTypeFactors: (roomTypeId, data) => 
    longRunningApi.post(`/market-demand/factors/${roomTypeId}/calculate`, data),
  
  // Market tuning parameters
  getTuning: (locationId = 'null') => api.get(`/market-demand/tuning/${locationId}`),
  updateTuning: (locationId = 'null', data) => api.put(`/market-demand/tuning/${locationId}`, data),
  
  // Competitor management
  getCompetitors: (locationId = 'null') => api.get(`/market-demand/competitors/${locationId}`),
  createCompetitorSet: (locationId, data) => api.post(`/market-demand/competitors/${locationId}/sets`, data),
  addCompetitor: (setId, data) => api.post(`/market-demand/competitors/sets/${setId}/members`, data),
  updateCompetitor: (memberId, data) => api.put(`/market-demand/competitors/members/${memberId}`, data),
  removeCompetitor: (memberId, permanent = false) => 
    api.delete(`/market-demand/competitors/members/${memberId}`, { params: { permanent } }),
  
  // Competitor pricing
  inputCompetitorPrices: (setId, data) => api.post(`/market-demand/competitors/sets/${setId}/prices`, data),
  bulkInputCompetitorPrices: (setId, data) => api.post(`/market-demand/competitors/sets/${setId}/prices/bulk`, data),
  getCompetitorPrices: (setId, params) => api.get(`/market-demand/competitors/sets/${setId}/prices`, { params }),
  getCompetitorSummary: (locationId = 'null', days = 30) => 
    api.get(`/market-demand/competitors/${locationId}/summary`, { params: { days } }),
  getCompetitorPositioning: (setId, roomTypeId, date) => 
    api.get(`/market-demand/competitors/sets/${setId}/positioning/${roomTypeId}/${date}`),
  importCompetitorCSV: (setId, data) => api.post(`/market-demand/competitors/sets/${setId}/import/csv`, data),
  
  // Events and holidays
  getHolidays: (locationId = 'null', params = {}) => 
    api.get(`/market-demand/holidays/${locationId}`, { params }),
  addHoliday: (data) => api.post('/market-demand/holidays', data),
  
  getEvents: (locationId = 'null', params = {}) => 
    api.get(`/market-demand/events/${locationId}`, { params }),
  addEvent: (data) => api.post('/market-demand/events', data),
  updateEvent: (eventId, data) => api.put(`/market-demand/events/${eventId}`, data),
  deleteEvent: (eventId) => api.delete(`/market-demand/events/${eventId}`),
}

// Payment Management API
export const paymentAPI = {
  // Get payments with filtering and pagination
  getPayments: (params = {}) => api.get('/payments', { params }),
  
  // Get payment details by ID
  getPaymentDetails: (id) => api.get(`/payments/${id}`),
  
  // Get payment intent by Stripe ID (for service purchase integration)
  getPaymentIntentByStripeId: (stripeId) => api.get(`/payments/by-stripe-id/${stripeId}`),
  
  // Process refund
  processRefund: (id, data) => api.post(`/payments/${id}/refund`, data),
  
  // Reconcile payments
  reconcilePayments: (data) => api.post('/payments/reconcile', data),
  
  // Get analytics summary
  getAnalytics: (params = {}) => api.get('/payments/analytics/summary', { params }),
  
  // Export payments
  exportPayments: (params = {}) => {
    return api.get('/payments/export', { 
      params,
      responseType: 'blob' 
    }).then(response => response.data)
  }
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
