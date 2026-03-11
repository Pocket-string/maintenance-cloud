import Link from 'next/link'

export default function RootNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-300 mb-4">404</h1>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Pagina no encontrada</h2>
        <p className="text-gray-500 mb-6">La pagina que buscas no existe.</p>
        <Link
          href="/dashboard"
          className="inline-flex px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
        >
          Ir al Dashboard
        </Link>
      </div>
    </div>
  )
}
