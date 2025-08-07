const SidebarItem = ({ icon: Icon, label, active, collapsed, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center px-4 py-3 text-base font-medium rounded-lg transition-all duration-200 touch-target
        ${active 
          ? 'bg-primary-100 text-primary-700 border-r-2 border-primary-600' 
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }
        ${collapsed ? 'justify-center px-3' : 'justify-start'}
      `}
      title={collapsed ? label : undefined}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 ${
        active ? 'text-primary-600' : 'text-gray-400'
      } ${collapsed ? '' : 'mr-4'}`} />
      
      {!collapsed && (
        <span className="truncate text-left">{label}</span>
      )}
      
      {active && !collapsed && (
        <div className="ml-auto w-2 h-2 bg-primary-600 rounded-full"></div>
      )}
    </button>
  )
}

export default SidebarItem
