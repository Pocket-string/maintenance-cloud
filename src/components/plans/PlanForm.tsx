'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { createMaintenancePlan, type CreatePlanState } from '@/actions/plans'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface SiteOption {
  id: string
  name: string
}

export function PlanForm({ sites }: { sites: SiteOption[] }) {
  const [state, formAction, isPending] = useActionState<CreatePlanState, FormData>(
    createMaintenancePlan,
    {}
  )

  const today = new Date().toISOString().split('T')[0]

  return (
    <Card>
      <form action={formAction} className="space-y-6">
        {state.error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {state.error}
          </div>
        )}

        <div>
          <label htmlFor="site_id" className="block text-sm font-medium text-foreground mb-1">
            Sitio *
          </label>
          <select
            id="site_id"
            name="site_id"
            required
            className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Seleccionar sitio...</option>
            {sites.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {state.fieldErrors?.site_id && (
            <p className="text-sm text-red-600 mt-1">{state.fieldErrors.site_id}</p>
          )}
        </div>

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">
            Nombre del plan *
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder="Ej: Plan Preventivo FV 2026"
            className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {state.fieldErrors?.name && (
            <p className="text-sm text-red-600 mt-1">{state.fieldErrors.name}</p>
          )}
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-foreground mb-1">
            Descripcion (opcional)
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            placeholder="Descripcion general del plan de mantenimiento..."
            className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          {state.fieldErrors?.description && (
            <p className="text-sm text-red-600 mt-1">{state.fieldErrors.description}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="start_date" className="block text-sm font-medium text-foreground mb-1">
              Fecha de inicio *
            </label>
            <input
              id="start_date"
              name="start_date"
              type="date"
              required
              defaultValue={today}
              className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {state.fieldErrors?.start_date && (
              <p className="text-sm text-red-600 mt-1">{state.fieldErrors.start_date}</p>
            )}
          </div>

          <div>
            <label htmlFor="end_date" className="block text-sm font-medium text-foreground mb-1">
              Fecha de termino (opcional)
            </label>
            <input
              id="end_date"
              name="end_date"
              type="date"
              className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {state.fieldErrors?.end_date && (
              <p className="text-sm text-red-600 mt-1">{state.fieldErrors.end_date}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4">
          <Button type="submit" isLoading={isPending}>
            Crear Plan
          </Button>
          <Link href="/plans">
            <Button variant="ghost" type="button">Cancelar</Button>
          </Link>
        </div>
      </form>
    </Card>
  )
}
