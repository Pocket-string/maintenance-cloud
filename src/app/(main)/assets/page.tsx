import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card } from '@/components/ui/card'
import Link from 'next/link'
import type { AssetType, AssetStatus } from '@/types/database'

export const metadata = { title: 'Activos | Bitalize Cloud Mantenimiento' }

const TYPE_LABELS: Record<AssetType, string> = {
  inverter: 'Inversor',
  panel_string: 'String Paneles',
  transformer: 'Transformador',
  meter: 'Medidor',
  diesel_gen: 'Generador Diesel',
  ats: 'ATS',
  battery_bank: 'Banco Baterias',
  tracker: 'Tracker',
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
  other: 'Otro',
}

const STATUS_LABELS: Record<AssetStatus, { label: string; color: string }> = {
  active: { label: 'Activo', color: 'bg-green-100 text-green-800' },
  inactive: { label: 'Inactivo', color: 'bg-yellow-100 text-yellow-800' },
  decommissioned: { label: 'Dado de baja', color: 'bg-red-100 text-red-800' },
}

export default async function AssetsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!member) redirect('/dashboard')

  const { data: assets } = await supabase
    .from('assets')
    .select('*, sites(name)')
    .eq('org_id', member.org_id)
    .order('name')

  const assetRows = (assets || []).map(a => ({
    id: a.id as string,
    name: a.name as string,
    type: a.type as AssetType,
    status: a.status as AssetStatus,
    site_name: (a.sites as unknown as { name: string } | null)?.name ?? '',
    brand: a.brand as string | null,
    model: a.model as string | null,
    site_id: a.site_id as string,
  }))

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Activos</h1>
          <p className="text-foreground-secondary mt-1">
            {assetRows.length} activo{assetRows.length !== 1 ? 's' : ''} registrado{assetRows.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {assetRows.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-foreground-secondary">No hay activos registrados</p>
          <p className="text-sm text-foreground-secondary mt-2">
            Agrega activos desde la pagina de detalle de cada sitio
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
                    <th className="text-left px-6 py-4 text-sm font-semibold text-foreground-secondary">Tipo</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-foreground-secondary">Marca / Modelo</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-foreground-secondary">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {assetRows.map(asset => {
                    const statusBadge = STATUS_LABELS[asset.status]
                    return (
                      <tr key={asset.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-medium text-foreground">{asset.name}</span>
                        </td>
                        <td className="px-6 py-4">
                          <Link href={`/sites/${asset.site_id}`} className="text-foreground-secondary hover:text-blue-600">
                            {asset.site_name}
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-foreground-secondary">
                          {TYPE_LABELS[asset.type]}
                        </td>
                        <td className="px-6 py-4 text-foreground-secondary">
                          {[asset.brand, asset.model].filter(Boolean).join(' / ') || '—'}
                        </td>
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
            {assetRows.map(asset => {
              const statusBadge = STATUS_LABELS[asset.status]
              return (
                <Link key={asset.id} href={`/sites/${asset.site_id}`}>
                  <Card clickable>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">{asset.name}</p>
                        <p className="text-sm text-foreground-secondary">{asset.site_name} &middot; {TYPE_LABELS[asset.type]}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${statusBadge.color}`}>
                        {statusBadge.label}
                      </span>
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
