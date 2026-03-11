import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function MainNotFound() {
  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto mt-20">
      <Card className="text-center py-12">
        <h2 className="text-xl font-bold text-foreground mb-2">Pagina no encontrada</h2>
        <p className="text-foreground-secondary mb-6">
          La pagina que buscas no existe o fue eliminada.
        </p>
        <Link href="/dashboard">
          <Button>Ir al Dashboard</Button>
        </Link>
      </Card>
    </div>
  )
}
