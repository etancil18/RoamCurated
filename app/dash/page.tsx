// app/dash/page.tsx
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'

export default async function DashRootPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // No logged-in user — send to login
  if (!user) {
    redirect('/dash/login')
  }

  // Check if the user is a venue admin
  const { data: venueUser, error } = await supabase
    .from('venue_users')
    .select('venue_id')
    .eq('email', user.email ?? '')
    .single()

  if (!venueUser || error) {
    redirect('/dash/login') // Could be extended to a support/contact page
  }

  // ✅ Authenticated + authorized → send to main dashboard
  redirect('/dash/dashboard')
}
