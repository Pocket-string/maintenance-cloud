'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { createSite, type CreateSiteState } from '@/actions/sites'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

const SITE_TYPES = [
  { value: 'fv_pmgd', label: 'FV PMGD' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'hybrid', label: 'Hibrido' },
]

const REGIONS = [
  'Arica y Parinacota', 'Tarapaca', 'Antofagasta', 'Atacama', 'Coquimbo',
  'Valparaiso', 'Metropolitana', "O'Higgins", 'Maule', 'Nuble', 'Biobio',
  'La Araucania', 'Los Rios', 'Los Lagos', 'Aysen', 'Magallanes',
]

export function SiteForm() {
  const [state, formAction, isPending] = useActionState<CreateSiteState, FormData>(
    createSite,
    {}
  )

  return (
    <Card>
      <form action={formAction} className="space-y-6">
        {state.error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {state.error}
          </div>
        )}

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">
            Nombre del sitio *
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder="Ej: Planta Solar Los Andes"
            className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {state.fieldErrors?.name && (
            <p className="text-sm text-red-600 mt-1">{state.fieldErrors.name}</p>
          )}
        </div>

        <div>
          <label htmlFor="type" className="block text-sm font-medium text-foreground mb-1">
            Tipo de sitio *
          </label>
          <select
            id="type"
            name="type"
            required
            className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Seleccionar...</option>
            {SITE_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          {state.fieldErrors?.type && (
            <p className="text-sm text-red-600 mt-1">{state.fieldErrors.type}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="commune" className="block text-sm font-medium text-foreground mb-1">
              Comuna *
            </label>
            <input
              id="commune"
              name="commune"
              type="text"
              required
              placeholder="Ej: Pudahuel"
              className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {state.fieldErrors?.commune && (
              <p className="text-sm text-red-600 mt-1">{state.fieldErrors.commune}</p>
            )}
          </div>

          <div>
            <label htmlFor="region" className="block text-sm font-medium text-foreground mb-1">
              Region *
            </label>
            <select
              id="region"
              name="region"
              required
              className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Seleccionar...</option>
              {REGIONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            {state.fieldErrors?.region && (
              <p className="text-sm text-red-600 mt-1">{state.fieldErrors.region}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="lat" className="block text-sm font-medium text-foreground mb-1">
              Latitud (opcional)
            </label>
            <input
              id="lat"
              name="lat"
              type="number"
              step="any"
              placeholder="-33.4489"
              className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {state.fieldErrors?.lat && (
              <p className="text-sm text-red-600 mt-1">{state.fieldErrors.lat}</p>
            )}
          </div>
          <div>
            <label htmlFor="lng" className="block text-sm font-medium text-foreground mb-1">
              Longitud (opcional)
            </label>
            <input
              id="lng"
              name="lng"
              type="number"
              step="any"
              placeholder="-70.6693"
              className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {state.fieldErrors?.lng && (
              <p className="text-sm text-red-600 mt-1">{state.fieldErrors.lng}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4">
          <Button type="submit" isLoading={isPending}>
            Crear Sitio
          </Button>
          <Link href="/sites">
            <Button variant="ghost" type="button">Cancelar</Button>
          </Link>
        </div>
      </form>
    </Card>
  )
}
