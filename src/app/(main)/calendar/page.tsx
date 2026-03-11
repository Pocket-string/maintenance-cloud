import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CalendarView } from '@/components/calendar/CalendarView'
import type { ScheduledTaskRow } from '@/components/calendar/ScheduledTaskCard'

export const metadata = { title: 'Calendario | Bitalize Cloud Mantenimiento' }

export default async function CalendarPage() {
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

  // Fetch all scheduled tasks for the org
  const { data: scheduled } = await supabase
    .from('scheduled_tasks')
    .select('*, plan_tasks(description, frequency_months, frequency_type, plan_categories(name)), maintenance_plans(name, sites(name))')
    .eq('org_id', member.org_id)
    .order('scheduled_date')

  const tasks: ScheduledTaskRow[] = (scheduled || []).map(s => {
    const pt = s.plan_tasks as unknown as { description: string; frequency_months: number | null; frequency_type: string; plan_categories: { name: string } | null } | null
    const mp = s.maintenance_plans as unknown as { name: string; sites: { name: string } | null } | null
    return {
      id: s.id as string,
      scheduledDate: s.scheduled_date as string,
      dueDate: s.due_date as string,
      status: s.status as ScheduledTaskRow['status'],
      taskDescription: pt?.description ?? '',
      categoryName: pt?.plan_categories?.name ?? '',
      siteName: mp?.sites?.name ?? '',
      planName: mp?.name ?? '',
      frequencyMonths: pt?.frequency_months ?? null,
      frequencyType: (pt?.frequency_type as 'fixed' | 'special') ?? undefined,
    }
  })

  // Fetch sites for filter
  const { data: sites } = await supabase
    .from('sites')
    .select('id, name')
    .eq('org_id', member.org_id)
    .order('name')

  const siteOptions = (sites || []).map(s => ({
    id: s.id as string,
    name: s.name as string,
  }))

  const now = new Date()

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Calendario de Mantenimiento</h1>
        <p className="text-foreground-secondary mt-1">Tareas programadas de todos los planes activos</p>
      </div>

      <CalendarView
        tasks={tasks}
        sites={siteOptions}
        initialYear={now.getFullYear()}
        initialMonth={now.getMonth() + 1}
      />
    </div>
  )
}
