'use client'

import { useEffect, useState } from 'react'
import { enterDemo } from '@/actions/demo'

export default function DemoPage() {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    enterDemo().then(result => {
      if (result?.error) {
        setError(result.error)
      }
    })
  }, [])

  return (
    <div className="min-h-screen bg-neu-bg flex items-center justify-center">
      <div className="bg-neu-bg rounded-2xl shadow-neu-lg p-12 text-center max-w-sm">
        {error ? (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-50 flex items-center justify-center shadow-neu-inset">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <p className="text-red-600 font-medium mb-4">{error}</p>
            <a
              href="/"
              className="text-blue-600 hover:underline text-sm"
            >
              Volver al inicio
            </a>
          </>
        ) : (
          <>
            <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
            <h2 className="text-lg font-semibold mb-2">Preparando Demo</h2>
            <p className="text-foreground-secondary text-sm">
              Cargando planta de demostracion...
            </p>
          </>
        )}
      </div>
    </div>
  )
}
