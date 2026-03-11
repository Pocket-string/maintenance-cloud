import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SiteAssetsView } from '@/components/assets/SiteAssetsView'
import { getAssetsTree } from '@/actions/assets'
import type { SiteType, AssetType, AssetStatus } from '@/types/database'

const TYPE_LABELS: Record<SiteType, { label: string; color: string }> = {
  fv_pmgd: { label: 'FV PMGD', color: 'bg-yellow-100 text-yellow-800' },
  diesel: { label: 'Diesel', color: 'bg-gray-100 text-gray-800' },
  hybrid: { label: 'Hibrido', color: 'bg-blue-100 text-blue-800' },
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: site } = await supabase.from('sites').select('name').eq('id', id).single()
  return { title: `${site?.name ?? 'Sitio'} | Bitalize Cloud Mantenimiento` }
}

export default async function SiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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

  const { data: site } = await supabase
    .from('sites')
    .select('*')
    .eq('id', id)
    .eq('org_id', member.org_id)
    .single()

  if (!site) notFound()

  const { data: assets } = await supabase
    .from('assets')
    .select('*')
    .eq('site_id', id)
    .eq('org_id', member.org_id)
    .order('name')

  const badge = TYPE_LABELS[site.type as SiteType]

  const treeResult = await getAssetsTree(id)
  const treeNodes = treeResult.success ? (treeResult.data ?? []) : []

  const assetsForList = (assets || []).map(a => ({
    id: a.id as string,
    name: a.name as string,
    type: a.type as AssetType,
    code: a.code as string | null,
    tag: a.tag as string | null,
    priority: (a.priority as number) ?? 3,
    parent_id: a.parent_id as string | null,
    brand: a.brand as string | null,
    model: a.model as string | null,
    serial: a.serial as string | null,
    status: a.status as AssetStatus,
    install_date: a.install_date as string | null,
  }))

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <Link href="/sites" className="text-sm text-foreground-secondary hover:text-foreground mb-2 inline-block">
          &larr; Volver a Sitios
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{site.name}</h1>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${badge.color}`}>
                {badge.label}
              </span>
            </div>
            <p className="text-foreground-secondary mt-1">
              {site.commune}, {site.region}
            </p>
          </div>
          <Link href={`/sites/${id}/assets/new`}>
            <Button>Agregar Activo</Button>
          </Link>
        </div>
      </div>

      {site.coordinates && (
        <Card className="mb-6">
          <p className="text-sm text-foreground-secondary">
            Coordenadas: {(site.coordinates as { lat: number; lng: number }).lat}, {(site.coordinates as { lat: number; lng: number }).lng}
          </p>
        </Card>
      )}

      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">
          Activos ({assetsForList.length})
        </h2>
      </div>

      <SiteAssetsView assets={assetsForList} treeNodes={treeNodes} siteId={id} />
    </div>
  )
}
