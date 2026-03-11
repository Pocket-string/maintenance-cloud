'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  getChecklistItemsForTask,
  saveTaskChecklistItems,
  type TaskChecklistItem,
  type SuggestedChecklistItem,
} from '@/actions/task-checklist'
import type { ChecklistItemType } from '@/types/database'

interface Props {
  planTaskId: string
  taskDescription: string
  onClose: () => void
  onCountChange?: (count: number) => void
}

interface EditableItem {
  tempId: string
  label: string
  item_type: ChecklistItemType
  required: boolean
  options: string[] | null
}

function generateTempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

const ITEM_TYPE_LABELS: Record<ChecklistItemType, string> = {
  bool: 'Si/No',
  text: 'Texto',
  number: 'Numero',
  select: 'Opciones',
}

export function TaskChecklistEditor({ planTaskId, taskDescription, onClose, onCountChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [items, setItems] = useState<EditableItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    async function load() {
      const result = await getChecklistItemsForTask(planTaskId)
      if (result.success && result.data) {
        setItems(result.data.map(item => ({
          tempId: item.id,
          label: item.label,
          item_type: item.item_type,
          required: item.required,
          options: item.options,
        })))
      }
      setLoading(false)
    }
    load()
  }, [planTaskId])

  // Scroll into view when editor mounts
  useEffect(() => {
    containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [])

  function addItem() {
    setItems(prev => [...prev, {
      tempId: generateTempId(),
      label: '',
      item_type: 'bool',
      required: true,
      options: null,
    }])
  }

  function removeItem(tempId: string) {
    setItems(prev => prev.filter(i => i.tempId !== tempId))
  }

  function updateItem(tempId: string, field: keyof EditableItem, value: unknown) {
    setItems(prev => prev.map(i => i.tempId === tempId ? { ...i, [field]: value } : i))
  }

  async function handleSave() {
    const validItems = items.filter(i => i.label.trim() !== '')
    if (validItems.length === 0 && items.length > 0) {
      setMessage({ type: 'error', text: 'Todos los items necesitan un label' })
      return
    }

    setSaving(true)
    setMessage(null)

    const result = await saveTaskChecklistItems(
      planTaskId,
      validItems.map(i => ({
        label: i.label.trim(),
        item_type: i.item_type,
        required: i.required,
        options: i.item_type === 'select' ? i.options : null,
      }))
    )

    if (result.success) {
      setMessage({ type: 'success', text: 'Checklist guardado' })
      onCountChange?.(validItems.length)
    } else {
      setMessage({ type: 'error', text: result.error })
    }
    setSaving(false)
  }

  async function handleGenerateAI() {
    setGenerating(true)
    setMessage(null)

    try {
      const res = await fetch('/api/generate-checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planTaskId }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setMessage({ type: 'error', text: (body as { error?: string }).error || 'Error al generar checklist' })
        setGenerating(false)
        return
      }

      const data = await res.json() as { items: SuggestedChecklistItem[] }
      const newItems: EditableItem[] = data.items.map(item => ({
        tempId: generateTempId(),
        label: item.label,
        item_type: item.item_type,
        required: item.required,
        options: item.options || null,
      }))

      setItems(prev => [...prev, ...newItems])
      setMessage({ type: 'success', text: `${newItems.length} items sugeridos por IA` })
    } catch {
      setMessage({ type: 'error', text: 'Error de conexion al generar' })
    }

    setGenerating(false)
  }

  if (loading) {
    return (
      <div ref={containerRef} className="p-4 bg-gray-50 border-t border-border animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
        <div className="h-8 bg-gray-200 rounded" />
      </div>
    )
  }

  return (
    <div ref={containerRef} className="p-4 bg-gray-50/80 border-t border-border">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-foreground-secondary uppercase tracking-wide">
          Checklist: {taskDescription.slice(0, 60)}{taskDescription.length > 60 ? '...' : ''}
        </h4>
        <button onClick={onClose} className="text-xs text-foreground-secondary hover:text-foreground">
          Cerrar
        </button>
      </div>

      {message && (
        <div className={`p-2 mb-3 rounded-lg text-xs ${
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      {/* Items list */}
      {items.length === 0 ? (
        <p className="text-sm text-foreground-secondary py-2">
          Sin items de checklist. Agrega manualmente o genera con IA.
        </p>
      ) : (
        <div className="space-y-2 mb-3">
          {items.map((item, idx) => (
            <div key={item.tempId} className="flex items-start gap-2 bg-white p-2 rounded-lg border border-border">
              <span className="text-xs text-foreground-secondary mt-2 w-5 shrink-0">{idx + 1}</span>
              <div className="flex-1 space-y-1">
                <input
                  type="text"
                  value={item.label}
                  onChange={(e) => updateItem(item.tempId, 'label', e.target.value)}
                  placeholder="Descripcion del item..."
                  className="w-full px-2 py-1 text-sm border border-border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <div className="flex items-center gap-3 text-xs">
                  <select
                    value={item.item_type}
                    onChange={(e) => updateItem(item.tempId, 'item_type', e.target.value)}
                    className="px-2 py-0.5 border border-border rounded text-xs bg-white"
                  >
                    {(Object.entries(ITEM_TYPE_LABELS) as [ChecklistItemType, string][]).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.required}
                      onChange={(e) => updateItem(item.tempId, 'required', e.target.checked)}
                      className="w-3 h-3"
                    />
                    Obligatorio
                  </label>
                  {item.item_type === 'select' && (
                    <input
                      type="text"
                      value={(item.options || []).join(', ')}
                      onChange={(e) => updateItem(item.tempId, 'options', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                      placeholder="Opciones separadas por coma"
                      className="flex-1 px-2 py-0.5 border border-border rounded text-xs"
                    />
                  )}
                </div>
              </div>
              <button
                onClick={() => removeItem(item.tempId)}
                className="text-red-400 hover:text-red-600 text-xs mt-1 shrink-0"
                title="Eliminar"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={addItem}>
          + Agregar item
        </Button>
        <Button size="sm" variant="outline" onClick={handleGenerateAI} isLoading={generating}>
          Generar con IA
        </Button>
        <Button size="sm" variant="primary" onClick={handleSave} isLoading={saving}>
          Guardar
        </Button>
      </div>
    </div>
  )
}
