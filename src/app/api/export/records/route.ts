import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDemo } from '@/lib/demo-guard'
import type { MaintenanceType, RecordStatus } from '@/types/database'

const TYPE_LABELS: Record<MaintenanceType, string> = {
  pv_prev: 'Preventivo FV',
  diesel_prev: 'Preventivo Diesel',
  corrective: 'Correctivo',
}

const STATUS_LABELS: Record<RecordStatus, string> = {
  draft: 'Borrador',
  submitted: 'Enviado',
  reviewed: 'Revisado',
  closed: 'Cerrado',
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

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

  const { data: records } = await supabase
    .from('maintenance_records')
    .select('*, sites(name), profiles!maintenance_records_responsible_profile_fkey(full_name)')
    .eq('org_id', member.org_id)
    .order('visit_date', { ascending: false })

  if (!records || records.length === 0) {
    return new NextResponse('Sin registros para exportar', { status: 404 })
  }

  const headers = ['Fecha', 'Sitio', 'Tipo', 'Estado', 'Responsable', 'Observaciones']
  const rows = records.map(r => {
    const siteName = (r.sites as unknown as { name: string } | null)?.name ?? ''
    const responsibleName = (r.profiles as unknown as { full_name: string } | null)?.full_name ?? ''
    return [
      r.visit_date,
      escapeCSV(siteName),
      TYPE_LABELS[r.type as MaintenanceType] ?? r.type,
      STATUS_LABELS[r.status as RecordStatus] ?? r.status,
      escapeCSV(responsibleName),
      escapeCSV((r.observations as string) ?? ''),
    ].join(',')
  })

  const csv = [headers.join(','), ...rows].join('\n')
  const bom = '\uFEFF' // UTF-8 BOM for Excel

  return new NextResponse(bom + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="registros_mantenimiento_${new Date().toISOString().split('T')[0]}.csv"`,
    },
  })
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
