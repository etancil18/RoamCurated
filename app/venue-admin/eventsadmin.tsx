'use client'

import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import type { Database } from '@/types/supabase'
import { EVENT_ARCHETYPES } from '@/lib/outings/eventArchetypes'
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
  CommandGroup,
} from "@/components/ui/command"

const allowedEmails = ['evantancil@gmail.com', 'otheradmin@example.com']

type VenueSummary = Pick<Database['public']['Tables']['venues']['Row'], 'id' | 'name' | 'city'>

type SocialGroupSummary = {
  id: string
  name: string
  slug: string
}

type EventsAdminProps = {
  selectedVenue: string
  onVenueChange: (venueId: string) => void
  refreshSocialGroupsSignal?: number
}

export default function EventsAdmin({
  selectedVenue,
  onVenueChange,
  refreshSocialGroupsSignal = 0,
}: EventsAdminProps) {
  const supabase = supabaseBrowser()

  const [venuesByCity, setVenuesByCity] = useState<Record<string, VenueSummary[]>>({})
  const [socialGroups, setSocialGroups] = useState<SocialGroupSummary[]>([])
  const [selectedCity, setSelectedCity] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')

  const [form, setForm] = useState({
    title: '',
    date: '',
    start_time: '',
    end_date: '',
    end_time: '',
    tags: '',
    price_info: '',
    description: '',
    ticket_link: '',
    checkin_enabled: true,
    xp_reward: '25',
    social_group_id: '',
    archetype: 'other',
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    async function loadVenuesByCity() {
      const { data: cityRows } = await supabase
        .from('venues')
        .select('city')
        .neq('city', null)
        .order('city', { ascending: true })

      const cities = [...new Set((cityRows ?? []).map((c) => c.city))]
      const cityVenueMap: Record<string, VenueSummary[]> = {}

      await Promise.all(
        cities.map(async (city) => {
          if (!city) return
          const { data: venues } = await supabase
            .from('venues')
            .select('id, name, city')
            .eq('city', city)
            .range(0, 999)

          if (venues) cityVenueMap[city] = venues
        })
      )

      setVenuesByCity(cityVenueMap)
    }

    loadVenuesByCity()
  }, [supabase])

  useEffect(() => {
    async function loadSocialGroups() {
      const { data, error } = await supabase
        .from('social_groups')
        .select('id, name, slug')
        .order('name', { ascending: true })

      if (error) {
        console.error('Failed to load social groups:', error)
        return
      }

      setSocialGroups(data ?? [])
    }

    loadSocialGroups()
  }, [supabase, refreshSocialGroupsSignal])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedVenue) return setError('Please select a venue')

    setLoading(true)
    setError(null)
    setSuccess(false)

    const endDateForPayload = form.end_date || form.date
    const parsedXpReward = Number.parseInt(form.xp_reward, 10)

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      starts_at:
        form.date && form.start_time
          ? new Date(`${form.date}T${form.start_time}:00`).toISOString()
          : null,
      ends_at:
        endDateForPayload && form.end_time
          ? new Date(`${endDateForPayload}T${form.end_time}:00`).toISOString()
          : null,
      tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : null,
      price_info: form.price_info.trim() || null,
      ticket_link: form.ticket_link.trim() || null,
      source_type: 'portal',
      source: 'venue-admin',
      is_active: true,
      checkin_enabled: form.checkin_enabled,
      xp_reward: form.checkin_enabled && Number.isFinite(parsedXpReward) && parsedXpReward > 0
        ? parsedXpReward
        : 0,
      social_group_id: form.social_group_id || null,
      archetype: form.archetype,
    }

    const res = await fetch(`/api/venues/${selectedVenue}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const json = await res.json()

    if (!res.ok) {
      setError(json.details || json.error || 'Error submitting event')
    } else {
      setSuccess(true)
      setForm({
        title: '',
        date: '',
        start_time: '',
        end_date: '',
        end_time: '',
        tags: '',
        price_info: '',
        description: '',
        ticket_link: '',
        checkin_enabled: true,
        xp_reward: '25',
        social_group_id: '',
        archetype: 'other',
      })
    }

    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Submit Single Event</h2>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {success && <p className="text-green-600 text-sm">✅ Event submitted successfully!</p>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block mb-1 font-medium">Select City</label>
          <select
            value={selectedCity}
            onChange={(e) => {
              setSelectedCity(e.target.value)
              onVenueChange('')
            }}
            className="w-full border p-2 rounded"
          >
            <option value="">-- Choose City --</option>
            {Object.keys(venuesByCity).map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>

        {selectedCity && (
          <div>
            <label className="block mb-1 font-medium">Search Venue</label>

            <div className="border rounded">
              <Command>
                <CommandInput
                  placeholder="Type to search venues..."
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                />
                <CommandList>
                  <CommandGroup heading="Venues">
                    {venuesByCity[selectedCity]
                      ?.filter((venue) =>
                        venue.name?.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((venue) => (
                        <CommandItem
                          key={venue.id}
                          value={venue.name ?? ''}
                          onSelect={() => {
                            onVenueChange(venue.id)
                            setSearchQuery(venue.name ?? '')
                          }}
                        >
                          {venue.name}
                        </CommandItem>
                      ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>

            {selectedVenue && (
              <p className="text-sm text-green-600 mt-2">
                Selected venue:{' '}
                {venuesByCity[selectedCity]?.find((v) => v.id === selectedVenue)?.name}
              </p>
            )}
          </div>
        )}

        <div>
          <label className="block mb-1 font-medium">Social Group / Organizer</label>
          <select
            value={form.social_group_id}
            onChange={(e) => setForm({ ...form, social_group_id: e.target.value })}
            className="w-full border p-2 rounded"
          >
            <option value="">-- No Social Group --</option>
            {socialGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-sm text-gray-500">
            Links check-ins and XP to a group dashboard.
          </p>
        </div>

        <div>
          <label className="block mb-1 font-medium">Event Title</label>
          <input
            required
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full border p-2 rounded"
            placeholder="Live Music at Midtown Bar"
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">Event Archetype</label>
          <select
            required
            value={form.archetype}
            onChange={(e) => setForm({ ...form, archetype: e.target.value })}
            className="w-full border p-2 rounded"
          >
            {EVENT_ARCHETYPES.map((archetype) => (
              <option key={archetype.value} value={archetype.value}>
                {archetype.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-sm text-gray-500">
            Used by the outing planner to choose better before/after stops.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block mb-1 font-medium">Start Date</label>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) =>
                setForm({
                  ...form,
                  date: e.target.value,
                  end_date: form.end_date || e.target.value,
                })
              }
              className="w-full border p-2 rounded"
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">Start Time</label>
            <input
              type="time"
              required
              value={form.start_time}
              onChange={(e) => setForm({ ...form, start_time: e.target.value })}
              className="w-full border p-2 rounded"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block mb-1 font-medium">End Date</label>
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              className="w-full border p-2 rounded"
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">End Time</label>
            <input
              type="time"
              value={form.end_time}
              onChange={(e) => setForm({ ...form, end_time: e.target.value })}
              className="w-full border p-2 rounded"
            />
          </div>
        </div>

        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <label className="font-medium">Enable Event XP</label>
              <p className="text-sm text-gray-500">
                Allows users to check in and earn XP for this event.
              </p>
            </div>

            <input
              type="checkbox"
              checked={form.checkin_enabled}
              onChange={(e) =>
                setForm({
                  ...form,
                  checkin_enabled: e.target.checked,
                  xp_reward: e.target.checked ? form.xp_reward || '25' : '0',
                })
              }
              className="h-5 w-5"
            />
          </div>

          {form.checkin_enabled && (
            <div>
              <label className="block mb-1 font-medium">XP Reward</label>
              <input
                type="number"
                min="1"
                max="500"
                value={form.xp_reward}
                onChange={(e) => setForm({ ...form, xp_reward: e.target.value })}
                className="w-full border p-2 rounded"
                placeholder="25"
              />
            </div>
          )}
        </div>

        <div>
          <label className="block mb-1 font-medium">Tags (comma-separated)</label>
          <input
            type="text"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            className="w-full border p-2 rounded"
            placeholder="dj, food, rooftop"
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">Price Info</label>
          <input
            type="text"
            value={form.price_info}
            onChange={(e) => setForm({ ...form, price_info: e.target.value })}
            className="w-full border p-2 rounded"
            placeholder="$15 cover or Free"
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">Ticket Link (optional)</label>
          <input
            type="url"
            value={form.ticket_link}
            onChange={(e) => setForm({ ...form, ticket_link: e.target.value })}
            className="w-full border p-2 rounded"
            placeholder="https://tickets.example.com"
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">Event Description</label>
          <textarea
            rows={4}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full border p-2 rounded"
            placeholder="Brief details about the event..."
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded font-semibold disabled:opacity-50"
        >
          {loading ? 'Submitting...' : 'Submit Event'}
        </button>
      </form>
    </div>
  )
}