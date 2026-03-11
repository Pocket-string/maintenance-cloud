import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PlanForm } from '@/components/plans/PlanForm'

export const metadata = { title: 'Nuevo Plan | Bitalize Cloud Mantenimiento' }

export default async function NewPlanPage() {
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
    .select('id, name')
    .eq('org_id', member.org_id)
    .order('name')

  const siteOptions = (sites || []).map(s => ({
    id: s.id as string,
    name: s.name as string,
  }))

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Nuevo Plan de Mantenimiento</h1>
        <p className="text-foreground-secondary mt-1">Crea un plan y luego importa tareas desde Excel</p>
      </div>
      <PlanForm sites={siteOptions} />
    </div>
  )
}
