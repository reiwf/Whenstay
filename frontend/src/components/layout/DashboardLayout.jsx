import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import Sidebar from './Sidebar'
import MobileHeader from './MobileHeader'
import { PageHeader } from '../ui'

const DashboardLayout = ({ 
  children, 
  activeSection, 
  onSectionChange,
  pageTitle,
  pageSubtitle,
  pageAction,
  onRefresh
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { profile } = useAuth()

  // Close sidebar on mobile when route changes
  useEffect(() => {
    setSidebarOpen(false)
  }, [activeSection])

  // Handle responsive sidebar behavior
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false) // Desktop doesn't use overlay
        setSidebarCollapsed(false) // Reset collapse on desktop
      }
    }

    window.addEventListener('resize', handleResize)
    handleResize() // Initial check

    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Desktop Sidebar */}
      <div className={`hidden lg:flex lg:flex-shrink-0 transition-all duration-300 ${
        sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'
      }`}>
        <div className="w-full h-full">
          <Sidebar
            activeSection={activeSection}
            onSectionChange={onSectionChange}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            userRole={profile?.role}
          />
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-primary-200 bg-opacity-75 transition-opacity"
            onClick={() => setSidebarOpen(false)}
          />
          
          {/* Sidebar */}
          <div className="relative flex flex-col w-64 bg-white shadow-xl">
            <Sidebar
              activeSection={activeSection}
              onSectionChange={onSectionChange}
              mobile={true}
              onClose={() => setSidebarOpen(false)}
              userRole={profile?.role}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <MobileHeader
          onMenuClick={() => setSidebarOpen(true)}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        {/* Main Content - Full Width */}
        <main className="flex-1 relative overflow-auto">
          <div className="w-full h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

export default DashboardLayout
