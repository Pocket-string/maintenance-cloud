'use server'

import { createClient } from '@/lib/supabase/server'
import type { ScheduledTaskStatus } from '@/types/database'

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

type ActionResult<T = void> = { success: true; data?: T } | { success: false; error: string }

export interface ReportChecklistItem {
  label: string
  itemType: string
  value: string
  note: string | null
}

export interface ReportMaterial {
  description: string
  quantity: number
  unit: string
  unitCost: number | null
}

export interface ReportAttachment {
  fileName: string
  category: string
  fileSize: number
  filePath: string
  signedUrl: string | null
}

export interface ReportTask {
  scheduledDate: string
  taskDescription: string
  categoryName: string
  status: ScheduledTaskStatus
  recordId: string | null
  recordStatus: string | null
  observations: string | null
  responsibleName: string | null
  visitDate: string | null
  checklistItems: ReportChecklistItem[]
  materials: ReportMaterial[]
  attachments: ReportAttachment[]
}

export interface ComplianceSummary {
  total: number
  completed: number
  pending: number
  overdue: number
  skipped: number
  compliancePercent: number
}

export interface MonthlyReportData {
  month: string
  year: number
  monthNumber: number
  siteName: string
  planName: string
  planId: string
  generatedAt: string
  compliance: ComplianceSummary
  tasks: ReportTask[]
  totalMaterialsCost: number
  totalAttachments: number
}

export interface PlanOption {
  id: string
  name: string
  siteName: string
}

// ------------------------------------------------------------------
// Helpers
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

function monthRange(year: number, month: number): { start: string; end: string } {
  const paddedMonth = String(month).padStart(2, '0')
  const daysInMonth = new Date(year, month, 0).getDate()
  return {
    start: `${year}-${paddedMonth}-01`,
    end: `${year}-${paddedMonth}-${String(daysInMonth).padStart(2, '0')}`,
  }
}

const MONTH_NAMES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

// ------------------------------------------------------------------
// getPlansForReports — list plans the user can report on
// ------------------------------------------------------------------

export async function getPlansForReports(): Promise<ActionResult<PlanOption[]>> {
  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)
  if (!identity) return { success: false, error: 'No autenticado' }

  const { data, error } = await supabase
    .from('maintenance_plans')
    .select('id, name, sites(name)')
    .eq('org_id', identity.orgId)
    .in('status', ['active', 'paused', 'archived'])
    .order('name')

  if (error) return { success: false, error: error.message }

  const plans: PlanOption[] = (data ?? []).map(p => ({
    id: p.id as string,
    name: p.name as string,
    siteName: (p.sites as unknown as { name: string } | null)?.name ?? '',
  }))

  return { success: true, data: plans }
}

// ------------------------------------------------------------------
// getMonthlyReportData — batch queries for report
// ------------------------------------------------------------------

export async function getMonthlyReportData(
  planId: string,
  year: number,
  month: number
): Promise<ActionResult<MonthlyReportData>> {
  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)
  if (!identity) return { success: false, error: 'No autenticado' }

  // Validate plan belongs to org
  const { data: plan, error: planError } = await supabase
    .from('maintenance_plans')
    .select('id, name, sites(name)')
    .eq('id', planId)
    .eq('org_id', identity.orgId)
    .single()

  if (planError || !plan) return { success: false, error: 'Plan no encontrado' }

  const range = monthRange(year, month)

  // 1. Get scheduled tasks for this plan + month, with their linked records
  const { data: scheduledTasks, error: stError } = await supabase
    .from('scheduled_tasks')
    .select(`
      id,
      scheduled_date,
      status,
      maintenance_record_id,
      plan_tasks (
        description,
        plan_categories ( name )
      ),
      maintenance_records (
        id,
        status,
        observations,
        visit_date,
        profiles!maintenance_records_responsible_profile_fkey ( full_name )
      )
    `)
    .eq('org_id', identity.orgId)
    .eq('plan_id', planId)
    .gte('scheduled_date', range.start)
    .lte('scheduled_date', range.end)
    .order('scheduled_date')

  if (stError) {
    console.error('[getMonthlyReportData] scheduled_tasks', stError)
    return { success: false, error: stError.message }
  }

  const rows = scheduledTasks ?? []

  // Collect all record IDs for batch queries
  const recordIds = rows
    .map(r => (r.maintenance_records as unknown as { id: string } | null)?.id)
    .filter((id): id is string => !!id)

  // 2. Batch: checklist responses for all records
  let checklistMap = new Map<string, ReportChecklistItem[]>()
  if (recordIds.length > 0) {
    const { data: responses } = await supabase
      .from('checklist_responses')
      .select('record_id, value, note, checklist_items(label, item_type)')
      .in('record_id', recordIds)

    if (responses) {
      for (const r of responses) {
        const recordId = r.record_id as string
        const item = r.checklist_items as unknown as { label: string; item_type: string } | null
        if (!item) continue
        const entry: ReportChecklistItem = {
          label: item.label,
          itemType: item.item_type,
          value: r.value as string,
          note: r.note as string | null,
        }
        const existing = checklistMap.get(recordId) ?? []
        existing.push(entry)
        checklistMap.set(recordId, existing)
      }
    }
  }

  // 3. Batch: materials for all records
  let materialsMap = new Map<string, ReportMaterial[]>()
  if (recordIds.length > 0) {
    const { data: materials } = await supabase
      .from('materials_lines')
      .select('record_id, description, quantity, unit, unit_cost')
      .in('record_id', recordIds)

    if (materials) {
      for (const m of materials) {
        const recordId = m.record_id as string
        const entry: ReportMaterial = {
          description: m.description as string,
          quantity: Number(m.quantity),
          unit: m.unit as string,
          unitCost: m.unit_cost ? Number(m.unit_cost) : null,
        }
        const existing = materialsMap.get(recordId) ?? []
        existing.push(entry)
        materialsMap.set(recordId, existing)
      }
    }
  }

  // 4. Batch: attachments for all records (with signed URLs for images)
  let attachmentsMap = new Map<string, ReportAttachment[]>()
  if (recordIds.length > 0) {
    const { data: attachments } = await supabase
      .from('attachments')
      .select('record_id, file_name, category, file_size, file_path')
      .in('record_id', recordIds)

    if (attachments) {
      // Collect image file paths for batch signed URL generation
      const imagePaths = attachments
        .filter(a => ((a.category as string) ?? '').startsWith('image'))
        .map(a => a.file_path as string)

      // Generate signed URLs for images (1 hour expiry)
      let signedUrlMap = new Map<string, string>()
      if (imagePaths.length > 0) {
        const { data: signedData } = await supabase.storage
          .from('attachments')
          .createSignedUrls(imagePaths, 3600)

        if (signedData) {
          for (const s of signedData) {
            if (s.signedUrl && s.path) {
              signedUrlMap.set(s.path, s.signedUrl)
            }
          }
        }
      }

      for (const a of attachments) {
        const recordId = a.record_id as string
        const filePath = a.file_path as string
        const entry: ReportAttachment = {
          fileName: a.file_name as string,
          category: (a.category as string) ?? 'document',
          fileSize: a.file_size as number,
          filePath,
          signedUrl: signedUrlMap.get(filePath) ?? null,
        }
        const existing = attachmentsMap.get(recordId) ?? []
        existing.push(entry)
        attachmentsMap.set(recordId, existing)
      }
    }
  }

  // 5. Build compliance stats
  let completed = 0, pending = 0, overdue = 0, skipped = 0
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
  const compliancePercent = denominator > 0 ? Math.round((completed / denominator) * 100) : 0

  // 6. Build task details
  const tasks: ReportTask[] = rows.map(row => {
    const pt = row.plan_tasks as unknown as {
      description: string
      plan_categories: { name: string } | null
    } | null

    const rec = row.maintenance_records as unknown as {
      id: string
      status: string
      observations: string | null
      visit_date: string | null
      profiles: { full_name: string } | null
    } | null

    const recId = rec?.id ?? null

    return {
      scheduledDate: row.scheduled_date as string,
      taskDescription: pt?.description ?? '',
      categoryName: pt?.plan_categories?.name ?? '',
      status: row.status as ScheduledTaskStatus,
      recordId: recId,
      recordStatus: rec?.status ?? null,
      observations: rec?.observations ?? null,
      responsibleName: rec?.profiles?.full_name ?? null,
      visitDate: rec?.visit_date ?? null,
      checklistItems: recId ? (checklistMap.get(recId) ?? []) : [],
      materials: recId ? (materialsMap.get(recId) ?? []) : [],
      attachments: recId ? (attachmentsMap.get(recId) ?? []) : [],
    }
  })

  // 7. Totals
  let totalMaterialsCost = 0
  let totalAttachments = 0
  for (const t of tasks) {
    for (const m of t.materials) {
      if (m.unitCost) totalMaterialsCost += m.quantity * m.unitCost
    }
    totalAttachments += t.attachments.length
  }

  const siteName = (plan.sites as unknown as { name: string } | null)?.name ?? ''

  return {
    success: true,
    data: {
      month: MONTH_NAMES[month],
      year,
      monthNumber: month,
      siteName,
      planName: plan.name as string,
      planId: plan.id as string,
      generatedAt: new Date().toISOString(),
      compliance: { total, completed, pending, overdue, skipped, compliancePercent },
      tasks,
      totalMaterialsCost,
      totalAttachments,
    },
  }
}
