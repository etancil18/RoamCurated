'use client'

import { useState, useEffect, FormEvent } from 'react'
import { cn } from '@/lib/utils'
import { supabaseBrowser } from '@/lib/supabase/client'

type RecurringEventAdminProps = {
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

export default function RecurringEventAdmin({
  venueId,
  recurringEventId,
  initialValues,
  onSuccess,
}: RecurringEventAdminProps) {
  const supabase = supabaseBrowser()

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

  // Prefill when editing
  useEffect(() => {
    if (!initialValues) return

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
    if (form.byWeekday) rruleParts.push(`BYDAY=${form.byWeekday}`)

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
      const { error } = await supabase.from('recurring_events').insert([payload])

      if (error) {
        console.error("❌ Supabase insert error:", error)
        setError(error.message)
      } else {
        setSuccessMessage('Recurring event created successfully!')

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

        onSuccess?.()
      }
    } catch (err: any) {
      setError(err.message || 'Unexpected error creating recurring event.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-10 pt-8 border-t">
      <h2 className="text-xl font-semibold mb-4">
        Create Recurring Event (Weekly / Daily / Monthly)
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {successMessage && (
          <p className="text-green-600 text-sm">{successMessage}</p>
        )}

        <input
          type="text"
          placeholder="Event Title"
          value={form.title}
          onChange={handleChange('title')}
          className="w-full border rounded px-3 py-2 dark:bg-gray-800"
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <input
            type="date"
            value={form.startsOn}
            onChange={handleChange('startsOn')}
            className="w-full border rounded px-3 py-2 dark:bg-gray-800"
            required
          />
          <input
            type="date"
            value={form.endsOn}
            onChange={handleChange('endsOn')}
            className="w-full border rounded px-3 py-2 dark:bg-gray-800"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <input
            type="time"
            value={form.startTime}
            onChange={handleChange('startTime')}
            className="w-full border rounded px-3 py-2 dark:bg-gray-800"
            required
          />
          <input
            type="time"
            value={form.endTime}
            onChange={handleChange('endTime')}
            className="w-full border rounded px-3 py-2 dark:bg-gray-800"
          />
        </div>

        <select
          value={form.frequency}
          onChange={handleChange('frequency')}
          className="w-full border rounded px-3 py-2 dark:bg-gray-800"
        >
          {FREQUENCY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {form.frequency === 'WEEKLY' && (
          <input
            type="text"
            placeholder="Weekday codes (MO,TU,FR)"
            value={form.byWeekday}
            onChange={handleChange('byWeekday')}
            className="w-full border rounded px-3 py-2 dark:bg-gray-800"
          />
        )}

        <input
          type="text"
          placeholder="Tags (comma-separated)"
          value={form.tags}
          onChange={handleChange('tags')}
          className="w-full border rounded px-3 py-2 dark:bg-gray-800"
        />

        <input
          type="text"
          placeholder="Price Info"
          value={form.priceInfo}
          onChange={handleChange('priceInfo')}
          className="w-full border rounded px-3 py-2 dark:bg-gray-800"
        />

        <textarea
          rows={3}
          placeholder="Description"
          value={form.description}
          onChange={handleChange('description')}
          className="w-full border rounded px-3 py-2 dark:bg-gray-800"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-2 rounded font-semibold disabled:opacity-50"
        >
          {loading
            ? 'Saving…'
            : recurringEventId
            ? 'Update Recurring Event'
            : 'Create Recurring Event'}
        </button>
      </form>
    </div>
  )
}
