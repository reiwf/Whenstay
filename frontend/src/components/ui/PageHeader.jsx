import { RefreshCw } from 'lucide-react'

const PageHeader = ({
  title,
  subtitle,
  action,
  onRefresh,
  className = ''
}) => {
  return (
    <div className={`page-header ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="page-title">{title}</h1>
          {subtitle && (
            <p className="page-subtitle">{subtitle}</p>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="btn-ghost p-2"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
          {action && (
            <div className="flex-shrink-0">
              {action}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PageHeader
