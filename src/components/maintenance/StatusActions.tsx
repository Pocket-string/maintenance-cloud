'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { updateRecordStatus, deleteMaintenanceRecord } from '@/actions/maintenance'
import type { RecordStatus, UserRole } from '@/types/database'

const STATUS_TRANSITIONS: Record<RecordStatus, { next: RecordStatus; label: string }[]> = {
  draft: [{ next: 'submitted', label: 'Enviar a Revision' }],
  submitted: [
    { next: 'reviewed', label: 'Marcar como Revisado' },
    { next: 'draft', label: 'Devolver a Borrador' },
  ],
  reviewed: [
    { next: 'closed', label: 'Cerrar Registro' },
    { next: 'submitted', label: 'Devolver a Enviado' },
  ],
  closed: [],
}

export function StatusActions({ recordId, currentStatus, userRole }: { recordId: string; currentStatus: RecordStatus; userRole?: UserRole }) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const transitions = STATUS_TRANSITIONS[currentStatus]

  if (transitions.length === 0) {
    return <p className="text-sm text-foreground-secondary">Este registro esta cerrado.</p>
  }

  async function handleDelete() {
    setIsPending(true)
    setError(null)
    const result = await deleteMaintenanceRecord(recordId)
    if (!result.success) {
      setError(result.error)
      setIsPending(false)
      setShowDeleteConfirm(false)
      return
    }
    router.push('/maintenance')
  }

  async function handleTransition(newStatus: RecordStatus) {
    setIsPending(true)
    setError(null)

    const result = await updateRecordStatus(recordId, newStatus)

    if (!result.success) {
      setError(result.error)
      setIsPending(false)
      return
    }

    router.refresh()
    setIsPending(false)
  }

  return (
    <div>
      {error && (
        <p className="text-sm text-red-600 mb-3">{error}</p>
      )}
      <div className="flex flex-wrap gap-3">
        {transitions.map(t => (
          <Button
            key={t.next}
            variant={t.next === 'draft' || t.next === 'submitted' ? 'outline' : 'primary'}
            onClick={() => handleTransition(t.next)}
            isLoading={isPending}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {userRole && ['owner', 'admin'].includes(userRole) && currentStatus === 'draft' && (
        <div className="mt-4 pt-4 border-t border-[#b8b9be]">
          {!showDeleteConfirm ? (
            <Button variant="danger" size="sm" onClick={() => setShowDeleteConfirm(true)}>
              Eliminar Registro
            </Button>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-700 flex-1">Esta seguro? Esta accion no se puede deshacer.</p>
              <Button variant="danger" size="sm" onClick={handleDelete} isLoading={isPending}>
                Confirmar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)}>
                Cancelar
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
