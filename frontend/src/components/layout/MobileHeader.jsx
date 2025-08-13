import { Menu, ChevronLeft, Bell } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import ProfileDropdown from '../ProfileDropdown'

const MobileHeader = ({ onMenuClick, sidebarCollapsed, onToggleSidebar }) => {
  const { profile } = useAuth()

  return (
    <header className="border-b border-primary-200 shadow-sm">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left Side - Menu/Logo */}
        <div className="flex items-center space-x-4">
          {/* Mobile Menu Button */}
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Mobile Logo (only show when sidebar is closed) */}
          <div className="lg:hidden flex items-center">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center mr-3">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <h1 className="text-lg font-bold text-gray-900">Staylabel</h1>
          </div>
        </div>

        {/* Right Side - Actions & Profile */}
        <div className="flex items-center space-x-4">


          {/* Desktop Profile (when sidebar is collapsed) */}
          <div className={`hidden lg:block ${!sidebarCollapsed ? 'lg:hidden' : ''}`}>
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-primary-600 font-medium text-sm">
                  {profile?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="hidden xl:block">
                <p className="text-sm font-medium text-gray-900">
                  {profile?.email}
                </p>
                <p className="text-xs text-gray-500 capitalize">
                  {profile?.role}
                </p>
              </div>
              <ProfileDropdown />
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

export default MobileHeader
