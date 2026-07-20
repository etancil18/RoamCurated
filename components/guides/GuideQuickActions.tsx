import type { ReactNode } from 'react'

import type {
  GuideConfig,
  GuideSectionConfig,
  GuideSectionKey,
} from '@/lib/guides/types'
import type { PropertyCrawlCard } from '@/lib/property/buildPropertyCrawlCards'
import type { NearbyEventVM } from '@/lib/view-models/buildNearbyEventVM'

/* ------------------------------------------------ */
/* Public contracts                                 */
/* ------------------------------------------------ */

export type GuideQuickAction = {
  /**
   * Stable action identifier.
   */
  id: string

  /**
   * Visible action label.
   */
  label: string

  /**
   * Optional supporting text.
   */
  description?: string | null

  /**
   * Destination URL or in-page section anchor.
   */
  href: string

  /**
   * Optional leading icon or decorative element.
   */
  icon?: ReactNode

  /**
   * Optional compact count or status value.
   */
  badge?: string | number | null

  /**
   * Opens the destination in a new browsing context.
   */
  external?: boolean
}

export type GuideQuickActionsProps = {
  guide: GuideConfig

  /**
   * Already-loaded suggested routes.
   */
  suggestedFlows?: PropertyCrawlCard[]

  /**
   * Already-loaded nearby events.
   */
  nearbyEvents?: NearbyEventVM[]

  /**
   * Nearby venue count returned by the page loader.
   */
  nearbyVenueCount?: number

  /**
   * Optional explicit actions.
   *
   * When supplied, these replace the derived actions.
   */
  actions?: GuideQuickAction[]

  /**
   * Optional section heading.
   *
   * Pass null to suppress the heading.
   */
  title?: string | null

  /**
   * Optional section description.
   *
   * Pass null to suppress the description.
   */
  description?: string | null

  /**
   * Maximum number of derived actions to display.
   *
   * Explicit actions are also capped by this value.
   */
  maxActions?: number

  /**
   * Hide the entire component when no actions are available.
   */
  hideWhenEmpty?: boolean

  className?: string
}

/* ------------------------------------------------ */
/* Internal contracts                               */
/* ------------------------------------------------ */

type QuickActionDefinition = {
  sectionKey: GuideSectionKey
  label: string
  description: string
  icon: ReactNode
}

/* ------------------------------------------------ */
/* Constants                                        */
/* ------------------------------------------------ */

const DEFAULT_MAX_ACTIONS = 4

const QUICK_ACTION_DEFINITIONS: QuickActionDefinition[] = [
  {
    sectionKey: 'favorites',
    label: 'Local favorites',
    description: 'Start with the places selected for this guide.',
    icon: <HeartIcon />,
  },
  {
    sectionKey: 'suggested_routes',
    label: 'Suggested routes',
    description: 'Follow a ready-made route through the area.',
    icon: <RouteIcon />,
  },
  {
    sectionKey: 'events',
    label: 'Nearby events',
    description: 'See what is happening near the property.',
    icon: <CalendarIcon />,
  },
  {
    sectionKey: 'dining',
    label: 'Dining',
    description: 'Browse nearby places to eat.',
    icon: <DiningIcon />,
  },
  {
    sectionKey: 'coffee',
    label: 'Coffee',
    description: 'Find nearby coffee and daytime stops.',
    icon: <CoffeeIcon />,
  },
  {
    sectionKey: 'bars',
    label: 'Bars',
    description: 'Discover drinks and nightlife nearby.',
    icon: <GlassIcon />,
  },
  {
    sectionKey: 'wellness',
    label: 'Wellness',
    description: 'Explore fitness, recovery, and self-care.',
    icon: <WellnessIcon />,
  },
  {
    sectionKey: 'partner_offers',
    label: 'Partner offers',
    description: 'View available guide-exclusive offers.',
    icon: <OfferIcon />,
  },
  {
    sectionKey: 'map',
    label: 'Open map',
    description: 'View guide locations together on the map.',
    icon: <MapIcon />,
  },
]

/* ------------------------------------------------ */
/* Component                                        */
/* ------------------------------------------------ */

export default function GuideQuickActions({
  guide,
  suggestedFlows = [],
  nearbyEvents = [],
  nearbyVenueCount = 0,
  actions,
  title = 'Explore the guide',
  description = 'Jump directly to the places and experiences that matter most.',
  maxActions = DEFAULT_MAX_ACTIONS,
  hideWhenEmpty = true,
  className,
}: GuideQuickActionsProps) {
  const normalizedMaxActions = normalizeMaxActions(maxActions)

  const resolvedActions = (
    actions ??
    deriveGuideQuickActions({
      guide,
      suggestedFlows,
      nearbyEvents,
      nearbyVenueCount,
    })
  ).slice(0, normalizedMaxActions)

  if (
    hideWhenEmpty &&
    resolvedActions.length === 0
  ) {
    return null
  }

  const normalizedTitle = normalizeText(title)
  const normalizedDescription =
    normalizeText(description)

  return (
    <section
      data-guide-quick-actions
      aria-labelledby={
        normalizedTitle
          ? 'guide-quick-actions-title'
          : undefined
      }
      className={joinClassNames(
        'w-full',
        className
      )}
    >
      {normalizedTitle ||
      normalizedDescription ? (
        <div className="mb-5 sm:mb-6">
          {normalizedTitle ? (
            <h2
              id="guide-quick-actions-title"
              className={[
                'text-2xl font-semibold',
                'tracking-[-0.03em]',
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
                'mt-2 max-w-2xl',
                'text-sm leading-6',
                'text-[color:var(--guide-muted-text)]',
                'sm:text-base',
              ].join(' ')}
            >
              {normalizedDescription}
            </p>
          ) : null}
        </div>
      ) : null}

      {resolvedActions.length > 0 ? (
        <div
          className={[
            'grid gap-3',
            'sm:grid-cols-2',
            'lg:grid-cols-4',
          ].join(' ')}
        >
          {resolvedActions.map((action) => (
            <GuideQuickActionCard
              key={action.id}
              action={action}
            />
          ))}
        </div>
      ) : (
        <div
          className={[
            'rounded-2xl',
            'border border-dashed',
            'border-[color:var(--guide-border)]',
            'bg-[color:var(--guide-surface)]',
            'px-5 py-8',
            'text-center',
          ].join(' ')}
        >
          <p
            className={[
              'text-sm',
              'text-[color:var(--guide-muted-text)]',
            ].join(' ')}
          >
            No quick actions are currently available.
          </p>
        </div>
      )}
    </section>
  )
}

/* ------------------------------------------------ */
/* Action card                                      */
/* ------------------------------------------------ */

function GuideQuickActionCard({
  action,
}: {
  action: GuideQuickAction
}) {
  const isExternal =
    action.external === true ||
    isExternalHref(action.href)

  const normalizedDescription =
    normalizeText(action.description)

  const normalizedBadge =
    normalizeBadge(action.badge)

  return (
    <a
      href={action.href}
      target={isExternal ? '_blank' : undefined}
      rel={
        isExternal
          ? 'noreferrer noopener'
          : undefined
      }
      className={[
        'group relative',
        'flex min-h-[9.5rem]',
        'flex-col justify-between',
        'overflow-hidden rounded-2xl',
        'border border-[color:var(--guide-border)]',
        'bg-[color:var(--guide-surface)]',
        'p-5',
        'shadow-sm',
        'transition duration-200',
        'hover:-translate-y-0.5',
        'hover:border-[color:var(--guide-primary)]',
        'hover:shadow-lg',
        'focus-visible:outline-none',
        'focus-visible:ring-2',
        'focus-visible:ring-[color:var(--guide-primary)]',
        'focus-visible:ring-offset-2',
        'focus-visible:ring-offset-[color:var(--guide-background)]',
      ].join(' ')}
    >
      <div
        aria-hidden="true"
        className={[
          'absolute inset-x-0 top-0',
          'h-1',
          'origin-left scale-x-0',
          'bg-[color:var(--guide-accent)]',
          'transition-transform duration-200',
          'group-hover:scale-x-100',
          'group-focus-visible:scale-x-100',
        ].join(' ')}
      />

      <div className="flex items-start justify-between gap-4">
        <span
          aria-hidden="true"
          className={[
            'inline-flex h-11 w-11',
            'shrink-0 items-center justify-center',
            'rounded-xl',
            'bg-[color:var(--guide-primary)]',
            'text-[color:var(--guide-button-text)]',
            'shadow-sm',
          ].join(' ')}
        >
          {action.icon ?? <ArrowIcon />}
        </span>

        {normalizedBadge ? (
          <span
            className={[
              'inline-flex min-h-7',
              'items-center justify-center',
              'rounded-full',
              'border border-[color:var(--guide-border)]',
              'bg-[color:var(--guide-background)]',
              'px-2.5 py-1',
              'text-xs font-semibold',
              'text-[color:var(--guide-muted-text)]',
            ].join(' ')}
          >
            {normalizedBadge}
          </span>
        ) : null}
      </div>

      <div className="mt-6">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h3
              className={[
                'text-base font-semibold',
                'tracking-[-0.015em]',
                'text-[color:var(--guide-text)]',
              ].join(' ')}
            >
              {action.label}
            </h3>

            {normalizedDescription ? (
              <p
                className={[
                  'mt-1.5',
                  'text-sm leading-5',
                  'text-[color:var(--guide-muted-text)]',
                ].join(' ')}
              >
                {normalizedDescription}
              </p>
            ) : null}
          </div>

          <span
            aria-hidden="true"
            className={[
              'shrink-0',
              'text-lg leading-none',
              'text-[color:var(--guide-primary)]',
              'transition-transform duration-200',
              'group-hover:translate-x-1',
              'group-focus-visible:translate-x-1',
            ].join(' ')}
          >
            {isExternal ? '↗' : '→'}
          </span>
        </div>
      </div>
    </a>
  )
}

/* ------------------------------------------------ */
/* Derived actions                                  */
/* ------------------------------------------------ */

function deriveGuideQuickActions({
  guide,
  suggestedFlows,
  nearbyEvents,
  nearbyVenueCount,
}: {
  guide: GuideConfig
  suggestedFlows: PropertyCrawlCard[]
  nearbyEvents: NearbyEventVM[]
  nearbyVenueCount: number
}): GuideQuickAction[] {
  const visibleSections =
    getVisibleGuideSections(guide.sections)

  const visibleSectionKeys = new Set(
    visibleSections.map(
      (section) => section.key
    )
  )

  return QUICK_ACTION_DEFINITIONS
    .filter((definition) =>
      visibleSectionKeys.has(
        definition.sectionKey
      )
    )
    .filter((definition) =>
      sectionHasAvailableContent({
        sectionKey: definition.sectionKey,
        guide,
        suggestedFlows,
        nearbyEvents,
      })
    )
    .map((definition) => ({
      id: definition.sectionKey,
      label: definition.label,
      description: definition.description,
      href: getGuideSectionAnchor(
        definition.sectionKey
      ),
      icon: definition.icon,
      badge: getSectionBadge({
        sectionKey: definition.sectionKey,
        guide,
        suggestedFlows,
        nearbyEvents,
        nearbyVenueCount,
      }),
    }))
}

/* ------------------------------------------------ */
/* Availability                                     */
/* ------------------------------------------------ */

function sectionHasAvailableContent({
  sectionKey,
  guide,
  suggestedFlows,
  nearbyEvents,
}: {
  sectionKey: GuideSectionKey
  guide: GuideConfig
  suggestedFlows: PropertyCrawlCard[]
  nearbyEvents: NearbyEventVM[]
}): boolean {
  switch (sectionKey) {
    case 'welcome':
      return false

    case 'favorites':
      return (
        guide.showPropertyFavorites &&
        guide.featuredVenues.some(
          (featuredVenue) =>
            featuredVenue.isVisible &&
            featuredVenue.venue != null
        )
      )

    case 'suggested_routes':
      return (
        guide.showSuggestedRoutes &&
        suggestedFlows.length > 0
      )

    case 'events':
      return (
        guide.showNearbyEvents &&
        nearbyEvents.length > 0
      )

    case 'partner_offers':
      return guide.showPartnerOffers

    case 'coffee':
    case 'dining':
    case 'bars':
    case 'wellness':
    case 'map':
      return true

    case 'custom':
      return false

    default:
      return assertUnreachable(sectionKey)
  }
}

/* ------------------------------------------------ */
/* Badge logic                                      */
/* ------------------------------------------------ */

function getSectionBadge({
  sectionKey,
  guide,
  suggestedFlows,
  nearbyEvents,
  nearbyVenueCount,
}: {
  sectionKey: GuideSectionKey
  guide: GuideConfig
  suggestedFlows: PropertyCrawlCard[]
  nearbyEvents: NearbyEventVM[]
  nearbyVenueCount: number
}): string | null {
  switch (sectionKey) {
    case 'favorites': {
      const count =
        guide.featuredVenues.filter(
          (featuredVenue) =>
            featuredVenue.isVisible &&
            featuredVenue.venue != null
        ).length

      return count > 0
        ? formatCount(count)
        : null
    }

    case 'suggested_routes':
      return suggestedFlows.length > 0
        ? formatCount(
            suggestedFlows.length
          )
        : null

    case 'events':
      return nearbyEvents.length > 0
        ? formatCount(nearbyEvents.length)
        : null

    case 'map': {
      const normalizedCount =
        normalizeCount(nearbyVenueCount)

      return normalizedCount > 0
        ? formatCount(normalizedCount)
        : null
    }

    case 'welcome':
    case 'coffee':
    case 'dining':
    case 'bars':
    case 'wellness':
    case 'partner_offers':
    case 'custom':
      return null

    default:
      return assertUnreachable(sectionKey)
  }
}

/* ------------------------------------------------ */
/* Section helpers                                  */
/* ------------------------------------------------ */

function getVisibleGuideSections(
  sections: GuideSectionConfig[]
): GuideSectionConfig[] {
  return [...sections]
    .filter((section) => section.isVisible)
    .sort((left, right) => {
      if (
        left.position !== right.position
      ) {
        return (
          left.position -
          right.position
        )
      }

      return left.key.localeCompare(
        right.key
      )
    })
}

function getGuideSectionAnchor(
  sectionKey: GuideSectionKey
): string {
  return `#guide-section-${sectionKey.replaceAll(
    '_',
    '-'
  )}`
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

function normalizeBadge(
  value:
    | string
    | number
    | null
    | undefined
): string | null {
  if (
    typeof value === 'number'
  ) {
    if (!Number.isFinite(value)) {
      return null
    }

    return String(value)
  }

  return normalizeText(value)
}

function normalizeCount(
  value: number
): number {
  return Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : 0
}

function normalizeMaxActions(
  value: number
): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_MAX_ACTIONS
  }

  return Math.max(
    1,
    Math.trunc(value)
  )
}

function formatCount(
  value: number
): string {
  return new Intl.NumberFormat(
    'en-US',
    {
      notation:
        value >= 1000
          ? 'compact'
          : 'standard',
      maximumFractionDigits: 1,
    }
  ).format(value)
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
      (value): value is string =>
        typeof value === 'string' &&
        value.length > 0
    )
    .join(' ')
}

function assertUnreachable(
  value: never
): never {
  throw new Error(
    `Unsupported guide section key: ${String(
      value
    )}`
  )
}

/* ------------------------------------------------ */
/* Icons                                            */
/* ------------------------------------------------ */

function HeartIcon() {
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
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
    </svg>
  )
}

function RouteIcon() {
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
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="5" r="2" />
      <path d="M8 19h3a4 4 0 0 0 4-4v-2a4 4 0 0 1 4-4" />
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

function DiningIcon() {
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
      <path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M16 3v18M16 3c3 2 4 5 4 8h-4" />
    </svg>
  )
}

function CoffeeIcon() {
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
      <path d="M4 8h13v5a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6V8Z" />
      <path d="M17 10h1a3 3 0 0 1 0 6h-2M6 3v2M10 3v2M14 3v2" />
    </svg>
  )
}

function GlassIcon() {
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
      <path d="M5 3h14l-2 7a5.2 5.2 0 0 1-10 0L5 3Z" />
      <path d="M12 15v6M8 21h8" />
    </svg>
  )
}

function WellnessIcon() {
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
      <path d="M12 21c4-3 7-6.6 7-11a7 7 0 0 0-14 0c0 4.4 3 8 7 11Z" />
      <path d="M9 11c1.5 1 4.5 1 6 0M12 7v8" />
    </svg>
  )
}

function OfferIcon() {
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
      <path d="M20 12 12 20 4 12V4h8l8 8Z" />
      <circle cx="8.5" cy="8.5" r="1.5" />
    </svg>
  )
}

function MapIcon() {
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
      <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" />
      <path d="M9 3v15M15 6v15" />
    </svg>
  )
}

function ArrowIcon() {
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
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}