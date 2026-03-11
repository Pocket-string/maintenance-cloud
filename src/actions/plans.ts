'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/actions/audit'
import { assertNotDemo } from '@/lib/demo-guard'
import { generatePlanSchedule } from '@/actions/scheduled-tasks'
import type { PlanStatus, MaintenancePlan, PlanCategory, PlanTask, UserRole } from '@/types/database'

// ------------------------------------------------------------------
// Return types
// ------------------------------------------------------------------

type ActionResult<T = void> = { success: true; data?: T } | { success: false; error: string }

export interface MaintenancePlanWithSite extends MaintenancePlan {
  site_name: string
}

export interface PlanTaskWithCategory extends PlanTask {
  category_name: string
}

export interface PlanCategoryWithTasks extends PlanCategory {
  tasks: PlanTask[]
}

export interface MaintenancePlanDetail extends MaintenancePlan {
  site_name: string
  categories: PlanCategoryWithTasks[]
}

// ------------------------------------------------------------------
// Validation
// ------------------------------------------------------------------

const PLAN_STATUSES: [PlanStatus, ...PlanStatus[]] = ['draft', 'active', 'paused', 'archived']

const createPlanSchema = z.object({
  site_id: z.string().uuid({ message: 'Sitio es requerido' }),
  name: z.string().min(1, { message: 'El nombre es requerido' }).max(200, { message: 'El nombre no puede superar 200 caracteres' }),
  description: z.string().max(1000, { message: 'La descripcion no puede superar 1000 caracteres' }).optional().nullable(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Fecha de inicio debe ser YYYY-MM-DD' }),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Fecha de termino debe ser YYYY-MM-DD' }).optional().nullable(),
})

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
// getMaintenancePlans
// ------------------------------------------------------------------

export async function getMaintenancePlans(
  filters?: { siteId?: string; status?: PlanStatus }
): Promise<ActionResult<MaintenancePlanWithSite[]>> {
  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)
  if (!identity) return { success: false, error: 'No autenticado' }

  let query = supabase
    .from('maintenance_plans')
    .select('*, sites(name)')
    .eq('org_id', identity.orgId)
    .order('created_at', { ascending: false })

  if (filters?.siteId) query = query.eq('site_id', filters.siteId)
  if (filters?.status) query = query.eq('status', filters.status)

  const { data, error } = await query

  if (error) {
    console.error('[getMaintenancePlans]', error)
    return { success: false, error: error.message }
  }

  const plans: MaintenancePlanWithSite[] = (data ?? []).map(row => {
    const { sites, ...plan } = row as MaintenancePlan & {
      sites: { name: string } | null
    }
    return {
      ...plan,
      site_name: sites?.name ?? '',
    }
  })

  return { success: true, data: plans }
}

// ------------------------------------------------------------------
// getMaintenancePlanById
// ------------------------------------------------------------------

export async function getMaintenancePlanById(
  planId: string
): Promise<ActionResult<MaintenancePlanDetail>> {
  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)
  if (!identity) return { success: false, error: 'No autenticado' }

  const { data: planData, error: planError } = await supabase
    .from('maintenance_plans')
    .select('*, sites(name)')
    .eq('id', planId)
    .eq('org_id', identity.orgId)
    .single()

  if (planError) {
    if (planError.code === 'PGRST116') return { success: false, error: 'Plan no encontrado' }
    return { success: false, error: planError.message }
  }

  const { data: categoriesData, error: categoriesError } = await supabase
    .from('plan_categories')
    .select('*')
    .eq('plan_id', planId)
    .order('order_index', { ascending: true })

  if (categoriesError) {
    console.error('[getMaintenancePlanById] categories', categoriesError)
    return { success: false, error: categoriesError.message }
  }

  const { data: tasksData, error: tasksError } = await supabase
    .from('plan_tasks')
    .select('*')
    .eq('plan_id', planId)
    .order('order_index', { ascending: true })

  if (tasksError) {
    console.error('[getMaintenancePlanById] tasks', tasksError)
    return { success: false, error: tasksError.message }
  }

  const tasksByCategory = new Map<string, PlanTask[]>()
  for (const task of (tasksData ?? []) as PlanTask[]) {
    const bucket = tasksByCategory.get(task.category_id) ?? []
    bucket.push(task)
    tasksByCategory.set(task.category_id, bucket)
  }

  const categories: PlanCategoryWithTasks[] = (categoriesData ?? []).map(cat => ({
    ...(cat as PlanCategory),
    tasks: tasksByCategory.get(cat.id) ?? [],
  }))

  const { sites, ...plan } = planData as MaintenancePlan & {
    sites: { name: string } | null
  }

  return {
    success: true,
    data: {
      ...plan,
      site_name: sites?.name ?? '',
      categories,
    },
  }
}

// ------------------------------------------------------------------
// createMaintenancePlan (useActionState compatible)
// ------------------------------------------------------------------

export interface CreatePlanState {
  error?: string
  fieldErrors?: Record<string, string>
}

export async function createMaintenancePlan(
  _prevState: CreatePlanState,
  formData: FormData
): Promise<CreatePlanState> {
  try {
    await assertNotDemo()
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Accion no permitida en modo demo' }
  }

  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)

  if (!identity) {
    return { error: 'No autenticado. Por favor inicia sesion.' }
  }

  const raw = {
    site_id: formData.get('site_id') as string,
    name: (formData.get('name') as string)?.trim(),
    description: (formData.get('description') as string)?.trim() || null,
    start_date: formData.get('start_date') as string,
    end_date: (formData.get('end_date') as string) || null,
  }

  const parsed = createPlanSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const [key, messages] of Object.entries(parsed.error.flatten().fieldErrors)) {
      fieldErrors[key] = messages?.[0] ?? 'Campo invalido'
    }
    return { fieldErrors }
  }

  // Verify site belongs to org
  const { data: site } = await supabase
    .from('sites')
    .select('id')
    .eq('id', parsed.data.site_id)
    .eq('org_id', identity.orgId)
    .single()

  if (!site) {
    return { error: 'Sitio no encontrado o no pertenece a tu organizacion' }
  }

  const { data: newPlan, error } = await supabase
    .from('maintenance_plans')
    .insert({
      org_id: identity.orgId,
      site_id: parsed.data.site_id,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date ?? null,
      status: 'draft' as PlanStatus,
      created_by: identity.userId,
    })
    .select('id')
    .single()

  if (error) {
    return { error: `Error al crear plan: ${error.message}` }
  }

  await logAudit({
    orgId: identity.orgId,
    userId: identity.userId,
    action: 'create',
    entityType: 'maintenance_plan',
    entityId: newPlan.id,
    metadata: { name: parsed.data.name, site_id: parsed.data.site_id },
  })

  revalidatePath('/plans')
  redirect('/plans/' + newPlan.id)
}

// ------------------------------------------------------------------
// activatePlan
// ------------------------------------------------------------------

export async function activatePlan(
  planId: string
): Promise<ActionResult<{ generatedTasks: number }>> {
  await assertNotDemo()

  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)
  if (!identity) return { success: false, error: 'No autenticado' }

  const { data: plan, error: fetchError } = await supabase
    .from('maintenance_plans')
    .select('id, status')
    .eq('id', planId)
    .eq('org_id', identity.orgId)
    .single()

  if (fetchError || !plan) {
    return { success: false, error: 'Plan no encontrado' }
  }

  if (plan.status !== 'draft' && plan.status !== 'paused') {
    return { success: false, error: 'El plan debe estar en borrador o pausado para ser activado' }
  }

  const { error: updateError } = await supabase
    .from('maintenance_plans')
    .update({ status: 'active' as PlanStatus })
    .eq('id', planId)
    .eq('org_id', identity.orgId)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  const scheduleResult = await generatePlanSchedule(planId)
  const generatedTasks = scheduleResult.success ? (scheduleResult.data?.count ?? 0) : 0

  if (!scheduleResult.success) {
    console.error('[activatePlan] generatePlanSchedule', scheduleResult.error)
  }

  await logAudit({
    orgId: identity.orgId,
    userId: identity.userId,
    action: 'activate',
    entityType: 'maintenance_plan',
    entityId: planId,
    metadata: { previous_status: plan.status },
  })

  revalidatePath('/plans')
  revalidatePath('/calendar')
  return { success: true, data: { generatedTasks } }
}

// ------------------------------------------------------------------
// updatePlanStatus
// ------------------------------------------------------------------

const VALID_TRANSITIONS: Record<PlanStatus, PlanStatus[]> = {
  draft: ['active', 'archived'],
  active: ['paused', 'archived'],
  paused: ['active', 'archived'],
  archived: [],
}

export async function updatePlanStatus(
  planId: string,
  newStatus: PlanStatus
): Promise<ActionResult> {
  await assertNotDemo()

  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)
  if (!identity) return { success: false, error: 'No autenticado' }

  const { data: plan, error: fetchError } = await supabase
    .from('maintenance_plans')
    .select('id, status')
    .eq('id', planId)
    .eq('org_id', identity.orgId)
    .single()

  if (fetchError || !plan) {
    return { success: false, error: 'Plan no encontrado' }
  }

  const currentStatus = plan.status as PlanStatus
  const allowed = VALID_TRANSITIONS[currentStatus] ?? []

  if (!allowed.includes(newStatus)) {
    return {
      success: false,
      error: `Transicion invalida: ${currentStatus} → ${newStatus}`,
    }
  }

  const { error: updateError } = await supabase
    .from('maintenance_plans')
    .update({ status: newStatus })
    .eq('id', planId)
    .eq('org_id', identity.orgId)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  if (newStatus === 'active') {
    const scheduleResult = await generatePlanSchedule(planId)
    if (!scheduleResult.success) {
      console.error('[updatePlanStatus] generatePlanSchedule', scheduleResult.error)
    }
  }

  await logAudit({
    orgId: identity.orgId,
    userId: identity.userId,
    action: `status_change_to_${newStatus}`,
    entityType: 'maintenance_plan',
    entityId: planId,
    metadata: { previous_status: currentStatus, new_status: newStatus },
  })

  revalidatePath('/plans')
  revalidatePath(`/plans/${planId}`)
  return { success: true }
}

// ------------------------------------------------------------------
// regenerateSchedule — re-trigger schedule generation for active plan
// ------------------------------------------------------------------

export async function regenerateSchedule(
  planId: string
): Promise<ActionResult<{ generatedTasks: number }>> {
  await assertNotDemo()

  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)
  if (!identity) return { success: false, error: 'No autenticado' }

  const { data: plan } = await supabase
    .from('maintenance_plans')
    .select('id, status')
    .eq('id', planId)
    .eq('org_id', identity.orgId)
    .single()

  if (!plan) return { success: false, error: 'Plan no encontrado' }
  if (plan.status !== 'active') {
    return { success: false, error: 'Solo se puede regenerar el calendario de planes activos' }
  }

  const result = await generatePlanSchedule(planId)

  if (result.success) {
    await logAudit({
      orgId: identity.orgId,
      userId: identity.userId,
      action: 'regenerate_schedule',
      entityType: 'maintenance_plan',
      entityId: planId,
      metadata: { generated_tasks: result.data?.count ?? 0 },
    })

    revalidatePath('/plans/' + planId)
    revalidatePath('/calendar')
  }

  return result.success
    ? { success: true, data: { generatedTasks: result.data?.count ?? 0 } }
    : { success: false, error: result.error }
}

// ------------------------------------------------------------------
// deletePlan
// ------------------------------------------------------------------

const ADMIN_ROLES: UserRole[] = ['owner', 'admin']

export async function deletePlan(planId: string): Promise<ActionResult> {
  await assertNotDemo()

  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)
  if (!identity) return { success: false, error: 'No autenticado' }

  // Verify plan exists, belongs to org, and is in draft status
  const { data: plan, error: fetchError } = await supabase
    .from('maintenance_plans')
    .select('id, status')
    .eq('id', planId)
    .eq('org_id', identity.orgId)
    .single()

  if (fetchError || !plan) {
    return { success: false, error: 'Plan no encontrado' }
  }

  if (plan.status !== 'draft') {
    return { success: false, error: 'Solo se pueden eliminar planes en estado borrador' }
  }

  // Verify user has owner or admin role
  const { data: membership, error: memberError } = await supabase
    .from('organization_members')
    .select('role')
    .eq('org_id', identity.orgId)
    .eq('user_id', identity.userId)
    .single()

  if (memberError || !membership) {
    return { success: false, error: 'No se pudo verificar permisos' }
  }

  if (!ADMIN_ROLES.includes(membership.role as UserRole)) {
    return { success: false, error: 'Solo propietarios y administradores pueden eliminar planes' }
  }

  const { error: deleteError } = await supabase
    .from('maintenance_plans')
    .delete()
    .eq('id', planId)
    .eq('org_id', identity.orgId)

  if (deleteError) {
    return { success: false, error: deleteError.message }
  }

  await logAudit({
    orgId: identity.orgId,
    userId: identity.userId,
    action: 'delete',
    entityType: 'maintenance_plan',
    entityId: planId,
    metadata: {},
  })

  revalidatePath('/plans')
  return { success: true }
}
