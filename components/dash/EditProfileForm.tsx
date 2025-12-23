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
    contact: string[] // ← UPDATED to array
    hours: Record<string, DayHours> | null
  }
  onSuccess?: () => void
}

export default function EditProfileForm({ initialData, onSuccess }: EditProfileFormProps) {
  const supabase = supabaseBrowser()

  const [name, setName] = useState(initialData.name || '')
  const [description, setDescription] = useState(initialData.description || '')
  const [tags, setTags] = useState<string[]>(initialData.tags || [])
  const [customTag, setCustomTag] = useState('')
  const [contact, setContact] = useState<string[]>(initialData.contact || [])
  const [newContact, setNewContact] = useState('')
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

  const addContactLink = () => {
    const clean = newContact.trim()
    if (clean && !contact.includes(clean)) {
      setContact([...contact, clean])
      setNewContact('')
    }
  }

  const removeContactLink = (url: string) => {
    setContact((prev) => prev.filter((c) => c !== url))
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

    const normalizedHours: any = {}
    Object.entries(hours).forEach(([day, info]) => {
      if (info.closed) {
        normalizedHours[day] = { open: null, close: null, closed: true }
      } else {
        normalizedHours[day] = {
          open: info.open || null,
          close: info.close || null,
          closed: false,
        }
      }
    })

    const payload = {
      name: name.trim() || null,
      description: description.trim() || null,
      tags: tags.length > 0 ? tags : null,
      contact: contact.length > 0 ? contact : null,
      hours: Object.keys(normalizedHours).length ? normalizedHours : null,
    }

    const { error } = await supabase
      .from('venues')
      .update(payload)
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

      {/* Contact Links (array support) */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Contact / Social Links
        </label>
        <div className="space-y-2">
          {contact.map((url) => (
            <div
              key={url}
              className="flex items-center justify-between gap-2 border px-3 py-2 rounded-md bg-white dark:bg-gray-800"
            >
              <span className="text-sm truncate">{url}</span>
              <button
                onClick={() => removeContactLink(url)}
                className="text-xs text-red-600 hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-3">
          <input
            value={newContact}
            onChange={(e) => setNewContact(e.target.value)}
            placeholder="https://instagram.com/..."
            className="px-3 py-2 border rounded-md bg-white dark:bg-gray-800 w-full"
          />
          <button
            type="button"
            onClick={addContactLink}
            className="px-4 py-2 bg-blue-600 text-white rounded-md"
          >
            Add
          </button>
        </div>
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
