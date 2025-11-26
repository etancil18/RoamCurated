// components/SupabaseProvider.tsx
'use client'

import { useState, useEffect } from 'react'
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs'
import {
  SessionContextProvider,
  useSessionContext,
} from '@supabase/auth-helpers-react'
import type { Session } from '@supabase/auth-helpers-nextjs'

export function SupabaseProvider({
  children,
  initialSession,
}: {
  children: React.ReactNode
  initialSession: Session | null
}) {
  const [supabaseClient] = useState(() => createPagesBrowserClient())

  return (
    <SessionContextProvider
      supabaseClient={supabaseClient}
      initialSession={initialSession}
    >
      <Hydrated>{children}</Hydrated>
    </SessionContextProvider>
  )
}

function Hydrated({ children }: { children: React.ReactNode }) {
  const { isLoading } = useSessionContext()
  const [isMounted, setIsMounted] = useState(false)

  // ✅ Corrected: useEffect, not useState
  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted || isLoading) {
    return <div className="p-6 text-gray-500 text-sm">Loading session...</div>
  }

  return <>{children}</>
}
