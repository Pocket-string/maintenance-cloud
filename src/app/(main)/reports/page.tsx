import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { getPlansForReports } from '@/actions/reports'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Informes | Bitalize Cloud Mantenimiento' }
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function getLastThreeMonths(now: Date): Array<{ year: number; month: number; label: string }> {
  const result = []
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const year = d.getFullYear()
    const month = d.getMonth() + 1 // 1-indexed
    result.push({ year, month, label: `${MONTH_NAMES[month - 1]} ${year}` })
  }
  return result
}

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!member) redirect('/dashboard')

  const result = await getPlansForReports()
  const plans = result.success ? (result.data ?? []) : []

  const now = new Date()
  const months = getLastThreeMonths(now)

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Informes</h1>
        <p className="text-foreground-secondary mt-1">
          Genera reportes mensuales de cumplimiento de mantenimiento
        </p>
      </div>

      {plans.length === 0 ? (
        <Card>
          <p className="text-foreground-secondary text-center py-4">
            No hay planes de mantenimiento activos. Crea un plan primero.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plans.map(plan => (
            <Card key={plan.id}>
              <p className="font-bold text-foreground">{plan.name}</p>
              <p className="text-sm text-foreground-secondary mt-0.5">{plan.siteName}</p>
              <ul className="mt-4 space-y-2">
                {months.map(({ year, month, label }) => (
                  <li key={`${year}-${month}`}>
                    <Link
                      href={`/reports/monthly?planId=${plan.id}&year=${year}&month=${month}`}
                      className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                    >
                      <span aria-hidden="true">&rarr;</span>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
