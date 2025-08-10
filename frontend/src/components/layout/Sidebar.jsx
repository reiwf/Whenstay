import { 
  Home, 
  Building, 
  Users, 
  CheckCircle, 
  Sparkles, 
  ChevronLeft, 
  MapPin, 
  FileText, 
  Settings,
  X
} from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import SidebarItem from './SidebarItem'
import ProfileDropdown from '../ProfileDropdown'

const Sidebar = ({ 
  activeSection, 
  onSectionChange, 
  collapsed = false, 
  onToggleCollapse, 
  mobile = false, 
  onClose,
  userRole 
}) => {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Navigation items based on user role
  const getNavigationItems = () => {
    const items = []

    if (userRole === 'admin') {
      items.push(
        { id: 'dashboard', label: 'Dashboard', icon: Home },
        { id: 'properties', label: 'Properties', icon: Building },
        { id: 'reservation-management', label: 'Reservation', icon: CheckCircle },
        { id: 'cleaning', label: 'Cleaning', icon: Sparkles },
        { id: 'users', label: 'Users', icon: Users }
      )
    } else if (userRole === 'owner') {
      items.push(
        { id: 'dashboard', label: 'Dashboard', icon: Home },
        { id: 'properties', label: 'My Properties', icon: Building }
      )
    } else if (userRole === 'cleaner') {
      items.push(
        { id: 'cleaning', label: 'My Tasks', icon: Sparkles }
      )
    } else if (userRole === 'guest') {
      items.push(
        { id: 'overview', label: 'Reservation', icon: Home },
        { id: 'property', label: 'Property Info', icon: Building },
        { id: 'local', label: 'Local Guide', icon: MapPin },
        { id: 'documents', label: 'Documents', icon: FileText }
      )
    }

    return items
  }

  const navigationItems = getNavigationItems()

  // Handle navigation clicks
  const handleNavigationClick = (itemId) => {
    if (itemId === 'reservation-management') {
      // Navigate to the dedicated reservation page
      navigate('/reservation')
    } else if (itemId === 'dashboard' || itemId === 'properties' || itemId === 'cleaning' || itemId === 'users') {
      // For dashboard items, navigate to dashboard and let onSectionChange handle the section
      if (location.pathname !== '/dashboard') {
        navigate('/dashboard')
      }
      if (onSectionChange) {
        onSectionChange(itemId)
      }
    } else {
      // Default behavior for other items
      if (onSectionChange) {
        onSectionChange(itemId)
      }
    }
  }

  return (
    <div className="flex flex-col w-full h-full bg-white border-r border-gray-200 shadow-sm">
      {/* Header */}
      <div className={`flex items-center justify-between p-4 border-b border-gray-200 ${
        collapsed && !mobile ? 'px-2' : 'px-4'
      }`}>
        {/* Logo */}
        <div className="flex items-center">
          {(!collapsed || mobile) && (
            <>
              <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center mr-3">
                <span className="text-white font-bold text-sm">S</span>
              </div>
              <h1 className="text-lg font-bold text-gray-900">Staylabel</h1>
            </>
          )}
          {collapsed && !mobile && (
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center mx-auto">
              <span className="text-white font-bold text-sm">S</span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-2">
          {mobile && (
            <button
              onClick={onClose}
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          {!mobile && onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <ChevronLeft className={`w-4 h-4 transition-transform ${
                collapsed ? 'rotate-180' : ''
              }`} />
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {navigationItems.map((item) => (
          <SidebarItem
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={activeSection === item.id}
            collapsed={collapsed && !mobile}
            onClick={() => {
              handleNavigationClick(item.id)
              if (mobile && onClose) {
                onClose()
              }
            }}
          />
        ))}
      </nav>

      {/* User Profile Section */}
      <div className={`border-t border-gray-200 p-4 ${collapsed && !mobile ? 'px-2' : 'px-4'}`}>
        {collapsed && !mobile && (
          <div className="flex justify-center">
            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-primary-600 font-medium text-sm">
                {profile?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        )}

        {(!collapsed || mobile) && (
          <div >
            <ProfileDropdown />
          </div>
        )}
      </div>
    </div>
  )
}

export default Sidebar
