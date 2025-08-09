import * as React from "react"
import { CalendarIcon, X } from "lucide-react"
import { format } from "date-fns"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export function DateRangePicker({
  dateRange,
  onDateRangeChange,
  placeholder = "Pick a date range",
  disabled = false,
  className,
  showClear = true,
  ...props
}) {
  const [open, setOpen] = React.useState(false)

  const handleSelect = (range) => {
    onDateRangeChange?.(range)
  }

  const handleClear = (e) => {
    e.stopPropagation()
    onDateRangeChange?.(undefined)
  }

  const formatDateRange = (range) => {
    if (!range) return placeholder
    
    if (range.from) {
      if (range.to) {
        return `${format(range.from, "yyyy-MM-dd")} - ${format(range.to, "yyyy-MM-dd")}`
      } else {
        return format(range.from, "yyyy-MM-dd")
      }
    }
    
    return placeholder
  }

  return (
    <div className={cn("relative", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal pr-10",
              !dateRange && "text-muted-foreground"
            )}
            disabled={disabled}
            {...props}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            <span className="flex-1 truncate">{formatDateRange(dateRange)}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            defaultMonth={dateRange?.from}
            selected={dateRange}
            onSelect={handleSelect}
            numberOfMonths={2}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      {showClear && dateRange && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-1 top-1/2 transform -translate-y-1/2 h-auto p-1 hover:bg-red-50"
          onClick={handleClear}
        >
          <X className="h-4 w-4 text-gray-400 hover:text-red-500" />
        </Button>
      )}
    </div>
  )
}
