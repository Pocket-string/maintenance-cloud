import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { AssetForm } from '@/components/assets/AssetForm'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: site } = await supabase.from('sites').select('name').eq('id', id).single()
  return { title: `Nuevo Activo - ${site?.name ?? 'Sitio'} | Bitalize Cloud Mantenimiento` }
}

export default async function NewAssetPage({ params }: { params: Promise<{ id: string }> }) {
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
    .select('id, name')
    .eq('id', id)
    .eq('org_id', member.org_id)
    .single()

  if (!site) notFound()

  // Fetch existing assets as potential parents
  const { data: existingAssets } = await supabase
    .from('assets')
    .select('id, name, code')
    .eq('site_id', id)
    .eq('org_id', member.org_id)
    .order('name')

  const parentOptions = (existingAssets ?? []).map(a => ({
    id: a.id as string,
    name: a.name as string,
    code: a.code as string | null,
  }))

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Nuevo Activo</h1>
        <p className="text-foreground-secondary mt-1">
          Agregar activo a {site.name}
        </p>
      </div>
      <AssetForm siteId={id} parentOptions={parentOptions} />
    </div>
  )
}
