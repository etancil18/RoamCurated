'use client'

import { useState } from 'react'
import type { EventRecord } from '@/types/supabase'

interface EventFormProps {
  venueId: string
  mode?: 'new' | 'edit'
  event?: EventRecord | null
}

export default function EventForm({
  venueId,
  mode = 'new',
  event = null,
}: EventFormProps) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setSuccess(false)
    setError(null)

    const formData = new FormData(e.currentTarget)

    const payload = {
      title: formData.get('title'),
      description: formData.get('description'),
      starts_at: formData.get('starts_at'),
      ends_at: formData.get('ends_at'),
      tags: formData.get('tags')
        ? String(formData.get('tags')).split(',').map((t) => t.trim())
        : null,
      price_info: formData.get('price_info'),
      source_type: 'portal',
      source: 'portal',
    }

    const url =
      mode === 'edit' && event
        ? `/api/venues/${venueId}/events/${event.id}`
        : `/api/venues/${venueId}/events`

    const method = mode === 'edit' ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const json = await res.json()

    if (!res.ok) {
      setError(json.details || json.error || 'Error submitting event')
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Success */}
      {success && (
        <p className="text-green-600 font-medium">
          {mode === 'edit'
            ? 'Event updated successfully!'
            : 'Event submitted successfully!'}
        </p>
      )}

      {/* Error */}
      {error && <p className="text-red-600 font-medium">{error}</p>}

      {/* Title */}
      <div>
        <label className="block mb-1 font-medium">Event Title</label>
        <input
          required
          type="text"
          name="title"
          defaultValue={event?.title ?? ''}
          className="w-full border p-2 rounded"
          placeholder="Late Night Jazz"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block mb-1 font-medium">Description</label>
        <textarea
          name="description"
          defaultValue={event?.description ?? ''}
          className="w-full border p-2 rounded"
          placeholder="Describe the event..."
        />
      </div>

      {/* Start Time */}
      <div>
        <label className="block mb-1 font-medium">Start Time</label>
        <input
          type="datetime-local"
          name="starts_at"
          defaultValue={event?.starts_at ? formatDateTimeLocal(event.starts_at) : ''}
          required
          className="w-full border p-2 rounded"
        />
      </div>

      {/* End Time */}
      <div>
        <label className="block mb-1 font-medium">End Time</label>
        <input
          type="datetime-local"
          name="ends_at"
          defaultValue={event?.ends_at ? formatDateTimeLocal(event.ends_at) : ''}
          className="w-full border p-2 rounded"
        />
      </div>

      {/* Tags */}
      <div>
        <label className="block mb-1 font-medium">Tags (comma separated)</label>
        <input
          type="text"
          name="tags"
          defaultValue={event?.tags?.join(', ') ?? ''}
          className="w-full border p-2 rounded"
          placeholder="music, dj, art"
        />
      </div>

      {/* Price Info */}
      <div>
        <label className="block mb-1 font-medium">Price Info</label>
        <input
          type="text"
          name="price_info"
          defaultValue={event?.price_info ?? ''}
          className="w-full border p-2 rounded"
          placeholder="$20 cover"
        />
      </div>

      {/* Ticket Link */}
      <div>
        <label className="block mb-1 font-medium">Ticket Link (optional)</label>
        <input
          type="url"
          name="ticket_link"
          defaultValue={event?.ticket_link ?? ''}
          className="w-full border p-2 rounded"
          placeholder="https://example.com/tickets"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 rounded font-semibold disabled:opacity-50"
      >
        {loading
          ? mode === 'edit'
            ? 'Updating...'
            : 'Submitting...'
          : mode === 'edit'
          ? 'Update Event'
          : 'Submit Event'}
      </button>
    </form>
  )
}

function formatDateTimeLocal(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}