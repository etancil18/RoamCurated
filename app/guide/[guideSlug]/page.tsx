import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import GuideHero from '@/components/guides/GuideHero'
import GuideHighlights from '@/components/guides/GuideHighlights'
import GuideQuickActions from '@/components/guides/GuideQuickActions'
import GuideRenderer from '@/components/guides/GuideRenderer'
import GuideShell from '@/components/guides/GuideShell'

import { getGuideConfig } from '@/lib/guides/getGuideConfig'
import { getGuidePageData } from '@/lib/guides/getGuidePageData'

/* ------------------------------------------------ */
/* Route Configuration                              */
/* ------------------------------------------------ */

export const revalidate = 300
export const dynamicParams = true

/* ------------------------------------------------ */
/* Types                                            */
/* ------------------------------------------------ */

type GuidePageParams = {
  guideSlug: string
}

type GuidePageProps = {
  params: Promise<GuidePageParams>
}

/* ------------------------------------------------ */
/* Metadata                                         */
/* ------------------------------------------------ */

export async function generateMetadata({
  params,
}: GuidePageProps): Promise<Metadata> {
  const { guideSlug } = await params
  const normalizedSlug =
    normalizeGuideSlug(guideSlug)

  if (!normalizedSlug) {
    return buildNotFoundMetadata()
  }

  const guideConfig =
    await getGuideConfig(normalizedSlug)

  if (!guideConfig) {
    return buildNotFoundMetadata()
  }

  const guideRecord =
    asRecord(guideConfig)

  const guide = asRecord(
    guideRecord.guide ??
      guideRecord.propertyGuide ??
      guideRecord.property_guide ??
      guideRecord
  )

  const property = asRecord(
    guideRecord.property ??
      guide.property
  )

  const brand = asRecord(
    guideRecord.brand ??
      guideRecord.guideBrand ??
      guideRecord.guide_brand ??
      guide.brand
  )

  const title =
    firstNonEmptyString(
      guide.title,
      guideRecord.title,
      property.name,
      brand.name
    ) ?? 'Local Guide'

  const subtitle =
    firstNonEmptyString(
      guide.subtitle,
      guide.welcome_description,
      guide.welcomeDescription,
      guideRecord.subtitle,
      property.welcome_description,
      property.description
    ) ??
    `Explore a curated local guide from ${title}.`

  const description =
    truncateText(subtitle, 160)

  const heroImage =
    firstNonEmptyString(
      guide.hero_image_url,
      guide.heroImageUrl,
      guideRecord.hero_image_url,
      guideRecord.heroImageUrl,
      brand.og_image_url,
      brand.ogImageUrl,
      property.cover
    ) ?? null

  const canonicalPath =
    `/guide/${encodeURIComponent(
      normalizedSlug
    )}`

  const metadata: Metadata = {
    title,
    description,

    alternates: {
      canonical: canonicalPath,
    },

    openGraph: {
      type: 'website',
      title,
      description,
      url: canonicalPath,
      siteName:
        firstNonEmptyString(
          brand.name,
          property.name
        ) ?? 'Roam',
      images: heroImage
        ? [
            {
              url:
                normalizeAssetUrl(
                  heroImage
                ),
              alt: title,
            },
          ]
        : undefined,
    },

    twitter: {
      card: heroImage
        ? 'summary_large_image'
        : 'summary',
      title,
      description,
      images: heroImage
        ? [
            normalizeAssetUrl(
              heroImage
            ),
          ]
        : undefined,
    },

    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview':
          'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
  }

  const favicon =
    firstNonEmptyString(
      brand.favicon_url,
      brand.faviconUrl
    ) ?? null

  if (favicon) {
    metadata.icons = {
      icon:
        normalizeAssetUrl(
          favicon
        ),
      shortcut:
        normalizeAssetUrl(
          favicon
        ),
    }
  }

  return metadata
}

/* ------------------------------------------------ */
/* Page                                             */
/* ------------------------------------------------ */

export default async function GuidePage({
  params,
}: GuidePageProps) {
  const { guideSlug } = await params
  const normalizedSlug =
    normalizeGuideSlug(guideSlug)

  if (!normalizedSlug) {
    notFound()
  }

  const [
    guideConfig,
    guidePageData,
  ] = await Promise.all([
    getGuideConfig(
      normalizedSlug
    ),
    getGuidePageData({
      guideSlug:
        normalizedSlug,
    }),
  ])

  if (
    !guideConfig ||
    !guidePageData
  ) {
    notFound()
  }

  const nearbyVenueCount =
    deriveNearbyVenueCount(
      guidePageData
    )

  return (
    <GuideShell
      guide={guideConfig}
      constrainContent={false}
      contentClassName="pb-0"
      innerContentClassName="w-full"
      header={{
        showLogo: true,
        showContext: true,
        showBackToTop: true,
      }}
      footer={{
        showLogo: true,
        showBackToTop: true,
        showCopyright: true,
      }}
      floatingNav={{
        showDesktopLabels: true,
        showContextLabel: true,
        position: 'bottom',
      }}
    >
      <div
        data-guide-page
        className={[
          'relative',
          'pt-16',
          'pb-12 sm:pb-16',
          'lg:pb-20',
        ].join(' ')}
      >
        <section
          aria-label="Guide introduction"
          className={[
            'mx-auto w-full',
            'max-w-7xl',
            'px-4 pt-4',
            'sm:px-6 sm:pt-6',
            'lg:px-8 lg:pt-8',
          ].join(' ')}
        >
          <GuideHero
            guide={guideConfig}
            suggestedFlows={
              guidePageData.suggestedFlows
            }
            nearbyEvents={
              guidePageData.nearbyEvents
            }
            nearbyVenueCount={
              nearbyVenueCount
            }
          />
        </section>

        <div
          className={[
            'mx-auto w-full',
            'max-w-7xl',
            'px-4 sm:px-6',
            'lg:px-8',
          ].join(' ')}
        >
          <div
            className={[
              'relative z-20',
              '-mt-2 sm:-mt-3',
              'lg:-mt-4',
            ].join(' ')}
          >
            <GuideQuickActions
              guide={guideConfig}
              suggestedFlows={
                guidePageData.suggestedFlows
              }
              nearbyEvents={
                guidePageData.nearbyEvents
              }
              nearbyVenueCount={
                nearbyVenueCount
              }
            />
          </div>

          <div
            className={[
              'mt-8 sm:mt-10',
              'lg:mt-12',
            ].join(' ')}
          >
            <GuideHighlights
              guide={guideConfig}
              suggestedFlows={
                guidePageData.suggestedFlows
              }
              nearbyEvents={
                guidePageData.nearbyEvents
              }
            />
          </div>
        </div>

        <div
          className={[
            'mx-auto mt-10 w-full',
            'max-w-7xl',
            'px-4 sm:mt-12 sm:px-6',
            'lg:mt-16 lg:px-8',
          ].join(' ')}
        >
          <GuideRenderer
            guide={guideConfig}
            suggestedFlows={
              guidePageData.suggestedFlows
            }
            nearbyEvents={
              guidePageData.nearbyEvents
            }
            sectionRenderers={{
              welcome: () => false,
            }}
            showEmptySections={false}
          />
        </div>
      </div>
    </GuideShell>
  )
}

/* ------------------------------------------------ */
/* Guide Data Helpers                               */
/* ------------------------------------------------ */

function deriveNearbyVenueCount(
  pageData: unknown
): number {
  const record =
    asRecord(pageData)

  const explicitCount =
    firstFiniteNonNegativeNumber(
      record.nearbyVenueCount,
      record.nearby_venue_count,
      record.venueCount,
      record.venue_count
    )

  if (explicitCount !== null) {
    return explicitCount
  }

  const nearbyVenues =
    firstArray(
      record.nearbyVenues,
      record.nearby_venues,
      record.venues
    )

  if (nearbyVenues) {
    return nearbyVenues.length
  }

  return 0
}

/* ------------------------------------------------ */
/* Helpers                                          */
/* ------------------------------------------------ */

function normalizeGuideSlug(
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

  let decodedValue = value

  try {
    decodedValue =
      decodeURIComponent(value)
  } catch {
    return null
  }

  const normalized =
    decodedValue
      .trim()
      .toLowerCase()

  if (
    !normalized ||
    normalized.length > 160 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
      normalized
    )
  ) {
    return null
  }

  return normalized
}

function buildNotFoundMetadata(): Metadata {
  return {
    title:
      'Guide Not Found',
    description:
      'The requested local guide could not be found or is not currently available.',
    robots: {
      index: false,
      follow: false,
    },
  }
}

function asRecord(
  value: unknown
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return {}
  }

  return value as Record<
    string,
    unknown
  >
}

function firstNonEmptyString(
  ...values: unknown[]
): string | null {
  for (const value of values) {
    if (
      typeof value === 'string' &&
      value.trim().length > 0
    ) {
      return value.trim()
    }
  }

  return null
}

function firstFiniteNonNegativeNumber(
  ...values: unknown[]
): number | null {
  for (const value of values) {
    if (
      typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= 0
    ) {
      return Math.trunc(value)
    }

    if (
      typeof value === 'string' &&
      value.trim() !== ''
    ) {
      const parsed =
        Number(value)

      if (
        Number.isFinite(parsed) &&
        parsed >= 0
      ) {
        return Math.trunc(parsed)
      }
    }
  }

  return null
}

function firstArray(
  ...values: unknown[]
): unknown[] | null {
  for (const value of values) {
    if (Array.isArray(value)) {
      return value
    }
  }

  return null
}

function truncateText(
  value: string,
  maxLength: number
): string {
  const normalized =
    value
      .replace(/\s+/g, ' ')
      .trim()

  if (
    normalized.length <=
    maxLength
  ) {
    return normalized
  }

  return `${normalized
    .slice(
      0,
      Math.max(
        0,
        maxLength - 1
      )
    )
    .trimEnd()}…`
}

function normalizeAssetUrl(
  value: string
): string {
  const normalized =
    value.trim()

  if (
    normalized.startsWith('/') ||
    normalized.startsWith(
      'https://'
    ) ||
    normalized.startsWith(
      'http://'
    )
  ) {
    return normalized
  }

  return `/${normalized}`
}