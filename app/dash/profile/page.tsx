'use client'

import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'

const VIBE_OPTIONS = ['Chill', 'Lively', 'Romantic', 'Trendy', 'Historic']

export default function DashProfilePage() {
  const supabase = supabaseBrowser()

  const [venueId, setVenueId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [contact, setContact] = useState('')
  const [hours, setHours] = useState('')

  /* ------------------------------------------------------------------ */
  /* Load venue data                                                     */
  /* ------------------------------------------------------------------ */
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
        .select('name, description, tags, contact, hours')
        .eq('id', venueUser.venue_id)
        .single()

      if (venue) {
        setName(venue.name ?? '')
        setDescription((venue as any).description ?? '')
        setTags(venue.tags ?? [])
        setContact((venue as any).contact ?? '')
        setHours(
          (venue as any).hours
            ? JSON.stringify((venue as any).hours, null, 2)
            : ''
        )
      }

      setLoading(false)
    }

    load()
  }, [])

  /* ------------------------------------------------------------------ */
  /* Helpers                                                            */
  /* ------------------------------------------------------------------ */

  const toggleTag = (tag: string) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const saveProfile = async () => {
    if (!venueId) return
    setSaving(true)

    let parsedHours: Record<string, any> | null = null
    if (hours.trim()) {
      try {
        parsedHours = JSON.parse(hours)
      } catch {
        alert('Hours must be valid JSON.')
        setSaving(false)
        return
      }
    }

    const { error } = await supabase
      .from('venues')
      .update({
        name,
        description: description || null,
        tags,
        contact: contact || null,
        hours: parsedHours,
      })
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

  /* ------------------------------------------------------------------ */
  /* UI                                                                 */
  /* ------------------------------------------------------------------ */

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

        {/* Vibes */}
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
        </div>

        {/* Contact */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Contact / Social Link
          </label>
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="https://instagram.com/yourvenue"
            className="w-full rounded-md px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-sm"
          />
        </div>

        {/* Hours */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Hours (JSON format)
          </label>
          <textarea
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder={`{ "mon": "5pm-11pm", "fri": "4pm-1am" }`}
            className="w-full rounded-md px-3 py-2 font-mono bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-sm"
            rows={4}
          />
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
