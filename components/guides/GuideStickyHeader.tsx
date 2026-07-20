'use client'

import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import type { GuideConfig } from '@/lib/guides/types'

/* ------------------------------------------------ */
/* Public contracts                                 */
/* ------------------------------------------------ */

export type GuideStickyHeaderAction = {
  /**
   * Visible action label.
   */
  label: string

  /**
   * Destination URL or in-page anchor.
   */
  href: string

  /**
   * Optional accessible label.
   */
  ariaLabel?: string

  /**
   * Optional leading icon.
   */
  icon?: ReactNode

  /**
   * Opens the destination in a new browsing context.
   */
  external?: boolean
}

export type GuideStickyHeaderProps = {
  guide: GuideConfig

  /**
   * Optional explicit primary header action.
   *
   * When undefined, the component derives the most useful
   * available guide destination.
   *
   * Pass null to suppress the action.
   */
  primaryAction?: GuideStickyHeaderAction | null

  /**
   * Accessible label for the header navigation.
   */
  ariaLabel?: string

  /**
   * Amount of vertical scrolling required before the header
   * becomes visually elevated.
   */
  elevationThreshold?: number

  /**
   * Amount of vertical scrolling required before the compact
   * guide title replaces the property context.
   */
  compactThreshold?: number

  /**
   * Shows the configured brand logo.
   */
  showLogo?: boolean

  /**
   * Shows the guide or property subtitle context.
   */
  showContext?: boolean

  /**
   * Shows the return-to-top control.
   */
  showBackToTop?: boolean

  /**
   * Makes the header fixed to the viewport rather than sticky
   * within its document flow.
   */
  fixed?: boolean

  className?: string
}

/* ------------------------------------------------ */
/* Internal contracts                               */
/* ------------------------------------------------ */

type HeaderState = {
  isElevated: boolean
  isCompact: boolean
}

/* ------------------------------------------------ */
/* Constants                                        */
/* ------------------------------------------------ */

const DEFAULT_ELEVATION_THRESHOLD = 12
const DEFAULT_COMPACT_THRESHOLD = 160

/* ------------------------------------------------ */
/* Component                                        */
/* ------------------------------------------------ */

export default function GuideStickyHeader({
  guide,
  primaryAction,
  ariaLabel = 'Guide header navigation',
  elevationThreshold = DEFAULT_ELEVATION_THRESHOLD,
  compactThreshold = DEFAULT_COMPACT_THRESHOLD,
  showLogo = true,
  showContext = true,
  showBackToTop = true,
  fixed = false,
  className,
}: GuideStickyHeaderProps) {
  const normalizedElevationThreshold =
    normalizeNonNegativeInteger(
      elevationThreshold,
      DEFAULT_ELEVATION_THRESHOLD
    )

  const normalizedCompactThreshold =
    normalizeNonNegativeInteger(
      compactThreshold,
      DEFAULT_COMPACT_THRESHOLD
    )

  const [headerState, setHeaderState] =
    useState<HeaderState>({
      isElevated: false,
      isCompact: false,
    })

  const derivedAction = useMemo(
    () => derivePrimaryAction(guide),
    [guide]
  )

  const resolvedPrimaryAction =
    primaryAction === undefined
      ? derivedAction
      : primaryAction

  useEffect(() => {
    let frameId: number | null = null

    const updateHeaderState = () => {
      frameId = null

      const scrollY =
        window.scrollY ||
        document.documentElement.scrollTop ||
        0

      const nextState: HeaderState = {
        isElevated:
          scrollY >
          normalizedElevationThreshold,

        isCompact:
          scrollY >
          normalizedCompactThreshold,
      }

      setHeaderState((current) => {
        if (
          current.isElevated ===
            nextState.isElevated &&
          current.isCompact ===
            nextState.isCompact
        ) {
          return current
        }

        return nextState
      })
    }

    const handleScroll = () => {
      if (frameId !== null) {
        return
      }

      frameId =
        window.requestAnimationFrame(
          updateHeaderState
        )
    }

    updateHeaderState()

    window.addEventListener(
      'scroll',
      handleScroll,
      {
        passive: true,
      }
    )

    window.addEventListener(
      'resize',
      handleScroll
    )

    return () => {
      window.removeEventListener(
        'scroll',
        handleScroll
      )

      window.removeEventListener(
        'resize',
        handleScroll
      )

      if (frameId !== null) {
        window.cancelAnimationFrame(
          frameId
        )
      }
    }
  }, [
    normalizedCompactThreshold,
    normalizedElevationThreshold,
  ])

  const guideTitle =
    normalizeText(guide.title) ??
    'Guide'

  const propertyName =
    normalizeText(
      guide.property.name
    )

  const locationLabel =
    buildLocationLabel(guide)

  const brandName =
    normalizeText(
      guide.brand.name
    )

  const logoUrl =
    normalizeText(
      guide.brand.logoUrl
    )

  const primaryLabel =
    headerState.isCompact
      ? guideTitle
      : propertyName ??
        guideTitle

  const secondaryLabel =
    showContext
      ? headerState.isCompact
        ? propertyName ??
          locationLabel ??
          brandName
        : locationLabel ??
          brandName
      : null

  return (
    <header
      data-guide-sticky-header
      data-elevated={
        headerState.isElevated
          ? 'true'
          : 'false'
      }
      data-compact={
        headerState.isCompact
          ? 'true'
          : 'false'
      }
      className={joinClassNames(
        'inset-x-0 top-16 z-40',
        fixed
          ? 'fixed'
          : 'sticky',
        'border-b',
        'transition duration-200',
        headerState.isElevated
          ? [
              'border-[color:var(--guide-border)]',
              'bg-[color:var(--guide-surface)]/95',
              'shadow-[0_10px_35px_-24px_rgba(15,23,42,0.55)]',
              'backdrop-blur-xl',
              'supports-[backdrop-filter]:bg-[color:var(--guide-surface)]/85',
            ].join(' ')
          : [
              'border-transparent',
              'bg-[color:var(--guide-background)]/90',
              'backdrop-blur-md',
              'supports-[backdrop-filter]:bg-[color:var(--guide-background)]/75',
            ].join(' '),
        className
      )}
    >
      <nav
        aria-label={ariaLabel}
        className={[
          'mx-auto flex',
          'min-h-16 w-full',
          'max-w-7xl',
          'items-center',
          'justify-between',
          'gap-3',
          'px-4',
          'sm:px-6',
          'lg:px-8',
        ].join(' ')}
      >
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={handleScrollToTop}
            aria-label="Return to the top of the guide"
            className={[
              'group flex min-w-0',
              'items-center gap-3',
              'rounded-xl',
              'text-left',
              'focus-visible:outline-none',
              'focus-visible:ring-2',
              'focus-visible:ring-[color:var(--guide-primary)]',
              'focus-visible:ring-offset-2',
              'focus-visible:ring-offset-[color:var(--guide-background)]',
            ].join(' ')}
          >
            {showLogo ? (
              <HeaderLogo
                logoUrl={logoUrl}
                brandName={brandName}
              />
            ) : null}

            <span className="min-w-0">
              <span
                className={[
                  'block truncate',
                  'text-sm font-semibold',
                  'tracking-[-0.015em]',
                  'text-[color:var(--guide-text)]',
                  'sm:text-base',
                ].join(' ')}
              >
                {primaryLabel}
              </span>

              {secondaryLabel &&
              secondaryLabel !==
                primaryLabel ? (
                <span
                  className={[
                    'mt-0.5 block',
                    'max-w-[14rem] truncate',
                    'text-xs',
                    'text-[color:var(--guide-muted-text)]',
                    'sm:max-w-[24rem]',
                  ].join(' ')}
                >
                  {secondaryLabel}
                </span>
              ) : null}
            </span>
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {showBackToTop &&
          headerState.isElevated ? (
            <button
              type="button"
              onClick={handleScrollToTop}
              aria-label="Back to top"
              className={[
                'hidden h-10 w-10',
                'items-center justify-center',
                'rounded-full',
                'border border-[color:var(--guide-border)]',
                'bg-[color:var(--guide-surface)]',
                'text-[color:var(--guide-muted-text)]',
                'transition',
                'hover:border-[color:var(--guide-primary)]',
                'hover:text-[color:var(--guide-primary)]',
                'focus-visible:outline-none',
                'focus-visible:ring-2',
                'focus-visible:ring-[color:var(--guide-primary)]',
                'focus-visible:ring-offset-2',
                'focus-visible:ring-offset-[color:var(--guide-background)]',
                'sm:inline-flex',
              ].join(' ')}
            >
              <ArrowUpIcon />
            </button>
          ) : null}

          {resolvedPrimaryAction ? (
            <HeaderActionLink
              action={
                resolvedPrimaryAction
              }
            />
          ) : null}
        </div>
      </nav>
    </header>
  )
}

/* ------------------------------------------------ */
/* Header logo                                      */
/* ------------------------------------------------ */

function HeaderLogo({
  logoUrl,
  brandName,
}: {
  logoUrl: string | null
  brandName: string | null
}) {
  if (logoUrl) {
    return (
      <span
        className={[
          'flex h-10 w-10',
          'shrink-0 items-center',
          'justify-center',
          'overflow-hidden',
          'rounded-xl',
          'border border-[color:var(--guide-border)]',
          'bg-white',
          'shadow-sm',
        ].join(' ')}
      >
        <img
          src={logoUrl}
          alt={
            brandName
              ? `${brandName} logo`
              : 'Guide logo'
          }
          className={[
            'h-full w-full',
            'object-contain',
            'p-1.5',
          ].join(' ')}
        />
      </span>
    )
  }

  return (
    <span
      aria-hidden="true"
      className={[
        'flex h-10 w-10',
        'shrink-0 items-center',
        'justify-center',
        'rounded-xl',
        'bg-[color:var(--guide-primary)]',
        'text-[color:var(--guide-button-text)]',
        'shadow-sm',
      ].join(' ')}
    >
      <CompassIcon />
    </span>
  )
}

/* ------------------------------------------------ */
/* Primary action                                   */
/* ------------------------------------------------ */

function HeaderActionLink({
  action,
}: {
  action: GuideStickyHeaderAction
}) {
  const isExternal =
    action.external === true ||
    isExternalHref(action.href)

  return (
    <a
      href={action.href}
      aria-label={
        action.ariaLabel
      }
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
      onClick={(event) => {
        if (
          !isExternal &&
          action.href.startsWith('#')
        ) {
          handleAnchorClick({
            event,
            href: action.href,
          })
        }
      }}
      className={[
        'inline-flex min-h-10',
        'items-center justify-center',
        'gap-2 rounded-full',
        'bg-[color:var(--guide-primary)]',
        'px-4 py-2',
        'text-sm font-semibold',
        'text-[color:var(--guide-button-text)]',
        'shadow-sm',
        'transition',
        'hover:-translate-y-0.5',
        'hover:brightness-105',
        'focus-visible:outline-none',
        'focus-visible:ring-2',
        'focus-visible:ring-[color:var(--guide-primary)]',
        'focus-visible:ring-offset-2',
        'focus-visible:ring-offset-[color:var(--guide-background)]',
      ].join(' ')}
    >
      {action.icon ? (
        <span
          aria-hidden="true"
          className={[
            'flex h-4 w-4',
            'shrink-0 items-center',
            'justify-center',
          ].join(' ')}
        >
          {action.icon}
        </span>
      ) : null}

      <span className="hidden sm:inline">
        {action.label}
      </span>

      <span
        className="sm:hidden"
        aria-hidden="true"
      >
        {action.icon ? null : (
          <ExploreIcon />
        )}
      </span>

      <span
        className="sr-only sm:hidden"
      >
        {action.label}
      </span>

      {isExternal ? (
        <span
          aria-hidden="true"
          className="hidden text-xs opacity-75 sm:inline"
        >
          ↗
        </span>
      ) : null}
    </a>
  )
}

/* ------------------------------------------------ */
/* Action derivation                                */
/* ------------------------------------------------ */

function derivePrimaryAction(
  guide: GuideConfig
): GuideStickyHeaderAction | null {
  const visibleSectionKeys =
    new Set(
      guide.sections
        .filter(
          (section) =>
            section.isVisible
        )
        .map(
          (section) =>
            section.key
        )
    )

  if (
    guide.showPropertyFavorites &&
    visibleSectionKeys.has(
      'favorites'
    ) &&
    guide.featuredVenues.some(
      (featuredVenue) =>
        featuredVenue.isVisible &&
        featuredVenue.venue != null
    )
  ) {
    return {
      label: 'Explore favorites',
      href: getGuideSectionAnchor(
        'favorites'
      ),
      icon: <HeartIcon />,
    }
  }

  if (
    guide.showSuggestedRoutes &&
    visibleSectionKeys.has(
      'suggested_routes'
    )
  ) {
    return {
      label: 'View routes',
      href: getGuideSectionAnchor(
        'suggested_routes'
      ),
      icon: <RouteIcon />,
    }
  }

  if (
    guide.showNearbyEvents &&
    visibleSectionKeys.has(
      'events'
    )
  ) {
    return {
      label: 'View events',
      href: getGuideSectionAnchor(
        'events'
      ),
      icon: <CalendarIcon />,
    }
  }

  if (
    visibleSectionKeys.has('map')
  ) {
    return {
      label: 'Open map',
      href: getGuideSectionAnchor(
        'map'
      ),
      icon: <MapIcon />,
    }
  }

  const firstVisibleSection =
    [...guide.sections]
      .filter(
        (section) =>
          section.isVisible &&
          section.key !== 'welcome'
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
      })[0]

  if (!firstVisibleSection) {
    return null
  }

  return {
    label: 'Explore guide',
    href: getGuideSectionAnchor(
      firstVisibleSection.key
    ),
    icon: <ExploreIcon />,
  }
}

/* ------------------------------------------------ */
/* Scroll behavior                                  */
/* ------------------------------------------------ */

function handleScrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: prefersReducedMotion()
      ? 'auto'
      : 'smooth',
  })

  window.history.replaceState(
    null,
    '',
    `${window.location.pathname}${window.location.search}`
  )
}

function handleAnchorClick({
  event,
  href,
}: {
  event: React.MouseEvent<
    HTMLAnchorElement
  >
  href: string
}) {
  const id =
    getAnchorId(href)

  if (!id) {
    return
  }

  const element =
    document.getElementById(id)

  if (!element) {
    return
  }

  event.preventDefault()

  element.scrollIntoView({
    behavior: prefersReducedMotion()
      ? 'auto'
      : 'smooth',
    block: 'start',
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

function buildLocationLabel(
  guide: GuideConfig
): string | null {
  const city =
    normalizeText(
      guide.property.city
    )

  const address =
    normalizeText(
      guide.property.address
    )

  if (city && address) {
    return `${city} · ${address}`
  }

  return city ?? address
}

function getGuideSectionAnchor(
  sectionKey: string
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

function normalizeNonNegativeInteger(
  value: number,
  fallback: number
): number {
  if (!Number.isFinite(value)) {
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

/* ------------------------------------------------ */
/* Icons                                            */
/* ------------------------------------------------ */

function CompassIcon() {
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
      <circle
        cx="12"
        cy="12"
        r="9"
      />
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
    </svg>
  )
}

function ArrowUpIcon() {
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
      <path d="m6 10 6-6 6 6" />
      <path d="M12 4v16" />
    </svg>
  )
}

function HeartIcon() {
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
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
    </svg>
  )
}

function RouteIcon() {
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
        cx="6"
        cy="19"
        r="2"
      />
      <circle
        cx="18"
        cy="5"
        r="2"
      />
      <path d="M8 19h3a4 4 0 0 0 4-4v-2a4 4 0 0 1 4-4" />
    </svg>
  )
}

function CalendarIcon() {
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
      width="17"
      height="17"
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

function ExploreIcon() {
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
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  )
}