'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import type { MaintenanceType, RecordStatus } from '@/types/database'

interface RecordRow {
  id: string
  type: MaintenanceType
  status: RecordStatus
  visit_date: string
  observations: string | null
  site_name: string
  responsible_name: string
  site_id: string
}

const TYPE_LABELS: Record<MaintenanceType, { label: string; color: string }> = {
  pv_prev: { label: 'Preventivo FV', color: 'bg-yellow-100 text-yellow-800' },
  diesel_prev: { label: 'Preventivo Diesel', color: 'bg-orange-100 text-orange-800' },
  corrective: { label: 'Correctivo', color: 'bg-red-100 text-red-800' },
}

const STATUS_LABELS: Record<RecordStatus, { label: string; color: string }> = {
  draft: { label: 'Borrador', color: 'bg-gray-100 text-gray-800' },
  submitted: { label: 'Enviado', color: 'bg-blue-100 text-blue-800' },
  reviewed: { label: 'Revisado', color: 'bg-green-100 text-green-800' },
  closed: { label: 'Cerrado', color: 'bg-purple-100 text-purple-800' },
}

export function MaintenanceList({ records }: { records: RecordRow[] }) {
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<MaintenanceType | ''>('')
  const [filterStatus, setFilterStatus] = useState<RecordStatus | ''>('')

  const filtered = records.filter(r => {
    const matchSearch = !search ||
      r.site_name.toLowerCase().includes(search.toLowerCase()) ||
      r.responsible_name.toLowerCase().includes(search.toLowerCase())
    const matchType = !filterType || r.type === filterType
    const matchStatus = !filterStatus || r.status === filterStatus
    return matchSearch && matchType && matchStatus
  })

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Buscar por sitio o responsable..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] max-w-md px-4 py-2 bg-neu-bg shadow-neu-inset rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as MaintenanceType | '')}
          className="px-4 py-2 bg-neu-bg shadow-neu-inset rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos los tipos</option>
          <option value="pv_prev">Preventivo FV</option>
          <option value="diesel_prev">Preventivo Diesel</option>
          <option value="corrective">Correctivo</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as RecordStatus | '')}
          className="px-4 py-2 bg-neu-bg shadow-neu-inset rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos los estados</option>
          <option value="draft">Borrador</option>
          <option value="submitted">Enviado</option>
          <option value="reviewed">Revisado</option>
          <option value="closed">Cerrado</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-foreground-secondary">
            {records.length === 0 ? 'No hay registros de mantenimiento' : 'No se encontraron registros'}
          </p>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Card padding="none" className="overflow-hidden">
              <table className="w-full">
                <thead className="bg-neu-bg border-b border-[#b8b9be]">
                  <tr>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-foreground-secondary">Fecha</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-foreground-secondary">Sitio</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-foreground-secondary">Tipo</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-foreground-secondary">Responsable</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-foreground-secondary">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-transparent">
                  {filtered.map(record => {
                    const typeBadge = TYPE_LABELS[record.type]
                    const statusBadge = STATUS_LABELS[record.status]
                    return (
                      <tr key={record.id} className="hover:shadow-neu-inset-sm transition-all rounded-lg">
                        <td className="px-6 py-4">
                          <Link href={`/maintenance/${record.id}`} className="font-medium text-foreground hover:text-blue-600">
                            {formatDate(record.visit_date)}
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-foreground-secondary">{record.site_name}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${typeBadge.color}`}>
                            {typeBadge.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-foreground-secondary">{record.responsible_name}</td>
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
            {filtered.map(record => {
              const typeBadge = TYPE_LABELS[record.type]
              const statusBadge = STATUS_LABELS[record.status]
              return (
                <Link key={record.id} href={`/maintenance/${record.id}`}>
                  <Card clickable>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-foreground">{record.site_name}</p>
                        <p className="text-sm text-foreground-secondary">{formatDate(record.visit_date)}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${statusBadge.color}`}>
                        {statusBadge.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${typeBadge.color}`}>
                        {typeBadge.label}
                      </span>
                      <span className="text-sm text-foreground-secondary">{record.responsible_name}</span>
                    </div>
                  </Card>
                </Link>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}
