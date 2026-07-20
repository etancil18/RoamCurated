import type { ReactNode } from 'react'

import { normalizeGuideAssetUrl } from '@/lib/guides/normalizeGuideAssetUrl'

import type {
  GuideConfig,
  GuideSectionKey,
} from '@/lib/guides/types'
import type { PropertyCrawlCard } from '@/lib/property/buildPropertyCrawlCards'
import type { NearbyEventVM } from '@/lib/view-models/buildNearbyEventVM'

/* ------------------------------------------------ */
/* Public contracts                                 */
/* ------------------------------------------------ */

export type GuideHighlightItem = {
  /**
   * Stable item identifier.
   */
  id: string

  /**
   * Small category or context label.
   */
  eyebrow?: string | null

  /**
   * Primary item title.
   */
  title: string

  /**
   * Optional supporting copy.
   */
  description?: string | null

  /**
   * Optional image URL.
   */
  imageUrl?: string | null

  /**
   * Destination URL or section anchor.
   */
  href: string

  /**
   * Optional compact metadata.
   */
  meta?: string | null

  /**
   * Optional badge rendered over the image.
   */
  badge?: string | null

  /**
   * Optional leading or fallback icon.
   */
  icon?: ReactNode

  /**
   * Opens the destination in a new browsing context.
   */
  external?: boolean
}

export type GuideHighlightsProps = {
  guide: GuideConfig

  /**
   * Retained for compatibility with existing callers.
   *
   * Suggested routes are intentionally excluded from guide highlights.
   */
  suggestedFlows?: PropertyCrawlCard[]

  /**
   * Already-loaded nearby events.
   */
  nearbyEvents?: NearbyEventVM[]

  /**
   * Optional explicit highlight items.
   *
   * When provided, these replace derived highlights.
   */
  items?: GuideHighlightItem[]

  /**
   * Section heading.
   *
   * Pass null to suppress the heading.
   */
  title?: string | null

  /**
   * Supporting section copy.
   *
   * Pass null to suppress the description.
   */
  description?: string | null

  /**
   * Maximum number of highlight items.
   */
  maxItems?: number

  /**
   * Hides the section when no highlights are available.
   */
  hideWhenEmpty?: boolean

  className?: string
}

/* ------------------------------------------------ */
/* Internal contracts                               */
/* ------------------------------------------------ */

type HighlightSource =
  | 'featured-venue'
  | 'nearby-event'

type DerivedHighlight = GuideHighlightItem & {
  source: HighlightSource
  priority: number
}

/* ------------------------------------------------ */
/* Constants                                        */
/* ------------------------------------------------ */

const DEFAULT_MAX_ITEMS = 6

const SOURCE_PRIORITY: Record<
  HighlightSource,
  number
> = {
  'featured-venue': 10,
  'nearby-event': 30,
}

/* ------------------------------------------------ */
/* Component                                        */
/* ------------------------------------------------ */

export default function GuideHighlights({
  guide,
  suggestedFlows: _suggestedFlows = [],
  nearbyEvents = [],
  items,
  title = 'Highlights',
  description = 'A curated starting point for the best places and experiences in this guide.',
  maxItems = DEFAULT_MAX_ITEMS,
  hideWhenEmpty = true,
  className,
}: GuideHighlightsProps) {
  const normalizedMaxItems =
    normalizeMaxItems(maxItems)

  const resolvedItems = (
    items ??
    deriveGuideHighlights({
      guide,
      nearbyEvents,
    })
  ).slice(0, normalizedMaxItems)

  if (
    hideWhenEmpty &&
    resolvedItems.length === 0
  ) {
    return null
  }

  const normalizedTitle =
    normalizeText(title)

  const normalizedDescription =
    normalizeText(description)

  return (
    <section
      data-guide-highlights
      aria-labelledby={
        normalizedTitle
          ? 'guide-highlights-title'
          : undefined
      }
      className={joinClassNames(
        'w-full',
        className
      )}
    >
      {normalizedTitle ||
      normalizedDescription ? (
        <div
          className={[
            'mb-6 flex flex-col gap-3',
            'sm:mb-8',
            'lg:flex-row lg:items-end',
            'lg:justify-between lg:gap-8',
          ].join(' ')}
        >
          <div className="max-w-2xl">
            {normalizedTitle ? (
              <h2
                id="guide-highlights-title"
                className={[
                  'text-2xl font-semibold',
                  'tracking-[-0.035em]',
                  'text-[color:var(--guide-text)]',
                  'sm:text-3xl',
                ].join(' ')}
              >
                {normalizedTitle}
              </h2>
            ) : null}

            {normalizedDescription ? (
              <p
                className={[
                  'mt-2',
                  'text-sm leading-6',
                  'text-[color:var(--guide-muted-text)]',
                  'sm:text-base',
                ].join(' ')}
              >
                {normalizedDescription}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {resolvedItems.length > 0 ? (
        <div
          className={[
            'grid gap-4',
            'sm:grid-cols-2',
            'xl:grid-cols-3',
          ].join(' ')}
        >
          {resolvedItems.map(
            (item, index) => (
              <GuideHighlightCard
                key={item.id}
                item={item}
                featured={index === 0}
              />
            )
          )}
        </div>
      ) : (
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
              'text-sm',
              'text-[color:var(--guide-muted-text)]',
            ].join(' ')}
          >
            No guide highlights are currently available.
          </p>
        </div>
      )}
    </section>
  )
}

/* ------------------------------------------------ */
/* Highlight card                                   */
/* ------------------------------------------------ */

function GuideHighlightCard({
  item,
  featured,
}: {
  item: GuideHighlightItem
  featured: boolean
}) {
  const isExternal =
    item.external === true ||
    isExternalHref(item.href)

  const eyebrow =
    normalizeText(item.eyebrow)

  const description =
    normalizeText(item.description)

  const imageUrl =
    normalizeGuideAssetUrl(
      item.imageUrl
    )

  const meta =
    normalizeText(item.meta)

  const badge =
    normalizeText(item.badge)

  return (
    <article
      className={joinClassNames(
        'group min-w-0',
        featured &&
          'sm:col-span-2 xl:col-span-2'
      )}
    >
      <a
        href={item.href}
        target={
          isExternal
            ? '_blank'
            : undefined
        }
        rel={
          isExternal
            ? 'noreferrer noopener'
            : undefined
        }
        className={[
          'relative flex h-full',
          'min-h-[22rem] overflow-hidden',
          'rounded-3xl',
          'border border-[color:var(--guide-border)]',
          'bg-[color:var(--guide-surface)]',
          'shadow-sm',
          'transition duration-300',
          'hover:-translate-y-1',
          'hover:shadow-xl',
          'focus-visible:outline-none',
          'focus-visible:ring-2',
          'focus-visible:ring-[color:var(--guide-primary)]',
          'focus-visible:ring-offset-2',
          'focus-visible:ring-offset-[color:var(--guide-background)]',
          featured
            ? 'sm:min-h-[28rem]'
            : '',
        ].join(' ')}
      >
        {imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt=""
              aria-hidden="true"
              loading="lazy"
              className={[
                'absolute inset-0',
                'h-full w-full',
                'object-cover',
                'transition duration-500',
                'group-hover:scale-[1.035]',
              ].join(' ')}
            />

            <div
              aria-hidden="true"
              className={[
                'absolute inset-0',
                'bg-gradient-to-t',
                'from-black/85',
                'via-black/35',
                'to-black/5',
              ].join(' ')}
            />
          </>
        ) : (
          <>
            <div
              aria-hidden="true"
              className={[
                'absolute inset-0',
                'bg-[color:var(--guide-primary)]',
              ].join(' ')}
            />

            <div
              aria-hidden="true"
              className={[
                'absolute inset-0',
                'bg-gradient-to-br',
                'from-white/10',
                'via-transparent',
                'to-black/20',
              ].join(' ')}
            />

            <div
              aria-hidden="true"
              className={[
                'absolute -right-12 -top-12',
                'h-44 w-44 rounded-full',
                'bg-[color:var(--guide-accent)]',
                'opacity-25 blur-3xl',
              ].join(' ')}
            />
          </>
        )}

        <div
          className={[
            'relative z-10',
            'flex min-h-full w-full',
            'flex-col justify-between',
            'p-5',
            featured
              ? 'sm:p-7'
              : 'sm:p-6',
          ].join(' ')}
        >
          <div className="flex items-start justify-between gap-4">
            {item.icon ? (
              <span
                aria-hidden="true"
                className={[
                  'inline-flex h-11 w-11',
                  'shrink-0 items-center justify-center',
                  'rounded-2xl',
                  'border border-white/20',
                  'bg-black/20',
                  'text-white',
                  'backdrop-blur',
                ].join(' ')}
              >
                {item.icon}
              </span>
            ) : (
              <span
                aria-hidden="true"
                className={[
                  'inline-flex h-11 w-11',
                  'shrink-0 items-center justify-center',
                  'rounded-2xl',
                  'border border-white/20',
                  'bg-black/20',
                  'text-white',
                  'backdrop-blur',
                ].join(' ')}
              >
                <SparkIcon />
              </span>
            )}

            {badge ? (
              <span
                className={[
                  'inline-flex min-h-7',
                  'items-center rounded-full',
                  'border border-white/20',
                  'bg-black/25',
                  'px-3 py-1',
                  'text-xs font-semibold',
                  'text-white',
                  'backdrop-blur',
                ].join(' ')}
              >
                {badge}
              </span>
            ) : null}
          </div>

          <div className="mt-16">
            {eyebrow ? (
              <p
                className={[
                  'text-xs font-semibold',
                  'uppercase tracking-[0.14em]',
                  'text-white/70',
                ].join(' ')}
              >
                {eyebrow}
              </p>
            ) : null}

            <h3
              className={[
                'mt-2',
                'text-2xl font-semibold',
                'leading-tight',
                'tracking-[-0.03em]',
                'text-white',
                featured
                  ? 'sm:text-3xl'
                  : '',
              ].join(' ')}
            >
              {item.title}
            </h3>

            {description ? (
              <p
                className={[
                  'mt-3 max-w-xl',
                  'text-sm leading-6',
                  'text-white/75',
                  featured
                    ? 'sm:text-base'
                    : '',
                ].join(' ')}
              >
                {description}
              </p>
            ) : null}

            <div
              className={[
                'mt-5 flex',
                'items-center justify-between',
                'gap-4',
              ].join(' ')}
            >
              {meta ? (
                <p
                  className={[
                    'min-w-0 truncate',
                    'text-xs font-medium',
                    'text-white/65',
                  ].join(' ')}
                >
                  {meta}
                </p>
              ) : (
                <span />
              )}

              <span
                aria-hidden="true"
                className={[
                  'shrink-0',
                  'text-xl text-white',
                  'transition-transform',
                  'duration-200',
                  'group-hover:translate-x-1',
                ].join(' ')}
              >
                {isExternal ? '↗' : '→'}
              </span>
            </div>
          </div>
        </div>
      </a>
    </article>
  )
}

/* ------------------------------------------------ */
/* Derivation                                       */
/* ------------------------------------------------ */

function deriveGuideHighlights({
  guide,
  nearbyEvents,
}: {
  guide: GuideConfig
  nearbyEvents: NearbyEventVM[]
}): GuideHighlightItem[] {
  const featuredVenueHighlights =
    deriveFeaturedVenueHighlights(guide)

  const nearbyEventHighlights =
    guide.showNearbyEvents
      ? deriveNearbyEventHighlights(
          nearbyEvents
        )
      : []

  return [
    ...featuredVenueHighlights,
    ...nearbyEventHighlights,
  ]
    .sort((left, right) => {
      if (left.priority !== right.priority) {
        return (
          left.priority -
          right.priority
        )
      }

      return left.title.localeCompare(
        right.title
      )
    })
    .map(
      ({
        source: _source,
        priority: _priority,
        ...item
      }) => item
    )
}

/* ------------------------------------------------ */
/* Featured venues                                  */
/* ------------------------------------------------ */

function deriveFeaturedVenueHighlights(
  guide: GuideConfig
): DerivedHighlight[] {
  const visibleFeaturedVenues =
    guide.featuredVenues
      .filter(
        (
          featuredVenue
        ): featuredVenue is typeof featuredVenue & {
          venue: NonNullable<
            typeof featuredVenue.venue
          >
        } =>
          featuredVenue.isVisible ===
            true &&
          featuredVenue.venue != null
      )
      .sort((left, right) => {
        const leftPosition =
          normalizeSortPosition(
            readNumber(
              left as unknown as Record<
                string,
                unknown
              >,
              [
                'position',
                'sortOrder',
                'order',
              ]
            )
          )

        const rightPosition =
          normalizeSortPosition(
            readNumber(
              right as unknown as Record<
                string,
                unknown
              >,
              [
                'position',
                'sortOrder',
                'order',
              ]
            )
          )

        if (
          leftPosition !==
          rightPosition
        ) {
          return (
            leftPosition -
            rightPosition
          )
        }

        const leftName =
          normalizeText(
            left.venue.name
          ) ?? ''

        const rightName =
          normalizeText(
            right.venue.name
          ) ?? ''

        return leftName.localeCompare(
          rightName
        )
      })

  return visibleFeaturedVenues.map(
    (featuredVenue, index) => {
      const venue =
        featuredVenue.venue

      const venueRecord =
        venue as unknown as Record<
          string,
          unknown
        >

      const featuredVenueRecord =
        featuredVenue as unknown as Record<
          string,
          unknown
        >

      const title =
        normalizeText(venue.name) ??
        `Featured place ${index + 1}`

      const description =
        normalizeText(
          venue.description
        ) ??
        readString(
          featuredVenueRecord,
          [
            'description',
            'summary',
            'caption',
          ]
        )

      const imageUrl =
        normalizeGuideAssetUrl(
          normalizeText(venue.cover) ??
            readString(
              venueRecord,
              [
                'imageUrl',
                'image',
                'coverUrl',
                'photoUrl',
              ]
            )
        )

      const href =
        normalizeText(venue.link) ??
        readString(
          venueRecord,
          [
            'url',
            'websiteUrl',
            'website',
          ]
        ) ??
        getGuideSectionAnchor(
          'favorites'
        )

      const city =
        normalizeText(venue.city)

      const venueType =
        normalizeVenueType(
          venue.type
        )

      const meta =
        buildVenueMeta({
          city,
          type: venueType,
        })

      const badge =
        readString(
          featuredVenueRecord,
          [
            'badge',
            'label',
            'categoryLabel',
          ]
        )

      return {
        id:
          normalizeText(
            String(
              featuredVenue.id ??
                venue.id ??
                ''
            )
          ) ??
          `featured-venue-${index}`,

        source:
          'featured-venue',

        priority: index,

        eyebrow:
          'Local favorite',

        title,
        description,
        imageUrl,
        href,
        meta,
        badge,
        icon: <PinIcon />,
        external:
          isExternalHref(href),
      }
    }
  )
}

/* ------------------------------------------------ */
/* Nearby events                                    */
/* ------------------------------------------------ */

function deriveNearbyEventHighlights(
  nearbyEvents: NearbyEventVM[]
): DerivedHighlight[] {
  return nearbyEvents
    .slice(0, 3)
    .map((event, index) => {
      const raw =
        event as unknown as Record<
          string,
          unknown
        >

      const id =
        readString(
          raw.id,
          raw.eventId,
          raw.slug
        ) ??
        String(index)

      const title =
        readString(
          raw.title,
          raw.name
        ) ??
        'Nearby event'

      const imageUrl =
        normalizeGuideAssetUrl(
          readString(
            raw.imageUrl,
            raw.cover,
            raw.coverUrl,
            raw.heroImageUrl
          )
        )

      const href =
        readString(
          raw.href,
          raw.link,
          raw.url
        ) ??
        '#guide-section-events'

      const meta =
        buildEventMeta(raw)

      return {
        id: `nearby-event:${id}`,
        source: 'nearby-event',
        priority:
          SOURCE_PRIORITY[
            'nearby-event'
          ] + index,

        eyebrow: 'Nearby event',
        title,
        description: null,
        imageUrl,
        href,
        meta,
        badge: 'Event',
        icon: <CalendarIcon />,
        external: isExternalHref(href),
      }
    })
}

/* ------------------------------------------------ */
/* Metadata helpers                                 */
/* ------------------------------------------------ */

function buildVenueMeta({
  city,
  type,
}: {
  city: string | null
  type: string | string[] | null
}): string | null {
  const normalizedCity =
    normalizeText(city)

  const normalizedType =
    Array.isArray(type)
      ? type
          .map(normalizeText)
          .filter(
            (
              entry
            ): entry is string =>
              entry !== null
          )
          .slice(0, 2)
          .join(' · ')
      : normalizeText(type)

  return joinNonEmpty(
    normalizedType,
    normalizedCity
  )
}

function buildEventMeta(
  raw: Record<string, unknown>
): string | null {
  return (
    readString(
      raw.dateLabel,
      raw.displayDate,
      raw.startDateLabel,
      raw.timeLabel,
      raw.displayTime
    ) ??
    formatDateValue(
      raw.startsAt ??
        raw.startAt ??
        raw.startDate
    )
  )
}

/* ------------------------------------------------ */
/* Reading helpers                                  */
/* ------------------------------------------------ */

function normalizeVenueType(
  value:
    | string
    | string[]
    | null
    | undefined
): string | string[] | null {
  if (Array.isArray(value)) {
    const normalized =
      value
        .map(normalizeText)
        .filter(
          (
            item
          ): item is string =>
            item !== null
        )

    return normalized.length > 0
      ? normalized
      : null
  }

  return normalizeText(value)
}

function normalizeSortPosition(
  value:
    | number
    | null
    | undefined
): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value)
  ) {
    return Number.MAX_SAFE_INTEGER
  }

  return value
}

function getGuideSectionAnchor(
  sectionKey: GuideSectionKey
): string {
  return `#guide-section-${sectionKey.replaceAll(
    '_',
    '-'
  )}`
}

function readString(
  ...values: unknown[]
): string | null {
  for (const value of values) {
    const normalized =
      normalizeText(
        typeof value === 'string'
          ? value
          : null
      )

    if (normalized) {
      return normalized
    }
  }

  return null
}

function readNumber(
  ...values: unknown[]
): number | null {
  for (const value of values) {
    if (
      typeof value === 'number' &&
      Number.isFinite(value)
    ) {
      return Math.max(
        0,
        Math.trunc(value)
      )
    }

    if (typeof value === 'string') {
      const parsed =
        Number.parseInt(
          value,
          10
        )

      if (Number.isFinite(parsed)) {
        return Math.max(
          0,
          Math.trunc(parsed)
        )
      }
    }
  }

  return null
}

function formatDateValue(
  value: unknown
): string | null {
  if (
    typeof value !== 'string' &&
    typeof value !== 'number' &&
    !(value instanceof Date)
  ) {
    return null
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value)

  if (
    !Number.isFinite(date.getTime())
  ) {
    return null
  }

  return new Intl.DateTimeFormat(
    'en-US',
    {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }
  ).format(date)
}

function joinNonEmpty(
  ...values: Array<
    string | null | undefined
  >
): string | null {
  const normalized = values
    .map(normalizeText)
    .filter(
      (
        value
      ): value is string =>
        value !== null
    )

  return normalized.length > 0
    ? normalized.join(' · ')
    : null
}

/* ------------------------------------------------ */
/* Generic helpers                                  */
/* ------------------------------------------------ */

function normalizeText(
  value: string | null | undefined
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  return trimmed.length > 0
    ? trimmed
    : null
}

function normalizeMaxItems(
  value: number
): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_MAX_ITEMS
  }

  return Math.max(
    1,
    Math.trunc(value)
  )
}

function isExternalHref(
  href: string
): boolean {
  return (
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('//')
  )
}

function joinClassNames(
  ...values: Array<
    string | null | undefined | false
  >
): string {
  return values
    .filter(
      (
        value
      ): value is string =>
        typeof value === 'string' &&
        value.length > 0
    )
    .join(' ')
}

/* ------------------------------------------------ */
/* Icons                                            */
/* ------------------------------------------------ */

function SparkIcon() {
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
      <path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3Z" />
      <path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" />
    </svg>
  )
}

function PinIcon() {
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

function CalendarIcon() {
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
      <rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="2"
      />
      <path d="M16 3v4M8 3v4M3 11h18" />
    </svg>
  )
}