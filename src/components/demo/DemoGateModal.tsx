'use client'

import { useEffect, useRef } from 'react'

interface DemoGateModalProps {
  isOpen: boolean
  onClose: () => void
}

export function DemoGateModal({ isOpen, onClose }: DemoGateModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal()
    } else {
      dialogRef.current?.close()
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="fixed inset-0 z-[60] bg-transparent backdrop:bg-black/40"
    >
      <div className="bg-neu-bg rounded-2xl shadow-neu-lg p-8 max-w-md mx-auto animate-scale-in">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-50 flex items-center justify-center shadow-neu-inset">
            <LockIcon className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">
            Funcion Premium
          </h3>
          <p className="text-foreground-secondary mb-6">
            Esta funcionalidad requiere una cuenta activa.
            Solicita una evaluacion gratuita para tu empresa.
          </p>
          <div className="flex flex-col gap-3">
            <a
              href="/#contacto"
              onClick={onClose}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold shadow-neu-sm hover:shadow-neu-inset-sm transition-shadow"
            >
              Solicitar Evaluacion
            </a>
            <button
              onClick={onClose}
              className="text-foreground-secondary hover:text-foreground text-sm transition-colors"
            >
              Seguir explorando
            </button>
          </div>
        </div>
      </div>
    </dialog>
  )
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  )
}
