'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type VenueOption = {
  id: string
  name: string
  city: string | null
  lat: number | null
  lon: number | null
}

type PropertyOption = {
  id: string
  name: string
  city: string | null
  slug?: string | null
}

type EventJourneyPropertyLink = {
  id: string
  event_journey_id: string
  property_id: string
}

type DestinationKind = 'venue' | 'custom'
type DestinationCoordinatesSource = 'venue' | 'manual'
type ArrivalPolicy = 'by_start' | 'midpoint_deadline' | 'window' | 'custom'
type ArrivalPreference = 'early' | 'on_time' | 'fashionably_late' | 'late_ok'

type EventJourney = {
  id: string
  city: string
  title: string
  slug: string
  event_name: string
  event_start_at: string
  event_end_at: string | null
  event_type: string | null
  destination_name: string
  destination_venue_id: string | null
  destination_lat: number | null
  destination_lon: number | null
  destination_kind: DestinationKind | null
  destination_coordinates_source: DestinationCoordinatesSource | null
  arrival_policy: ArrivalPolicy | null
  arrival_preference: ArrivalPreference | null
  vibes: string[] | null
  tags: string[] | null
  ideal_stop_duration_minutes: number | null
  range_expansion_pct: number | null
  max_dynamic_stops: number | null
  status: string | null
  notes: string | null
  property_id: string | null
  event_id: string | null
}

type EventJourneyStop = {
  id: string
  event_journey_id: string
  venue_id: string
  stop_order: number
  role: string
  is_locked: boolean
  venue?: VenueOption | null
}

const INITIAL_FORM = {
  city: '',
  title: '',
  slug: '',
  eventName: '',
  eventStartAt: '',
  eventEndAt: '',
  eventType: '',
  destinationName: '',
  destinationVenueId: '',
  destinationLat: '',
  destinationLon: '',
  arrivalPolicy: 'by_start' as ArrivalPolicy,
  arrivalPreference: 'on_time' as ArrivalPreference,
  vibes: '',
  tags: '',
  idealStopDurationMinutes: '120',
  rangeExpansionPct: '0.3',
  maxDynamicStops: '3',
  status: 'draft',
  notes: '',
  propertyIds: [] as string[],
  eventId: '',
}

function normalizeCityKey(input?: string | null) {
  const raw = (input ?? '').trim().toLowerCase()

  const aliases: Record<string, string> = {
    atl: 'atl',
    atlanta: 'atl',
    'atlanta ga': 'atl',

    nyc: 'nyc',
    'new york': 'nyc',
    'new york city': 'nyc',
    manhattan: 'nyc',

    porto: 'porto',
    oporto: 'porto',

    lisbon: 'lisbon',
    lisboa: 'lisbon',
  }

  return aliases[raw] ?? raw
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function parseCsv(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function formatForDateTimeLocal(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 16)
}

function parseOptionalFloat(value: string) {
  if (!value.trim()) return null
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseOptionalInt(value: string, fallback: number) {
  const parsed = parseInt(value || String(fallback), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

export default function EventJourneysAdmin() {
  const supabase = useMemo(() => supabaseBrowser(), [])
  const adminDb = supabase as any

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingStops, setSavingStops] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [venues, setVenues] = useState<VenueOption[]>([])
  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [journeys, setJourneys] = useState<EventJourney[]>([])
  const [selectedJourneyId, setSelectedJourneyId] = useState<string>('')

  const [form, setForm] = useState(INITIAL_FORM)

  const [newStopVenueId, setNewStopVenueId] = useState('')
  const [newStopRole, setNewStopRole] = useState('preset')
  const [newStopOrder, setNewStopOrder] = useState('1')
  const [newStopLocked, setNewStopLocked] = useState(true)

  const [journeyStops, setJourneyStops] = useState<EventJourneyStop[]>([])

  const selectedDestinationVenue = useMemo(
    () => venues.find((venue) => venue.id === form.destinationVenueId) ?? null,
    [venues, form.destinationVenueId]
  )

  const destinationUsesVenue = Boolean(form.destinationVenueId)

  useEffect(() => {
    async function loadInitialData() {
      setLoading(true)
      setError(null)

      const [
        { data: venueData, error: venueError },
        { data: propertyData, error: propertyError },
        { data: journeyData, error: journeyError },
      ] = await Promise.all([
        supabase
          .from('venues')
          .select('id, name, city, lat, lon')
          .order('city', { ascending: true })
          .order('name', { ascending: true }),
        supabase
          .from('properties')
          .select('id, name, city, slug')
          .order('city', { ascending: true })
          .order('name', { ascending: true }),
        adminDb
          .from('event_journeys')
          .select('*')
          .order('event_start_at', { ascending: true }),
      ])

      if (venueError) setError(venueError.message)
      if (propertyError) setError(propertyError.message)
      if (journeyError) setError(journeyError.message)

      const safeVenues = (venueData as unknown as VenueOption[]) ?? []
      const safeProperties = (propertyData as unknown as PropertyOption[]) ?? []
      const safeJourneys = (journeyData as unknown as EventJourney[]) ?? []

      setVenues(safeVenues)
      setProperties(safeProperties)
      setJourneys(safeJourneys)

      if (safeJourneys.length > 0) {
        const firstId = safeJourneys[0].id
        setSelectedJourneyId((prev) => prev || firstId)
      }

      setLoading(false)
    }

    loadInitialData()
  }, [supabase, adminDb])

  useEffect(() => {
    async function loadJourneyDetails() {
      if (!selectedJourneyId) {
        setJourneyStops([])
        setForm((prev) => ({ ...prev, propertyIds: [] }))
        return
      }

      const [
        { data: stopsData, error: stopsError },
        { data: linksData, error: linksError },
      ] = await Promise.all([
        adminDb
          .from('event_journey_stops')
          .select('*')
          .eq('event_journey_id', selectedJourneyId)
          .order('stop_order', { ascending: true }),
        adminDb
          .from('event_journey_properties')
          .select('id, event_journey_id, property_id')
          .eq('event_journey_id', selectedJourneyId),
      ])

      if (stopsError) {
        setError(stopsError.message)
        return
      }

      if (linksError) {
        setError(linksError.message)
        return
      }

      const stopRows = (stopsData as unknown as EventJourneyStop[]) ?? []
      const propertyLinks =
        (linksData as unknown as EventJourneyPropertyLink[]) ?? []

      const venueMap = new Map(venues.map((v) => [v.id, v]))

      const hydratedStops = stopRows.map((stop) => ({
        ...stop,
        venue: venueMap.get(stop.venue_id) ?? null,
      }))

      setJourneyStops(hydratedStops)
      setForm((prev) => ({
        ...prev,
        propertyIds: propertyLinks.map((link) => link.property_id),
      }))
    }

    loadJourneyDetails()
  }, [selectedJourneyId, adminDb, venues])

  function updateForm<K extends keyof typeof INITIAL_FORM>(
    key: K,
    value: (typeof INITIAL_FORM)[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function resetForm() {
    setForm(INITIAL_FORM)
    setSelectedJourneyId('')
    setJourneyStops([])
    setNewStopVenueId('')
    setNewStopRole('preset')
    setNewStopOrder('1')
    setNewStopLocked(true)
    setError(null)
    setSuccess(null)
  }

  function hydrateFormFromJourney(journey: EventJourney) {
    setForm({
      city: normalizeCityKey(journey.city),
      title: journey.title ?? '',
      slug: journey.slug ?? '',
      eventName: journey.event_name ?? '',
      eventStartAt: formatForDateTimeLocal(journey.event_start_at),
      eventEndAt: formatForDateTimeLocal(journey.event_end_at),
      eventType: journey.event_type ?? '',
      destinationName: journey.destination_name ?? '',
      destinationVenueId: journey.destination_venue_id ?? '',
      destinationLat:
        journey.destination_lat !== null && journey.destination_lat !== undefined
          ? String(journey.destination_lat)
          : '',
      destinationLon:
        journey.destination_lon !== null && journey.destination_lon !== undefined
          ? String(journey.destination_lon)
          : '',
      arrivalPolicy: journey.arrival_policy ?? 'by_start',
      arrivalPreference: journey.arrival_preference ?? 'on_time',
      vibes: (journey.vibes ?? []).join(', '),
      tags: (journey.tags ?? []).join(', '),
      idealStopDurationMinutes: String(
        journey.ideal_stop_duration_minutes ?? 120
      ),
      rangeExpansionPct: String(journey.range_expansion_pct ?? 0.3),
      maxDynamicStops: String(journey.max_dynamic_stops ?? 3),
      status: journey.status ?? 'draft',
      notes: journey.notes ?? '',
      propertyIds: [],
      eventId: journey.event_id ?? '',
    })
  }

  async function handleSelectJourney(journeyId: string) {
    setSelectedJourneyId(journeyId)
    setSuccess(null)
    setError(null)

    const journey = journeys.find((j) => j.id === journeyId)
    if (journey) {
      hydrateFormFromJourney(journey)
    }
  }

  async function handleSaveJourney() {
    setSaving(true)
    setError(null)
    setSuccess(null)

    const eventStartAtISO = form.eventStartAt
      ? new Date(form.eventStartAt).toISOString()
      : ''

    const eventEndAtISO = form.eventEndAt
      ? new Date(form.eventEndAt).toISOString()
      : null

    const manualDestinationLat = parseOptionalFloat(form.destinationLat)
    const manualDestinationLon = parseOptionalFloat(form.destinationLon)

    const destinationKind: DestinationKind = form.destinationVenueId ? 'venue' : 'custom'
    const destinationCoordinatesSource: DestinationCoordinatesSource = form.destinationVenueId
      ? 'venue'
      : 'manual'
    const arrivalPolicy: ArrivalPolicy = form.arrivalPolicy || 'by_start'
    const arrivalPreference: ArrivalPreference =
      form.arrivalPreference || 'on_time'

    const payload = {
      city: normalizeCityKey(form.city),
      title: form.title.trim(),
      slug: (form.slug.trim() || slugify(form.title)).toLowerCase(),
      event_name: form.eventName.trim(),
      event_start_at: eventStartAtISO,
      event_end_at: eventEndAtISO,
      event_type: form.eventType.trim() || null,
      destination_name: form.destinationName.trim(),
      destination_venue_id: form.destinationVenueId || null,
      destination_kind: destinationKind,
      destination_coordinates_source: destinationCoordinatesSource,
      destination_lat: form.destinationVenueId ? null : manualDestinationLat,
      destination_lon: form.destinationVenueId ? null : manualDestinationLon,
      arrival_policy: arrivalPolicy,
      arrival_preference: arrivalPreference,
      vibes: parseCsv(form.vibes),
      tags: parseCsv(form.tags),
      ideal_stop_duration_minutes: parseOptionalInt(
        form.idealStopDurationMinutes,
        120
      ),
      range_expansion_pct: parseFloat(form.rangeExpansionPct || '0.3'),
      max_dynamic_stops: parseOptionalInt(form.maxDynamicStops, 3),
      status: form.status || 'draft',
      notes: form.notes.trim() || null,
      property_id: null,
      event_id: form.eventId.trim() || null,
      updated_at: new Date().toISOString(),
    }

    const requiresEventEndAt =
      payload.arrival_policy === 'midpoint_deadline' ||
      payload.arrival_policy === 'window'

    if (
      !payload.city ||
      !payload.title ||
      !payload.slug ||
      !payload.event_name ||
      !payload.event_start_at ||
      !payload.destination_name
    ) {
      setSaving(false)
      setError('Please complete all required event journey fields.')
      return
    }

    if (!payload.destination_venue_id) {
      if (payload.destination_lat === null || payload.destination_lon === null) {
        setSaving(false)
        setError('Manual destinations require both latitude and longitude.')
        return
      }
    }

    if (requiresEventEndAt && !payload.event_end_at) {
      setSaving(false)
      setError('Flexible-arrival event journeys require an event end time.')
      return
    }

    const query = selectedJourneyId
      ? adminDb
          .from('event_journeys')
          .update(payload)
          .eq('id', selectedJourneyId)
      : adminDb
          .from('event_journeys')
          .insert(payload)
          .select()
          .single()

    const { data, error } = await query

    if (error) {
      setSaving(false)
      setError(error.message)
      return
    }

    const journeyId = selectedJourneyId || (data as EventJourney | null)?.id

    if (!journeyId) {
      setSaving(false)
      setError('Failed to determine event journey id after save.')
      return
    }

    const { error: deleteLinksError } = await adminDb
      .from('event_journey_properties')
      .delete()
      .eq('event_journey_id', journeyId)

    if (deleteLinksError) {
      setSaving(false)
      setError(deleteLinksError.message)
      return
    }

    if (form.propertyIds.length > 0) {
      const linkPayload = form.propertyIds.map((propertyId) => ({
        event_journey_id: journeyId,
        property_id: propertyId,
      }))

      const { error: insertLinksError } = await adminDb
        .from('event_journey_properties')
        .insert(linkPayload)

      if (insertLinksError) {
        setSaving(false)
        setError(insertLinksError.message)
        return
      }
    }

    if (!selectedJourneyId && data) {
      const newJourney = data as unknown as EventJourney
      const hydratedNewJourney: EventJourney = {
        ...newJourney,
        city: normalizeCityKey(newJourney.city),
        property_id: null,
      }

      setJourneys((prev) => [hydratedNewJourney, ...prev])
      setSelectedJourneyId(hydratedNewJourney.id)
      hydrateFormFromJourney(hydratedNewJourney)
      setForm((prev) => ({
        ...prev,
        propertyIds: form.propertyIds,
      }))
    } else if (selectedJourneyId) {
      const updatedJourney: EventJourney = {
        id: selectedJourneyId,
        city: payload.city,
        title: payload.title,
        slug: payload.slug,
        event_name: payload.event_name,
        event_start_at: payload.event_start_at,
        event_end_at: payload.event_end_at,
        event_type: payload.event_type,
        destination_name: payload.destination_name,
        destination_venue_id: payload.destination_venue_id,
        destination_lat: payload.destination_venue_id
          ? selectedDestinationVenue?.lat ?? null
          : payload.destination_lat,
        destination_lon: payload.destination_venue_id
          ? selectedDestinationVenue?.lon ?? null
          : payload.destination_lon,
        destination_kind: destinationKind,
        destination_coordinates_source: destinationCoordinatesSource,
        arrival_policy: arrivalPolicy,
        arrival_preference: arrivalPreference,
        vibes: payload.vibes,
        tags: payload.tags,
        ideal_stop_duration_minutes: payload.ideal_stop_duration_minutes,
        range_expansion_pct: payload.range_expansion_pct,
        max_dynamic_stops: payload.max_dynamic_stops,
        status: payload.status,
        notes: payload.notes,
        property_id: null,
        event_id: payload.event_id,
      }

      setJourneys((prev) =>
        prev.map((journey) =>
          journey.id === selectedJourneyId ? updatedJourney : journey
        )
      )
    }

    setSaving(false)
    setSuccess(selectedJourneyId ? 'Event journey updated.' : 'Event journey created.')
  }

  async function handleDeleteJourney() {
    if (!selectedJourneyId) return

    const confirmed = window.confirm(
      'Delete this event journey and its preset stops?'
    )

    if (!confirmed) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    const { error } = await adminDb
      .from('event_journeys')
      .delete()
      .eq('id', selectedJourneyId)

    if (error) {
      setSaving(false)
      setError(error.message)
      return
    }

    const remaining = journeys.filter((j) => j.id !== selectedJourneyId)
    setJourneys(remaining)
    resetForm()

    if (remaining.length > 0) {
      setSelectedJourneyId(remaining[0].id)
      hydrateFormFromJourney(remaining[0])
    }

    setSaving(false)
    setSuccess('Event journey deleted.')
  }

  async function handleAddStop() {
    if (!selectedJourneyId || !newStopVenueId) return

    setSavingStops(true)
    setError(null)
    setSuccess(null)

    const payload = {
      event_journey_id: selectedJourneyId,
      venue_id: newStopVenueId,
      stop_order: parseInt(newStopOrder || '1', 10),
      role: newStopRole || 'preset',
      is_locked: newStopLocked,
    }

    const { data, error } = await adminDb
      .from('event_journey_stops')
      .insert(payload)
      .select()
      .single()

    if (error) {
      setSavingStops(false)
      setError(error.message)
      return
    }

    const created = data as unknown as EventJourneyStop
    const hydrated: EventJourneyStop = {
      ...created,
      venue: venues.find((v) => v.id === created.venue_id) ?? null,
    }

    setJourneyStops((prev) =>
      [...prev, hydrated].sort((a, b) => a.stop_order - b.stop_order)
    )

    setNewStopVenueId('')
    setNewStopRole('preset')
    setNewStopOrder(String(journeyStops.length + 1))
    setNewStopLocked(true)
    setSavingStops(false)
    setSuccess('Preset stop added.')
  }

  async function handleDeleteStop(stopId: string) {
    setSavingStops(true)
    setError(null)
    setSuccess(null)

    const { error } = await adminDb
      .from('event_journey_stops')
      .delete()
      .eq('id', stopId)

    if (error) {
      setSavingStops(false)
      setError(error.message)
      return
    }

    setJourneyStops((prev) => prev.filter((stop) => stop.id !== stopId))
    setSavingStops(false)
    setSuccess('Preset stop removed.')
  }

  const filteredVenueOptions = useMemo(() => {
    if (!form.city.trim()) return venues
    const normalizedFormCity = normalizeCityKey(form.city)

    return venues.filter(
      (venue) => normalizeCityKey(venue.city) === normalizedFormCity
    )
  }, [venues, form.city])

  const filteredPropertyOptions = useMemo(() => {
    if (!form.city.trim()) return properties
    const normalizedFormCity = normalizeCityKey(form.city)

    return properties.filter(
      (property) => normalizeCityKey(property.city) === normalizedFormCity
    )
  }, [properties, form.city])

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">
            Loading event journey admin...
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold">Event Journeys Admin</h2>
            <p className="text-sm text-muted-foreground">
              Configure destination-bound crawls for major local events, preset
              the last stops, auto-resolve destination coordinates from venue
              records, and control strict or flexible arrival behavior.
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {success}
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-[280px_minmax(0,1fr)]">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Existing Journeys</p>

                <Button variant="outline" size="sm" onClick={resetForm}>
                  New Journey
                </Button>
              </div>

              <div className="max-h-[520px] space-y-2 overflow-y-auto rounded-xl border p-3">
                {journeys.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No event journeys yet.
                  </p>
                )}

                {journeys.map((journey) => (
                  <button
                    key={journey.id}
                    type="button"
                    onClick={() => handleSelectJourney(journey.id)}
                    className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                      selectedJourneyId === journey.id
                        ? 'border-black bg-muted dark:border-white'
                        : 'border-border hover:bg-muted/60'
                    }`}
                  >
                    <p className="text-sm font-medium">{journey.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {journey.city} • {journey.status ?? 'draft'}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {journey.event_name}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">City *</label>
                  <Input
                    value={form.city}
                    onChange={(e) => updateForm('city', e.target.value)}
                    placeholder="porto"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Journey Title *</label>
                  <Input
                    value={form.title}
                    onChange={(e) => {
                      updateForm('title', e.target.value)
                      if (!selectedJourneyId) {
                        updateForm('slug', slugify(e.target.value))
                      }
                    }}
                    placeholder="Road to the Match"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Slug *</label>
                  <Input
                    value={form.slug}
                    onChange={(e) => updateForm('slug', slugify(e.target.value))}
                    placeholder="road-to-the-match"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Event Name *</label>
                  <Input
                    value={form.eventName}
                    onChange={(e) => updateForm('eventName', e.target.value)}
                    placeholder="Portugal vs Spain"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Event Start *</label>
                  <Input
                    type="datetime-local"
                    value={form.eventStartAt}
                    onChange={(e) => updateForm('eventStartAt', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Event End</label>
                  <Input
                    type="datetime-local"
                    value={form.eventEndAt}
                    onChange={(e) => updateForm('eventEndAt', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Event Type</label>
                  <select
                    value={form.eventType}
                    onChange={(e) => updateForm('eventType', e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select event type</option>
                    <option value="sports">sports</option>
                    <option value="concert">concert</option>
                    <option value="festival">festival</option>
                    <option value="market">market</option>
                    <option value="theater">theater</option>
                    <option value="conference">conference</option>
                    <option value="exhibition">exhibition</option>
                    <option value="community">community</option>
                    <option value="other">other</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => updateForm('status', e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="draft">draft</option>
                    <option value="active">active</option>
                    <option value="paused">paused</option>
                    <option value="archived">archived</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Arrival Policy</label>
                  <select
                    value={form.arrivalPolicy}
                    onChange={(e) =>
                      updateForm('arrivalPolicy', e.target.value as ArrivalPolicy)
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="by_start">by_start</option>
                    <option value="midpoint_deadline">midpoint_deadline</option>
                    <option value="window">window</option>
                    <option value="custom">custom</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Arrival Preference</label>
                  <select
                    value={form.arrivalPreference}
                    onChange={(e) =>
                      updateForm(
                        'arrivalPreference',
                        e.target.value as ArrivalPreference
                      )
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="early">early</option>
                    <option value="on_time">on_time</option>
                    <option value="fashionably_late">fashionably_late</option>
                    <option value="late_ok">late_ok</option>
                  </select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Destination Name *</label>
                  <Input
                    value={form.destinationName}
                    onChange={(e) => updateForm('destinationName', e.target.value)}
                    placeholder="Estádio do Dragão"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Destination Venue</label>
                  <select
                    value={form.destinationVenueId}
                    onChange={(e) => {
                      const venueId = e.target.value
                      updateForm('destinationVenueId', venueId)

                      const venue = venues.find((v) => v.id === venueId)
                      if (venue) {
                        updateForm('destinationName', venue.name)
                        updateForm(
                          'destinationLat',
                          venue.lat !== null && venue.lat !== undefined
                            ? String(venue.lat)
                            : ''
                        )
                        updateForm(
                          'destinationLon',
                          venue.lon !== null && venue.lon !== undefined
                            ? String(venue.lon)
                            : ''
                        )
                      }
                    }}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Manual destination</option>
                    {filteredVenueOptions.map((venue) => (
                      <option key={venue.id} value={venue.id}>
                        {venue.name} {venue.city ? `(${venue.city})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Selecting a venue auto-resolves destination coordinates from
                    the venues table.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Destination Lat {destinationUsesVenue ? '' : '*'}
                  </label>
                  <Input
                    value={
                      destinationUsesVenue &&
                      selectedDestinationVenue &&
                      selectedDestinationVenue.lat !== null &&
                      selectedDestinationVenue.lat !== undefined
                        ? String(selectedDestinationVenue.lat)
                        : form.destinationLat
                    }
                    onChange={(e) => updateForm('destinationLat', e.target.value)}
                    placeholder="41.1621"
                    disabled={destinationUsesVenue}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Destination Lon {destinationUsesVenue ? '' : '*'}
                  </label>
                  <Input
                    value={
                      destinationUsesVenue &&
                      selectedDestinationVenue &&
                      selectedDestinationVenue.lon !== null &&
                      selectedDestinationVenue.lon !== undefined
                        ? String(selectedDestinationVenue.lon)
                        : form.destinationLon
                    }
                    onChange={(e) => updateForm('destinationLon', e.target.value)}
                    placeholder="-8.5839"
                    disabled={destinationUsesVenue}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Ideal Stop Duration (minutes)
                  </label>
                  <Input
                    value={form.idealStopDurationMinutes}
                    onChange={(e) =>
                      updateForm('idealStopDurationMinutes', e.target.value)
                    }
                    placeholder="120"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Range Expansion %</label>
                  <Input
                    value={form.rangeExpansionPct}
                    onChange={(e) => updateForm('rangeExpansionPct', e.target.value)}
                    placeholder="0.3"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Max Dynamic Stops</label>
                  <Input
                    value={form.maxDynamicStops}
                    onChange={(e) => updateForm('maxDynamicStops', e.target.value)}
                    placeholder="3"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">
                    Associated Properties
                  </label>

                  <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border border-input p-3">
                    {filteredPropertyOptions.length > 0 ? (
                      filteredPropertyOptions.map((property) => {
                        const checked = form.propertyIds.includes(property.id)

                        return (
                          <label
                            key={property.id}
                            className="flex cursor-pointer items-start gap-3 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const nextIds = e.target.checked
                                  ? [...form.propertyIds, property.id]
                                  : form.propertyIds.filter((id) => id !== property.id)

                                updateForm('propertyIds', nextIds)
                              }}
                              className="mt-1"
                            />

                            <div className="min-w-0">
                              <p className="font-medium">{property.name}</p>

                              <p className="text-xs text-muted-foreground">
                                {property.city}
                                {property.slug ? ` • ${property.slug}` : ''}
                              </p>
                            </div>
                          </label>
                        )
                      })
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No properties found for this city yet.
                      </p>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Select one or more properties to associate with this event
                    journey. Leave empty to keep it city-wide.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Event ID</label>
                  <Input
                    value={form.eventId}
                    onChange={(e) => updateForm('eventId', e.target.value)}
                    placeholder="optional event UUID"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Vibes</label>
                  <Input
                    value={form.vibes}
                    onChange={(e) => updateForm('vibes', e.target.value)}
                    placeholder="lively, social, pregame, energetic"
                  />
                  <p className="text-xs text-muted-foreground">
                    Comma-separated. Used to bias venue pairing.
                  </p>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Tags</label>
                  <Input
                    value={form.tags}
                    onChange={(e) => updateForm('tags', e.target.value)}
                    placeholder="beer, fan zone, casual food, sports"
                  />
                  <p className="text-xs text-muted-foreground">
                    Comma-separated. Used to match event intent to venue metadata.
                  </p>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => updateForm('notes', e.target.value)}
                    placeholder="Optional admin notes..."
                    rows={4}
                    className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={handleSaveJourney} disabled={saving}>
                  {saving
                    ? 'Saving...'
                    : selectedJourneyId
                      ? 'Update Journey'
                      : 'Create Journey'}
                </Button>

                {selectedJourneyId && (
                  <Button
                    variant="outline"
                    onClick={handleDeleteJourney}
                    disabled={saving}
                  >
                    Delete Journey
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="space-y-1">
            <h3 className="text-xl font-semibold">Preset Stops</h3>
            <p className="text-sm text-muted-foreground">
              Lock in the final or penultimate venues you want the event-bound
              itinerary to route through.
            </p>
          </div>

          {!selectedJourneyId ? (
            <p className="text-sm text-muted-foreground">
              Create or select an event journey first.
            </p>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_140px_140px_140px_auto]">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Venue</label>
                  <select
                    value={newStopVenueId}
                    onChange={(e) => setNewStopVenueId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select a venue</option>
                    {filteredVenueOptions.map((venue) => (
                      <option key={venue.id} value={venue.id}>
                        {venue.name} {venue.city ? `(${venue.city})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Stop Order</label>
                  <Input
                    value={newStopOrder}
                    onChange={(e) => setNewStopOrder(e.target.value)}
                    placeholder="1"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Role</label>
                  <Input
                    value={newStopRole}
                    onChange={(e) => setNewStopRole(e.target.value)}
                    placeholder="preset"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Locked</label>
                  <select
                    value={newStopLocked ? 'true' : 'false'}
                    onChange={(e) => setNewStopLocked(e.target.value === 'true')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <Button
                    onClick={handleAddStop}
                    disabled={savingStops || !newStopVenueId}
                    className="w-full"
                  >
                    {savingStops ? 'Adding...' : 'Add Stop'}
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {journeyStops.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No preset stops configured yet.
                  </p>
                )}

                {journeyStops.map((stop) => (
                  <div
                    key={stop.id}
                    className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <p className="font-medium">
                        Stop {stop.stop_order} — {stop.venue?.name ?? stop.venue_id}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Role: {stop.role} • Locked: {stop.is_locked ? 'true' : 'false'}
                      </p>
                      {stop.venue?.city && (
                        <p className="text-xs text-muted-foreground">
                          {stop.venue.city}
                        </p>
                      )}
                    </div>

                    <Button
                      variant="outline"
                      onClick={() => handleDeleteStop(stop.id)}
                      disabled={savingStops}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}