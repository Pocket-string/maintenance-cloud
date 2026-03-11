import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SiteForm } from '@/components/sites/SiteForm'

export const metadata = { title: 'Nuevo Sitio | Bitalize Cloud Mantenimiento' }

export default async function NewSitePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Nuevo Sitio</h1>
        <p className="text-foreground-secondary mt-1">Registra un nuevo sitio de operacion</p>
      </div>
      <SiteForm />
    </div>
  )
}
