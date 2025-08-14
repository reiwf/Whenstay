import { Link } from 'react-router-dom'
import GuestSearch from '../components/GuestSearch'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-primary-100">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary-700 rounded-lg"></div>
              <h1 className="text-xl font-semibold text-primary-900">Staylabel</h1>
            </div>
            <div className="flex items-center space-x-6">
              <button
                onClick={() => document.getElementById('guest-search')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-sm text-primary-600 hover:text-primary-900 transition-colors"
              >
                Check-in
              </button>
              <Link
                to="/dashboard"
                className="text-primary-600 px-4 py-2 rounded-lg text-sm font-medium hover:text-primary-900 transition-colors"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-4xl mx-auto px-6 py-24 text-center">
        <h1 className="text-5xl md:text-6xl font-light text-primary-900 mb-8 leading-tight">
          Welcome
        </h1>        
        <p className="text-xl text-primary-600 max-w-2xl mx-auto leading-relaxed">
          Label 01 Dotonbori Aparthotel
        </p>
        <p className="text-xl text-primary-600 mb-16 max-w-2xl mx-auto leading-relaxed">
          Online Check-in 
        </p>
        
        {/* Guest Search */}
        <div id="guest-search" className="mb-16">
          <div className="flex justify-center">
            <GuestSearch />
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-primary-100 py-12">
        <div className="max-w-6xl mx-auto px-6">
   
          
          <div className="border-t border-primary-100 mt-12 pt-8 text-center">
            <p className="text-sm text-primary-500">
              © 2024 Staylabel. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
