import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getMonthlyReportData } from '@/actions/reports'
import type { MonthlyReportData, ReportTask } from '@/actions/reports'
import { PrintButton } from './_components/PrintButton'

export const metadata = { title: 'Reporte Mensual (Impresion) | Bitalize Cloud Mantenimiento' }

// ------------------------------------------------------------------
// Format helpers
// ------------------------------------------------------------------

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

function formatDateTime(isoStr: string): string {
  const d = new Date(isoStr)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatCurrency(amount: number): string {
  return '$' + amount.toLocaleString('es-CL')
}

function formatChecklistValue(value: string, itemType: string): string {
  if (itemType === 'bool') {
    return value === 'true' ? 'Si' : 'No'
  }
  return value
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    completed: 'Completada',
    pending: 'Pendiente',
    overdue: 'Vencida',
    skipped: 'Omitida',
  }
  return labels[status] ?? status
}

// ------------------------------------------------------------------
// Cell style shared across all tables
// ------------------------------------------------------------------

const cellStyle: React.CSSProperties = {
  border: '1px solid #d1d5db',
  padding: '4px 8px',
  fontSize: '10pt',
  verticalAlign: 'top',
}

const headerCellStyle: React.CSSProperties = {
  ...cellStyle,
  backgroundColor: '#f3f4f6',
  fontWeight: 600,
  fontSize: '9pt',
}

// ------------------------------------------------------------------
// Sub-section: checklist responses for a task
// ------------------------------------------------------------------

function ChecklistSection({ task, index }: { task: ReportTask; index: number }) {
  if (task.checklistItems.length === 0) return null

  return (
    <div style={{ marginTop: '16px', pageBreakInside: 'avoid' }}>
      <p style={{ fontSize: '10pt', fontWeight: 600, marginBottom: '4px', color: '#374151' }}>
        Checklist: #{index + 1} {task.taskDescription}
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...headerCellStyle, width: '45%' }}>Item</th>
            <th style={{ ...headerCellStyle, width: '20%' }}>Valor</th>
            <th style={{ ...headerCellStyle, width: '35%' }}>Nota</th>
          </tr>
        </thead>
        <tbody>
          {task.checklistItems.map((item, i) => (
            <tr key={i}>
              <td style={cellStyle}>{item.label}</td>
              <td style={cellStyle}>{formatChecklistValue(item.value, item.itemType)}</td>
              <td style={cellStyle}>{item.note ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ------------------------------------------------------------------
// Sub-section: materials summary
// ------------------------------------------------------------------

function MaterialsSection({ data }: { data: MonthlyReportData }) {
  const allMaterials: Array<{ taskDesc: string; desc: string; qty: number; unit: string; cost: number | null }> = []

  for (const task of data.tasks) {
    for (const mat of task.materials) {
      allMaterials.push({
        taskDesc: task.taskDescription,
        desc: mat.description,
        qty: mat.quantity,
        unit: mat.unit,
        cost: mat.unitCost,
      })
    }
  }

  if (allMaterials.length === 0) return null

  return (
    <div style={{ marginTop: '24px', pageBreakInside: 'avoid' }}>
      <p style={{ fontSize: '12pt', fontWeight: 700, marginBottom: '8px', borderBottom: '2px solid #d1d5db', paddingBottom: '4px' }}>
        Resumen de Materiales
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...headerCellStyle, width: '30%' }}>Tarea</th>
            <th style={{ ...headerCellStyle, width: '30%' }}>Material</th>
            <th style={{ ...headerCellStyle, width: '12%', textAlign: 'right' }}>Cantidad</th>
            <th style={{ ...headerCellStyle, width: '12%' }}>Unidad</th>
            <th style={{ ...headerCellStyle, width: '16%', textAlign: 'right' }}>Costo</th>
          </tr>
        </thead>
        <tbody>
          {allMaterials.map((m, i) => (
            <tr key={i}>
              <td style={cellStyle}>{m.taskDesc}</td>
              <td style={cellStyle}>{m.desc}</td>
              <td style={{ ...cellStyle, textAlign: 'right' }}>{m.qty}</td>
              <td style={cellStyle}>{m.unit}</td>
              <td style={{ ...cellStyle, textAlign: 'right' }}>
                {m.cost != null ? formatCurrency(m.qty * m.cost) : '—'}
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={4} style={{ ...cellStyle, fontWeight: 600, textAlign: 'right', backgroundColor: '#f3f4f6' }}>
              Total materiales
            </td>
            <td style={{ ...cellStyle, fontWeight: 700, textAlign: 'right', backgroundColor: '#f3f4f6' }}>
              {formatCurrency(data.totalMaterialsCost)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ------------------------------------------------------------------
// Sub-section: attachments list
// ------------------------------------------------------------------

function AttachmentsSection({ data }: { data: MonthlyReportData }) {
  const taskWithAttachments = data.tasks.filter(t => t.attachments.length > 0)
  if (taskWithAttachments.length === 0) return null

  return (
    <div style={{ marginTop: '24px' }}>
      <p style={{ fontSize: '12pt', fontWeight: 700, marginBottom: '8px', borderBottom: '2px solid #d1d5db', paddingBottom: '4px' }}>
        Evidencias Adjuntas
      </p>
      {taskWithAttachments.map((task, i) => (
        <div key={i} style={{ marginBottom: '16px', pageBreakInside: 'avoid' }}>
          <p style={{ fontSize: '10pt', fontWeight: 600, marginBottom: '8px', color: '#374151' }}>
            {task.taskDescription} ({formatDate(task.scheduledDate)})
          </p>
          {/* Image grid */}
          {task.attachments.filter(a => a.category === 'image' && a.signedUrl).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
              {task.attachments
                .filter(a => a.category === 'image' && a.signedUrl)
                .map((att, j) => (
                  <div key={j} style={{ pageBreakInside: 'avoid' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={att.signedUrl!}
                      alt={att.fileName}
                      style={{
                        width: '200px',
                        height: '150px',
                        objectFit: 'cover',
                        borderRadius: '4px',
                        border: '1px solid #d1d5db',
                      }}
                    />
                    <p style={{ fontSize: '7pt', color: '#6b7280', marginTop: '2px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {att.fileName}
                    </p>
                  </div>
                ))}
            </div>
          )}
          {/* Non-image files listed */}
          {task.attachments.filter(a => a.category !== 'image' || !a.signedUrl).length > 0 && (
            <ul style={{ margin: 0, paddingLeft: '20px', listStyleType: 'disc' }}>
              {task.attachments
                .filter(a => a.category !== 'image' || !a.signedUrl)
                .map((att, j) => (
                  <li key={j} style={{ fontSize: '9pt', color: '#4b5563', marginBottom: '2px' }}>
                    {att.fileName}{' '}
                    <span style={{ color: '#9ca3af' }}>
                      ({att.category}, {Math.round(att.fileSize / 1024)} KB)
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}

// ------------------------------------------------------------------
// Page
// ------------------------------------------------------------------

export default async function PrintReportPage({
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
      <div style={{ padding: '32px', fontFamily: 'sans-serif' }}>
        <p style={{ color: '#dc2626', fontWeight: 600 }}>Error al cargar el reporte</p>
        <p style={{ color: '#6b7280', marginTop: '4px', fontSize: '14px' }}>
          {!result.success ? result.error : 'No se pudo obtener la informacion del plan.'}
        </p>
        <Link
          href="/reports"
          style={{ color: '#2563eb', fontSize: '14px', display: 'inline-block', marginTop: '16px' }}
        >
          &larr; Volver a Informes
        </Link>
      </div>
    )
  }

  const data: MonthlyReportData = result.data
  const { compliance } = data
  const backHref = `/reports/monthly?planId=${planId}&year=${year}&month=${month}`
  const tasksWithChecklist = data.tasks.filter(t => t.checklistItems.length > 0)

  return (
    <>
      {/* Print styles injected via <style> tag for full print fidelity */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 11pt; margin: 0; }
          table { page-break-inside: avoid; }
          @page { size: A4 portrait; margin: 15mm 15mm 20mm 15mm; }
        }
        body { background: white; }
      `}</style>

      <main
        style={{
          fontFamily: 'Arial, Helvetica, sans-serif',
          color: '#111827',
          backgroundColor: 'white',
          maxWidth: '210mm',
          margin: '0 auto',
          padding: '24px 32px',
        }}
      >
        {/* ---------------------------------------------------------------- */}
        {/* Top action bar (hidden on print)                                  */}
        {/* ---------------------------------------------------------------- */}
        <div
          className="no-print"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px',
            paddingBottom: '16px',
            borderBottom: '1px solid #e5e7eb',
          }}
        >
          <Link
            href={backHref}
            style={{ color: '#2563eb', fontSize: '14px', textDecoration: 'none' }}
          >
            &larr; Volver al reporte
          </Link>
          <PrintButton />
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Report header                                                      */}
        {/* ---------------------------------------------------------------- */}
        <header style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '9pt', color: '#6b7280', marginBottom: '2px', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Bitalize Cloud Mantenimiento
              </p>
              <h1 style={{ fontSize: '18pt', fontWeight: 700, margin: 0, color: '#111827' }}>
                Reporte Mensual de Mantenimiento
              </h1>
            </div>
            <div style={{ textAlign: 'right', fontSize: '9pt', color: '#6b7280' }}>
              <p style={{ margin: 0 }}>Generado: {formatDateTime(data.generatedAt)}</p>
            </div>
          </div>

          <div
            style={{
              marginTop: '12px',
              padding: '10px 14px',
              backgroundColor: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
            }}
          >
            <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: '8pt', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>Plan</span>
                <p style={{ margin: '2px 0 0', fontSize: '11pt', fontWeight: 600, color: '#111827' }}>{data.planName}</p>
              </div>
              <div>
                <span style={{ fontSize: '8pt', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>Sitio</span>
                <p style={{ margin: '2px 0 0', fontSize: '11pt', fontWeight: 600, color: '#111827' }}>{data.siteName}</p>
              </div>
              <div>
                <span style={{ fontSize: '8pt', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>Periodo</span>
                <p style={{ margin: '2px 0 0', fontSize: '11pt', fontWeight: 600, color: '#111827' }}>
                  {data.month} {data.year}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* ---------------------------------------------------------------- */}
        {/* Compliance summary table                                          */}
        {/* ---------------------------------------------------------------- */}
        <section style={{ marginBottom: '20px', pageBreakInside: 'avoid' }}>
          <p style={{ fontSize: '12pt', fontWeight: 700, marginBottom: '8px', borderBottom: '2px solid #d1d5db', paddingBottom: '4px' }}>
            Resumen de Cumplimiento
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...headerCellStyle, textAlign: 'center', width: '25%' }}>Total</th>
                <th style={{ ...headerCellStyle, textAlign: 'center', width: '25%' }}>Completadas</th>
                <th style={{ ...headerCellStyle, textAlign: 'center', width: '25%' }}>Pend. / Vencidas</th>
                <th style={{ ...headerCellStyle, textAlign: 'center', width: '25%' }}>Cumplimiento</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...cellStyle, textAlign: 'center', fontSize: '16pt', fontWeight: 700 }}>
                  {compliance.total}
                </td>
                <td style={{ ...cellStyle, textAlign: 'center', fontSize: '16pt', fontWeight: 700, color: '#16a34a' }}>
                  {compliance.completed}
                </td>
                <td style={{ ...cellStyle, textAlign: 'center', fontSize: '16pt', fontWeight: 700, color: '#d97706' }}>
                  {compliance.pending + compliance.overdue}
                </td>
                <td style={{ ...cellStyle, textAlign: 'center', fontSize: '16pt', fontWeight: 700, color: '#2563eb' }}>
                  {compliance.compliancePercent}%
                </td>
              </tr>
            </tbody>
          </table>
          {compliance.skipped > 0 && (
            <p style={{ fontSize: '9pt', color: '#6b7280', marginTop: '4px' }}>
              * {compliance.skipped} tarea{compliance.skipped > 1 ? 's' : ''} omitida{compliance.skipped > 1 ? 's' : ''} no se incluye{compliance.skipped > 1 ? 'n' : ''} en el calculo.
            </p>
          )}
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Tasks table                                                        */}
        {/* ---------------------------------------------------------------- */}
        <section style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '12pt', fontWeight: 700, marginBottom: '8px', borderBottom: '2px solid #d1d5db', paddingBottom: '4px' }}>
            Detalle de Tareas
          </p>
          {data.tasks.length === 0 ? (
            <p style={{ fontSize: '10pt', color: '#6b7280' }}>No hay tareas para este periodo.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...headerCellStyle, width: '5%', textAlign: 'center' }}>#</th>
                  <th style={{ ...headerCellStyle, width: '12%' }}>Fecha</th>
                  <th style={{ ...headerCellStyle, width: '45%' }}>Tarea</th>
                  <th style={{ ...headerCellStyle, width: '20%' }}>Categoria</th>
                  <th style={{ ...headerCellStyle, width: '18%' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.tasks.map((task, i) => (
                  <tr key={i}>
                    <td style={{ ...cellStyle, textAlign: 'center', color: '#6b7280' }}>{i + 1}</td>
                    <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>{formatDate(task.scheduledDate)}</td>
                    <td style={cellStyle}>{task.taskDescription}</td>
                    <td style={cellStyle}>{task.categoryName}</td>
                    <td style={cellStyle}>{statusLabel(task.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Checklist responses (per task)                                    */}
        {/* ---------------------------------------------------------------- */}
        {tasksWithChecklist.length > 0 && (
          <section style={{ marginBottom: '20px' }}>
            <p style={{ fontSize: '12pt', fontWeight: 700, marginBottom: '8px', borderBottom: '2px solid #d1d5db', paddingBottom: '4px' }}>
              Respuestas de Checklist
            </p>
            {data.tasks.map((task, i) => (
              <ChecklistSection key={i} task={task} index={i} />
            ))}
          </section>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Materials summary                                                  */}
        {/* ---------------------------------------------------------------- */}
        <MaterialsSection data={data} />

        {/* ---------------------------------------------------------------- */}
        {/* Attachments list                                                   */}
        {/* ---------------------------------------------------------------- */}
        <AttachmentsSection data={data} />

        {/* ---------------------------------------------------------------- */}
        {/* Footer                                                             */}
        {/* ---------------------------------------------------------------- */}
        <footer
          style={{
            marginTop: '32px',
            paddingTop: '12px',
            borderTop: '1px solid #e5e7eb',
            fontSize: '8pt',
            color: '#9ca3af',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>Bitalize Cloud Mantenimiento</span>
          <span>
            {data.planName} — {data.month} {data.year}
          </span>
          <span>Generado: {formatDateTime(data.generatedAt)}</span>
        </footer>
      </main>
    </>
  )
}
