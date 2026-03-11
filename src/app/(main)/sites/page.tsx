import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SitesList } from '@/components/sites/SitesList'
import type { SiteType } from '@/types/database'

export const metadata = { title: 'Sitios | Bitalize Cloud Mantenimiento' }

export default async function SitesPage() {
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

  const { data: sites } = await supabase
    .from('sites')
    .select('*, assets(count)')
    .eq('org_id', member.org_id)
    .order('name')

  const sitesWithCount = (sites || []).map(s => ({
    id: s.id as string,
    name: s.name as string,
    commune: s.commune as string,
    region: s.region as string,
    type: s.type as SiteType,
    asset_count: (s.assets as unknown as { count: number }[])?.[0]?.count ?? 0,
  }))

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sitios</h1>
          <p className="text-foreground-secondary mt-1">
            {sitesWithCount.length} sitio{sitesWithCount.length !== 1 ? 's' : ''} registrado{sitesWithCount.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/sites/new">
          <Button>Nuevo Sitio</Button>
        </Link>
      </div>

      <SitesList sites={sitesWithCount} />
    </div>
  )
}
