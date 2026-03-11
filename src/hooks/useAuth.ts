'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

interface UserProfile {
  user_id: string
  full_name: string | null
  email: string
}

interface OrgMembership {
  role: 'owner' | 'ops' | 'admin' | 'tech'
  org_id: string
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [membership, setMembership] = useState<OrgMembership | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function fetchUserData(userId: string) {
      const [profileRes, memberRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('organization_members')
          .select('role, org_id')
          .eq('user_id', userId)
          .limit(1)
          .maybeSingle(),
      ])

      if (profileRes.data) setProfile(profileRes.data)
      if (memberRes.data) {
        setMembership(memberRes.data as OrgMembership)
      }
    }

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (user) {
        fetchUserData(user.id)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const currentUser = session?.user ?? null
        setUser(currentUser)
        if (currentUser) {
          fetchUserData(currentUser.id)
        } else {
          setProfile(null)
          setMembership(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return { user, profile, membership, loading }
}
