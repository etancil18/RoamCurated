'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import StartCrawlButton from './StartCrawlButton'

import type { PropertyCrawlCard } from '@/lib/property/getPropertyGuideData'
import { logEvent } from '@/lib/logEvent'

type NearbyVenueOption = {
  id: string
  name: string
  link?: string
  description?: string | null
  type?: string | string[] | null
  lat?: number
  lon?: number
}

type EffectiveVenue = PropertyCrawlCard['crawl']['venues'][number] & {
  link?: string
  description?: string | null
  type?: string | string[]
}

type Props = {
  property: {
    id: string
    name: string
    city: string
    slug?: string
  }
  crawls: PropertyCrawlCard[]
  nearbyVenues?: NearbyVenueOption[]
}

export default function PropertyCrawls({
  property,
  crawls,
  nearbyVenues = [],
}: Props) {
  if (!crawls || crawls.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Suggested Routes</h2>

        <p className="text-sm text-muted-foreground">
          We&apos;re still mapping the best nearby plans. In the meantime, use
          the map and nearby venues to explore what&apos;s close.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold">Suggested Routes</h2>

      <div className="grid gap-4">
        {crawls.map(({ crawl, vm }, index) => (
          <PropertyCrawlCardView
            key={vm.id}
            property={property}
            crawl={crawl}
            vm={vm}
            nearbyVenues={nearbyVenues}
            position={index}
            totalCrawls={crawls.length}
          />
        ))}
      </div>
    </section>
  )
}

function PropertyCrawlCardView({
  property,
  crawl,
  vm,
  nearbyVenues,
  position,
  totalCrawls,
}: {
  property: Props['property']
  crawl: PropertyCrawlCard['crawl']
  vm: PropertyCrawlCard['vm']
  nearbyVenues: NearbyVenueOption[]
  position: number
  totalCrawls: number
}) {
  const impressionLoggedRef = useRef(false)
  const [replacementsByStopIndex, setReplacementsByStopIndex] = useState<
    Record<number, NearbyVenueOption>
  >({})
  const [openSwapStopIndex, setOpenSwapStopIndex] = useState<number | null>(null)

  const effectiveVenues = useMemo<EffectiveVenue[]>(
    () =>
      crawl.venues.map((venue, index) => {
        const replacement = replacementsByStopIndex[index]

        if (!replacement) {
          return {
            ...venue,
            link: getVenueLink(venue),
            description: getVenueDescription(venue),
            type: getVenueType(venue),
          }
        }

        return {
          ...venue,
          id: replacement.id,
          name: replacement.name,
          link: replacement.link ?? `/venue-profile/${replacement.id}`,
          description: replacement.description ?? null,
          type: replacement.type ?? getVenueType(venue),
          lat:
            typeof replacement.lat === 'number' ? replacement.lat : venue.lat,
          lon:
            typeof replacement.lon === 'number' ? replacement.lon : venue.lon,
        }
      }),
    [crawl.venues, replacementsByStopIndex]
  )

  useEffect(() => {
    if (impressionLoggedRef.current) return
    impressionLoggedRef.current = true

    void logEvent('property_crawl_impression', {
      metadata: {
        property_id: property.id,
        property_name: property.name,
        property_slug: property.slug ?? null,
        city: property.city,
        crawl_vm_id: vm.id,
        crawl_title: vm.title,
        crawl_subtitle: vm.subtitle,
        position,
        total_crawls: totalCrawls,
        stop_count: vm.stops.length,
        venue_ids: crawl.venues.map((venue) => venue.id),
      },
    })
  }, [
    crawl.venues,
    position,
    property.city,
    property.id,
    property.name,
    property.slug,
    totalCrawls,
    vm.id,
    vm.stops.length,
    vm.subtitle,
    vm.title,
  ])

  const handleStartCrawlClick = () => {
    void logEvent('property_crawl_clicked', {
      metadata: {
        property_id: property.id,
        property_name: property.name,
        property_slug: property.slug ?? null,
        city: property.city,
        crawl_vm_id: vm.id,
        crawl_title: vm.title,
        crawl_subtitle: vm.subtitle,
        position,
        total_crawls: totalCrawls,
        stop_count: vm.stops.length,
        venue_ids: effectiveVenues.map((venue) => venue.id),
      },
    })
  }

  const handleSwapStop = (
    stopIndex: number,
    replacement: NearbyVenueOption
  ) => {
    setReplacementsByStopIndex((prev) => ({
      ...prev,
      [stopIndex]: replacement,
    }))

    setOpenSwapStopIndex(null)

    void logEvent('property_crawl_stop_swapped', {
      venue_id: replacement.id,
      metadata: {
        property_id: property.id,
        property_name: property.name,
        property_slug: property.slug ?? null,
        city: property.city,
        crawl_vm_id: vm.id,
        crawl_title: vm.title,
        stop_index: stopIndex,
        replacement_venue_id: replacement.id,
        replacement_venue_name: replacement.name,
      },
    })
  }

  const handleResetStop = (stopIndex: number) => {
    setReplacementsByStopIndex((prev) => {
      const next = { ...prev }
      delete next[stopIndex]
      return next
    })

    setOpenSwapStopIndex(null)
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {vm.chips.map((chip) => (
                <Chip key={chip}>{chip}</Chip>
              ))}
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-semibold">{vm.title}</h3>
              <p className="text-sm text-muted-foreground">{vm.subtitle}</p>
            </div>
          </div>

          <div onClickCapture={handleStartCrawlClick}>
            <StartCrawlButton
              venues={effectiveVenues}
              city={property.city}
              propertyId={property.id}
              propertySlug={property.slug}
            />
          </div>
        </div>

        <div className="space-y-3 border-t pt-4">
          {vm.stops.map((stop, stopIndex) => {
            const currentVenue = effectiveVenues[stopIndex]
            const currentVenueDescription =
              currentVenue?.description ?? stop.description
            const hasReplacement = Boolean(replacementsByStopIndex[stopIndex])

            const swapCandidates = getSwapCandidates({
              nearbyVenues,
              currentStopIndex: stopIndex,
              crawl,
              effectiveVenues,
            })

            return (
              <div
                key={stop.id}
                className="flex items-start gap-3 rounded-lg border p-3"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {stop.order}
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {stop.stageLabel}
                    </span>

                    {stop.walkTimeFromPreviousLabel && (
                      <Chip>{stop.walkTimeFromPreviousLabel}</Chip>
                    )}

                    {hasReplacement && <Chip>Swapped</Chip>}
                  </div>

                  <Link
                    href={currentVenue?.link ?? stop.venueHref}
                    onClick={() => {
                      void logEvent('property_crawl_stop_clicked', {
                        venue_id: currentVenue?.id ?? stop.id,
                        metadata: {
                          property_id: property.id,
                          property_name: property.name,
                          property_slug: property.slug ?? null,
                          city: property.city,
                          crawl_vm_id: vm.id,
                          crawl_title: vm.title,
                          stop_id: currentVenue?.id ?? stop.id,
                          stop_order: stop.order,
                          stop_name: currentVenue?.name ?? stop.venueName,
                          stop_stage_label: stop.stageLabel,
                          venue_href: currentVenue?.link ?? stop.venueHref,
                          was_swapped: hasReplacement,
                        },
                      })
                    }}
                    className="font-medium hover:underline"
                  >
                    {currentVenue?.name ?? stop.venueName}
                  </Link>

                  {currentVenueDescription && (
                    <p className="text-sm text-muted-foreground">
                      {currentVenueDescription}
                    </p>
                  )}

                  {nearbyVenues.length > 0 && swapCandidates.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenSwapStopIndex((prev) =>
                              prev === stopIndex ? null : stopIndex
                            )
                          }
                          className="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
                        >
                          {openSwapStopIndex === stopIndex
                            ? 'Hide nearby swaps'
                            : `Swap with nearby ${getStageSwapLabel(stop.stageLabel)}`}
                        </button>

                        {hasReplacement && (
                          <button
                            type="button"
                            onClick={() => handleResetStop(stopIndex)}
                            className="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
                          >
                            Reset stop
                          </button>
                        )}
                      </div>

                      {openSwapStopIndex === stopIndex && (
                        <div className="space-y-2 rounded-md bg-muted/40 p-3">
                          <p className="text-xs font-medium text-muted-foreground">
                            Nearby replacements
                          </p>

                          <div className="space-y-2">
                            {swapCandidates.map((candidate) => (
                              <button
                                key={candidate.id}
                                type="button"
                                onClick={() => handleSwapStop(stopIndex, candidate)}
                                className="block w-full rounded-md border bg-background px-3 py-2 text-left transition hover:bg-muted"
                              >
                                <div className="space-y-1">
                                  <p className="text-sm font-medium">
                                    {candidate.name}
                                  </p>

                                  {candidate.description && (
                                    <p className="line-clamp-2 text-xs text-muted-foreground">
                                      {candidate.description}
                                    </p>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function getSwapCandidates({
  nearbyVenues,
  currentStopIndex,
  crawl,
  effectiveVenues,
}: {
  nearbyVenues: NearbyVenueOption[]
  currentStopIndex: number
  crawl: PropertyCrawlCard['crawl']
  effectiveVenues: EffectiveVenue[]
}) {
  const currentStage = crawl.stages?.[currentStopIndex]
  const desiredStageTypes = currentStage?.stageTypes ?? []
  const matchedType = currentStage?.matchedType ?? null

  const usedVenueIds = new Set(
    effectiveVenues.map((venue) => venue?.id).filter(Boolean)
  )

  const currentVenueId = effectiveVenues[currentStopIndex]?.id
  if (currentVenueId) {
    usedVenueIds.delete(currentVenueId)
  }

  return nearbyVenues
    .filter((venue) => {
      if (!venue?.id) return false
      if (usedVenueIds.has(venue.id)) return false
      return venueMatchesDesiredTypes(venue, desiredStageTypes, matchedType)
    })
    .slice(0, 6)
}

function venueMatchesDesiredTypes(
  venue: NearbyVenueOption,
  desiredStageTypes: readonly string[],
  matchedType: string | null
) {
  const venueTypes = normalizeVenueTypes(venue.type)

  if (desiredStageTypes.length > 0) {
    return desiredStageTypes.some((stageType) => venueTypes.includes(stageType))
  }

  if (matchedType) {
    return venueTypes.includes(matchedType)
  }

  return true
}

function normalizeVenueTypes(value: NearbyVenueOption['type']) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry).trim().toLowerCase())
      .filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
  }

  return []
}

function getVenueLink(
  venue: PropertyCrawlCard['crawl']['venues'][number]
): string {
  const maybeLink = (venue as { link?: string | null }).link
  return typeof maybeLink === 'string' && maybeLink.trim().length > 0
    ? maybeLink
    : `/venue-profile/${venue.id}`
}

function getVenueDescription(
  venue: PropertyCrawlCard['crawl']['venues'][number]
): string | null {
  const maybeDescription = (venue as { description?: string | null }).description
  return typeof maybeDescription === 'string' && maybeDescription.trim().length > 0
    ? maybeDescription
    : null
}

function getVenueType(
  venue: PropertyCrawlCard['crawl']['venues'][number]
): string | string[] | undefined {
  const maybeType = (venue as { type?: string | string[] | null }).type
  if (Array.isArray(maybeType)) return maybeType
  if (typeof maybeType === 'string') return maybeType
  return undefined
}

function getStageSwapLabel(stageLabel: string) {
  const normalized = String(stageLabel ?? '').trim().toLowerCase()

  if (normalized.includes('dinner')) return 'dinner spots'
  if (normalized.includes('drink')) return 'drinks spots'
  if (normalized.includes('coffee')) return 'coffee spots'
  if (normalized.includes('browse')) return 'browse stops'
  return 'stops'
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  )
}