'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useDemo } from '@/hooks/useDemo'
import { exitDemo } from '@/actions/demo'

type UserRole = 'owner' | 'ops' | 'admin' | 'tech'

interface NavItem {
  href: string
  label: string
  icon: React.FC<{ className?: string }>
  roles: UserRole[]
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: HomeIcon, roles: ['owner', 'ops', 'admin', 'tech'] },
  { href: '/maintenance/new', label: 'Nuevo Registro', icon: PlusIcon, roles: ['tech', 'admin', 'ops'] },
  { href: '/maintenance', label: 'Registros', icon: ClipboardIcon, roles: ['owner', 'ops', 'admin', 'tech'] },
  { href: '/plans', label: 'Planes', icon: CalendarPlanIcon, roles: ['owner', 'ops', 'admin'] },
  { href: '/calendar', label: 'Calendario', icon: CalendarIcon, roles: ['owner', 'ops', 'admin', 'tech'] },
  { href: '/reports', label: 'Informes', icon: ChartIcon, roles: ['owner', 'ops', 'admin'] },
  { href: '/sites', label: 'Sitios', icon: MapIcon, roles: ['owner', 'ops', 'admin'] },
  { href: '/assets', label: 'Activos', icon: CpuIcon, roles: ['owner', 'ops', 'admin'] },
  { href: '/admin/users', label: 'Usuarios', icon: UsersIcon, roles: ['owner', 'admin'] },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { isDemo } = useDemo()
  const [userRole, setUserRole] = useState<UserRole>('tech')
  const [userName, setUserName] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: member } = await supabase
          .from('organization_members')
          .select('role')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle()

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', user.id)
          .maybeSingle()

        if (member) setUserRole(member.role as UserRole)
        setUserName(profile?.full_name || user.email?.split('@')[0] || 'Usuario')
      }
      setIsLoading(false)
    }

    fetchUser()
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const closeMobileMenu = () => setIsMobileOpen(false)

  const filteredNavItems = navItems.filter(item => {
    if (isDemo) {
      // In demo mode, show all read-only sections (hide only admin/users)
      return item.href !== '/admin/users'
    }
    return item.roles.includes(userRole)
  })

  const roleBadges: Record<UserRole, { label: string; color: string }> = {
    owner: { label: 'Owner', color: 'bg-purple-500' },
    ops: { label: 'Operaciones', color: 'bg-blue-500' },
    admin: { label: 'Admin', color: 'bg-amber-500' },
    tech: { label: 'Tecnico', color: 'bg-green-500' },
  }

  const badge = roleBadges[userRole]

  return (
    <>
      {/* Mobile top bar — visible only below lg */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 z-50 bg-[#1e3a5f] flex items-center justify-between px-4 shadow-[0_2px_8px_#142942]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-[inset_2px_2px_4px_#142942,inset_-2px_-2px_4px_#284b7c]">
            <WrenchIcon className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-semibold text-base">Bitalize Cloud</span>
        </div>
        <button
          type="button"
          aria-label="Abrir menú de navegación"
          aria-expanded={isMobileOpen}
          onClick={() => setIsMobileOpen(true)}
          className="p-2 rounded-lg text-white/80 hover:text-white hover:shadow-[3px_3px_6px_#142942,-3px_-3px_6px_#284b7c] transition-shadow duration-200"
        >
          <HamburgerIcon className="w-6 h-6" />
        </button>
      </div>

      {/* Backdrop overlay — mobile only */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          aria-hidden="true"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 bottom-0 w-64 bg-[#1e3a5f] text-white flex flex-col z-40
          shadow-[6px_0_12px_#142942]
          transition-transform duration-300 ease-in-out
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
        aria-label="Navegación principal"
      >
        {/* Logo */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <Link
            href="/dashboard"
            onClick={closeMobileMenu}
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-[inset_3px_3px_6px_#142942,inset_-3px_-3px_6px_#284b7c]">
              <WrenchIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-lg">Bitalize Cloud</h1>
              <p className="text-xs text-white/60">Mantenimiento</p>
            </div>
          </Link>
          {/* Close button — mobile only */}
          <button
            type="button"
            aria-label="Cerrar menú de navegación"
            onClick={closeMobileMenu}
            className="lg:hidden p-2 rounded-lg text-white/70 hover:text-white hover:shadow-[3px_3px_6px_#142942,-3px_-3px_6px_#284b7c] transition-shadow duration-200"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* User Info */}
        <div className="px-4 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-[inset_3px_3px_6px_#142942,inset_-3px_-3px_6px_#284b7c]">
              <span className="text-sm font-semibold">
                {userName.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{userName}</p>
              <div className="flex items-center gap-1">
                <span className={`inline-flex text-[10px] px-2 py-0.5 rounded-full ${badge.color} text-white`}>
                  {badge.label}
                </span>
                {isDemo && (
                  <span className="inline-flex text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-white">
                    DEMO
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto" aria-label="Menú principal">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-12 bg-white/10 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            filteredNavItems.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(item.href))
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMobileMenu}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-xl
                    transition-shadow duration-200
                    ${isActive
                      ? 'text-white shadow-[inset_3px_3px_6px_#142942,inset_-3px_-3px_6px_#284b7c]'
                      : 'text-white/70 hover:shadow-[3px_3px_6px_#142942,-3px_-3px_6px_#284b7c] hover:text-white'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              )
            })
          )}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          {isDemo ? (
            <form action={exitDemo}>
              <button
                type="submit"
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white/70 hover:shadow-[3px_3px_6px_#142942,-3px_-3px_6px_#284b7c] hover:text-white transition-shadow duration-200"
              >
                <LogoutIcon className="w-5 h-5" />
                <span className="font-medium">Salir del Demo</span>
              </button>
            </form>
          ) : (
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white/70 hover:shadow-[3px_3px_6px_#142942,-3px_-3px_6px_#284b7c] hover:text-white transition-shadow duration-200"
            >
              <LogoutIcon className="w-5 h-5" />
              <span className="font-medium">Cerrar Sesion</span>
            </button>
          )}
        </div>
      </aside>
    </>
  )
}

// Icons
function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  )
}

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  )
}

function MapIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function CpuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
    </svg>
  )
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}

function WrenchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function CalendarPlanIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  )
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  )
}

function HamburgerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
