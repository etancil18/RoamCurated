// hooks/useUser.ts
'use client'

import { useUser as useSupabaseUser, useSupabaseClient } from '@supabase/auth-helpers-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

export function useUser() {
  const user = useSupabaseUser()
  const supabase = useSupabaseClient<Database>()

  return { user, supabase }
}
