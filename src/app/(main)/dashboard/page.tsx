import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { RecordStatus, MaintenanceType } from '@/types/database'

export const metadata = { title: 'Dashboard | Bitalize Cloud Mantenimiento' }

const STATUS_LABELS: Record<RecordStatus, { label: string; color: string }> = {
  draft: { label: 'Borrador', color: 'bg-gray-100 text-gray-800' },
  submitted: { label: 'Enviado', color: 'bg-blue-100 text-blue-800' },
  reviewed: { label: 'Revisado', color: 'bg-green-100 text-green-800' },
  closed: { label: 'Cerrado', color: 'bg-purple-100 text-purple-800' },
}

const TYPE_LABELS: Record<MaintenanceType, string> = {
  pv_prev: 'Preventivo FV',
  diesel_prev: 'Preventivo Diesel',
  corrective: 'Correctivo',
}

const SITE_TYPE_LABELS: Record<string, string> = {
  fv_pmgd: 'Planta Fotovoltaica PMGD',
  diesel: 'Generador Diesel',
  hybrid: 'Hibrido',
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('organization_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!member) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('user_id', user.id)
    .maybeSingle()

  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${lastDay}`

  // Fetch stats in parallel
  const [sitesRes, assetsRes, recordsRes, recentRes, allSitesRes, scheduledRes] = await Promise.all([
    supabase.from('sites').select('id', { count: 'exact', head: true }).eq('org_id', member.org_id),
    supabase.from('assets').select('id', { count: 'exact', head: true }).eq('org_id', member.org_id),
    supabase.from('maintenance_records').select('id, status').eq('org_id', member.org_id),
    supabase
      .from('maintenance_records')
      .select('id, type, status, visit_date, sites(name)')
      .eq('org_id', member.org_id)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('sites').select('id, name, type').eq('org_id', member.org_id).order('name'),
    supabase
      .from('scheduled_tasks')
      .select('status, maintenance_plans(site_id)')
      .eq('org_id', member.org_id)
      .gte('scheduled_date', monthStart)
      .lte('scheduled_date', monthEnd),
  ])

  const totalSites = sitesRes.count ?? 0
  const totalAssets = assetsRes.count ?? 0
  const allRecords = recordsRes.data ?? []
  const totalRecords = allRecords.length
  const pendingRecords = allRecords.filter(r => r.status === 'draft' || r.status === 'submitted').length
  const recentRecords = recentRes.data ?? []

  // Build per-site KPIs from scheduled tasks
  const allSites = allSitesRes.data ?? []
  const scheduledTasks = scheduledRes.data ?? []

  interface SiteKpi {
    id: string
    name: string
    type: string
    total: number
    completed: number
    pending: number
    overdue: number
    compliancePercent: number
  }

  const siteStatsMap = new Map<string, { total: number; completed: number; pending: number; overdue: number }>()
  for (const st of scheduledTasks) {
    const mp = st.maintenance_plans as unknown as { site_id: string } | null
    if (!mp) continue
    const siteId = mp.site_id
    const current = siteStatsMap.get(siteId) ?? { total: 0, completed: 0, pending: 0, overdue: 0 }
    current.total++
    if (st.status === 'completed') current.completed++
    else if (st.status === 'pending') current.pending++
    else if (st.status === 'overdue') current.overdue++
    siteStatsMap.set(siteId, current)
  }

  const siteKpis: SiteKpi[] = allSites
    .filter(s => siteStatsMap.has(s.id as string))
    .map(s => {
      const stats = siteStatsMap.get(s.id as string)!
      const denominator = stats.total - (scheduledTasks.filter(st => {
        const mp = st.maintenance_plans as unknown as { site_id: string } | null
        return mp?.site_id === (s.id as string) && st.status === 'skipped'
      }).length)
      return {
        id: s.id as string,
        name: s.name as string,
        type: s.type as string,
        ...stats,
        compliancePercent: denominator > 0 ? Math.round((stats.completed / denominator) * 100) : 0,
      }
    })

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">
          Bienvenido, {profile?.full_name || user.email?.split('@')[0]}
        </h1>
        <p className="text-foreground-secondary mt-1">Resumen de operaciones</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <p className="text-sm text-foreground-secondary">Sitios</p>
          <p className="text-3xl font-bold text-foreground mt-1">{totalSites}</p>
        </Card>
        <Card>
          <p className="text-sm text-foreground-secondary">Activos</p>
          <p className="text-3xl font-bold text-foreground mt-1">{totalAssets}</p>
        </Card>
        <Card>
          <p className="text-sm text-foreground-secondary">Registros</p>
          <p className="text-3xl font-bold text-foreground mt-1">{totalRecords}</p>
        </Card>
        <Card>
          <p className="text-sm text-foreground-secondary">Pendientes</p>
          <p className="text-3xl font-bold text-blue-600 mt-1">{pendingRecords}</p>
        </Card>
      </div>

      {/* Site KPIs */}
      {siteKpis.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Cumplimiento por Sitio — {MONTH_NAMES[now.getMonth()]}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {siteKpis.map(site => (
              <Card key={site.id}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-foreground">{site.name}</p>
                    <p className="text-xs text-foreground-secondary">{SITE_TYPE_LABELS[site.type] ?? site.type}</p>
                  </div>
                  <span className={`text-2xl font-bold ${
                    site.compliancePercent >= 80 ? 'text-green-600' :
                    site.compliancePercent >= 50 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {site.compliancePercent}%
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden mb-2 shadow-neu-inset-sm">
                  <div
                    className={`h-full rounded-full transition-all ${
                      site.compliancePercent >= 80 ? 'bg-green-500' :
                      site.compliancePercent >= 50 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${site.compliancePercent}%` }}
                  />
                </div>
                <div className="flex items-center gap-4 text-xs text-foreground-secondary">
                  <span>{site.completed}/{site.total} completadas</span>
                  {site.overdue > 0 && (
                    <span className="text-red-600 font-medium">{site.overdue} vencidas</span>
                  )}
                  {site.pending > 0 && (
                    <span>{site.pending} pendientes</span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3 mb-8">
        <Link href="/maintenance/new">
          <Button>Nuevo Registro</Button>
        </Link>
        <Link href="/sites/new">
          <Button variant="outline">Nuevo Sitio</Button>
        </Link>
        <Link href="/maintenance">
          <Button variant="ghost">Ver Registros</Button>
        </Link>
      </div>

      {/* Recent Records */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Registros Recientes</h2>
        {recentRecords.length === 0 ? (
          <Card className="text-center py-8">
            <p className="text-foreground-secondary">No hay registros aun</p>
            <Link href="/maintenance/new" className="text-blue-600 text-sm hover:underline mt-2 inline-block">
              Crear primer registro
            </Link>
          </Card>
        ) : (
          <Card padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead className="bg-neu-bg">
                <tr>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-foreground-secondary">Fecha</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-foreground-secondary">Sitio</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-foreground-secondary">Tipo</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-foreground-secondary">Estado</th>
                </tr>
              </thead>
              <tbody>
                {recentRecords.map(r => {
                  const statusBadge = STATUS_LABELS[r.status as RecordStatus]
                  const siteName = (r.sites as unknown as { name: string } | null)?.name ?? ''
                  return (
                    <tr key={r.id} className="hover:shadow-neu-inset-sm transition-shadow">
                      <td className="px-6 py-3">
                        <Link href={`/maintenance/${r.id}`} className="font-medium text-foreground hover:text-blue-600">
                          {formatDate(r.visit_date as string)}
                        </Link>
                      </td>
                      <td className="px-6 py-3 text-foreground-secondary">{siteName}</td>
                      <td className="px-6 py-3 text-foreground-secondary">{TYPE_LABELS[r.type as MaintenanceType]}</td>
                      <td className="px-6 py-3">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${statusBadge.color}`}>
                          {statusBadge.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}
