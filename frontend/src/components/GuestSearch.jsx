import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Loader2 } from 'lucide-react'

const GuestSearch = () => {
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const navigate = useNavigate()

  const validateToken = async (token) => {
    try {
      // Use direct fetch to bypass axios interceptors and avoid automatic error toasts
      const response = await fetch(`/api/guest/${token}`)
      if (response.ok) {
        return true
      } else if (response.status === 404) {
        return false
      } else {
        throw new Error('Failed to validate token')
      }
    } catch (error) {
      console.error('Token validation error:', error)
      throw error
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!token.trim()) {
      setError(true)
      setTimeout(() => {
        setError(false)
        setToken('') // Clear input after 3 seconds
      }, 3000)
      return
    }

    setLoading(true)
    setError(false)

    try {
      const isValid = await validateToken(token.trim())
      
      if (isValid) {
        // Redirect to guest dashboard
        navigate(`/guest/${token.trim()}`)
      } else {
        // Show error state with shake animation
        setError(true)
        setTimeout(() => {
          setError(false)
          setToken('') // Clear input after 3 seconds
        }, 1500)
      }
    } catch (error) {
      // Show error state for network/server errors too
      setError(true)
      setTimeout(() => {
        setError(false)
        setToken('') // Clear input after 3 seconds
      }, 1500)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center text-primary-800 space-x-2">
      <div className="relative">
        <input
          type="text"
          value={token}
          onChange={(e) => {
            setToken(e.target.value)
            if (error) setError(false) // Clear error when user types
          }}
          placeholder="Check-in with Label ID"
          className={`placeholder-primary-400 px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1 w-32 sm:w-40 md:w-48 transition-all duration-200 border ${
            error
              ? 'border-red-200 bg-red-50 text-red-500 focus:ring-red-500 animate-shake'
              : 'border-primary-400 focus:border-primary-400'
          }`}
          disabled={loading}
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="flex items-center justify-center px-3 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Search with Label ID"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Search className="w-4 h-4" />
        )}
      </button>
    </form>
  )
}

export default GuestSearch
