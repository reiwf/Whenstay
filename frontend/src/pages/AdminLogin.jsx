import { useState, useEffect } from '../../$node_modules/@types/react/index.js'
import { useNavigate } from '../../$node_modules/react-router-dom/dist/index.js'
import { useForm } from '../../$node_modules/react-hook-form/dist/index.js'
import toast from '../../$node_modules/react-hot-toast/dist/index.js'
import { Lock, User, ArrowLeft } from '../../$node_modules/lucide-react/dist/lucide-react.js'
import { adminAPI, setAuthToken, isAuthenticated } from '../services/api'
import LoadingSpinner from '../components/LoadingSpinner'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm()

  useEffect(() => {
    // Redirect if already authenticated
    if (isAuthenticated()) {
      navigate('/admin/dashboard')
    }
  }, [navigate])

  const onSubmit = async (data) => {
    try {
      setLoading(true)
      
      const response = await adminAPI.login(data)
      const { token, user } = response.data
      
      setAuthToken(token)
      toast.success(`Welcome back, ${user.username}!`)
      navigate('/admin/dashboard')
    } catch (error) {
      console.error('Login error:', error)
      // Error toast is handled by the API interceptor
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary-600 mb-2">Whenstay</h1>
          <h2 className="text-2xl font-bold text-gray-900">Admin Portal</h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to access the admin dashboard
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="form-label">
                <User className="w-4 h-4 inline mr-2" />
                Username
              </label>
              <input
                type="text"
                {...register('username', { 
                  required: 'Username is required' 
                })}
                className="input-field"
                placeholder="Enter your username"
                autoComplete="username"
              />
              {errors.username && (
                <p className="form-error">{errors.username.message}</p>
              )}
            </div>

            <div>
              <label className="form-label">
                <Lock className="w-4 h-4 inline mr-2" />
                Password
              </label>
              <input
                type="password"
                {...register('password', { 
                  required: 'Password is required' 
                })}
                className="input-field"
                placeholder="Enter your password"
                autoComplete="current-password"
              />
              {errors.password && (
                <p className="form-error">{errors.password.message}</p>
              )}
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary py-3"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <LoadingSpinner size="small" />
                    <span className="ml-2">Signing in...</span>
                  </div>
                ) : (
                  'Sign In'
                )}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Demo Credentials</span>
              </div>
            </div>

            <div className="mt-4 bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-2">For testing purposes:</p>
              <div className="text-xs font-mono bg-white p-2 rounded border">
                <div>Username: <span className="font-semibold">admin</span></div>
                <div>Password: <span className="font-semibold">admin123</span></div>
              </div>
            </div>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center text-sm text-gray-600 hover:text-primary-600 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
