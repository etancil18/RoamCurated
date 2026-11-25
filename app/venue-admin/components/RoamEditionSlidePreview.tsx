
'use client'

import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import Image from 'next/image'

import CollectionEndCardGenerator from '@/components/profile/creator/collections/CollectionEndCardGenerator'

import {
  getCityLabel,
} from '@/lib/cities/normalizeCity'

type EditorialEdition = {
  id: string
  title: string
  subtitle: string | null
  city: string | null
  theme_key: string | null
  status: string
  design_settings?: Record<string, unknown> | null
}

type EditionItem = {
  id: string
  venue_id: string
  position: number
  display_title: string | null
  editorial_blurb: string | null
  badge: string | null
  image_override_url: string | null
  venue_name: string
  venue_city: string | null
  venue_cover_url: string | null
  venue_description: string | null
  image_url: string | null
}

type Attribution = {
  credit_mode:
    | 'creator_edit'
    | 'roam_x_creator'
    | 'roam_selects'
  creator_permission_status:
    | 'not_requested'
    | 'approved'
    | 'declined'
  creator: {
    username: string | null
    full_name: string | null
  } | null
  source_collection: {
    title: string
  } | null
}

// =====================================================
// CONTEXT SLIDES — ADDITIVE TYPES
// =====================================================

type ContextSlide = {
  id: string
  after_item_id: string
  position: number
  heading: string | null
  body: string
  image_source: 'none' | 'venue_cover' | 'creator_media'
  creator_media_id: string | null
  image_url: string | null
}

type Slide =
  | {
      kind: 'cover'
      id: string
    }
  | {
      kind: 'venue'
      id: string
      item: EditionItem
      venueNumber: number
    }
  | {
      kind: 'context'
      id: string
      context: ContextSlide
      venue: EditionItem
    }
  | {
      kind: 'closing'
      id: string
    }

type Props = {
  editionId: string
}

// =====================================================
// SOCIAL EXPORT — PLATFORM PRESETS
// =====================================================

type ExportPreset = 'instagram' | 'tiktok'

const EXPORT_PRESETS = {
  instagram: {
    width: 1080,
    height: 1350,
    label: 'Instagram · 4:5',
  },
  tiktok: {
    width: 1080,
    height: 1920,
    label: 'TikTok · 9:16',
  },
} as const

// =====================================================
// CONTEXT SLIDES — PRODUCTION-MATCHED SEQUENCE
//
// One saved context record creates exactly one slide.
//
// No text pagination here. This matches the published
// RoamEditionReader sequence for both social presets:
//
// Cover → Venue → Context(s) → Venue → Closing
// =====================================================

function buildSlides(
  items: EditionItem[],
  contexts: ContextSlide[],
): Slide[] {
  const orderedItems = [...items].sort(
    (a, b) =>
      a.position - b.position ||
      a.id.localeCompare(b.id),
  )

  const contextsByItem = new Map<
    string,
    ContextSlide[]
  >()

  for (const context of contexts) {
    const existing =
      contextsByItem.get(context.after_item_id) ?? []

    existing.push(context)

    contextsByItem.set(
      context.after_item_id,
      existing,
    )
  }

  for (const group of contextsByItem.values()) {
    group.sort(
      (a, b) =>
        a.position - b.position ||
        a.id.localeCompare(b.id),
    )
  }

  const slides: Slide[] = [
    { kind: 'cover', id: 'cover' },
  ]

  orderedItems.forEach((item, index) => {
    slides.push({
      kind: 'venue',
      id: item.id,
      item,
      venueNumber: index + 1,
    })

    for (
      const context of
      contextsByItem.get(item.id) ?? []
    ) {
      slides.push({
        kind: 'context',
        id: `context-${context.id}`,
        context,
        venue: item,
      })
    }
  })

  slides.push({
    kind: 'closing',
    id: 'closing',
  })

  return slides
}

// =====================================================
// COVER & CLOSING — EDITORIAL COLOR PALETTES
// =====================================================

const EDITORIAL_PALETTE_STYLES = {
  midnight_navy: {
    coverBackground:
      'radial-gradient(ellipse at 70% 15%, #49647d 0%, #182f47 40%, #081729 100%)',
    coverEyebrow: '#bed9e9',
    closingBackground: '#e7e1d5',
    closingText: '#102337',
    closingMuted: '#496477',
    closingDivider: 'rgba(16, 35, 55, 0.2)',
  },
  after_hours: {
    coverBackground:
      'radial-gradient(ellipse at 70% 15%, #793f4c 0%, #421f2a 45%, #220f19 100%)',
    coverEyebrow: '#e6b99c',
    closingBackground: '#f0dfd3',
    closingText: '#421f2a',
    closingMuted: '#793f4c',
    closingDivider: 'rgba(66, 31, 42, 0.2)',
  },
  olive_oak: {
    coverBackground:
      'radial-gradient(ellipse at 70% 15%, #667259 0%, #233d32 45%, #10241d 100%)',
    coverEyebrow: '#dfc7a6',
    closingBackground: '#f4ead8',
    closingText: '#233d32',
    closingMuted: '#667259',
    closingDivider: 'rgba(35, 61, 50, 0.2)',
  },
  golden_hour: {
    coverBackground:
      'radial-gradient(ellipse at 70% 15%, #bb7954 0%, #70412f 45%, #382016 100%)',
    coverEyebrow: '#ffd6a6',
    closingBackground: '#fff0d9',
    closingText: '#70412f',
    closingMuted: '#99634a',
    closingDivider: 'rgba(112, 65, 47, 0.2)',
  },
  noir_champagne: {
    coverBackground:
      'radial-gradient(ellipse at 70% 15%, #5f5859 0%, #28272d 45%, #141318 100%)',
    coverEyebrow: '#d2ab86',
    closingBackground: '#f2eee7',
    closingText: '#28272d',
    closingMuted: '#5f5859',
    closingDivider: 'rgba(40, 39, 45, 0.2)',
  },
  winter_blue: {
    coverBackground:
      'radial-gradient(ellipse at 70% 15%, #7798a8 0%, #263b50 45%, #112234 100%)',
    coverEyebrow: '#c5dee6',
    closingBackground: '#edf3f1',
    closingText: '#263b50',
    closingMuted: '#627f90',
    closingDivider: 'rgba(38, 59, 80, 0.2)',
  },
} as const

type EditorialPalette =
  keyof typeof EDITORIAL_PALETTE_STYLES

function getEditionPalette(
  edition: EditorialEdition | null,
): EditorialPalette {
  const value = edition?.design_settings?.palette

  if (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(
      EDITORIAL_PALETTE_STYLES,
      value,
    )
  ) {
    return value as EditorialPalette
  }

  return 'midnight_navy'
}

// =====================================================
// PNG EXPORT — VERIFIED SERVER MANIFEST
// =====================================================

type ManifestSlide =
  | {
      kind: 'cover'
      id: string
    }
  | {
      kind: 'venue'
      id: string
      item_id: string
    }
  | {
      kind: 'context'
      id: string
      context_id: string
      item_id: string
      page_number?: number
      page_count?: number
      body: string
    }
  | {
      kind: 'closing'
      id: string
    }

type ExportManifest = {
  edition_id: string
  width: number
  height: number
  format: string
  slide_count: number
  permission_verified: boolean
  edition: EditorialEdition
  items: EditionItem[]
  context_slides: ContextSlide[]
  slides: ManifestSlide[]
  attribution: Attribution
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Unable to load slide preview.'
}

async function getJson<T>(
  url: string,
  signal: AbortSignal,
): Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
    signal,
  })

  const payload: unknown = await response
    .json()
    .catch(() => null)

  if (!response.ok) {
    if (
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      typeof payload.error === 'string'
    ) {
      throw new Error(payload.error)
    }

    throw new Error(
      `Request failed (${response.status}).`,
    )
  }

  return payload as T
}

function creditLabel(
  attribution: Attribution | null,
): string {
  if (!attribution?.creator) {
    return 'Curated by Roam'
  }

  const creatorName =
    attribution.creator.username
      ? `@${attribution.creator.username}`
      : attribution.creator.full_name || 'Roam creator'

  switch (attribution.credit_mode) {
    case 'creator_edit':
      return `A creator edit by ${creatorName}`

    case 'roam_x_creator':
      return `Roam × ${creatorName}`

    case 'roam_selects':
    default:
      return `Roam Selects · Featuring ${creatorName}`
  }
}

// =====================================================
// OPTION C — MAGAZINE-STYLE VENUE EXCERPT
// =====================================================

function venueExcerpt(item: EditionItem): string | null {
  const source =
    item.editorial_blurb?.trim() ||
    item.venue_description?.trim()

  if (!source) return null

  const words = source.replace(/\s+/g, ' ').split(' ')
  const maxWords = 22

  if (words.length <= maxWords) {
    return words.join(' ')
  }

  return `${words.slice(0, maxWords).join(' ').replace(/[.,;:!?…]+$/, '')}…`
}

// =====================================================
// ROAM BRANDING — COPPER R EMBLEM
// =====================================================

function RoamEmblem({
  className = '',
  decorative = false,
}: {
  className?: string
  decorative?: boolean
}) {
  return (
    <Image
      src="/branding/logo-transparent.png"
      alt={decorative ? '' : 'Roam'}
      width={1024}
      height={1024}
      className={className}
      draggable={false}
      unoptimized
    />
  )
}

// =====================================================
// PNG EXPORT — WAIT FOR SLIDE RENDER
// =====================================================

function waitForSlidePaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve())
    })
  })
}

async function waitForSlideImages(
  element: HTMLElement,
): Promise<void> {
  const images = Array.from(
    element.querySelectorAll('img'),
  )

  await Promise.all(
    images.map(async (image) => {
      if (image.complete && image.naturalWidth > 0) {
        return
      }

      await image.decode()
    }),
  )
}

// =====================================================
// PNG EXPORT — EMBED VENUE PHOTOGRAPH FOR CAPTURE
//
// CSS background images can display normally in the
// browser while failing to embed through html-to-image.
//
// Only venue slides with an assigned photograph use
// this helper. The original inline background style
// is restored after PNG capture.
//
// No saved image URLs or preview data are modified.
// =====================================================

async function prepareVenueImageForExport(
  slideElement: HTMLElement,
  item: EditionItem,
): Promise<() => void> {
  const imageUrl =
    item.image_override_url ||
    item.venue_cover_url ||
    item.image_url

  // Preserve the existing designed fallback for
  // venues without an assigned photograph.
  if (!imageUrl) {
    return () => {}
  }

  const backgroundElement =
    slideElement.querySelector<HTMLElement>(
      '.bg-cover.bg-center',
    )

  const venueName =
    item.display_title ||
    item.venue_name

  if (!backgroundElement) {
    throw new Error(
      `Unable to export "${venueName}": the venue photo element was not found.`,
    )
  }

  const originalBackgroundImage =
    backgroundElement.style.backgroundImage

  try {
    // Fetch the exact image chosen by the existing
    // venue-slide rendering priority.
    const response = await fetch(imageUrl, {
      method: 'GET',
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error(
        `Image request failed (${response.status}).`,
      )
    }

    const blob = await response.blob()

    if (
      !blob.type.startsWith('image/') ||
      blob.size === 0
    ) {
      throw new Error(
        'The image URL did not return valid image data.',
      )
    }

    // Convert the image to an inline data URL so
    // html-to-image does not need to refetch the
    // original CSS background image.
    const dataUrl = await new Promise<string>(
      (resolve, reject) => {
        const reader = new FileReader()

        reader.onload = () => {
          if (
            typeof reader.result !== 'string' ||
            !reader.result.startsWith('data:image/')
          ) {
            reject(
              new Error(
                'The venue photograph could not be embedded.',
              ),
            )

            return
          }

          resolve(reader.result)
        }

        reader.onerror = () => {
          reject(
            reader.error ??
              new Error(
                'The venue photograph could not be read.',
              ),
          )
        }

        reader.readAsDataURL(blob)
      },
    )

    // Verify decoding before allowing capture.
    const image = new window.Image()

    image.src = dataUrl

    await image.decode()

    if (
      image.naturalWidth === 0 ||
      image.naturalHeight === 0
    ) {
      throw new Error(
        'The venue photograph has invalid dimensions.',
      )
    }

    // Replace only the live DOM style being captured.
    // React state, venue data, and saved URLs stay intact.
    backgroundElement.style.backgroundImage =
      `url("${dataUrl}")`

    await waitForSlidePaint()

    // The caller restores this in a finally block.
    return () => {
      backgroundElement.style.backgroundImage =
        originalBackgroundImage
    }
  } catch (error) {
    // Protect the preview even if preparation fails.
    backgroundElement.style.backgroundImage =
      originalBackgroundImage

    throw new Error(
      `Unable to export "${venueName}" with its photograph: ${errorMessage(error)}`,
    )
  }
}

// =====================================================
// CONTEXT SLIDES — IMAGE SELECTION
//
// Text-only contexts have no background image.
// Venue-cover contexts use the canonical venue cover.
// Creator-photo contexts use only the eligible image URL
// returned by the context API, falling back to the cover.
// =====================================================

function contextImageUrl(
  context: ContextSlide,
  venue: EditionItem,
): string | null {
  if (context.image_source === 'none') {
    return null
  }

  if (context.image_source === 'venue_cover') {
    return venue.venue_cover_url
  }

  return (
    context.image_url ||
    venue.venue_cover_url
  )
}

function contextBackgroundItem(
  slide: Extract<Slide, { kind: 'context' }>,
): EditionItem | null {
  const imageUrl = contextImageUrl(
    slide.context,
    slide.venue,
  )

  if (!imageUrl) {
    return null
  }

  // Reuse the original image embedding helper without
  // modifying the saved venue or context record.
  return {
    ...slide.venue,
    image_override_url: imageUrl,
    venue_cover_url: null,
    image_url: null,
  }
}

// =====================================================
// CONTEXT SLIDES — ONE CONTEXT = ONE SOCIAL SLIDE
//
// Text can scroll in the admin preview just as it can
// in the published 4:5 reader.
//
// Static image exports cannot scroll. The exporter
// checks for overflow instead of generating extra pages
// or silently hiding written content.
// =====================================================

function ContextSocialSlide({
  slide,
  palette,
  isTikTok,
}: {
  slide: Extract<Slide, { kind: 'context' }>
  palette: typeof EDITORIAL_PALETTE_STYLES[EditorialPalette]
  isTikTok: boolean
}) {
  const imageUrl = contextImageUrl(
    slide.context,
    slide.venue,
  )

  return (
    <div
      className="absolute inset-0 overflow-hidden text-white"
      style={{
        background: imageUrl
          ? '#15283a'
          : palette.coverBackground,
      }}
    >
      {imageUrl ? (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url("${imageUrl.replace(/["\\]/g, '')}")`,
            }}
          />

          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/90" />
        </>
      ) : (
        <div
          className={[
            'pointer-events-none absolute -right-[26%] w-[110%] rotate-[-13deg] opacity-[0.12]',
            isTikTok ? 'top-[20%]' : 'top-[12%]',
          ].join(' ')}
          aria-hidden="true"
        >
          <RoamEmblem
            decorative
            className="h-auto w-full select-none object-contain"
          />
        </div>
      )}

      {/* CONTEXT LOGO — MATCH VENUE SLIDE POSITION AND SIZE */}
      <div
        className={[
          'absolute left-5 right-5 z-10 flex items-start justify-between',
          isTikTok ? 'top-[4%]' : 'top-6',
        ].join(' ')}
      >
        <RoamEmblem className="h-12 w-12 shrink-0 object-contain" />

        <span
          className="pt-2 text-right text-[9px] font-bold uppercase tracking-[0.2em]"
          style={{
            color: imageUrl
              ? 'rgba(255,255,255,0.8)'
              : palette.coverEyebrow,
          }}
        >
          A Closer Look
        </span>
      </div>

      <div
        className={[
          'absolute left-[8%] right-[8%] z-10 flex min-h-0 flex-col',
          isTikTok
            ? 'bottom-[12%] top-[25%]'
            : 'bottom-[8%] top-[24%]',
        ].join(' ')}
      >
        <p
          className="shrink-0 text-[10px] font-bold uppercase tracking-[0.18em]"
          style={{
            color: imageUrl
              ? '#e6c5a6'
              : palette.coverEyebrow,
          }}
        >
          {slide.venue.venue_name}
        </p>

        <div
          data-context-export-content="true"
          className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-y-contain pr-2 [scrollbar-width:thin]"
        >
          {slide.context.heading && (
            <h4 className="break-words font-serif text-[clamp(24px,5.7vw,43px)] font-normal leading-[1.08] tracking-[-0.035em]">
              {slide.context.heading}
            </h4>
          )}

          <div className="mt-4 h-[2px] w-10 bg-[#c68b67]" />

          <p
            className={[
              'mt-4 whitespace-pre-wrap break-words text-white/90',
              isTikTok
                ? 'text-[15px] leading-[1.65]'
                : 'text-[14px] leading-[1.55]',
            ].join(' ')}
          >
            {slide.context.body}
          </p>
        </div>
      </div>
    </div>
  )
}

// =====================================================
// CONTEXT SLIDES — STATIC EXPORT CONTENT CHECK
//
// Match production's one-slide structure, but never
// silently truncate saved text in a downloaded PNG.
// =====================================================

function ensureContextCopyFits(
  slideElement: HTMLElement,
): void {
  const content =
    slideElement.querySelector<HTMLElement>(
      '[data-context-export-content]',
    )

  if (!content) {
    throw new Error(
      'The context slide content could not be verified.',
    )
  }

  if (
    content.scrollHeight > content.clientHeight + 2 ||
    content.scrollWidth > content.clientWidth + 2
  ) {
    throw new Error(
      'This context slide contains more text than fits in a static PNG. The preview matches the published Edition, but a PNG cannot capture vertically scrolled content. Shorten the context copy before downloading.',
    )
  }
}

export default function RoamEditionSlidePreview({
  editionId,
}: Props) {
  const [edition, setEdition] =
    useState<EditorialEdition | null>(null)

  const [items, setItems] = useState<EditionItem[]>([])

  // =====================================================
  // CONTEXT SLIDES — ADDITIVE PREVIEW STATE
  // =====================================================

  const [contextSlides, setContextSlides] = useState<
    ContextSlide[]
  >([])

  const [attribution, setAttribution] =
    useState<Attribution | null>(null)

  const [activeIndex, setActiveIndex] = useState(0)
  const [refreshVersion, setRefreshVersion] = useState(0)

  const [loading, setLoading] = useState(true)
  const [error, setError] =
    useState<string | null>(null)

  // =====================================================
  // SOCIAL EXPORT — SELECTED PLATFORM
  // =====================================================

  const [exportPreset, setExportPreset] =
    useState<ExportPreset>('instagram')

  const isTikTok = exportPreset === 'tiktok'

  // =====================================================
  // PNG EXPORT — STATE AND SLIDE REFERENCE
  // =====================================================

  const slideRef = useRef<HTMLDivElement | null>(null)

  const [exporting, setExporting] = useState(false)

  const [exportNotice, setExportNotice] =
    useState<string | null>(null)

  const [exportError, setExportError] =
    useState<string | null>(null)

  const base =
    `/api/venue-admin/editorial/${encodeURIComponent(
      editionId,
    )}`

  useEffect(() => {
    const controller = new AbortController()

    async function loadPreview() {
      setLoading(true)
      setError(null)

      try {
        const [
          editionResponse,
          itemsResponse,
          attributionResponse,
          contextResponse,
        ] = await Promise.all([
          getJson<{
            edition: EditorialEdition
          }>(
            base,
            controller.signal,
          ),

          getJson<{
            items: EditionItem[]
          }>(
            `${base}/items`,
            controller.signal,
          ),

          getJson<{
            attribution: Attribution
          }>(
            `${base}/attribution`,
            controller.signal,
          ),

          getJson<{
            slides: ContextSlide[]
          }>(
            `${base}/context-slides`,
            controller.signal,
          ),
        ])

        if (controller.signal.aborted) return

        setEdition(editionResponse.edition)

        setItems(
          [...(itemsResponse.items ?? [])].sort(
            (a, b) => a.position - b.position,
          ),
        )

        setContextSlides(
          contextResponse.slides ?? [],
        )

        setAttribution(
          attributionResponse.attribution ?? null,
        )

        setActiveIndex(0)
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(errorMessage(loadError))
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadPreview()

    return () => controller.abort()
  }, [base, refreshVersion])

  // =====================================================
  // CONTEXT SLIDES — PRODUCTION-MATCHED PREVIEW
  //
  // Exactly one slide per context. Presets change the
  // composition dimensions, never the slide count.
  // =====================================================

  const slides: Slide[] = edition
    ? buildSlides(items, contextSlides)
    : []

  const slide = slides[activeIndex] ?? null

  const cityName =
    getCityLabel(edition?.city) ??
    edition?.city ??
    'Explore your city'

  const credit = creditLabel(attribution)

  // =====================================================
  // COVER & CLOSING — RESOLVE SAVED PALETTE
  // =====================================================

  const palette =
    EDITORIAL_PALETTE_STYLES[getEditionPalette(edition)]

  const canGoBack = activeIndex > 0
  const canGoForward = activeIndex < slides.length - 1

  function goToSlide(index: number) {
    if (index < 0 || index >= slides.length) return
    setActiveIndex(index)
  }

  // =====================================================
  // PNG EXPORT — CAPTURE APPROVED SLIDE MARKUP
  // =====================================================

  async function downloadCarousel() {
    if (exporting || loading || !edition) return

    const previousActiveIndex = activeIndex
    const selectedPreset = exportPreset
    const dimensions = EXPORT_PRESETS[selectedPreset]

    setExporting(true)
    setExportError(null)
    setExportNotice('Verifying export permissions…')

    try {
      // Preserve the existing Instagram endpoint behavior.
      // TikTok requests the separate 9:16 manifest.
      const exportUrl =
        selectedPreset === 'instagram'
          ? `${base}/export`
          : `${base}/export?preset=tiktok`

      const response = await fetch(exportUrl, {
        method: 'GET',
        cache: 'no-store',
      })

      const payload: {
        export?: ExportManifest
        error?: string
      } = await response.json()

      if (!response.ok) {
        throw new Error(
          payload.error ||
            `Export request failed (${response.status}).`,
        )
      }

      const manifest = payload.export

      if (
        !manifest ||
        manifest.edition_id !== editionId ||
        !manifest.permission_verified ||
        manifest.width !== dimensions.width ||
        manifest.height !== dimensions.height ||
        manifest.format !== 'png' ||
        !Array.isArray(manifest.items) ||
        !Array.isArray(manifest.context_slides) ||
        !Array.isArray(manifest.slides)
      ) {
        throw new Error(
          'The server returned an invalid export manifest for the selected platform.',
        )
      }

      // Rebuild one context per slide from the latest
      // permission-verified server data.
      const exportSlides = buildSlides(
        manifest.items,
        manifest.context_slides,
      )

      // The export route must use the same no-pagination
      // rule. Reject mismatches instead of exporting
      // the wrong slides or bypassing server verification.
      if (
        manifest.slide_count !== exportSlides.length ||
        manifest.slides.length !== exportSlides.length ||
        manifest.slides.some((serverSlide, index) => {
          const localSlide = exportSlides[index]

          if (
            serverSlide.id !== localSlide.id ||
            serverSlide.kind !== localSlide.kind
          ) {
            return true
          }

          if (
            serverSlide.kind === 'venue' &&
            localSlide.kind === 'venue'
          ) {
            return serverSlide.item_id !== localSlide.item.id
          }

          if (
            serverSlide.kind === 'context' &&
            localSlide.kind === 'context'
          ) {
            return (
              serverSlide.context_id !== localSlide.context.id ||
              serverSlide.item_id !== localSlide.venue.id ||
              serverSlide.body !== localSlide.context.body ||
              (
                serverSlide.page_number !== undefined &&
                serverSlide.page_number !== 1
              ) ||
              (
                serverSlide.page_count !== undefined &&
                serverSlide.page_count !== 1
              )
            )
          }

          return false
        })
      ) {
        throw new Error(
          'The export manifest still differs from the published Edition sequence. Update the export route to use one context record per slide.',
        )
      }

      // Dynamically load export dependencies only when
      // the user requests a download.
      const [
        { toPng },
        { default: JSZip },
      ] = await Promise.all([
        import('html-to-image'),
        import('jszip'),
      ])

      // Render the latest saved data returned by the
      // permission-verified export endpoint.
      //
      // Flush React updates so every capture reads
      // the intended slide, not the previous one.
      flushSync(() => {
        setEdition(manifest.edition)

        setItems(
          [...manifest.items].sort(
            (a, b) => a.position - b.position,
          ),
        )

        setContextSlides(
          manifest.context_slides,
        )

        setAttribution(manifest.attribution)
        setActiveIndex(0)
      })

      await waitForSlidePaint()
      await document.fonts.ready

      const zip = new JSZip()

      // PNG order matches the published sequence.
      const filenames = exportSlides.map(
        (exportSlide, index) => {
          const number = String(index + 1).padStart(
            2,
            '0',
          )

          if (exportSlide.kind === 'cover') {
            return `${number}-cover.png`
          }

          if (exportSlide.kind === 'venue') {
            return `${number}-venue.png`
          }

          if (exportSlide.kind === 'context') {
            return `${number}-context.png`
          }

          return `${number}-closing.png`
        },
      )

      for (
        let index = 0;
        index < exportSlides.length;
        index += 1
      ) {
        const exportSlide = exportSlides[index]

        setExportNotice(
          `Rendering slide ${index + 1} of ${exportSlides.length}…`,
        )

        flushSync(() => {
          setActiveIndex(index)
        })

        // Wait for the selected slide and its styles
        // to commit before capturing the DOM.
        await waitForSlidePaint()

        const slideElement = slideRef.current

        if (
          !slideElement ||
          slideElement.dataset.slideId !== exportSlide.id
        ) {
          throw new Error(
            `Slide ${index + 1} could not be rendered correctly.`,
          )
        }

        // Ensure the copper emblem has finished loading.
        await waitForSlideImages(slideElement)

        // The mixed sequence determines image selection.
        // Do not assume all intermediate slides are venues.
        const imageItem =
          exportSlide.kind === 'venue'
            ? exportSlide.item
            : exportSlide.kind === 'context'
              ? contextBackgroundItem(exportSlide)
              : null

        const restoreVenueImage = imageItem
          ? await prepareVenueImageForExport(
              slideElement,
              imageItem,
            )
          : () => {}

        let pngDataUrl: string

        try {
          if (exportSlide.kind === 'context') {
            ensureContextCopyFits(slideElement)
          }

          // Preserve the existing capture dimensions
          // and PNG generation settings.
          pngDataUrl = await toPng(slideElement, {
            canvasWidth: dimensions.width,
            canvasHeight: dimensions.height,
            pixelRatio: 1,
            cacheBust: false,
          })
        } finally {
          // Restore the original preview image.
          restoreVenueImage()
        }

        const base64 = pngDataUrl.split(',')[1]

        if (!base64) {
          throw new Error(
            `Slide ${index + 1} did not produce valid PNG data.`,
          )
        }

        zip.file(filenames[index], base64, {
          base64: true,
        })
      }

      setExportNotice('Packaging carousel ZIP…')

      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: {
          level: 6,
        },
      })

      const downloadUrl = URL.createObjectURL(zipBlob)

      try {
        const link = document.createElement('a')

        link.href = downloadUrl
        link.download =
          `roam-edition-${editionId}-${selectedPreset}-carousel.zip`

        document.body.appendChild(link)
        link.click()
        link.remove()
      } finally {
        window.setTimeout(() => {
          URL.revokeObjectURL(downloadUrl)
        }, 1000)
      }

      setExportNotice(
        `${exportSlides.length} ${dimensions.width} × ${dimensions.height} PNG slides packaged for download.`,
      )
    } catch (exportFailure) {
      setExportError(errorMessage(exportFailure))
      setExportNotice(null)
    } finally {
      // Restore the slide the administrator was viewing.
      flushSync(() => {
        setActiveIndex(
          Math.min(
            previousActiveIndex,
            Math.max(0, buildSlides(items, contextSlides).length - 1),
          ),
        )
      })

      setExporting(false)
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
            Social studio
          </p>

          <h3 className="mt-2 text-xl font-semibold text-white">
            Carousel Preview
          </h3>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Preview the edition for Instagram or TikTok.
            Slides follow the saved Places lineup,
            including context slides.
            Nothing is published here.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setRefreshVersion((version) => version + 1)
          }
          disabled={loading || exporting}
          className="min-h-10 rounded-lg border border-slate-600 px-4 text-xs font-semibold text-slate-200 transition hover:border-blue-400 disabled:opacity-50"
        >
          Refresh preview
        </button>

        {/* SOCIAL EXPORT — PLATFORM SELECTOR */}
        <label className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-300">
            Format
          </span>

          <select
            value={exportPreset}
            onChange={(event) => {
              setExportPreset(
                event.target.value as ExportPreset,
              )
              setExportError(null)
              setExportNotice(null)
            }}
            disabled={loading || exporting}
            className="min-h-10 rounded-lg border border-slate-600 bg-[#0d1b2f] px-3 text-xs font-semibold text-white outline-none focus:border-blue-400 disabled:opacity-50"
          >
            <option value="instagram">
              Instagram · 4:5
            </option>

            <option value="tiktok">
              TikTok · 9:16
            </option>
          </select>
        </label>

        {/* PNG EXPORT — DOWNLOAD CONTROL */}
        <button
          type="button"
          onClick={() => void downloadCarousel()}
          disabled={loading || exporting || !edition}
          className="min-h-10 rounded-lg bg-blue-500 px-4 text-xs font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {exporting
            ? 'Preparing download…'
            : 'Download Carousel'}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-950/20 p-3 text-sm text-red-200"
        >
          {error}
        </div>
      )}

      {/* PNG EXPORT — STATUS AND ERRORS */}
      {exportError && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-950/20 p-3 text-sm text-red-200"
        >
          {exportError}
        </div>
      )}

      {exportNotice && (
        <div
          role="status"
          className="rounded-xl border border-blue-500/30 bg-blue-950/20 p-3 text-sm text-blue-200"
        >
          {exportNotice}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">
          Preparing editorial preview…
        </p>
      ) : !edition || !slide ? (
        <p className="text-sm text-slate-400">
          The editorial preview is unavailable.
        </p>
      ) : (
        <>
          <div className="mx-auto w-full max-w-[440px]">
            {/* Instagram 4:5 / TikTok 9:16 composition */}
            <div
              ref={slideRef}
              data-slide-id={slide.id}
              className={[
                'relative w-full overflow-hidden rounded-xl border border-white/10 bg-[#11243a] text-white shadow-2xl',
                isTikTok
                  ? 'aspect-[9/16]'
                  : 'aspect-[4/5]',
              ].join(' ')}
            >
              {slide.kind === 'cover' && (
                <div
                  className="absolute inset-0 overflow-hidden bg-[radial-gradient(ellipse_at_70%_15%,#49647d_0%,#182f47_40%,#081729_100%)]"
                  style={{
                    background: palette.coverBackground,
                  }}
                >
                  {/* Cover: only the Editions label in the header */}
                  <div
                    className={[
                      'absolute left-5 right-5 z-10 flex justify-end',
                      isTikTok ? 'top-[8%]' : 'top-6',
                    ].join(' ')}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/65">
                      Editions
                    </span>
                  </div>

                  {/* Cover: prominent copper R watermark */}
                  <div
                    className={[
                      'pointer-events-none absolute -right-[24%] z-0 w-[108%] rotate-[-13deg] opacity-[0.19]',
                      isTikTok ? 'top-[20%]' : 'top-[9%]',
                    ].join(' ')}
                    aria-hidden="true"
                  >
                    <RoamEmblem
                      decorative
                      className="h-auto w-full select-none object-contain"
                    />
                  </div>

                  <div
                    className={[
                      'absolute left-[8%] right-[8%] z-10',
                      isTikTok
                        ? 'bottom-[24%]'
                        : 'bottom-[10%]',
                    ].join(' ')}
                  >
                    <p
                      className="mb-4 text-[10px] font-bold uppercase tracking-[0.26em] text-[#bed9e9]"
                      style={{
                        color: palette.coverEyebrow,
                      }}
                    >
                      {cityName} / The Roam Edit
                    </p>

                    <h4 className="max-w-[95%] break-words text-[clamp(30px,7vw,58px)] font-black leading-[0.98] tracking-[-0.055em]">
                      {edition.title}
                    </h4>

                    {edition.subtitle && (
                      <p className="mt-5 max-w-[85%] text-[clamp(12px,2.6vw,17px)] leading-relaxed text-white/75">
                        {edition.subtitle}
                      </p>
                    )}

                    <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">
                      {credit}
                    </p>
                  </div>
                </div>
              )}

              {slide.kind === 'venue' && (
                <div className="absolute inset-0 overflow-hidden bg-[#15283a]">
                  {(
                    slide.item.image_override_url ||
                    slide.item.venue_cover_url ||
                    slide.item.image_url
                  ) ? (
                    <div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{
                        backgroundImage: `url("${(
                          slide.item.image_override_url ||
                          slide.item.venue_cover_url ||
                          slide.item.image_url ||
                          ''
                        ).replace(/["\\]/g, '')}")`,
                      }}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_30%,#527083_0%,#182f43_50%,#091723_100%)]" />
                  )}

                  <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/5 to-black/90" />

                  {/* Venue: small copper R, no watermark */}
                  <div
                    className={[
                      'absolute left-5 right-5 z-10 flex items-start justify-between',
                      isTikTok ? 'top-[4%]' : 'top-6',
                    ].join(' ')}
                  >
                    <RoamEmblem className="h-12 w-12 shrink-0 object-contain" />
                  </div>

                  <div
                    className={[
                      'absolute left-[8%] z-10',
                      isTikTok
                        ? 'bottom-[8%] right-[16%]'
                        : 'bottom-[8%] right-[8%]',
                    ].join(' ')}
                  >
                    {slide.item.badge && (
                      <span className="mb-4 inline-block rounded-full bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-900">
                        {slide.item.badge}
                      </span>
                    )}

                    <h4 className="break-words text-[clamp(30px,7vw,55px)] font-black leading-[0.98] tracking-[-0.055em]">
                      {slide.item.display_title ||
                        slide.item.venue_name}
                    </h4>

                    {/* OPTION C — COPPER DIVIDER + MAGAZINE EXCERPT */}
                    {venueExcerpt(slide.item) && (
                      <>
                        <div className="mt-4 h-[2px] w-10 bg-[#c68b67]" />

                        <p className="mt-3 max-w-[95%] text-[clamp(12px,2.5vw,16px)] leading-relaxed text-white/90">
                          {venueExcerpt(slide.item)}
                        </p>
                      </>
                    )}

                    <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.2em] text-white/65">
                      {cityName} · Roam Editions
                    </p>
                  </div>
                </div>
              )}

              {/* ==========================================
                  CONTEXT SLIDE — PRODUCTION MATCH
              ========================================== */}

              {slide.kind === 'context' && (
                <ContextSocialSlide
                  slide={slide}
                  palette={palette}
                  isTikTok={isTikTok}
                />
              )}

              {slide.kind === 'closing' && (
                <div
                  className="absolute inset-0 overflow-hidden bg-[#e7e1d5] text-[#102337]"
                  style={{
                    backgroundColor: palette.closingBackground,
                    color: palette.closingText,
                  }}
                >
                  {/* Closing: oversized copper R watermark, no top-left emblem */}
                  <div
                    className={[
                      'pointer-events-none absolute -right-[30%] z-0 w-[110%] rotate-[-13deg] opacity-[0.13]',
                      isTikTok ? 'top-[24%]' : 'top-[16%]',
                    ].join(' ')}
                    aria-hidden="true"
                  >
                    <RoamEmblem
                      decorative
                      className="h-auto w-full select-none object-contain"
                    />
                  </div>

                  <div
                    className={[
                      'absolute left-[9%] right-[9%] z-10',
                      isTikTok
                        ? 'bottom-[27%]'
                        : 'bottom-[12%]',
                    ].join(' ')}
                  >
                    <p
                      className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#496477]"
                      style={{
                        color: palette.closingMuted,
                      }}
                    >
                      The end of this edit.
                      The start of your next outing.
                    </p>

                    <h4 className="mt-5 text-[clamp(34px,8vw,62px)] font-black leading-[0.95] tracking-[-0.06em]">
                      Play your
                      <span className="block">city.</span>
                    </h4>

                    <p
                      className="mt-6 text-sm font-medium text-[#496477]"
                      style={{
                        color: palette.closingMuted,
                      }}
                    >
                      {credit}
                    </p>

                    <p
                      className="mt-7 border-t border-[#102337]/20 pt-4 text-xs font-bold uppercase tracking-[0.16em]"
                      style={{
                        borderTopColor: palette.closingDivider,
                      }}
                    >
                      Do more with Roam
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-[440px] items-center justify-between gap-3">
            <button
              type="button"
              disabled={!canGoBack || exporting}
              onClick={() => goToSlide(activeIndex - 1)}
              className="min-h-10 rounded-lg border border-slate-600 px-4 text-sm font-medium text-slate-200 disabled:cursor-not-allowed disabled:opacity-35"
            >
              Previous
            </button>

            <span className="text-xs font-semibold text-slate-400">
              Slide {activeIndex + 1} of {slides.length}
            </span>

            <button
              type="button"
              disabled={!canGoForward || exporting}
              onClick={() => goToSlide(activeIndex + 1)}
              className="min-h-10 rounded-lg border border-slate-600 px-4 text-sm font-medium text-slate-200 disabled:cursor-not-allowed disabled:opacity-35"
            >
              Next
            </button>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {slides.map((item, index) => (
              <button
                key={item.id}
                type="button"
                disabled={exporting}
                onClick={() => goToSlide(index)}
                aria-label={`Show slide ${index + 1}`}
                aria-current={
                  activeIndex === index ? 'true' : undefined
                }
                className={[
                  'h-2.5 rounded-full transition-all disabled:cursor-not-allowed',
                  activeIndex === index
                    ? 'w-8 bg-blue-400'
                    : 'w-2.5 bg-slate-600 hover:bg-slate-400',
                ].join(' ')}
              />
            ))}
          </div>

          {attribution?.creator &&
            attribution.creator_permission_status !==
              'approved' && (
              <p className="mx-auto max-w-xl text-center text-xs leading-5 text-amber-200">
                Internal preview only. Promotional reuse
                permission for this creator is not currently
                recorded as approved.
              </p>
            )}

          <p className="text-center text-xs text-slate-500">
            {EXPORT_PRESETS[exportPreset].label} preview ·
            PNG export available · No publication
          </p>
        </>
      )}

      {/* STANDALONE SOCIAL END CARD — NOT PART OF CAROUSEL EXPORT */}
      {!loading && edition && (
        <CollectionEndCardGenerator
          collectionTitle={edition.title}
          creatorHandle={attribution?.creator?.username ?? null}
          editionPalette={getEditionPalette(edition)}
        />
      )}
    </section>
  )
}
