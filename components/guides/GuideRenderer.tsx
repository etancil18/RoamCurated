// components/guides/GuideRenderer.tsx

import Link from 'next/link'
import type { ReactNode } from 'react'

import GuideEventCard from '@/components/guides/GuideEventCard'
import GuideFlowCard, {
  type GuideFlowCardNearbyVenue,
} from '@/components/guides/GuideFlowCard'
import GuideSection from '@/components/guides/GuideSection'
import type { PropertyFlowSource } from '@/components/property/StartFlowButton'

import {
  getGuideCopy,
  type GuideCopy,
  type GuideCopyContext,
  type GuideCopyTone,
} from '@/lib/guides/guideCopy'

import type { PropertyCrawlCard } from '@/lib/property/buildPropertyCrawlCards'
import type { NearbyEventVM } from '@/lib/view-models/buildNearbyEventVM'

import type {
  GuideConfig,
  GuideFeaturedVenueConfig,
  GuideSectionConfig,
  GuideSectionDisplayStyle,
  GuideSectionKey,
  GuideVenueSummary,
} from '@/lib/guides/types'

/* ------------------------------------------------ */
/* Types                                            */
/* ------------------------------------------------ */

export type GuideSectionRenderContext = {
  guide: GuideConfig
  section: GuideSectionConfig
  sectionKey: GuideSectionKey
  copy: GuideCopy
  featuredVenues: GuideFeaturedVenueConfig[]
  suggestedFlows: PropertyCrawlCard[]
  nearbyEvents: NearbyEventVM[]
  nearbyVenues: GuideFlowCardNearbyVenue[]
}

export type GuideSectionRenderer = (
  context: GuideSectionRenderContext
) => ReactNode

export type GuideSectionRenderers = Partial<
  Record<GuideSectionKey, GuideSectionRenderer>
>

export type GuideRendererProps = {
  guide: GuideConfig

  /**
   * Suggested flows already loaded by getGuidePageData().
   *
   * The renderer does not generate or fetch flows.
   */
  suggestedFlows?: PropertyCrawlCard[]

  /**
   * Nearby events already loaded by getGuidePageData().
   *
   * The renderer does not load, filter, rank, or build event VMs.
   */
  nearbyEvents?: NearbyEventVM[]

  /**
   * Nearby venues already loaded by getGuidePageData().
   *
   * These are passed to GuideFlowCard as replacement candidates.
   */
  nearbyVenues?: GuideFlowCardNearbyVenue[]

  copy?: GuideCopy
  copyTone?: GuideCopyTone | null
  copyContext?: Partial<GuideCopyContext>

  sectionRenderers?: GuideSectionRenderers

  /**
   * Content rendered before all configured guide sections.
   */
  beforeSections?: ReactNode

  /**
   * Content rendered after all configured guide sections.
   */
  afterSections?: ReactNode

  /**
   * Optional content rendered inside the welcome section after its copy.
   */
  welcomeContent?: ReactNode

  /**
   * Whether sections with no built-in or supplied content should still
   * render their configured empty state.
   */
  showEmptySections?: boolean

  /**
   * Whether the renderer should use its built-in featured-venue cards.
   */
  renderFeaturedVenues?: boolean

  /**
   * Whether the renderer should use its built-in suggested-flow cards.
   */
  renderSuggestedFlows?: boolean

  /**
   * Whether the renderer should use its built-in nearby-event cards.
   */
  renderNearbyEvents?: boolean

  /**
   * Whether hidden guide sections should be included.
   * Intended for authenticated admin preview only.
   */
  includeHiddenSections?: boolean

  /**
   * Whether descriptions should render beneath suggested-flow stops.
   */
  showSuggestedFlowStopDescriptions?: boolean

  /**
   * Optional CTA-label override for all suggested flows.
   */
  suggestedFlowCtaLabel?: string

  /**
   * Source forwarded to StartFlowButton for suggested flows.
   */
  suggestedFlowSource?: PropertyFlowSource

  /**
   * Whether descriptions should render inside nearby-event cards.
   */
  showNearbyEventDescriptions?: boolean

  /**
   * Optional primary CTA-label override for all nearby events.
   */
  nearbyEventCtaLabel?: string

  /**
   * Optional section-level class names.
   */
  sectionClassNames?: Partial<Record<GuideSectionKey, string>>

  /**
   * Optional content-level class names.
   */
  sectionContentClassNames?: Partial<Record<GuideSectionKey, string>>

  className?: string
}

/* ------------------------------------------------ */
/* Constants                                        */
/* ------------------------------------------------ */

const VENUE_SECTION_KEYS = new Set<GuideSectionKey>([
  'favorites',
  'coffee',
  'dining',
  'bars',
  'wellness',
  'partner_offers',
])

const DEFAULT_SECTION_POSITION: Record<GuideSectionKey, number> = {
  welcome: 0,
  favorites: 10,
  suggested_routes: 20,
  coffee: 30,
  dining: 40,
  bars: 50,
  wellness: 60,
  events: 70,
  partner_offers: 80,
  map: 90,
  custom: 100,
}

const DEFAULT_SUGGESTED_FLOW_SOURCE: PropertyFlowSource =
  'white_label_guide_suggested_flow'

/* ------------------------------------------------ */
/* Component                                        */
/* ------------------------------------------------ */

export default function GuideRenderer({
  guide,
  suggestedFlows = [],
  nearbyEvents = [],
  nearbyVenues = [],

  copy: suppliedCopy,
  copyTone,
  copyContext,

  sectionRenderers = {},

  beforeSections,
  afterSections,
  welcomeContent,

  showEmptySections = true,
  renderFeaturedVenues = true,
  renderSuggestedFlows = true,
  renderNearbyEvents = true,
  includeHiddenSections = false,

  showSuggestedFlowStopDescriptions = true,
  suggestedFlowCtaLabel,
  suggestedFlowSource = DEFAULT_SUGGESTED_FLOW_SOURCE,

  showNearbyEventDescriptions = true,
  nearbyEventCtaLabel,

  sectionClassNames = {},
  sectionContentClassNames = {},

  className,
}: GuideRendererProps) {
  const copy =
    suppliedCopy ??
    getGuideCopy({
      mode: guide.guideMode,
      tone: copyTone,
      propertyName: guide.property.name,
      brandName: guide.brand.name,
      city: guide.property.city,
      guideTitle: guide.title,
      guideSubtitle: guide.subtitle,
      welcomeHeading: guide.welcomeHeading,
      welcomeDescription: guide.welcomeDescription,
      poweredByRoam: guide.poweredByRoam,
      ...copyContext,
    })

  const sections = getRenderableSections({
    guide,
    includeHiddenSections,
  })

  const featuredVenuesBySection =
    groupFeaturedVenuesBySection(guide.featuredVenues)

  return (
    <div
      data-guide-renderer
      className={['space-y-10 sm:space-y-12', className]
        .filter(Boolean)
        .join(' ')}
    >
      {beforeSections}

      {sections.map((section) => {
        const sectionKey = section.key
        const suppliedRenderer = sectionRenderers[sectionKey]

        const featuredVenues =
          featuredVenuesBySection.get(sectionKey) ?? []

        const renderContext: GuideSectionRenderContext = {
          guide,
          section,
          sectionKey,
          copy,
          featuredVenues,
          suggestedFlows,
          nearbyEvents,
          nearbyVenues,
        }

        const customContent = suppliedRenderer
          ? suppliedRenderer(renderContext)
          : null

        const builtInContent =
          customContent ??
          getBuiltInSectionContent({
            guide,
            section,
            sectionKey,
            featuredVenues,
            suggestedFlows,
            nearbyEvents,
            nearbyVenues,
            welcomeContent,
            renderFeaturedVenues,
            renderSuggestedFlows,
            renderNearbyEvents,
            showSuggestedFlowStopDescriptions,
            suggestedFlowCtaLabel,
            suggestedFlowSource,
            showNearbyEventDescriptions,
            nearbyEventCtaLabel,
          })

        const hasContent = hasRenderableContent(builtInContent)

        if (!hasContent && !showEmptySections) {
          return null
        }

        const displayStyle = resolveSectionDisplayStyle(section)
        const sectionCopy = copy.sections[sectionKey]

        return (
          <GuideSection
            key={section.id || sectionKey}
            sectionKey={sectionKey}
            section={section}
            copy={sectionCopy}
            copyContext={{
              mode: guide.guideMode,
              propertyName: guide.property.name,
              brandName: guide.brand.name,
              city: guide.property.city,
              guideTitle: guide.title,
              guideSubtitle: guide.subtitle,
              welcomeHeading: guide.welcomeHeading,
              welcomeDescription: guide.welcomeDescription,
              poweredByRoam: guide.poweredByRoam,
            }}
            displayStyle={displayStyle}
            itemCount={getSectionItemCount({
              sectionKey,
              featuredVenues,
              suggestedFlows,
              nearbyEvents,
              hasCustomContent: customContent !== null,
            })}
            isEmpty={!hasContent}
            contained={isContainedSection(sectionKey)}
            compact={isCompactSection(sectionKey)}
            showDivider={shouldShowDivider(sectionKey)}
            className={sectionClassNames[sectionKey]}
            contentClassName={
              sectionContentClassNames[sectionKey]
            }
          >
            {builtInContent}
          </GuideSection>
        )
      })}

      {afterSections}
    </div>
  )
}

/* ------------------------------------------------ */
/* Built-in Section Rendering                       */
/* ------------------------------------------------ */

function getBuiltInSectionContent({
  guide,
  section,
  sectionKey,
  featuredVenues,
  suggestedFlows,
  nearbyEvents,
  nearbyVenues,
  welcomeContent,
  renderFeaturedVenues,
  renderSuggestedFlows,
  renderNearbyEvents,
  showSuggestedFlowStopDescriptions,
  suggestedFlowCtaLabel,
  suggestedFlowSource,
  showNearbyEventDescriptions,
  nearbyEventCtaLabel,
}: {
  guide: GuideConfig
  section: GuideSectionConfig
  sectionKey: GuideSectionKey
  featuredVenues: GuideFeaturedVenueConfig[]
  suggestedFlows: PropertyCrawlCard[]
  nearbyEvents: NearbyEventVM[]
  nearbyVenues: GuideFlowCardNearbyVenue[]
  welcomeContent?: ReactNode
  renderFeaturedVenues: boolean
  renderSuggestedFlows: boolean
  renderNearbyEvents: boolean
  showSuggestedFlowStopDescriptions: boolean
  suggestedFlowCtaLabel?: string
  suggestedFlowSource: PropertyFlowSource
  showNearbyEventDescriptions: boolean
  nearbyEventCtaLabel?: string
}): ReactNode {
  if (sectionKey === 'welcome') {
    return (
      <GuideWelcomeContent
        guide={guide}
        additionalContent={welcomeContent}
      />
    )
  }

  if (
    sectionKey === 'suggested_routes' &&
    renderSuggestedFlows &&
    suggestedFlows.length > 0
  ) {
    return (
      <div className="grid gap-4">
        {suggestedFlows.map((flow, index) => (
          <GuideFlowCard
            key={flow.vm.id}
            property={{
              id: guide.property.id,
              name: guide.property.name,
              city: guide.property.city,
              slug: guide.property.slug,
            }}
            flow={flow}
            position={index}
            totalFlows={suggestedFlows.length}
            nearbyVenues={nearbyVenues}
            guideId={guide.id}
            guideSlug={guide.slug}
            source={suggestedFlowSource}
            ctaLabel={suggestedFlowCtaLabel}
            showStopDescriptions={
              showSuggestedFlowStopDescriptions
            }
          />
        ))}
      </div>
    )
  }

  if (
    sectionKey === 'events' &&
    renderNearbyEvents &&
    nearbyEvents.length > 0
  ) {
    return (
      <div className="grid gap-4">
        {nearbyEvents.map((event) => (
          <GuideEventCard
            key={event.id}
            event={event}
            showDescription={
              showNearbyEventDescriptions
            }
            primaryCtaLabel={nearbyEventCtaLabel}
          />
        ))}
      </div>
    )
  }

  if (
    renderFeaturedVenues &&
    VENUE_SECTION_KEYS.has(sectionKey) &&
    featuredVenues.length > 0
  ) {
    return featuredVenues.map((featuredVenue) => (
      <GuideVenueCard
        key={featuredVenue.id}
        featuredVenue={featuredVenue}
        displayStyle={resolveSectionDisplayStyle(section)}
      />
    ))
  }

  return null
}

/* ------------------------------------------------ */
/* Welcome                                          */
/* ------------------------------------------------ */

function GuideWelcomeContent({
  guide,
  additionalContent,
}: {
  guide: GuideConfig
  additionalContent?: ReactNode
}) {
  const heading =
    cleanText(guide.welcomeHeading) ||
    `Welcome to ${guide.property.name}`

  const description =
    cleanText(guide.welcomeDescription) ||
    cleanText(guide.property.welcomeDescription)

  if (!heading && !description && !additionalContent) {
    return null
  }

  return (
    <div className="space-y-5">
      <div
        className={[
          'rounded-[1.5rem]',
          'border border-[var(--guide-border)]',
          'bg-[var(--guide-surface)]',
          'p-5 shadow-sm sm:p-6',
        ].join(' ')}
      >
        <div className="max-w-3xl">
          {heading ? (
            <h3 className="text-xl font-semibold tracking-tight text-[var(--guide-text)] sm:text-2xl">
              {heading}
            </h3>
          ) : null}

          {description ? (
            <p className="mt-2 text-sm leading-6 text-[var(--guide-muted-text)] sm:text-base sm:leading-7">
              {description}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-[var(--guide-muted-text)]">
            {guide.property.city ? (
              <GuidePropertyMetaItem>
                {guide.property.city}
              </GuidePropertyMetaItem>
            ) : null}

            {guide.property.address ? (
              <GuidePropertyMetaItem>
                {guide.property.address}
              </GuidePropertyMetaItem>
            ) : null}

            {guide.property.hostName ? (
              <GuidePropertyMetaItem>
                Hosted by {guide.property.hostName}
              </GuidePropertyMetaItem>
            ) : null}
          </div>
        </div>
      </div>

      {additionalContent}
    </div>
  )
}

function GuidePropertyMetaItem({
  children,
}: {
  children: ReactNode
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--guide-accent)]"
      />

      <span>{children}</span>
    </span>
  )
}

/* ------------------------------------------------ */
/* Featured Venue Card                              */
/* ------------------------------------------------ */

function GuideVenueCard({
  featuredVenue,
  displayStyle,
}: {
  featuredVenue: GuideFeaturedVenueConfig
  displayStyle: GuideSectionDisplayStyle
}) {
  const venue = featuredVenue.venue

  if (!venue) {
    return null
  }

  const description =
    cleanText(featuredVenue.description) ||
    cleanText(featuredVenue.conciergeNote) ||
    cleanText(venue.description)

  const label = cleanText(featuredVenue.label)

  const isCarousel = displayStyle === 'carousel'
  const isCompact = displayStyle === 'compact'

  const href =
    cleanText(venue.link) ||
    `/venue-profile/${venue.id}`

  return (
    <article
      className={[
        'group overflow-hidden',
        'rounded-2xl',
        'border border-[var(--guide-border)]',
        'bg-[var(--guide-surface)]',
        'shadow-sm',
        'transition',
        'hover:-translate-y-0.5',
        'hover:border-[var(--guide-accent)]',
        'hover:shadow-lg',
        isCarousel
          ? 'w-[82vw] max-w-sm shrink-0 snap-start'
          : '',
        isCompact
          ? 'flex items-center gap-3 p-3'
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {!isCompact ? (
        <GuideVenueImage
          venue={venue}
          featured={featuredVenue.isFeatured}
        />
      ) : (
        <GuideVenueCompactImage venue={venue} />
      )}

      <div
        className={[
          'min-w-0',
          isCompact ? 'flex-1' : 'p-4 sm:p-5',
        ].join(' ')}
      >
        <div className="flex flex-wrap items-center gap-2">
          {label ? (
            <span
              className={[
                'inline-flex rounded-full',
                'border border-[var(--guide-border)]',
                'bg-[var(--guide-surface-elevated)]',
                'px-2.5 py-1',
                'text-[10px] font-bold uppercase tracking-[0.14em]',
                'text-[var(--guide-accent)]',
              ].join(' ')}
            >
              {label}
            </span>
          ) : null}

          {featuredVenue.isFeatured ? (
            <span
              className={[
                'inline-flex rounded-full',
                'bg-[var(--guide-primary)]',
                'px-2.5 py-1',
                'text-[10px] font-bold uppercase tracking-[0.14em]',
                'text-[var(--guide-button-text)]',
              ].join(' ')}
            >
              Featured
            </span>
          ) : null}
        </div>

        <Link
          href={href}
          className={[
            'mt-2 block',
            'font-semibold tracking-tight',
            'text-[var(--guide-text)]',
            'transition hover:text-[var(--guide-accent)]',
            'focus-visible:outline-none',
            'focus-visible:ring-2',
            'focus-visible:ring-[var(--guide-focus-ring)]',
            isCompact ? 'text-sm' : 'text-base sm:text-lg',
          ].join(' ')}
        >
          {venue.name}
        </Link>

        <GuideVenueMetadata venue={venue} />

        {description && !isCompact ? (
          <details className="mt-3">
            <summary
              className={[
                'cursor-pointer list-none',
                'text-xs font-semibold',
                'text-[var(--guide-accent)]',
                'underline-offset-4',
                'hover:underline',
                '[&::-webkit-details-marker]:hidden',
              ].join(' ')}
            >
              <span className="group-open:hidden">
                View Description
              </span>

              <span className="hidden group-open:inline">
                Hide Description
              </span>
            </summary>

            <p className="mt-2 text-sm leading-6 text-[var(--guide-muted-text)]">
              {description}
            </p>
          </details>
        ) : null}

        {!isCompact ? (
          <div className="mt-4">
            <Link
              href={href}
              className={[
                'inline-flex min-h-10 items-center justify-center',
                'rounded-full',
                'border border-[var(--guide-border)]',
                'bg-[var(--guide-surface-elevated)]',
                'px-4 py-2',
                'text-sm font-semibold',
                'text-[var(--guide-text)]',
                'transition',
                'hover:bg-[var(--guide-primary)]',
                'hover:text-[var(--guide-button-text)]',
                'focus-visible:outline-none',
                'focus-visible:ring-2',
                'focus-visible:ring-[var(--guide-focus-ring)]',
              ].join(' ')}
            >
              View Venue
              <span aria-hidden="true" className="ml-1.5">
                →
              </span>
            </Link>
          </div>
        ) : null}
      </div>
    </article>
  )
}

/* ------------------------------------------------ */
/* Venue Imagery                                    */
/* ------------------------------------------------ */

function GuideVenueImage({
  venue,
  featured,
}: {
  venue: GuideVenueSummary
  featured: boolean
}) {
  const cover = cleanAssetUrl(venue.cover)

  if (!cover) {
    return (
      <div
        aria-hidden="true"
        className={[
          'flex aspect-[16/10] w-full items-center justify-center',
          'bg-[var(--guide-surface-elevated)]',
          'text-3xl font-bold',
          'text-[var(--guide-accent)]',
          featured ? 'sm:aspect-[16/9]' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {getInitials(venue.name)}
      </div>
    )
  }

  return (
    <div className="aspect-[16/10] w-full overflow-hidden bg-[var(--guide-surface-elevated)]">
      <img
        src={cover}
        alt=""
        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
      />
    </div>
  )
}

function GuideVenueCompactImage({
  venue,
}: {
  venue: GuideVenueSummary
}) {
  const cover = cleanAssetUrl(venue.cover)

  if (!cover) {
    return (
      <div
        aria-hidden="true"
        className={[
          'flex h-14 w-14 shrink-0 items-center justify-center',
          'rounded-xl',
          'bg-[var(--guide-surface-elevated)]',
          'text-sm font-bold',
          'text-[var(--guide-accent)]',
        ].join(' ')}
      >
        {getInitials(venue.name)}
      </div>
    )
  }

  return (
    <img
      src={cover}
      alt=""
      className="h-14 w-14 shrink-0 rounded-xl object-cover"
    />
  )
}

/* ------------------------------------------------ */
/* Venue Metadata                                   */
/* ------------------------------------------------ */

function GuideVenueMetadata({
  venue,
}: {
  venue: GuideVenueSummary
}) {
  const typeLabel = getPrimaryVenueType(venue.type)

  const locationLabel =
    cleanText(venue.address) ||
    cleanText(venue.city)

  if (!typeLabel && !locationLabel) {
    return null
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--guide-muted-text)]">
      {typeLabel ? <span>{typeLabel}</span> : null}

      {typeLabel && locationLabel ? (
        <span
          aria-hidden="true"
          className="h-1 w-1 rounded-full bg-[var(--guide-border)]"
        />
      ) : null}

      {locationLabel ? (
        <span className="line-clamp-1">
          {locationLabel}
        </span>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------ */
/* Section Resolution                               */
/* ------------------------------------------------ */

function getRenderableSections({
  guide,
  includeHiddenSections,
}: {
  guide: GuideConfig
  includeHiddenSections: boolean
}) {
  return [...guide.sections]
    .filter((section) => {
      if (
        !includeHiddenSections &&
        !section.isVisible
      ) {
        return false
      }

      return isGuideSectionEnabled(
        guide,
        section.key
      )
    })
    .sort((a, b) => {
      const aPosition = Number.isFinite(a.position)
        ? a.position
        : DEFAULT_SECTION_POSITION[a.key]

      const bPosition = Number.isFinite(b.position)
        ? b.position
        : DEFAULT_SECTION_POSITION[b.key]

      if (aPosition !== bPosition) {
        return aPosition - bPosition
      }

      return (
        DEFAULT_SECTION_POSITION[a.key] -
        DEFAULT_SECTION_POSITION[b.key]
      )
    })
}

function isGuideSectionEnabled(
  guide: GuideConfig,
  sectionKey: GuideSectionKey
) {
  if (
    sectionKey === 'favorites' &&
    !guide.showPropertyFavorites
  ) {
    return false
  }

  if (
    sectionKey === 'suggested_routes' &&
    !guide.showSuggestedRoutes
  ) {
    return false
  }

  if (
    sectionKey === 'events' &&
    !guide.showNearbyEvents
  ) {
    return false
  }

  if (
    sectionKey === 'partner_offers' &&
    !guide.showPartnerOffers
  ) {
    return false
  }

  return true
}

function resolveSectionDisplayStyle(
  section: GuideSectionConfig
): GuideSectionDisplayStyle {
  const value = section.config?.displayStyle

  if (
    value === 'list' ||
    value === 'carousel' ||
    value === 'compact' ||
    value === 'featured' ||
    value === 'grid'
  ) {
    return value
  }

  return 'grid'
}

function groupFeaturedVenuesBySection(
  featuredVenues: GuideFeaturedVenueConfig[]
) {
  const grouped = new Map<
    GuideSectionKey,
    GuideFeaturedVenueConfig[]
  >()

  for (const featuredVenue of featuredVenues) {
    if (!featuredVenue.isVisible) {
      continue
    }

    const existing =
      grouped.get(featuredVenue.sectionKey) ?? []

    existing.push(featuredVenue)

    grouped.set(
      featuredVenue.sectionKey,
      existing
    )
  }

  for (const [sectionKey, venues] of grouped.entries()) {
    grouped.set(
      sectionKey,
      [...venues].sort((a, b) => {
        const positionDelta =
          a.position - b.position

        if (positionDelta !== 0) {
          return positionDelta
        }

        if (a.isFeatured !== b.isFeatured) {
          return a.isFeatured ? -1 : 1
        }

        return a.id.localeCompare(b.id)
      })
    )
  }

  return grouped
}

/* ------------------------------------------------ */
/* Section Presentation                             */
/* ------------------------------------------------ */

function isContainedSection(
  sectionKey: GuideSectionKey
) {
  return sectionKey === 'welcome'
}

function isCompactSection(
  sectionKey: GuideSectionKey
) {
  return sectionKey === 'partner_offers'
}

function shouldShowDivider(
  sectionKey: GuideSectionKey
) {
  return sectionKey !== 'welcome'
}

function getSectionItemCount({
  sectionKey,
  featuredVenues,
  suggestedFlows,
  nearbyEvents,
  hasCustomContent,
}: {
  sectionKey: GuideSectionKey
  featuredVenues: GuideFeaturedVenueConfig[]
  suggestedFlows: PropertyCrawlCard[]
  nearbyEvents: NearbyEventVM[]
  hasCustomContent: boolean
}) {
  if (sectionKey === 'suggested_routes') {
    return suggestedFlows.length
  }

  if (sectionKey === 'events') {
    return nearbyEvents.length
  }

  if (VENUE_SECTION_KEYS.has(sectionKey)) {
    return featuredVenues.length
  }

  if (hasCustomContent) {
    return null
  }

  return null
}

/* ------------------------------------------------ */
/* React Content Helpers                            */
/* ------------------------------------------------ */

function hasRenderableContent(
  content: ReactNode
): boolean {
  if (
    content === null ||
    content === undefined ||
    content === false
  ) {
    return false
  }

  if (Array.isArray(content)) {
    return content.some(hasRenderableContent)
  }

  if (typeof content === 'string') {
    return content.trim().length > 0
  }

  return true
}

/* ------------------------------------------------ */
/* Value Helpers                                    */
/* ------------------------------------------------ */

function getPrimaryVenueType(
  value: GuideVenueSummary['type']
) {
  if (Array.isArray(value)) {
    const first = value.find(
      (entry) =>
        typeof entry === 'string' &&
        entry.trim().length > 0
    )

    return first ? humanizeLabel(first) : null
  }

  if (typeof value === 'string') {
    const first = value
      .split(',')
      .map((entry) => entry.trim())
      .find(Boolean)

    return first ? humanizeLabel(first) : null
  }

  return null
}

function humanizeLabel(
  value: string
) {
  return value
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    )
}

function getInitials(
  value: string
) {
  const words = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) {
    return 'G'
  }

  if (words.length === 1) {
    return words[0]
      .slice(0, 2)
      .toUpperCase()
  }

  return `${words[0][0] ?? ''}${
    words[1][0] ?? ''
  }`.toUpperCase()
}

function cleanText(
  value: string | null | undefined
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  return trimmed || null
}

function cleanAssetUrl(
  value: string | null | undefined
): string | null {
  const cleaned = cleanText(value)

  if (!cleaned) {
    return null
  }

  if (
    cleaned.startsWith('/') ||
    cleaned.startsWith('https://') ||
    cleaned.startsWith('http://')
  ) {
    return cleaned
  }

  return null
}