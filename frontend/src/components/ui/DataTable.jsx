import { ChevronUp, ChevronDown } from 'lucide-react'

const DataTable = ({
  columns,
  data,
  sortable = false,
  sortColumn,
  sortDirection,
  onSort,
  emptyMessage = 'No data available',
  emptyIcon: EmptyIcon,
  className = ''
}) => {
  const handleSort = (columnKey) => {
    if (!sortable || !onSort) return
    
    const newDirection = 
      sortColumn === columnKey && sortDirection === 'asc' ? 'desc' : 'asc'
    onSort(columnKey, newDirection)
  }

  const getSortIcon = (columnKey) => {
    if (sortColumn !== columnKey) return null
    return sortDirection === 'asc' ? 
      <ChevronUp className="w-4 h-4" /> : 
      <ChevronDown className="w-4 h-4" />
  }

  if (!data || data.length === 0) {
    return (
      <div className="card">
        <div className="text-center py-12">
          {EmptyIcon && <EmptyIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />}
          <p className="text-gray-500">{emptyMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`card p-0 overflow-hidden ${className}`}>
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                    sortable && column.sortable !== false ? 'cursor-pointer hover:bg-gray-100' : ''
                  }`}
                  onClick={() => sortable && column.sortable !== false && handleSort(column.key)}
                >
                  <div className="flex items-center gap-1">
                    {column.title}
                    {sortable && column.sortable !== false && getSortIcon(column.key)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row, index) => (
              <tr key={row.id || index} className="hover:bg-gray-50">
                {columns.map((column) => (
                  <td key={column.key} className="px-6 py-4 whitespace-nowrap">
                    {column.render ? column.render(row[column.key], row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden divide-y divide-gray-200">
        {data.map((row, index) => (
          <div key={row.id || index} className="p-4">
            {columns.map((column) => (
              <div key={column.key} className="flex justify-between items-start py-2">
                <span className="text-sm font-medium text-gray-600 mr-4">
                  {column.title}:
                </span>
                <span className="text-sm text-gray-900 text-right flex-1">
                  {column.render ? column.render(row[column.key], row) : row[column.key]}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default DataTable
