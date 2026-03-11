'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/actions/audit'
import { assertNotDemo } from '@/lib/demo-guard'
import type { MaintenanceType, RecordStatus, MaintenanceRecord, UserRole } from '@/types/database'

// ------------------------------------------------------------------
// Return types
// ------------------------------------------------------------------

type ActionResult<T = void> = { success: true; data?: T } | { success: false; error: string }

export interface MaintenanceRecordWithRelations extends MaintenanceRecord {
  site_name: string
  responsible_name: string
}

// ------------------------------------------------------------------
// Validation
// ------------------------------------------------------------------

const MAINTENANCE_TYPES: [MaintenanceType, ...MaintenanceType[]] = [
  'pv_prev',
  'diesel_prev',
  'corrective',
]

const RECORD_STATUSES: [RecordStatus, ...RecordStatus[]] = [
  'draft',
  'submitted',
  'reviewed',
  'closed',
]

const createRecordSchema = z.object({
  site_id: z.string().uuid({ message: 'Sitio es requerido' }),
  type: z.enum(MAINTENANCE_TYPES, { message: 'Tipo de mantenimiento invalido' }),
  visit_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Fecha debe ser YYYY-MM-DD' }),
  observations: z.string().max(2000).optional().nullable(),
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
// getMaintenanceRecords
// ------------------------------------------------------------------

export async function getMaintenanceRecords(
  filters?: { siteId?: string; type?: MaintenanceType; status?: RecordStatus }
): Promise<ActionResult<MaintenanceRecordWithRelations[]>> {
  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)
  if (!identity) return { success: false, error: 'No autenticado' }

  let query = supabase
    .from('maintenance_records')
    .select('*, sites(name), profiles!maintenance_records_responsible_profile_fkey(full_name)')
    .eq('org_id', identity.orgId)
    .order('visit_date', { ascending: false })

  if (filters?.siteId) query = query.eq('site_id', filters.siteId)
  if (filters?.type) query = query.eq('type', filters.type)
  if (filters?.status) query = query.eq('status', filters.status)

  const { data, error } = await query

  if (error) {
    console.error('[getMaintenanceRecords]', error)
    return { success: false, error: error.message }
  }

  const records: MaintenanceRecordWithRelations[] = (data ?? []).map(row => {
    const { sites, profiles, ...record } = row as MaintenanceRecord & {
      sites: { name: string } | null
      profiles: { full_name: string } | null
    }
    return {
      ...record,
      site_name: sites?.name ?? '',
      responsible_name: profiles?.full_name ?? '',
    }
  })

  return { success: true, data: records }
}

// ------------------------------------------------------------------
// getMaintenanceRecordById
// ------------------------------------------------------------------

export async function getMaintenanceRecordById(
  recordId: string
): Promise<ActionResult<MaintenanceRecordWithRelations>> {
  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)
  if (!identity) return { success: false, error: 'No autenticado' }

  const { data, error } = await supabase
    .from('maintenance_records')
    .select('*, sites(name), profiles!maintenance_records_responsible_profile_fkey(full_name)')
    .eq('id', recordId)
    .eq('org_id', identity.orgId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return { success: false, error: 'Registro no encontrado' }
    return { success: false, error: error.message }
  }

  const { sites, profiles, ...record } = data as MaintenanceRecord & {
    sites: { name: string } | null
    profiles: { full_name: string } | null
  }

  return {
    success: true,
    data: { ...record, site_name: sites?.name ?? '', responsible_name: profiles?.full_name ?? '' },
  }
}

// ------------------------------------------------------------------
// getAvailableScheduledTasksForSite
// ------------------------------------------------------------------

export async function getAvailableScheduledTasksForSite(
  siteId: string
): Promise<ActionResult<Array<{
  id: string
  description: string
  categoryName: string
  scheduledDate: string
  indice: string | null
  subindice: string | null
}>>> {
  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)
  if (!identity) return { success: false, error: 'No autenticado' }

  // 1. Find active plans for this site
  const { data: plans, error: plansError } = await supabase
    .from('maintenance_plans')
    .select('id')
    .eq('org_id', identity.orgId)
    .eq('site_id', siteId)
    .eq('status', 'active')

  if (plansError) {
    console.error('[getAvailableScheduledTasksForSite] plans error', plansError)
    return { success: false, error: plansError.message }
  }

  if (!plans || plans.length === 0) {
    return { success: true, data: [] }
  }

  const planIds = plans.map(p => p.id)

  // 2. Get pending/overdue scheduled tasks not yet linked to a record
  const { data: tasks, error: tasksError } = await supabase
    .from('scheduled_tasks')
    .select(`
      id,
      scheduled_date,
      plan_tasks (
        description,
        indice,
        subindice,
        plan_categories ( name )
      )
    `)
    .eq('org_id', identity.orgId)
    .in('plan_id', planIds)
    .in('status', ['pending', 'overdue'])
    .is('maintenance_record_id', null)
    .order('scheduled_date', { ascending: true })

  if (tasksError) {
    console.error('[getAvailableScheduledTasksForSite] tasks error', tasksError)
    return { success: false, error: tasksError.message }
  }

  const mapped = (tasks ?? []).map(task => {
    const planTask = task.plan_tasks as unknown as {
      description: string
      indice: string | null
      subindice: string | null
      plan_categories: { name: string } | null
    } | null

    return {
      id: task.id as string,
      description: planTask?.description ?? '',
      categoryName: planTask?.plan_categories?.name ?? '',
      scheduledDate: task.scheduled_date as string,
      indice: planTask?.indice ?? null,
      subindice: planTask?.subindice ?? null,
    }
  })

  return { success: true, data: mapped }
}

// ------------------------------------------------------------------
// createMaintenanceRecord (useActionState compatible)
// ------------------------------------------------------------------

export interface CreateRecordState {
  error?: string
  fieldErrors?: Record<string, string>
}

export async function createMaintenanceRecord(
  _prevState: CreateRecordState,
  formData: FormData
): Promise<CreateRecordState> {
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

  const scheduledTaskId = (formData.get('scheduled_task_id') as string) || null
  const urgency = (formData.get('urgency') as string) || null

  const raw = {
    site_id: formData.get('site_id') as string,
    type: formData.get('type') as string,
    visit_date: formData.get('visit_date') as string,
    observations: (formData.get('observations') as string)?.trim() || null,
  }

  const parsed = createRecordSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const [key, messages] of Object.entries(parsed.error.flatten().fieldErrors)) {
      fieldErrors[key] = messages?.[0] ?? 'Campo invalido'
    }
    return { fieldErrors }
  }

  // Business rule: preventive types require a scheduled task
  if (
    (parsed.data.type === 'pv_prev' || parsed.data.type === 'diesel_prev') &&
    scheduledTaskId === null
  ) {
    return { fieldErrors: { scheduled_task_id: 'Debe seleccionar una tarea programada' } }
  }

  // Business rule: corrective type requires a failure description
  if (parsed.data.type === 'corrective' && !parsed.data.observations) {
    return { fieldErrors: { observations: 'La descripcion de la falla es requerida' } }
  }

  // Prepend urgency label for corrective records when provided
  let finalObservations = parsed.data.observations ?? ''
  if (parsed.data.type === 'corrective' && urgency) {
    finalObservations = `[URGENCIA: ${urgency.toUpperCase()}]\n${finalObservations}`
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

  const { data: newRecord, error } = await supabase
    .from('maintenance_records')
    .insert({
      org_id: identity.orgId,
      site_id: parsed.data.site_id,
      type: parsed.data.type,
      visit_date: parsed.data.visit_date,
      observations: finalObservations || null,
      responsible_id: identity.userId,
      status: 'draft' as RecordStatus,
    })
    .select('id')
    .single()

  if (error) {
    return { error: `Error al crear registro: ${error.message}` }
  }

  // Link the scheduled task to this new record
  if (scheduledTaskId) {
    await supabase
      .from('scheduled_tasks')
      .update({
        status: 'completed',
        completed_date: parsed.data.visit_date,
        completed_by: identity.userId,
        maintenance_record_id: newRecord.id,
      })
      .eq('id', scheduledTaskId)
      .eq('org_id', identity.orgId)
  }

  await logAudit({
    orgId: identity.orgId,
    userId: identity.userId,
    action: 'create',
    entityType: 'maintenance_record',
    entityId: newRecord.id,
    metadata: { type: parsed.data.type, site_id: parsed.data.site_id },
  })

  revalidatePath('/maintenance')
  revalidatePath('/calendar')
  redirect('/maintenance/' + newRecord.id)
}

// ------------------------------------------------------------------
// updateRecordStatus
// ------------------------------------------------------------------

export async function updateRecordStatus(
  recordId: string,
  newStatus: RecordStatus
): Promise<ActionResult> {
  await assertNotDemo()

  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)
  if (!identity) return { success: false, error: 'No autenticado' }

  const updateData: Record<string, unknown> = { status: newStatus }
  if (newStatus === 'reviewed') {
    updateData.reviewed_by = identity.userId
  }

  const { error } = await supabase
    .from('maintenance_records')
    .update(updateData)
    .eq('id', recordId)
    .eq('org_id', identity.orgId)

  if (error) return { success: false, error: error.message }

  await logAudit({
    orgId: identity.orgId,
    userId: identity.userId,
    action: `status_change_to_${newStatus}`,
    entityType: 'maintenance_record',
    entityId: recordId,
    metadata: { new_status: newStatus },
  })

  revalidatePath('/maintenance')
  return { success: true }
}

// ------------------------------------------------------------------
// deleteMaintenanceRecord
// ------------------------------------------------------------------

const ADMIN_ROLES: UserRole[] = ['owner', 'admin']

export async function deleteMaintenanceRecord(
  recordId: string
): Promise<ActionResult> {
  await assertNotDemo()

  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)
  if (!identity) return { success: false, error: 'No autenticado' }

  // Verify the user has owner or admin role
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('org_id', identity.orgId)
    .eq('user_id', identity.userId)
    .single()

  if (!membership || !ADMIN_ROLES.includes(membership.role as UserRole)) {
    return { success: false, error: 'No tienes permisos para eliminar registros' }
  }

  // Fetch the record to verify ownership and current status
  const { data: record, error: fetchError } = await supabase
    .from('maintenance_records')
    .select('id, type, site_id, visit_date, status')
    .eq('id', recordId)
    .eq('org_id', identity.orgId)
    .single()

  if (fetchError || !record) {
    return { success: false, error: 'Registro no encontrado' }
  }

  if (record.status !== 'draft') {
    return {
      success: false,
      error: `Solo se pueden eliminar registros en borrador. Estado actual: ${record.status}`,
    }
  }

  // Unlink any scheduled tasks pointing to this record before deletion
  await supabase
    .from('scheduled_tasks')
    .update({
      maintenance_record_id: null,
      status: 'pending',
      completed_date: null,
      completed_by: null,
    })
    .eq('maintenance_record_id', recordId)
    .eq('org_id', identity.orgId)

  // Delete the record
  const { error: deleteError } = await supabase
    .from('maintenance_records')
    .delete()
    .eq('id', recordId)
    .eq('org_id', identity.orgId)

  if (deleteError) {
    console.error('[deleteMaintenanceRecord]', deleteError)
    return { success: false, error: `Error al eliminar registro: ${deleteError.message}` }
  }

  await logAudit({
    orgId: identity.orgId,
    userId: identity.userId,
    action: 'delete',
    entityType: 'maintenance_record',
    entityId: recordId,
    metadata: {
      type: record.type,
      site_id: record.site_id,
      visit_date: record.visit_date,
      status_at_deletion: record.status,
    },
  })

  revalidatePath('/maintenance')
  revalidatePath('/calendar')
  return { success: true }
}
