'use client'

import { useDemo } from '@/hooks/useDemo'
import { exitDemo } from '@/actions/demo'

export function DemoBanner() {
  const { isDemo } = useDemo()

  if (!isDemo) return null

  return (
    <div className="sticky top-0 z-50 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-full text-xs font-semibold">
          <EyeIcon className="w-3 h-3" />
          DEMO
        </span>
        <span>Estas explorando en modo demo — solo lectura</span>
      </div>
      <div className="flex items-center gap-3">
        <a
          href="#contacto"
          className="bg-white text-blue-600 px-3 py-1 rounded-lg text-xs font-semibold hover:bg-blue-50 transition-colors"
        >
          Solicitar Acceso
        </a>
        <form action={exitDemo}>
          <button
            type="submit"
            className="text-white/80 hover:text-white text-xs underline underline-offset-2 transition-colors"
          >
            Salir del Demo
          </button>
        </form>
      </div>
    </div>
  )
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  )
}
