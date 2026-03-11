'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getMaterialsForRecord, addMaterialLine, deleteMaterialLine } from '@/actions/materials'
import type { MaterialsLine } from '@/types/database'

interface Props {
  recordId: string
  readOnly?: boolean
}

export function MaterialsSection({ recordId, readOnly = false }: Props) {
  const [materials, setMaterials] = useState<MaterialsLine[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const result = await getMaterialsForRecord(recordId)
      if (result.success && result.data) setMaterials(result.data)
      setLoading(false)
    }
    load()
  }, [recordId])

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setAdding(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const result = await addMaterialLine(recordId, formData)

    if (result.success && result.data) {
      setMaterials(prev => [...prev, result.data!])
      setShowForm(false)
      ;(e.target as HTMLFormElement).reset()
    } else if (!result.success) {
      setError(result.error)
    }
    setAdding(false)
  }

  async function handleDelete(lineId: string) {
    const result = await deleteMaterialLine(recordId, lineId)
    if (result.success) {
      setMaterials(prev => prev.filter(m => m.id !== lineId))
    }
  }

  const total = materials.reduce((sum, m) => {
    return sum + (m.unit_cost ? m.quantity * m.unit_cost : 0)
  }, 0)

  if (loading) {
    return (
      <Card>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/4" />
          <div className="h-8 bg-gray-200 rounded" />
          <div className="h-8 bg-gray-200 rounded" />
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground-secondary">
          Materiales ({materials.length})
        </h3>
        {!readOnly && !showForm && (
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
            Agregar
          </Button>
        )}
      </div>

      {error && (
        <div className="p-3 mb-4 rounded-xl text-sm bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {materials.length > 0 && (
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#b8b9be]">
                <th className="text-left py-2 text-foreground-secondary font-medium">Descripcion</th>
                <th className="text-right py-2 text-foreground-secondary font-medium">Cant.</th>
                <th className="text-left py-2 pl-3 text-foreground-secondary font-medium">Unidad</th>
                <th className="text-right py-2 text-foreground-secondary font-medium">Costo Unit.</th>
                <th className="text-right py-2 text-foreground-secondary font-medium">Subtotal</th>
                {!readOnly && <th className="w-10" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-transparent">
              {materials.map(m => (
                <tr key={m.id}>
                  <td className="py-2 text-foreground">{m.description}</td>
                  <td className="py-2 text-right text-foreground">{m.quantity}</td>
                  <td className="py-2 pl-3 text-foreground-secondary">{m.unit}</td>
                  <td className="py-2 text-right text-foreground-secondary">
                    {m.unit_cost != null ? `$${m.unit_cost.toLocaleString()}` : '—'}
                  </td>
                  <td className="py-2 text-right text-foreground">
                    {m.unit_cost != null ? `$${(m.quantity * m.unit_cost).toLocaleString()}` : '—'}
                  </td>
                  {!readOnly && (
                    <td className="py-2 text-right">
                      <button
                        onClick={() => handleDelete(m.id)}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        Eliminar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            {total > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[#b8b9be]">
                  <td colSpan={4} className="py-2 text-right font-semibold text-foreground">Total</td>
                  <td className="py-2 text-right font-semibold text-foreground">${total.toLocaleString()}</td>
                  {!readOnly && <td />}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {materials.length === 0 && !showForm && (
        <p className="text-sm text-foreground-secondary">Sin materiales registrados.</p>
      )}

      {showForm && (
        <form onSubmit={handleAdd} className="border-t border-[#b8b9be] pt-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <input
                name="description"
                required
                placeholder="Descripcion del material"
                className="w-full px-3 py-1.5 text-sm bg-neu-bg shadow-neu-inset-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <input
                name="quantity"
                type="number"
                step="any"
                min="0.01"
                required
                placeholder="Cant."
                className="w-20 px-3 py-1.5 text-sm bg-neu-bg shadow-neu-inset-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <input
                name="unit"
                required
                placeholder="Unidad"
                className="w-24 px-3 py-1.5 text-sm bg-neu-bg shadow-neu-inset-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <input
              name="unit_cost"
              type="number"
              step="any"
              min="0"
              placeholder="Costo unit. (opc)"
              className="w-full px-3 py-1.5 text-sm bg-neu-bg shadow-neu-inset-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" isLoading={adding}>Agregar Material</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </form>
      )}
    </Card>
  )
}
