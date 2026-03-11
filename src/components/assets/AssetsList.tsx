'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import type { AssetType, AssetStatus } from '@/types/database'

interface AssetRow {
  id: string
  name: string
  code: string | null
  tag: string | null
  priority: number
  parent_id: string | null
  type: AssetType
  brand: string | null
  model: string | null
  serial: string | null
  status: AssetStatus
  install_date: string | null
}

const TYPE_LABELS: Record<AssetType, string> = {
  inverter: 'Inversor',
  panel_string: 'String Paneles',
  transformer: 'Transformador',
  meter: 'Medidor',
  diesel_gen: 'Generador Diesel',
  ats: 'ATS',
  battery_bank: 'Banco Baterias',
  other: 'Otro',
  tracker: 'Tracker Solar',
  string_box: 'String Box',
  switchgear: 'Switchgear',
  ncu: 'NCU',
  rack: 'Rack',
  ups: 'UPS',
  sensor: 'Sensor',
  ppc: 'PPC',
  center: 'Centro Transf.',
  module: 'Modulo',
  building: 'Edificio',
}

const STATUS_LABELS: Record<AssetStatus, { label: string; color: string }> = {
  active: { label: 'Activo', color: 'bg-green-100 text-green-800' },
  inactive: { label: 'Inactivo', color: 'bg-yellow-100 text-yellow-800' },
  decommissioned: { label: 'Dado de baja', color: 'bg-red-100 text-red-800' },
}

const PRIORITY_DOT: Record<number, string> = {
  1: 'bg-red-500',
  2: 'bg-orange-500',
  3: 'bg-yellow-400',
  4: 'bg-green-500',
  5: 'bg-gray-400',
}

function PriorityDot({ priority }: { priority: number }) {
  const colorClass = PRIORITY_DOT[priority] ?? PRIORITY_DOT[3]
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${colorClass}`}
      aria-label={`Prioridad ${priority}`}
      title={`Prioridad ${priority}`}
    />
  )
}

export function AssetsList({ assets, siteId }: { assets: AssetRow[]; siteId: string }) {
  const [search, setSearch] = useState('')

  const filtered = assets.filter(a => {
    const q = search.toLowerCase()
    return (
      a.name.toLowerCase().includes(q) ||
      (a.code?.toLowerCase().includes(q) ?? false) ||
      (a.tag?.toLowerCase().includes(q) ?? false) ||
      (a.brand?.toLowerCase().includes(q) ?? false) ||
      (a.serial?.toLowerCase().includes(q) ?? false)
    )
  })

  if (assets.length === 0) {
    return (
      <Card className="text-center py-12">
        <p className="text-foreground-secondary">Este sitio no tiene activos registrados</p>
      </Card>
    )
  }

  return (
    <div>
      <input
        type="text"
        placeholder="Buscar activo..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-md px-4 py-2 mb-6 bg-neu-bg shadow-neu-inset rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {filtered.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-foreground-secondary">No se encontraron activos</p>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Card padding="none" className="overflow-hidden">
              <table className="w-full">
                <thead className="bg-neu-bg border-b border-[#b8b9be]">
                  <tr>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-foreground-secondary">Nombre</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-foreground-secondary">Codigo</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-foreground-secondary">Tipo</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-foreground-secondary">Marca / Modelo</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-foreground-secondary">Serie</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-foreground-secondary">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-transparent">
                  {filtered.map(asset => {
                    const statusBadge = STATUS_LABELS[asset.status]
                    return (
                      <tr key={asset.id} className="hover:shadow-neu-inset-sm transition-all rounded-lg">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <PriorityDot priority={asset.priority} />
                            <span className="font-medium text-foreground">{asset.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-foreground-secondary">{asset.code || '—'}</td>
                        <td className="px-6 py-4 text-foreground-secondary">{TYPE_LABELS[asset.type]}</td>
                        <td className="px-6 py-4 text-foreground-secondary">
                          {[asset.brand, asset.model].filter(Boolean).join(' / ') || '—'}
                        </td>
                        <td className="px-6 py-4 text-foreground-secondary">{asset.serial || '—'}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${statusBadge.color}`}>
                            {statusBadge.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Card>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map(asset => {
              const statusBadge = STATUS_LABELS[asset.status]
              return (
                <Card key={asset.id}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-2">
                      <PriorityDot priority={asset.priority} />
                      <div>
                        <p className="font-medium text-foreground">{asset.name}</p>
                        {asset.code && (
                          <p className="text-xs text-foreground-secondary mt-0.5">{asset.code}</p>
                        )}
                        <p className="text-sm text-foreground-secondary mt-0.5">
                          {TYPE_LABELS[asset.type]}
                          {asset.brand && ` · ${asset.brand}`}
                        </p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${statusBadge.color}`}>
                      {statusBadge.label}
                    </span>
                  </div>
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
