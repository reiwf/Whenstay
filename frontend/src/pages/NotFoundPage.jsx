import { Link } from '../../$node_modules/react-router-dom/dist/index.js'
import { Home, ArrowLeft } from '../../$node_modules/lucide-react/dist/lucide-react.js'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="text-9xl font-bold text-primary-600 mb-4">404</h1>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Page Not Found</h2>
          <p className="text-lg text-gray-600 mb-8">
            The page you're looking for doesn't exist or has been moved.
          </p>
          
          <div className="space-y-4">
            <Link
              to="/"
              className="inline-flex items-center btn-primary"
            >
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </Link>
            
            <div className="text-center">
              <button
                onClick={() => window.history.back()}
                className="inline-flex items-center text-sm text-gray-600 hover:text-primary-600 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
