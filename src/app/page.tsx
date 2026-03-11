import Link from 'next/link'
import Image from 'next/image'
import { LeadForm } from '@/components/landing/LeadForm'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-neu-bg">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-neu-bg/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1e3a5f] flex items-center justify-center shadow-neu-sm">
              <WrenchIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="font-semibold text-lg text-foreground">Bitalize Cloud</span>
              <span className="text-foreground-secondary text-sm ml-1">Mantenimiento</span>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="#features" className="text-foreground-secondary hover:text-foreground transition-colors">Funcionalidades</a>
            <a href="#screenshots" className="text-foreground-secondary hover:text-foreground transition-colors">Plataforma</a>
            <a href="#contacto" className="text-foreground-secondary hover:text-foreground transition-colors">Contacto</a>
            <Link href="/login" className="text-foreground-secondary hover:text-foreground transition-colors">Iniciar Sesion</Link>
            <Link
              href="/demo"
              className="bg-blue-600 text-white px-4 py-2 rounded-xl font-medium shadow-neu-sm hover:shadow-neu-inset-sm transition-shadow"
            >
              Probar Demo
            </Link>
          </nav>
          <Link
            href="/demo"
            className="md:hidden bg-blue-600 text-white px-4 py-2 rounded-xl font-medium text-sm shadow-neu-sm"
          >
            Demo
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-20 md:py-28">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium mb-6 shadow-neu-sm">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            Plataforma en la nube
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6">
            Gestion de mantenimiento{' '}
            <span className="text-blue-600">inteligente</span>{' '}
            para plantas de energia
          </h1>
          <p className="text-lg md:text-xl text-foreground-secondary leading-relaxed mb-8 max-w-2xl">
            Centraliza registros, activos, planes preventivos y reportes de tus plantas
            fotovoltaicas y diesel en una sola plataforma. Sin papel, sin Excel, sin complicaciones.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/demo"
              className="bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold text-lg shadow-neu-sm hover:shadow-neu-inset-sm transition-shadow"
            >
              Probar Demo Gratis
            </Link>
            <a
              href="#contacto"
              className="bg-neu-bg text-foreground px-8 py-4 rounded-xl font-semibold text-lg shadow-neu hover:shadow-neu-inset transition-shadow"
            >
              Solicitar Informacion
            </a>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { value: '100%', label: 'En la nube' },
            { value: '5+', label: 'Niveles de activos' },
            { value: '3', label: 'Tipos de mantenimiento' },
            { value: '24/7', label: 'Acceso en terreno' },
          ].map((stat) => (
            <div key={stat.label} className="bg-neu-bg rounded-xl shadow-neu p-6 text-center">
              <div className="text-2xl md:text-3xl font-bold text-blue-600">{stat.value}</div>
              <div className="text-sm text-foreground-secondary mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Todo lo que necesitas para gestionar mantenimiento
          </h2>
          <p className="text-foreground-secondary text-lg max-w-2xl mx-auto">
            Desde el registro en terreno hasta el reporte ejecutivo, cubrimos todo el ciclo de mantenimiento.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div key={feature.title} className="bg-neu-bg rounded-2xl shadow-neu p-8 hover:shadow-neu-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shadow-neu-inset mb-5">
                <feature.icon className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-foreground-secondary text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Screenshots */}
      <section id="screenshots" className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Conoce la plataforma
          </h2>
          <p className="text-foreground-secondary text-lg max-w-2xl mx-auto">
            Interfaz moderna e intuitiva disenada para equipos en terreno y oficina.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {screenshots.map((shot) => (
            <div key={shot.label} className="bg-neu-bg rounded-2xl shadow-neu overflow-hidden">
              <div className="aspect-video relative">
                <Image
                  src={shot.image}
                  alt={shot.label}
                  fill
                  className="object-cover object-top"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-foreground">{shot.title}</h3>
                <p className="text-foreground-secondary text-sm">{shot.description}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center mt-8">
          <Link
            href="/demo"
            className="inline-flex bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold shadow-neu-sm hover:shadow-neu-inset-sm transition-shadow"
          >
            Explorar Demo Interactivo
          </Link>
        </div>
      </section>

      {/* Contact / Lead Form */}
      <section id="contacto" className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Lleva tu mantenimiento al siguiente nivel
            </h2>
            <p className="text-foreground-secondary text-lg mb-8">
              Solicita una evaluacion gratuita. Nuestro equipo analizara tus necesidades
              y te mostrara como Bitalize Cloud puede transformar la gestion de mantenimiento
              de tu planta.
            </p>
            <div className="space-y-4">
              {[
                'Configuracion personalizada para tu operacion',
                'Migracion de datos historicos',
                'Capacitacion para tu equipo',
                'Soporte tecnico dedicado',
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <CheckSmallIcon className="w-4 h-4 text-green-600" />
                  </div>
                  <span className="text-foreground-secondary">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <LeadForm />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-foreground-muted/20 mt-8">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-foreground-secondary text-sm">
            <WrenchIcon className="w-5 h-5" />
            <span>Bitalize Cloud Mantenimiento</span>
          </div>
          <p className="text-foreground-muted text-sm">
            &copy; {new Date().getFullYear()} Bitalize. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  )
}

const features = [
  {
    title: 'Registros de Mantenimiento',
    description: 'Crea registros preventivos y correctivos con checklists, materiales y fotos adjuntas. Todo queda documentado.',
    icon: ClipboardIcon,
  },
  {
    title: 'Arbol de Activos',
    description: 'Organiza inversores, strings, paneles y equipos diesel en una jerarquia de hasta 5 niveles.',
    icon: CpuIcon,
  },
  {
    title: 'Planes Preventivos',
    description: 'Programa mantenimientos recurrentes con frecuencias personalizadas. Generacion automatica de tareas.',
    icon: CalendarIcon,
  },
  {
    title: 'Informes y Metricas',
    description: 'Visualiza KPIs de cumplimiento, tasas de falla y costos de materiales en dashboards interactivos.',
    icon: ChartIcon,
  },
  {
    title: 'Multi-Sitio',
    description: 'Gestiona multiples plantas desde una sola cuenta. Cada sitio con sus propios activos y equipos.',
    icon: MapIcon,
  },
  {
    title: 'Roles y Permisos',
    description: 'Control de acceso granular con 4 roles: Owner, Operaciones, Admin y Tecnico.',
    icon: ShieldIcon,
  },
]

const screenshots = [
  {
    label: 'Vista del dashboard',
    title: 'Dashboard',
    description: 'Resumen ejecutivo con KPIs, registros recientes y estado de plantas.',
    image: '/screenshots/dashboard.png',
  },
  {
    label: 'Gestion de activos',
    title: 'Arbol de Activos',
    description: 'Jerarquia completa de equipos con detalles tecnicos y estado.',
    image: '/screenshots/activos.png',
  },
  {
    label: 'Registro de mantenimiento',
    title: 'Registros',
    description: 'Formularios completos con checklist, materiales y adjuntos.',
    image: '/screenshots/registros.png',
  },
  {
    label: 'Calendario de mantenimiento',
    title: 'Calendario',
    description: 'Vista mensual de tareas programadas y mantenimientos preventivos.',
    image: '/screenshots/calendario.png',
  },
]

function WrenchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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

function CpuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
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

function MapIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function CheckSmallIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}
