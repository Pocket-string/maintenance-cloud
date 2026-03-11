import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PlanDetail } from '@/components/plans/PlanDetail'
import { ExcelImportSection } from '@/components/plans/ExcelImportSection'
import { PlanStatusActions } from '@/components/plans/PlanStatusActions'
import type { PlanStatus, PlanTask } from '@/types/database'

export async function generateMetadata() {
  return { title: 'Detalle Plan | Bitalize Cloud Mantenimiento' }
}

export default async function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
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

  // Fetch plan with site name
  const { data: plan } = await supabase
    .from('maintenance_plans')
    .select('*, sites(name)')
    .eq('id', id)
    .eq('org_id', member.org_id)
    .single()

  if (!plan) notFound()

  // Fetch categories
  const { data: categories } = await supabase
    .from('plan_categories')
    .select('*')
    .eq('plan_id', id)
    .order('order_index')

  // Fetch tasks
  const { data: tasks } = await supabase
    .from('plan_tasks')
    .select('*')
    .eq('plan_id', id)
    .order('order_index')

  // Group tasks by category
  const tasksByCategory = new Map<string, PlanTask[]>()
  for (const t of tasks || []) {
    const catId = t.category_id as string
    if (!tasksByCategory.has(catId)) tasksByCategory.set(catId, [])
    tasksByCategory.get(catId)!.push(t as unknown as PlanTask)
  }

  // Fetch checklist item counts per task
  const taskIds = (tasks || []).map(t => t.id as string)
  const { data: checklistItems } = taskIds.length > 0
    ? await supabase
        .from('checklist_items')
        .select('plan_task_id')
        .in('plan_task_id', taskIds)
    : { data: [] }

  const checklistCountMap = new Map<string, number>()
  for (const ci of checklistItems || []) {
    const tid = ci.plan_task_id as string
    checklistCountMap.set(tid, (checklistCountMap.get(tid) || 0) + 1)
  }

  // Fetch next scheduled date per plan_task (nearest future or most recent)
  const { data: scheduledRows } = taskIds.length > 0
    ? await supabase
        .from('scheduled_tasks')
        .select('id, plan_task_id, scheduled_date, status')
        .in('plan_task_id', taskIds)
        .in('status', ['pending', 'overdue'])
        .order('scheduled_date', { ascending: true })
    : { data: [] }

  // Build map: plan_task_id -> { scheduledTaskId, scheduledDate, scheduledStatus }
  const nextScheduleMap = new Map<string, { scheduledTaskId: string; scheduledDate: string; scheduledStatus: 'pending' | 'overdue' }>()
  for (const sr of scheduledRows || []) {
    const ptId = sr.plan_task_id as string
    // Take only the first (nearest) pending/overdue per plan_task
    if (!nextScheduleMap.has(ptId)) {
      nextScheduleMap.set(ptId, {
        scheduledTaskId: sr.id as string,
        scheduledDate: sr.scheduled_date as string,
        scheduledStatus: sr.status as 'pending' | 'overdue',
      })
    }
  }

  const categoriesWithTasks = (categories || []).map(c => ({
    id: c.id as string,
    name: c.name as string,
    tasks: (tasksByCategory.get(c.id as string) || []).map(t => {
      const schedule = nextScheduleMap.get(t.id)
      return {
        id: t.id,
        description: t.description,
        frequencyMonths: t.frequency_months,
        frequencyType: t.frequency_type as 'fixed' | 'special',
        frequencyDetail: t.frequency_detail,
        isActive: t.is_active,
        checklistCount: checklistCountMap.get(t.id) || 0,
        scheduledTaskId: schedule?.scheduledTaskId ?? null,
        scheduledDate: schedule?.scheduledDate ?? null,
        scheduledStatus: schedule?.scheduledStatus ?? null,
      }
    }),
  }))

  // Compliance stats (only if plan is active)
  let complianceStats: { total: number; completed: number; compliancePercent: number } | undefined
  if (plan.status === 'active') {
    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${lastDay}`

    const { data: scheduled } = await supabase
      .from('scheduled_tasks')
      .select('status')
      .eq('plan_id', id)
      .gte('scheduled_date', monthStart)
      .lte('scheduled_date', monthEnd)

    if (scheduled && scheduled.length > 0) {
      const total = scheduled.length
      const completed = scheduled.filter(s => s.status === 'completed').length
      const skipped = scheduled.filter(s => s.status === 'skipped').length
      const denominator = total - skipped
      complianceStats = {
        total,
        completed,
        compliancePercent: denominator > 0 ? Math.round((completed / denominator) * 100) : 0,
      }
    }
  }

  const siteName = (plan.sites as unknown as { name: string } | null)?.name ?? ''
  const totalTasks = (tasks || []).length

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/plans" className="text-sm text-foreground-secondary hover:text-foreground">
            &larr; Volver a planes
          </Link>
          <h1 className="text-2xl font-bold text-foreground mt-2">{plan.name as string}</h1>
        </div>
        <div className="flex gap-3 items-center">
          {plan.status === 'active' && (
            <Link href={`/plans/${id}/calendar`}>
              <Button variant="outline">Ver Calendario</Button>
            </Link>
          )}
          <PlanStatusActions planId={id} currentStatus={plan.status as PlanStatus} />
        </div>
      </div>

      <PlanDetail
        plan={{
          id: plan.id as string,
          name: plan.name as string,
          description: plan.description as string | null,
          status: plan.status as PlanStatus,
          startDate: plan.start_date as string,
          endDate: plan.end_date as string | null,
          siteName,
        }}
        categories={categoriesWithTasks}
        complianceStats={complianceStats}
      />

      {/* Excel import - only if draft and no tasks yet */}
      {plan.status === 'draft' && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            {totalTasks > 0 ? 'Re-importar desde Excel' : 'Importar Tareas desde Excel'}
          </h2>
          <ExcelImportSection planId={id} />
        </div>
      )}
    </div>
  )
}
