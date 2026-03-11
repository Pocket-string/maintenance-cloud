'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { MaterialsLine } from '@/types/database'

type ActionResult<T = void> = { success: true; data?: T } | { success: false; error: string }

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
// getMaterialsForRecord
// ------------------------------------------------------------------

export async function getMaterialsForRecord(
  recordId: string
): Promise<ActionResult<MaterialsLine[]>> {
  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)
  if (!identity) return { success: false, error: 'No autenticado' }

  // Verify record belongs to org
  const { data: record } = await supabase
    .from('maintenance_records')
    .select('id')
    .eq('id', recordId)
    .eq('org_id', identity.orgId)
    .single()

  if (!record) return { success: false, error: 'Registro no encontrado' }

  const { data, error } = await supabase
    .from('materials_lines')
    .select('*')
    .eq('record_id', recordId)
    .order('created_at')

  if (error) return { success: false, error: error.message }
  return { success: true, data: (data ?? []) as MaterialsLine[] }
}

// ------------------------------------------------------------------
// addMaterialLine
// ------------------------------------------------------------------

const materialSchema = z.object({
  description: z.string().min(1, 'Descripcion es requerida').max(500),
  quantity: z.number().positive('Cantidad debe ser positiva'),
  unit: z.string().min(1, 'Unidad es requerida').max(50),
  unit_cost: z.number().min(0).optional().nullable(),
})

export async function addMaterialLine(
  recordId: string,
  formData: FormData
): Promise<ActionResult<MaterialsLine>> {
  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)
  if (!identity) return { success: false, error: 'No autenticado' }

  const raw = {
    description: (formData.get('description') as string)?.trim(),
    quantity: parseFloat(formData.get('quantity') as string),
    unit: (formData.get('unit') as string)?.trim(),
    unit_cost: formData.get('unit_cost') ? parseFloat(formData.get('unit_cost') as string) : null,
  }

  const parsed = materialSchema.safeParse(raw)
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors
    const firstError = Object.values(errors).flat()[0] ?? 'Datos invalidos'
    return { success: false, error: firstError }
  }

  // Verify record belongs to org
  const { data: record } = await supabase
    .from('maintenance_records')
    .select('id')
    .eq('id', recordId)
    .eq('org_id', identity.orgId)
    .single()

  if (!record) return { success: false, error: 'Registro no encontrado' }

  const { data, error } = await supabase
    .from('materials_lines')
    .insert({
      record_id: recordId,
      ...parsed.data,
    })
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath(`/maintenance/${recordId}`)
  return { success: true, data: data as MaterialsLine }
}

// ------------------------------------------------------------------
// deleteMaterialLine
// ------------------------------------------------------------------

export async function deleteMaterialLine(
  recordId: string,
  lineId: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)
  if (!identity) return { success: false, error: 'No autenticado' }

  // Verify record belongs to org
  const { data: record } = await supabase
    .from('maintenance_records')
    .select('id')
    .eq('id', recordId)
    .eq('org_id', identity.orgId)
    .single()

  if (!record) return { success: false, error: 'Registro no encontrado' }

  const { error } = await supabase
    .from('materials_lines')
    .delete()
    .eq('id', lineId)
    .eq('record_id', recordId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/maintenance/${recordId}`)
  return { success: true }
}
