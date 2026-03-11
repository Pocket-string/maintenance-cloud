'use client'

import { useState } from 'react'
import type { ReportTask } from '@/actions/reports'

// ------------------------------------------------------------------
// Status badge config
// ------------------------------------------------------------------

type TaskStatus = 'completed' | 'pending' | 'overdue' | 'skipped'

const STATUS_CONFIG: Record<TaskStatus, { label: string; classes: string }> = {
  completed: { label: 'Completada', classes: 'bg-green-100 text-green-800' },
  pending: { label: 'Pendiente', classes: 'bg-amber-100 text-amber-800' },
  overdue: { label: 'Vencida', classes: 'bg-red-100 text-red-800' },
  skipped: { label: 'Omitida', classes: 'bg-gray-100 text-gray-600' },
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

function formatCurrency(amount: number): string {
  return '$' + amount.toLocaleString('es-CL')
}

function formatBoolValue(value: string): string {
  if (value === 'true') return 'Si'
  if (value === 'false') return 'No'
  return value
}

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------

interface Props {
  tasks: ReportTask[]
}

export default function ReportTaskList({ tasks }: Props) {
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set())

  function toggleExpand(index: number) {
    setExpandedIndices(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  if (tasks.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-2xl p-6 text-center">
        <p className="text-foreground-secondary">No hay tareas programadas para este periodo.</p>
      </div>
    )
  }

  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-card">
      {tasks.map((task, index) => {
        const isExpanded = expandedIndices.has(index)
        const statusConfig = STATUS_CONFIG[task.status as TaskStatus] ?? {
          label: task.status,
          classes: 'bg-gray-100 text-gray-600',
        }
        const hasDetails =
          task.checklistItems.length > 0 ||
          task.materials.length > 0 ||
          task.attachments.length > 0 ||
          task.observations ||
          task.responsibleName

        return (
          <div
            key={index}
            className={`border-b border-border last:border-b-0 ${isExpanded ? 'bg-gray-50/50' : ''}`}
          >
            {/* Row */}
            <button
              type="button"
              onClick={() => hasDetails && toggleExpand(index)}
              className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                hasDetails ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'
              }`}
              aria-expanded={hasDetails ? isExpanded : undefined}
              aria-label={`${task.taskDescription} — ${statusConfig.label}`}
            >
              {/* Chevron */}
              <span
                className={`flex-shrink-0 transition-transform duration-200 ${
                  isExpanded ? 'rotate-90' : ''
                } ${hasDetails ? 'text-foreground-secondary' : 'text-transparent'}`}
                aria-hidden="true"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </span>

              {/* Date */}
              <span className="flex-shrink-0 w-24 text-sm text-foreground-secondary font-mono">
                {formatDate(task.scheduledDate)}
              </span>

              {/* Description */}
              <span className="flex-1 text-sm text-foreground font-medium line-clamp-2">
                {task.taskDescription}
              </span>

              {/* Category */}
              <span className="hidden sm:block flex-shrink-0 text-xs text-foreground-secondary max-w-[120px] truncate">
                {task.categoryName}
              </span>

              {/* Status badge */}
              <span
                className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium ${statusConfig.classes}`}
              >
                {statusConfig.label}
              </span>
            </button>

            {/* Expanded details */}
            {isExpanded && hasDetails && (
              <div className="px-4 pb-4 pt-1 ml-7 space-y-4">
                {/* Responsible + visit date */}
                {(task.responsibleName || task.visitDate) && (
                  <div className="flex flex-wrap gap-4 text-sm">
                    {task.responsibleName && (
                      <span className="text-foreground-secondary">
                        <span className="font-medium text-foreground">Responsable:</span>{' '}
                        {task.responsibleName}
                      </span>
                    )}
                    {task.visitDate && (
                      <span className="text-foreground-secondary">
                        <span className="font-medium text-foreground">Fecha visita:</span>{' '}
                        {formatDate(task.visitDate)}
                      </span>
                    )}
                  </div>
                )}

                {/* Checklist responses */}
                {task.checklistItems.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">
                      Checklist
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="text-left px-3 py-2 text-xs font-semibold text-foreground-secondary rounded-tl-lg">
                              Item
                            </th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-foreground-secondary">
                              Valor
                            </th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-foreground-secondary rounded-tr-lg">
                              Nota
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {task.checklistItems.map((item, i) => (
                            <tr key={i} className="hover:bg-gray-50/50">
                              <td className="px-3 py-2 text-foreground">{item.label}</td>
                              <td className="px-3 py-2 text-foreground">
                                {item.itemType === 'bool'
                                  ? formatBoolValue(item.value)
                                  : item.value}
                              </td>
                              <td className="px-3 py-2 text-foreground-secondary">
                                {item.note ?? '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Materials */}
                {task.materials.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">
                      Materiales
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="text-left px-3 py-2 text-xs font-semibold text-foreground-secondary rounded-tl-lg">
                              Descripcion
                            </th>
                            <th className="text-right px-3 py-2 text-xs font-semibold text-foreground-secondary">
                              Cantidad
                            </th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-foreground-secondary">
                              Unidad
                            </th>
                            <th className="text-right px-3 py-2 text-xs font-semibold text-foreground-secondary rounded-tr-lg">
                              Costo unitario
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {task.materials.map((mat, i) => (
                            <tr key={i} className="hover:bg-gray-50/50">
                              <td className="px-3 py-2 text-foreground">{mat.description}</td>
                              <td className="px-3 py-2 text-foreground text-right">{mat.quantity}</td>
                              <td className="px-3 py-2 text-foreground-secondary">{mat.unit}</td>
                              <td className="px-3 py-2 text-foreground text-right">
                                {mat.unitCost != null ? formatCurrency(mat.unitCost) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Attachments */}
                {task.attachments.length > 0 && (
                  <div className="flex items-center gap-1.5 text-sm text-foreground-secondary">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                    <span>{task.attachments.length} archivo{task.attachments.length !== 1 ? 's' : ''} adjunto{task.attachments.length !== 1 ? 's' : ''}</span>
                  </div>
                )}

                {/* Observations */}
                {task.observations && (
                  <div>
                    <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-1">
                      Observaciones
                    </p>
                    <p className="text-sm text-foreground-secondary leading-relaxed">
                      {task.observations}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
