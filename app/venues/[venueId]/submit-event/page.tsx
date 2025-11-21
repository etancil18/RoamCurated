// app/venues/[venueId]/submit-event/page.tsx

'use client'

import { useState } from 'react'
import EventForm from '@/components/events/EventForm'
import { useParams } from 'next/navigation'

export default function SubmitEventPage() {
  const params = useParams()
  const venueId = params?.venueId as string

  return (
    <div className="max-w-xl mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">Submit an Event</h1>

      {!venueId ? (
        <p className="text-red-500">Missing venue ID</p>
      ) : (
        <EventForm venueId={venueId} />
      )}
    </div>
  )
}
