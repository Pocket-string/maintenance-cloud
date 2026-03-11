'use server'

import { cookies } from 'next/headers'

const DEMO_COOKIE = 'demo_mode'

export async function isDemo(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get(DEMO_COOKIE)?.value === 'true'
}

export async function assertNotDemo(): Promise<void> {
  if (await isDemo()) {
    throw new Error('DEMO_MODE_BLOCKED')
  }
}
