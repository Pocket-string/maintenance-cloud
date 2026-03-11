import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { getMonthlyReportData } from '@/actions/reports'
import type { MonthlyReportData } from '@/actions/reports'
import ReportTaskList from './_components/ReportTaskList'

export const metadata = { title: 'Reporte Mensual | Bitalize Cloud Mantenimiento' }

// ------------------------------------------------------------------
// Helper utilities
// ------------------------------------------------------------------

function formatCurrency(amount: number): string {
  return '$' + amount.toLocaleString('es-CL')
}

// ------------------------------------------------------------------
// Page
// ------------------------------------------------------------------

export default async function MonthlyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ planId?: string; year?: string; month?: string }>
}) {
  // Auth check
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!member) redirect('/dashboard')

  // Parse and validate search params
  const params = await searchParams
  const { planId, year: yearStr, month: monthStr } = params

  if (!planId || !yearStr || !monthStr) redirect('/reports')

  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12 || year < 2000) {
    redirect('/reports')
  }

  // Fetch report data
  const result = await getMonthlyReportData(planId, year, month)

  if (!result.success || !result.data) {
    return (
      <div className="p-6 md:p-8 max-w-5xl mx-auto">
        <div className="mb-6">
          <Link
            href="/reports"
            className="text-sm text-foreground-secondary hover:text-foreground transition-colors"
          >
            &larr; Volver a Informes
          </Link>
        </div>
        <Card>
          <p className="text-red-600 font-medium">Error al cargar el reporte</p>
          <p className="text-foreground-secondary text-sm mt-1">
            {!result.success ? result.error : 'No se pudo obtener la informacion del plan.'}
          </p>
        </Card>
      </div>
    )
  }

  const data: MonthlyReportData = result.data
  const { compliance } = data

  const exportHref = `/api/export/report?planId=${planId}&year=${year}&month=${month}`
  const printHref = `/reports/monthly/print?planId=${planId}&year=${year}&month=${month}`

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      {/* ------------------------------------------------------------------ */}
      {/* Header bar                                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-6">
        <Link
          href="/reports"
          className="text-sm text-foreground-secondary hover:text-foreground transition-colors"
        >
          &larr; Volver a Informes
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mt-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Reporte {data.month} {data.year}
            </h1>
            <p className="text-foreground-secondary mt-0.5">{data.planName}</p>
            <p className="text-sm text-foreground-secondary">{data.siteName}</p>
          </div>

          <div className="flex gap-2 flex-shrink-0">
            <a
              href={exportHref}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-gray-50 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Exportar Excel
            </a>
            <a
              href={printHref}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-gray-50 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              Imprimir / PDF
            </a>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Compliance summary cards                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <p className="text-sm text-foreground-secondary">Total tareas</p>
          <p className="text-3xl font-bold text-foreground mt-1">{compliance.total}</p>
        </Card>
        <Card>
          <p className="text-sm text-foreground-secondary">Completadas</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{compliance.completed}</p>
        </Card>
        <Card>
          <p className="text-sm text-foreground-secondary">Pendientes / Vencidas</p>
          <p className="text-3xl font-bold text-amber-600 mt-1">
            {compliance.pending + compliance.overdue}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-foreground-secondary">Cumplimiento</p>
          <p className="text-3xl font-bold text-blue-600 mt-1">
            {compliance.compliancePercent}%
          </p>
        </Card>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Progress bar                                                         */}
      {/* ------------------------------------------------------------------ */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-foreground">Progreso de cumplimiento</p>
          <p className="text-sm font-semibold text-foreground">{compliance.compliancePercent}%</p>
        </div>
        <div
          className="h-3 bg-gray-100 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={compliance.compliancePercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Porcentaje de cumplimiento"
        >
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-500"
            style={{ width: `${compliance.compliancePercent}%` }}
          />
        </div>
        <p className="text-xs text-foreground-secondary mt-2">
          {compliance.completed} de {compliance.total - compliance.skipped} tareas completadas
          {compliance.skipped > 0 && ` (${compliance.skipped} omitidas no cuentan)`}
        </p>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Task detail list (client component)                                  */}
      {/* ------------------------------------------------------------------ */}
      <section aria-label="Detalle de tareas" className="mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-3">Detalle de tareas</h2>
        <ReportTaskList tasks={data.tasks} />
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Summary row: cost + attachments                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <p className="text-sm text-foreground-secondary mb-1">Total materiales</p>
          <p className="text-2xl font-bold text-foreground">
            {formatCurrency(data.totalMaterialsCost)}
          </p>
        </Card>
        <Card>
          <div className="flex items-center gap-2 mb-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-foreground-secondary"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
            <p className="text-sm text-foreground-secondary">Total evidencias</p>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {data.totalAttachments}{' '}
            <span className="text-base font-normal text-foreground-secondary">
              {data.totalAttachments === 1 ? 'archivo' : 'archivos'}
            </span>
          </p>
        </Card>
      </div>
    </div>
  )
}
