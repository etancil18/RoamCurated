import type { CSSProperties, ReactNode } from 'react'

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

export type GuideHeroAction = {
  /**
   * Visible action label.
   */
  label: string

  /**
   * Destination URL or in-page section anchor.
   */
  href: string

  /**
   * Optional accessible label when the visible label
   * does not fully describe the destination.
   */
  ariaLabel?: string

  /**
   * Optional leading icon or decorative element.
   */
  icon?: ReactNode

  /**
   * Opens the action in a new browser context.
   */
  external?: boolean
}

export type GuideHeroProps = {
  guide: GuideConfig

  /**
   * Already-loaded suggested routes.
   *
   * Used only for hero availability and summary statistics.
   */
  suggestedFlows?: PropertyCrawlCard[]

  /**
   * Already-loaded nearby events.
   *
   * Used only for hero availability and summary statistics.
   */
  nearbyEvents?: NearbyEventVM[]

  /**
   * Total nearby venue inventory returned by the page loader.
   *
   * This is intentionally distinct from curated featured venues.
   */
  nearbyVenueCount?: number

  /**
   * Optional text displayed above the guide title.
   *
   * Defaults to the property location.
   */
  eyebrow?: string | null

  /**
   * Optional explicit primary action.
   *
   * When undefined, the component derives an action from the
   * first available discovery section.
   *
   * Pass null to suppress the primary action entirely.
   */
  primaryAction?: GuideHeroAction | null

  /**
   * Optional explicit secondary action.
   *
   * When undefined, the component derives the next available
   * discovery action.
   *
   * Pass null to suppress the secondary action entirely.
   */
  secondaryAction?: GuideHeroAction | null

  /**
   * Displays the guide summary statistics.
   */
  showStats?: boolean

  /**
   * Displays the configured guide-brand logo.
   */
  showLogo?: boolean

  className?: string
}

/* ------------------------------------------------ */
/* Internal contracts                               */
/* ------------------------------------------------ */

type GuideHeroStat = {
  id: string
  value: string
  label: string
}

type DerivedHeroActions = {
  primary: GuideHeroAction | null
  secondary: GuideHeroAction | null
}

type HeroStyle = CSSProperties & {
  '--guide-hero-image'?: string
}

/* ------------------------------------------------ */
/* Constants                                        */
/* ------------------------------------------------ */

const NON_DISCOVERY_SECTION_KEYS = new Set<GuideSectionKey>([
  'welcome',
  'map',
  'custom',
])

const ACTION_SECTION_PRIORITY: GuideSectionKey[] = [
  'favorites',
  'suggested_routes',
  'coffee',
  'dining',
  'bars',
  'wellness',
  'events',
  'partner_offers',
  'map',
]

const SECTION_ACTION_LABELS: Partial<
  Record<GuideSectionKey, string>
> = {
  favorites: 'Explore favorites',
  suggested_routes: 'View suggested routes',
  coffee: 'Find coffee',
  dining: 'Explore dining',
  bars: 'Discover bars',
  wellness: 'Explore wellness',
  events: 'View nearby events',
  partner_offers: 'View partner offers',
  map: 'Open the guide map',
}

/* ------------------------------------------------ */
/* Component                                        */
/* ------------------------------------------------ */

export default function GuideHero({
  guide,
  suggestedFlows = [],
  nearbyEvents = [],
  nearbyVenueCount = 0,
  eyebrow,
  primaryAction,
  secondaryAction,
  showStats = true,
  showLogo = true,
  className,
}: GuideHeroProps) {
  const visibleSections = getVisibleGuideSections(guide.sections)

  const derivedActions = deriveHeroActions({
    guide,
    visibleSections,
    suggestedFlows,
    nearbyEvents,
  })

  const resolvedPrimaryAction =
    primaryAction === undefined
      ? derivedActions.primary
      : primaryAction

  const resolvedSecondaryAction =
    secondaryAction === undefined
      ? derivedActions.secondary
      : secondaryAction

  const stats = buildHeroStats({
    guide,
    suggestedFlows,
    nearbyEvents,
    nearbyVenueCount,
    visibleSections,
  })

  const resolvedEyebrow =
    normalizeText(eyebrow) ??
    buildDefaultEyebrow(guide)

  const subtitle =
    normalizeText(guide.subtitle) ??
    normalizeText(guide.welcomeDescription) ??
    normalizeText(guide.property.welcomeDescription)

  const heroImageUrl =
    normalizeText(guide.heroImageUrl)

  const logoUrl =
    normalizeText(guide.brand.logoUrl)

  const hasActions =
    resolvedPrimaryAction !== null ||
    resolvedSecondaryAction !== null

  const hasStats =
    showStats &&
    stats.length > 0

  const heroStyle: HeroStyle | undefined =
    heroImageUrl
      ? {
          '--guide-hero-image': `url("${escapeCssUrl(
            heroImageUrl
          )}")`,
        }
      : undefined

  return (
    <section
      data-guide-hero
      aria-labelledby="guide-hero-title"
      className={joinClassNames(
        'relative isolate overflow-hidden',
        'rounded-[2rem]',
        'border border-[color:var(--guide-border)]',
        'bg-[color:var(--guide-surface)]',
        'shadow-[0_24px_80px_-40px_rgba(15,23,42,0.45)]',
        className
      )}
      style={heroStyle}
    >
      {heroImageUrl ? (
        <>
          <div
            aria-hidden="true"
            className={[
              'absolute inset-0 -z-30',
              'bg-[image:var(--guide-hero-image)]',
              'bg-cover bg-center',
            ].join(' ')}
          />

          <div
            aria-hidden="true"
            className={[
              'absolute inset-0 -z-20',
              'bg-gradient-to-r',
              'from-black/80 via-black/55 to-black/20',
            ].join(' ')}
          />

          <div
            aria-hidden="true"
            className={[
              'absolute inset-0 -z-10',
              'bg-gradient-to-t',
              'from-black/65 via-transparent to-black/10',
            ].join(' ')}
          />
        </>
      ) : (
        <>
          <div
            aria-hidden="true"
            className={[
              'absolute inset-0 -z-30',
              'bg-[color:var(--guide-primary)]',
            ].join(' ')}
          />

          <div
            aria-hidden="true"
            className={[
              'absolute inset-0 -z-20',
              'bg-gradient-to-br',
              'from-black/5 via-transparent to-black/20',
            ].join(' ')}
          />

          <div
            aria-hidden="true"
            className={[
              'absolute -right-24 -top-24 -z-10',
              'h-72 w-72 rounded-full',
              'bg-[color:var(--guide-accent)] opacity-25 blur-3xl',
            ].join(' ')}
          />
        </>
      )}

      <div
        className={[
          'relative',
          'grid min-h-[34rem]',
          'items-end gap-8',
          'px-5 py-6',
          'sm:min-h-[38rem] sm:px-8 sm:py-8',
          'lg:grid-cols-[minmax(0,1fr)_auto]',
          'lg:items-end lg:px-12 lg:py-12',
        ].join(' ')}
      >
        <div className="max-w-3xl">
          {showLogo && logoUrl ? (
            <div
              className={[
                'mb-7 inline-flex',
                'max-w-[12rem]',
                'rounded-2xl',
                'border border-white/20',
                'bg-white/90',
                'px-4 py-3',
                'shadow-lg shadow-black/10',
                'backdrop-blur',
              ].join(' ')}
            >
              <img
                src={logoUrl}
                alt={`${guide.brand.name} logo`}
                className="max-h-10 w-auto max-w-full object-contain"
              />
            </div>
          ) : null}

          {resolvedEyebrow ? (
            <p
              className={[
                'mb-4',
                'text-xs font-semibold uppercase',
                'tracking-[0.18em]',
                heroImageUrl
                  ? 'text-white/80'
                  : 'text-[color:var(--guide-button-text)]/80',
              ].join(' ')}
            >
              {resolvedEyebrow}
            </p>
          ) : null}

          <h1
            id="guide-hero-title"
            className={[
              'max-w-3xl',
              'text-balance',
              'text-4xl font-semibold',
              'leading-[0.98] tracking-[-0.045em]',
              'sm:text-5xl',
              'lg:text-6xl',
              heroImageUrl
                ? 'text-white'
                : 'text-[color:var(--guide-button-text)]',
            ].join(' ')}
          >
            {guide.title}
          </h1>

          {subtitle ? (
            <p
              className={[
                'mt-5 max-w-2xl',
                'text-pretty',
                'text-base leading-7',
                'sm:text-lg sm:leading-8',
                heroImageUrl
                  ? 'text-white/80'
                  : 'text-[color:var(--guide-button-text)]/80',
              ].join(' ')}
            >
              {subtitle}
            </p>
          ) : null}

          {hasActions ? (
            <div
              className={[
                'mt-8 flex flex-col gap-3',
                'sm:flex-row sm:flex-wrap',
              ].join(' ')}
            >
              {resolvedPrimaryAction ? (
                <GuideHeroLink
                  action={resolvedPrimaryAction}
                  variant="primary"
                />
              ) : null}

              {resolvedSecondaryAction ? (
                <GuideHeroLink
                  action={resolvedSecondaryAction}
                  variant="secondary"
                  hasImage={Boolean(heroImageUrl)}
                />
              ) : null}
            </div>
          ) : null}
        </div>

        {hasStats ? (
          <div
            aria-label="Guide summary"
            className={[
              'grid w-full',
              'grid-cols-1 gap-px overflow-hidden',
              'rounded-2xl',
              'border border-white/15',
              'bg-white/15',
              'shadow-xl shadow-black/10',
              'backdrop-blur-md',
              'sm:grid-cols-3',
              'lg:w-auto lg:min-w-[24rem]',
            ].join(' ')}
          >
            {stats.map((stat) => (
              <div
                key={stat.id}
                className={[
                  'min-w-0',
                  'bg-black/25',
                  'px-5 py-4',
                  'text-white',
                  'sm:px-6',
                ].join(' ')}
              >
                <p
                  className={[
                    'text-2xl font-semibold',
                    'leading-none tracking-[-0.03em]',
                  ].join(' ')}
                >
                  {stat.value}
                </p>

                <p
                  className={[
                    'mt-2',
                    'text-xs font-medium uppercase',
                    'tracking-[0.12em]',
                    'text-white/70',
                  ].join(' ')}
                >
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}

/* ------------------------------------------------ */
/* Action link                                      */
/* ------------------------------------------------ */

function GuideHeroLink({
  action,
  variant,
  hasImage = false,
}: {
  action: GuideHeroAction
  variant: 'primary' | 'secondary'
  hasImage?: boolean
}) {
  const isExternal =
    action.external === true ||
    isExternalHref(action.href)

  const sharedClassName = [
    'inline-flex min-h-12',
    'items-center justify-center gap-2',
    'rounded-full px-6 py-3',
    'text-sm font-semibold',
    'transition',
    'focus-visible:outline-none',
    'focus-visible:ring-2',
    'focus-visible:ring-white',
    'focus-visible:ring-offset-2',
    'focus-visible:ring-offset-black/40',
  ].join(' ')

  const variantClassName =
    variant === 'primary'
      ? [
          'bg-[color:var(--guide-accent)]',
          'text-[color:var(--guide-button-text)]',
          'shadow-lg shadow-black/15',
          'hover:-translate-y-0.5',
          'hover:brightness-105',
        ].join(' ')
      : hasImage
        ? [
            'border border-white/25',
            'bg-white/10 text-white',
            'backdrop-blur',
            'hover:bg-white/20',
          ].join(' ')
        : [
            'border border-white/25',
            'bg-black/10',
            'text-[color:var(--guide-button-text)]',
            'backdrop-blur',
            'hover:bg-black/15',
          ].join(' ')

  return (
    <a
      href={action.href}
      aria-label={action.ariaLabel}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noreferrer noopener' : undefined}
      className={`${sharedClassName} ${variantClassName}`}
    >
      {action.icon ? (
        <span
          aria-hidden="true"
          className="shrink-0"
        >
          {action.icon}
        </span>
      ) : null}

      <span>{action.label}</span>

      <span
        aria-hidden="true"
        className="text-base leading-none"
      >
        {isExternal ? '↗' : '→'}
      </span>
    </a>
  )
}

/* ------------------------------------------------ */
/* Visible-section logic                            */
/* ------------------------------------------------ */

function getVisibleGuideSections(
  sections: GuideSectionConfig[]
): GuideSectionConfig[] {
  return [...sections]
    .filter((section) => section.isVisible)
    .sort((left, right) => {
      if (left.position !== right.position) {
        return left.position - right.position
      }

      return left.key.localeCompare(right.key)
    })
}

/* ------------------------------------------------ */
/* Action derivation                                */
/* ------------------------------------------------ */

function deriveHeroActions({
  guide,
  visibleSections,
  suggestedFlows,
  nearbyEvents,
}: {
  guide: GuideConfig
  visibleSections: GuideSectionConfig[]
  suggestedFlows: PropertyCrawlCard[]
  nearbyEvents: NearbyEventVM[]
}): DerivedHeroActions {
  const availableSectionKeys = new Set(
    visibleSections
      .filter((section) =>
        sectionHasAvailableContent({
          sectionKey: section.key,
          guide,
          suggestedFlows,
          nearbyEvents,
        })
      )
      .map((section) => section.key)
  )

  const prioritizedKeys =
    ACTION_SECTION_PRIORITY.filter((key) =>
      availableSectionKeys.has(key)
    )

  const primaryKey =
    prioritizedKeys[0] ?? null

  const secondaryKey =
    prioritizedKeys.find(
      (key) => key !== primaryKey
    ) ?? null

  return {
    primary: primaryKey
      ? createSectionAction(primaryKey)
      : null,

    secondary: secondaryKey
      ? createSectionAction(secondaryKey)
      : null,
  }
}

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
    case 'custom':
      return true

    default:
      return assertUnreachable(sectionKey)
  }
}

function createSectionAction(
  sectionKey: GuideSectionKey
): GuideHeroAction {
  return {
    label:
      SECTION_ACTION_LABELS[sectionKey] ??
      'Explore the guide',

    href: getGuideSectionAnchor(sectionKey),
  }
}

/* ------------------------------------------------ */
/* Hero statistics                                  */
/* ------------------------------------------------ */

function buildHeroStats({
  guide,
  suggestedFlows,
  nearbyEvents,
  nearbyVenueCount,
  visibleSections,
}: {
  guide: GuideConfig
  suggestedFlows: PropertyCrawlCard[]
  nearbyEvents: NearbyEventVM[]
  nearbyVenueCount: number
  visibleSections: GuideSectionConfig[]
}): GuideHeroStat[] {
  const visibleSectionKeys = new Set(
    visibleSections.map((section) => section.key)
  )

  const visibleFeaturedVenueCount =
    guide.featuredVenues.filter(
      (featuredVenue) =>
        featuredVenue.isVisible &&
        featuredVenue.venue != null &&
        visibleSectionKeys.has(featuredVenue.sectionKey)
    ).length

  const normalizedNearbyVenueCount =
    Number.isFinite(nearbyVenueCount)
      ? Math.max(
          0,
          Math.trunc(nearbyVenueCount)
        )
      : 0

  const discoveryVenueCount = Math.max(
    visibleFeaturedVenueCount,
    normalizedNearbyVenueCount
  )

  const stats: GuideHeroStat[] = []

  if (discoveryVenueCount > 0) {
    stats.push({
      id: 'venues',
      value: formatCount(discoveryVenueCount),
      label:
        discoveryVenueCount === 1
          ? 'Nearby venue'
          : 'Nearby venues',
    })
  }

  if (
    guide.showSuggestedRoutes &&
    visibleSectionKeys.has('suggested_routes') &&
    suggestedFlows.length > 0
  ) {
    stats.push({
      id: 'routes',
      value: formatCount(suggestedFlows.length),
      label:
        suggestedFlows.length === 1
          ? 'Suggested route'
          : 'Suggested routes',
    })
  }

  if (
    guide.showNearbyEvents &&
    visibleSectionKeys.has('events') &&
    nearbyEvents.length > 0
  ) {
    stats.push({
      id: 'events',
      value: formatCount(nearbyEvents.length),
      label:
        nearbyEvents.length === 1
          ? 'Nearby event'
          : 'Nearby events',
    })
  }

  const discoverySectionCount =
    visibleSections.filter(
      (section) =>
        !NON_DISCOVERY_SECTION_KEYS.has(
          section.key
        )
    ).length

  if (
    stats.length < 3 &&
    discoverySectionCount > 0
  ) {
    stats.push({
      id: 'categories',
      value: formatCount(
        discoverySectionCount
      ),
      label:
        discoverySectionCount === 1
          ? 'Guide category'
          : 'Guide categories',
    })
  }

  return stats.slice(0, 3)
}

/* ------------------------------------------------ */
/* Display helpers                                  */
/* ------------------------------------------------ */

function buildDefaultEyebrow(
  guide: GuideConfig
): string | null {
  const location =
    normalizeText(guide.property.city) ??
    normalizeText(guide.property.address)

  return (
    location ??
    normalizeText(guide.brand.name)
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

function formatCount(
  count: number
): string {
  return new Intl.NumberFormat('en-US', {
    notation:
      count >= 1000
        ? 'compact'
        : 'standard',
    maximumFractionDigits: 1,
  }).format(count)
}

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

function isExternalHref(
  href: string
): boolean {
  return (
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('//')
  )
}

function escapeCssUrl(
  value: string
): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('\n', '')
    .replaceAll('\r', '')
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