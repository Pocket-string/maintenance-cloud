import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDemo } from '@/lib/demo-guard'
import * as XLSX from 'xlsx'
import { getMonthlyReportData } from '@/actions/reports'

const STATUS_LABELS: Record<string, string> = {
  completed: 'Completada',
  pending: 'Pendiente',
  overdue: 'Vencida',
  skipped: 'Omitida',
}

const CATEGORY_LABELS: Record<string, string> = {
  image: 'Imagen',
  document: 'Documento',
  video: 'Video',
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const parts = dateStr.split('T')[0].split('-')
  if (parts.length !== 3) return dateStr
  const [yyyy, mm, dd] = parts
  return `${dd}/${mm}/${yyyy}`
}

function formatGeneratedAt(isoStr: string): string {
  const d = new Date(isoStr)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

export async function GET(request: NextRequest) {
  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // Role check
  const { data: member } = await supabase
    .from('organization_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  const demoMode = await isDemo()
  if (!member || (!['owner', 'ops', 'admin'].includes(member.role) && !demoMode)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  // Query param validation
  const params = request.nextUrl.searchParams
  const planId = params.get('planId')
  const yearStr = params.get('year')
  const monthStr = params.get('month')

  if (!planId || !yearStr || !monthStr) {
    return NextResponse.json(
      { error: 'Parámetros requeridos: planId, year, month' },
      { status: 400 }
    )
  }

  const year = Number(yearStr)
  const month = Number(monthStr)

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'Año inválido' }, { status: 400 })
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Mes inválido (1-12)' }, { status: 400 })
  }

  // Fetch report data
  const result = await getMonthlyReportData(planId, year, month)

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  const data = result.data!
  const wb = XLSX.utils.book_new()

  // ------------------------------------------------------------------
  // Sheet 1: Resumen
  // ------------------------------------------------------------------
  const resumenHeaders = ['Campo', 'Valor']
  const resumenRows = [
    ['Plan', data.planName],
    ['Sitio', data.siteName],
    ['Periodo', `${data.month} ${data.year}`],
    ['Generado', formatGeneratedAt(data.generatedAt)],
    ['Total tareas', data.compliance.total],
    ['Completadas', data.compliance.completed],
    ['Pendientes', data.compliance.pending],
    ['Vencidas', data.compliance.overdue],
    ['Omitidas', data.compliance.skipped],
    ['Cumplimiento', `${data.compliance.compliancePercent}%`],
    ['Costo total materiales', data.totalMaterialsCost],
    ['Total evidencias', data.totalAttachments],
  ]

  const wsResumen = XLSX.utils.aoa_to_sheet([resumenHeaders, ...resumenRows])
  wsResumen['!cols'] = resumenHeaders.map(() => ({ wch: 20 }))
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

  // ------------------------------------------------------------------
  // Sheet 2: Tareas
  // ------------------------------------------------------------------
  const tareasHeaders = [
    'Fecha Programada',
    'Descripcion',
    'Categoria',
    'Estado',
    'Fecha Visita',
    'Responsable',
    'Observaciones',
  ]
  const tareasRows = data.tasks.map(task => [
    formatDate(task.scheduledDate),
    task.taskDescription,
    task.categoryName,
    STATUS_LABELS[task.status] ?? task.status,
    formatDate(task.visitDate),
    task.responsibleName ?? '',
    task.observations ?? '',
  ])

  const wsTareas = XLSX.utils.aoa_to_sheet([tareasHeaders, ...tareasRows])
  wsTareas['!cols'] = tareasHeaders.map(() => ({ wch: 20 }))
  XLSX.utils.book_append_sheet(wb, wsTareas, 'Tareas')

  // ------------------------------------------------------------------
  // Sheet 3: Checklists
  // ------------------------------------------------------------------
  const checklistHeaders = ['Tarea', 'Item', 'Tipo', 'Valor', 'Nota']
  const checklistRows: (string | number)[][] = []

  for (const task of data.tasks) {
    for (const item of task.checklistItems) {
      const displayValue =
        item.itemType === 'bool'
          ? item.value === 'true'
            ? 'Si'
            : 'No'
          : item.value
      checklistRows.push([
        task.taskDescription,
        item.label,
        item.itemType,
        displayValue,
        item.note ?? '',
      ])
    }
  }

  const wsChecklist = XLSX.utils.aoa_to_sheet([checklistHeaders, ...checklistRows])
  wsChecklist['!cols'] = checklistHeaders.map(() => ({ wch: 20 }))
  XLSX.utils.book_append_sheet(wb, wsChecklist, 'Checklists')

  // ------------------------------------------------------------------
  // Sheet 4: Materiales
  // ------------------------------------------------------------------
  const materialesHeaders = [
    'Tarea',
    'Descripcion',
    'Cantidad',
    'Unidad',
    'Costo Unitario',
    'Subtotal',
  ]
  const materialesRows: (string | number)[][] = []

  for (const task of data.tasks) {
    for (const mat of task.materials) {
      const subtotal =
        mat.unitCost !== null && mat.unitCost !== undefined
          ? mat.quantity * mat.unitCost
          : ''
      materialesRows.push([
        task.taskDescription,
        mat.description,
        mat.quantity,
        mat.unit,
        mat.unitCost ?? '',
        subtotal,
      ])
    }
  }

  const wsMateriales = XLSX.utils.aoa_to_sheet([materialesHeaders, ...materialesRows])
  wsMateriales['!cols'] = materialesHeaders.map(() => ({ wch: 20 }))
  XLSX.utils.book_append_sheet(wb, wsMateriales, 'Materiales')

  // ------------------------------------------------------------------
  // Sheet 5: Evidencias
  // ------------------------------------------------------------------
  const evidenciasHeaders = ['Tarea', 'Archivo', 'Categoria', 'Tamano (KB)']
  const evidenciasRows: (string | number)[][] = []

  for (const task of data.tasks) {
    for (const att of task.attachments) {
      evidenciasRows.push([
        task.taskDescription,
        att.fileName,
        CATEGORY_LABELS[att.category] ?? att.category,
        Math.round(att.fileSize / 1024),
      ])
    }
  }

  const wsEvidencias = XLSX.utils.aoa_to_sheet([evidenciasHeaders, ...evidenciasRows])
  wsEvidencias['!cols'] = evidenciasHeaders.map(() => ({ wch: 20 }))
  XLSX.utils.book_append_sheet(wb, wsEvidencias, 'Evidencias')

  // ------------------------------------------------------------------
  // Write buffer and return response
  // ------------------------------------------------------------------
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const safeFileName = data.planName.replace(/\s+/g, '_')

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="reporte_${safeFileName}_${data.month}_${data.year}.xlsx"`,
    },
  })
}
