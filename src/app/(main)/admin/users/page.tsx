import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { UserManagement } from './UserManagement'

export const metadata = {
  title: 'Gestion de Usuarios | Bitalize Cloud Mantenimiento'
}

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Verificar que sea owner o admin via organization_members
  const { data: member } = await supabase
    .from('organization_members')
    .select('role, org_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!member || !['owner', 'admin'].includes(member.role)) {
    redirect('/dashboard')
  }

  // Obtener miembros de la misma organizacion
  const { data: members } = await supabase
    .from('organization_members')
    .select('user_id, role, created_at, profiles(full_name, email)')
    .eq('org_id', member.org_id)
    .order('created_at', { ascending: false })

  const users = (members || []).map(m => ({
    user_id: m.user_id,
    role: m.role as 'owner' | 'ops' | 'admin' | 'tech',
    created_at: m.created_at,
    full_name: (m.profiles as unknown as { full_name: string | null; email: string })?.full_name || '',
    email: (m.profiles as unknown as { full_name: string | null; email: string })?.email || '',
  }))

  const stats = {
    total: users.length,
    owners: users.filter(u => u.role === 'owner').length,
    ops: users.filter(u => u.role === 'ops').length,
    admins: users.filter(u => u.role === 'admin').length,
    techs: users.filter(u => u.role === 'tech').length,
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Gestion de Usuarios</h1>
        <p className="text-foreground-secondary mt-1">
          Administra miembros y asigna roles de tu organizacion
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <Card className="p-4">
          <p className="text-sm text-foreground-secondary">Total</p>
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
        </Card>
        <Card className="p-4 border-l-4 border-purple-500">
          <p className="text-sm text-foreground-secondary">Owners</p>
          <p className="text-2xl font-bold text-purple-600">{stats.owners}</p>
        </Card>
        <Card className="p-4 border-l-4 border-blue-500">
          <p className="text-sm text-foreground-secondary">Operaciones</p>
          <p className="text-2xl font-bold text-blue-600">{stats.ops}</p>
        </Card>
        <Card className="p-4 border-l-4 border-amber-500">
          <p className="text-sm text-foreground-secondary">Admins</p>
          <p className="text-2xl font-bold text-amber-600">{stats.admins}</p>
        </Card>
        <Card className="p-4 border-l-4 border-green-500">
          <p className="text-sm text-foreground-secondary">Tecnicos</p>
          <p className="text-2xl font-bold text-green-600">{stats.techs}</p>
        </Card>
      </div>

      <UserManagement initialUsers={users} orgId={member.org_id} />
    </div>
  )
}
