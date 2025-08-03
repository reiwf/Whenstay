import { createContext, useContext, useState, useEffect } from 'react'
import { setAuthToken, clearAuthToken, isAuthenticated } from '../services/api'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  // Initialize auth state on mount
  useEffect(() => {
    initializeAuth()
  }, [])

  const initializeAuth = async () => {
    try {
      setLoading(true)
      
      // Check if user is already authenticated
      if (isAuthenticated()) {
        // Try to fetch current user profile
        const response = await fetch('/api/dashboard/auth/profile', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        })
        
        if (response.ok) {
          const data = await response.json()
          setUser(data.user)
          setProfile(data.user.profile)
          setIsLoggedIn(true)
        } else {
          // Token is invalid, clear it
          clearAuthToken()
          setUser(null)
          setProfile(null)
          setIsLoggedIn(false)
        }
      }
    } catch (error) {
      console.error('Error initializing auth:', error)
      clearAuthToken()
      setUser(null)
      setProfile(null)
      setIsLoggedIn(false)
    } finally {
      setLoading(false)
    }
  }

  const login = async (email, password) => {
    try {
      setLoading(true)
      
      const response = await fetch('/api/dashboard/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Login failed')
      }
      
      // Store token and user data
      setAuthToken(data.token)
      setUser(data.user)
      setProfile(data.user.profile)
      setIsLoggedIn(true)
      
      return {
        success: true,
        user: data.user,
        profile: data.user.profile
      }
    } catch (error) {
      console.error('Login error:', error)
      return {
        success: false,
        error: error.message
      }
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    try {
      setLoading(true)
      
      // Call logout endpoint if authenticated
      if (isAuthenticated()) {
        try {
          await fetch('/api/dashboard/auth/logout', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
          })
        } catch (error) {
          console.error('Logout API call failed:', error)
          // Continue with local logout even if API call fails
        }
      }
      
      // Clear local state and token
      clearAuthToken()
      setUser(null)
      setProfile(null)
      setIsLoggedIn(false)
      
      return { success: true }
    } catch (error) {
      console.error('Logout error:', error)
      return {
        success: false,
        error: error.message
      }
    } finally {
      setLoading(false)
    }
  }

  const refreshProfile = async () => {
    try {
      if (!isAuthenticated()) {
        return { success: false, error: 'Not authenticated' }
      }
      
      const response = await fetch('/api/dashboard/auth/profile', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to refresh profile')
      }
      
      const data = await response.json()
      setUser(data.user)
      setProfile(data.user.profile)
      
      return { success: true, profile: data.user.profile }
    } catch (error) {
      console.error('Error refreshing profile:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  const hasRole = (requiredRoles) => {
    if (!profile) return false
    
    if (Array.isArray(requiredRoles)) {
      return requiredRoles.includes(profile.role)
    }
    
    return profile.role === requiredRoles
  }

  const hasAdminAccess = () => {
    return hasRole(['admin', 'owner'])
  }

  const getDisplayName = () => {
    if (!profile) return 'User'
    
    const firstName = profile.first_name || ''
    const lastName = profile.last_name || ''
    
    if (firstName && lastName) {
      return `${firstName} ${lastName}`
    }
    
    if (firstName) return firstName
    if (lastName) return lastName
    
    return user?.email?.split('@')[0] || 'User'
  }

  const getRoleBadgeColor = () => {
    if (!profile) return 'gray'
    
    switch (profile.role) {
      case 'admin':
        return 'red'
      case 'owner':
        return 'blue'
      case 'cleaner':
        return 'green'
      case 'guest':
        return 'yellow'
      default:
        return 'gray'
    }
  }

  const getRoleDisplayName = () => {
    if (!profile) return 'User'
    
    switch (profile.role) {
      case 'admin':
        return 'Administrator'
      case 'owner':
        return 'Property Owner'
      case 'cleaner':
        return 'Cleaner'
      case 'guest':
        return 'Guest'
      default:
        return profile.role
    }
  }

  const value = {
    // State
    user,
    profile,
    loading,
    isLoggedIn,
    
    // Actions
    login,
    logout,
    refreshProfile,
    
    // Utilities
    hasRole,
    hasAdminAccess,
    getDisplayName,
    getRoleBadgeColor,
    getRoleDisplayName,
    
    // Legacy compatibility
    isAuthenticated: isLoggedIn
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthContext
