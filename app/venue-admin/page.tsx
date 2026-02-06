'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'
import RecurringEventAdmin from './recurringeventadmin'
import EventsAdmin from './eventsadmin'
import type { Database } from '@/types/supabase'

export type VenueSummary = Pick<
  Database['public']['Tables']['venues']['Row'],
  'id' | 'name' | 'city'
>

export default function VenueAdminPage() {
  const router = useRouter()
  const supabase = supabaseBrowser()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [selectedVenueId, setSelectedVenueId] = useState<string>('')

  const allowedEmails = ['evantancil@gmail.com', 'etancil92@gmail.com', 'evantancil@roamcurated.com', 'fyejono@gmail.com', 'jonathangordon@roamcurated.com']

  useEffect(() => {
    async function checkUser() {
      const { data } = await supabase.auth.getUser()
      const email = data.user?.email ?? null

      if (!email || !allowedEmails.includes(email)) {
        router.push('/')
      } else {
        setUserEmail(email)
      }
    }

    checkUser()
  }, [supabase])

  if (!userEmail) return null

  return (
    <div className="max-w-4xl mx-auto py-10 space-y-12">
      <EventsAdmin
        selectedVenue={selectedVenueId}
        onVenueChange={setSelectedVenueId}
      />
      {selectedVenueId && (
        <RecurringEventAdmin venueId={selectedVenueId} />
      )}
    </div>
  )
}
