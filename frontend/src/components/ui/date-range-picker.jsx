import * as React from "react"
import { PlaneLanding, PlaneTakeoff, X, Moon } from "lucide-react"
import { format, differenceInCalendarDays } from "date-fns"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

// --- helpers (UTC off-by-one guard) ---
const atNoon = (d) => (d ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12) : undefined)
const fmt = (d) => format(new Date(d.getFullYear(), d.getMonth(), d.getDate()), "yyyy-MM-dd")

export function DateRangePicker({
  dateRange,
  onDateRangeChange,
  placeholder = "Select dates",
  disabled = false,
  className,
  showClear = true,
  months = 2,
  ...props
}) {
  const [open, setOpen] = React.useState(false)
  const [month, setMonth] = React.useState(dateRange?.from ?? new Date())
  const isSameDay = (a, b) =>
  a && b &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()
  const [lastClicked, setLastClicked] = React.useState(null)

  React.useEffect(() => {
    if (open) setMonth(dateRange?.from ?? new Date())
  }, [open, dateRange?.from])

  const handleSelect = (range) => {
  const anchor = dateRange?.from ? atNoon(dateRange.from) : undefined
  const isFirstPick = !dateRange?.from && !dateRange?.to
  const isPickingEnd = !!dateRange?.from && !dateRange?.to

  // Case A: DayPicker sometimes sends `undefined` when you click the same day again.
  // If we were picking the end, interpret it as a same-day range instead of clearing.
    if (!range?.from) {
      if (isPickingEnd && anchor) {
        onDateRangeChange?.({ from: anchor, to: anchor })
        setOpen(false)
      } else {
        onDateRangeChange?.(undefined)
      }
      return
    }

    const from = atNoon(range.from)
    const to = range.to ? atNoon(range.to) : undefined

    // Case B: first click – anchor only, keep popover open
    if (isFirstPick && (!to || (to && from.getTime() === to.getTime()))) {
      onDateRangeChange?.({ from, to: undefined })
      return
    }

    // Case C: still picking end – keep anchor, keep open
    if (!to) {
      onDateRangeChange?.({ from, to: undefined })
      return
    }

    // Case D: second click with an end date – accept and close
    onDateRangeChange?.({ from, to })
    setOpen(false)
  }



  const clear = (e) => {
    e.preventDefault()
    e.stopPropagation()
    onDateRangeChange?.(undefined)
    setOpen(false)
  }

  

  const nights =
    dateRange?.from && dateRange?.to
      ? Math.max(0, differenceInCalendarDays(dateRange.to, dateRange.from))
      : null

  return (
    <div className={cn("relative", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div
            role="button"
            tabIndex={0}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-disabled={disabled || undefined}
            onClick={() => !disabled && setOpen(v => !v)}
            onKeyDown={(e) => {
              if (disabled) return
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(v => !v) }
            }}
            className={cn(
              // make it shrink-to-content on desktop, full width on mobile if you want:
              "inline-flex w-full sm:w-fit items-center gap-3",
              "rounded-xl border bg-white text-left shadow-sm transition cursor-pointer",
              "hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
              "px-3 py-2",
              disabled && "opacity-50 pointer-events-none"
            )}
            {...props}
          >
            {/* MOBILE layout */}
            <div className="sm:hidden relative w-full">           
              {/* Row 1: Check-in */}
              <div className="flex items-start gap-2 pr-8 py-1.5">
                <PlaneLanding className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">From</div>
                  <div className={cn("truncate text-sm", !dateRange?.from && "text-muted-foreground")}>
                    {dateRange?.from ? fmt(dateRange.from) : "Add date"}
                  </div>
                </div>
              </div>

              <div className="h-px bg-border mx-0.5" />

              {/* Row 2: Check-out */}
              <div className="flex items-start gap-2 pr-8 py-1.5">
                <PlaneTakeoff className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">To</div>
                  <div className={cn("truncate text-sm", !dateRange?.to && "text-muted-foreground")}>
                    {dateRange?.to ? fmt(dateRange.to) : "Add date"}
                  </div>
                </div>
              </div>
            </div>

            {/* DESKTOP layout */}
            <div className="hidden sm:flex items-center gap-3">
              <PlaneLanding className="h-4 w-4 text-muted-foreground" />
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">From</div>
                <div className={cn("truncate", !dateRange?.from && "text-muted-foreground")}>
                  {dateRange?.from ? fmt(dateRange.from) : "Add date"}
                </div>
              </div>

               {/* Connector (hide moon until both dates selected) */}
              {dateRange?.from && dateRange?.to ? (
                <div className="hidden sm:flex items-center w-28" aria-hidden="true">
                  <span className="flex-1 border-t border-dashed border-gray-500" />
                  <div className="relative mx-2">
                    <Moon className="h-4 w-4 text-amber-500" />
                    {typeof nights === "number" && (
                      <span className="absolute -top-2 -right-2 rounded-full text-primary text-[12px] leading-4 px-1">
                        {nights}
                      </span>
                    )}
                  </div>
                  <span className="flex-1 border-t border-dashed border-gray-500" />
                </div>
              ) : (
                // just a dashed line placeholder when no full selection
                <div className="hidden sm:flex items-center w-28" aria-hidden="true">
                  <span className="w-full border-t border-dashed border-border" />
                </div>
              )}



              <PlaneTakeoff className="h-4 w-4 text-muted-foreground" />
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">To</div>
                <div className={cn("truncate", !dateRange?.to && "text-muted-foreground")}>
                  {dateRange?.to ? fmt(dateRange.to) : "Add date"}
                </div>
              </div>

              {showClear && (dateRange?.from || dateRange?.to) && (
                <button
                  type="button"
                  className="rounded p-1 hover:bg-red-50"
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}
                  onClick={clear}
                  aria-label="Clear dates"
                  title="Clear dates"
                >
                  <X className="h-4 w-4 text-gray-400 hover:text-red-500" />
                </button>
              )}
            </div>

          </div>
        </PopoverTrigger>


        <PopoverContent className="w-auto p-0" align="start" >
          <Calendar
            mode="range"
            month={month}
            onMonthChange={setMonth}
            selected={dateRange}
            onSelect={handleSelect}
            numberOfMonths={months}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
