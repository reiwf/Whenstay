const StatsCard = ({
  title,
  value,
  icon: Icon,
  iconColor = 'text-primary-600',
  trend,
  trendDirection,
  subtitle,
  className = ''
}) => {
  const getTrendColor = () => {
    if (!trendDirection) return 'text-gray-500'
    return trendDirection === 'up' ? 'text-green-600' : 'text-red-600'
  }

  const formatValue = (val) => {
    if (typeof val === 'number') {
      if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`
      if (val >= 1000) return `${(val / 1000).toFixed(1)}K`
      return val.toString()
    }
    return val
  }

  return (
    <div className={`card ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className={`p-2 rounded-lg bg-gray-50 ${iconColor}`}>
                <Icon className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-600 truncate">
                {title}
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatValue(value)}
              </p>
              {subtitle && (
                <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
              )}
            </div>
          </div>
          
          {trend && (
            <div className="mt-3 flex items-center">
              <span className={`text-sm font-medium ${getTrendColor()}`}>
                {trendDirection === 'up' ? '↑' : trendDirection === 'down' ? '↓' : ''} {trend}
              </span>
              <span className="text-xs text-gray-500 ml-2">vs last period</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default StatsCard
