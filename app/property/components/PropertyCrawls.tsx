
'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import StartFlowButton from '@/components/property/StartFlowButton'

import type { PropertyCrawlCard } from '@/lib/property/buildPropertyCrawlCards'
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
      <section className="space-y-3 text-white">
        <h2 className="text-sm font-semibold text-white">Suggested Routes</h2>

        <p className="text-sm leading-6 text-neutral-400">
          We&apos;re still mapping the best nearby plans. In the meantime, use
          the map and nearby venues to explore what&apos;s close.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-4 text-white">
      {/* Simple, responsive concierge-style route cards */}
      <div className="grid items-start gap-4 lg:grid-cols-2">
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

  /* ------------------------------------------------ */
  /* Compact Flow details visibility                  */
  /* ------------------------------------------------ */

  const [detailsExpanded, setDetailsExpanded] = useState(false)

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

  const venueIds = useMemo(
    () => effectiveVenues.map((venue) => venue.id).filter(Boolean),
    [effectiveVenues]
  )

  const routeContext = useMemo(
    () =>
      buildRouteContext({
        theme: vm.theme,
        stopCount: venueIds.length,
        totalWalkMinutes: vm.totalWalkMinutes,
        bestTimeLabel: vm.bestTimeLabel,
        position,
      }),
    [position, venueIds.length, vm.bestTimeLabel, vm.theme, vm.totalWalkMinutes]
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
        route_context_label: routeContext.label,
        route_confidence: routeContext.confidence,
      },
    })
  }, [
    crawl.venues,
    position,
    property.city,
    property.id,
    property.name,
    property.slug,
    routeContext.confidence,
    routeContext.label,
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
        route_context_label: routeContext.label,
        route_confidence: routeContext.confidence,
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
    <Card className="overflow-hidden rounded-[1.5rem] border border-[#c5a57a]/20 bg-[#151a19] text-white shadow-xl shadow-black/20 transition-colors hover:border-[#c5a57a]/35">
      <CardContent className="space-y-5 p-5 sm:p-6">
        {/* =================================================
            SIMPLE CONCIERGE SUMMARY
            ================================================= */}

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="text-lg text-[#c5a57a]"
            >
              ✦
            </span>

            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#c5a57a]">
              Your local itinerary
            </span>
          </div>

          <div className="space-y-2">
            <h3 className="font-serif text-2xl font-normal leading-tight tracking-tight text-[#f7f0e5] sm:text-[1.75rem]">
              {vm.title}
            </h3>

            {vm.subtitle && (
              <p className="line-clamp-2 text-sm leading-6 text-[#c9c7c1]">
                {vm.subtitle}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-medium text-[#d8cfbf]">
            <span>
              {venueIds.length}{' '}
              {venueIds.length === 1 ? 'stop' : 'stops'}
            </span>

            {typeof vm.totalWalkMinutes === 'number' && (
              <>
                <span
                  aria-hidden="true"
                  className="text-[#8d897f]"
                >
                  ·
                </span>

                <span>
                  {vm.totalWalkMinutes} min walking
                </span>
              </>
            )}

            {Object.keys(replacementsByStopIndex).length > 0 && (
              <>
                <span
                  aria-hidden="true"
                  className="text-[#8d897f]"
                >
                  ·
                </span>

                <span className="text-[#e7d0ac]">
                  {Object.keys(replacementsByStopIndex).length}{' '}
                  {Object.keys(replacementsByStopIndex).length === 1
                    ? 'stop changed'
                    : 'stops changed'}
                </span>
              </>
            )}
          </div>
        </div>

        {/* =================================================
            PRIMARY ACTION
            Existing StartFlowButton behavior retained.
            ================================================= */}

        <div className="space-y-3">
          <div
            className="w-full min-w-0"
            onClickCapture={handleStartCrawlClick}
          >
            <StartFlowButton
              title={vm.title}
              city={property.city}
              propertyId={property.id}
              propertySlug={property.slug}
              venueIds={venueIds}
              source="property_crawl"
              travelMode="walking"
              label="Start exploring"
              metadata={{
                property_id: property.id,
                property_name: property.name,
                property_slug: property.slug ?? null,
                crawl_vm_id: vm.id,
                crawl_title: vm.title,
                crawl_subtitle: vm.subtitle,
                position,
                total_crawls: totalCrawls,
                stop_count: venueIds.length,
                swapped_stop_count: Object.keys(replacementsByStopIndex).length,
                route_context_label: routeContext.label,
                route_confidence: routeContext.confidence,
              }}
            />
          </div>

          <button
            type="button"
            aria-expanded={detailsExpanded}
            aria-controls={`property-flow-details-${vm.id}`}
            onClick={() => setDetailsExpanded((prev) => !prev)}
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-[#dfd0b8] transition hover:bg-[#c5a57a]/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c5a57a]"
          >
            <span>
              {detailsExpanded
                ? 'Hide the stops'
                : 'See the stops'}
            </span>

            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className={[
                'shrink-0 transition-transform',
                detailsExpanded ? 'rotate-180' : '',
              ].join(' ')}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>

        {/* =================================================
            QUIET STOP DETAILS
            All stop linking and swapping logic preserved.
            ================================================= */}

        {detailsExpanded && (
          <div
            id={`property-flow-details-${vm.id}`}
            className="space-y-3 border-t border-[#c5a57a]/15 pt-5"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#c5a57a]">
              Your stops
            </p>

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
                  className="flex items-start gap-3 rounded-xl border border-[#c5a57a]/10 bg-black/15 p-3.5 transition hover:border-[#c5a57a]/25"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#c5a57a]/30 bg-[#c5a57a]/10 text-xs font-bold text-[#e7d0ac]">
                    {stop.order}
                  </div>

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#c5a57a]">
                        {stop.stageLabel}
                      </span>

                      {stop.walkTimeFromPreviousLabel && (
                        <span className="text-xs text-[#a9a59c]">
                          · {stop.walkTimeFromPreviousLabel}
                        </span>
                      )}

                      {hasReplacement && (
                        <span className="text-[10px] font-medium text-emerald-300">
                          Changed
                        </span>
                      )}
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
                      className="block text-sm font-semibold leading-snug text-[#f7f0e5] transition hover:text-[#e7d0ac] hover:underline"
                    >
                      {currentVenue?.name ?? stop.venueName}
                    </Link>

                    {currentVenueDescription && (
                      <StopDescription description={currentVenueDescription} />
                    )}

                    {nearbyVenues.length > 0 && swapCandidates.length > 0 && (
                      <div className="space-y-2 pt-1">
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenSwapStopIndex((prev) =>
                                prev === stopIndex ? null : stopIndex
                              )
                            }
                            className="text-xs font-semibold text-[#d9c6a7] underline decoration-[#c5a57a]/35 underline-offset-4 transition hover:text-white"
                          >
                            {openSwapStopIndex === stopIndex
                              ? 'Hide alternatives'
                              : 'Change this stop'}
                          </button>

                          {hasReplacement && (
                            <button
                              type="button"
                              onClick={() => handleResetStop(stopIndex)}
                              className="text-xs font-semibold text-neutral-400 underline underline-offset-4 transition hover:text-white"
                            >
                              Reset stop
                            </button>
                          )}
                        </div>

                        {openSwapStopIndex === stopIndex && (
                          <div className="space-y-2 rounded-lg border border-[#c5a57a]/15 bg-[#101514] p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-[#c5a57a]">
                              Nearby alternatives
                            </p>

                            <div className="space-y-2">
                              {swapCandidates.map((candidate) => (
                                <button
                                  key={candidate.id}
                                  type="button"
                                  onClick={() =>
                                    handleSwapStop(stopIndex, candidate)
                                  }
                                  className="block w-full rounded-lg border border-white/10 bg-white/[0.035] px-3 py-3 text-left transition hover:border-[#c5a57a]/30 hover:bg-white/[0.06]"
                                >
                                  <div className="space-y-1">
                                    <p className="text-sm font-semibold text-white">
                                      {candidate.name}
                                    </p>

                                    {candidate.description && (
                                      <p className="line-clamp-2 text-xs leading-5 text-neutral-400">
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
        )}
      </CardContent>
    </Card>
  )
}

function StopDescription({ description }: { description: string }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="text-xs font-semibold text-[#d9c6a7] underline decoration-[#c5a57a]/35 underline-offset-4 transition hover:text-white"
      >
        {expanded ? 'Hide description' : 'About this stop'}
      </button>

      {expanded && (
        <p className="max-w-2xl text-sm leading-6 text-neutral-400">
          {description}
        </p>
      )}
    </div>
  )
}

function buildRouteContext({
  theme,
  stopCount,
  totalWalkMinutes,
  bestTimeLabel,
  position,
}: {
  theme: string
  stopCount: number
  totalWalkMinutes: number | null
  bestTimeLabel: string | null
  position: number
}) {
  const lowWalk =
    typeof totalWalkMinutes === 'number' && totalWalkMinutes <= 18

  const compact = stopCount > 0 && stopCount <= 4

  const confidence =
    position === 0 && lowWalk
      ? 'High-confidence fit'
      : lowWalk || compact
        ? 'Strong fit'
        : 'Flexible fit'

  const label =
    position === 0
      ? 'Best match now'
      : bestTimeLabel?.includes('Best')
        ? bestTimeLabel
        : 'Contextual pick'

  const themeReason =
    theme === 'morningFlow'
      ? 'the stops match a lighter daytime rhythm and avoid forcing nightlife too early.'
      : theme === 'soloExplorer'
        ? 'the sequence balances browsing, food, and low-pressure discovery.'
        : theme === 'dateNight'
          ? 'the route builds naturally around dinner, drinks, and a polished close.'
          : theme === 'nightOut'
            ? 'the stops ramp energy without making the route feel scattered.'
            : 'the route keeps the sequence intuitive and locally useful.'

  const walkReason = lowWalk
    ? ' It also keeps walking friction low.'
    : totalWalkMinutes
      ? ' It gives you a fuller route with a little more walking.'
      : ''

  return {
    label,
    confidence,
    reason: `${themeReason}${walkReason}`,
  }
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

      return venueMatchesDesiredTypes(
        venue,
        desiredStageTypes,
        matchedType
      )
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
    return desiredStageTypes.some((stageType) =>
      venueTypes.includes(stageType)
    )
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
  const maybeDescription = (
    venue as {
      description?: string | null
    }
  ).description

  return typeof maybeDescription === 'string' &&
    maybeDescription.trim().length > 0
    ? maybeDescription
    : null
}

function getVenueType(
  venue: PropertyCrawlCard['crawl']['venues'][number]
): string | string[] | undefined {
  const maybeType = (
    venue as {
      type?: string | string[] | null
    }
  ).type

  if (Array.isArray(maybeType)) return maybeType
  if (typeof maybeType === 'string') return maybeType

  return undefined
}

function getStageSwapLabel(stageLabel: string) {
  const normalized = String(stageLabel ?? '')
    .trim()
    .toLowerCase()

  if (normalized.includes('dinner')) return 'dinner spots'
  if (normalized.includes('drink')) return 'drinks spots'
  if (normalized.includes('coffee')) return 'coffee spots'
  if (normalized.includes('browse')) return 'browse stops'

  return 'stops'
}

function Chip({
  children,
  tone = 'default',
}: {
  children: ReactNode
  tone?: 'default' | 'strong' | 'accent'
}) {
  const className =
    tone === 'strong'
      ? 'border-cyan-300/40 bg-cyan-300 text-neutral-950'
      : tone === 'accent'
        ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
        : 'border-neutral-700 bg-neutral-900 text-neutral-300'

  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
        className,
      ].join(' ')}
    >
      {children}
    </span>
  )
}
