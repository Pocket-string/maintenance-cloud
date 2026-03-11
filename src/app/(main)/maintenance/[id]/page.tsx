import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { StatusActions } from '@/components/maintenance/StatusActions'
import { ChecklistSection } from '@/components/maintenance/ChecklistSection'
import { MaterialsSection } from '@/components/maintenance/MaterialsSection'
import { AttachmentsSection } from '@/components/maintenance/AttachmentsSection'
import type { MaintenanceType, RecordStatus, UserRole } from '@/types/database'

const TYPE_LABELS: Record<MaintenanceType, { label: string; color: string }> = {
  pv_prev: { label: 'Preventivo FV', color: 'bg-yellow-100 text-yellow-800' },
  diesel_prev: { label: 'Preventivo Diesel', color: 'bg-orange-100 text-orange-800' },
  corrective: { label: 'Correctivo', color: 'bg-red-100 text-red-800' },
}

const STATUS_LABELS: Record<RecordStatus, { label: string; color: string }> = {
  draft: { label: 'Borrador', color: 'bg-gray-100 text-gray-800' },
  submitted: { label: 'Enviado', color: 'bg-blue-100 text-blue-800' },
  reviewed: { label: 'Revisado', color: 'bg-green-100 text-green-800' },
  closed: { label: 'Cerrado', color: 'bg-purple-100 text-purple-800' },
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return { title: 'Detalle Registro | Bitalize Cloud Mantenimiento' }
}

export default async function MaintenanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('organization_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!member) redirect('/dashboard')

  const { data: record } = await supabase
    .from('maintenance_records')
    .select('*, sites(name), profiles!maintenance_records_responsible_profile_fkey(full_name)')
    .eq('id', id)
    .eq('org_id', member.org_id)
    .single()

  if (!record) notFound()

  const typeBadge = TYPE_LABELS[record.type as MaintenanceType]
  const statusBadge = STATUS_LABELS[record.status as RecordStatus]
  const siteName = (record.sites as unknown as { name: string } | null)?.name ?? ''
  const responsibleName = (record.profiles as unknown as { full_name: string } | null)?.full_name ?? ''

  const canChangeStatus = ['owner', 'ops', 'admin'].includes(member.role)

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <Link href="/maintenance" className="text-sm text-foreground-secondary hover:text-foreground mb-2 inline-block">
          &larr; Volver a Registros
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">Registro de Mantenimiento</h1>
            <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${statusBadge.color}`}>
              {statusBadge.label}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <h3 className="text-sm font-semibold text-foreground-secondary mb-3">Informacion General</h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs text-foreground-secondary">Sitio</dt>
              <dd className="font-medium text-foreground">
                <Link href={`/sites/${record.site_id}`} className="hover:text-blue-600">
                  {siteName}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-foreground-secondary">Tipo</dt>
              <dd>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${typeBadge.color}`}>
                  {typeBadge.label}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-foreground-secondary">Fecha de Visita</dt>
              <dd className="font-medium text-foreground">{formatDate(record.visit_date as string)}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-foreground-secondary mb-3">Responsable</h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs text-foreground-secondary">Tecnico</dt>
              <dd className="font-medium text-foreground">{responsibleName}</dd>
            </div>
            <div>
              <dt className="text-xs text-foreground-secondary">Creado</dt>
              <dd className="text-foreground-secondary text-sm">
                {new Date(record.created_at as string).toLocaleDateString('es-CL')}
              </dd>
            </div>
            {record.updated_at && record.updated_at !== record.created_at && (
              <div>
                <dt className="text-xs text-foreground-secondary">Actualizado</dt>
                <dd className="text-foreground-secondary text-sm">
                  {new Date(record.updated_at as string).toLocaleDateString('es-CL')}
                </dd>
              </div>
            )}
          </dl>
        </Card>
      </div>

      {record.observations && (
        <Card className="mb-6">
          <h3 className="text-sm font-semibold text-foreground-secondary mb-2">Observaciones</h3>
          <p className="text-foreground whitespace-pre-wrap">{record.observations as string}</p>
        </Card>
      )}

      <div className="mb-6">
        <ChecklistSection
          recordId={id}
          maintenanceType={record.type as MaintenanceType}
          readOnly={record.status === 'closed'}
        />
      </div>

      <div className="mb-6">
        <MaterialsSection recordId={id} readOnly={record.status === 'closed'} />
      </div>

      <div className="mb-6">
        <AttachmentsSection recordId={id} readOnly={record.status === 'closed'} />
      </div>

      {canChangeStatus && (
        <Card>
          <h3 className="text-sm font-semibold text-foreground-secondary mb-3">Acciones</h3>
          <StatusActions recordId={id} currentStatus={record.status as RecordStatus} userRole={member.role as UserRole} />
        </Card>
      )}
    </div>
  )
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}
