'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

import StartFlowButton, {
  type PropertyFlowSource,
} from '@/components/property/StartFlowButton'
import { Card, CardContent } from '@/components/ui/card'

import type { PropertyCrawlCard } from '@/lib/property/buildPropertyCrawlCards'

export type GuideFlowCardProperty = {
  id: string
  name: string
  city: string
  slug?: string | null
}

export type GuideFlowCardProps = {
  property: GuideFlowCardProperty
  flow: PropertyCrawlCard

  /**
   * Zero-based position of this flow inside the rendered guide section.
   */
  position: number

  /**
   * Total number of flows rendered in the guide section.
   */
  totalFlows: number

  /**
   * Optional internal white-label guide ID included in CTA metadata.
   */
  guideId?: string | null

  /**
   * Optional public white-label guide slug included in CTA metadata.
   */
  guideSlug?: string | null

  /**
   * Source passed through to the existing StartFlowButton.
   */
  source?: PropertyFlowSource

  /**
   * Optional CTA-label override.
   *
   * Falls back to the shared CrawlVM CTA label and then "Start Flow".
   */
  ctaLabel?: string

  /**
   * Controls whether stop descriptions are rendered.
   */
  showStopDescriptions?: boolean

  /**
   * Optional class name applied to the outer Card.
   */
  className?: string
}

const DEFAULT_SOURCE: PropertyFlowSource =
  'white_label_guide_suggested_flow'

export default function GuideFlowCard({
  property,
  flow,
  position,
  totalFlows,
  guideId = null,
  guideSlug = null,
  source = DEFAULT_SOURCE,
  ctaLabel,
  showStopDescriptions = true,
  className,
}: GuideFlowCardProps) {
  const { crawl, vm } = flow

  const venueIds = crawl.venues
    .map((venue) => cleanText(venue.id))
    .filter((venueId): venueId is string => Boolean(venueId))

  const resolvedCtaLabel =
    cleanText(ctaLabel) ??
    cleanText(getVmCtaLabel(vm)) ??
    'Start Flow'

  const routeContext = buildGuideFlowContext({
    theme: vm.theme,
    position,
    totalWalkMinutes: vm.totalWalkMinutes,
    bestTimeLabel: vm.bestTimeLabel,
  })

  return (
    <Card
      className={joinClassNames(
        'overflow-hidden border border-neutral-800 bg-neutral-950 text-white shadow-xl shadow-black/20',
        className
      )}
    >
      <CardContent className="space-y-5 p-4 sm:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap gap-2">
              <GuideFlowChip tone="strong">
                {routeContext.primaryLabel}
              </GuideFlowChip>

              {routeContext.secondaryLabel && (
                <GuideFlowChip>
                  {routeContext.secondaryLabel}
                </GuideFlowChip>
              )}

              {vm.chips.map((chip, chipIndex) => (
                <GuideFlowChip
                  key={`${vm.id}-chip-${chipIndex}-${chip}`}
                >
                  {chip}
                </GuideFlowChip>
              ))}
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-semibold tracking-tight text-white">
                {vm.title}
              </h3>

              {vm.subtitle && (
                <p className="max-w-3xl text-sm leading-6 text-neutral-300">
                  {vm.subtitle}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-neutral-800 bg-neutral-900/80 px-3 py-2.5">
              <p className="text-sm leading-6 text-neutral-300">
                <span className="font-semibold text-white">
                  Why this flow:
                </span>{' '}
                {routeContext.reason}
              </p>
            </div>
          </div>

          <div className="w-full shrink-0 md:w-auto">
            <StartFlowButton
              title={vm.title}
              city={property.city}
              propertyId={property.id}
              propertySlug={property.slug ?? undefined}
              venueIds={venueIds}
              source={source}
              travelMode="walking"
              label={resolvedCtaLabel}
              metadata={{
                guide_id: guideId,
                guide_slug: guideSlug,
                guide_section: 'suggested_flows',
                property_id: property.id,
                property_name: property.name,
                property_slug: property.slug ?? null,
                city: property.city,
                crawl_vm_id: vm.id,
                crawl_theme: vm.theme,
                crawl_title: vm.title,
                crawl_subtitle: vm.subtitle,
                position,
                total_flows: totalFlows,
                stop_count: venueIds.length,
                venue_ids: venueIds,
                best_time_label: vm.bestTimeLabel,
                total_walk_minutes: vm.totalWalkMinutes,
                route_context_label: routeContext.primaryLabel,
              }}
            />
          </div>
        </div>

        <div className="space-y-3 border-t border-neutral-800 pt-4">
          {vm.stops.map((stop, stopIndex) => {
            const crawlVenue = crawl.venues[stopIndex]

            const venueId =
              cleanText(crawlVenue?.id) ??
              cleanText(stop.id)

            const venueHref =
              getVenueLink(crawlVenue) ??
              cleanText(stop.venueHref) ??
              (venueId
                ? `/venue-profile/${encodeURIComponent(venueId)}`
                : null)

            const venueName =
              cleanText(crawlVenue?.name) ??
              cleanText(stop.venueName) ??
              'View stop'

            const venueDescription =
              getVenueDescription(crawlVenue) ??
              cleanText(stop.description)

            return (
              <article
                key={`${vm.id}-${venueId ?? 'stop'}-${stopIndex}`}
                className="flex items-start gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-300 text-xs font-black text-neutral-950">
                  {stop.order}
                </div>

                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {stop.stageLabel && (
                      <span className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
                        {stop.stageLabel}
                      </span>
                    )}

                    {stop.walkTimeFromPreviousLabel && (
                      <GuideFlowChip>
                        {stop.walkTimeFromPreviousLabel}
                      </GuideFlowChip>
                    )}
                  </div>

                  {venueHref ? (
                    <Link
                      href={venueHref}
                      className="block text-base font-semibold leading-snug text-white transition hover:text-cyan-200 hover:underline"
                    >
                      {venueName}
                    </Link>
                  ) : (
                    <p className="text-base font-semibold leading-snug text-white">
                      {venueName}
                    </p>
                  )}

                  {showStopDescriptions && venueDescription && (
                    <p className="max-w-3xl text-sm leading-6 text-neutral-400">
                      {venueDescription}
                    </p>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function buildGuideFlowContext({
  theme,
  position,
  totalWalkMinutes,
  bestTimeLabel,
}: {
  theme: string
  position: number
  totalWalkMinutes: number | null
  bestTimeLabel: string | null
}) {
  const normalizedBestTimeLabel = cleanText(bestTimeLabel)

  const primaryLabel =
    position === 0
      ? 'Best match'
      : normalizedBestTimeLabel ?? 'Suggested flow'

  const secondaryLabel =
    position === 0
      ? normalizedBestTimeLabel
      : null

  const lowWalk =
    typeof totalWalkMinutes === 'number' &&
    totalWalkMinutes <= 18

  const themeReason =
    theme === 'morningFlow'
      ? 'A lighter sequence suited to coffee, an easy start, and daytime discovery.'
      : theme === 'soloExplorer'
        ? 'A flexible route designed for low-pressure browsing, food, and local discovery.'
        : theme === 'dateNight'
          ? 'A polished sequence that moves naturally through dinner, drinks, and an easy finish.'
          : theme === 'nightOut'
            ? 'A social route that builds energy while keeping the sequence coherent.'
            : 'A nearby sequence selected for timing, walkability, and an intuitive order.'

  const walkReason = lowWalk
    ? ' Walking friction stays low between the stops.'
    : typeof totalWalkMinutes === 'number'
      ? ' The route includes a little more walking for a fuller neighborhood experience.'
      : ''

  return {
    primaryLabel,
    secondaryLabel,
    reason: `${themeReason}${walkReason}`,
  }
}

function getVmCtaLabel(
  vm: PropertyCrawlCard['vm']
): string | null {
  return cleanText(
    (vm as { ctaLabel?: string | null }).ctaLabel
  )
}

function getVenueLink(
  venue:
    | PropertyCrawlCard['crawl']['venues'][number]
    | undefined
): string | null {
  if (!venue) {
    return null
  }

  const explicitLink = cleanText(
    (venue as { link?: string | null }).link
  )

  if (explicitLink) {
    return explicitLink
  }

  const venueId = cleanText(venue.id)

  return venueId
    ? `/venue-profile/${encodeURIComponent(venueId)}`
    : null
}

function getVenueDescription(
  venue:
    | PropertyCrawlCard['crawl']['venues'][number]
    | undefined
): string | null {
  if (!venue) {
    return null
  }

  return cleanText(
    (venue as { description?: string | null })
      .description
  )
}

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  return trimmed.length > 0
    ? trimmed
    : null
}

function joinClassNames(
  ...values: Array<string | null | undefined | false>
) {
  return values.filter(Boolean).join(' ')
}

function GuideFlowChip({
  children,
  tone = 'default',
}: {
  children: ReactNode
  tone?: 'default' | 'strong'
}) {
  const toneClassName =
    tone === 'strong'
      ? 'border-cyan-300/40 bg-cyan-300 text-neutral-950'
      : 'border-neutral-700 bg-neutral-900 text-neutral-300'

  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
        toneClassName,
      ].join(' ')}
    >
      {children}
    </span>
  )
}