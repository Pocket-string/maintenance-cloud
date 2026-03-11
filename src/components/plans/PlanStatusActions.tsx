'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { updatePlanStatus, deletePlan, regenerateSchedule } from '@/actions/plans'
import type { PlanStatus } from '@/types/database'

interface Props {
  planId: string
  currentStatus: PlanStatus
}

export function PlanStatusActions({ planId, currentStatus }: Props) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (currentStatus === 'archived') {
    return <p className="text-sm text-foreground-secondary">Este plan esta archivado.</p>
  }

  async function handleStatusChange(newStatus: PlanStatus) {
    setIsPending(true)
    setError(null)

    const result = await updatePlanStatus(planId, newStatus)

    if (!result.success) {
      setError(result.error)
      setIsPending(false)
      return
    }

    router.refresh()
    setIsPending(false)
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      'Eliminar este plan es una accion irreversible. Todas las categorias y tareas se perderan. Continuar?'
    )
    if (!confirmed) return

    setIsPending(true)
    setError(null)

    const result = await deletePlan(planId)

    if (!result.success) {
      setError(result.error)
      setIsPending(false)
      return
    }

    router.push('/plans')
  }

  async function handleArchive() {
    const confirmed = window.confirm(
      'Archivar el plan lo dejara inactivo permanentemente. Continuar?'
    )
    if (!confirmed) return
    await handleStatusChange('archived')
  }

  return (
    <div>
      {error && (
        <p className="text-sm text-red-600 mb-3">{error}</p>
      )}

      <div className="flex flex-wrap gap-3">
        {currentStatus === 'draft' && (
          <>
            <Button
              onClick={() => handleStatusChange('active')}
              isLoading={isPending}
              className="bg-green-600 text-white hover:bg-green-700 active:bg-green-800 shadow-sm"
            >
              Activar Plan
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              isLoading={isPending}
            >
              Eliminar
            </Button>
          </>
        )}

        {currentStatus === 'active' && (
          <>
            <Button
              onClick={() => handleStatusChange('paused')}
              isLoading={isPending}
              className="bg-yellow-500 text-white hover:bg-yellow-600 active:bg-yellow-700 shadow-sm"
            >
              Pausar
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                setIsPending(true)
                setError(null)
                const result = await regenerateSchedule(planId)
                if (!result.success) {
                  setError(result.error)
                } else {
                  router.refresh()
                }
                setIsPending(false)
              }}
              isLoading={isPending}
            >
              Regenerar Calendario
            </Button>
          </>
        )}

        {currentStatus === 'paused' && (
          <>
            <Button
              onClick={() => handleStatusChange('active')}
              isLoading={isPending}
              className="bg-green-600 text-white hover:bg-green-700 active:bg-green-800 shadow-sm"
            >
              Reactivar
            </Button>
            <Button
              variant="outline"
              onClick={handleArchive}
              isLoading={isPending}
            >
              Archivar
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
