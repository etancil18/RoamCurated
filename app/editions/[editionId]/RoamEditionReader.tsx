
'use client'

import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from 'react'

import type {
  PublicEditionDetail,
  PublicEditionItem,
  PublicEditionContextSlide,
} from '@/lib/editorial/publicEditions'

// ============================================================
// ROAM EDITIONS — PUBLIC INTERACTIVE READER
//
// - Mobile touch swiping
// - Desktop trackpad horizontal scrolling
// - Desktop click-and-drag navigation
// - Keyboard navigation
// - Live slide counter and progress
// - Slide restoration after visiting a venue
// - Canonical venue-profile links
// - Existing editorial palettes and slide designs
//
// CONTEXT SLIDES — ADDITIVE INITIATIVE
//
// - Venue-linked context slides appear after each venue
// - Text-only, venue-cover, and eligible creator photography
// - Long-form context remains readable within each slide
// - Failed context photography falls back safely
// - Venue numbering stays independent of slide numbering
// - Stable slide-ID restoration supports mixed sequences
//
// No additional carousel dependency required.
// ============================================================

type Props = {
  edition: PublicEditionDetail
}

type Slide =
  | {
      kind: 'cover'
      id: string
    }
  | {
      kind: 'venue'
      id: string
      item: PublicEditionItem
      venueNumber: number
    }
  | {
      kind: 'context'
      id: string
      context: PublicEditionContextSlide
      venue: PublicEditionItem
    }
  | {
      kind: 'closing'
      id: string
    }

// ============================================================
// COVER & CLOSING — EXISTING EDITORIAL PALETTES
// ============================================================

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

function getEditionPalette(edition: PublicEditionDetail) {
  const value = edition.design_settings?.palette

  if (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(
      EDITORIAL_PALETTE_STYLES,
      value,
    )
  ) {
    return EDITORIAL_PALETTE_STYLES[
      value as EditorialPalette
    ]
  }

  return EDITORIAL_PALETTE_STYLES.midnight_navy
}

// ============================================================
// EXISTING EDITORIAL CREDIT FORMAT
// ============================================================

function getCreatorCredit(
  edition: PublicEditionDetail,
): string {
  if (
    edition.credit_mode === 'roam_selects' ||
    !edition.creator
  ) {
    return 'A Roam Edit'
  }

  const creatorName =
    edition.creator.full_name?.trim() ||
    (edition.creator.username
      ? `@${edition.creator.username}`
      : null)

  if (!creatorName) {
    return 'A Roam Edit'
  }

  if (edition.credit_mode === 'creator_edit') {
    return `A Creator Edit by ${creatorName}`
  }

  if (edition.credit_mode === 'roam_x_creator') {
    return `Roam × ${creatorName}`
  }

  return 'A Roam Edit'
}

// ============================================================
// EXISTING VENUE EXCERPT PRESENTATION
// ============================================================

function venueExcerpt(
  item: PublicEditionItem,
): string | null {
  const text =
    item.editorial_blurb?.trim() ||
    item.venue_description?.trim()

  if (!text) return null

  const words = text.split(/\s+/)

  if (words.length <= 22) {
    return text
  }

  return `${words.slice(0, 22).join(' ')}…`
}

// ============================================================
// BRAND EMBLEM
// ============================================================

function RoamEmblem({
  className = '',
}: {
  className?: string
}) {
  return (
    <img
      src="/branding/logo-transparent.png"
      alt=""
      aria-hidden="true"
      draggable={false}
      className={className}
    />
  )
}

// ============================================================
// COVER SLIDE
// ============================================================

function CoverSlide({
  edition,
  credit,
}: {
  edition: PublicEditionDetail
  credit: string
}) {
  const palette = getEditionPalette(edition)
  const cityName = edition.city?.trim() || 'Roam'

  return (
    <div
      className="absolute inset-0 overflow-hidden text-white"
      style={{
        background: palette.coverBackground,
      }}
    >
      <div className="absolute right-5 top-6 z-10 text-[10px] font-bold uppercase tracking-[0.22em] text-white/65">
        Editions
      </div>

      <div
        className="pointer-events-none absolute -right-[24%] top-[9%] z-0 w-[108%] rotate-[-13deg] opacity-[0.19]"
        aria-hidden="true"
      >
        <RoamEmblem className="h-auto w-full select-none object-contain" />
      </div>

      <div className="absolute bottom-[10%] left-[8%] right-[8%] z-10">
        <p
          className="mb-4 text-[10px] font-bold uppercase tracking-[0.26em]"
          style={{
            color: palette.coverEyebrow,
          }}
        >
          {cityName} / The Roam Edit
        </p>

        <h2 className="max-w-[95%] break-words text-[clamp(30px,7vw,58px)] font-black leading-[0.98] tracking-[-0.055em]">
          {edition.title}
        </h2>

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
  )
}

// ============================================================
// VENUE SLIDE
// ============================================================

function VenueSlide({
  item,
  city,
}: {
  item: PublicEditionItem
  city: string
}) {
  const imageUrl =
    item.image_override_url ||
    item.venue_cover_url ||
    item.image_url

  const excerpt = venueExcerpt(item)

  const venueTitle =
    item.display_title?.trim() ||
    item.venue_name

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#15283a] text-white">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={item.venue_name}
          loading="lazy"
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_30%,#527083_0%,#182f43_50%,#091723_100%)]" />
      )}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-black/5 to-black/90" />

      {/* Venue: retain existing logo position; remove counter only. */}
      <div className="absolute left-5 right-5 top-6 z-10 flex items-start justify-between">
        <RoamEmblem className="pointer-events-none h-12 w-12 shrink-0 select-none object-contain" />
      </div>

      <div className="absolute bottom-[8%] left-[8%] right-[8%] z-10">
        {item.badge && (
          <span className="mb-4 inline-block rounded-full bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-900">
            {item.badge}
          </span>
        )}

        <h2 className="break-words text-[clamp(30px,7vw,55px)] font-black leading-[0.98] tracking-[-0.055em]">
          {venueTitle}
        </h2>

        {excerpt && (
          <>
            <div className="mt-4 h-[2px] w-10 bg-[#c68b67]" />

            <p className="mt-3 max-w-[95%] text-[clamp(12px,2.5vw,16px)] leading-relaxed text-white/90">
              {excerpt}
            </p>
          </>
        )}

        <Link
          href={item.venue_href}
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/40 bg-white/15 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.13em] text-white backdrop-blur-md transition hover:border-[#d2ab86] hover:bg-[#d2ab86] hover:text-[#102337] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d2ab86]"
          aria-label={`Explore ${item.venue_name} venue profile`}
        >
          Explore Venue

          <span aria-hidden="true">↗</span>
        </Link>

        <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/65">
          {city} · Roam Editions
        </p>
      </div>
    </div>
  )
}

// ============================================================
// CONTEXT SLIDE — ADDITIVE INITIATIVE
//
// Separate from VenueSlide so that venue photography,
// excerpts, links, and the existing visual design remain
// completely unchanged.
//
// Image selection is resolved by the public server loader.
// If a returned image fails to load, the component attempts
// the canonical cover, then displays the text-only design.
//
// Context text scrolls vertically inside the fixed 4:5
// magazine slide rather than overflowing or becoming tiny.
// ============================================================

function ContextSlide({
  context,
  venue,
  edition,
}: {
  context: PublicEditionContextSlide
  venue: PublicEditionItem
  edition: PublicEditionDetail
}) {
  const palette = getEditionPalette(edition)

  const [failedImageUrls, setFailedImageUrls] =
    useState<string[]>([])

  const imageCandidates =
    context.image_source === 'none'
      ? []
      : [
          ...new Set(
            [
              context.image_url,
              venue.venue_cover_url,
            ].filter(
              (url): url is string =>
                typeof url === 'string' &&
                url.length > 0,
            ),
          ),
        ]

  const imageUrl =
    imageCandidates.find(
      (url) => !failedImageUrls.includes(url),
    ) ?? null

  const hasImage = Boolean(imageUrl)

  // Each context slide is keyed by its stable ID by the
  // carousel. Reset failures if image inputs change.
  useEffect(() => {
    setFailedImageUrls([])
  }, [
    context.image_url,
    context.image_source,
    venue.venue_cover_url,
  ])

  return (
    <div
      className={[
        'absolute inset-0 overflow-hidden',
        hasImage
          ? 'bg-[#15283a] text-white'
          : 'text-[#f5f3ef]',
      ].join(' ')}
      style={
        hasImage
          ? undefined
          : {
              background:
                palette.coverBackground,
            }
      }
    >
      {imageUrl && (
        <img
          key={imageUrl}
          src={imageUrl}
          alt=""
          aria-hidden="true"
          loading="lazy"
          draggable={false}
          onError={() => {
            setFailedImageUrls(
              (current) =>
                current.includes(imageUrl)
                  ? current
                  : [...current, imageUrl],
            )
          }}
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
        />
      )}

      {hasImage ? (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/90" />
      ) : (
        <div
          className="pointer-events-none absolute -right-[26%] top-[12%] w-[110%] rotate-[-13deg] opacity-[0.12]"
          aria-hidden="true"
        >
          <RoamEmblem className="h-auto w-full select-none object-contain" />
        </div>
      )}

      {/* Context logo: same position and dimensions as venue logo. */}
      <div className="absolute left-5 right-5 top-6 z-10 flex items-start justify-between gap-3">
        <RoamEmblem className="pointer-events-none h-12 w-12 shrink-0 select-none object-contain" />

        <span
          className="pt-2 text-right text-[9px] font-bold uppercase tracking-[0.2em]"
          style={{
            color: hasImage
              ? 'rgba(255,255,255,0.8)'
              : palette.coverEyebrow,
          }}
        >
          A Closer Look
        </span>
      </div>

      {/* The writing region is independently scrollable
          without changing the carousel's horizontal layout. */}
      <div
        className="absolute bottom-[8%] left-[8%] right-[8%] top-[24%] z-10 flex min-h-0 flex-col"
      >
        <p
          className="shrink-0 text-[10px] font-bold uppercase tracking-[0.18em]"
          style={{
            color: hasImage
              ? '#e6c5a6'
              : palette.coverEyebrow,
          }}
        >
          {venue.venue_name}
        </p>

        <div
          data-roam-context-scroll="true"
          role="region"
          aria-label={`Context for ${venue.venue_name}`}
          tabIndex={0}
          className={[
            'mt-4 min-h-0 flex-1 overflow-y-auto overscroll-y-contain pr-2',
            'touch-pan-y select-text',
            '[scrollbar-width:thin]',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d2ab86]',
          ].join(' ')}
        >
          {context.heading && (
            <h2 className="break-words font-serif text-[clamp(24px,5.7vw,43px)] font-normal leading-[1.08] tracking-[-0.035em]">
              {context.heading}
            </h2>
          )}

          <div
            className="mt-5 h-[2px] w-10"
            style={{
              backgroundColor: '#c68b67',
            }}
          />

          <p className="mt-4 whitespace-pre-wrap break-words text-[clamp(13px,2.5vw,16px)] leading-[1.75] text-white/90">
            {context.body}
          </p>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// CLOSING SLIDE
// ============================================================

function ClosingSlide({
  edition,
  credit,
}: {
  edition: PublicEditionDetail
  credit: string
}) {
  const palette = getEditionPalette(edition)

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        backgroundColor: palette.closingBackground,
        color: palette.closingText,
      }}
    >
      <div
        className="pointer-events-none absolute -right-[30%] top-[16%] z-0 w-[110%] rotate-[-13deg] opacity-[0.13]"
        aria-hidden="true"
      >
        <RoamEmblem className="h-auto w-full select-none object-contain" />
      </div>

      <div className="absolute bottom-[12%] left-[9%] right-[9%] z-10">
        <p
          className="text-[10px] font-bold uppercase tracking-[0.24em]"
          style={{
            color: palette.closingMuted,
          }}
        >
          The end of this edit.
          <span className="block">
            The start of your next outing.
          </span>
        </p>

        <h2 className="mt-5 text-[clamp(34px,8vw,62px)] font-black leading-[0.95] tracking-[-0.06em]">
          Play your
          <span className="block">city.</span>
        </h2>

        <p
          className="mt-6 text-sm font-medium"
          style={{
            color: palette.closingMuted,
          }}
        >
          {credit}
        </p>

        <p
          className="mt-7 border-t pt-4 text-xs font-bold uppercase tracking-[0.16em]"
          style={{
            borderTopColor: palette.closingDivider,
          }}
        >
          Do more with Roam
        </p>

        <Link
          href="/explore"
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-bold uppercase tracking-[0.13em] transition hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
          style={{
            borderColor: palette.closingMuted,
            color: palette.closingText,
          }}
        >
          Explore Places
          <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </div>
  )
}

// ============================================================
// INTERACTIVE SWIPEABLE READER
// ============================================================

export default function RoamEditionReader({
  edition,
}: Props) {
  const carouselRef = useRef<HTMLDivElement | null>(null)

  const dragRef = useRef<{
    startX: number
    startScrollLeft: number
    moved: boolean
  } | null>(null)

  const activeIndexRef = useRef(0)

  const [activeIndex, setActiveIndex] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  // ==========================================================
  // CONTEXT SLIDES — MIXED SEQUENCE
  //
  // Context slides are grouped by their associated venue
  // item ID, then rendered directly after that venue.
  //
  // The existing venue item order remains authoritative.
  // ==========================================================

  const contextsByItem = new Map<
    string,
    PublicEditionContextSlide[]
  >()

  for (const context of edition.context_slides ?? []) {
    const existing =
      contextsByItem.get(context.after_item_id) ?? []

    existing.push(context)

    contextsByItem.set(
      context.after_item_id,
      existing,
    )
  }

  for (const contexts of contextsByItem.values()) {
    contexts.sort(
      (a, b) =>
        a.position - b.position ||
        a.id.localeCompare(b.id),
    )
  }

  const venueAndContextSlides: Slide[] =
    edition.items.flatMap(
      (item, venueIndex): Slide[] => [
        {
          kind: 'venue',
          id: item.id,
          item,
          venueNumber: venueIndex + 1,
        },
        ...(contextsByItem.get(item.id) ?? []).map(
          (context): Slide => ({
            kind: 'context',
            id: `context-${context.id}`,
            context,
            venue: item,
          }),
        ),
      ],
    )

  const slides: Slide[] = [
    {
      kind: 'cover',
      id: `cover-${edition.id}`,
    },
    ...venueAndContextSlides,
    {
      kind: 'closing',
      id: `closing-${edition.id}`,
    },
  ]

  const slideCount = slides.length

  // Stable sequence signature: effects need to rerun only
  // when the ordered slide identities actually change.
  const slideIds = slides
    .map((slide) => slide.id)
    .join('|')

  const hasContextSlides =
    (edition.context_slides?.length ?? 0) > 0

  const credit = getCreatorCredit(edition)
  const cityName = edition.city?.trim() || 'Your City'

  const storageKey =
    `roam-edition-reader:${edition.id}`

  // New stable-ID key is additive. The original numeric
  // storage key remains available for compatibility.
  const slideIdStorageKey =
    `${storageKey}:slide-id`

  const canGoBack = activeIndex > 0
  const canGoForward = activeIndex < slideCount - 1

  // ----------------------------------------------------------
  // Slide navigation
  // ----------------------------------------------------------

  const goToSlide = useCallback(
    (index: number, behavior: ScrollBehavior = 'smooth') => {
      const carousel = carouselRef.current

      if (!carousel) return

      const nextIndex = Math.max(
        0,
        Math.min(index, slideCount - 1),
      )

      carousel.scrollTo({
        left: nextIndex * carousel.clientWidth,
        behavior,
      })

      activeIndexRef.current = nextIndex
      setActiveIndex(nextIndex)

      try {
        window.sessionStorage.setItem(
          storageKey,
          String(nextIndex),
        )

        window.sessionStorage.setItem(
          slideIdStorageKey,
          slides[nextIndex].id,
        )
      } catch {
        // Navigation remains functional if browser
        // storage is unavailable.
      }
    },
    [
      slideCount,
      storageKey,
      slideIdStorageKey,
      slideIds,
    ],
  )

  // ----------------------------------------------------------
  // Restore the previous slide after returning from
  // a venue profile.
  //
  // CONTEXT SLIDES:
  // Prefer a stable slide ID when present. Fall back
  // to the original numeric index for older sessions.
  // ----------------------------------------------------------

  useEffect(() => {
    const carousel = carouselRef.current

    if (!carousel) return

    let savedIndex = 0

    try {
      const storedSlideId =
        window.sessionStorage.getItem(
          slideIdStorageKey,
        )

      const matchingIndex = storedSlideId
        ? slides.findIndex(
            (slide) => slide.id === storedSlideId,
          )
        : -1

      if (matchingIndex >= 0) {
        savedIndex = matchingIndex
      } else {
        const storedValue =
          window.sessionStorage.getItem(storageKey)

        if (storedValue !== null) {
          const parsed = Number(storedValue)

          if (
            Number.isInteger(parsed) &&
            parsed >= 0 &&
            parsed < slideCount
          ) {
            savedIndex = parsed
          }
        }
      }
    } catch {
      // Start at the cover if storage is unavailable.
    }

    carousel.scrollLeft =
      savedIndex * carousel.clientWidth

    activeIndexRef.current = savedIndex
    setActiveIndex(savedIndex)
  }, [
    storageKey,
    slideIdStorageKey,
    slideCount,
    slideIds,
  ])

  // ----------------------------------------------------------
  // Maintain slide alignment when the viewport resizes.
  // ----------------------------------------------------------

  useEffect(() => {
    const carousel = carouselRef.current

    if (!carousel) return

    const observer = new ResizeObserver(() => {
      carousel.scrollLeft =
        activeIndexRef.current * carousel.clientWidth
    })

    observer.observe(carousel)

    return () => {
      observer.disconnect()
    }
  }, [])

  // ----------------------------------------------------------
  // Keep progress synchronized with actual scrolling.
  // ----------------------------------------------------------

  function handleScroll() {
    const carousel = carouselRef.current

    if (!carousel || carousel.clientWidth <= 0) {
      return
    }

    const nextIndex = Math.max(
      0,
      Math.min(
        Math.round(
          carousel.scrollLeft / carousel.clientWidth,
        ),
        slideCount - 1,
      ),
    )

    if (nextIndex === activeIndexRef.current) {
      return
    }

    activeIndexRef.current = nextIndex
    setActiveIndex(nextIndex)

    try {
      window.sessionStorage.setItem(
        storageKey,
        String(nextIndex),
      )

      window.sessionStorage.setItem(
        slideIdStorageKey,
        slides[nextIndex].id,
      )
    } catch {
      // Ignore unavailable session storage.
    }
  }

  // ----------------------------------------------------------
  // Desktop mouse dragging.
  //
  // Interactive links are excluded so clicking
  // "Explore Venue" never starts a drag.
  //
  // CONTEXT SLIDES:
  // Selecting or vertically scrolling written content
  // should not initiate desktop carousel dragging.
  // ----------------------------------------------------------

  function handleMouseDown(
    event: MouseEvent<HTMLDivElement>,
  ) {
    if (event.button !== 0) return

    const target = event.target

    if (
      target instanceof Element &&
      target.closest(
        'a, button, input, textarea, select, [data-roam-context-scroll]',
      )
    ) {
      return
    }

    const carousel = carouselRef.current

    if (!carousel) return

    dragRef.current = {
      startX: event.clientX,
      startScrollLeft: carousel.scrollLeft,
      moved: false,
    }

    setIsDragging(true)

    event.preventDefault()
  }

  function handleMouseMove(
    event: MouseEvent<HTMLDivElement>,
  ) {
    const drag = dragRef.current
    const carousel = carouselRef.current

    if (!drag || !carousel) return

    if (event.buttons !== 1) {
      finishMouseDrag()
      return
    }

    const delta = event.clientX - drag.startX

    if (Math.abs(delta) > 4) {
      drag.moved = true
    }

    carousel.scrollLeft =
      drag.startScrollLeft - delta
  }

  function finishMouseDrag() {
    const drag = dragRef.current
    const carousel = carouselRef.current

    if (!drag || !carousel) return

    dragRef.current = null
    setIsDragging(false)

    const width = carousel.clientWidth

    if (width <= 0) return

    const position = carousel.scrollLeft / width

    const nextIndex = Math.max(
      0,
      Math.min(
        slideCount - 1,
        Math.round(position),
      ),
    )

    // A short intentional drag should move the page,
    // even if it ends just before the halfway point.
    const delta =
      drag.startScrollLeft - carousel.scrollLeft

    const threshold = Math.min(width * 0.15, 60)

    if (drag.moved && Math.abs(delta) >= threshold) {
      const startIndex = Math.round(
        drag.startScrollLeft / width,
      )

      goToSlide(
        delta > 0 ? startIndex + 1 : startIndex - 1,
      )

      return
    }

    goToSlide(nextIndex)
  }

  // ----------------------------------------------------------
  // Keyboard navigation.
  // ----------------------------------------------------------

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLDivElement>,
  ) {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return
    }

    // Let focused context writing regions use their own
    // vertical scrolling without interfering with the
    // reader's navigation shortcuts.
    const target = event.target

    if (
      target instanceof Element &&
      target.closest('[data-roam-context-scroll]') &&
      (
        event.key === 'ArrowUp' ||
        event.key === 'ArrowDown' ||
        event.key === 'PageUp' ||
        event.key === 'PageDown'
      )
    ) {
      return
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault()
      goToSlide(activeIndexRef.current + 1)
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      goToSlide(activeIndexRef.current - 1)
    }

    if (event.key === 'Home') {
      event.preventDefault()
      goToSlide(0)
    }

    if (event.key === 'End') {
      event.preventDefault()
      goToSlide(slideCount - 1)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[540px]">
      <div className="relative">
        {/* --------------------------------------------------
            INTERACTIVE CAROUSEL
           -------------------------------------------------- */}

        <div
          ref={carouselRef}
          role="region"
          aria-roledescription="carousel"
          aria-label={`${edition.title} editorial slides`}
          tabIndex={0}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={finishMouseDrag}
          onMouseLeave={finishMouseDrag}
          onDragStart={(event) => event.preventDefault()}
          className={[
            'flex w-full overflow-x-auto overscroll-x-contain rounded-xl border border-white/10 bg-[#11243a] shadow-[0_24px_70px_rgba(0,0,0,0.3)]',
            // Existing Editions retain their original
            // touch-action setting. Context Editions allow
            // native vertical scrolling inside text panels
            // as well as horizontal slide navigation.
            hasContextSlides
              ? 'touch-auto select-none'
              : 'touch-pan-x select-none',
            '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d2ab86]',
            isDragging
              ? 'cursor-grabbing snap-none'
              : 'cursor-grab snap-x snap-mandatory',
          ].join(' ')}
        >
          {slides.map((slide, index) => (
            <section
              key={slide.id}
              role="group"
              aria-roledescription="slide"
              aria-label={
                slide.kind === 'cover'
                  ? `Slide ${index + 1} of ${slideCount}: ${edition.title} cover`
                  : slide.kind === 'venue'
                    ? `Slide ${index + 1} of ${slideCount}: ${slide.item.venue_name}`
                    : slide.kind === 'context'
                      ? `Slide ${index + 1} of ${slideCount}: Context for ${slide.venue.venue_name}`
                      : `Slide ${index + 1} of ${slideCount}: Closing`
              }
              className="relative aspect-[4/5] w-full shrink-0 snap-start snap-always overflow-hidden"
            >
              {slide.kind === 'cover' && (
                <CoverSlide
                  edition={edition}
                  credit={credit}
                />
              )}

              {slide.kind === 'venue' && (
                <VenueSlide
                  item={slide.item}
                  city={cityName}
                />
              )}

              {slide.kind === 'context' && (
                <ContextSlide
                  context={slide.context}
                  venue={slide.venue}
                  edition={edition}
                />
              )}

              {slide.kind === 'closing' && (
                <ClosingSlide
                  edition={edition}
                  credit={credit}
                />
              )}
            </section>
          ))}
        </div>
      </div>

      {/* ----------------------------------------------------
          PROGRESS AND NAVIGATION
         ---------------------------------------------------- */}

      <div className="mt-5 flex items-center justify-between gap-4">
        <div
          className="flex min-w-0 flex-1 items-center gap-1.5"
          role="group"
          aria-label="Edition slide navigation"
        >
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => goToSlide(index)}
              aria-label={`Go to slide ${index + 1} of ${slideCount}`}
              aria-current={
                index === activeIndex ? 'step' : undefined
              }
              className="flex min-h-11 min-w-3 flex-1 items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#d2ab86]"
            >
              <span
                className={[
                  'block h-1 w-full rounded-full transition-colors duration-200',
                  index <= activeIndex
                    ? 'bg-[#c68b67]'
                    : 'bg-white/20',
                ].join(' ')}
              />
            </button>
          ))}
        </div>

        <span
          aria-live="off"
          className="shrink-0 text-[11px] font-semibold tabular-nums tracking-[0.12em] text-[#b8c3cd]"
        >
          {activeIndex + 1} / {slideCount}
        </span>
      </div>

      {/* ----------------------------------------------------
          OPTIONAL DESKTOP CONTROLS
         ---------------------------------------------------- */}

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b8c3cd]">
          <span className="sm:hidden">
            Swipe to explore
          </span>

          <span className="hidden sm:inline">
            Swipe or drag to explore
          </span>

          <span className="ml-2 text-[#c68b67]">
            →
          </span>
        </p>

        <div className="hidden items-center gap-2 sm:flex">
          <button
            type="button"
            onClick={() => goToSlide(activeIndex - 1)}
            disabled={!canGoBack}
            aria-label="Previous slide"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white transition hover:border-[#d2ab86] hover:text-[#d2ab86] disabled:cursor-not-allowed disabled:opacity-30"
          >
            <span aria-hidden="true">←</span>
          </button>

          <button
            type="button"
            onClick={() => goToSlide(activeIndex + 1)}
            disabled={!canGoForward}
            aria-label="Next slide"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white transition hover:border-[#d2ab86] hover:text-[#d2ab86] disabled:cursor-not-allowed disabled:opacity-30"
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </div>
  )
}
