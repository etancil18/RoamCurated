'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export type PresetStopVenueOption = {
  id: string
  name: string
  city: string | null
}

export type PresetStop = {
  id: string
  event_journey_id: string
  venue_id: string
  stop_order: number
  role: string
  is_locked: boolean
  venue?: PresetStopVenueOption | null
}

type Props = {
  selectedJourneyId?: string
  city?: string
  venues: PresetStopVenueOption[]
  stops: PresetStop[]
  newStopVenueId: string
  newStopRole: string
  newStopOrder: string
  newStopLocked: boolean
  saving?: boolean
  onVenueChange: (value: string) => void
  onRoleChange: (value: string) => void
  onOrderChange: (value: string) => void
  onLockedChange: (value: boolean) => void
  onAddStop: () => void
  onDeleteStop: (stopId: string) => void
}

function normalizeCity(value?: string | null) {
  return (value ?? '').trim().toLowerCase()
}

export default function PresetStopsEditor({
  selectedJourneyId,
  city,
  venues,
  stops,
  newStopVenueId,
  newStopRole,
  newStopOrder,
  newStopLocked,
  saving = false,
  onVenueChange,
  onRoleChange,
  onOrderChange,
  onLockedChange,
  onAddStop,
  onDeleteStop,
}: Props) {
  const normalizedCity = normalizeCity(city)

  const sortedVenues = [...venues].sort((a, b) => {
    const cityCompare = (a.city ?? '').localeCompare(b.city ?? '')
    if (cityCompare !== 0) return cityCompare
    return a.name.localeCompare(b.name)
  })

  const cityMatchedVenues = normalizedCity
    ? sortedVenues.filter(
        (venue) => normalizeCity(venue.city) === normalizedCity
      )
    : sortedVenues

  const venueOptions =
    normalizedCity && cityMatchedVenues.length > 0
      ? cityMatchedVenues
      : sortedVenues

  const showingFallbackToAll =
    normalizedCity.length > 0 && cityMatchedVenues.length === 0

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div className="space-y-1">
          <h3 className="text-xl font-semibold">
            Preset Stops
          </h3>
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
                  onChange={(e) => onVenueChange(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select a venue</option>
                  {venueOptions.map((venue) => (
                    <option key={venue.id} value={venue.id}>
                      {venue.name} {venue.city ? `(${venue.city})` : ''}
                    </option>
                  ))}
                </select>

                {normalizedCity ? (
                  <p className="text-xs text-muted-foreground">
                    {showingFallbackToAll
                      ? `No exact venue matches found for "${city}". Showing all venues instead.`
                      : `Showing ${venueOptions.length} venue${venueOptions.length === 1 ? '' : 's'} in ${city}.`}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Showing all venues.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Stop Order</label>
                <Input
                  value={newStopOrder}
                  onChange={(e) => onOrderChange(e.target.value)}
                  placeholder="1"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Role</label>
                <Input
                  value={newStopRole}
                  onChange={(e) => onRoleChange(e.target.value)}
                  placeholder="preset"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Locked</label>
                <select
                  value={newStopLocked ? 'true' : 'false'}
                  onChange={(e) => onLockedChange(e.target.value === 'true')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              </div>

              <div className="flex items-end">
                <Button
                  onClick={onAddStop}
                  disabled={saving || !newStopVenueId}
                  className="w-full"
                >
                  {saving ? 'Adding...' : 'Add Stop'}
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {stops.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No preset stops configured yet.
                </p>
              )}

              {stops.map((stop) => (
                <div
                  key={stop.id}
                  className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1 min-w-0">
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
                    onClick={() => onDeleteStop(stop.id)}
                    disabled={saving}
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
  )
}