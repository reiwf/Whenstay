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
  MessageCircle,
  X
} from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import SidebarItem from './SidebarItem'
import ProfileDropdown from '../ProfileDropdown'
import { useGlobalCommunication } from '../../hooks/useGlobalCommunication'

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
  const { unreadCount } = useGlobalCommunication()

  // Navigation items based on user role
  const getNavigationItems = () => {
    const items = []

    if (userRole === 'admin') {
      items.push(
        { id: 'dashboard', label: 'Dashboard', icon: Home },
        { id: 'communication', label: 'Communication', icon: MessageCircle },        
        { id: 'reservation-management', label: 'Reservation', icon: CheckCircle },
        { id: 'cleaning-management', label: 'Cleaning', icon: Sparkles },
        { id: 'properties', label: 'Properties', icon: Building },
        { id: 'users', label: 'Users', icon: Users }
      )
    } else if (userRole === 'owner') {
      items.push(
        { id: 'properties', label: 'My Properties', icon: Building },
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
    } else if (itemId === 'cleaning' || itemId === 'cleaning-management') {
      // Navigate to the dedicated cleaning page
      navigate('/cleaning')
    } else if (itemId === 'properties') {
      // Navigate to the dedicated property page
      navigate('/property')
    } else if (itemId === 'users') {
      // Navigate to the dedicated user page
      navigate('/user')
    } else if (itemId === 'communication') {
      // Navigate to the dedicated communication page
      navigate('/communication')
    } else if (itemId === 'dashboard') {
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
    <div className="flex flex-col w-full h-full bg-primary-50 border-r border-primary-200 shadow-sm">
      {/* Header */}
      <div className={`flex items-center justify-between p-4 border-b border-primary-200 ${
        collapsed && !mobile ? 'px-2' : 'px-4'
      }`}>
        {/* Logo */}
        <div className="flex items-center">
          {(!collapsed || mobile) && (
            <>
              <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center mr-3">
                <span className="text-white font-bold text-sm">S</span>
              </div>
              <h1 className="text-lg font-bold text-primary-900">Staylabel</h1>
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
              className="p-1 rounded-md text-primary-400 hover:text-primary-600 hover:bg-primary-100"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          {!mobile && onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded-md text-primary-400 hover:text-primary-600 hover:bg-primary-100"
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
            notificationCount={item.id === 'communication' ? unreadCount : 0}
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
      <div className={`border-t border-primary-200 p-4 ${collapsed && !mobile ? 'px-2' : 'px-4'}`}>
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
