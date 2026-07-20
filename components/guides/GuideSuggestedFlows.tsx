'use client'

import Link from 'next/link'

import StartFlowButton, {
  type PropertyFlowSource,
} from '@/components/property/StartFlowButton'
import { Card, CardContent } from '@/components/ui/card'

import type { PropertyCrawlCard } from '@/lib/property/buildPropertyCrawlCards'

export type GuideSuggestedFlowsProperty = {
  id: string
  name: string
  city: string
  slug?: string | null
}

export type GuideSuggestedFlowsProps = {
  property: GuideSuggestedFlowsProperty
  flows: PropertyCrawlCard[]

  /**
   * Optional white-label guide identifier included in flow metadata.
   */
  guideId?: string | null

  /**
   * Optional public guide slug included in flow metadata.
   */
  guideSlug?: string | null

  /**
   * Optional section heading override.
   */
  title?: string

  /**
   * Optional section description override.
   */
  description?: string

  /**
   * Optional text rendered when no flows are available.
   */
  emptyMessage?: string

  /**
   * Optional CTA-label override.
   *
   * When omitted, each CrawlVM's shared ctaLabel is used.
   */
  ctaLabel?: string

  /**
   * Analytics/source identifier passed through to StartFlowButton.
   */
  source?: PropertyFlowSource

  /**
   * Optional number of cards to render.
   *
   * The loader should normally enforce this, but this provides a safe
   * presentation-level limit for configurable guide sections.
   */
  limit?: number

  /**
   * Controls whether stop descriptions are shown.
   */
  showStopDescriptions?: boolean

  /**
   * Optional wrapper class name.
   */
  className?: string
}

const DEFAULT_TITLE = 'Suggested Flows'

const DEFAULT_DESCRIPTION =
  'Curated nearby routes designed around the current time, walkability, and a natural sequence of stops.'

const DEFAULT_EMPTY_MESSAGE =
  'We’re still mapping the best nearby flows for this guide.'

const DEFAULT_SOURCE: PropertyFlowSource =
  'white_label_guide_suggested_flow'

export default function GuideSuggestedFlows({
  property,
  flows,
  guideId = null,
  guideSlug = null,
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
  ctaLabel,
  source = DEFAULT_SOURCE,
  limit,
  showStopDescriptions = true,
  className,
}: GuideSuggestedFlowsProps) {
  const visibleFlows = getVisibleFlows(flows, limit)

  if (visibleFlows.length === 0) {
    return (
      <section className={joinClassNames('space-y-6', className)}>
        <div>
          <h2
            className={[
              'text-2xl font-semibold',
              'tracking-[-0.035em]',
              'text-[color:var(--guide-text)]',
              'sm:text-3xl',
            ].join(' ')}
          >
            {title}
          </h2>

          {description && (
            <p
              className={[
                'mt-2 max-w-2xl',
                'text-sm leading-6',
                'text-[color:var(--guide-muted-text)]',
                'sm:text-base',
              ].join(' ')}
            >
              {description}
            </p>
          )}
        </div>

        <div
          className={[
            'rounded-2xl',
            'border border-dashed',
            'border-[color:var(--guide-border)]',
            'bg-[color:var(--guide-surface)]',
            'px-6 py-10',
            'text-center',
          ].join(' ')}
        >
          <p
            className={[
              'text-sm leading-6',
              'text-[color:var(--guide-muted-text)]',
            ].join(' ')}
          >
            {emptyMessage}
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className={joinClassNames('space-y-6', className)}>
      <div>
        <h2
          className={[
            'text-2xl font-semibold',
            'tracking-[-0.035em]',
            'text-[color:var(--guide-text)]',
            'sm:text-3xl',
          ].join(' ')}
        >
          {title}
        </h2>

        {description && (
          <p
            className={[
              'mt-2 max-w-2xl',
              'text-sm leading-6',
              'text-[color:var(--guide-muted-text)]',
              'sm:text-base',
            ].join(' ')}
          >
            {description}
          </p>
        )}
      </div>

      <div className="grid gap-5">
        {visibleFlows.map((flow, index) => (
          <GuideSuggestedFlowCard
            key={flow.vm.id}
            property={property}
            flow={flow}
            guideId={guideId}
            guideSlug={guideSlug}
            source={source}
            ctaLabel={ctaLabel}
            position={index}
            totalFlows={visibleFlows.length}
            showStopDescriptions={showStopDescriptions}
          />
        ))}
      </div>
    </section>
  )
}

function GuideSuggestedFlowCard({
  property,
  flow,
  guideId,
  guideSlug,
  source,
  ctaLabel,
  position,
  totalFlows,
  showStopDescriptions,
}: {
  property: GuideSuggestedFlowsProperty
  flow: PropertyCrawlCard
  guideId: string | null
  guideSlug: string | null
  source: PropertyFlowSource
  ctaLabel?: string
  position: number
  totalFlows: number
  showStopDescriptions: boolean
}) {
  const { crawl, vm } = flow

  const venueIds = crawl.venues
    .map((venue) => venue.id)
    .filter((venueId): venueId is string => Boolean(venueId))

  const resolvedCtaLabel =
    cleanText(ctaLabel) ??
    cleanText(vm.ctaLabel) ??
    'Start Flow'

  const context = buildGuideFlowContext({
    theme: vm.theme,
    position,
    totalWalkMinutes: vm.totalWalkMinutes,
    bestTimeLabel: vm.bestTimeLabel,
  })

  return (
    <Card
      className={[
        'overflow-hidden rounded-3xl',
        'border border-[color:var(--guide-border)]',
        'bg-[color:var(--guide-surface)]',
        'text-[color:var(--guide-text)]',
        'shadow-sm',
        'transition duration-300',
        'hover:-translate-y-0.5',
        'hover:shadow-xl',
      ].join(' ')}
    >
      <CardContent className="space-y-6 p-5 sm:p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex flex-wrap gap-2">
              <GuideFlowChip tone="strong">
                {context.primaryLabel}
              </GuideFlowChip>

              {context.secondaryLabel && (
                <GuideFlowChip>
                  {context.secondaryLabel}
                </GuideFlowChip>
              )}

              {vm.chips.map((chip) => (
                <GuideFlowChip key={chip}>
                  {chip}
                </GuideFlowChip>
              ))}
            </div>

            <div>
              <h3
                className={[
                  'text-xl font-semibold',
                  'tracking-[-0.025em]',
                  'text-[color:var(--guide-text)]',
                  'sm:text-2xl',
                ].join(' ')}
              >
                {vm.title}
              </h3>

              {vm.subtitle && (
                <p
                  className={[
                    'mt-2 max-w-3xl',
                    'text-sm leading-6',
                    'text-[color:var(--guide-muted-text)]',
                  ].join(' ')}
                >
                  {vm.subtitle}
                </p>
              )}
            </div>

            {context.reason && (
              <div
                className={[
                  'rounded-2xl',
                  'border border-[color:var(--guide-border)]',
                  'bg-[color:var(--guide-background)]',
                  'px-4 py-3',
                ].join(' ')}
              >
                <p
                  className={[
                    'text-sm leading-6',
                    'text-[color:var(--guide-muted-text)]',
                  ].join(' ')}
                >
                  <span className="font-semibold text-[color:var(--guide-text)]">
                    Why this flow:
                  </span>{' '}
                  {context.reason}
                </p>
              </div>
            )}
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
              }}
            />
          </div>
        </div>

        <div
          className={[
            'grid gap-3',
            'border-t border-[color:var(--guide-border)]',
            'pt-5',
            'md:grid-cols-2',
          ].join(' ')}
        >
          {vm.stops.map((stop, stopIndex) => {
            const crawlVenue = crawl.venues[stopIndex]
            const venueHref =
              cleanText(
                (crawlVenue as
                  | { link?: string | null }
                  | undefined)?.link
              ) ??
              cleanText(stop.venueHref) ??
              `/venue-profile/${stop.id}`

            const venueName =
              cleanText(crawlVenue?.name) ??
              cleanText(stop.venueName) ??
              'View stop'

            const venueDescription =
              getVenueDescription(crawlVenue) ??
              cleanText(stop.description)

            return (
              <article
                key={`${vm.id}-${stop.id}-${stopIndex}`}
                className={[
                  'flex items-start gap-4',
                  'rounded-2xl',
                  'border border-[color:var(--guide-border)]',
                  'bg-[color:var(--guide-background)]',
                  'p-4',
                ].join(' ')}
              >
                <div
                  className={[
                    'flex h-9 w-9 shrink-0',
                    'items-center justify-center',
                    'rounded-full',
                    'bg-[color:var(--guide-primary)]',
                    'text-xs font-bold',
                    'text-[color:var(--guide-button-text)]',
                    'shadow-sm',
                  ].join(' ')}
                >
                  {stop.order}
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {stop.stageLabel && (
                      <span
                        className={[
                          'text-xs font-semibold',
                          'uppercase tracking-[0.12em]',
                          'text-[color:var(--guide-primary)]',
                        ].join(' ')}
                      >
                        {stop.stageLabel}
                      </span>
                    )}

                    {stop.walkTimeFromPreviousLabel && (
                      <GuideFlowChip>
                        {stop.walkTimeFromPreviousLabel}
                      </GuideFlowChip>
                    )}
                  </div>

                  <Link
                    href={venueHref}
                    className={[
                      'block',
                      'text-base font-semibold',
                      'leading-snug',
                      'text-[color:var(--guide-text)]',
                      'transition',
                      'hover:text-[color:var(--guide-primary)]',
                      'hover:underline',
                    ].join(' ')}
                  >
                    {venueName}
                  </Link>

                  {showStopDescriptions && venueDescription && (
                    <p
                      className={[
                        'max-w-3xl',
                        'text-sm leading-6',
                        'text-[color:var(--guide-muted-text)]',
                      ].join(' ')}
                    >
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
  const primaryLabel =
    position === 0
      ? 'Best match'
      : cleanText(bestTimeLabel) ?? 'Suggested flow'

  const secondaryLabel =
    position === 0 && cleanText(bestTimeLabel)
      ? bestTimeLabel
      : null

  const walkIsLight =
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

  const walkReason = walkIsLight
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

function getVisibleFlows(
  flows: PropertyCrawlCard[] | null | undefined,
  limit: number | undefined
) {
  const validFlows = (flows ?? []).filter(
    (flow): flow is PropertyCrawlCard =>
      Boolean(
        flow &&
          flow.vm &&
          flow.crawl &&
          Array.isArray(flow.crawl.venues) &&
          Array.isArray(flow.vm.stops)
      )
  )

  if (
    typeof limit !== 'number' ||
    !Number.isFinite(limit)
  ) {
    return validFlows
  }

  return validFlows.slice(
    0,
    Math.max(0, Math.floor(limit))
  )
}

function getVenueDescription(
  venue:
    | PropertyCrawlCard['crawl']['venues'][number]
    | undefined
) {
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

  return trimmed.length > 0 ? trimmed : null
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
  children: React.ReactNode
  tone?: 'default' | 'strong'
}) {
  const toneClassName =
    tone === 'strong'
      ? [
          'border-[color:var(--guide-primary)]',
          'bg-[color:var(--guide-primary)]',
          'text-[color:var(--guide-button-text)]',
        ].join(' ')
      : [
          'border-[color:var(--guide-border)]',
          'bg-[color:var(--guide-background)]',
          'text-[color:var(--guide-muted-text)]',
        ].join(' ')

  return (
    <span
      className={[
        'inline-flex items-center',
        'rounded-full border',
        'px-2.5 py-1',
        'text-xs font-semibold',
        toneClassName,
      ].join(' ')}
    >
      {children}
    </span>
  )
}