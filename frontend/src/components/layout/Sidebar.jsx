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
  X,
  DollarSign,
  Calendar
} from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTranslation } from 'react-i18next'
import SidebarItem from './SidebarItem'
import ProfileDropdown from '../ProfileDropdown'
import { useGlobalCommunication } from '../../hooks/useGlobalCommunication'
import staylabelLogo from '../../../shared/staylabellogo.png'

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
  const { t } = useTranslation('navigation')

  // Navigation items based on user role
  const getNavigationItems = () => {
    const items = []

    if (userRole === 'admin') {
      items.push(
        { id: 'dashboard', label: t('dashboard'), icon: Home },
        { id: 'communication', label: t('communication'), icon: MessageCircle },        
        { id: 'calendar', label: t('calendar'), icon: Calendar },
        { id: 'reservation-management', label: t('reservationManagement'), icon: CheckCircle },
        { id: 'cleaning-management', label: t('cleaningManagement'), icon: Sparkles },
        { id: 'properties', label: t('properties'), icon: Building },
        { id: 'pricing', label: t('pricing'), icon: DollarSign },
        { id: 'market-settings', label: t('marketSettings'), icon: Settings },
        { id: 'users', label: t('users'), icon: Users }
      )
    } else if (userRole === 'owner') {
      items.push(
        { id: 'properties', label: t('myProperties'), icon: Building },
      )
    } else if (userRole === 'cleaner') {
      items.push(
        { id: 'cleaning', label: t('myTasks'), icon: Sparkles }
      )
    } else if (userRole === 'guest') {
      items.push(
        { id: 'overview', label: t('overview'), icon: Home },
        { id: 'property', label: t('propertyInfo'), icon: Building },
        { id: 'local', label: t('localGuide'), icon: MapPin },
        { id: 'documents', label: t('documents'), icon: FileText }
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
    } else if (itemId === 'pricing') {
      // Navigate to the dedicated pricing page
      navigate('/pricing')
    } else if (itemId === 'market-settings') {
      // Navigate to the dedicated market settings page
      navigate('/market-settings')
    } else if (itemId === 'calendar') {
      // Navigate to the dedicated calendar page
      navigate('/calendar')
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
              <img 
                src={staylabelLogo} 
                alt="Staylabel Logo" 
                className="w-8 h-8 mr-3 rounded-lg"
              />
              <h1 className="text-lg font-bold text-primary-900">{t('staylabel')}</h1>
            </>
          )}
          {collapsed && !mobile && (
            <img 
              src={staylabelLogo} 
              alt="Staylabel Logo" 
              className="w-6 h-6 mx-auto rounded-lg"
            />
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
