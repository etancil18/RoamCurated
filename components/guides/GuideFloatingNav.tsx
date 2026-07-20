'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'

import type {
  GuideConfig,
  GuideSectionConfig,
  GuideSectionKey,
} from '@/lib/guides/types'

/* ------------------------------------------------ */
/* Public contracts                                 */
/* ------------------------------------------------ */

export type GuideFloatingNavItem = {
  /**
   * Stable item identifier.
   */
  id: string

  /**
   * Visible navigation label.
   */
  label: string

  /**
   * Destination URL or section anchor.
   */
  href: string

  /**
   * Optional leading icon.
   */
  icon?: ReactNode

  /**
   * Section key used for active-section tracking.
   *
   * Omit this for links that do not map to guide sections.
   */
  sectionKey?: GuideSectionKey | null

  /**
   * Opens the destination in a new browsing context.
   */
  external?: boolean
}

export type GuideFloatingNavProps = {
  guide: GuideConfig

  /**
   * Optional explicit navigation items.
   *
   * When supplied, these replace items derived from guide sections.
   */
  items?: GuideFloatingNavItem[]

  /**
   * Accessible label for the navigation landmark.
   */
  ariaLabel?: string

  /**
   * Maximum number of derived items.
   *
   * Explicit items are also capped by this value.
   */
  maxItems?: number

  /**
   * Optional vertical offset used by active-section detection.
   *
   * Increase this when the page has a persistent fixed header.
   */
  observerOffset?: number

  /**
   * Hides the navigation when fewer than this many items exist.
   */
  minimumItems?: number

  /**
   * Shows labels alongside icons on larger screens.
   */
  showDesktopLabels?: boolean

  /**
   * Shows the property or guide label in the left rail.
   */
  showContextLabel?: boolean

  /**
   * Optional fixed positioning mode.
   *
   * - `bottom`: centered floating dock near the viewport bottom.
   * - `top`: centered dock near the viewport top.
   */
  position?: 'top' | 'bottom'

  className?: string
}

/* ------------------------------------------------ */
/* Internal contracts                               */
/* ------------------------------------------------ */

type NavItemDefinition = {
  sectionKey: GuideSectionKey
  label: string
  shortLabel: string
  icon: ReactNode
}

type FloatingNavStyle = CSSProperties & {
  '--guide-floating-nav-offset'?: string
}

/* ------------------------------------------------ */
/* Constants                                        */
/* ------------------------------------------------ */

const DEFAULT_MAX_ITEMS = 7
const DEFAULT_MINIMUM_ITEMS = 2
const DEFAULT_OBSERVER_OFFSET = 112

const SECTION_PRIORITY: GuideSectionKey[] = [
  'favorites',
  'suggested_routes',
  'coffee',
  'dining',
  'bars',
  'wellness',
  'events',
  'partner_offers',
  'map',
  'custom',
]

const NAV_ITEM_DEFINITIONS: Record<
  GuideSectionKey,
  NavItemDefinition
> = {
  welcome: {
    sectionKey: 'welcome',
    label: 'Welcome',
    shortLabel: 'Welcome',
    icon: <HomeIcon />,
  },

  favorites: {
    sectionKey: 'favorites',
    label: 'Local favorites',
    shortLabel: 'Favorites',
    icon: <HeartIcon />,
  },

  suggested_routes: {
    sectionKey: 'suggested_routes',
    label: 'Suggested routes',
    shortLabel: 'Routes',
    icon: <RouteIcon />,
  },

  coffee: {
    sectionKey: 'coffee',
    label: 'Coffee',
    shortLabel: 'Coffee',
    icon: <CoffeeIcon />,
  },

  dining: {
    sectionKey: 'dining',
    label: 'Dining',
    shortLabel: 'Dining',
    icon: <DiningIcon />,
  },

  bars: {
    sectionKey: 'bars',
    label: 'Bars',
    shortLabel: 'Bars',
    icon: <GlassIcon />,
  },

  wellness: {
    sectionKey: 'wellness',
    label: 'Wellness',
    shortLabel: 'Wellness',
    icon: <WellnessIcon />,
  },

  events: {
    sectionKey: 'events',
    label: 'Nearby events',
    shortLabel: 'Events',
    icon: <CalendarIcon />,
  },

  map: {
    sectionKey: 'map',
    label: 'Map',
    shortLabel: 'Map',
    icon: <MapIcon />,
  },

  partner_offers: {
    sectionKey: 'partner_offers',
    label: 'Partner offers',
    shortLabel: 'Offers',
    icon: <OfferIcon />,
  },

  custom: {
    sectionKey: 'custom',
    label: 'More',
    shortLabel: 'More',
    icon: <GridIcon />,
  },
}

/* ------------------------------------------------ */
/* Component                                        */
/* ------------------------------------------------ */

export default function GuideFloatingNav({
  guide,
  items,
  ariaLabel = 'Guide navigation',
  maxItems = DEFAULT_MAX_ITEMS,
  observerOffset = DEFAULT_OBSERVER_OFFSET,
  minimumItems = DEFAULT_MINIMUM_ITEMS,
  showDesktopLabels = true,
  showContextLabel = true,
  position = 'bottom',
  className,
}: GuideFloatingNavProps) {
  const normalizedMaxItems =
    normalizePositiveInteger(
      maxItems,
      DEFAULT_MAX_ITEMS
    )

  const normalizedMinimumItems =
    normalizePositiveInteger(
      minimumItems,
      DEFAULT_MINIMUM_ITEMS
    )

  const normalizedObserverOffset =
    normalizeNonNegativeInteger(
      observerOffset,
      DEFAULT_OBSERVER_OFFSET
    )

  const resolvedItems = useMemo(
    () =>
      (
        items ??
        deriveGuideFloatingNavItems(
          guide
        )
      ).slice(0, normalizedMaxItems),
    [
      guide,
      items,
      normalizedMaxItems,
    ]
  )

  const trackableItems = useMemo(
    () =>
      resolvedItems.filter(
        (
          item
        ): item is GuideFloatingNavItem & {
          sectionKey: GuideSectionKey
        } =>
          item.sectionKey != null &&
          item.href.startsWith('#')
      ),
    [resolvedItems]
  )

  const [activeSectionKey, setActiveSectionKey] =
    useState<GuideSectionKey | null>(
      trackableItems[0]?.sectionKey ?? null
    )

  const [isVisible, setIsVisible] =
    useState(false)

  const navRef =
    useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (
      resolvedItems.length <
      normalizedMinimumItems
    ) {
      setIsVisible(false)
      return
    }

    const showNav = () => {
      setIsVisible(
        window.scrollY > 240
      )
    }

    showNav()

    window.addEventListener(
      'scroll',
      showNav,
      {
        passive: true,
      }
    )

    return () => {
      window.removeEventListener(
        'scroll',
        showNav
      )
    }
  }, [
    normalizedMinimumItems,
    resolvedItems.length,
  ])

  useEffect(() => {
    if (trackableItems.length === 0) {
      setActiveSectionKey(null)
      return
    }

    const sectionElements =
      trackableItems
        .map((item) => {
          const id =
            getAnchorId(item.href)

          if (!id) {
            return null
          }

          const element =
            document.getElementById(id)

          if (!element) {
            return null
          }

          return {
            sectionKey:
              item.sectionKey,
            element,
          }
        })
        .filter(
          (
            entry
          ): entry is {
            sectionKey: GuideSectionKey
            element: HTMLElement
          } => entry !== null
        )

    if (
      sectionElements.length === 0
    ) {
      setActiveSectionKey(
        trackableItems[0]?.sectionKey ??
          null
      )
      return
    }

    const updateActiveSection =
      () => {
        const viewportTarget =
          normalizedObserverOffset + 24

        let current:
          | GuideSectionKey
          | null = null

        let closestDistance =
          Number.POSITIVE_INFINITY

        for (const {
          sectionKey,
          element,
        } of sectionElements) {
          const rect =
            element.getBoundingClientRect()

          const hasEnteredViewport =
            rect.top <= viewportTarget

          if (hasEnteredViewport) {
            const distance =
              Math.abs(
                viewportTarget -
                  rect.top
              )

            if (
              distance <
              closestDistance
            ) {
              closestDistance =
                distance
              current = sectionKey
            }
          }
        }

        if (!current) {
          const upcoming =
            sectionElements.find(
              ({ element }) =>
                element.getBoundingClientRect()
                  .top > viewportTarget
            )

          current =
            upcoming?.sectionKey ??
            sectionElements[
              sectionElements.length - 1
            ]?.sectionKey ??
            null
        }

        setActiveSectionKey(
          current
        )
      }

    updateActiveSection()

    window.addEventListener(
      'scroll',
      updateActiveSection,
      {
        passive: true,
      }
    )

    window.addEventListener(
      'resize',
      updateActiveSection
    )

    return () => {
      window.removeEventListener(
        'scroll',
        updateActiveSection
      )

      window.removeEventListener(
        'resize',
        updateActiveSection
      )
    }
  }, [
    normalizedObserverOffset,
    trackableItems,
  ])

  if (
    resolvedItems.length <
    normalizedMinimumItems
  ) {
    return null
  }

  const contextLabel =
    buildContextLabel(guide)

  const style: FloatingNavStyle = {
    '--guide-floating-nav-offset':
      position === 'top'
        ? '1rem'
        : '1.25rem',
  }

  return (
    <nav
      ref={navRef}
      data-guide-floating-nav
      data-position={position}
      aria-label={ariaLabel}
      className={joinClassNames(
        'pointer-events-none',
        'fixed inset-x-0 z-50',
        'px-3',
        'transition-all duration-300',
        position === 'top'
          ? 'top-[var(--guide-floating-nav-offset)]'
          : 'bottom-[var(--guide-floating-nav-offset)]',
        isVisible
          ? 'translate-y-0 opacity-100'
          : position === 'top'
            ? '-translate-y-3 opacity-0'
            : 'translate-y-3 opacity-0',
        className
      )}
      style={style}
    >
      <div
        className={[
          'pointer-events-auto',
          'mx-auto flex',
          'w-fit max-w-full',
          'items-center gap-1.5',
          'overflow-x-auto',
          'rounded-full',
          'border border-[color:var(--guide-border)]',
          'bg-[color:var(--guide-surface)]/95',
          'p-1.5',
          'shadow-[0_18px_50px_-20px_rgba(15,23,42,0.5)]',
          'backdrop-blur-xl',
          'supports-[backdrop-filter]:bg-[color:var(--guide-surface)]/85',
          '[scrollbar-width:none]',
          '[&::-webkit-scrollbar]:hidden',
        ].join(' ')}
      >
        {showContextLabel &&
        contextLabel ? (
          <>
            <div
              className={[
                'hidden min-w-0',
                'items-center gap-2',
                'px-3',
                'lg:flex',
              ].join(' ')}
            >
              {guide.brand.logoUrl ? (
                <span
                  className={[
                    'flex h-8 w-8',
                    'shrink-0 items-center',
                    'justify-center',
                    'overflow-hidden',
                    'rounded-full',
                    'border border-[color:var(--guide-border)]',
                    'bg-white',
                  ].join(' ')}
                >
                  <img
                    src={
                      guide.brand.logoUrl
                    }
                    alt=""
                    aria-hidden="true"
                    className={[
                      'h-full w-full',
                      'object-contain',
                      'p-1',
                    ].join(' ')}
                  />
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className={[
                    'flex h-8 w-8',
                    'shrink-0 items-center',
                    'justify-center',
                    'rounded-full',
                    'bg-[color:var(--guide-primary)]',
                    'text-[color:var(--guide-button-text)]',
                  ].join(' ')}
                >
                  <CompassIcon />
                </span>
              )}

              <span
                className={[
                  'max-w-[11rem]',
                  'truncate',
                  'text-sm font-semibold',
                  'text-[color:var(--guide-text)]',
                ].join(' ')}
              >
                {contextLabel}
              </span>
            </div>

            <div
              aria-hidden="true"
              className={[
                'mx-1 hidden h-7 w-px',
                'bg-[color:var(--guide-border)]',
                'lg:block',
              ].join(' ')}
            />
          </>
        ) : null}

        <div className="flex items-center gap-1">
          {resolvedItems.map(
            (item) => {
              const isExternal =
                item.external === true ||
                isExternalHref(
                  item.href
                )

              const isActive =
                item.sectionKey != null &&
                item.sectionKey ===
                  activeSectionKey

              return (
                <a
                  key={item.id}
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
                  aria-current={
                    isActive
                      ? 'location'
                      : undefined
                  }
                  onClick={(event) => {
                    if (
                      !isExternal &&
                      item.href.startsWith(
                        '#'
                      )
                    ) {
                      handleAnchorClick({
                        event,
                        href:
                          item.href,
                        offset:
                          normalizedObserverOffset,
                      })
                    }
                  }}
                  className={joinClassNames(
                    'group relative',
                    'inline-flex h-10',
                    'shrink-0 items-center',
                    'justify-center gap-2',
                    'rounded-full',
                    'px-3',
                    'text-sm font-medium',
                    'transition duration-200',
                    'focus-visible:outline-none',
                    'focus-visible:ring-2',
                    'focus-visible:ring-[color:var(--guide-primary)]',
                    'focus-visible:ring-offset-2',
                    'focus-visible:ring-offset-[color:var(--guide-surface)]',
                    isActive
                      ? [
                          'bg-[color:var(--guide-primary)]',
                          'text-[color:var(--guide-button-text)]',
                          'shadow-sm',
                        ].join(' ')
                      : [
                          'text-[color:var(--guide-muted-text)]',
                          'hover:bg-[color:var(--guide-background)]',
                          'hover:text-[color:var(--guide-text)]',
                        ].join(' ')
                  )}
                >
                  {item.icon ? (
                    <span
                      aria-hidden="true"
                      className={[
                        'flex h-5 w-5',
                        'shrink-0 items-center',
                        'justify-center',
                      ].join(' ')}
                    >
                      {item.icon}
                    </span>
                  ) : null}

                  <span
                    className={joinClassNames(
                      'whitespace-nowrap',
                      showDesktopLabels
                        ? 'hidden sm:inline'
                        : 'sr-only'
                    )}
                  >
                    {item.label}
                  </span>

                  <span
                    className={
                      showDesktopLabels
                        ? 'sr-only'
                        : 'hidden'
                    }
                  >
                    {item.label}
                  </span>

                  {isExternal ? (
                    <span
                      aria-hidden="true"
                      className={[
                        'hidden text-xs',
                        'opacity-70 sm:inline',
                      ].join(' ')}
                    >
                      ↗
                    </span>
                  ) : null}
                </a>
              )
            }
          )}
        </div>
      </div>
    </nav>
  )
}

/* ------------------------------------------------ */
/* Item derivation                                  */
/* ------------------------------------------------ */

function deriveGuideFloatingNavItems(
  guide: GuideConfig
): GuideFloatingNavItem[] {
  const visibleSections =
    getVisibleGuideSections(
      guide.sections
    )

  const visibleSectionKeys =
    new Set(
      visibleSections.map(
        (section) => section.key
      )
    )

  return SECTION_PRIORITY
    .filter((sectionKey) =>
      visibleSectionKeys.has(
        sectionKey
      )
    )
    .filter((sectionKey) =>
      sectionShouldAppear({
        sectionKey,
        guide,
      })
    )
    .map((sectionKey) => {
      const definition =
        NAV_ITEM_DEFINITIONS[
          sectionKey
        ]

      const section =
        visibleSections.find(
          (candidate) =>
            candidate.key ===
            sectionKey
        )

      const customTitle =
        readSectionTitle(section)

      return {
        id: sectionKey,
        label:
          customTitle ??
          definition.shortLabel,
        href:
          getGuideSectionAnchor(
            sectionKey
          ),
        icon: definition.icon,
        sectionKey,
      }
    })
}

/* ------------------------------------------------ */
/* Section availability                             */
/* ------------------------------------------------ */

function sectionShouldAppear({
  sectionKey,
  guide,
}: {
  sectionKey: GuideSectionKey
  guide: GuideConfig
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
      return guide.showSuggestedRoutes

    case 'events':
      return guide.showNearbyEvents

    case 'partner_offers':
      return guide.showPartnerOffers

    case 'coffee':
    case 'dining':
    case 'bars':
    case 'wellness':
    case 'map':
    case 'custom':
      return true

    default:
      return assertUnreachable(
        sectionKey
      )
  }
}

/* ------------------------------------------------ */
/* Section helpers                                  */
/* ------------------------------------------------ */

function getVisibleGuideSections(
  sections: GuideSectionConfig[]
): GuideSectionConfig[] {
  return [...sections]
    .filter(
      (section) =>
        section.isVisible
    )
    .sort((left, right) => {
      if (
        left.position !==
        right.position
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

function readSectionTitle(
  section:
    | GuideSectionConfig
    | undefined
): string | null {
  if (!section) {
    return null
  }

  const record =
    section as unknown as Record<
      string,
      unknown
    >

  return (
    normalizeText(
      typeof record.title ===
        'string'
        ? record.title
        : null
    ) ??
    normalizeText(
      typeof section.config
        ?.title === 'string'
        ? section.config.title
        : null
    )
  )
}

function getGuideSectionAnchor(
  sectionKey: GuideSectionKey
): string {
  return `#guide-section-${sectionKey.replaceAll(
    '_',
    '-'
  )}`
}

function getAnchorId(
  href: string
): string | null {
  if (
    !href.startsWith('#') ||
    href.length <= 1
  ) {
    return null
  }

  try {
    return decodeURIComponent(
      href.slice(1)
    )
  } catch {
    return href.slice(1)
  }
}

/* ------------------------------------------------ */
/* Scroll handling                                  */
/* ------------------------------------------------ */

function handleAnchorClick({
  event,
  href,
  offset,
}: {
  event: React.MouseEvent<
    HTMLAnchorElement
  >
  href: string
  offset: number
}) {
  const id = getAnchorId(href)

  if (!id) {
    return
  }

  const element =
    document.getElementById(id)

  if (!element) {
    return
  }

  event.preventDefault()

  const top =
    element.getBoundingClientRect()
      .top +
    window.scrollY -
    offset

  window.scrollTo({
    top: Math.max(0, top),
    behavior: prefersReducedMotion()
      ? 'auto'
      : 'smooth',
  })

  window.history.replaceState(
    null,
    '',
    href
  )
}

function prefersReducedMotion() {
  return window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches
}

/* ------------------------------------------------ */
/* Display helpers                                  */
/* ------------------------------------------------ */

function buildContextLabel(
  guide: GuideConfig
): string | null {
  return (
    normalizeText(
      guide.property.name
    ) ??
    normalizeText(guide.title) ??
    normalizeText(
      guide.brand.name
    )
  )
}

/* ------------------------------------------------ */
/* Generic helpers                                  */
/* ------------------------------------------------ */

function normalizeText(
  value:
    | string
    | null
    | undefined
): string | null {
  if (
    typeof value !== 'string'
  ) {
    return null
  }

  const trimmed =
    value.trim()

  return trimmed.length > 0
    ? trimmed
    : null
}

function normalizePositiveInteger(
  value: number,
  fallback: number
): number {
  if (
    !Number.isFinite(value)
  ) {
    return fallback
  }

  return Math.max(
    1,
    Math.trunc(value)
  )
}

function normalizeNonNegativeInteger(
  value: number,
  fallback: number
): number {
  if (
    !Number.isFinite(value)
  ) {
    return fallback
  }

  return Math.max(
    0,
    Math.trunc(value)
  )
}

function isExternalHref(
  href: string
): boolean {
  return (
    href.startsWith(
      'http://'
    ) ||
    href.startsWith(
      'https://'
    ) ||
    href.startsWith('//')
  )
}

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

function HomeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10" />
      <path d="M9 20v-6h6v6" />
    </svg>
  )
}

function HeartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
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
      width="18"
      height="18"
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

function CoffeeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
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

function DiningIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
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

function GlassIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
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
      width="18"
      height="18"
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

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
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

function MapIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
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

function OfferIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 12 12 20 4 12V4h8l8 8Z" />
      <circle
        cx="8.5"
        cy="8.5"
        r="1.5"
      />
    </svg>
  )
}

function GridIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="3"
        width="7"
        height="7"
        rx="1"
      />
      <rect
        x="14"
        y="3"
        width="7"
        height="7"
        rx="1"
      />
      <rect
        x="3"
        y="14"
        width="7"
        height="7"
        rx="1"
      />
      <rect
        x="14"
        y="14"
        width="7"
        height="7"
        rx="1"
      />
    </svg>
  )
}

function CompassIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="17"
      height="17"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
      />
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
    </svg>
  )
}