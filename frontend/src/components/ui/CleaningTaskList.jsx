// components/cleaning/CleaningTaskList.jsx
import React, { useMemo } from 'react'
import {
  Calendar, Building, Home, Bed, Key, UserCheck, Zap,
  Play, Pause, CheckCircle, Edit, Trash2, AlertCircle
} from 'lucide-react'

const fmtYMD = (d) =>
  new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })

const titleCase = (s) =>
  (s || 'standard_clean').replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())

const statusBadgeCls = (status) => {
  switch (status) {
    case 'pending': return 'bg-yellow-100/80 text-yellow-800 ring-1 ring-yellow-300/60'
    case 'in_progress': return 'bg-blue-100/80 text-blue-800 ring-1 ring-blue-300/60'
    case 'completed': return 'bg-green-100/80 text-green-800 ring-1 ring-green-300/60'
    case 'cancelled': return 'bg-red-100/80 text-red-800 ring-1 ring-red-300/60'
    default: return 'bg-slate-100/80 text-slate-800 ring-1 ring-slate-300/60'
  }
}

/** ---------- Single Card (no property/date here) ---------- */
function TaskCard({
  task,
  cleaners,
  isAdmin,
  onUpdateStatus,
  onAssignCleaner,
  onEdit,
  onDelete,
}) {

    const truncate = (str, maxLength = 15) => 
  str.length > maxLength ? str.slice(0, maxLength) + "..." : str;

    const bookingName = truncate(
    task.display_booking_name || task.booking_name || "Unknown Guest",
    15
    );
  const taskType = titleCase(task.task_type)

  return (
    <div
      className="
        relative overflow-hidden rounded-2xl
        border border-white/50 bg-white/40
        shadow-[0_6px_20px_rgba(36,38,45,0.08)]
        backdrop-blur-md
        px-3.5 py-3
      "
    >
      {/* subtle gradient sheen */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/40 via-white/10 to-white/0" />

      {/* Status pill */}
      <div className="absolute right-2 top-2 z-10">
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusBadgeCls(task.status)}`}>
          {String(task.status || '').replace('_', ' ')}
        </span>
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Row: Room type + unit + access */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-700">
          <span className="inline-flex items-center">
            {bookingName}
          </span>
          <span className="text-slate-300">•</span>
          <span className="inline-flex items-center">            
            
            <Home className="mr-1.5 h-3.5 w-3.5 text-slate-500" />
            {task.room_type_name || 'Room'}
          </span>
          {task.access_code && (
            <>
              <span className="text-slate-300">•</span>
              <span className="inline-flex items-center">
                <Key className="mr-1.5 h-3.5 w-3.5 text-slate-500" />
                {task.access_code}
              </span>
            </>
          )}
        </div>

        {/* Guest */}
        <div className="flex items-center mt-2 rounded-lg bg-slate-50/60 px-2.5 py-1.5 text-slate-700 ring-1 ring-slate-200/50">
          <Bed className="mr-1.5 h-3.5 w-3.5 text-slate-500" />
            {task.room_unit_number || 'TBD'}
         
        {task.priority === 'high' && (
            <span className="ml-1.5 inline-flex items-center rounded-full bg-red-50/80 px-2 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200">
            <Zap className="h-3.5 w-3.5" />
            </span>
        )}
        {task.is_overdue && (
            <span className="inline-flex items-center rounded-full bg-red-100/70 px-2 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200">
            <AlertCircle className="mr-1 h-3.5 w-3.5" />
            Overdue
            </span>
        )}  
        <span className="inline-flex items-center rounded-full bg-white/70 px-2.5 py-1 text-xs text-slate-800 ring-1 ring-white/60">
          <span className="text-slate-300 mr-1.5">•</span>  {taskType}
            </span>
        </div>

    
        {task.special_notes && (
  <div className="mt-2 rounded-lg bg-slate-50/60 px-2.5 py-1.5 text-[12px] text-slate-700 ring-1 ring-slate-200/50">
    {task.special_notes}
  </div>
)}

        {/* Actions */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {task.status === 'pending' && (
            <button
              onClick={() => onUpdateStatus(task.id, 'in_progress')}
              className="inline-flex items-center rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-medium text-white active:translate-y-[1px]"
            >
              <Play className="mr-1.5 h-4 w-4" />
              Start
            </button>
          )}

          {task.status === 'in_progress' && (
            <>
              <button
                onClick={() => onUpdateStatus(task.id, 'pending')}
                className="inline-flex items-center rounded-xl bg-slate-600 px-3 py-1.5 text-xs font-medium text-white active:translate-y-[1px]"
              >
                <Pause className="mr-1.5 h-4 w-4" />
                Pause
              </button>
              <button
                onClick={() => onUpdateStatus(task.id, 'completed')}
                className="inline-flex items-center rounded-xl bg-green-600 px-3 py-1.5 text-xs font-medium text-white active:translate-y-[1px]"
              >
                <CheckCircle className="mr-1.5 h-4 w-4" />
                Complete
              </button>
            </>
          )}

          {isAdmin && (
            <>
              {!task.cleaner_id && (
                <select
                  onChange={(e) => e.target.value && onAssignCleaner(task.id, e.target.value)}
                  defaultValue=""
                  className="min-w-[128px] flex-1 rounded-xl border border-white/60 bg-white/70 px-2 py-1.5 text-xs text-slate-800 ring-1 ring-white/60"
                  aria-label="Assign cleaner"
                >
                  <option value="">Assign…</option>
                  {(cleaners || []).map((c) => (
                    <option key={c.id} value={c.id}>{c.first_name}</option>
                  ))}
                </select>
              )}

              <button
                onClick={() => onEdit(task)}
                className="ml-auto inline-flex items-center rounded-xl border border-white/60 bg-white/70 px-2.5 py-1.5 text-xs text-slate-800 ring-1 ring-white/60"
                title="Edit"
              >
                <Edit className="mr-1 h-4 w-4" />
                Edit
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/** ---------- Grouped List (Date → Property → Cards) ---------- */
export default function CleaningTaskList({
  tasks,
  cleaners,
  onUpdateStatus,
  onAssignCleaner,
  onEdit,
  onDelete,
  isAdmin,
  className = '',
}) {
  // 1) Group by date (Tokyo), then by property
  const grouped = useMemo(() => {
    const acc = {}
    ;(tasks || []).forEach((t) => {
      const dateKey = fmtYMD(t.task_date)
      acc[dateKey] ||= {}
      const propKey = t.property_name || 'Unknown Property'
      acc[dateKey][propKey] ||= []
      acc[dateKey][propKey].push(t)
    })
    return acc
  }, [tasks])

  const dateKeys = useMemo(
    () => Object.keys(grouped).sort((a, b) => (a > b ? 1 : -1)),
    [grouped]
  )

  if (!tasks || tasks.length === 0) {
    return (
      <div className="rounded-2xl border border-white/50 bg-white/40 p-6 text-center text-sm text-slate-700 backdrop-blur-md">
        No cleaning tasks found. Try adjusting filters.
      </div>
    )
  }

  return (
    <div className={`space-y-7 ${className}`}>
      {dateKeys.map((date) => {
        const properties = grouped[date]
        const propNames = Object.keys(properties).sort((a, b) => a.localeCompare(b))
        return (
          <section key={date} className="space-y-4">
            {/* Sticky date header (single) */}
            <h3 className="sticky top-[6px] z-10 -mx-4 flex items-center gap-2 bg-slate-50/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600 backdrop-blur">
              <Calendar className="h-4 w-4 text-slate-500" />
              {date}
              <span className="ml-1 font-normal text-slate-400">
                ({propNames.reduce((n, p) => n + properties[p].length, 0)})
              </span>
            </h3>

            {/* Property sections (remove property from card body) */}
            {propNames.map((prop) => (
              <div key={prop} className="space-y-2">
                <div className="flex items-center gap-1 text-[12px] text-slate-600">
                  <span className="inline-flex items-center rounded-full bg-white/70 px-2.5 py-1 ring-1 ring-white/60 backdrop-blur">
                    <Building className="mr-1.5 h-3.5 w-3.5 text-slate-500" />
                    {prop}
                  </span>
                  <span className="text-slate-400">
                    {properties[prop].length} task{properties[prop].length > 1 ? 's' : ''}
                  </span>
                </div>

                <div className="space-y-3">
                  {properties[prop].map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      cleaners={cleaners}
                      isAdmin={isAdmin}
                      onUpdateStatus={onUpdateStatus}
                      onAssignCleaner={onAssignCleaner}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  ))}
                </div>
              </div>
            ))}
          </section>
        )
      })}
    </div>
  )
}
