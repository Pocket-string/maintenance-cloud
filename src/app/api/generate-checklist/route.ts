import { NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getModel, hasApiKey, getProvider } from '@/lib/ai/provider'

const ChecklistSchema = z.object({
  items: z.array(z.object({
    label: z.string().describe('Descripcion del item de checklist en espanol'),
    item_type: z.enum(['bool', 'text', 'number', 'select']).describe('Tipo de input'),
    required: z.boolean().describe('Si es obligatorio'),
    options: z.array(z.string()).optional().describe('Opciones para tipo select'),
  })).describe('Items de checklist para la tarea de mantenimiento'),
})

const API_KEY_NAMES: Record<string, string> = {
  google: 'GOOGLE_GENERATIVE_AI_API_KEY',
  openai: 'OPENAI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
}

export async function POST(request: Request) {
  const provider = getProvider()

  if (!hasApiKey()) {
    return NextResponse.json(
      { error: `${API_KEY_NAMES[provider]} no configurada. Agrega la variable de entorno en .env.local` },
      { status: 500 }
    )
  }

  const body = await request.json() as { planTaskId?: string }
  const { planTaskId } = body

  if (!planTaskId) {
    return NextResponse.json({ error: 'planTaskId requerido' }, { status: 400 })
  }

  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // Fetch task context
  const { data: task } = await supabase
    .from('plan_tasks')
    .select(`
      description,
      plan_categories(name),
      maintenance_plans(
        name,
        sites(name, type)
      )
    `)
    .eq('id', planTaskId)
    .single()

  if (!task) {
    return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 })
  }

  const rawTask = task as unknown as {
    description: string
    plan_categories: { name: string } | null
    maintenance_plans: { name: string; sites: { name: string; type: string } | null } | null
  }

  const siteType = rawTask.maintenance_plans?.sites?.type ?? 'fv_pmgd'
  const siteTypeLabel = siteType === 'diesel' ? 'generador diesel' : siteType === 'hybrid' ? 'planta hibrida solar+diesel' : 'planta solar fotovoltaica'

  const prompt = `Eres un experto en mantenimiento de ${siteTypeLabel}.
Genera items de checklist para la siguiente tarea de mantenimiento.

Categoria: ${rawTask.plan_categories?.name ?? 'General'}
Tarea: ${rawTask.description}
Sitio: ${rawTask.maintenance_plans?.sites?.name ?? 'N/A'} (${siteTypeLabel})

Genera entre 3 y 8 items de checklist relevantes y especificos para esta tarea.
Cada item debe ser verificable en campo por un tecnico.
Usa tipos apropiados:
- "bool" para verificaciones Si/No
- "number" para mediciones (voltaje, corriente, temperatura, etc.)
- "text" para observaciones generales
- "select" para estados con opciones fijas (ej: Bueno/Regular/Malo)

Los items deben estar en espanol y ser concretos.`

  try {
    const model = await getModel()
    const result = await generateObject({
      model,
      schema: ChecklistSchema,
      prompt,
    })

    return NextResponse.json({ items: result.object.items })
  } catch (err) {
    console.error('[generate-checklist]', err)
    return NextResponse.json(
      { error: 'Error al generar checklist con IA' },
      { status: 500 }
    )
  }
}
