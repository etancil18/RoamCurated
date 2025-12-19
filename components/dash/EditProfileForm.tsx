'use client'

import React, { useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'

const VIBE_OPTIONS = ['Chill', 'Lively', 'Romantic', 'Trendy', 'Historic']
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => {
  const hours = Math.floor(i / 4)
  const minutes = (i % 4) * 15
  const period = hours >= 12 ? 'pm' : 'am'
  const displayHour = hours % 12 === 0 ? 12 : hours % 12
  return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`
})

type DayHours = {
  open: string | null
  close: string | null
  closed: boolean
}

export type EditProfileFormProps = {
  initialData: {
    id: string
    name: string
    description: string
    tags: string[]
    contact: string
    hours: Record<string, DayHours> | null
  }
  onSuccess?: () => void
}

export default function EditProfileForm({ initialData, onSuccess }: EditProfileFormProps) {
  const supabase = supabaseBrowser()

  const [name, setName] = useState(initialData.name)
  const [description, setDescription] = useState(initialData.description)
  const [tags, setTags] = useState<string[]>(initialData.tags || [])
  const [customTag, setCustomTag] = useState('')
  const [contact, setContact] = useState(initialData.contact || '')
  const [saving, setSaving] = useState(false)

  const [hours, setHours] = useState<Record<string, DayHours>>(
    initialData.hours ??
      DAYS.reduce((acc, day) => {
        acc[day.toLowerCase()] = { open: null, close: null, closed: false }
        return acc
      }, {} as Record<string, DayHours>)
  )

  const toggleTag = (tag: string) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const addCustomTag = () => {
    const clean = customTag.trim()
    if (clean && !tags.includes(clean)) {
      setTags([...tags, clean])
      setCustomTag('')
    }
  }

  const updateHours = (day: string, field: keyof DayHours, value: any) => {
    setHours((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }))
  }

  const saveProfile = async () => {
    setSaving(true)

    const { error } = await supabase
      .from('venues')
      .update({
        name,
        description: description || null,
        tags,
        contact: contact || null,
        hours,
      })
      .eq('id', initialData.id)

    setSaving(false)

    if (error) {
      alert('Error saving profile: ' + error.message)
    } else {
      alert('Profile saved!')
      onSuccess?.()
    }
  }

  return (
    <div className="space-y-6">
      {/* Venue Name */}
      <div>
        <label className="block text-sm font-medium mb-1">Venue Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md px-3 py-2 border bg-white dark:bg-gray-800"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-md px-3 py-2 border bg-white dark:bg-gray-800"
        />
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium mb-1">Vibe Tags</label>
        <div className="flex flex-wrap gap-2">
          {VIBE_OPTIONS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`px-3 py-1 rounded-full border text-sm ${
                tags.includes(tag)
                  ? 'bg-blue-600 text-white'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        <div className="flex gap-2 mt-3">
          <input
            value={customTag}
            onChange={(e) => setCustomTag(e.target.value)}
            placeholder="Add custom tag"
            className="px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
          />
          <button
            type="button"
            onClick={addCustomTag}
            className="px-4 py-2 bg-blue-600 text-white rounded-md"
          >
            Add
          </button>
        </div>
      </div>

      {/* Contact */}
      <div>
        <label className="block text-sm font-medium mb-1">Contact / Social</label>
        <input
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          className="w-full rounded-md px-3 py-2 border bg-white dark:bg-gray-800"
        />
      </div>

      {/* Hours */}
      <div>
        <label className="block text-sm font-medium mb-2">Hours of Operation</label>

        <div className="space-y-3">
          {DAYS.map((day) => {
            const key = day.toLowerCase()
            const h = hours[key]

            return (
              <div
                key={day}
                className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center"
              >
                <span className="font-medium">{day}</span>

                <select
                  disabled={h.closed}
                  value={h.open || ''}
                  onChange={(e) => updateHours(key, 'open', e.target.value)}
                  className="border rounded px-2 py-1"
                >
                  <option value="">Open</option>
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>

                <select
                  disabled={h.closed}
                  value={h.close || ''}
                  onChange={(e) => updateHours(key, 'close', e.target.value)}
                  className="border rounded px-2 py-1"
                >
                  <option value="">Close</option>
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={h.closed}
                    onChange={(e) =>
                      updateHours(key, 'closed', e.target.checked)
                    }
                  />
                  Closed
                </label>
              </div>
            )
          })}
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={saveProfile}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Profile'}
        </button>
      </div>
    </div>
  )
}
