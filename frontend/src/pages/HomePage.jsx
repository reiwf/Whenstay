import { Link } from 'react-router-dom'
import { CheckCircle, Clock, Shield, Smartphone } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-primary-600">Whenstay</h1>
            </div>
            <div className="flex space-x-6">
              <Link
                to="/admin"
                className="text-sm text-gray-600 hover:text-primary-600 transition-colors"
              >
                Admin
              </Link>
              <Link
                to="/owner/login"
                className="text-sm text-gray-600 hover:text-primary-600 transition-colors"
              >
                Owner
              </Link>
              <Link
                to="/cleaner/login"
                className="text-sm text-gray-600 hover:text-primary-600 transition-colors"
              >
                Cleaner
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-primary-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            Skip the Line,
            <span className="text-primary-600"> Check-in Online</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Complete your hotel check-in before you arrive. Upload your documents, 
            provide your details, and walk straight to your room.
          </p>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-md mx-auto">
            <p className="text-sm text-gray-600 mb-4">
              Have a check-in link? Enter it below:
            </p>
            <div className="flex">
              <input
                type="text"
                placeholder="Enter your check-in token"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <button className="px-4 py-2 bg-primary-600 text-white rounded-r-lg hover:bg-primary-700 transition-colors">
                Go
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Our streamlined online check-in process saves you time and ensures a smooth arrival experience.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="bg-primary-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Smartphone className="w-8 h-8 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Receive Link
              </h3>
              <p className="text-gray-600">
                Get your personalized check-in link via email after booking confirmation.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-primary-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Upload Documents
              </h3>
              <p className="text-gray-600">
                Securely upload your passport or ID and provide required information.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-primary-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Get Verified
              </h3>
              <p className="text-gray-600">
                Our team reviews your information and confirms your check-in status.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-primary-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Skip the Queue
              </h3>
              <p className="text-gray-600">
                Arrive at your scheduled time and go directly to your room.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                Why Choose Online Check-in?
              </h2>
              <div className="space-y-6">
                <div className="flex items-start">
                  <CheckCircle className="w-6 h-6 text-green-500 mt-1 mr-3 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Save Time</h3>
                    <p className="text-gray-600">
                      Complete your check-in process before arrival and skip the front desk queue.
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <CheckCircle className="w-6 h-6 text-green-500 mt-1 mr-3 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Secure Process</h3>
                    <p className="text-gray-600">
                      Your documents and personal information are encrypted and securely stored.
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <CheckCircle className="w-6 h-6 text-green-500 mt-1 mr-3 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">24/7 Availability</h3>
                    <p className="text-gray-600">
                      Complete your check-in anytime, anywhere, from any device.
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <CheckCircle className="w-6 h-6 text-green-500 mt-1 mr-3 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Contactless Experience</h3>
                    <p className="text-gray-600">
                      Minimize physical contact and enjoy a safer, more hygienic check-in process.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-primary-50 to-blue-50 rounded-2xl p-8">
              <div className="text-center">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  Ready to Check-in?
                </h3>
                <p className="text-gray-600 mb-6">
                  If you have a reservation with us, you should have received a check-in link via email.
                </p>
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <p className="text-sm text-gray-600 mb-2">
                    Check-in link format:
                  </p>
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-800">
                    whenstay.com/checkin/your-token
                  </code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h3 className="text-2xl font-bold mb-4">Whenstay</h3>
            <p className="text-gray-400 mb-6">
              Streamlining your hotel experience with smart online check-in solutions.
            </p>
            <div className="flex justify-center space-x-6">
              <Link to="/admin" className="text-gray-400 hover:text-white transition-colors">
                Admin Portal
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}




