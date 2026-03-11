'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/actions/audit'
import type { SiteType } from '@/types/database'

export interface CreateSiteState {
  error?: string
  fieldErrors?: {
    name?: string
    commune?: string
    region?: string
    type?: string
    lat?: string
    lng?: string
  }
}

export async function createSite(
  _prevState: CreateSiteState,
  formData: FormData
): Promise<CreateSiteState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'No autenticado. Por favor inicia sesión.' }
  }

  // Get the user's org_id
  const { data: member } = await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!member?.org_id) {
    return { error: 'No perteneces a ninguna organización.' }
  }

  const name = (formData.get('name') as string)?.trim()
  const commune = (formData.get('commune') as string)?.trim()
  const region = (formData.get('region') as string)?.trim()
  const type = formData.get('type') as SiteType
  const latRaw = (formData.get('lat') as string)?.trim()
  const lngRaw = (formData.get('lng') as string)?.trim()

  // Validate required fields
  const fieldErrors: CreateSiteState['fieldErrors'] = {}

  if (!name) {
    fieldErrors.name = 'El nombre es requerido.'
  }
  if (!commune) {
    fieldErrors.commune = 'La comuna es requerida.'
  }
  if (!region) {
    fieldErrors.region = 'La región es requerida.'
  }
  if (!type || !['fv_pmgd', 'diesel', 'hybrid'].includes(type)) {
    fieldErrors.type = 'El tipo de sitio es requerido.'
  }

  const lat = latRaw ? parseFloat(latRaw) : undefined
  const lng = lngRaw ? parseFloat(lngRaw) : undefined

  if (latRaw && (isNaN(lat!) || lat! < -90 || lat! > 90)) {
    fieldErrors.lat = 'Latitud inválida (entre -90 y 90).'
  }
  if (lngRaw && (isNaN(lng!) || lng! < -180 || lng! > 180)) {
    fieldErrors.lng = 'Longitud inválida (entre -180 y 180).'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors }
  }

  const coordinates =
    lat !== undefined && lng !== undefined ? { lat, lng } : null

  const { data: newSite, error } = await supabase.from('sites').insert({
    org_id: member.org_id,
    name,
    commune,
    region,
    type,
    coordinates,
  }).select('id').single()

  if (error) {
    return { error: `Error al crear el sitio: ${error.message}` }
  }

  await logAudit({
    orgId: member.org_id,
    userId: user.id,
    action: 'create',
    entityType: 'site',
    entityId: newSite.id,
    metadata: { name, type },
  })

  revalidatePath('/sites')
  redirect('/sites')
}
