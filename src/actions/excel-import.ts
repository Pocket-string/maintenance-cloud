'use server'

import { revalidatePath } from 'next/cache'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/actions/audit'
import type { PlanStatus, PlanCategoryInsert, PlanTaskInsert } from '@/types/database'

// ------------------------------------------------------------------
// Return types
// ------------------------------------------------------------------

type ActionResult<T = void> = { success: true; data?: T } | { success: false; error: string }

export interface ImportResult {
  categoriesCreated: number
  tasksCreated: number
  warnings: string[]
}

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_EXTENSIONS = ['.xlsx', '.xls']

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
// Helper: parse frequency from raw cell value
// ------------------------------------------------------------------

interface ParsedFrequency {
  frequencyMonths: number | null
  frequencyType: 'fixed' | 'special'
  frequencyDetail: string | null
}

function parseFrequency(raw: unknown): ParsedFrequency {
  if (typeof raw === 'number' && raw > 0) {
    return { frequencyMonths: raw, frequencyType: 'fixed', frequencyDetail: null }
  }

  const str = String(raw ?? '').trim()
  const num = parseInt(str, 10)

  if (!isNaN(num) && num > 0) {
    return { frequencyMonths: num, frequencyType: 'fixed', frequencyDetail: null }
  }

  // Special frequency (text like "[Segun lo requiera el fabricante]")
  return {
    frequencyMonths: null,
    frequencyType: 'special',
    frequencyDetail: str || 'Sin definir',
  }
}

// ------------------------------------------------------------------
// Helper: find column index by fuzzy header match
// ------------------------------------------------------------------

function findColumnIndex(headers: unknown[], keyword: string): number {
  const kwUpper = keyword.toUpperCase()
  return headers.findIndex(h => {
    if (h == null) return false
    return String(h).toUpperCase().includes(kwUpper)
  })
}

// ------------------------------------------------------------------
// Helper: get string cell value safely
// ------------------------------------------------------------------

function cellToString(row: unknown[], colIndex: number): string {
  if (colIndex < 0 || colIndex >= row.length) return ''
  const val = row[colIndex]
  if (val == null) return ''
  return String(val).trim()
}

// ------------------------------------------------------------------
// importPlanFromExcel
// ------------------------------------------------------------------

export async function importPlanFromExcel(
  planId: string,
  formData: FormData
): Promise<ActionResult<ImportResult>> {
  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)
  if (!identity) return { success: false, error: 'No autenticado' }

  // Verify plan exists, belongs to org, and is in draft status
  const { data: plan, error: planError } = await supabase
    .from('maintenance_plans')
    .select('id, status')
    .eq('id', planId)
    .eq('org_id', identity.orgId)
    .single()

  if (planError || !plan) {
    return { success: false, error: 'Plan no encontrado' }
  }

  if ((plan.status as PlanStatus) !== 'draft') {
    return { success: false, error: 'Solo se puede importar en planes en estado borrador' }
  }

  // Validate uploaded file
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return { success: false, error: 'Archivo no encontrado en el formulario' }
  }

  const fileName = file.name.toLowerCase()
  const hasValidExtension = ALLOWED_EXTENSIONS.some(ext => fileName.endsWith(ext))
  if (!hasValidExtension) {
    return { success: false, error: 'El archivo debe ser .xlsx o .xls' }
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { success: false, error: 'El archivo no puede superar 5 MB' }
  }

  // Parse workbook
  const buffer = await file.arrayBuffer()
  let rows: unknown[][]

  try {
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]
  } catch {
    return { success: false, error: 'No se pudo leer el archivo Excel. Verifique que no este corrupto.' }
  }

  if (rows.length === 0) {
    return { success: false, error: 'El archivo Excel esta vacio' }
  }

  // Find header row: look for row containing "EQUIPAMIENTO" or "ACTIVIDADES"
  let headerRowIndex = -1
  for (let i = 0; i < rows.length; i++) {
    const rowStr = rows[i].map(c => String(c ?? '').toUpperCase())
    if (rowStr.some(c => c.includes('EQUIPAMIENTO') || c.includes('ACTIVIDADES'))) {
      headerRowIndex = i
      break
    }
  }

  if (headerRowIndex < 0) {
    return {
      success: false,
      error: 'No se encontro fila de encabezados. El archivo debe contener columnas "EQUIPAMIENTO" o "ACTIVIDADES".',
    }
  }

  const headerRow = rows[headerRowIndex]

  // Map column indices using fuzzy matching
  const colIndice = findColumnIndex(headerRow, 'INDICE')
  // Note: real data may contain typo "SUBINIDICE"
  const colSubindice = findColumnIndex(headerRow, 'SUBIND')
  const colEquipamiento = findColumnIndex(headerRow, 'EQUIPAMIENTO')
  const colActividades = findColumnIndex(headerRow, 'ACTIVIDADES')
  const colPeriodicidad = findColumnIndex(headerRow, 'PERIODICIDAD')

  if (colEquipamiento < 0 && colActividades < 0) {
    return {
      success: false,
      error: 'No se encontraron columnas de EQUIPAMIENTO ni ACTIVIDADES en la fila de encabezados',
    }
  }

  const warnings: string[] = []

  // Parse data rows
  interface ParsedRow {
    indice: string
    subindice: string
    equipamiento: string
    actividad: string
    periodicidad: unknown
    rowNumber: number
  }

  const parsedRows: ParsedRow[] = []

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length === 0) continue

    const equipamiento = colEquipamiento >= 0 ? cellToString(row, colEquipamiento) : ''
    const actividad = colActividades >= 0 ? cellToString(row, colActividades) : ''

    // Skip rows where both equipamiento and actividades are empty
    if (equipamiento === '' && actividad === '') continue

    parsedRows.push({
      indice: colIndice >= 0 ? cellToString(row, colIndice) : '',
      subindice: colSubindice >= 0 ? cellToString(row, colSubindice) : '',
      equipamiento,
      actividad,
      periodicidad: colPeriodicidad >= 0 ? (row[colPeriodicidad] ?? '') : '',
      rowNumber: i + 1,
    })
  }

  if (parsedRows.length === 0) {
    return { success: false, error: 'No se encontraron filas de datos despues del encabezado' }
  }

  // Group by equipamiento name to build category list
  const categoryMap = new Map<string, { orderIndex: number }>()
  let categoryOrder = 0

  for (const row of parsedRows) {
    if (row.equipamiento && !categoryMap.has(row.equipamiento)) {
      categoryMap.set(row.equipamiento, { orderIndex: categoryOrder++ })
    }
  }

  // Delete existing categories (cascades to tasks via FK)
  const { error: deleteCatsError } = await supabase
    .from('plan_categories')
    .delete()
    .eq('plan_id', planId)

  if (deleteCatsError) {
    console.error('[importPlanFromExcel] delete categories', deleteCatsError)
    return { success: false, error: 'Error al limpiar categorias existentes: ' + deleteCatsError.message }
  }

  // Insert categories
  const categoriesPayload: PlanCategoryInsert[] = Array.from(categoryMap.entries()).map(
    ([name, meta]) => ({
      plan_id: planId,
      name,
      order_index: meta.orderIndex,
    })
  )

  const { data: insertedCategories, error: insertCatsError } = await supabase
    .from('plan_categories')
    .insert(categoriesPayload)
    .select('id, name')

  if (insertCatsError || !insertedCategories) {
    console.error('[importPlanFromExcel] insert categories', insertCatsError)
    return { success: false, error: 'Error al insertar categorias: ' + (insertCatsError?.message ?? 'Desconocido') }
  }

  const categoryIdByName = new Map<string, string>()
  for (const cat of insertedCategories) {
    categoryIdByName.set(cat.name, cat.id)
  }

  // Build and insert tasks
  const tasksPayload: PlanTaskInsert[] = []
  const taskOrderByCategory = new Map<string, number>()

  for (const row of parsedRows) {
    if (!row.actividad) {
      warnings.push(`Fila ${row.rowNumber}: actividad vacia, omitida`)
      continue
    }

    // Assign to last seen category or "Sin categoria"
    const categoryName = row.equipamiento || 'Sin categoria'
    const categoryId = categoryIdByName.get(categoryName)

    if (!categoryId) {
      warnings.push(`Fila ${row.rowNumber}: categoria "${categoryName}" no encontrada, omitida`)
      continue
    }

    const orderIndex = taskOrderByCategory.get(categoryId) ?? 0
    taskOrderByCategory.set(categoryId, orderIndex + 1)

    const freq = parseFrequency(row.periodicidad)

    tasksPayload.push({
      plan_id: planId,
      category_id: categoryId,
      indice: row.indice || null,
      subindice: row.subindice || null,
      description: row.actividad,
      frequency_months: freq.frequencyMonths,
      frequency_type: freq.frequencyType,
      frequency_detail: freq.frequencyDetail,
      order_index: orderIndex,
      is_active: true,
    })
  }

  let tasksCreated = 0

  if (tasksPayload.length > 0) {
    const { data: insertedTasks, error: insertTasksError } = await supabase
      .from('plan_tasks')
      .insert(tasksPayload)
      .select('id')

    if (insertTasksError || !insertedTasks) {
      console.error('[importPlanFromExcel] insert tasks', insertTasksError)
      return {
        success: false,
        error: 'Categorias creadas pero error al insertar tareas: ' + (insertTasksError?.message ?? 'Desconocido'),
      }
    }

    tasksCreated = insertedTasks.length
  }

  const categoriesCreated = insertedCategories.length

  await logAudit({
    orgId: identity.orgId,
    userId: identity.userId,
    action: 'import_excel',
    entityType: 'maintenance_plan',
    entityId: planId,
    metadata: { categoriesCreated, tasksCreated, warnings: warnings.length },
  })

  revalidatePath('/plans/' + planId)

  return {
    success: true,
    data: { categoriesCreated, tasksCreated, warnings },
  }
}
