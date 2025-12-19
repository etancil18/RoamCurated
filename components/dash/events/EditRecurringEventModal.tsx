'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

type EditRecurringEventModalProps = {
  event: any
  onClose: () => void
  onSuccess: () => void
}

export default function EditRecurringEventModal({
  event,
  onClose,
  onSuccess,
}: EditRecurringEventModalProps) {
  const [form, setForm] = useState({
    title: event.title || '',
    description: event.description || '',
    tags: (event.tags || []).join(', '),
    price_info: event.price_info || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
    }

  const handleSave = async () => {
    setLoading(true)
    setError(null)

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      tags: form.tags ? form.tags.split(',').map((t: string) => t.trim()) : null,
      price_info: form.price_info.trim() || null,
    }

    try {
      const res = await fetch(`/api/dash/recurring-events?id=${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data?.error || 'Failed to update recurring event')
      }

      onSuccess()
    } catch (err: any) {
      console.error('Update failed:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this recurring event?')) return

    try {
      const res = await fetch(`/api/dash/recurring-events?id=${event.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data?.error || 'Delete failed')
      }

      onSuccess()
    } catch (err: any) {
      console.error('Delete failed:', err)
      setError(err.message)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg p-6 w-full max-w-lg space-y-4">
        <h3 className="text-lg font-semibold">Edit Recurring Event</h3>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            value={form.title}
            onChange={handleChange('title')}
            className={cn('w-full border px-3 py-2 rounded')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Tags</label>
          <input
            value={form.tags}
            onChange={handleChange('tags')}
            placeholder="e.g. music, happy hour"
            className={cn('w-full border px-3 py-2 rounded')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Price Info</label>
          <input
            value={form.price_info}
            onChange={handleChange('price_info')}
            className={cn('w-full border px-3 py-2 rounded')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={handleChange('description')}
            rows={3}
            className={cn('w-full border px-3 py-2 rounded')}
          />
        </div>

        <div className="flex justify-between pt-4">
          <button
            onClick={handleDelete}
            disabled={loading}
            className="text-sm text-red-600 hover:underline"
          >
            Delete
          </button>

          <div className="space-x-2">
            <button
              onClick={onClose}
              disabled={loading}
              className="text-sm px-4 py-2 rounded border"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="text-sm px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              {loading ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
