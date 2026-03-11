'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export interface ScheduledTaskRow {
  id: string
  scheduledDate: string
  dueDate: string
  status: 'pending' | 'completed' | 'skipped' | 'overdue'
  taskDescription: string
  categoryName: string
  siteName: string
  planName: string
  frequencyMonths?: number | null
  frequencyType?: 'fixed' | 'special'
}

interface ScheduledTaskCardProps {
  task: ScheduledTaskRow
  onExecute?: (taskId: string) => void
  onSkip?: (taskId: string) => void
  onReschedule?: (taskId: string, newDate: string) => void
  loading?: boolean
}

function getFrequencyLabel(
  months: number | null | undefined,
  type: string | undefined,
): { label: string; classes: string } | null {
  if (type === 'special') {
    return { label: 'Especial', classes: 'bg-rose-50 text-rose-600' }
  }
  if (months == null) return null
  const map: Record<number, { label: string; classes: string }> = {
    1:  { label: 'Mensual',       classes: 'bg-blue-50 text-blue-600' },
    3:  { label: 'Trimestral',    classes: 'bg-purple-50 text-purple-600' },
    4:  { label: 'Cuatrimestral', classes: 'bg-indigo-50 text-indigo-600' },
    6:  { label: 'Semestral',     classes: 'bg-teal-50 text-teal-600' },
    12: { label: 'Anual',         classes: 'bg-amber-50 text-amber-600' },
    24: { label: 'Bianual',       classes: 'bg-orange-50 text-orange-600' },
  }
  return map[months] ?? { label: `Cada ${months} meses`, classes: 'bg-gray-50 text-gray-600' }
}

const STATUS_CONFIG: Record<
  ScheduledTaskRow['status'],
  { label: string; className: string }
> = {
  pending:   { label: 'Pendiente',  className: 'bg-blue-100 text-blue-800' },
  completed: { label: 'Completada', className: 'bg-green-100 text-green-800' },
  overdue:   { label: 'Vencida',    className: 'bg-red-100 text-red-800' },
  skipped:   { label: 'Saltada',    className: 'bg-gray-100 text-gray-800' },
}

export function ScheduledTaskCard({ task, onExecute, onSkip, onReschedule, loading }: ScheduledTaskCardProps) {
  const [showDatePicker, setShowDatePicker] = useState(false)
  const statusCfg = STATUS_CONFIG[task.status]
  const isActionable = task.status === 'pending' || task.status === 'overdue'
  const freqBadge = getFrequencyLabel(task.frequencyMonths, task.frequencyType)

  return (
    <Card padding="sm" className="flex flex-col gap-2">
      {/* Top row: category + frequency + status */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700 truncate shrink min-w-0">
          {task.categoryName}
        </span>
        {freqBadge && (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium shrink-0 ${freqBadge.classes}`}
          >
            {freqBadge.label}
          </span>
        )}
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 ml-auto ${statusCfg.className}`}
        >
          {statusCfg.label}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-foreground leading-snug">
        {task.taskDescription}
      </p>

      {/* Bottom row: site + plan */}
      <div className="flex items-center gap-3 text-xs text-foreground-secondary">
        <span className="truncate">{task.siteName}</span>
        <span className="shrink-0 text-gray-300" aria-hidden="true">·</span>
        <span className="truncate">{task.planName}</span>
      </div>

      {/* Action buttons */}
      {isActionable && (onExecute || onSkip || onReschedule) && (
        <div className="flex flex-col gap-2 pt-1 border-t border-border">
          <div className="flex items-center gap-2">
            {onExecute && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => onExecute(task.id)}
                disabled={loading}
              >
                {loading ? 'Procesando...' : 'Ejecutar'}
              </Button>
            )}
            {onSkip && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onSkip(task.id)}
                disabled={loading}
              >
                Saltar
              </Button>
            )}
            {onReschedule && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowDatePicker(!showDatePicker)}
                disabled={loading}
              >
                Reprogramar
              </Button>
            )}
          </div>
          {showDatePicker && onReschedule && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                defaultValue={task.scheduledDate}
                className="text-xs border border-border rounded px-2 py-1.5 flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onReschedule(task.id, e.currentTarget.value)
                    setShowDatePicker(false)
                  }
                  if (e.key === 'Escape') setShowDatePicker(false)
                }}
              />
              <Button
                size="sm"
                variant="primary"
                onClick={(e) => {
                  const input = (e.currentTarget.parentElement?.querySelector('input') as HTMLInputElement)
                  if (input?.value) {
                    onReschedule(task.id, input.value)
                    setShowDatePicker(false)
                  }
                }}
                disabled={loading}
              >
                Guardar
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
