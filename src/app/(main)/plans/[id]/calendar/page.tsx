import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { CalendarView } from '@/components/calendar/CalendarView'
import type { ScheduledTaskRow } from '@/components/calendar/ScheduledTaskCard'

export async function generateMetadata() {
  return { title: 'Calendario del Plan | Bitalize Cloud Mantenimiento' }
}

export default async function PlanCalendarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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

  // Verify plan access
  const { data: plan } = await supabase
    .from('maintenance_plans')
    .select('id, name, site_id, sites(name)')
    .eq('id', id)
    .eq('org_id', member.org_id)
    .single()

  if (!plan) notFound()

  const now = new Date()

  // Fetch scheduled tasks for this plan (current month +/- 1)
  const { data: scheduled } = await supabase
    .from('scheduled_tasks')
    .select('*, plan_tasks(description, frequency_months, frequency_type, plan_categories(name))')
    .eq('plan_id', id)
    .order('scheduled_date')

  const siteName = (plan.sites as unknown as { name: string } | null)?.name ?? ''

  const tasks: ScheduledTaskRow[] = (scheduled || []).map(s => {
    const pt = s.plan_tasks as unknown as { description: string; frequency_months: number | null; frequency_type: string; plan_categories: { name: string } | null } | null
    return {
      id: s.id as string,
      scheduledDate: s.scheduled_date as string,
      dueDate: s.due_date as string,
      status: s.status as ScheduledTaskRow['status'],
      taskDescription: pt?.description ?? '',
      categoryName: pt?.plan_categories?.name ?? '',
      siteName,
      planName: plan.name as string,
      frequencyMonths: pt?.frequency_months ?? null,
      frequencyType: (pt?.frequency_type as 'fixed' | 'special') ?? undefined,
    }
  })

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <Link href={`/plans/${id}`} className="text-sm text-foreground-secondary hover:text-foreground">
          &larr; Volver al plan
        </Link>
        <h1 className="text-2xl font-bold text-foreground mt-2">
          Calendario: {plan.name as string}
        </h1>
        <p className="text-foreground-secondary mt-1">{siteName}</p>
      </div>

      <CalendarView
        tasks={tasks}
        sites={[{ id: plan.site_id as string, name: siteName }]}
        initialYear={now.getFullYear()}
        initialMonth={now.getMonth() + 1}
      />
    </div>
  )
}
