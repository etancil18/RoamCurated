'use client'

import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'

type LiveStatus = {
  is_open_for_dropins: boolean | null
  status_tags: string[] | null
}

const TAG_OPTIONS = [
  'Busy',
  'Happy Hour',
  'Live Music',
  'DJ',
  'Private Event',
  'Chill',
]

export default function DashLivePage() {
  const supabase = supabaseBrowser()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [venueId, setVenueId] = useState<string | null>(null)

  const [isOpen, setIsOpen] = useState(false)
  const [tags, setTags] = useState<string[]>([])

  // 🔹 Fetch venue + current live status
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

      const { data: liveStatus } = await supabase
        .from('venue_live_status')
        .select('is_open_for_dropins, status_tags')
        .eq('venue_id', venueUser.venue_id)
        .single<LiveStatus>()

      if (liveStatus) {
        // ✅ FIX: coerce nullable boolean
        setIsOpen(!!liveStatus.is_open_for_dropins)
        setTags(liveStatus.status_tags ?? [])
      }

      setLoading(false)
    }

    load()
  }, [])

  // 🔹 Save handler (upsert)
  const saveStatus = async () => {
    if (!venueId) return
    setSaving(true)

    await supabase.from('venue_live_status').upsert({
      venue_id: venueId,
      is_open_for_dropins: isOpen,
      status_tags: tags,
      updated_at: new Date().toISOString(),
    })

    setSaving(false)
  }

  const toggleTag = (tag: string) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Loading live status…</p>
  }

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-2xl font-bold">Live Status</h1>

      {/* Open Toggle */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">Open for Drop‑Ins</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Show users that you’re currently welcoming walk‑ins
            </p>
          </div>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`w-14 h-8 rounded-full relative transition ${
              isOpen ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition ${
                isOpen ? 'translate-x-6' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Status Tags */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <p className="font-semibold mb-2">Current Vibe</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Select any that apply right now
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {TAG_OPTIONS.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`px-3 py-1 rounded-full text-sm border transition ${
                tags.includes(tag)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-transparent border-gray-300 dark:border-gray-600'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        <button
          onClick={saveStatus}
          disabled={saving}
          className="px-4 py-2 bg-black text-white text-sm rounded hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 transition"
        >
          {saving ? 'Saving…' : 'Save Status'}
        </button>
      </div>
    </div>
  )
}
