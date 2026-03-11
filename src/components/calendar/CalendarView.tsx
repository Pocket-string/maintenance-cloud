'use client'

import { useState, useMemo, useTransition } from 'react'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarHeader } from './CalendarHeader'
import { ScheduledTaskCard, type ScheduledTaskRow } from './ScheduledTaskCard'
import { createRecordFromScheduledTask, skipScheduledTask, rescheduleTask } from '@/actions/scheduled-tasks'

interface CalendarViewProps {
  tasks: ScheduledTaskRow[]
  sites: Array<{ id: string; name: string }>
  initialYear: number
  initialMonth: number
}

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const STATUS_DOT: Record<ScheduledTaskRow['status'], string> = {
  completed: 'bg-green-500',
  pending:   'bg-blue-500',
  overdue:   'bg-red-500',
  skipped:   'bg-gray-400',
}

// Priority order used when choosing which dot to show (highest = first)
const DOT_PRIORITY: ScheduledTaskRow['status'][] = ['overdue', 'pending', 'completed', 'skipped']

export function CalendarView({ tasks, sites, initialYear, initialMonth }: CalendarViewProps) {
  const today = new Date()

  const [currentYear, setCurrentYear] = useState(initialYear)
  const [currentMonth, setCurrentMonth] = useState(initialMonth)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [siteFilter, setSiteFilter] = useState('')
  const [isPending, startTransition] = useTransition()
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)

  // Filtered task pool
  const filteredTasks = useMemo(
    () => (siteFilter ? tasks.filter((t) => t.siteName === sites.find((s) => s.id === siteFilter)?.name) : tasks),
    [tasks, siteFilter, sites]
  )

  // Map: 'YYYY-MM-DD' -> tasks
  const tasksByDate = useMemo(() => {
    const map = new Map<string, ScheduledTaskRow[]>()
    for (const task of filteredTasks) {
      const key = task.scheduledDate
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(task)
    }
    return map
  }, [filteredTasks])

  // Calendar grid days
  const days = useMemo(() => {
    const monthStart = startOfMonth(new Date(currentYear, currentMonth - 1))
    const monthEnd = endOfMonth(monthStart)
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    return eachDayOfInterval({ start: calStart, end: calEnd })
  }, [currentYear, currentMonth])

  const currentMonthDate = new Date(currentYear, currentMonth - 1)

  function handlePrev() {
    const prev = subMonths(currentMonthDate, 1)
    setCurrentYear(prev.getFullYear())
    setCurrentMonth(prev.getMonth() + 1)
    setSelectedDay(null)
  }

  function handleNext() {
    const next = addMonths(currentMonthDate, 1)
    setCurrentYear(next.getFullYear())
    setCurrentMonth(next.getMonth() + 1)
    setSelectedDay(null)
  }

  function handleToday() {
    setCurrentYear(today.getFullYear())
    setCurrentMonth(today.getMonth() + 1)
    setSelectedDay(today)
  }

  function handleDayClick(day: Date) {
    setSelectedDay((prev) => (prev && isSameDay(prev, day) ? null : day))
  }

  // Tasks for selected day
  const selectedDayTasks = useMemo(() => {
    if (!selectedDay) return []
    const key = format(selectedDay, 'yyyy-MM-dd')
    return tasksByDate.get(key) ?? []
  }, [selectedDay, tasksByDate])

  function handleExecute(taskId: string) {
    setActiveTaskId(taskId)
    startTransition(async () => {
      await createRecordFromScheduledTask(taskId)
    })
  }

  function handleSkip(taskId: string) {
    const reason = window.prompt('Motivo para saltar esta tarea:')
    if (!reason) return
    setActiveTaskId(taskId)
    startTransition(async () => {
      const result = await skipScheduledTask(taskId, reason)
      setActiveTaskId(null)
      if (!result.success) {
        alert(result.error)
      }
    })
  }

  function handleReschedule(taskId: string, newDate: string) {
    setActiveTaskId(taskId)
    startTransition(async () => {
      const result = await rescheduleTask(taskId, newDate)
      setActiveTaskId(null)
      if (!result.success) {
        alert(result.error)
      }
    })
  }

  // Unique status dots to render per day (deduplicated, max 4)
  function getDotsForDay(day: Date): ScheduledTaskRow['status'][] {
    const key = format(day, 'yyyy-MM-dd')
    const dayTasks = tasksByDate.get(key)
    if (!dayTasks?.length) return []
    const presentStatuses = new Set(dayTasks.map((t) => t.status))
    return DOT_PRIORITY.filter((s) => presentStatuses.has(s))
  }

  return (
    <section aria-label="Calendario de tareas programadas">
      <CalendarHeader
        currentMonth={currentMonth}
        currentYear={currentYear}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        sites={sites}
        siteFilter={siteFilter}
        onSiteChange={(id) => { setSiteFilter(id) }}
      />

      {/* Weekday header row */}
      <div className="grid grid-cols-7 mb-1" role="row">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="py-1.5 text-center text-xs font-semibold text-foreground-secondary uppercase tracking-wide"
            role="columnheader"
            aria-label={label}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Day cells grid */}
      <div className="grid grid-cols-7 rounded-xl overflow-hidden shadow-neu-sm" role="grid">
        {days.map((day) => {
          const isCurrentMonth = isSameMonth(day, currentMonthDate)
          const isToday = isSameDay(day, today)
          const isSelected = selectedDay ? isSameDay(day, selectedDay) : false
          const dots = getDotsForDay(day)
          const dateKey = format(day, 'd')

          return (
            <button
              key={day.toISOString()}
              type="button"
              role="gridcell"
              aria-label={format(day, "d 'de' MMMM yyyy", { locale: es })}
              aria-pressed={isSelected}
              onClick={() => handleDayClick(day)}
              className={[
                'relative flex flex-col items-center gap-1 py-2 px-1 border-b border-r border-[#b8b9be]',
                'min-h-[60px] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500',
                isCurrentMonth ? 'bg-neu-bg hover:shadow-neu-inset-sm' : 'bg-neu-bg/60 opacity-60',
                isSelected ? 'shadow-neu-inset bg-neu-bg' : '',
              ].join(' ')}
            >
              {/* Day number */}
              <span
                className={[
                  'flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium transition-colors',
                  isToday && !isSelected
                    ? 'ring-2 ring-blue-500 text-blue-600 font-semibold'
                    : '',
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : isCurrentMonth
                    ? 'text-foreground'
                    : 'text-gray-400',
                ].join(' ')}
              >
                {dateKey}
              </span>

              {/* Status dots */}
              {dots.length > 0 && (
                <div className="flex items-center gap-0.5" aria-hidden="true">
                  {dots.map((status) => (
                    <span
                      key={status}
                      className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status]}`}
                    />
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Selected day task list */}
      {selectedDay && (
        <div className="mt-6" aria-live="polite">
          <h3 className="text-sm font-semibold text-foreground-secondary mb-3">
            {format(selectedDay, "EEEE d 'de' MMMM", { locale: es }).replace(
              /^\w/,
              (c) => c.toUpperCase()
            )}
            <span className="ml-2 text-xs font-normal">
              ({selectedDayTasks.length} tarea{selectedDayTasks.length !== 1 ? 's' : ''})
            </span>
          </h3>

          {selectedDayTasks.length === 0 ? (
            <p className="text-sm text-foreground-secondary py-4 text-center border border-dashed border-border rounded-xl">
              No hay tareas programadas para este día.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {selectedDayTasks.map((task) => (
                <ScheduledTaskCard
                  key={task.id}
                  task={task}
                  onExecute={handleExecute}
                  onSkip={handleSkip}
                  onReschedule={handleReschedule}
                  loading={isPending && activeTaskId === task.id}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
