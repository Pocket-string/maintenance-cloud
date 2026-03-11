'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { createAsset } from '@/actions/assets'
import Link from 'next/link'

const ASSET_TYPES = [
  { value: 'inverter', label: 'Inversor' },
  { value: 'panel_string', label: 'String Paneles' },
  { value: 'transformer', label: 'Transformador' },
  { value: 'meter', label: 'Medidor' },
  { value: 'diesel_gen', label: 'Generador Diesel' },
  { value: 'ats', label: 'ATS' },
  { value: 'battery_bank', label: 'Banco Baterias' },
  { value: 'tracker', label: 'Tracker Solar' },
  { value: 'string_box', label: 'String Box / Combiner' },
  { value: 'switchgear', label: 'Switchgear' },
  { value: 'ncu', label: 'NCU (Control Trackers)' },
  { value: 'rack', label: 'Rack Comunicaciones' },
  { value: 'ups', label: 'UPS' },
  { value: 'sensor', label: 'Sensor / Piranometro' },
  { value: 'ppc', label: 'PPC (Power Plant Controller)' },
  { value: 'center', label: 'Centro de Transformacion' },
  { value: 'module', label: 'Modulo' },
  { value: 'building', label: 'Edificio / Centro Control' },
  { value: 'other', label: 'Otro' },
]

const ASSET_STATUSES = [
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' },
  { value: 'decommissioned', label: 'Dado de baja' },
]

interface ParentOption {
  id: string
  name: string
  code: string | null
}

export function AssetForm({ siteId, parentOptions }: { siteId: string; parentOptions?: ParentOption[] }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setIsPending(true)

    const formData = new FormData(e.currentTarget)
    formData.set('site_id', siteId)

    const result = await createAsset(formData)

    if (!result.success) {
      setError(result.error)
      setIsPending(false)
      return
    }

    router.push(`/sites/${siteId}`)
    router.refresh()
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">
            Nombre del activo *
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder="Ej: Inversor Huawei SUN2000-100KTL"
            className="w-full px-4 py-2 bg-neu-bg shadow-neu-inset rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="type" className="block text-sm font-medium text-foreground mb-1">
              Tipo *
            </label>
            <select
              id="type"
              name="type"
              required
              className="w-full px-4 py-2 bg-neu-bg shadow-neu-inset rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccionar...</option>
              {ASSET_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-foreground mb-1">
              Estado
            </label>
            <select
              id="status"
              name="status"
              className="w-full px-4 py-2 bg-neu-bg shadow-neu-inset rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              defaultValue="active"
            >
              {ASSET_STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-foreground mb-1">
              Codigo tecnico (opcional)
            </label>
            <input
              id="code"
              name="code"
              type="text"
              placeholder="Ej: CT-TRFC-N01-ZV"
              className="w-full px-4 py-2 bg-neu-bg shadow-neu-inset rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="tag" className="block text-sm font-medium text-foreground mb-1">
              Tag de campo (opcional)
            </label>
            <input
              id="tag"
              name="tag"
              type="text"
              placeholder="Ej: SUNGROW TRANSFORMADOR A"
              className="w-full px-4 py-2 bg-neu-bg shadow-neu-inset rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="priority" className="block text-sm font-medium text-foreground mb-1">
              Prioridad / Criticidad
            </label>
            <select
              id="priority"
              name="priority"
              defaultValue="3"
              className="w-full px-4 py-2 bg-neu-bg shadow-neu-inset rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="1">1 - Critica</option>
              <option value="2">2 - Alta</option>
              <option value="3">3 - Media</option>
              <option value="4">4 - Baja</option>
              <option value="5">5 - Muy baja</option>
            </select>
          </div>
          <div>
            <label htmlFor="parent_id" className="block text-sm font-medium text-foreground mb-1">
              Equipo padre (opcional)
            </label>
            <select
              id="parent_id"
              name="parent_id"
              className="w-full px-4 py-2 bg-neu-bg shadow-neu-inset rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Sin equipo padre</option>
              {parentOptions?.map(p => (
                <option key={p.id} value={p.id}>
                  {p.code ? `[${p.code}] ${p.name}` : p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="brand" className="block text-sm font-medium text-foreground mb-1">
              Marca (opcional)
            </label>
            <input
              id="brand"
              name="brand"
              type="text"
              placeholder="Ej: Huawei"
              className="w-full px-4 py-2 bg-neu-bg shadow-neu-inset rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="model" className="block text-sm font-medium text-foreground mb-1">
              Modelo (opcional)
            </label>
            <input
              id="model"
              name="model"
              type="text"
              placeholder="Ej: SUN2000-100KTL"
              className="w-full px-4 py-2 bg-neu-bg shadow-neu-inset rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="serial" className="block text-sm font-medium text-foreground mb-1">
              Numero de serie (opcional)
            </label>
            <input
              id="serial"
              name="serial"
              type="text"
              placeholder="Ej: HW2024001234"
              className="w-full px-4 py-2 bg-neu-bg shadow-neu-inset rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="install_date" className="block text-sm font-medium text-foreground mb-1">
              Fecha de instalacion (opcional)
            </label>
            <input
              id="install_date"
              name="install_date"
              type="date"
              className="w-full px-4 py-2 bg-neu-bg shadow-neu-inset rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4">
          <Button type="submit" isLoading={isPending}>
            Crear Activo
          </Button>
          <Link href={`/sites/${siteId}`}>
            <Button variant="ghost" type="button">Cancelar</Button>
          </Link>
        </div>
      </form>
    </Card>
  )
}
