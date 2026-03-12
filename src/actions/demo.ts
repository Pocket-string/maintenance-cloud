'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const DEMO_EMAIL = 'demo@bitalize.cloud'
const DEMO_PASSWORD = 'BitalizeDemo2026Secure'
const DEMO_COOKIE = 'demo_mode'

export async function enterDemo() {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  })

  if (error) {
    return { error: 'No se pudo iniciar el modo demo. Intente nuevamente.' }
  }

  const cookieStore = await cookies()
  cookieStore.set(DEMO_COOKIE, 'true', {
    path: '/',
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 2, // 2 hours
  })

  redirect('/dashboard')
}

export async function exitDemo() {
  const supabase = await createClient()
  await supabase.auth.signOut()

  const cookieStore = await cookies()
  cookieStore.delete(DEMO_COOKIE)

  redirect('/')
}
