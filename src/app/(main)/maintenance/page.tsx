import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { MaintenanceList } from '@/components/maintenance/MaintenanceList'
import type { MaintenanceType, RecordStatus } from '@/types/database'

export const metadata = { title: 'Registros | Bitalize Cloud Mantenimiento' }

export default async function MaintenancePage() {
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

  const { data: records } = await supabase
    .from('maintenance_records')
    .select('*, sites(name), profiles!maintenance_records_responsible_profile_fkey(full_name)')
    .eq('org_id', member.org_id)
    .order('visit_date', { ascending: false })

  const recordRows = (records || []).map(r => ({
    id: r.id as string,
    type: r.type as MaintenanceType,
    status: r.status as RecordStatus,
    visit_date: r.visit_date as string,
    observations: r.observations as string | null,
    site_name: (r.sites as unknown as { name: string } | null)?.name ?? '',
    responsible_name: (r.profiles as unknown as { full_name: string } | null)?.full_name ?? '',
    site_id: r.site_id as string,
  }))

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6 sm:mb-8">
        <div className="mb-3">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Registros de Mantenimiento</h1>
          <p className="text-foreground-secondary mt-1 text-sm">
            {recordRows.length} registro{recordRows.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <a href="/api/export/records" download className="flex-1 sm:flex-none">
            <Button variant="outline" className="w-full sm:w-auto text-sm">Exportar CSV</Button>
          </a>
          <Link href="/maintenance/new" className="flex-1 sm:flex-none">
            <Button className="w-full sm:w-auto text-sm">Nuevo Registro</Button>
          </Link>
        </div>
      </div>

      <MaintenanceList records={recordRows} />
    </div>
  )
}
