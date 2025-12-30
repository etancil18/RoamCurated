
// app/dash/layout.tsx
import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import DashShell from './DashShell'

export default async function DashLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/dash/login')
  }

  const { data: venueUser, error: venueUserError } = await supabase
    .from('venue_users')
    .select('venue_id')
    .eq('email', user.email ?? '')
    .single()

  if (!venueUser || venueUserError) {
    redirect('/dash/login')
  }

  const { data: venue } = await supabase
    .from('venues')
    .select('name')
    .eq('id', venueUser.venue_id)
    .single()

  return (
    <DashShell venueName={venue?.name ?? ''}>
      {children}
    </DashShell>
  )
}
