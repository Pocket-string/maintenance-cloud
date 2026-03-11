'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import type { PlanStatus } from '@/types/database'

interface PlanRow {
  id: string
  name: string
  siteName: string
  status: PlanStatus
  startDate: string
  taskCount: number
}

const STATUS_LABELS: Record<PlanStatus, { label: string; color: string }> = {
  draft:    { label: 'Borrador', color: 'bg-gray-100 text-gray-800' },
  active:   { label: 'Activo',   color: 'bg-green-100 text-green-800' },
  paused:   { label: 'Pausado',  color: 'bg-yellow-100 text-yellow-800' },
  archived: { label: 'Archivado', color: 'bg-purple-100 text-purple-800' },
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

export function PlansList({ plans }: { plans: PlanRow[] }) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<PlanStatus | ''>('')

  const filtered = plans.filter(p => {
    const matchSearch = !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.siteName.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !filterStatus || p.status === filterStatus
    return matchSearch && matchStatus
  })

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Buscar por nombre o sitio..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] max-w-md px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as PlanStatus | '')}
          className="px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Todos los estados</option>
          <option value="draft">Borrador</option>
          <option value="active">Activo</option>
          <option value="paused">Pausado</option>
          <option value="archived">Archivado</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-foreground-secondary">
            {plans.length === 0 ? 'No hay planes de mantenimiento' : 'No se encontraron planes'}
          </p>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Card padding="none" className="overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-border">
                  <tr>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-foreground-secondary">Nombre</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-foreground-secondary">Sitio</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-foreground-secondary">Estado</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-foreground-secondary">Fecha Inicio</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-foreground-secondary">Tareas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map(plan => {
                    const statusBadge = STATUS_LABELS[plan.status]
                    return (
                      <tr key={plan.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <Link href={`/plans/${plan.id}`} className="font-medium text-foreground hover:text-blue-600">
                            {plan.name}
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-foreground-secondary">{plan.siteName}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${statusBadge.color}`}>
                            {statusBadge.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-foreground-secondary">{formatDate(plan.startDate)}</td>
                        <td className="px-6 py-4 text-foreground-secondary">{plan.taskCount}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Card>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map(plan => {
              const statusBadge = STATUS_LABELS[plan.status]
              return (
                <Link key={plan.id} href={`/plans/${plan.id}`}>
                  <Card clickable>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-foreground">{plan.name}</p>
                        <p className="text-sm text-foreground-secondary">{plan.siteName}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${statusBadge.color}`}>
                        {statusBadge.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-sm text-foreground-secondary">Inicio: {formatDate(plan.startDate)}</span>
                      <span className="text-sm text-foreground-secondary">{plan.taskCount} tareas</span>
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
