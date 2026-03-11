'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { Asset, AssetType, AssetStatus } from '@/types/database'

// ------------------------------------------------------------------
// Return type
// ------------------------------------------------------------------

type ActionResult<T = void> = { success: true; data?: T } | { success: false; error: string }

// ------------------------------------------------------------------
// Response shapes (augmented with join data)
// ------------------------------------------------------------------

export interface AssetWithSite extends Asset {
  site_name: string
}

// ------------------------------------------------------------------
// Validation schemas
// ------------------------------------------------------------------

const ASSET_TYPES: [AssetType, ...AssetType[]] = [
  'inverter',
  'panel_string',
  'transformer',
  'meter',
  'diesel_gen',
  'ats',
  'battery_bank',
  'tracker',
  'string_box',
  'switchgear',
  'ncu',
  'rack',
  'ups',
  'sensor',
  'ppc',
  'center',
  'module',
  'building',
  'other',
]

const ASSET_STATUSES: [AssetStatus, ...AssetStatus[]] = [
  'active',
  'inactive',
  'decommissioned',
]

const createAssetSchema = z.object({
  site_id: z.string().uuid({ message: 'site_id must be a valid UUID' }),
  parent_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1, { message: 'name is required' }).max(200),
  type: z.enum(ASSET_TYPES, { message: 'type must be a valid AssetType' }),
  code: z.string().max(100).optional().nullable(),
  tag: z.string().max(200).optional().nullable(),
  priority: z.coerce.number().int().min(1).max(5).default(3),
  brand: z.string().max(100).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  serial: z.string().max(100).optional().nullable(),
  install_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'install_date must be YYYY-MM-DD' })
    .optional()
    .nullable(),
  status: z.enum(ASSET_STATUSES).default('active'),
})

const updateAssetSchema = z.object({
  parent_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1, { message: 'name is required' }).max(200).optional(),
  type: z.enum(ASSET_TYPES, { message: 'type must be a valid AssetType' }).optional(),
  code: z.string().max(100).optional().nullable(),
  tag: z.string().max(200).optional().nullable(),
  priority: z.coerce.number().int().min(1).max(5).optional(),
  brand: z.string().max(100).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  serial: z.string().max(100).optional().nullable(),
  install_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'install_date must be YYYY-MM-DD' })
    .optional()
    .nullable(),
  status: z.enum(ASSET_STATUSES).optional(),
})

// ------------------------------------------------------------------
// Internal helper: resolve org_id for the authenticated user
// Returns null if user is not authenticated or has no membership.
// ------------------------------------------------------------------

async function resolveOrgId(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ userId: string; orgId: string } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: membership, error } = await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (error || !membership) return null

  return { userId: user.id, orgId: membership.org_id }
}

// ------------------------------------------------------------------
// getAssetsTree (hierarchical — for tree view)
// ------------------------------------------------------------------

export interface AssetTreeNode {
  id: string
  parent_id: string | null
  name: string
  type: AssetType
  code: string | null
  tag: string | null
  priority: number
  brand: string | null
  model: string | null
  status: AssetStatus
  children: AssetTreeNode[]
}

export async function getAssetsTree(siteId: string): Promise<ActionResult<AssetTreeNode[]>> {
  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)
  if (!identity) return { success: false, error: 'Unauthorized' }

  const { data, error } = await supabase
    .from('assets')
    .select('id, parent_id, name, type, code, tag, priority, brand, model, status')
    .eq('org_id', identity.orgId)
    .eq('site_id', siteId)
    .order('priority', { ascending: true })
    .order('name', { ascending: true })

  if (error) return { success: false, error: error.message }

  // Build tree in memory
  const nodes = (data ?? []) as AssetTreeNode[]
  const map = new Map<string, AssetTreeNode>()
  for (const node of nodes) {
    node.children = []
    map.set(node.id, node)
  }

  const roots: AssetTreeNode[] = []
  for (const node of nodes) {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return { success: true, data: roots }
}

// ------------------------------------------------------------------
// getAssets
// ------------------------------------------------------------------

export async function getAssets(siteId?: string): Promise<ActionResult<AssetWithSite[]>> {
  // Step 1 — Auth
  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)

  if (!identity) {
    return { success: false, error: 'Unauthorized' }
  }

  // Step 2 — Validate (siteId is optional; validate UUID format if provided)
  if (siteId !== undefined) {
    const parsed = z.string().uuid().safeParse(siteId)
    if (!parsed.success) {
      return { success: false, error: 'siteId must be a valid UUID' }
    }
  }

  // Step 3 — Execute
  let query = supabase
    .from('assets')
    .select('*, sites(name)')
    .eq('org_id', identity.orgId)
    .order('created_at', { ascending: false })

  if (siteId) {
    query = query.eq('site_id', siteId)
  }

  const { data, error } = await query

  if (error) {
    console.error('[getAssets] Supabase error:', error)
    return { success: false, error: error.message }
  }

  // Step 4 — Return (flatten the joined site name)
  const assets: AssetWithSite[] = (data ?? []).map((row) => {
    const { sites, ...asset } = row as Asset & { sites: { name: string } | null }
    return { ...asset, site_name: sites?.name ?? '' }
  })

  return { success: true, data: assets }
}

// ------------------------------------------------------------------
// getAssetById
// ------------------------------------------------------------------

export async function getAssetById(assetId: string): Promise<ActionResult<AssetWithSite>> {
  // Step 1 — Auth
  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)

  if (!identity) {
    return { success: false, error: 'Unauthorized' }
  }

  // Step 2 — Validate
  const parsed = z.string().uuid().safeParse(assetId)
  if (!parsed.success) {
    return { success: false, error: 'assetId must be a valid UUID' }
  }

  // Step 3 — Execute (scope to org to prevent cross-org data leakage)
  const { data, error } = await supabase
    .from('assets')
    .select('*, sites(name)')
    .eq('id', assetId)
    .eq('org_id', identity.orgId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return { success: false, error: 'Asset not found' }
    }
    console.error('[getAssetById] Supabase error:', error)
    return { success: false, error: error.message }
  }

  // Step 4 — Return
  const { sites, ...asset } = data as Asset & { sites: { name: string } | null }
  return { success: true, data: { ...asset, site_name: sites?.name ?? '' } }
}

// ------------------------------------------------------------------
// createAsset
// ------------------------------------------------------------------

export async function createAsset(formData: FormData): Promise<ActionResult<Asset>> {
  // Step 1 — Auth
  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)

  if (!identity) {
    return { success: false, error: 'Unauthorized' }
  }

  // Step 2 — Validate
  const raw = {
    site_id: formData.get('site_id'),
    parent_id: formData.get('parent_id') || null,
    name: formData.get('name'),
    type: formData.get('type'),
    code: formData.get('code') || null,
    tag: formData.get('tag') || null,
    priority: formData.get('priority') || 3,
    brand: formData.get('brand') || null,
    model: formData.get('model') || null,
    serial: formData.get('serial') || null,
    install_date: formData.get('install_date') || null,
    status: formData.get('status') ?? 'active',
  }

  const parsed = createAssetSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: JSON.stringify(parsed.error.flatten().fieldErrors) }
  }

  // Verify the target site belongs to the user's org (prevent cross-org injection)
  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('id')
    .eq('id', parsed.data.site_id)
    .eq('org_id', identity.orgId)
    .single()

  if (siteError || !site) {
    return { success: false, error: 'Site not found or does not belong to your organization' }
  }

  // Step 3 — Execute (org_id is set from server-resolved identity, never from client)
  const { data, error } = await supabase
    .from('assets')
    .insert({
      ...parsed.data,
      org_id: identity.orgId,
    })
    .select()
    .single()

  if (error) {
    console.error('[createAsset] Supabase error:', error)
    return { success: false, error: error.message }
  }

  // Step 4 — Return
  revalidatePath('/assets')
  return { success: true, data: data as Asset }
}

// ------------------------------------------------------------------
// updateAsset
// ------------------------------------------------------------------

export async function updateAsset(
  assetId: string,
  formData: FormData
): Promise<ActionResult<Asset>> {
  // Step 1 — Auth
  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)

  if (!identity) {
    return { success: false, error: 'Unauthorized' }
  }

  // Step 2 — Validate
  const idParsed = z.string().uuid().safeParse(assetId)
  if (!idParsed.success) {
    return { success: false, error: 'assetId must be a valid UUID' }
  }

  const raw = {
    name: formData.get('name') ?? undefined,
    type: formData.get('type') ?? undefined,
    brand: formData.get('brand') !== null ? formData.get('brand') : undefined,
    model: formData.get('model') !== null ? formData.get('model') : undefined,
    serial: formData.get('serial') !== null ? formData.get('serial') : undefined,
    install_date:
      formData.get('install_date') !== null ? formData.get('install_date') || null : undefined,
    status: formData.get('status') ?? undefined,
  }

  // Remove keys that were not supplied in the FormData
  const filtered = Object.fromEntries(
    Object.entries(raw).filter(([, v]) => v !== undefined)
  )

  const parsed = updateAssetSchema.safeParse(filtered)
  if (!parsed.success) {
    return { success: false, error: JSON.stringify(parsed.error.flatten().fieldErrors) }
  }

  if (Object.keys(parsed.data).length === 0) {
    return { success: false, error: 'No fields provided for update' }
  }

  // Step 3 — Execute (scope update to org to prevent cross-org mutation)
  const { data, error } = await supabase
    .from('assets')
    .update(parsed.data)
    .eq('id', assetId)
    .eq('org_id', identity.orgId)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return { success: false, error: 'Asset not found' }
    }
    console.error('[updateAsset] Supabase error:', error)
    return { success: false, error: error.message }
  }

  // Step 4 — Return
  revalidatePath('/assets')
  return { success: true, data: data as Asset }
}

// ------------------------------------------------------------------
// deleteAsset
// ------------------------------------------------------------------

export async function deleteAsset(assetId: string): Promise<ActionResult> {
  // Step 1 — Auth
  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)

  if (!identity) {
    return { success: false, error: 'Unauthorized' }
  }

  // Step 2 — Validate
  const parsed = z.string().uuid().safeParse(assetId)
  if (!parsed.success) {
    return { success: false, error: 'assetId must be a valid UUID' }
  }

  // Step 3 — Execute (scope delete to org to prevent cross-org deletion)
  const { error } = await supabase
    .from('assets')
    .delete()
    .eq('id', assetId)
    .eq('org_id', identity.orgId)

  if (error) {
    console.error('[deleteAsset] Supabase error:', error)
    return { success: false, error: error.message }
  }

  // Step 4 — Return
  revalidatePath('/assets')
  return { success: true }
}
