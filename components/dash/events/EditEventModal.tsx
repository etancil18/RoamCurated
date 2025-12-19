'use client'

import { useState } from 'react'
import EventForm from './EventForm'

export default function EditEventModal({
  event,
  onClose,
  onSuccess,
}: {
  event: any
  onClose: () => void
  onSuccess: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-lg w-full space-y-4">
        <h3 className="text-xl font-semibold">Edit Event</h3>
        <EventForm
          venueId={event.venue_id}
          initialValues={event}
          eventId={event.id}
          onSuccess={onSuccess}
        />
        <button
          onClick={onClose}
          className="mt-2 text-sm text-gray-600 dark:text-gray-300 hover:underline"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
