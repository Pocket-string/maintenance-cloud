'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/actions/audit'
import { assertNotDemo } from '@/lib/demo-guard'
import type { FrequencyType, PlanCategory, PlanTask } from '@/types/database'

// ------------------------------------------------------------------
// Return types
// ------------------------------------------------------------------

type ActionResult<T = void> = { success: true; data?: T } | { success: false; error: string }

// ------------------------------------------------------------------
// Validation
// ------------------------------------------------------------------

const FREQUENCY_TYPES: [FrequencyType, ...FrequencyType[]] = ['fixed', 'special']

const addTaskSchema = z.object({
  description: z.string().min(1, { message: 'La descripcion es requerida' }).max(500, { message: 'La descripcion no puede superar 500 caracteres' }),
  frequencyMonths: z.number().int().positive().optional().nullable(),
  frequencyType: z.enum(FREQUENCY_TYPES, { message: 'Tipo de frecuencia invalido' }),
  frequencyDetail: z.string().max(200).optional().nullable(),
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
// Helper: verify plan belongs to org
// ------------------------------------------------------------------

async function verifyPlanOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  planId: string,
  orgId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('maintenance_plans')
    .select('id')
    .eq('id', planId)
    .eq('org_id', orgId)
    .single()

  return data !== null
}

// ------------------------------------------------------------------
// addCategoryToPlan
// ------------------------------------------------------------------

export async function addCategoryToPlan(
  planId: string,
  name: string
): Promise<ActionResult<PlanCategory>> {
  await assertNotDemo()

  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)
  if (!identity) return { success: false, error: 'No autenticado' }

  const planExists = await verifyPlanOwnership(supabase, planId, identity.orgId)
  if (!planExists) {
    return { success: false, error: 'Plan no encontrado o no pertenece a tu organizacion' }
  }

  const trimmedName = name.trim()
  if (!trimmedName) {
    return { success: false, error: 'El nombre de la categoria es requerido' }
  }

  // Get next order_index
  const { data: existing } = await supabase
    .from('plan_categories')
    .select('order_index')
    .eq('plan_id', planId)
    .order('order_index', { ascending: false })
    .limit(1)
    .single()

  const nextIndex = existing ? (existing.order_index ?? 0) + 1 : 0

  const { data: newCategory, error } = await supabase
    .from('plan_categories')
    .insert({
      plan_id: planId,
      name: trimmedName,
      order_index: nextIndex,
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  await logAudit({
    orgId: identity.orgId,
    userId: identity.userId,
    action: 'create',
    entityType: 'plan_category',
    entityId: newCategory.id,
    metadata: { plan_id: planId, name: trimmedName },
  })

  revalidatePath(`/plans/${planId}`)
  return { success: true, data: newCategory as PlanCategory }
}

// ------------------------------------------------------------------
// updateCategory
// ------------------------------------------------------------------

export async function updateCategory(
  categoryId: string,
  name: string
): Promise<ActionResult> {
  await assertNotDemo()

  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)
  if (!identity) return { success: false, error: 'No autenticado' }

  // Verify category belongs to a plan that belongs to org
  const { data: category } = await supabase
    .from('plan_categories')
    .select('id, plan_id, maintenance_plans!inner(org_id)')
    .eq('id', categoryId)
    .single()

  if (!category) {
    return { success: false, error: 'Categoria no encontrada' }
  }

  const categoryWithPlan = category as unknown as { plan_id: string; maintenance_plans: { org_id: string } | null }

  if (categoryWithPlan.maintenance_plans?.org_id !== identity.orgId) {
    return { success: false, error: 'Categoria no pertenece a tu organizacion' }
  }

  const trimmedName = name.trim()
  if (!trimmedName) {
    return { success: false, error: 'El nombre de la categoria es requerido' }
  }

  const { error } = await supabase
    .from('plan_categories')
    .update({ name: trimmedName })
    .eq('id', categoryId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(`/plans/${categoryWithPlan.plan_id}`)
  return { success: true }
}

// ------------------------------------------------------------------
// deleteCategory
// ------------------------------------------------------------------

export async function deleteCategory(categoryId: string): Promise<ActionResult> {
  await assertNotDemo()

  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)
  if (!identity) return { success: false, error: 'No autenticado' }

  const { data: category } = await supabase
    .from('plan_categories')
    .select('id, plan_id, maintenance_plans!inner(org_id)')
    .eq('id', categoryId)
    .single()

  if (!category) {
    return { success: false, error: 'Categoria no encontrada' }
  }

  const categoryWithPlan = category as unknown as { plan_id: string; maintenance_plans: { org_id: string } | null }

  if (categoryWithPlan.maintenance_plans?.org_id !== identity.orgId) {
    return { success: false, error: 'Categoria no pertenece a tu organizacion' }
  }

  const { error } = await supabase
    .from('plan_categories')
    .delete()
    .eq('id', categoryId)

  if (error) {
    return { success: false, error: error.message }
  }

  await logAudit({
    orgId: identity.orgId,
    userId: identity.userId,
    action: 'delete',
    entityType: 'plan_category',
    entityId: categoryId,
    metadata: { plan_id: categoryWithPlan.plan_id },
  })

  revalidatePath(`/plans/${categoryWithPlan.plan_id}`)
  return { success: true }
}

// ------------------------------------------------------------------
// addTaskToPlan
// ------------------------------------------------------------------

export async function addTaskToPlan(
  planId: string,
  categoryId: string,
  task: {
    description: string
    frequencyMonths?: number | null
    frequencyType: FrequencyType
    frequencyDetail?: string | null
  }
): Promise<ActionResult<PlanTask>> {
  await assertNotDemo()

  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)
  if (!identity) return { success: false, error: 'No autenticado' }

  const parsed = addTaskSchema.safeParse(task)
  if (!parsed.success) {
    const firstError = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0]
    return { success: false, error: firstError ?? 'Datos de tarea invalidos' }
  }

  const planExists = await verifyPlanOwnership(supabase, planId, identity.orgId)
  if (!planExists) {
    return { success: false, error: 'Plan no encontrado o no pertenece a tu organizacion' }
  }

  // Get next order_index for the category
  const { data: existing } = await supabase
    .from('plan_tasks')
    .select('order_index')
    .eq('category_id', categoryId)
    .order('order_index', { ascending: false })
    .limit(1)
    .single()

  const nextIndex = existing ? (existing.order_index ?? 0) + 1 : 0

  const { data: newTask, error } = await supabase
    .from('plan_tasks')
    .insert({
      plan_id: planId,
      category_id: categoryId,
      description: parsed.data.description,
      frequency_months: parsed.data.frequencyMonths ?? null,
      frequency_type: parsed.data.frequencyType,
      frequency_detail: parsed.data.frequencyDetail ?? null,
      order_index: nextIndex,
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  await logAudit({
    orgId: identity.orgId,
    userId: identity.userId,
    action: 'create',
    entityType: 'plan_task',
    entityId: newTask.id,
    metadata: { plan_id: planId, category_id: categoryId },
  })

  revalidatePath(`/plans/${planId}`)
  return { success: true, data: newTask as PlanTask }
}

// ------------------------------------------------------------------
// updatePlanTask
// ------------------------------------------------------------------

export async function updatePlanTask(
  taskId: string,
  data: Partial<{
    description: string
    frequencyMonths: number | null
    frequencyType: FrequencyType
    frequencyDetail: string | null
    isActive: boolean
  }>
): Promise<ActionResult> {
  await assertNotDemo()

  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)
  if (!identity) return { success: false, error: 'No autenticado' }

  // Verify task belongs to a plan in org
  const { data: task } = await supabase
    .from('plan_tasks')
    .select('id, plan_id, maintenance_plans!inner(org_id)')
    .eq('id', taskId)
    .single()

  if (!task) {
    return { success: false, error: 'Tarea no encontrada' }
  }

  const taskWithPlan = task as unknown as { plan_id: string; maintenance_plans: { org_id: string } | null }

  if (taskWithPlan.maintenance_plans?.org_id !== identity.orgId) {
    return { success: false, error: 'Tarea no pertenece a tu organizacion' }
  }

  // Map camelCase input to snake_case DB columns
  const updatePayload: Record<string, unknown> = {}
  if (data.description !== undefined) updatePayload.description = data.description
  if (data.frequencyMonths !== undefined) updatePayload.frequency_months = data.frequencyMonths
  if (data.frequencyType !== undefined) updatePayload.frequency_type = data.frequencyType
  if (data.frequencyDetail !== undefined) updatePayload.frequency_detail = data.frequencyDetail
  if (data.isActive !== undefined) updatePayload.is_active = data.isActive

  if (Object.keys(updatePayload).length === 0) {
    return { success: false, error: 'No se proporcionaron campos para actualizar' }
  }

  const { error } = await supabase
    .from('plan_tasks')
    .update(updatePayload)
    .eq('id', taskId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(`/plans/${taskWithPlan.plan_id}`)
  return { success: true }
}

// ------------------------------------------------------------------
// deletePlanTask
// ------------------------------------------------------------------

export async function deletePlanTask(taskId: string): Promise<ActionResult> {
  await assertNotDemo()

  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)
  if (!identity) return { success: false, error: 'No autenticado' }

  const { data: task } = await supabase
    .from('plan_tasks')
    .select('id, plan_id, maintenance_plans!inner(org_id)')
    .eq('id', taskId)
    .single()

  if (!task) {
    return { success: false, error: 'Tarea no encontrada' }
  }

  const taskWithPlan = task as unknown as { plan_id: string; maintenance_plans: { org_id: string } | null }

  if (taskWithPlan.maintenance_plans?.org_id !== identity.orgId) {
    return { success: false, error: 'Tarea no pertenece a tu organizacion' }
  }

  const { error } = await supabase
    .from('plan_tasks')
    .delete()
    .eq('id', taskId)

  if (error) {
    return { success: false, error: error.message }
  }

  await logAudit({
    orgId: identity.orgId,
    userId: identity.userId,
    action: 'delete',
    entityType: 'plan_task',
    entityId: taskId,
    metadata: { plan_id: taskWithPlan.plan_id },
  })

  revalidatePath(`/plans/${taskWithPlan.plan_id}`)
  return { success: true }
}
