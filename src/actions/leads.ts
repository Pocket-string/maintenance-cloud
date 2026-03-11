'use server'

import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { getResend, EMAIL_CONFIG } from '@/lib/email'

const leadSchema = z.object({
  name: z.string().min(2, 'Nombre es requerido'),
  email: z.string().email('Email invalido'),
  company: z.string().min(2, 'Empresa es requerida'),
  phone: z.string().min(6, 'Telefono es requerido'),
  message: z.string().optional(),
})

export async function submitLead(formData: FormData) {
  const raw = {
    name: formData.get('name') as string,
    email: formData.get('email') as string,
    company: formData.get('company') as string,
    phone: formData.get('phone') as string,
    message: (formData.get('message') as string) || undefined,
  }

  const parsed = leadSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors
    const firstError = Object.values(fieldErrors).flat()[0]
    return { success: false, error: firstError || 'Datos invalidos' }
  }

  const data = parsed.data

  try {
    // Insert lead into database
    const supabase = createServiceClient()
    const { error: dbError } = await supabase
      .from('leads')
      .insert({
        name: data.name,
        email: data.email,
        company: data.company,
        phone: data.phone,
        message: data.message || null,
        source: 'landing',
      })

    if (dbError) {
      console.error('Lead insert error:', dbError)
      return { success: false, error: 'Error al guardar. Intente nuevamente.' }
    }

    // Send email notification (fire-and-forget)
    sendLeadNotification(data).catch(console.error)

    return { success: true }
  } catch {
    return { success: false, error: 'Error inesperado. Intente nuevamente.' }
  }
}

async function sendLeadNotification(data: z.infer<typeof leadSchema>) {
  const notificationEmail = process.env.NOTIFICATION_EMAIL
  if (!notificationEmail) return

  try {
    const resend = getResend()
    await resend.emails.send({
      from: EMAIL_CONFIG.from,
      to: notificationEmail,
      subject: `Nuevo lead: ${data.company} - ${data.name}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1E293B;">Nuevo Lead - Bitalize Cloud</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px; font-weight: bold;">Nombre:</td><td style="padding: 8px;">${data.name}</td></tr>
            <tr style="background: #f8f9fa;"><td style="padding: 8px; font-weight: bold;">Email:</td><td style="padding: 8px;">${data.email}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Empresa:</td><td style="padding: 8px;">${data.company}</td></tr>
            <tr style="background: #f8f9fa;"><td style="padding: 8px; font-weight: bold;">Telefono:</td><td style="padding: 8px;">${data.phone}</td></tr>
            ${data.message ? `<tr><td style="padding: 8px; font-weight: bold;">Mensaje:</td><td style="padding: 8px;">${data.message}</td></tr>` : ''}
          </table>
          <p style="color: #64748B; font-size: 12px; margin-top: 20px;">Enviado desde Bitalize Cloud Mantenimiento</p>
        </div>
      `,
    })
  } catch (err) {
    console.error('Email notification failed:', err)
  }
}
