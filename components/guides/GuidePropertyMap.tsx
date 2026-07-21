'use client'

import dynamic from 'next/dynamic'

import type { Venue } from '@/types/venue'

/* ------------------------------------------------ */
/* Dynamic map                                      */
/* ------------------------------------------------ */

const PropertyMap = dynamic(
  () =>
    import(
      '@/components/maps/PropertyMap'
    ),
  {
    ssr: false,
    loading: () => (
      <GuidePropertyMapLoading />
    ),
  }
)

/* ------------------------------------------------ */
/* Public contracts                                 */
/* ------------------------------------------------ */

export type GuidePropertyMapProperty = {
  id: string
  name: string
  city: string
  lat: number
  lon: number
}

export type GuidePropertyMapProps = {
  property: GuidePropertyMapProperty
  venues: Venue[]

  /**
   * Optional section heading override.
   */
  title?: string

  /**
   * Optional section description override.
   */
  description?: string

  /**
   * Travel mode used when previewing a route.
   */
  travelMode?:
    | 'walking'
    | 'cycling'
    | 'driving'

  /**
   * Optional text rendered when map coordinates
   * are unavailable.
   */
  unavailableMessage?: string

  /**
   * Optional wrapper class name.
   */
  className?: string
}

/* ------------------------------------------------ */
/* Constants                                        */
/* ------------------------------------------------ */

const DEFAULT_TITLE =
  'Explore the area'

const DEFAULT_DESCRIPTION =
  'Browse nearby places and preview routes from this guide.'

const DEFAULT_UNAVAILABLE_MESSAGE =
  'Map coordinates are not available for this guide.'

/* ------------------------------------------------ */
/* Component                                        */
/* ------------------------------------------------ */

export default function GuidePropertyMap({
  property,
  venues,
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  travelMode = 'walking',
  unavailableMessage =
    DEFAULT_UNAVAILABLE_MESSAGE,
  className,
}: GuidePropertyMapProps) {
  const hasValidCoordinates =
    isValidLatitude(property.lat) &&
    isValidLongitude(property.lon)

  const visibleVenues =
    getVisibleVenues(venues)

  return (
    <section
      aria-labelledby="guide-property-map-title"
      className={joinClassNames(
        'space-y-6',
        className
      )}
    >
      <div>
        <h2
          id="guide-property-map-title"
          className={[
            'text-2xl font-semibold',
            'tracking-[-0.035em]',
            'text-[color:var(--guide-text)]',
            'sm:text-3xl',
          ].join(' ')}
        >
          {title}
        </h2>

        {description ? (
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
        ) : null}
      </div>

      {hasValidCoordinates ? (
        <div
          className={[
            'relative overflow-hidden',
            'rounded-3xl',
            'border border-[color:var(--guide-border)]',
            'bg-[color:var(--guide-surface)]',
            'shadow-sm',
          ].join(' ')}
        >
          <PropertyMap
            property={{
              id: property.id,
              name: property.name,
              city: property.city,
              lat: property.lat,
              lon: property.lon,
            }}
            venues={visibleVenues}
            travelMode={travelMode}
            markerDisplayMode="emoji"
            venueMarkerVariant="guide"
          />

          <div
            aria-hidden="true"
            className={[
              'pointer-events-none',
              'absolute bottom-3 left-3',
              'z-[400]',
              'rounded-full',
              'border border-white/15',
              'bg-black/70',
              'px-3 py-1.5',
              'text-[11px] font-medium',
              'text-white/90',
              'shadow-sm',
              'backdrop-blur-md',
            ].join(' ')}
          >
            Scroll, pinch, or double-click to zoom
          </div>
        </div>
      ) : (
        <GuidePropertyMapUnavailable
          message={
            unavailableMessage
          }
        />
      )}
    </section>
  )
}

/* ------------------------------------------------ */
/* Loading state                                    */
/* ------------------------------------------------ */

function GuidePropertyMapLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading map"
      className={[
        'flex h-[400px] w-full',
        'items-center justify-center',
        'rounded-3xl',
        'border border-[color:var(--guide-border)]',
        'bg-[color:var(--guide-surface)]',
      ].join(' ')}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={[
            'h-5 w-5',
            'animate-spin rounded-full',
            'border-2',
            'border-[color:var(--guide-border)]',
            'border-t-[color:var(--guide-primary)]',
          ].join(' ')}
        />

        <span
          className={[
            'text-sm',
            'text-[color:var(--guide-muted-text)]',
          ].join(' ')}
        >
          Loading map…
        </span>
      </div>
    </div>
  )
}

/* ------------------------------------------------ */
/* Unavailable state                                */
/* ------------------------------------------------ */

function GuidePropertyMapUnavailable({
  message,
}: {
  message: string
}) {
  return (
    <div
      role="status"
      className={[
        'flex min-h-[240px]',
        'items-center justify-center',
        'rounded-3xl',
        'border border-dashed',
        'border-[color:var(--guide-border)]',
        'bg-[color:var(--guide-surface)]',
        'px-6 py-10',
        'text-center',
      ].join(' ')}
    >
      <div className="max-w-md">
        <span
          aria-hidden="true"
          className={[
            'mx-auto flex h-11 w-11',
            'items-center justify-center',
            'rounded-full',
            'bg-[color:var(--guide-background)]',
            'text-[color:var(--guide-primary)]',
          ].join(' ')}
        >
          <MapPinIcon />
        </span>

        <p
          className={[
            'mt-4 text-sm leading-6',
            'text-[color:var(--guide-muted-text)]',
          ].join(' ')}
        >
          {message}
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------ */
/* Venue filtering                                  */
/* ------------------------------------------------ */

function getVisibleVenues(
  venues:
    | Venue[]
    | null
    | undefined
): Venue[] {
  if (!Array.isArray(venues)) {
    return []
  }

  return venues.filter(
    (
      venue
    ): venue is Venue =>
      Boolean(
        venue &&
          typeof venue ===
            'object' &&
          typeof venue.id ===
            'string' &&
          venue.id.trim().length > 0
      )
  )
}

/* ------------------------------------------------ */
/* Coordinate validation                            */
/* ------------------------------------------------ */

function isValidLatitude(
  value: number
): boolean {
  return (
    Number.isFinite(value) &&
    value >= -90 &&
    value <= 90
  )
}

function isValidLongitude(
  value: number
): boolean {
  return (
    Number.isFinite(value) &&
    value >= -180 &&
    value <= 180
  )
}

/* ------------------------------------------------ */
/* Generic helpers                                  */
/* ------------------------------------------------ */

function joinClassNames(
  ...values: Array<
    | string
    | null
    | undefined
    | false
  >
): string {
  return values
    .filter(
      (
        value
      ): value is string =>
        typeof value ===
          'string' &&
        value.length > 0
    )
    .join(' ')
}

/* ------------------------------------------------ */
/* Icons                                            */
/* ------------------------------------------------ */

function MapPinIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle
        cx="12"
        cy="10"
        r="2.5"
      />
    </svg>
  )
}