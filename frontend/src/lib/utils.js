import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"
import { format, isValid, parseISO } from "date-fns"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function getTokyoToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
}

export function isDateValue(value) {
  if (!value) return false
  
  // Check if it's already a Date object
  if (value instanceof Date) return isValid(value)
  
  // Check if it's an ISO string or date-like string
  if (typeof value === 'string') {
    // Common date patterns
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, // ISO datetime
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/, // SQL datetime
      /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
      /^\d{2}-\d{2}-\d{4}$/, // MM-DD-YYYY
    ]
    
    const matchesPattern = datePatterns.some(pattern => pattern.test(value))
    if (matchesPattern) {
      try {
        const date = new Date(value)
        return isValid(date)
      } catch {
        return false
      }
    }
  }
  
  return false
}

export function formatDateValue(value) {
  if (!value) return value
  
  try {
    let date
    
    if (value instanceof Date) {
      date = value
    } else if (typeof value === 'string') {
      // Try parsing as ISO string first, then as regular date
      date = value.includes('T') ? parseISO(value) : new Date(value)
    } else {
      return value
    }
    
    if (isValid(date)) {
      return format(date, "yyyy-MM-dd")
    }
  } catch (error) {
    console.warn('Error formatting date:', error)
  }
  
  return value
}

export function isDateInRange(dateValue, dateRange) {
  if (!dateRange || (!dateRange.from && !dateRange.to)) return true
  if (!dateValue) return false
  
  try {
    let date
    if (dateValue instanceof Date) {
      date = dateValue
    } else {
      date = new Date(dateValue)
    }
    
    if (!isValid(date)) return false
    
    // Reset time to start of day for accurate comparison
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    
    if (dateRange.from && dateRange.to) {
      const fromDate = new Date(dateRange.from.getFullYear(), dateRange.from.getMonth(), dateRange.from.getDate())
      const toDate = new Date(dateRange.to.getFullYear(), dateRange.to.getMonth(), dateRange.to.getDate())
      return dateOnly >= fromDate && dateOnly <= toDate
    } else if (dateRange.from) {
      const fromDate = new Date(dateRange.from.getFullYear(), dateRange.from.getMonth(), dateRange.from.getDate())
      return dateOnly >= fromDate
    } else if (dateRange.to) {
      const toDate = new Date(dateRange.to.getFullYear(), dateRange.to.getMonth(), dateRange.to.getDate())
      return dateOnly <= toDate
    }
    
    return true
  } catch (error) {
    console.warn('Error checking date range:', error)
    return false
  }
}

export function getDateColumns(columns) {
  return columns.filter(column => {
    // Check if column id/accessorKey suggests it's a date
    const key = column.accessorKey || column.id
    if (!key) return false
    
    const dateKeywords = ['date', 'created', 'updated', 'modified', 'time', 'checkin', 'checkout']
    return dateKeywords.some(keyword => key.toLowerCase().includes(keyword))
  })
}
