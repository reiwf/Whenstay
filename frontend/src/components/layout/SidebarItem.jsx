const SidebarItem = ({ icon: Icon, label, active, collapsed, onClick, notificationCount = 0 }) => {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center px-4 py-3 text-base font-medium rounded-lg transition-all duration-200 touch-target relative
        ${active 
          ? 'bg-primary-100 text-primary-700 border-r-2 border-primary-600' 
          : 'text-primary-600 hover:bg-primary-100 hover:text-primary-900'
        }
        ${collapsed ? 'justify-center px-3' : 'justify-start'}
      `}
      title={collapsed ? label : undefined}
    >
      <div className="relative">
        <Icon className={`w-5 h-5 flex-shrink-0 ${
          active ? 'text-primary-600' : 'text-primary-400'
        }`} />
        
        {/* Notification badge */}
        {notificationCount > 0 && (
          <span className={`absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 ${
            collapsed ? 'text-[10px]' : 'text-xs'
          }`}>
            {notificationCount > 99 ? '99+' : notificationCount}
          </span>
        )}
      </div>
      
      {!collapsed && (
        <>
          <span className="truncate text-left ml-4">{label}</span>
          
          {/* Show notification badge in expanded view as well */}
          {notificationCount > 0 && (
            <span className="ml-auto bg-red-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-2">
              {notificationCount > 99 ? '99+' : notificationCount}
            </span>
          )}
          
          {active && notificationCount === 0 && (
            <div className="ml-auto w-2 h-2 bg-primary-600 rounded-full"></div>
          )}
        </>
      )}
    </button>
  )
}

export default SidebarItem
