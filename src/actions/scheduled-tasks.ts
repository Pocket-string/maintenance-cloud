'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/actions/audit'
import type { ScheduledTaskStatus, MaintenanceType, RecordStatus } from '@/types/database'

// ------------------------------------------------------------------
// Return types
// ------------------------------------------------------------------

type ActionResult<T = void> = { success: true; data?: T } | { success: false; error: string }

export interface ScheduledTaskSummary {
  id: string
  scheduledDate: string
  dueDate: string
  status: ScheduledTaskStatus
  taskDescription: string
  categoryName: string
  siteName: string
  planName: string
  planId: string
  indice: string | null
  subindice: string | null
}

export interface ComplianceStats {
  total: number
  completed: number
  pending: number
  overdue: number
  skipped: number
  compliancePercent: number
}

// ------------------------------------------------------------------
// Helper: resolve org identity
// ------------------------------------------------------------------

async function resolveOrgId(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ userId: string; orgId: string } | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: membership } = await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership) return null
  return { userId: user.id, orgId: membership.org_id }
}

// ------------------------------------------------------------------
// Helper: format today as YYYY-MM-DD
// ------------------------------------------------------------------

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

// ------------------------------------------------------------------
// Helper: build month range filter strings (YYYY-MM-DD)
// ------------------------------------------------------------------

function monthRange(year: number, month: number): { start: string; end: string } {
  const paddedMonth = String(month).padStart(2, '0')
  const daysInMonth = new Date(year, month, 0).getDate()
  return {
    start: `${year}-${paddedMonth}-01`,
    end: `${year}-${paddedMonth}-${String(daysInMonth).padStart(2, '0')}`,
  }
}

// ------------------------------------------------------------------
// Helper: map raw join row to ScheduledTaskSummary
// ------------------------------------------------------------------

type RawTaskRow = {
  id: string
  scheduled_date: string
  due_date: string
  status: string
  plan_tasks: {
    description: string
    indice: string | null
    subindice: string | null
    plan_categories: { name: string } | null
  } | null
  maintenance_plans: {
    id: string
    name: string
    sites: { name: string } | null
  } | null
}

function mapToSummary(row: RawTaskRow): ScheduledTaskSummary {
  return {
    id: row.id,
    scheduledDate: row.scheduled_date,
    dueDate: row.due_date,
    status: row.status as ScheduledTaskStatus,
    taskDescription: row.plan_tasks?.description ?? '',
    categoryName: row.plan_tasks?.plan_categories?.name ?? '',
    siteName: row.maintenance_plans?.sites?.name ?? '',
    planName: row.maintenance_plans?.name ?? '',
    planId: row.maintenance_plans?.id ?? '',
    indice: row.plan_tasks?.indice ?? null,
    subindice: row.plan_tasks?.subindice ?? null,
  }
}

// ------------------------------------------------------------------
// getScheduledTasksByMonth
// ------------------------------------------------------------------

export async function getScheduledTasksByMonth(
  year: number,
  month: number,
  siteId?: string
): Promise<ActionResult<ScheduledTaskSummary[]>> {
  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)
  if (!identity) return { success: false, error: 'No autenticado' }

  const range = monthRange(year, month)

  let query = supabase
    .from('scheduled_tasks')
    .select(`
      id,
      scheduled_date,
      due_date,
      status,
      plan_tasks (
        description,
        indice,
        subindice,
        plan_categories ( name )
      ),
      maintenance_plans (
        id,
        name,
        site_id,
        sites ( name )
      )
    `)
    .eq('org_id', identity.orgId)
    .gte('scheduled_date', range.start)
    .lte('scheduled_date', range.end)
    .order('scheduled_date', { ascending: true })

  if (siteId) {
    query = query.eq('maintenance_plans.site_id', siteId)
  }

  const { data, error } = await query

  if (error) {
    console.error('[getScheduledTasksByMonth]', error)
    return { success: false, error: error.message }
  }

  const tasks: ScheduledTaskSummary[] = (data ?? []).map(row => mapToSummary(row as unknown as RawTaskRow))

  return { success: true, data: tasks }
}

// ------------------------------------------------------------------
// getScheduledTasksForPlan
// ------------------------------------------------------------------

export async function getScheduledTasksForPlan(
  planId: string,
  year: number,
  month: number
): Promise<ActionResult<ScheduledTaskSummary[]>> {
  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)
  if (!identity) return { success: false, error: 'No autenticado' }

  const range = monthRange(year, month)

  const { data, error } = await supabase
    .from('scheduled_tasks')
    .select(`
      id,
      scheduled_date,
      due_date,
      status,
      plan_tasks (
        description,
        indice,
        subindice,
        plan_categories ( name )
      ),
      maintenance_plans (
        id,
        name,
        site_id,
        sites ( name )
      )
    `)
    .eq('org_id', identity.orgId)
    .eq('plan_id', planId)
    .gte('scheduled_date', range.start)
    .lte('scheduled_date', range.end)
    .order('scheduled_date', { ascending: true })

  if (error) {
    console.error('[getScheduledTasksForPlan]', error)
    return { success: false, error: error.message }
  }

  const tasks: ScheduledTaskSummary[] = (data ?? []).map(row => mapToSummary(row as unknown as RawTaskRow))

  return { success: true, data: tasks }
}

// ------------------------------------------------------------------
// completeScheduledTask
// ------------------------------------------------------------------

export async function completeScheduledTask(
  scheduledTaskId: string,
  maintenanceRecordId: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)
  if (!identity) return { success: false, error: 'No autenticado' }

  // Verify scheduled task belongs to org
  const { data: task, error: fetchError } = await supabase
    .from('scheduled_tasks')
    .select('id, plan_id, status')
    .eq('id', scheduledTaskId)
    .eq('org_id', identity.orgId)
    .single()

  if (fetchError || !task) {
    return { success: false, error: 'Tarea programada no encontrada' }
  }

  const { error: updateError } = await supabase
    .from('scheduled_tasks')
    .update({
      status: 'completed' as ScheduledTaskStatus,
      completed_date: todayIso(),
      completed_by: identity.userId,
      maintenance_record_id: maintenanceRecordId,
    })
    .eq('id', scheduledTaskId)
    .eq('org_id', identity.orgId)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  await logAudit({
    orgId: identity.orgId,
    userId: identity.userId,
    action: 'complete',
    entityType: 'scheduled_task',
    entityId: scheduledTaskId,
    metadata: { maintenance_record_id: maintenanceRecordId },
  })

  revalidatePath('/plans/' + task.plan_id)
  revalidatePath('/calendar')
  return { success: true }
}

// ------------------------------------------------------------------
// skipScheduledTask
// ------------------------------------------------------------------

export async function skipScheduledTask(
  scheduledTaskId: string,
  reason: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)
  if (!identity) return { success: false, error: 'No autenticado' }

  const { data: task, error: fetchError } = await supabase
    .from('scheduled_tasks')
    .select('id, plan_id, status')
    .eq('id', scheduledTaskId)
    .eq('org_id', identity.orgId)
    .single()

  if (fetchError || !task) {
    return { success: false, error: 'Tarea programada no encontrada' }
  }

  const { error: updateError } = await supabase
    .from('scheduled_tasks')
    .update({
      status: 'skipped' as ScheduledTaskStatus,
      notes: reason,
    })
    .eq('id', scheduledTaskId)
    .eq('org_id', identity.orgId)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  await logAudit({
    orgId: identity.orgId,
    userId: identity.userId,
    action: 'skip',
    entityType: 'scheduled_task',
    entityId: scheduledTaskId,
    metadata: { reason },
  })

  revalidatePath('/plans/' + task.plan_id)
  revalidatePath('/calendar')
  return { success: true }
}

// ------------------------------------------------------------------
// createRecordFromScheduledTask
// ------------------------------------------------------------------

export async function createRecordFromScheduledTask(
  scheduledTaskId: string
): Promise<never> {
  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)

  if (!identity) {
    // redirect away from this dead-end; caller should guard auth first
    redirect('/login')
  }

  // Fetch the scheduled task with its plan_task and maintenance_plan + site type
  const { data: scheduledTask, error: fetchError } = await supabase
    .from('scheduled_tasks')
    .select(`
      id,
      plan_id,
      status,
      plan_tasks (
        description
      ),
      maintenance_plans (
        site_id,
        sites ( type )
      )
    `)
    .eq('id', scheduledTaskId)
    .eq('org_id', identity.orgId)
    .single()

  if (fetchError || !scheduledTask) {
    redirect('/calendar')
  }

  const rawTask = scheduledTask as unknown as {
    id: string
    plan_id: string
    status: string
    plan_tasks: { description: string } | null
    maintenance_plans: { site_id: string; sites: { type: string } | null } | null
  }

  const siteId = rawTask.maintenance_plans?.site_id
  const siteType = rawTask.maintenance_plans?.sites?.type
  const taskDescription = rawTask.plan_tasks?.description ?? 'Tarea programada'

  if (!siteId) {
    redirect('/calendar')
  }

  // Derive maintenance type from site type
  const maintenanceType: MaintenanceType = siteType === 'diesel' ? 'diesel_prev' : 'pv_prev'

  // Create maintenance record
  const { data: newRecord, error: createError } = await supabase
    .from('maintenance_records')
    .insert({
      org_id: identity.orgId,
      site_id: siteId,
      type: maintenanceType,
      visit_date: todayIso(),
      responsible_id: identity.userId,
      status: 'draft' as RecordStatus,
      observations: `Tarea programada: ${taskDescription}`,
    })
    .select('id')
    .single()

  if (createError || !newRecord) {
    console.error('[createRecordFromScheduledTask] create record', createError)
    redirect('/calendar')
  }

  // Update scheduled task to completed
  await supabase
    .from('scheduled_tasks')
    .update({
      status: 'completed' as ScheduledTaskStatus,
      completed_date: todayIso(),
      completed_by: identity.userId,
      maintenance_record_id: newRecord.id,
    })
    .eq('id', scheduledTaskId)
    .eq('org_id', identity.orgId)

  await logAudit({
    orgId: identity.orgId,
    userId: identity.userId,
    action: 'create',
    entityType: 'maintenance_record',
    entityId: newRecord.id,
    metadata: { source: 'scheduled_task', scheduled_task_id: scheduledTaskId },
  })

  await logAudit({
    orgId: identity.orgId,
    userId: identity.userId,
    action: 'complete',
    entityType: 'scheduled_task',
    entityId: scheduledTaskId,
    metadata: { maintenance_record_id: newRecord.id },
  })

  revalidatePath('/maintenance')
  revalidatePath('/calendar')
  redirect('/maintenance/' + newRecord.id)
}

// ------------------------------------------------------------------
// getComplianceStats
// ------------------------------------------------------------------

export async function getComplianceStats(
  planId: string,
  year: number,
  month: number
): Promise<ActionResult<ComplianceStats>> {
  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)
  if (!identity) return { success: false, error: 'No autenticado' }

  const range = monthRange(year, month)

  const { data, error } = await supabase
    .from('scheduled_tasks')
    .select('status')
    .eq('org_id', identity.orgId)
    .eq('plan_id', planId)
    .gte('scheduled_date', range.start)
    .lte('scheduled_date', range.end)

  if (error) {
    console.error('[getComplianceStats]', error)
    return { success: false, error: error.message }
  }

  const rows = (data ?? []) as { status: string }[]

  let completed = 0
  let pending = 0
  let overdue = 0
  let skipped = 0

  for (const row of rows) {
    switch (row.status as ScheduledTaskStatus) {
      case 'completed': completed++; break
      case 'pending': pending++; break
      case 'overdue': overdue++; break
      case 'skipped': skipped++; break
    }
  }

  const total = rows.length
  const denominator = total - skipped
  const compliancePercent = denominator > 0
    ? Math.round((completed / denominator) * 100)
    : 0

  return {
    success: true,
    data: { total, completed, pending, overdue, skipped, compliancePercent },
  }
}

// ------------------------------------------------------------------
// generatePlanSchedule (TypeScript replacement for DB RPC)
// ------------------------------------------------------------------

/**
 * Generates scheduled_tasks rows for a plan based on task frequencies.
 *
 * Scheduling rules (calendar-aligned):
 *   frequency_months = N  →  tasks in months where month % N === 0
 *   Monthly  (1):  every month (1–12)
 *   Quarterly(3):  Mar, Jun, Sep, Dec
 *   Quad.    (4):  Apr, Aug, Dec
 *   Semestral(6):  Jun, Dec
 *   Annual  (12):  Dec
 *
 * Preserves completed / skipped rows; regenerates pending / overdue.
 */
export async function generatePlanSchedule(
  planId: string
): Promise<ActionResult<{ count: number }>> {
  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)
  if (!identity) return { success: false, error: 'No autenticado' }

  // 1. Get plan details
  const { data: plan } = await supabase
    .from('maintenance_plans')
    .select('id, org_id, start_date, end_date')
    .eq('id', planId)
    .eq('org_id', identity.orgId)
    .single()

  if (!plan) return { success: false, error: 'Plan no encontrado' }

  // 2. Get active plan tasks
  const { data: planTasks } = await supabase
    .from('plan_tasks')
    .select('id, frequency_months, frequency_type')
    .eq('plan_id', planId)
    .eq('is_active', true)

  if (!planTasks?.length) return { success: true, data: { count: 0 } }

  // 3. Collect existing completed/skipped keys to avoid duplicates
  const { data: existingTasks } = await supabase
    .from('scheduled_tasks')
    .select('plan_task_id, scheduled_date')
    .eq('plan_id', planId)
    .in('status', ['completed', 'skipped'])

  const existingKeys = new Set<string>()
  for (const et of existingTasks || []) {
    existingKeys.add(`${et.plan_task_id}_${et.scheduled_date}`)
  }

  // 4. Delete pending/overdue rows (will be regenerated)
  await supabase
    .from('scheduled_tasks')
    .delete()
    .eq('plan_id', planId)
    .in('status', ['pending', 'overdue'])

  // 5. Calculate date range
  const startDateStr = plan.start_date as string
  const endDateFallback = (() => {
    const d = new Date(startDateStr + 'T00:00:00')
    d.setFullYear(d.getFullYear() + 1)
    return d.toISOString().slice(0, 10)
  })()
  const endDateStr = (plan.end_date as string | null) ?? endDateFallback
  const today = todayIso()

  const startYear = parseInt(startDateStr.slice(0, 4), 10)
  const endYear = parseInt(endDateStr.slice(0, 4), 10)

  // 6. Build insert rows
  const inserts: Array<{
    org_id: string
    plan_task_id: string
    plan_id: string
    scheduled_date: string
    due_date: string
    status: string
  }> = []

  for (const task of planTasks) {
    const freq = task.frequency_months as number | null
    const ftype = task.frequency_type as string

    if (ftype !== 'fixed' || !freq || freq <= 0) continue

    if (freq <= 12) {
      // Calendar-aligned: generate for months where month % freq === 0
      for (let year = startYear; year <= endYear; year++) {
        for (let month = 1; month <= 12; month++) {
          if (month % freq !== 0) continue

          const scheduledDate = `${year}-${String(month).padStart(2, '0')}-01`

          // Must be within plan range
          if (scheduledDate < startDateStr || scheduledDate > endDateStr) continue

          // Skip if already completed/skipped for this date
          const key = `${task.id}_${scheduledDate}`
          if (existingKeys.has(key)) continue

          const dueObj = new Date(scheduledDate + 'T00:00:00')
          dueObj.setDate(dueObj.getDate() + 7)
          const dueDate = dueObj.toISOString().slice(0, 10)
          const status: ScheduledTaskStatus = dueDate < today ? 'overdue' : 'pending'

          inserts.push({
            org_id: plan.org_id as string,
            plan_task_id: task.id as string,
            plan_id: planId,
            scheduled_date: scheduledDate,
            due_date: dueDate,
            status,
          })
        }
      }
    } else {
      // Frequencies > 12 months: step from plan start every N months
      const cursor = new Date(startDateStr + 'T00:00:00')
      cursor.setMonth(cursor.getMonth() + freq)

      while (cursor.toISOString().slice(0, 10) <= endDateStr) {
        const scheduledDate = cursor.toISOString().slice(0, 10)
        const key = `${task.id}_${scheduledDate}`

        if (!existingKeys.has(key)) {
          const dueObj = new Date(cursor)
          dueObj.setDate(dueObj.getDate() + 7)
          const dueDate = dueObj.toISOString().slice(0, 10)
          const status: ScheduledTaskStatus = dueDate < today ? 'overdue' : 'pending'

          inserts.push({
            org_id: plan.org_id as string,
            plan_task_id: task.id as string,
            plan_id: planId,
            scheduled_date: scheduledDate,
            due_date: dueDate,
            status,
          })
        }

        cursor.setMonth(cursor.getMonth() + freq)
      }
    }
  }

  if (inserts.length === 0) return { success: true, data: { count: 0 } }

  // 7. Batch insert (Supabase supports up to 1000 rows per insert)
  let totalInserted = 0
  const BATCH_SIZE = 500
  for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
    const batch = inserts.slice(i, i + BATCH_SIZE)
    const { error } = await supabase
      .from('scheduled_tasks')
      .insert(batch)

    if (error) {
      console.error('[generatePlanSchedule] batch insert error', error)
      return { success: false, error: error.message }
    }
    totalInserted += batch.length
  }

  return { success: true, data: { count: totalInserted } }
}

// ------------------------------------------------------------------
// rescheduleTask
// ------------------------------------------------------------------

export async function rescheduleTask(
  scheduledTaskId: string,
  newDate: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)
  if (!identity) return { success: false, error: 'No autenticado' }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
    return { success: false, error: 'Formato de fecha invalido' }
  }

  // Verify task belongs to org and is reschedulable
  const { data: task, error: fetchError } = await supabase
    .from('scheduled_tasks')
    .select('id, plan_id, status')
    .eq('id', scheduledTaskId)
    .eq('org_id', identity.orgId)
    .single()

  if (fetchError || !task) {
    return { success: false, error: 'Tarea programada no encontrada' }
  }

  if (task.status === 'completed') {
    return { success: false, error: 'No se puede reprogramar una tarea completada' }
  }

  // Calculate due_date: newDate + 7 days
  const scheduled = new Date(newDate)
  const due = new Date(scheduled)
  due.setDate(due.getDate() + 7)
  const dueDateStr = due.toISOString().slice(0, 10)

  // Determine new status
  const todayStr = todayIso()
  const newStatus = dueDateStr < todayStr ? 'overdue' : 'pending'

  const { error: updateError } = await supabase
    .from('scheduled_tasks')
    .update({
      scheduled_date: newDate,
      due_date: dueDateStr,
      status: newStatus,
    })
    .eq('id', scheduledTaskId)
    .eq('org_id', identity.orgId)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  await logAudit({
    orgId: identity.orgId,
    userId: identity.userId,
    action: 'reschedule',
    entityType: 'scheduled_task',
    entityId: scheduledTaskId,
    metadata: { new_date: newDate },
  })

  revalidatePath('/plans/' + task.plan_id)
  revalidatePath('/calendar')
  return { success: true }
}
