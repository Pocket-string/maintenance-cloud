'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { ChecklistItemType } from '@/types/database'

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

type ActionResult<T = void> = { success: true; data?: T } | { success: false; error: string }

export interface TaskChecklistItem {
  id: string
  label: string
  order_index: number
  item_type: ChecklistItemType
  options: string[] | null
  required: boolean
}

export interface SuggestedChecklistItem {
  label: string
  item_type: ChecklistItemType
  required: boolean
  options?: string[]
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
// Helper: verify plan_task belongs to user's org
// ------------------------------------------------------------------

async function verifyTaskAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  planTaskId: string,
  orgId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('plan_tasks')
    .select('id, maintenance_plans!inner(org_id)')
    .eq('id', planTaskId)
    .limit(1)
    .maybeSingle()

  if (!data) return false
  const mp = data.maintenance_plans as unknown as { org_id: string }
  return mp.org_id === orgId
}

// ------------------------------------------------------------------
// getChecklistItemsForTask
// ------------------------------------------------------------------

export async function getChecklistItemsForTask(
  planTaskId: string
): Promise<ActionResult<TaskChecklistItem[]>> {
  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)
  if (!identity) return { success: false, error: 'No autenticado' }

  if (!(await verifyTaskAccess(supabase, planTaskId, identity.orgId))) {
    return { success: false, error: 'Tarea no encontrada' }
  }

  const { data, error } = await supabase
    .from('checklist_items')
    .select('id, label, order_index, item_type, options, required')
    .eq('plan_task_id', planTaskId)
    .order('order_index')

  if (error) return { success: false, error: error.message }

  const items: TaskChecklistItem[] = (data || []).map(row => ({
    id: row.id as string,
    label: row.label as string,
    order_index: row.order_index as number,
    item_type: row.item_type as ChecklistItemType,
    options: row.options as string[] | null,
    required: row.required as boolean,
  }))

  return { success: true, data: items }
}

// ------------------------------------------------------------------
// saveTaskChecklistItems — replaces all items for a plan_task
// ------------------------------------------------------------------

const itemSchema = z.object({
  label: z.string().min(1, 'Label requerido'),
  item_type: z.enum(['bool', 'text', 'number', 'select']),
  required: z.boolean(),
  options: z.array(z.string()).nullable().optional(),
})

export async function saveTaskChecklistItems(
  planTaskId: string,
  items: Array<{
    label: string
    item_type: ChecklistItemType
    required: boolean
    options?: string[] | null
  }>
): Promise<ActionResult> {
  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)
  if (!identity) return { success: false, error: 'No autenticado' }

  if (!(await verifyTaskAccess(supabase, planTaskId, identity.orgId))) {
    return { success: false, error: 'Tarea no encontrada' }
  }

  // Validate items
  for (const item of items) {
    const parsed = itemSchema.safeParse(item)
    if (!parsed.success) {
      return { success: false, error: `Item invalido: ${parsed.error.issues[0]?.message}` }
    }
  }

  // Delete existing task-specific items
  await supabase
    .from('checklist_items')
    .delete()
    .eq('plan_task_id', planTaskId)

  // Insert new items
  if (items.length > 0) {
    const rows = items.map((item, idx) => ({
      plan_task_id: planTaskId,
      template_id: null,
      label: item.label,
      order_index: idx,
      item_type: item.item_type,
      options: item.options || null,
      required: item.required,
    }))

    const { error } = await supabase
      .from('checklist_items')
      .insert(rows)

    if (error) return { success: false, error: error.message }
  }

  // Get plan_id for revalidation
  const { data: task } = await supabase
    .from('plan_tasks')
    .select('plan_id')
    .eq('id', planTaskId)
    .single()

  if (task) revalidatePath(`/plans/${task.plan_id}`)
  return { success: true }
}

// ------------------------------------------------------------------
// deleteTaskChecklistItem — removes a single item
// ------------------------------------------------------------------

export async function deleteTaskChecklistItem(
  itemId: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)
  if (!identity) return { success: false, error: 'No autenticado' }

  const { error } = await supabase
    .from('checklist_items')
    .delete()
    .eq('id', itemId)

  if (error) return { success: false, error: error.message }
  return { success: true }
}
