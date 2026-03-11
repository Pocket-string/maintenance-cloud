'use client'

import { useEffect, useState } from 'react'

export function useDemo() {
  const [isDemo, setIsDemo] = useState(false)

  useEffect(() => {
    setIsDemo(document.cookie.includes('demo_mode=true'))
  }, [])

  return { isDemo }
}
