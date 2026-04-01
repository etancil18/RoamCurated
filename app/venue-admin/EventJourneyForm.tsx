'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export type EventJourneyFormValues = {
  city: string
  title: string
  slug: string
  eventName: string
  eventStartAt: string
  destinationName: string
  destinationVenueId: string
  destinationLat: string
  destinationLon: string
  vibes: string
  tags: string
  idealStopDurationMinutes: string
  rangeExpansionPct: string
  maxDynamicStops: string
  status: string
  notes: string
  propertyIds: string[]
  eventId: string
}

export type EventJourneyVenueOption = {
  id: string
  name: string
  city: string | null
  lat?: number | null
  lon?: number | null
}

export type EventJourneyPropertyOption = {
  id: string
  name: string
  city: string | null
  slug?: string | null
}

type Props = {
  value: EventJourneyFormValues
  venues: EventJourneyVenueOption[]
  properties: EventJourneyPropertyOption[]
  selectedJourneyId?: string
  saving?: boolean
  error?: string | null
  success?: string | null
  onChange: <K extends keyof EventJourneyFormValues>(
    key: K,
    value: EventJourneyFormValues[K]
  ) => void
  onSubmit: () => void
  onDelete?: () => void
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export default function EventJourneyForm({
  value,
  venues,
  properties,
  selectedJourneyId,
  saving = false,
  error,
  success,
  onChange,
  onSubmit,
  onDelete,
}: Props) {
  const normalizedCity = value.city.trim().toLowerCase()

  const filteredVenueOptions = normalizedCity
    ? venues.filter(
        (venue) =>
          venue.city?.toLowerCase() === normalizedCity
      )
    : venues

  const filteredPropertyOptions = normalizedCity
    ? properties.filter(
        (property) =>
          property.city?.toLowerCase() === normalizedCity
      )
    : properties

  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        <div className="space-y-1">
          <h3 className="text-xl font-semibold">
            Event Journey Details
          </h3>
          <p className="text-sm text-muted-foreground">
            Configure the destination-bound crawl, event timing, and metadata
            used to bias venue pairing.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
            {success}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">City *</label>
            <Input
              value={value.city}
              onChange={(e) => onChange('city', e.target.value)}
              placeholder="porto"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Journey Title *</label>
            <Input
              value={value.title}
              onChange={(e) => {
                onChange('title', e.target.value)
                if (!selectedJourneyId && !value.slug.trim()) {
                  onChange('slug', slugify(e.target.value))
                }
              }}
              placeholder="Road to the Match"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Slug *</label>
            <Input
              value={value.slug}
              onChange={(e) => onChange('slug', slugify(e.target.value))}
              placeholder="road-to-the-match"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Event Name *</label>
            <Input
              value={value.eventName}
              onChange={(e) => onChange('eventName', e.target.value)}
              placeholder="Portugal vs Spain"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Event Start *</label>
            <Input
              type="datetime-local"
              value={value.eventStartAt}
              onChange={(e) => onChange('eventStartAt', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <select
              value={value.status}
              onChange={(e) => onChange('status', e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="draft">draft</option>
              <option value="active">active</option>
              <option value="paused">paused</option>
              <option value="archived">archived</option>
            </select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">Destination Name *</label>
            <Input
              value={value.destinationName}
              onChange={(e) => onChange('destinationName', e.target.value)}
              placeholder="Estádio do Dragão"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">
              Destination Venue (optional)
            </label>
            <select
              value={value.destinationVenueId}
              onChange={(e) => {
                const venueId = e.target.value
                onChange('destinationVenueId', venueId)

                const venue = venues.find((v) => v.id === venueId)

                if (venue) {
                  onChange('destinationName', venue.name)

                  if (
                    typeof venue.lat === 'number' &&
                    typeof venue.lon === 'number'
                  ) {
                    onChange('destinationLat', String(venue.lat))
                    onChange('destinationLon', String(venue.lon))
                  }
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
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Destination Lat *</label>
            <Input
              value={value.destinationLat}
              onChange={(e) => onChange('destinationLat', e.target.value)}
              placeholder="41.1621"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Destination Lon *</label>
            <Input
              value={value.destinationLon}
              onChange={(e) => onChange('destinationLon', e.target.value)}
              placeholder="-8.5839"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Ideal Stop Duration (minutes)
            </label>
            <Input
              value={value.idealStopDurationMinutes}
              onChange={(e) =>
                onChange('idealStopDurationMinutes', e.target.value)
              }
              placeholder="120"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Range Expansion %
            </label>
            <Input
              value={value.rangeExpansionPct}
              onChange={(e) => onChange('rangeExpansionPct', e.target.value)}
              placeholder="0.3"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Max Dynamic Stops</label>
            <Input
              value={value.maxDynamicStops}
              onChange={(e) => onChange('maxDynamicStops', e.target.value)}
              placeholder="3"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">
              Associated Properties
            </label>

            <div className="rounded-md border border-input p-3 space-y-2 max-h-56 overflow-y-auto">
              {filteredPropertyOptions.length > 0 ? (
                filteredPropertyOptions.map((property) => {
                  const checked = value.propertyIds.includes(property.id)

                  return (
                    <label
                      key={property.id}
                      className="flex items-start gap-3 text-sm cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const nextIds = e.target.checked
                            ? [...value.propertyIds, property.id]
                            : value.propertyIds.filter((id) => id !== property.id)

                          onChange('propertyIds', nextIds)
                        }}
                        className="mt-1"
                      />

                      <div className="min-w-0">
                        <p className="font-medium">
                          {property.name}
                        </p>

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
              Select one or more properties to associate with this event journey.
              Leave empty to keep it city-wide.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Event ID</label>
            <Input
              value={value.eventId}
              onChange={(e) => onChange('eventId', e.target.value)}
              placeholder="optional event UUID"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">Vibes</label>
            <Input
              value={value.vibes}
              onChange={(e) => onChange('vibes', e.target.value)}
              placeholder="lively, social, pregame, energetic"
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated. Used to bias venue pairing.
            </p>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">Tags</label>
            <Input
              value={value.tags}
              onChange={(e) => onChange('tags', e.target.value)}
              placeholder="beer, fan zone, casual food, sports"
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated. Used to match event intent to venue metadata.
            </p>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">Notes</label>
            <textarea
              value={value.notes}
              onChange={(e) => onChange('notes', e.target.value)}
              placeholder="Optional admin notes..."
              rows={4}
              className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={onSubmit}
            disabled={saving}
          >
            {saving
              ? 'Saving...'
              : selectedJourneyId
              ? 'Update Journey'
              : 'Create Journey'}
          </Button>

          {selectedJourneyId && onDelete && (
            <Button
              variant="outline"
              onClick={onDelete}
              disabled={saving}
            >
              Delete Journey
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}