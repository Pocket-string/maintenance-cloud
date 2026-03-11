'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * Log an action to the audit_log table.
 * Fire-and-forget — errors are silently caught.
 */
export async function logAudit(params: {
  orgId: string
  userId: string
  action: string
  entityType: string
  entityId: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    const supabase = await createClient()
    await supabase.from('audit_log').insert({
      org_id: params.orgId,
      user_id: params.userId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      metadata: params.metadata ?? null,
    })
  } catch {
    // Audit log failures should not break the main flow
  }
}
