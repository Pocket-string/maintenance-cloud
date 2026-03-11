import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MaintenanceForm } from '@/components/maintenance/MaintenanceForm'

export const metadata = { title: 'Nuevo Registro | Bitalize Cloud Mantenimiento' }

export default async function NewMaintenancePage() {
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

  const { data: sites } = await supabase
    .from('sites')
    .select('id, name, type')
    .eq('org_id', member.org_id)
    .order('name')

  const siteOptions = (sites || []).map(s => ({
    id: s.id as string,
    name: s.name as string,
    type: s.type as string,
  }))

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Nuevo Registro de Mantenimiento</h1>
        <p className="text-foreground-secondary mt-1">Registra una visita de mantenimiento</p>
      </div>
      <MaintenanceForm sites={siteOptions} />
    </div>
  )
}
