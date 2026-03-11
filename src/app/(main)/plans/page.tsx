import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PlansList } from '@/components/plans/PlansList'
import type { PlanStatus } from '@/types/database'

export const metadata = { title: 'Planes | Bitalize Cloud Mantenimiento' }

export default async function PlansPage() {
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

  const { data: plans } = await supabase
    .from('maintenance_plans')
    .select('*, sites(name)')
    .eq('org_id', member.org_id)
    .order('created_at', { ascending: false })

  // Count tasks per plan
  const planIds = (plans || []).map(p => p.id as string)
  const { data: taskCounts } = planIds.length > 0
    ? await supabase
        .from('plan_tasks')
        .select('plan_id')
        .in('plan_id', planIds)
    : { data: [] }

  const taskCountMap = new Map<string, number>()
  for (const tc of taskCounts || []) {
    const pid = tc.plan_id as string
    taskCountMap.set(pid, (taskCountMap.get(pid) || 0) + 1)
  }

  const planRows = (plans || []).map(p => ({
    id: p.id as string,
    name: p.name as string,
    siteName: (p.sites as unknown as { name: string } | null)?.name ?? '',
    status: p.status as PlanStatus,
    startDate: p.start_date as string,
    taskCount: taskCountMap.get(p.id as string) || 0,
  }))

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Planes de Mantenimiento</h1>
          <p className="text-foreground-secondary mt-1">
            {planRows.length} plan{planRows.length !== 1 ? 'es' : ''}
          </p>
        </div>
        <Link href="/plans/new">
          <Button>Nuevo Plan</Button>
        </Link>
      </div>

      <PlansList plans={planRows} />
    </div>
  )
}
