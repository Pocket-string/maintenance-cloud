'use client'

import { useState, useTransition, Fragment } from 'react'
import { Card } from '@/components/ui/card'
import { TaskChecklistEditor } from './TaskChecklistEditor'
import { rescheduleTask } from '@/actions/scheduled-tasks'
import type { PlanStatus, FrequencyType } from '@/types/database'

interface PlanTask {
  id: string
  description: string
  frequencyMonths: number | null
  frequencyType: FrequencyType
  frequencyDetail: string | null
  isActive: boolean
  checklistCount: number
  scheduledTaskId: string | null
  scheduledDate: string | null
  scheduledStatus: 'pending' | 'overdue' | null
}

interface PlanCategory {
  id: string
  name: string
  tasks: PlanTask[]
}

interface PlanInfo {
  id: string
  name: string
  description: string | null
  status: PlanStatus
  startDate: string
  endDate: string | null
  siteName: string
}

interface ComplianceStats {
  total: number
  completed: number
  compliancePercent: number
}

interface Props {
  plan: PlanInfo
  categories: PlanCategory[]
  complianceStats?: ComplianceStats
}

const STATUS_LABELS: Record<PlanStatus, { label: string; color: string }> = {
  draft:    { label: 'Borrador',  color: 'bg-gray-100 text-gray-800' },
  active:   { label: 'Activo',    color: 'bg-green-100 text-green-800' },
  paused:   { label: 'Pausado',   color: 'bg-yellow-100 text-yellow-800' },
  archived: { label: 'Archivado', color: 'bg-purple-100 text-purple-800' },
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

function formatFrequency(task: PlanTask): string {
  if (task.frequencyType === 'fixed' && task.frequencyMonths !== null) {
    return task.frequencyMonths === 1
      ? 'Mensual'
      : `Cada ${task.frequencyMonths} meses`
  }
  return task.frequencyDetail ?? 'Sin definir'
}

export function PlanDetail({ plan, categories, complianceStats }: Props) {
  const [openCategories, setOpenCategories] = useState<Set<string>>(
    () => new Set(categories.map(c => c.id))
  )
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingDateTaskId, setEditingDateTaskId] = useState<string | null>(null)
  const [scheduledDates, setScheduledDates] = useState<Record<string, string | null>>(() => {
    const dates: Record<string, string | null> = {}
    for (const cat of categories) {
      for (const task of cat.tasks) {
        dates[task.id] = task.scheduledDate
      }
    }
    return dates
  })
  const [isPending, startTransition] = useTransition()
  const [checklistCounts, setChecklistCounts] = useState<Record<string, number>>(() => {
    const counts: Record<string, number> = {}
    for (const cat of categories) {
      for (const task of cat.tasks) {
        counts[task.id] = task.checklistCount
      }
    }
    return counts
  })

  const canEditChecklist = plan.status === 'draft' || plan.status === 'active'
  const canEditSchedule = plan.status === 'active'

  function handleReschedule(task: PlanTask, newDate: string) {
    if (!task.scheduledTaskId) return
    startTransition(async () => {
      const result = await rescheduleTask(task.scheduledTaskId!, newDate)
      if (result.success) {
        setScheduledDates(prev => ({ ...prev, [task.id]: newDate }))
        setEditingDateTaskId(null)
      } else {
        alert(result.error)
      }
    })
  }

  function toggleCategory(categoryId: string) {
    setOpenCategories(prev => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  const statusBadge = STATUS_LABELS[plan.status]
  const totalTasks = categories.reduce((sum, c) => sum + c.tasks.length, 0)

  return (
    <div className="space-y-6">
      {/* Header info card */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-xl font-semibold text-foreground">{plan.name}</h2>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${statusBadge.color}`}>
                {statusBadge.label}
              </span>
            </div>
            <p className="text-foreground-secondary">{plan.siteName}</p>
            {plan.description && (
              <p className="text-sm text-foreground-secondary mt-2">{plan.description}</p>
            )}
          </div>
          <div className="text-sm text-foreground-secondary space-y-1">
            <p>Inicio: <span className="font-medium text-foreground">{formatDate(plan.startDate)}</span></p>
            {plan.endDate && (
              <p>Termino: <span className="font-medium text-foreground">{formatDate(plan.endDate)}</span></p>
            )}
          </div>
        </div>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card padding="sm">
          <p className="text-xs text-foreground-secondary mb-1">Categorias</p>
          <p className="text-2xl font-semibold text-foreground">{categories.length}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-foreground-secondary mb-1">Tareas totales</p>
          <p className="text-2xl font-semibold text-foreground">{totalTasks}</p>
        </Card>
        {complianceStats && (
          <>
            <Card padding="sm">
              <p className="text-xs text-foreground-secondary mb-1">Completadas</p>
              <p className="text-2xl font-semibold text-green-600">{complianceStats.completed}</p>
            </Card>
            <Card padding="sm">
              <p className="text-xs text-foreground-secondary mb-1">Cumplimiento</p>
              <p className="text-2xl font-semibold text-foreground">{complianceStats.compliancePercent}%</p>
            </Card>
          </>
        )}
      </div>

      {/* Categories accordion */}
      {categories.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-foreground-secondary">
            Este plan no tiene categorias ni tareas. Importa un archivo Excel para comenzar.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {categories.map((category, categoryIndex) => {
            const isOpen = openCategories.has(category.id)
            return (
              <Card key={category.id} padding="none" className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50/50 transition-colors"
                  aria-expanded={isOpen}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-foreground-secondary w-6">{categoryIndex + 1}</span>
                    <span className="font-medium text-foreground">{category.name}</span>
                    <span className="text-xs text-foreground-secondary">({category.tasks.length} tareas)</span>
                  </div>
                  <svg
                    className={`h-5 w-5 text-foreground-secondary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isOpen && (
                  <div className="border-t border-border">
                    {category.tasks.length === 0 ? (
                      <p className="px-6 py-4 text-sm text-foreground-secondary">Sin tareas en esta categoria.</p>
                    ) : (
                      <div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="text-left px-6 py-3 text-xs font-semibold text-foreground-secondary w-10">#</th>
                                <th className="text-left px-6 py-3 text-xs font-semibold text-foreground-secondary">Descripcion</th>
                                <th className="text-left px-6 py-3 text-xs font-semibold text-foreground-secondary w-32">Frecuencia</th>
                                {canEditSchedule && (
                                  <th className="text-left px-6 py-3 text-xs font-semibold text-foreground-secondary w-36">Programada</th>
                                )}
                                <th className="text-left px-6 py-3 text-xs font-semibold text-foreground-secondary w-24">Estado</th>
                                {canEditChecklist && (
                                  <th className="text-left px-6 py-3 text-xs font-semibold text-foreground-secondary w-28">Checklist</th>
                                )}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {category.tasks.map((task, taskIndex) => {
                                const colCount = 4 + (canEditSchedule ? 1 : 0) + (canEditChecklist ? 1 : 0)
                                const currentDate = scheduledDates[task.id]
                                const isEditingDate = editingDateTaskId === task.id
                                return (
                                <Fragment key={task.id}>
                                  <tr className="hover:bg-gray-50/30">
                                    <td className="px-6 py-3 text-foreground-secondary font-mono text-xs">{taskIndex + 1}</td>
                                    <td className="px-6 py-3 text-foreground">{task.description}</td>
                                    <td className="px-6 py-3 text-foreground-secondary text-xs">{formatFrequency(task)}</td>
                                    {canEditSchedule && (
                                      <td className="px-6 py-3">
                                        {task.scheduledTaskId ? (
                                          isEditingDate ? (
                                            <div className="flex items-center gap-1">
                                              <input
                                                type="date"
                                                defaultValue={currentDate ?? ''}
                                                disabled={isPending}
                                                className="text-xs border border-border rounded px-1.5 py-1 w-32"
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Escape') setEditingDateTaskId(null)
                                                  if (e.key === 'Enter') handleReschedule(task, e.currentTarget.value)
                                                }}
                                                onBlur={(e) => {
                                                  if (e.currentTarget.value && e.currentTarget.value !== currentDate) {
                                                    handleReschedule(task, e.currentTarget.value)
                                                  } else {
                                                    setEditingDateTaskId(null)
                                                  }
                                                }}
                                                // eslint-disable-next-line jsx-a11y/no-autofocus
                                                autoFocus
                                              />
                                            </div>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={(e) => { e.stopPropagation(); setEditingDateTaskId(task.id) }}
                                              className={`text-xs transition-colors ${
                                                task.scheduledStatus === 'overdue'
                                                  ? 'text-red-600 font-semibold hover:text-red-700'
                                                  : 'text-foreground-secondary hover:text-blue-600 hover:underline'
                                              }`}
                                              title={task.scheduledStatus === 'overdue' ? 'Tarea vencida — click para reprogramar' : 'Click para reprogramar'}
                                            >
                                              {currentDate ? formatDate(currentDate) : '—'}
                                              {task.scheduledStatus === 'overdue' && (
                                                <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">
                                                  Vencida
                                                </span>
                                              )}
                                            </button>
                                          )
                                        ) : (
                                          <span className="text-xs text-foreground-muted">—</span>
                                        )}
                                      </td>
                                    )}
                                    <td className="px-6 py-3">
                                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${task.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                        {task.isActive ? 'Activa' : 'Inactiva'}
                                      </span>
                                    </td>
                                    {canEditChecklist && (
                                      <td className="px-6 py-3">
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); setEditingTaskId(editingTaskId === task.id ? null : task.id) }}
                                          className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                                            (checklistCounts[task.id] || 0) > 0
                                              ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                          }`}
                                        >
                                          {(checklistCounts[task.id] || 0) > 0
                                            ? `${checklistCounts[task.id]} items`
                                            : 'Configurar'}
                                        </button>
                                      </td>
                                    )}
                                  </tr>
                                  {editingTaskId === task.id && (
                                    <tr>
                                      <td colSpan={colCount} className="p-0">
                                        <TaskChecklistEditor
                                          planTaskId={task.id}
                                          taskDescription={task.description}
                                          onClose={() => setEditingTaskId(null)}
                                          onCountChange={(count) => setChecklistCounts(prev => ({ ...prev, [task.id]: count }))}
                                        />
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
