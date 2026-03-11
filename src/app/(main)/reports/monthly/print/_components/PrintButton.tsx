'use client'

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="no-print px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
    >
      Imprimir / Guardar PDF
    </button>
  )
}
