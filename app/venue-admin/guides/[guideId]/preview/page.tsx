import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import GuidePreviewToolbar from '@/components/guides/GuidePreviewToolbar'
import GuideRenderer from '@/components/guides/GuideRenderer'
import { getGuidePreviewConfig } from '@/lib/guides/getGuidePreviewConfig'
import { getGuideSuggestedFlowsData } from '@/lib/guides/getGuideSuggestedFlows'

/* ------------------------------------------------ */
/* Route Configuration                              */
/* ------------------------------------------------ */

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

/* ------------------------------------------------ */
/* Metadata                                         */
/* ------------------------------------------------ */

export const metadata: Metadata = {
  title: 'Property Guide Preview',
  description:
    'Private administrative preview of a Roam property guide.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
}

/* ------------------------------------------------ */
/* Types                                            */
/* ------------------------------------------------ */

type GuidePreviewPageProps = {
  params: Promise<{
    guideId: string
  }>
}

type GuidePreviewStyle = CSSProperties & {
  '--guide-primary-color': string
  '--guide-secondary-color': string
  '--guide-accent-color': string
  '--guide-background-color': string
  '--guide-surface-color': string
  '--guide-text-color': string
  '--guide-muted-text-color': string
  '--guide-button-text-color': string
}

/* ------------------------------------------------ */
/* Page                                             */
/* ------------------------------------------------ */

export default async function GuidePreviewPage({
  params,
}: GuidePreviewPageProps) {
  const { guideId } = await params
  const normalizedGuideId = normalizeGuideId(guideId)

  if (!normalizedGuideId) {
    notFound()
  }

  const guide = await getGuidePreviewConfig(normalizedGuideId)

  if (!guide) {
    notFound()
  }

  const suggestedFlowsData = guide.showSuggestedRoutes
    ? await getGuideSuggestedFlowsData({
        propertyId: guide.property.id,
      })
    : null

  const guidePreviewStyle: GuidePreviewStyle = {
    backgroundColor: guide.brand.backgroundColor,
    color: guide.brand.textColor,
    colorScheme: getColorScheme(guide.brand.backgroundColor),
    fontFamily: guide.brand.fontFamily ?? undefined,

    '--guide-primary-color': guide.brand.primaryColor,
    '--guide-secondary-color': guide.brand.secondaryColor,
    '--guide-accent-color': guide.brand.accentColor,
    '--guide-background-color': guide.brand.backgroundColor,
    '--guide-surface-color': guide.brand.surfaceColor,
    '--guide-text-color': guide.brand.textColor,
    '--guide-muted-text-color': guide.brand.mutedTextColor,
    '--guide-button-text-color': guide.brand.buttonTextColor,
  }

  return (
    <div className="guide-preview-page min-h-screen pt-16">
      <style>{`
        /*
         * The global navbar is fixed at 4rem / 64px.
         * Keep the preview toolbar below it while scrolling.
         */
        .guide-preview-page > div > header {
          top: 4rem;
        }

        /*
         * Isolate guide typography from app-level light/dark text rules.
         * Explicit component styles still take precedence.
         */
        .guide-preview-content {
          background-color: var(--guide-background-color);
          color: var(--guide-text-color);
        }

        .guide-preview-content :where(
          h1,
          h2,
          h3,
          h4,
          h5,
          h6,
          p,
          span,
          li,
          dt,
          dd,
          address,
          label
        ) {
          color: inherit;
        }

        .guide-preview-content a {
          color: var(--guide-primary-color);
        }

        .guide-preview-content input,
        .guide-preview-content textarea,
        .guide-preview-content select,
        .guide-preview-content button {
          font: inherit;
        }
      `}</style>

      <GuidePreviewToolbar
        guideId={guide.id}
        guideSlug={guide.slug}
        guideStatus={guide.status}
        guideTitle={guide.title}
        backHref="/venue-admin"
      >
        <div
          className="guide-preview-content min-h-screen"
          style={guidePreviewStyle}
        >
          <GuideRenderer
            guide={guide}
            suggestedFlows={suggestedFlowsData?.flows ?? []}
          />
        </div>
      </GuidePreviewToolbar>
    </div>
  )
}

/* ------------------------------------------------ */
/* Helpers                                          */
/* ------------------------------------------------ */

function normalizeGuideId(
  value: string | null | undefined
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  let decodedValue = value

  try {
    decodedValue = decodeURIComponent(value)
  } catch {
    return null
  }

  const normalized = decodedValue.trim().toLowerCase()

  if (!isUuid(normalized)) {
    return null
  }

  return normalized
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}

function getColorScheme(
  backgroundColor: string
): 'light' | 'dark' {
  const normalized = backgroundColor.trim()

  const hexMatch = normalized.match(
    /^#([0-9a-f]{6})$/i
  )

  if (!hexMatch) {
    return 'light'
  }

  const hex = hexMatch[1]

  const red = Number.parseInt(hex.slice(0, 2), 16)
  const green = Number.parseInt(hex.slice(2, 4), 16)
  const blue = Number.parseInt(hex.slice(4, 6), 16)

  const luminance =
    (0.2126 * red +
      0.7152 * green +
      0.0722 * blue) /
    255

  return luminance < 0.5 ? 'dark' : 'light'
}