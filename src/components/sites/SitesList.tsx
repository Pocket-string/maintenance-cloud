'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import type { SiteType } from '@/types/database'

interface SiteRow {
  id: string
  name: string
  commune: string
  region: string
  type: SiteType
  asset_count: number
}

const TYPE_LABELS: Record<SiteType, { label: string; color: string }> = {
  fv_pmgd: { label: 'FV PMGD', color: 'bg-yellow-100 text-yellow-800' },
  diesel: { label: 'Diesel', color: 'bg-gray-100 text-gray-800' },
  hybrid: { label: 'Hibrido', color: 'bg-blue-100 text-blue-800' },
}

export function SitesList({ sites }: { sites: SiteRow[] }) {
  const [search, setSearch] = useState('')

  const filtered = sites.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.commune.toLowerCase().includes(search.toLowerCase()) ||
    s.region.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <input
        type="text"
        placeholder="Buscar sitio..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-md px-4 py-2 mb-6 bg-neu-bg shadow-neu-inset rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {filtered.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-foreground-secondary">
            {search ? 'No se encontraron sitios' : 'No hay sitios registrados'}
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
                    <th className="text-left px-6 py-4 text-sm font-semibold text-foreground-secondary">Nombre</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-foreground-secondary">Comuna</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-foreground-secondary">Region</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-foreground-secondary">Tipo</th>
                    <th className="text-right px-6 py-4 text-sm font-semibold text-foreground-secondary">Activos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-transparent">
                  {filtered.map(site => {
                    const badge = TYPE_LABELS[site.type]
                    return (
                      <tr key={site.id} className="hover:shadow-neu-inset-sm transition-all rounded-lg">
                        <td className="px-6 py-4">
                          <Link href={`/sites/${site.id}`} className="font-medium text-foreground hover:text-blue-600">
                            {site.name}
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-foreground-secondary">{site.commune}</td>
                        <td className="px-6 py-4 text-foreground-secondary">{site.region}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${badge.color}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-foreground-secondary">{site.asset_count}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Card>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map(site => {
              const badge = TYPE_LABELS[site.type]
              return (
                <Link key={site.id} href={`/sites/${site.id}`}>
                  <Card clickable className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{site.name}</p>
                      <p className="text-sm text-foreground-secondary">{site.commune}, {site.region}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${badge.color}`}>
                        {badge.label}
                      </span>
                      <span className="text-sm text-foreground-secondary">{site.asset_count} activos</span>
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
