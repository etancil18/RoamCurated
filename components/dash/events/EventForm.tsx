'use client'

import { useState, useEffect, FormEvent } from 'react'
import { cn } from '@/lib/utils'

type EventFormProps = {
  venueId: string
  eventId?: string
  initialValues?: {
    title?: string
    starts_at?: string
    ends_at?: string
    tags?: string[]
    price_info?: string
    description?: string
  }
  onSuccess?: () => void
}

export default function EventForm({
  venueId,
  eventId,
  initialValues,
  onSuccess,
}: EventFormProps) {
  const [form, setForm] = useState({
    title: '',
    date: '',
    startTime: '',
    endTime: '',
    tags: '',
    priceInfo: '',
    description: '',
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // ⏳ Pre-fill form if editing
  useEffect(() => {
    if (initialValues) {
      const start = initialValues.starts_at
        ? new Date(initialValues.starts_at)
        : null
      const end = initialValues.ends_at
        ? new Date(initialValues.ends_at)
        : null

      setForm({
        title: initialValues.title || '',
        date: start ? start.toISOString().split('T')[0] : '',
        startTime: start
          ? start.toISOString().substring(11, 16)
          : '',
        endTime: end ? end.toISOString().substring(11, 16) : '',
        tags: initialValues.tags?.join(', ') || '',
        priceInfo: initialValues.price_info || '',
        description: initialValues.description || '',
      })
    }
  }, [initialValues])

  const handleChange =
    (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
    }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)

    if (!form.title.trim() || !form.date || !form.startTime) {
      setError('Please complete required fields: Title, Date, and Start Time.')
      return
    }

    setLoading(true)

    const payload = {
      venue_id: venueId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      starts_at:
        form.date && form.startTime
          ? new Date(`${form.date}T${form.startTime}`).toISOString()
          : null,
      ends_at:
        form.date && form.endTime
          ? new Date(`${form.date}T${form.endTime}`).toISOString()
          : null,
      tags: form.tags
        ? form.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : null,
      price_info: form.priceInfo.trim() || null,
      source: 'dash',
      source_type: 'venue_event',
    }

    try {
      const res = await fetch(
        `/api/dash/events${eventId ? `?id=${eventId}` : ''}`,
        {
          method: eventId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )

      let data = null
      try {
        data = await res.json()
      } catch (jsonErr) {
        console.warn('❗ Failed to parse JSON response:', jsonErr)
      }

      if (!res.ok) {
        console.error('EventForm submission failed:', data)
        setError(
          data?.error || 'An error occurred while saving the event.'
        )
      } else {
        setSuccessMessage(
          eventId ? 'Event updated successfully!' : 'Event created successfully!'
        )
        if (!eventId) {
          setForm({
            title: '',
            date: '',
            startTime: '',
            endTime: '',
            tags: '',
            priceInfo: '',
            description: '',
          })
        }
        onSuccess?.()
      }
    } catch (err) {
      console.error('EventForm submission caught error:', err)
      setError('An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="text-red-600 text-sm font-medium">{error}</div>
      )}
      {successMessage && (
        <div className="text-green-600 text-sm font-medium">
          {successMessage}
        </div>
      )}

      {/* Event Title */}
      <div>
        <label className="block text-sm font-medium mb-1">Event Title</label>
        <input
          required
          type="text"
          value={form.title}
          onChange={handleChange('title')}
          className={cn(
            'w-full border rounded px-3 py-2 focus:outline-none focus:ring',
            'dark:bg-gray-800 dark:border-gray-700'
          )}
          placeholder="Live Music at Rooftop Bar"
        />
      </div>

      {/* Date + Time */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Date</label>
          <input
            required
            type="date"
            value={form.date}
            onChange={handleChange('date')}
            className={cn(
              'w-full border rounded px-3 py-2 focus:outline-none focus:ring',
              'dark:bg-gray-800 dark:border-gray-700'
            )}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Start Time</label>
          <input
            required
            type="time"
            value={form.startTime}
            onChange={handleChange('startTime')}
            className={cn(
              'w-full border rounded px-3 py-2 focus:outline-none focus:ring',
              'dark:bg-gray-800 dark:border-gray-700'
            )}
          />
        </div>
      </div>

      {/* End Time */}
      <div>
        <label className="block text-sm font-medium mb-1">
          End Time (optional)
        </label>
        <input
          type="time"
          value={form.endTime}
          onChange={handleChange('endTime')}
          className={cn(
            'w-full border rounded px-3 py-2 focus:outline-none focus:ring',
            'dark:bg-gray-800 dark:border-gray-700'
          )}
        />
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Tags (comma‑separated)
        </label>
        <input
          type="text"
          value={form.tags}
          onChange={handleChange('tags')}
          className={cn(
            'w-full border rounded px-3 py-2 focus:outline-none focus:ring',
            'dark:bg-gray-800 dark:border-gray-700'
          )}
          placeholder="music, dj, summer"
        />
      </div>

      {/* Price Info */}
      <div>
        <label className="block text-sm font-medium mb-1">Price Info</label>
        <input
          type="text"
          value={form.priceInfo}
          onChange={handleChange('priceInfo')}
          className={cn(
            'w-full border rounded px-3 py-2 focus:outline-none focus:ring',
            'dark:bg-gray-800 dark:border-gray-700'
          )}
          placeholder="Free, $10, Donation"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          value={form.description}
          onChange={handleChange('description')}
          className={cn(
            'w-full border rounded px-3 py-2 focus:outline-none focus:ring',
            'dark:bg-gray-800 dark:border-gray-700'
          )}
          rows={4}
          placeholder="Add any event details..."
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className={cn(
          'w-full bg-blue-600 text-white py-2 rounded font-semibold hover:bg-blue-700',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        {loading ? 'Submitting…' : eventId ? 'Update Event' : 'Create Event'}
      </button>
    </form>
  )
}
