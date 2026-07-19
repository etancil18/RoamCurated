// components/guides/GuideEventCard.tsx

'use client'

import Link from 'next/link'
import type { MouseEvent, ReactNode } from 'react'

import type { NearbyEventVM } from '@/lib/view-models/buildNearbyEventVM'

/* ------------------------------------------------ */
/* Public types                                     */
/* ------------------------------------------------ */

export type GuideEventCardAction =
  | 'primary_cta'
  | 'venue_cta'
  | 'card'

export type GuideEventCardActionPayload = {
  action: GuideEventCardAction

  eventId: string
  venueId: string

  eventTitle: string
  venueName: string

  href: string

  startsAt: string | null
  archetype: string | null
}

export type GuideEventCardProps = {
  event: NearbyEventVM

  /**
   * Optional class name applied to the outer article.
   */
  className?: string

  /**
   * When true, the event description is rendered.
   */
  showDescription?: boolean

  /**
   * Maximum number of chips displayed.
   *
   * Remaining chips are represented by a "+N" chip.
   */
  maxVisibleChips?: number

  /**
   * Optional primary CTA override.
   */
  primaryCtaLabel?: string

  /**
   * Optional venue CTA override.
   */
  venueCtaLabel?: string

  /**
   * When false, the secondary venue CTA is hidden.
   */
  showVenueCta?: boolean

  /**
   * Optional callback for analytics or parent-owned behavior.
   *
   * The card does not send analytics directly.
   */
  onAction?: (
    payload: GuideEventCardActionPayload
  ) => void
}

/* ------------------------------------------------ */
/* Component                                        */
/* ------------------------------------------------ */

export default function GuideEventCard({
  event,
  className,
  showDescription = true,
  maxVisibleChips = 5,
  primaryCtaLabel,
  venueCtaLabel = 'View Venue',
  showVenueCta = true,
  onAction,
}: GuideEventCardProps) {
  const resolvedPrimaryLabel =
    cleanText(primaryCtaLabel) ??
    event.ctaLabel

  const visibleChips = event.chips.slice(
    0,
    normalizeChipLimit(maxVisibleChips)
  )

  const hiddenChipCount = Math.max(
    0,
    event.chips.length -
      visibleChips.length
  )

  const shouldShowVenueCta =
    showVenueCta &&
    Boolean(event.secondaryCtaLabel) &&
    event.venue.href !== event.primaryHref

  const timingLabel =
    event.timing.dateTimeLabel ??
    event.timing.relativeLabel

  const eventStatusLabel =
    getStatusLabel(event)

  return (
    <article
      className={joinClassNames(
        'group overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md',
        className
      )}
      aria-labelledby={`guide-event-${event.id}-title`}
    >
      <div className="flex min-w-0 flex-col">
        <div className="flex min-w-0 flex-col gap-4 p-5 sm:p-6">
          <div className="flex min-w-0 items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {eventStatusLabel ? (
                <p
                  className={joinClassNames(
                    'mb-2 text-xs font-semibold uppercase tracking-wide',
                    getStatusTextClass(
                      event.timing.status
                    )
                  )}
                >
                  {eventStatusLabel}
                </p>
              ) : null}

              <h3
                id={`guide-event-${event.id}-title`}
                className="text-pretty text-lg font-semibold leading-tight text-neutral-950 sm:text-xl"
              >
                {event.title}
              </h3>

              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-600">
                <Link
                  href={event.venue.href}
                  className="font-medium text-neutral-800 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
                  onClick={() => {
                    emitAction({
                      action: 'venue_cta',
                      href: event.venue.href,
                      event,
                      onAction,
                    })
                  }}
                >
                  {event.venue.name}
                </Link>

                {event.venue.distanceLabel ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="text-neutral-300"
                    >
                      •
                    </span>

                    <span>
                      {event.venue.distanceLabel}
                    </span>
                  </>
                ) : null}
              </div>
            </div>

            {event.xpReward > 0 ? (
              <div
                className="shrink-0 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200"
                aria-label={`${event.xpReward} experience points`}
              >
                {event.xpReward} XP
              </div>
            ) : null}
          </div>

          {timingLabel ? (
            <div className="flex items-start gap-2 text-sm text-neutral-700">
              <CalendarIcon />

              <span>
                {timingLabel}
              </span>
            </div>
          ) : null}

          {event.priceInfo && !event.isFree ? (
            <div className="flex items-start gap-2 text-sm text-neutral-700">
              <TicketIcon />

              <span>
                {event.priceInfo}
              </span>
            </div>
          ) : null}

          {showDescription &&
          event.description ? (
            <p className="line-clamp-3 text-sm leading-6 text-neutral-600">
              {event.description}
            </p>
          ) : null}

          {visibleChips.length > 0 ? (
            <div
              className="flex flex-wrap gap-2"
              aria-label="Event details"
            >
              {visibleChips.map((chip) => (
                <span
                  key={chip}
                  className={joinClassNames(
                    'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
                    getChipClass(chip)
                  )}
                >
                  {chip}
                </span>
              ))}

              {hiddenChipCount > 0 ? (
                <span
                  className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600 ring-1 ring-inset ring-neutral-200"
                  aria-label={`${hiddenChipCount} additional event details`}
                >
                  +{hiddenChipCount}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 border-t border-neutral-100 bg-neutral-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <PrimaryEventLink
            event={event}
            label={resolvedPrimaryLabel}
            onAction={onAction}
          />

          {shouldShowVenueCta ? (
            <Link
              href={event.venue.href}
              className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-200 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
              onClick={() => {
                emitAction({
                  action: 'venue_cta',
                  href: event.venue.href,
                  event,
                  onAction,
                })
              }}
            >
              {cleanText(
                event.secondaryCtaLabel
              ) ?? venueCtaLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  )
}

/* ------------------------------------------------ */
/* Primary CTA                                      */
/* ------------------------------------------------ */

function PrimaryEventLink({
  event,
  label,
  onAction,
}: {
  event: NearbyEventVM
  label: string
  onAction?: (
    payload: GuideEventCardActionPayload
  ) => void
}) {
  const isExternal =
    isExternalHref(event.primaryHref)

  const sharedClassName =
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2'

  const handleClick = (
    _event: MouseEvent<
      HTMLAnchorElement
    >
  ) => {
    emitAction({
      action: 'primary_cta',
      href: event.primaryHref,
      event,
      onAction,
    })
  }

  const content: ReactNode = (
    <>
      <span>{label}</span>
      <ArrowIcon />
    </>
  )

  if (isExternal) {
    return (
      <a
        href={event.primaryHref}
        className={sharedClassName}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
      >
        {content}

        <span className="sr-only">
          {' '}
          opens in a new tab
        </span>
      </a>
    )
  }

  return (
    <Link
      href={event.primaryHref}
      className={sharedClassName}
      onClick={handleClick}
    >
      {content}
    </Link>
  )
}

/* ------------------------------------------------ */
/* Action emission                                  */
/* ------------------------------------------------ */

function emitAction({
  action,
  href,
  event,
  onAction,
}: {
  action: GuideEventCardAction
  href: string
  event: NearbyEventVM
  onAction?: (
    payload: GuideEventCardActionPayload
  ) => void
}) {
  onAction?.({
    action,

    eventId: event.id,
    venueId: event.venueId,

    eventTitle: event.title,
    venueName: event.venue.name,

    href,

    startsAt: event.timing.startsAt,
    archetype: event.archetype,
  })
}

/* ------------------------------------------------ */
/* Status                                           */
/* ------------------------------------------------ */

function getStatusLabel(
  event: NearbyEventVM
): string | null {
  switch (event.timing.status) {
    case 'live':
      return 'Live now'

    case 'ended':
      return 'Event ended'

    case 'inactive':
      return 'Unavailable'

    case 'unscheduled':
      return 'Date to be announced'

    case 'upcoming':
      return event.timing.relativeLabel

    default:
      return null
  }
}

function getStatusTextClass(
  status: NearbyEventVM['timing']['status']
): string {
  switch (status) {
    case 'live':
      return 'text-emerald-700'

    case 'ended':
    case 'inactive':
      return 'text-neutral-500'

    case 'unscheduled':
      return 'text-amber-700'

    case 'upcoming':
    default:
      return 'text-neutral-600'
  }
}

/* ------------------------------------------------ */
/* Chip styling                                     */
/* ------------------------------------------------ */

function getChipClass(
  chip: string
): string {
  const normalized = chip
    .trim()
    .toLowerCase()

  if (
    normalized === 'live now' ||
    normalized === 'check-in'
  ) {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  }

  if (
    normalized === 'tonight' ||
    normalized === 'today' ||
    normalized === 'tomorrow'
  ) {
    return 'bg-blue-50 text-blue-700 ring-blue-200'
  }

  if (normalized === 'free') {
    return 'bg-teal-50 text-teal-700 ring-teal-200'
  }

  if (normalized.endsWith(' xp')) {
    return 'bg-amber-50 text-amber-800 ring-amber-200'
  }

  return 'bg-neutral-100 text-neutral-700 ring-neutral-200'
}

/* ------------------------------------------------ */
/* URL helpers                                      */
/* ------------------------------------------------ */

function isExternalHref(
  href: string
): boolean {
  return (
    href.startsWith('https://') ||
    href.startsWith('http://')
  )
}

/* ------------------------------------------------ */
/* Generic helpers                                  */
/* ------------------------------------------------ */

function cleanText(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()

  return normalized.length > 0
    ? normalized
    : null
}

function normalizeChipLimit(
  value: number
): number {
  if (!Number.isFinite(value)) {
    return 5
  }

  return Math.min(
    12,
    Math.max(0, Math.trunc(value))
  )
}

function joinClassNames(
  ...values: Array<
    string | null | undefined | false
  >
): string {
  return values
    .filter(Boolean)
    .join(' ')
}

/* ------------------------------------------------ */
/* Icons                                            */
/* ------------------------------------------------ */

function CalendarIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500"
    >
      <path
        d="M6.5 2.5v2M13.5 2.5v2M3.5 7h13M5 4h10a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 15 16H5a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 5 4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TicketIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500"
    >
      <path
        d="M3.5 6.5A1.5 1.5 0 0 1 5 5h10a1.5 1.5 0 0 1 1.5 1.5v1a2.5 2.5 0 0 0 0 5v1A1.5 1.5 0 0 1 15 15H5a1.5 1.5 0 0 1-1.5-1.5v-1a2.5 2.5 0 0 0 0-5v-1Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M10 7.25v5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="1.5 2"
      />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4"
    >
      <path
        d="M4.5 10h11M11.5 6l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}