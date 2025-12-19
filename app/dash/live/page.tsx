'use client'

import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import EventForm from '@/components/dash/events/EventForm'
import RecurringEventForm from '@/components/dash/events/RecurringEventForm'
import VenueCalendar from '@/components/dash/events/VenueCalendar'
import EditEventModal from '@/components/dash/events/EditEventModal'
import EditRecurringEventModal from '@/components/dash/events/EditRecurringEventModal'

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

  const [events, setEvents] = useState<any[]>([])
  const [recurringEvents, setRecurringEvents] = useState<any[]>([])
  const [refreshKey, setRefreshKey] = useState(0)

  const [editingEvent, setEditingEvent] = useState<any | null>(null)
  const [editingRecurring, setEditingRecurring] = useState<any | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showRecurringModal, setShowRecurringModal] = useState(false)

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

      const vid = venueUser.venue_id
      setVenueId(vid)

      const { data: liveStatus } = await supabase
        .from('venue_live_status')
        .select('is_open_for_dropins, status_tags')
        .eq('venue_id', vid)
        .single<LiveStatus>()

      if (liveStatus) {
        setIsOpen(!!liveStatus.is_open_for_dropins)
        setTags(liveStatus.status_tags ?? [])
      }

      setLoading(false)
      await fetchEvents(vid)
    }

    load()
  }, [])

  const fetchEvents = async (vid: string) => {
    const [eventRes, recurringRes] = await Promise.all([
      fetch(`/api/dash/events?venue_id=${vid}`),
      fetch(`/api/dash/recurring-events?venue_id=${vid}`),
    ])

    if (eventRes.ok) {
      const json = await eventRes.json()
      setEvents(json)
    }

    if (recurringRes.ok) {
      const json = await recurringRes.json()
      setRecurringEvents(json)
    }
  }

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

  const handleEditClick = (event: any) => {
    setEditingEvent(event)
    setShowEditModal(true)
  }

  const handleEditRecurringClick = (rec: any) => {
    setEditingRecurring(rec)
    setShowRecurringModal(true)
  }

  const handleDeleteClick = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return

    const res = await fetch(`/api/dash/events?id=${eventId}`, {
      method: 'DELETE',
    })

    if (res.ok) {
      setRefreshKey((prev) => prev + 1)
      fetchEvents(venueId!)
    } else {
      console.error('Failed to delete event')
    }
  }

  const handleDeleteRecurringClick = async (id: string) => {
    if (!confirm('Delete this recurring event?')) return
    const res = await fetch(`/api/dash/recurring-events?id=${id}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      setRefreshKey((prev) => prev + 1)
      fetchEvents(venueId!)
    }
  }

  const formatDateRange = (start: string, end?: string) => {
  const startDate = new Date(start)
  const endDate = end ? new Date(end) : null

  const pad = (n: number) => n.toString().padStart(2, '0')

  const formatTime = (d: Date) =>
    `${((d.getHours() + 11) % 12) + 1}:${pad(d.getMinutes())} ${d.getHours() >= 12 ? 'pm' : 'am'}`

  const formattedDate = `${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}-${startDate.getFullYear()}`
  const formattedTime = `${formatTime(startDate)}${endDate ? ` to ${formatTime(endDate)}` : ''}`

  return `${formattedDate} @ ${formattedTime}`
}

const formatRecurringRange = (ev: any) => {
  if (!ev.start_time || !ev.recurrence_rule) return 'Recurring details unavailable'

  const start = new Date(`1970-01-01T${ev.start_time}`)
  const end = ev.end_time ? new Date(`1970-01-01T${ev.end_time}`) : null

  const formatTime = (d: Date) =>
    `${((d.getHours() + 11) % 12) + 1}:${d.getMinutes().toString().padStart(2, '0')} ${d.getHours() >= 12 ? 'pm' : 'am'}`

  const formatDate = (d: string) => {
    const dt = new Date(d)
    return `${(dt.getMonth() + 1).toString().padStart(2, '0')}-${dt.getDate().toString().padStart(2, '0')}-${dt.getFullYear()}`
  }

  const timeRange = `${formatTime(start)}${end ? ` to ${formatTime(end)}` : ''}`
  const dateSpan = `${formatDate(ev.starts_on)} to ${formatDate(ev.ends_on)}`

  const rule = ev.recurrence_rule
  let freq = ''
  const dayMap: Record<string, string> = {
    MO: 'Monday', TU: 'Tuesday', WE: 'Wednesday', TH: 'Thursday',
    FR: 'Friday', SA: 'Saturday', SU: 'Sunday',
  }

  if (rule.includes('FREQ=DAILY')) {
    freq = `every day`
  } else if (rule.includes('FREQ=WEEKLY')) {
    const dayMatch = rule.match(/BYDAY=([A-Z,]+)/)
    const days = dayMatch?.[1].split(',').map((d: string) => dayMap[d] || d)
    freq = `every ${days?.join(', ')}`
  } else if (rule.includes('FREQ=MONTHLY')) {
    const byDayMatch = rule.match(/BYDAY=([1-4]?)([A-Z]{2})/)
    const byMonthDayMatch = rule.match(/BYMONTHDAY=(\d+)/)

    if (byDayMatch) {
      const ordinals = ['1st', '2nd', '3rd', '4th']
      const ordinal = ordinals[parseInt(byDayMatch[1]) - 1] || ''
      const dayName = dayMap[byDayMatch[2]] || byDayMatch[2]
      freq = `every ${ordinal} ${dayName}`
    } else if (byMonthDayMatch) {
      freq = `every ${byMonthDayMatch[1]}th`
    } else {
      freq = 'every month'
    }
  }

  return `${freq} @ ${timeRange} — ${dateSpan}`
}



  const handleModalSuccess = () => {
    setShowEditModal(false)
    setEditingEvent(null)
    setRefreshKey((prev) => prev + 1)
    fetchEvents(venueId!)
  }

  const handleRecurringSuccess = () => {
    setShowRecurringModal(false)
    setEditingRecurring(null)
    setRefreshKey((prev) => prev + 1)
    fetchEvents(venueId!)
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Loading live status…</p>
  }

  return (
    <div className="max-w-4xl space-y-10">
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

      {/* 🗓️ Calendar + Events */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 space-y-6">
        <h2 className="text-xl font-semibold">Manage Events</h2>

        {venueId && (
          <>
            <VenueCalendar venueId={venueId} refreshKey={refreshKey} />
            <EventForm venueId={venueId} onSuccess={handleModalSuccess} />
            <RecurringEventForm venueId={venueId} onSuccess={handleRecurringSuccess} />

            <div className="mt-6 space-y-4">
              {[...events, ...recurringEvents].map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center justify-between border p-3 rounded"
                >
                  <div>
                    <p className="font-semibold">{ev.title}</p>
                    <p className="text-sm text-gray-500">
                    {'starts_at' in ev
                        ? formatDateRange(ev.starts_at, ev.ends_at)
                        : formatRecurringRange(ev)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        ev.starts_at ? handleEditClick(ev) : handleEditRecurringClick(ev)
                      }
                      className="text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() =>
                        ev.starts_at
                          ? handleDeleteClick(ev.id)
                          : handleDeleteRecurringClick(ev.id)
                      }
                      className="text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {showEditModal && editingEvent && (
        <EditEventModal
          event={editingEvent}
          onClose={() => setShowEditModal(false)}
          onSuccess={handleModalSuccess}
        />
      )}

      {showRecurringModal && editingRecurring && (
        <EditRecurringEventModal
            event={editingRecurring} // ✅ FIX: rename prop
            onClose={() => setShowRecurringModal(false)}
            onSuccess={handleRecurringSuccess}
        />
        )}
    </div>
  )
}
