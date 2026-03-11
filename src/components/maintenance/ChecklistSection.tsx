'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getChecklistForRecord, saveChecklistResponses, type ChecklistItemWithResponse, type ChecklistResult } from '@/actions/checklists'
import type { MaintenanceType, ChecklistItemType } from '@/types/database'

interface Props {
  recordId: string
  maintenanceType: MaintenanceType
  readOnly?: boolean
}

export function ChecklistSection({ recordId, maintenanceType, readOnly = false }: Props) {
  const [items, setItems] = useState<ChecklistItemWithResponse[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [checklistMeta, setChecklistMeta] = useState<{ source: ChecklistResult['source']; taskDescription?: string }>({ source: 'template' })

  useEffect(() => {
    async function load() {
      const result = await getChecklistForRecord(recordId, maintenanceType)
      if (result.success && result.data) {
        setItems(result.data.items)
        setChecklistMeta({ source: result.data.source, taskDescription: result.data.taskDescription })
        const initialValues: Record<string, string> = {}
        const initialNotes: Record<string, string> = {}
        for (const item of result.data.items) {
          initialValues[item.id] = item.response?.value ?? ''
          initialNotes[item.id] = item.response?.note ?? ''
        }
        setValues(initialValues)
        setNotes(initialNotes)
      }
      setLoading(false)
    }
    load()
  }, [recordId, maintenanceType])

  async function handleSave() {
    setSaving(true)
    setMessage(null)

    const responses = items
      .filter(item => values[item.id] !== undefined && values[item.id] !== '')
      .map(item => ({
        item_id: item.id,
        value: values[item.id],
        note: notes[item.id] || null,
      }))

    const result = await saveChecklistResponses(recordId, responses)

    if (result.success) {
      setMessage({ type: 'success', text: 'Checklist guardado correctamente' })
    } else {
      setMessage({ type: 'error', text: result.error })
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <Card>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-10 bg-gray-200 rounded" />
          <div className="h-10 bg-gray-200 rounded" />
          <div className="h-10 bg-gray-200 rounded" />
        </div>
      </Card>
    )
  }

  if (items.length === 0) {
    return (
      <Card>
        <p className="text-sm text-foreground-secondary">
          {checklistMeta.source === 'task' && checklistMeta.taskDescription
            ? `La tarea "${checklistMeta.taskDescription}" no tiene checklist definido. Configure uno desde el plan.`
            : 'No hay checklist configurado para este tipo de mantenimiento.'}
        </p>
      </Card>
    )
  }

  return (
    <Card>
      <h3 className="text-sm font-semibold text-foreground-secondary mb-1">Checklist</h3>
      {checklistMeta.source === 'task' && checklistMeta.taskDescription && (
        <p className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg inline-block mb-3">
          Tarea: {checklistMeta.taskDescription}
        </p>
      )}

      {message && (
        <div className={`p-3 mb-4 rounded-xl text-sm ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <div className="space-y-4">
        {items.map(item => (
          <div key={item.id} className="pb-4 last:pb-0 [&:not(:last-child)]:mb-4">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <label className="text-sm font-medium text-foreground">
                  {item.label}
                  {item.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                <div className="mt-2">
                  <ChecklistInput
                    itemType={item.item_type}
                    options={item.options}
                    value={values[item.id] ?? ''}
                    onChange={(v) => setValues(prev => ({ ...prev, [item.id]: v }))}
                    disabled={readOnly}
                  />
                </div>
                <input
                  type="text"
                  placeholder="Nota (opcional)"
                  value={notes[item.id] ?? ''}
                  onChange={(e) => setNotes(prev => ({ ...prev, [item.id]: e.target.value }))}
                  disabled={readOnly}
                  className="mt-2 w-full px-3 py-1.5 text-sm bg-neu-bg shadow-neu-inset-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {!readOnly && (
        <div className="mt-6">
          <Button onClick={handleSave} isLoading={saving}>
            Guardar Checklist
          </Button>
        </div>
      )}
    </Card>
  )
}

function ChecklistInput({
  itemType,
  options,
  value,
  onChange,
  disabled,
}: {
  itemType: ChecklistItemType
  options: string[] | null
  value: string
  onChange: (v: string) => void
  disabled: boolean
}) {
  switch (itemType) {
    case 'bool':
      return (
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={value === 'true'}
              onChange={() => onChange('true')}
              disabled={disabled}
              className="w-4 h-4 text-blue-600"
            />
            <span className="text-sm">Si</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={value === 'false'}
              onChange={() => onChange('false')}
              disabled={disabled}
              className="w-4 h-4 text-blue-600"
            />
            <span className="text-sm">No</span>
          </label>
        </div>
      )

    case 'number':
      return (
        <input
          type="number"
          step="any"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full max-w-xs px-3 py-1.5 text-sm bg-neu-bg shadow-neu-inset-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      )

    case 'select':
      return (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full max-w-xs px-3 py-1.5 text-sm bg-neu-bg shadow-neu-inset-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Seleccionar...</option>
          {(options || []).map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )

    case 'text':
    default:
      return (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-1.5 text-sm bg-neu-bg shadow-neu-inset-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      )
  }
}
