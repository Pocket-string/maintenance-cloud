'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { assertNotDemo } from '@/lib/demo-guard'
import type { MaintenanceType, ChecklistItemType } from '@/types/database'

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

type ActionResult<T = void> = { success: true; data?: T } | { success: false; error: string }

export interface ChecklistItemWithResponse {
  id: string
  label: string
  order_index: number
  item_type: ChecklistItemType
  options: string[] | null
  required: boolean
  response?: {
    id: string
    value: string
    note: string | null
  }
}

export interface ChecklistResult {
  items: ChecklistItemWithResponse[]
  source: 'task' | 'template'
  taskDescription?: string
}

// ------------------------------------------------------------------
// Helper
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
// getChecklistForRecord — fetches task-specific or template items + existing responses
// ------------------------------------------------------------------

export async function getChecklistForRecord(
  recordId: string,
  maintenanceType: MaintenanceType
): Promise<ActionResult<ChecklistResult>> {
  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)
  if (!identity) return { success: false, error: 'No autenticado' }

  // 1. Check if this record came from a scheduled task with a plan_task
  const { data: scheduledTask } = await supabase
    .from('scheduled_tasks')
    .select('plan_task_id, plan_tasks(description)')
    .eq('maintenance_record_id', recordId)
    .limit(1)
    .maybeSingle()

  const planTaskId = scheduledTask?.plan_task_id as string | null
  const taskDescription = (scheduledTask?.plan_tasks as unknown as { description: string } | null)?.description

  // 2. If plan_task exists, try to load task-specific checklist items
  if (planTaskId) {
    const { data: taskItems } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('plan_task_id', planTaskId)
      .order('order_index')

    if (taskItems && taskItems.length > 0) {
      // Load responses for these items
      const itemIds = taskItems.map(i => i.id as string)
      const { data: responses } = await supabase
        .from('checklist_responses')
        .select('*')
        .eq('record_id', recordId)
        .in('item_id', itemIds)

      const responseMap = new Map(
        (responses || []).map(r => [r.item_id, { id: r.id, value: r.value, note: r.note }])
      )

      const items: ChecklistItemWithResponse[] = taskItems.map(item => ({
        id: item.id as string,
        label: item.label as string,
        order_index: item.order_index as number,
        item_type: item.item_type as ChecklistItemType,
        options: item.options as string[] | null,
        required: item.required as boolean,
        response: responseMap.get(item.id as string) as { id: string; value: string; note: string | null } | undefined,
      }))

      return { success: true, data: { items, source: 'task', taskDescription: taskDescription ?? undefined } }
    }
    // If no task-specific items, fall through to generic template
  }

  // 3. Generic template path (existing logic, backward compatible)
  const { data: template } = await supabase
    .from('checklist_templates')
    .select('id')
    .or(`org_id.eq.${identity.orgId},org_id.is.null`)
    .eq('type', maintenanceType)
    .eq('is_active', true)
    .order('org_id', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (!template) {
    return { success: true, data: { items: [], source: planTaskId ? 'task' : 'template', taskDescription: taskDescription ?? undefined } }
  }

  // Get template items
  const { data: items } = await supabase
    .from('checklist_items')
    .select('*')
    .eq('template_id', template.id)
    .order('order_index')

  if (!items) return { success: true, data: { items: [], source: 'template' } }

  // Get existing responses for this record
  const itemIds = items.map(i => i.id)
  const { data: responses } = await supabase
    .from('checklist_responses')
    .select('*')
    .eq('record_id', recordId)
    .in('item_id', itemIds)

  const responseMap = new Map(
    (responses || []).map(r => [r.item_id, { id: r.id, value: r.value, note: r.note }])
  )

  const result: ChecklistItemWithResponse[] = items.map(item => ({
    id: item.id as string,
    label: item.label as string,
    order_index: item.order_index as number,
    item_type: item.item_type as ChecklistItemType,
    options: item.options as string[] | null,
    required: item.required as boolean,
    response: responseMap.get(item.id as string) as { id: string; value: string; note: string | null } | undefined,
  }))

  return { success: true, data: { items: result, source: 'template' } }
}

// ------------------------------------------------------------------
// saveChecklistResponses — upserts all responses for a record
// ------------------------------------------------------------------

const responseSchema = z.object({
  item_id: z.string().uuid(),
  value: z.string(),
  note: z.string().optional().nullable(),
})

export async function saveChecklistResponses(
  recordId: string,
  responses: Array<{ item_id: string; value: string; note?: string | null }>
): Promise<ActionResult> {
  await assertNotDemo()

  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)
  if (!identity) return { success: false, error: 'No autenticado' }

  // Validate record belongs to org
  const { data: record } = await supabase
    .from('maintenance_records')
    .select('id')
    .eq('id', recordId)
    .eq('org_id', identity.orgId)
    .single()

  if (!record) return { success: false, error: 'Registro no encontrado' }

  // Validate responses
  for (const resp of responses) {
    const parsed = responseSchema.safeParse(resp)
    if (!parsed.success) {
      return { success: false, error: `Respuesta invalida: ${JSON.stringify(parsed.error.flatten().fieldErrors)}` }
    }
  }

  // Delete existing responses for this record, then insert new ones
  await supabase
    .from('checklist_responses')
    .delete()
    .eq('record_id', recordId)

  if (responses.length > 0) {
    const rows = responses.map(r => ({
      record_id: recordId,
      item_id: r.item_id,
      value: r.value,
      note: r.note || null,
    }))

    const { error } = await supabase
      .from('checklist_responses')
      .insert(rows)

    if (error) return { success: false, error: error.message }
  }

  revalidatePath(`/maintenance/${recordId}`)
  return { success: true }
}
