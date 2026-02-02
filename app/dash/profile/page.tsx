'use client'

import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import TimeSelector from '@/components/ui/timeselector'

const VIBE_OPTIONS = ['Chill', 'Lively', 'Romantic', 'Trendy', 'Historic']
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function DashProfilePage() {
  const supabase = supabaseBrowser()

  const [venueId, setVenueId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [address, setAddress] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [customTag, setCustomTag] = useState('')
  const [contact, setContact] = useState('')
  const [hours, setHours] = useState<Record<string, { open: string; close: string }> | null>(null)

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user?.email) return

      const { data: venueUser } = await supabase
        .from('venue_users')
        .select('venue_id')
        .eq('email', user.email)
        .single()

      if (!venueUser) return

      setVenueId(venueUser.venue_id)

      const { data: venue } = await supabase
        .from('venues')
        .select('name, description, address, tags, contact, hours')
        .eq('id', venueUser.venue_id)
        .single()

      if (venue) {
        setName(venue.name ?? '')
        setDescription((venue as any).description ?? '')
        setAddress(venue.address ?? '')
        setTags(venue.tags ?? [])
        setContact(Array.isArray(venue.contact) ? venue.contact.join(', ') : '')
        const rawHours = venue.hours
        if (rawHours && typeof rawHours === 'object' && !Array.isArray(rawHours)) {
          setHours(rawHours as Record<string, { open: string; close: string }>)
        } else {
          setHours(null)
        }
      }

      setLoading(false)
    }

    load()
  }, [])

  const toggleTag = (tag: string) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const addCustomTag = () => {
    const trimmed = customTag.trim()
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed])
    }
    setCustomTag('')
  }

  const updateHours = (day: string, open: string, close: string) => {
    setHours((prev) => ({
      ...(prev || {}),
      [day.toLowerCase()]: { open, close },
    }))
  }

  const saveProfile = async () => {
    if (!venueId) return
    setSaving(true)

    const normalizedHours: Record<string, { open: string | null; close: string | null }> = {}
    if (hours) {
      for (const [day, times] of Object.entries(hours)) {
        normalizedHours[day.toLowerCase()] = {
          open: times?.open?.trim() || null,
          close: times?.close?.trim() || null,
        }
      }
    }

    const payload = {
      name: name.trim() || null,
      description: description.trim() || null,
      address: address.trim() || null,
      tags: tags.length > 0 ? tags : null,
      contact:
        typeof contact === 'string' && contact.length > 0
          ? contact
              .split(',')
              .map((url) => url.trim())
              .filter(Boolean)
          : null,
      hours: Object.keys(normalizedHours).length > 0 ? normalizedHours : null,
    }

    const { error } = await supabase
      .from('venues')
      .update(payload)
      .eq('id', venueId)

    setSaving(false)

    if (error) {
      alert('Error saving profile: ' + error.message)
    } else {
      alert('Profile updated successfully.')
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Loading profile…</p>
  }

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-2xl font-bold">Edit Venue Profile</h1>

      <div className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium mb-1">Venue Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-sm"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-sm"
            rows={3}
          />
        </div>

        {/* Address */}
        <div>
          <label className="block text-sm font-medium mb-1">Address</label>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full rounded-md px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-sm"
            rows={2}
            placeholder={`123 Main St\nAtlanta, GA 30303`}
          />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium mb-1">Vibe Tags</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {VIBE_OPTIONS.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-3 py-1 rounded-full text-sm border transition ${
                  tags.includes(tag)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-transparent border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value)}
              placeholder="Add your own…"
              className="rounded px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            />
            <button
              onClick={addCustomTag}
              className="text-sm bg-gray-200 dark:bg-gray-700 px-3 py-1 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Add
            </button>
          </div>
        </div>

        {/* Contact */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Contact / Social Links (comma-separated)
          </label>
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="https://instagram.com/yourvenue, https://linktr.ee/yourvenue"
            className="w-full rounded-md px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-sm"
          />
        </div>

        {/* Hours */}
        <div>
          <label className="block text-sm font-medium mb-1">Hours</label>
          <div className="space-y-3">
            {DAYS.map((day) => (
              <div key={day} className="flex items-center gap-3">
                <div className="w-20 text-sm font-medium">{day}</div>
                <TimeSelector
                  value={hours?.[day.toLowerCase()]?.open || ''}
                  onChange={(val) => updateHours(day, val, hours?.[day.toLowerCase()]?.close || '')}
                />
                <span className="text-sm">to</span>
                <TimeSelector
                  value={hours?.[day.toLowerCase()]?.close || ''}
                  onChange={(val) => updateHours(day, hours?.[day.toLowerCase()]?.open || '', val)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <button
            onClick={saveProfile}
            disabled={saving}
            className="px-6 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
