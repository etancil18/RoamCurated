'use client'

import { useState, useEffect, FormEvent } from 'react'
import { cn } from '@/lib/utils'

type RecurringEventFormProps = {
  venueId: string
  recurringEventId?: string
  initialValues?: {
    title?: string
    description?: string
    tags?: string[]
    price_info?: string
    recurrence_rule?: string
    start_time?: string
    end_time?: string
    starts_on?: string
    ends_on?: string
  }
  onSuccess?: () => void
}

const FREQUENCY_OPTIONS = [
  { label: 'Daily', value: 'DAILY' },
  { label: 'Weekly', value: 'WEEKLY' },
  { label: 'Monthly', value: 'MONTHLY' },
]

export default function RecurringEventForm({
  venueId,
  recurringEventId,
  initialValues,
  onSuccess,
}: RecurringEventFormProps) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    tags: '',
    priceInfo: '',
    frequency: 'WEEKLY',
    byWeekday: '',
    startsOn: '',
    endsOn: '',
    startTime: '',
    endTime: '',
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Pre‑fill form when editing
  useEffect(() => {
    if (initialValues) {
      // Parse recurrence_rule
      const ruleParts = initialValues.recurrence_rule?.split(';') ?? []
      let freq = 'WEEKLY'
      let byWeekday = ''

      ruleParts.forEach((p) => {
        if (p.startsWith('FREQ=')) freq = p.split('=')[1]
        if (p.startsWith('BYDAY=')) byWeekday = p.split('=')[1]
      })

      setForm({
        title: initialValues.title || '',
        description: initialValues.description || '',
        tags: initialValues.tags?.join(', ') || '',
        priceInfo: initialValues.price_info || '',
        frequency: freq,
        byWeekday,
        startsOn: initialValues.starts_on || '',
        endsOn: initialValues.ends_on || '',
        startTime: initialValues.start_time ?? '',
        endTime: initialValues.end_time ?? '',
      })
    }
  }, [initialValues])

  const handleChange =
    (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
    }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)

    if (!form.title.trim() || !form.startsOn || !form.startTime) {
      setError('Please complete Title, Start Date, and Start Time.')
      return
    }

    setLoading(true)

    const rruleParts = [`FREQ=${form.frequency}`]
    if (form.byWeekday) {
      rruleParts.push(`BYDAY=${form.byWeekday}`)
    }

    const payload = {
      venue_id: venueId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      tags: form.tags
        ? form.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : null,
      price_info: form.priceInfo.trim() || null,
      recurrence_rule: rruleParts.join(';'),
      start_time: form.startTime,
      end_time: form.endTime || null,
      starts_on: form.startsOn,
      ends_on: form.endsOn || null,
    }

    try {
      const res = await fetch(
        `/api/dash/recurring-events${recurringEventId ? `?id=${recurringEventId}` : ''}`,
        {
          method: recurringEventId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )

      let json: any = null
      try {
        json = await res.json()
      } catch (parseErr) {
        console.warn('⚠️ Failed to parse JSON:', parseErr)
      }

      if (!res.ok) {
        console.error('RecurringEventForm error:', json)
        setError(json?.error || 'Error saving recurring event')
      } else {
        setSuccessMessage(
          recurringEventId
            ? 'Recurring event updated successfully!'
            : 'Recurring event created successfully!'
        )
        if (!recurringEventId) {
          setForm({
            title: '',
            description: '',
            tags: '',
            priceInfo: '',
            frequency: 'WEEKLY',
            byWeekday: '',
            startsOn: '',
            endsOn: '',
            startTime: '',
            endTime: '',
          })
        }
        onSuccess?.()
      }
    } catch (err) {
      console.error('RecurringEventForm fetch error:', err)
      setError('Unexpected error creating/updating event.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {successMessage && (
        <p className="text-green-600 text-sm">{successMessage}</p>
      )}

      {/* Title */}
      <div>
        <label className="block text-sm font-medium mb-1">Event Title</label>
        <input
          type="text"
          value={form.title}
          onChange={handleChange('title')}
          className={cn(
            'w-full border rounded px-3 py-2 focus:outline-none focus:ring',
            'dark:bg-gray-800 dark:border-gray-700'
          )}
          placeholder="Recurring Event Name"
          required
        />
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Start Date
          </label>
          <input
            type="date"
            value={form.startsOn}
            onChange={handleChange('startsOn')}
            className={cn(
              'w-full border rounded px-3 py-2 focus:outline-none focus:ring',
              'dark:bg-gray-800 dark:border-gray-700'
            )}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            End Date (optional)
          </label>
          <input
            type="date"
            value={form.endsOn}
            onChange={handleChange('endsOn')}
            className={cn(
              'w-full border rounded px-3 py-2 focus:outline-none focus:ring',
              'dark:bg-gray-800 dark:border-gray-700'
            )}
          />
        </div>
      </div>

      {/* Times */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Start Time
          </label>
          <input
            type="time"
            value={form.startTime}
            onChange={handleChange('startTime')}
            className={cn(
              'w-full border rounded px-3 py-2 focus:outline-none focus:ring',
              'dark:bg-gray-800 dark:border-gray-700'
            )}
            required
          />
        </div>

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
      </div>

      {/* Recurrence Frequency */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Recurrence Frequency
        </label>
        <select
          value={form.frequency}
          onChange={handleChange('frequency')}
          className={cn(
            'w-full border rounded px-3 py-2 focus:outline-none focus:ring',
            'dark:bg-gray-800 dark:border-gray-700'
          )}
        >
          {FREQUENCY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {form.frequency === 'WEEKLY' && (
        <div>
          <label className="block text-sm font-medium mb-1">
            Weekday Codes (e.g., MO,TU)
          </label>
          <input
            type="text"
            value={form.byWeekday}
            onChange={handleChange('byWeekday')}
            className={cn(
              'w-full border rounded px-3 py-2 focus:outline-none focus:ring',
              'dark:bg-gray-800 dark:border-gray-700'
            )}
            placeholder="MO,FR"
          />
        </div>
      )}

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
          placeholder="party, music"
        />
      </div>

      {/* Price */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Price Info
        </label>
        <input
          type="text"
          value={form.priceInfo}
          onChange={handleChange('priceInfo')}
          className={cn(
            'w-full border rounded px-3 py-2 focus:outline-none focus:ring',
            'dark:bg-gray-800 dark:border-gray-700'
          )}
          placeholder="Free, $10 cover"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Description
        </label>
        <textarea
          value={form.description}
          onChange={handleChange('description')}
          className={cn(
            'w-full border rounded px-3 py-2 focus:outline-none focus:ring',
            'dark:bg-gray-800 dark:border-gray-700'
          )}
          rows={4}
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className={cn(
          'w-full bg-indigo-600 text-white py-2 rounded font-semibold hover:bg-indigo-700',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        {loading
          ? 'Saving…'
          : recurringEventId
          ? 'Update Recurring Event'
          : 'Create Recurring Event'}
      </button>
    </form>
  )
}
