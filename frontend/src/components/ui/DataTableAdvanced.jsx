import { useState, useMemo } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import {
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Settings2,
  Download,
  Calendar,
} from 'lucide-react'
import { isDateValue, formatDateValue, isDateInRange, getDateColumns } from '@/lib/utils'

export function DataTableAdvanced({
  data = [],
  columns = [],
  searchable = true,
  filterable = true,
  exportable = false,
  pageSize = 10,
  pageSizeOptions = [10, 20, 30, 40, 50],
  emptyMessage = 'No data available',
  emptyIcon: EmptyIcon,
  onRowClick,
  className = '',
  loading = false,
  searchableFields = [],
  customSearchFunction = null,
}) {
  const [sorting, setSorting] = useState([])
  const [columnFilters, setColumnFilters] = useState([])
  const [columnVisibility, setColumnVisibility] = useState({})
  const [rowSelection, setRowSelection] = useState({})
  const [globalFilter, setGlobalFilter] = useState('')
  const [dateRange, setDateRange] = useState(undefined)
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: pageSize,
  })

  // Enhanced columns with automatic date formatting
  const enhancedColumns = useMemo(() => {
    return columns.map(column => ({
      ...column,
      cell: column.cell || (({ getValue }) => {
        const value = getValue()
        if (isDateValue(value)) {
          return formatDateValue(value)
        }
        return value
      })
    }))
  }, [columns])

  // Date columns for filtering
  const dateColumns = useMemo(() => {
    return getDateColumns(enhancedColumns)
  }, [enhancedColumns])

  // Custom filter function for date range
  const dateRangeFilterFn = (row, columnId, value) => {
    if (!value || (!value.from && !value.to)) return true
    
    // Check all date columns
    return dateColumns.some(col => {
      const colId = col.accessorKey || col.id
      const cellValue = row.getValue(colId)
      return isDateInRange(cellValue, value)
    })
  }

  // Enhanced global filter function
  const enhancedGlobalFilterFn = (row, columnId, value) => {
    if (!value) return true
    
    const searchValue = value.toLowerCase()
    
    // Use custom search function if provided
    if (customSearchFunction) {
      return customSearchFunction(row.original, searchValue)
    }
    
    // Use searchable fields if provided
    if (searchableFields && searchableFields.length > 0) {
      return searchableFields.some(fieldConfig => {
        if (typeof fieldConfig === 'string') {
          // Simple field name
          const fieldValue = row.original[fieldConfig]
          return fieldValue?.toString().toLowerCase().includes(searchValue)
        } else if (typeof fieldConfig === 'object') {
          // Field configuration object
          const { fields, combiner } = fieldConfig
          if (combiner) {
            // Use combiner function to create searchable text
            const combinedText = combiner(row.original)
            return combinedText?.toLowerCase().includes(searchValue)
          } else if (fields) {
            // Search across multiple fields
            return fields.some(field => {
              const fieldValue = row.original[field]
              return fieldValue?.toString().toLowerCase().includes(searchValue)
            })
          }
        }
        return false
      })
    }
    
    // Fallback to default behavior - search all string values
    return Object.values(row.original).some(cellValue => {
      if (cellValue == null) return false
      return cellValue.toString().toLowerCase().includes(searchValue)
    })
  }

  // Enhanced data with date range filtering applied manually
  const filteredData = useMemo(() => {
    if (!dateRange) return data
    
    return data.filter(row => {
      return dateColumns.some(col => {
        const colId = col.accessorKey || col.id
        const cellValue = row[colId]
        return isDateInRange(cellValue, dateRange)
      })
    })
  }, [data, dateRange, dateColumns])

  const table = useReactTable({
    data: filteredData,
    columns: enhancedColumns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    globalFilterFn: enhancedGlobalFilterFn,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
      pagination,
    },
  })

  const selectedRows = table.getFilteredSelectedRowModel().rows

  const handleExport = () => {
    if (!exportable) return
    
    const visibleColumns = table.getVisibleLeafColumns()
    const rows = table.getFilteredRowModel().rows
    
    const csvContent = [
      // Header row
      visibleColumns.map(column => column.columnDef.header || column.id).join(','),
      // Data rows
      ...rows.map(row => 
        visibleColumns.map(column => {
          const cell = row.getValue(column.id)
          return typeof cell === 'string' ? `"${cell}"` : cell || ''
        }).join(',')
      )
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'table-data.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className={`bg-white rounded-lg border ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className={`bg-white rounded-lg border ${className}`}>
        <div className="text-center py-12">
          {EmptyIcon && <EmptyIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />}
          <p className="text-gray-500 text-lg font-medium">{emptyMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">          
          {/* Column Filters */}
          {filterable && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="mr-2 h-4 w-4" />
                  Filter
                  {columnFilters.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {columnFilters.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanFilter())
                  .map((column) => {
                    return (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        className="capitalize"
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) =>
                          column.toggleVisibility(!!value)
                        }
                      >
                        {column.columnDef.header || column.id}
                      </DropdownMenuCheckboxItem>
                    )
                  })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          {/* Global Search */}
          {searchable && (
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
          )}

          {/* Date Range Filter */}
          {dateColumns.length > 0 && (
            <DateRangePicker
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              placeholder="Filter by date range"
              className="w-80"
            />
          )}
        </div>
        

        <div className="flex items-center space-x-2">
          {/* Selected rows indicator */}
          {selectedRows.length > 0 && (
            <div className="text-sm text-muted-foreground">
              {selectedRows.length} of {table.getFilteredRowModel().rows.length} row(s) selected
            </div>
          )}

          {/* Column visibility */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings2 className="mr-2 h-4 w-4" />
                View
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.columnDef.header || column.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Export */}
          {exportable && (
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className="px-4 py-3">
                      {header.isPlaceholder ? null : (
                        <div
                          className={`flex items-center space-x-2 ${
                            header.column.getCanSort()
                              ? 'cursor-pointer select-none hover:bg-gray-50 rounded px-2 py-1 -mx-2 -my-1'
                              : ''
                          }`}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <span>
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                          </span>
                          {header.column.getCanSort() && (
                            <span className="text-gray-400">
                              {header.column.getIsSorted() === 'desc' ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : header.column.getIsSorted() === 'asc' ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <div className="h-4 w-4" />
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className={onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-4 py-3">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium">Rows per page</p>
          <select
            value={table.getState().pagination.pageSize}
            onChange={(e) => {
              table.setPageSize(Number(e.target.value))
            }}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          >
            {pageSizeOptions.map((pageSize) => (
              <option key={pageSize} value={pageSize}>
                {pageSize}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-6 lg:space-x-8">
          <div className="flex w-[100px] items-center justify-center text-sm font-medium">
            Page {table.getState().pagination.pageIndex + 1} of{' '}
            {table.getPageCount()}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to first page</span>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to previous page</span>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to next page</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to last page</span>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          {table.getFilteredRowModel().rows.length} of {filteredData.length} entries
          {(globalFilter || dateRange) && ` (filtered from ${data.length} total entries)`}
        </div>
        {selectedRows.length > 0 && (
          <div>
            {selectedRows.length} row(s) selected
          </div>
        )}
      </div>
    </div>
  )
}

export default DataTableAdvanced
