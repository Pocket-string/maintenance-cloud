'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { assertNotDemo } from '@/lib/demo-guard'
import type { Attachment } from '@/types/database'

type ActionResult<T = void> = { success: true; data?: T } | { success: false; error: string }

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'video/mp4',
  'video/quicktime',
]

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
// getAttachmentsForRecord
// ------------------------------------------------------------------

export type AttachmentWithUrl = Attachment & { signed_url: string | null }

export async function getAttachmentsForRecord(
  recordId: string
): Promise<ActionResult<AttachmentWithUrl[]>> {
  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)
  if (!identity) return { success: false, error: 'No autenticado' }

  const { data: record } = await supabase
    .from('maintenance_records')
    .select('id')
    .eq('id', recordId)
    .eq('org_id', identity.orgId)
    .single()

  if (!record) return { success: false, error: 'Registro no encontrado' }

  const { data, error } = await supabase
    .from('attachments')
    .select('*')
    .eq('record_id', recordId)
    .order('created_at')

  if (error) return { success: false, error: error.message }

  const attachments = (data ?? []) as Attachment[]

  // Generate signed URLs for all attachments (1 hour expiry)
  const paths = attachments.map(a => a.file_path)
  let urlMap: Record<string, string> = {}

  if (paths.length > 0) {
    const { data: signedUrls } = await supabase.storage
      .from('attachments')
      .createSignedUrls(paths, 3600)

    if (signedUrls) {
      for (const entry of signedUrls) {
        if (entry.signedUrl) {
          urlMap[entry.path ?? ''] = entry.signedUrl
        }
      }
    }
  }

  const result: AttachmentWithUrl[] = attachments.map(a => ({
    ...a,
    signed_url: urlMap[a.file_path] ?? null,
  }))

  return { success: true, data: result }
}

// ------------------------------------------------------------------
// uploadAttachment
// ------------------------------------------------------------------

export async function uploadAttachment(
  recordId: string,
  formData: FormData
): Promise<ActionResult<AttachmentWithUrl>> {
  await assertNotDemo()

  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)
  if (!identity) return { success: false, error: 'No autenticado' }

  const file = formData.get('file') as File | null
  if (!file) return { success: false, error: 'Archivo es requerido' }

  if (file.size > MAX_FILE_SIZE) {
    return { success: false, error: 'El archivo excede el limite de 10 MB' }
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { success: false, error: 'Tipo de archivo no permitido. Usa JPG, PNG, WebP, PDF, MP4.' }
  }

  // Verify record belongs to org
  const { data: record } = await supabase
    .from('maintenance_records')
    .select('id')
    .eq('id', recordId)
    .eq('org_id', identity.orgId)
    .single()

  if (!record) return { success: false, error: 'Registro no encontrado' }

  // Upload to Supabase Storage
  const ext = file.name.split('.').pop() || 'bin'
  const filePath = `${identity.orgId}/${recordId}/${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('attachments')
    .upload(filePath, file, { contentType: file.type })

  if (uploadError) {
    return { success: false, error: `Error al subir archivo: ${uploadError.message}` }
  }

  // Create DB record
  const { data, error } = await supabase
    .from('attachments')
    .insert({
      record_id: recordId,
      file_path: filePath,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      uploaded_by: identity.userId,
    })
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  // Generate signed URL for the newly uploaded file
  const { data: signedUrlData } = await supabase.storage
    .from('attachments')
    .createSignedUrl(filePath, 3600)

  revalidatePath(`/maintenance/${recordId}`)
  return {
    success: true,
    data: { ...(data as Attachment), signed_url: signedUrlData?.signedUrl ?? null },
  }
}

// ------------------------------------------------------------------
// deleteAttachment
// ------------------------------------------------------------------

export async function deleteAttachment(
  recordId: string,
  attachmentId: string
): Promise<ActionResult> {
  await assertNotDemo()

  const supabase = await createClient()
  const identity = await resolveOrgId(supabase)
  if (!identity) return { success: false, error: 'No autenticado' }

  // Get attachment info
  const { data: attachment } = await supabase
    .from('attachments')
    .select('id, file_path, record_id')
    .eq('id', attachmentId)
    .single()

  if (!attachment) return { success: false, error: 'Archivo no encontrado' }

  // Verify record belongs to org
  const { data: record } = await supabase
    .from('maintenance_records')
    .select('id')
    .eq('id', attachment.record_id)
    .eq('org_id', identity.orgId)
    .single()

  if (!record) return { success: false, error: 'Registro no encontrado' }

  // Delete from storage
  await supabase.storage
    .from('attachments')
    .remove([attachment.file_path])

  // Delete DB record
  const { error } = await supabase
    .from('attachments')
    .delete()
    .eq('id', attachmentId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/maintenance/${recordId}`)
  return { success: true }
}
