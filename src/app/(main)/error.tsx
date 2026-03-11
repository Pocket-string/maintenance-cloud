'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto mt-20">
      <Card className="text-center py-12">
        <h2 className="text-xl font-bold text-foreground mb-2">Algo salio mal</h2>
        <p className="text-foreground-secondary mb-6">
          Ocurrio un error inesperado. Por favor intenta de nuevo.
        </p>
        <Button onClick={reset}>Reintentar</Button>
      </Card>
    </div>
  )
}
