'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type UserRole = 'owner' | 'ops' | 'admin' | 'tech'

interface OrgMember {
  user_id: string
  role: UserRole
  created_at: string
  full_name: string
  email: string
}

interface UserManagementProps {
  initialUsers: OrgMember[]
  orgId: string
}

const ROLES: { value: UserRole; label: string; color: string }[] = [
  { value: 'owner', label: 'Owner', color: 'bg-purple-100 text-purple-700' },
  { value: 'ops', label: 'Operaciones', color: 'bg-blue-100 text-blue-700' },
  { value: 'admin', label: 'Admin', color: 'bg-amber-100 text-amber-700' },
  { value: 'tech', label: 'Tecnico', color: 'bg-green-100 text-green-700' },
]

export function UserManagement({ initialUsers, orgId }: UserManagementProps) {
  const [users, setUsers] = useState(initialUsers)
  const [filter, setFilter] = useState<UserRole | 'all'>('all')
  const [search, setSearch] = useState('')
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const filteredUsers = users.filter(user => {
    const matchesFilter = filter === 'all' || user.role === filter
    const matchesSearch =
      user.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setSaving(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('organization_members')
      .update({ role: newRole })
      .eq('user_id', userId)
      .eq('org_id', orgId)

    if (!error) {
      setUsers(users.map(u =>
        u.user_id === userId ? { ...u, role: newRole } : u
      ))
    }

    setSaving(false)
    setEditingUser(null)
  }

  const getRoleBadge = (role: UserRole) => {
    return ROLES.find(r => r.value === role) || ROLES[3]
  }

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b border-[#b8b9be] bg-neu-bg flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 bg-neu-bg shadow-neu-inset rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-slate-800 text-white'
                : 'bg-neu-bg shadow-neu-sm text-foreground-secondary hover:shadow-neu-inset-sm'
            }`}
          >
            Todos
          </button>
          {ROLES.map(role => (
            <button
              key={role.value}
              onClick={() => setFilter(role.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                filter === role.value
                  ? 'bg-slate-800 text-white'
                  : 'bg-neu-bg shadow-neu-sm text-foreground-secondary hover:shadow-neu-inset-sm'
              }`}
            >
              {role.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-neu-bg border-b border-[#b8b9be]">
            <tr>
              <th className="text-left px-6 py-4 text-sm font-semibold text-foreground-secondary">Usuario</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-foreground-secondary">Email</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-foreground-secondary">Rol</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-foreground-secondary">Registrado</th>
              <th className="text-right px-6 py-4 text-sm font-semibold text-foreground-secondary">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-transparent">
            {filteredUsers.map((user) => {
              const roleBadge = getRoleBadge(user.role)
              const isEditing = editingUser === user.user_id

              return (
                <tr key={user.user_id} className="hover:shadow-neu-inset-sm transition-all rounded-lg">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                        <span className="text-sm font-semibold text-slate-600">
                          {user.full_name?.slice(0, 2).toUpperCase() || user.email.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <p className="font-medium text-foreground">
                        {user.full_name || 'Sin nombre'}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-foreground-secondary">
                    {user.email}
                  </td>
                  <td className="px-6 py-4">
                    {isEditing ? (
                      <div className="flex gap-2 flex-wrap">
                        {ROLES.map(role => (
                          <button
                            key={role.value}
                            onClick={() => handleRoleChange(user.user_id, role.value)}
                            disabled={saving}
                            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                              user.role === role.value
                                ? `${role.color} ring-2 ring-offset-2 ring-slate-400`
                                : 'bg-neu-bg shadow-neu-sm text-gray-600 hover:shadow-neu-inset-sm'
                            }`}
                          >
                            {role.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className={`px-3 py-1 rounded-lg text-xs font-medium ${roleBadge.color}`}>
                        {roleBadge.label}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-foreground-secondary">
                    {new Date(user.created_at).toLocaleDateString('es-CL', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {isEditing ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingUser(null)}
                      >
                        Cancelar
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingUser(user.user_id)}
                      >
                        Cambiar Rol
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <p className="text-foreground-secondary">No se encontraron usuarios</p>
          </div>
        )}
      </div>
    </Card>
  )
}
