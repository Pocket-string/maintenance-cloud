'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  createMaintenanceRecord,
  getAvailableScheduledTasksForSite,
  type CreateRecordState,
} from '@/actions/maintenance'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

interface SiteOption {
  id: string
  name: string
  type: string
}

interface ScheduledTaskOption {
  id: string
  description: string
  categoryName: string
  scheduledDate: string
  indice: string | null
  subindice: string | null
}

type UrgencyLevel = 'alta' | 'media' | 'baja'

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------

const MAINTENANCE_TYPES = [
  {
    value: 'pv_prev',
    label: 'Mantenimiento Preventivo FV',
    description: 'Inspeccion y limpieza de paneles fotovoltaicos',
  },
  {
    value: 'diesel_prev',
    label: 'Mantenimiento Preventivo Diesel',
    description: 'Servicio programado de generadores diesel',
  },
  {
    value: 'corrective',
    label: 'Mantenimiento Correctivo',
    description: 'Reparacion de fallas detectadas',
  },
]

const SITE_TYPE_MAINTENANCE_MAP: Record<string, string[]> = {
  fv_pmgd: ['pv_prev', 'corrective'],
  diesel: ['diesel_prev', 'corrective'],
  hybrid: ['pv_prev', 'diesel_prev', 'corrective'],
}

const URGENCY_OPTIONS: { value: UrgencyLevel; label: string; classes: string }[] = [
  {
    value: 'alta',
    label: 'Alta',
    classes:
      'border-red-300 bg-red-50 text-red-700 has-[:checked]:border-red-500 has-[:checked]:bg-red-100 has-[:checked]:ring-2 has-[:checked]:ring-red-400',
  },
  {
    value: 'media',
    label: 'Media',
    classes:
      'border-yellow-300 bg-yellow-50 text-yellow-700 has-[:checked]:border-yellow-500 has-[:checked]:bg-yellow-100 has-[:checked]:ring-2 has-[:checked]:ring-yellow-400',
  },
  {
    value: 'baja',
    label: 'Baja',
    classes:
      'border-green-300 bg-green-50 text-green-700 has-[:checked]:border-green-500 has-[:checked]:bg-green-100 has-[:checked]:ring-2 has-[:checked]:ring-green-400',
  },
]

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function formatTaskLabel(task: ScheduledTaskOption): string {
  const prefix =
    task.indice && task.subindice
      ? `${task.indice}.${task.subindice}`
      : task.indice ?? task.subindice ?? null

  const date = new Date(task.scheduledDate + 'T00:00:00').toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  return prefix
    ? `${prefix} - ${task.description} (${date})`
    : `${task.description} (${date})`
}

function isPreventiveType(type: string): boolean {
  return type === 'pv_prev' || type === 'diesel_prev'
}

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------

export function MaintenanceForm({ sites }: { sites: SiteOption[] }) {
  // 1. Hooks — server action state
  const [state, formAction, isPending] = useActionState<CreateRecordState, FormData>(
    createMaintenanceRecord,
    {}
  )

  // 2. Controlled field state
  const [selectedSiteId, setSelectedSiteId] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [urgency, setUrgency] = useState<UrgencyLevel | ''>('')

  // 3. Scheduled tasks state
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTaskOption[]>([])
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState('')

  // 4. Derived state
  const today = new Date().toISOString().split('T')[0]

  const selectedSite = sites.find(s => s.id === selectedSiteId)
  const allowedTypes = selectedSite
    ? (SITE_TYPE_MAINTENANCE_MAP[selectedSite.type] ?? [])
    : []
  const filteredMaintenanceTypes = MAINTENANCE_TYPES.filter(mt =>
    allowedTypes.includes(mt.value)
  )

  const isPreventive = isPreventiveType(selectedType)
  const isCorrective = selectedType === 'corrective'

  // Unique categories sorted by indice for the first dropdown
  const taskCategories = useMemo(() => {
    const seen = new Map<string, string | null>()
    for (const task of scheduledTasks) {
      const key = task.categoryName || 'Sin categoria'
      if (!seen.has(key)) seen.set(key, task.indice)
    }
    return Array.from(seen.entries())
      .map(([name, indice]) => ({ name, indice }))
      .sort((a, b) => {
        const ai = a.indice ? parseInt(a.indice, 10) : 999
        const bi = b.indice ? parseInt(b.indice, 10) : 999
        return ai - bi
      })
  }, [scheduledTasks])

  // Tasks filtered by the selected category
  const filteredTasks = useMemo(() => {
    if (!selectedCategory) return []
    return scheduledTasks.filter(
      t => (t.categoryName || 'Sin categoria') === selectedCategory
    )
  }, [scheduledTasks, selectedCategory])

  // 5. Effects

  // Reset type if it becomes invalid after site change
  useEffect(() => {
    if (selectedType && allowedTypes.length > 0 && !allowedTypes.includes(selectedType)) {
      setSelectedType('')
      setSelectedTaskId('')
      setSelectedCategory('')
      setScheduledTasks([])
    }
  }, [selectedSiteId, allowedTypes, selectedType])

  // Fetch scheduled tasks whenever site or type changes to a preventive type
  useEffect(() => {
    if (!selectedSiteId || !isPreventive) {
      setScheduledTasks([])
      setSelectedTaskId('')
      setSelectedCategory('')
      return
    }

    let cancelled = false
    setLoadingTasks(true)

    getAvailableScheduledTasksForSite(selectedSiteId).then(result => {
      if (cancelled) return
      setLoadingTasks(false)
      if (result.success) {
        setScheduledTasks(result.data ?? [])
      } else {
        setScheduledTasks([])
      }
    })

    return () => {
      cancelled = true
    }
  }, [selectedSiteId, selectedType, isPreventive])

  // Reset task + category when type changes away from preventive
  useEffect(() => {
    if (!isPreventive) {
      setSelectedTaskId('')
      setSelectedCategory('')
    }
  }, [isPreventive])

  // 6. Handlers
  function handleSiteChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSelectedSiteId(e.target.value)
    setSelectedType('')
    setSelectedTaskId('')
    setSelectedCategory('')
    setScheduledTasks([])
  }

  function handleTypeChange(value: string) {
    setSelectedType(value)
    setSelectedTaskId('')
    setSelectedCategory('')
    if (!isPreventiveType(value)) {
      setScheduledTasks([])
    }
  }

  function handleCategoryChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSelectedCategory(e.target.value)
    setSelectedTaskId('')
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <Card>
      <form action={formAction} className="space-y-6">

        {/* Global error banner */}
        {state.error && (
          <div
            role="alert"
            className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700"
          >
            {state.error}
          </div>
        )}

        {/* ---- Site selector ---- */}
        <div>
          <label htmlFor="site_id" className="block text-sm font-medium text-foreground mb-1">
            Sitio *
          </label>
          <select
            id="site_id"
            name="site_id"
            required
            value={selectedSiteId}
            onChange={handleSiteChange}
            className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Seleccionar sitio...</option>
            {sites.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {state.fieldErrors?.site_id && (
            <p className="text-sm text-red-600 mt-1">{state.fieldErrors.site_id}</p>
          )}
        </div>

        {/* ---- Maintenance type ---- */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-3">
            Tipo de mantenimiento *
          </label>

          {!selectedSiteId ? (
            <p className="text-sm text-foreground-secondary italic px-1">
              Selecciona un sitio para ver los tipos disponibles
            </p>
          ) : (
            <div className="space-y-3">
              {filteredMaintenanceTypes.map(mt => (
                <label
                  key={mt.value}
                  className="flex items-start gap-3 p-4 border border-border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50"
                >
                  <input
                    type="radio"
                    name="type"
                    value={mt.value}
                    required
                    checked={selectedType === mt.value}
                    onChange={() => handleTypeChange(mt.value)}
                    className="mt-1 w-4 h-4 text-blue-600"
                  />
                  <div>
                    <p className="font-medium text-foreground">{mt.label}</p>
                    <p className="text-sm text-foreground-secondary">{mt.description}</p>
                  </div>
                </label>
              ))}
            </div>
          )}

          {state.fieldErrors?.type && (
            <p className="text-sm text-red-600 mt-1">{state.fieldErrors.type}</p>
          )}
        </div>

        {/* ---- Scheduled task (preventive only) — two-step selection ---- */}
        {isPreventive && (
          <div className="space-y-3">
            {loadingTasks ? (
              <div className="w-full px-4 py-2 border border-border rounded-xl bg-gray-50 text-sm text-foreground-secondary animate-pulse">
                Cargando tareas disponibles...
              </div>
            ) : scheduledTasks.length === 0 ? (
              <div
                role="alert"
                className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-4 h-4 mt-0.5 flex-shrink-0"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>
                  No hay tareas programadas pendientes para este sitio. Verifica el plan de
                  mantenimiento antes de continuar.
                </span>
              </div>
            ) : (
              <>
                {/* Step 1: Category / system */}
                <div>
                  <label
                    htmlFor="task_category"
                    className="block text-sm font-medium text-foreground mb-1"
                  >
                    Sistema / Categoria *
                  </label>
                  <select
                    id="task_category"
                    value={selectedCategory}
                    onChange={handleCategoryChange}
                    className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Seleccionar sistema...</option>
                    {taskCategories.map(cat => (
                      <option key={cat.name} value={cat.name}>
                        {cat.indice ? `${cat.indice}. ${cat.name}` : cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Step 2: Specific task (only shown after category is selected) */}
                {selectedCategory && (
                  <div>
                    <label
                      htmlFor="scheduled_task_id"
                      className="block text-sm font-medium text-foreground mb-1"
                    >
                      Tarea programada *
                    </label>
                    <select
                      id="scheduled_task_id"
                      required
                      value={selectedTaskId}
                      onChange={e => setSelectedTaskId(e.target.value)}
                      className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">Seleccionar tarea...</option>
                      {filteredTasks.map(task => (
                        <option key={task.id} value={task.id}>
                          {formatTaskLabel(task)}
                        </option>
                      ))}
                    </select>
                    <input type="hidden" name="scheduled_task_id" value={selectedTaskId} />
                  </div>
                )}
              </>
            )}

            {state.fieldErrors?.scheduled_task_id && (
              <p className="text-sm text-red-600 mt-1">
                {state.fieldErrors.scheduled_task_id}
              </p>
            )}
          </div>
        )}

        {/* ---- Urgency (corrective only) ---- */}
        {isCorrective && (
          <div>
            <fieldset>
              <legend className="block text-sm font-medium text-foreground mb-3">
                Urgencia *
              </legend>
              <div className="flex gap-3">
                {URGENCY_OPTIONS.map(opt => (
                  <label
                    key={opt.value}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 border rounded-xl cursor-pointer font-medium text-sm transition-all ${opt.classes}`}
                  >
                    <input
                      type="radio"
                      name="urgency"
                      value={opt.value}
                      required
                      checked={urgency === opt.value}
                      onChange={() => setUrgency(opt.value)}
                      className="sr-only"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </fieldset>
            {state.fieldErrors?.urgency && (
              <p className="text-sm text-red-600 mt-1">{state.fieldErrors.urgency}</p>
            )}
          </div>
        )}

        {/* ---- Visit date ---- */}
        <div>
          <label htmlFor="visit_date" className="block text-sm font-medium text-foreground mb-1">
            Fecha de visita *
          </label>
          <input
            id="visit_date"
            name="visit_date"
            type="date"
            required
            defaultValue={today}
            className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {state.fieldErrors?.visit_date && (
            <p className="text-sm text-red-600 mt-1">{state.fieldErrors.visit_date}</p>
          )}
        </div>

        {/* ---- Observations / fault description ---- */}
        <div>
          <label
            htmlFor="observations"
            className="block text-sm font-medium text-foreground mb-1"
          >
            {isCorrective ? 'Descripcion de la falla *' : 'Observaciones (opcional)'}
          </label>
          <textarea
            id="observations"
            name="observations"
            rows={4}
            required={isCorrective}
            placeholder={
              isCorrective
                ? 'Describe la falla detectada con el mayor detalle posible...'
                : 'Notas generales sobre la visita...'
            }
            className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          {state.fieldErrors?.observations && (
            <p className="text-sm text-red-600 mt-1">{state.fieldErrors.observations}</p>
          )}
        </div>

        {/* ---- Actions ---- */}
        <div className="flex items-center gap-3 pt-4">
          <Button type="submit" isLoading={isPending}>
            Crear Registro
          </Button>
          <Link href="/maintenance">
            <Button variant="ghost" type="button">
              Cancelar
            </Button>
          </Link>
        </div>
      </form>
    </Card>
  )
}
