
'use client'

import {
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'

/* =========================================================
 * Editorial palette contracts
 * ======================================================= */

const EDITORIAL_PALETTES = {
  midnight_navy: {
    label: 'Midnight Navy',
    background: '#e7e1d5',
    foreground: '#102337',
    muted: '#496477',
    divider: '#102337',
  },
  after_hours: {
    label: 'After Hours',
    background: '#f0dfd3',
    foreground: '#421f2a',
    muted: '#793f4c',
    divider: '#421f2a',
  },
  olive_oak: {
    label: 'Olive Oak',
    background: '#f4ead8',
    foreground: '#233d32',
    muted: '#667259',
    divider: '#233d32',
  },
  golden_hour: {
    label: 'Golden Hour',
    background: '#fff0d9',
    foreground: '#70412f',
    muted: '#99634a',
    divider: '#70412f',
  },
  noir_champagne: {
    label: 'Noir Champagne',
    background: '#f2eee7',
    foreground: '#28272d',
    muted: '#5f5859',
    divider: '#28272d',
  },
  winter_blue: {
    label: 'Winter Blue',
    background: '#edf3f1',
    foreground: '#263b50',
    muted: '#627f90',
    divider: '#263b50',
  },
} as const

export type EndCardEditorialPalette =
  keyof typeof EDITORIAL_PALETTES

export type CollectionEndCardGeneratorProps = {
  collectionTitle?: string | null
  creatorHandle?: string | null
  editionPalette?: EndCardEditorialPalette | null
  className?: string
}

type ExportFormat =
  | 'instagram'
  | 'tiktok'

type CardColors = {
  background: string
  foreground: string
  muted: string
  divider: string
}

type CardContent = {
  title: string
  headline: string
  message: string
  handle: string
  colors: CardColors
  format: ExportFormat
}

/* =========================================================
 * Constants
 * ======================================================= */

const DEFAULT_PALETTE =
  'midnight_navy' as const

// =====================================================
// EDITORIAL HEADLINE — ROAM BRAND SENTIMENT
// =====================================================

const DEFAULT_HEADLINE =
  'Less scrolling. More living.'

const DEFAULT_MESSAGE =
  'Head to my Story for the link to the full edition on Roam.'

const LOGO_PATH =
  '/branding/logo-transparent.png'

const EXPORT_FORMATS = {
  instagram: {
    label: 'Instagram · 4:5',
    width: 1080,
    height: 1350,
  },
  tiktok: {
    label: 'TikTok · 9:16',
    width: 1080,
    height: 1920,
  },
} as const

const FIELD_CLASS_NAME = [
  'mt-2 w-full min-w-0 rounded-xl border border-neutral-800',
  'bg-black px-3 py-3 text-sm text-white outline-none',
  'placeholder:text-neutral-600',
  'focus:border-cyan-500',
  'focus-visible:ring-2 focus-visible:ring-cyan-400/40',
].join(' ')

/* =========================================================
 * Main component
 * ======================================================= */

export default function CollectionEndCardGenerator({
  collectionTitle,
  creatorHandle,
  editionPalette,
  className,
}: CollectionEndCardGeneratorProps) {
  const sectionId = useId()

  const initialPalette =
    editionPalette ??
    DEFAULT_PALETTE

  const [
    selectedPalette,
    setSelectedPalette,
  ] = useState<EndCardEditorialPalette>(
    initialPalette
  )

  const [
    colors,
    setColors,
  ] = useState<CardColors>(
    () =>
      paletteColors(
        initialPalette
      )
  )

  const [
    headline,
    setHeadline,
  ] = useState(
    DEFAULT_HEADLINE
  )

  const [
    message,
    setMessage,
  ] = useState(
    DEFAULT_MESSAGE
  )

  const [
    handle,
    setHandle,
  ] = useState(
    () =>
      normalizeHandle(
        creatorHandle
      )
  )

  const [
    format,
    setFormat,
  ] = useState<ExportFormat>(
    'instagram'
  )

  const [
    exporting,
    setExporting,
  ] = useState(false)

  const [
    exportError,
    setExportError,
  ] = useState<string | null>(
    null
  )

  // =====================================================
  // PREVIEW — USE THE EXACT PNG RENDERER
  // =====================================================

  const previewCanvasRef =
    useRef<HTMLCanvasElement | null>(null)

  /*
   * When the saved edition palette becomes available,
   * initialize the standalone card with those colors.
   *
   * This does not modify the edition's saved design.
   */
  useEffect(() => {
    if (!editionPalette) {
      return
    }

    setSelectedPalette(
      editionPalette
    )

    setColors(
      paletteColors(
        editionPalette
      )
    )
  }, [
    editionPalette,
  ])

  const title =
    normalizeText(
      collectionTitle,
      120
    ) || 'ROAM EDITIONS'

  const normalizedHeadline =
    normalizeText(
      headline,
      100
    )

  const normalizedMessage =
    normalizeText(
      message,
      240
    )

  const normalizedHandle =
    normalizeHandle(
      handle
    )

  const canExport =
    normalizedHeadline.length >
      0 &&
    normalizedMessage.length >
      0

  const content: CardContent = {
    title,
    headline:
      normalizedHeadline,
    message:
      normalizedMessage,
    handle:
      normalizedHandle,
    colors,
    format,
  }

  // =====================================================
  // PREVIEW — RENDER THE SAME CANVAS AS THE DOWNLOAD
  // =====================================================

  useEffect(() => {
    let cancelled = false

    async function updatePreview() {
      try {
        const logo =
          await loadLogoImage()

        if (cancelled) {
          return
        }

        const renderedCanvas =
          renderCardCanvas(
            {
              title,
              headline:
                normalizedHeadline,
              message:
                normalizedMessage,
              handle:
                normalizedHandle,
              colors,
              format,
            },
            logo
          )

        if (cancelled) {
          return
        }

        const previewCanvas =
          previewCanvasRef.current

        if (!previewCanvas) {
          return
        }

        const previewContext =
          previewCanvas.getContext(
            '2d'
          )

        if (!previewContext) {
          return
        }

        /*
         * Match the original canvas's native
         * resolution before copying the pixels.
         */
        if (
          previewCanvas.width !==
          renderedCanvas.width
        ) {
          previewCanvas.width =
            renderedCanvas.width
        }

        if (
          previewCanvas.height !==
          renderedCanvas.height
        ) {
          previewCanvas.height =
            renderedCanvas.height
        }

        previewContext.clearRect(
          0,
          0,
          previewCanvas.width,
          previewCanvas.height
        )

        previewContext.drawImage(
          renderedCanvas,
          0,
          0
        )
      } catch (error) {
        if (!cancelled) {
          console.error(
            '[CollectionEndCardGenerator] Preview rendering failed:',
            error
          )
        }
      }
    }

    void updatePreview()

    return () => {
      cancelled = true
    }
  }, [
    title,
    normalizedHeadline,
    normalizedMessage,
    normalizedHandle,
    colors,
    format,
  ])

  function selectPalette(
    palette:
      EndCardEditorialPalette
  ) {
    setSelectedPalette(
      palette
    )

    setColors(
      paletteColors(
        palette
      )
    )

    setExportError(null)
  }

  function updateColor(
    key: keyof CardColors,
    value: string
  ) {
    setColors(
      (current) => ({
        ...current,
        [key]: value,
      })
    )

    setExportError(null)
  }

  function resetCard() {
    const palette =
      editionPalette ??
      DEFAULT_PALETTE

    selectPalette(
      palette
    )

    setHeadline(
      DEFAULT_HEADLINE
    )

    setMessage(
      DEFAULT_MESSAGE
    )

    setHandle(
      normalizeHandle(
        creatorHandle
      )
    )

    setFormat(
      'instagram'
    )

    setExportError(null)
  }

  async function downloadCard() {
    if (
      exporting ||
      !canExport
    ) {
      return
    }

    setExporting(true)
    setExportError(null)

    try {
      const logo =
        await loadLogoImage()

      const canvas =
        renderCardCanvas(
          content,
          logo
        )

      const blob =
        await canvasToBlob(
          canvas
        )

      const url =
        URL.createObjectURL(
          blob
        )

      const anchor =
        document.createElement(
          'a'
        )

      anchor.href =
        url

      anchor.download =
        buildFilename(
          title,
          format
        )

      document.body.appendChild(
        anchor
      )

      anchor.click()
      anchor.remove()

      window.setTimeout(
        () => {
          URL.revokeObjectURL(
            url
          )
        },
        10_000
      )
    } catch (
      error
    ) {
      console.error(
        '[CollectionEndCardGenerator] Export failed:',
        error
      )

      setExportError(
        'Unable to export the end card. Please try again.'
      )
    } finally {
      setExporting(false)
    }
  }

  return (
    <section
      aria-labelledby={
        sectionId
      }
      className={[
        'w-full min-w-0 overflow-hidden rounded-[1.75rem]',
        'border border-slate-700/60 bg-[#0d1b2f] text-white',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="border-b border-slate-700/60 px-4 py-5 sm:px-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
          Social studio
        </p>

        <h2
          id={sectionId}
          className="mt-2 text-xl font-semibold text-white"
        >
          Promotional End Card
        </h2>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Create a standalone
          ending slide that
          matches your edition.
          Download it and add
          it wherever you want
          your Instagram or TikTok
          preview to end.
        </p>
      </div>

      <div className="grid min-w-0 gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.9fr)]">
        {/* Editing controls */}

        <div className="min-w-0 space-y-6">
          <fieldset>
            <legend className="text-sm font-semibold text-white">
              Edition palette
            </legend>

            <p className="mt-1 text-xs leading-5 text-slate-400">
              Start with the same
              colors as the edition&apos;s
              closing slide, or
              customize them.
            </p>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {(
                Object.keys(
                  EDITORIAL_PALETTES
                ) as EndCardEditorialPalette[]
              ).map(
                (key) => {
                  const palette =
                    EDITORIAL_PALETTES[
                      key
                    ]

                  const selected =
                    selectedPalette ===
                    key

                  return (
                    <button
                      key={
                        key
                      }
                      type="button"
                      aria-pressed={
                        selected
                      }
                      onClick={() =>
                        selectPalette(
                          key
                        )
                      }
                      className={[
                        'min-w-0 rounded-xl border p-2 text-left transition',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300',
                        selected
                          ? 'border-cyan-400/70 bg-cyan-500/10'
                          : 'border-slate-700/70 hover:border-slate-500',
                      ].join(' ')}
                    >
                      <span
                        className="flex h-14 items-center justify-center rounded-lg"
                        style={{
                          backgroundColor:
                            palette.background,
                        }}
                      >
                        <span
                          className="text-2xl font-black"
                          style={{
                            color:
                              palette.foreground,
                          }}
                        >
                          R
                        </span>
                      </span>

                      <span className="mt-2 block truncate text-[10px] font-medium text-slate-300">
                        {
                          palette.label
                        }
                      </span>
                    </button>
                  )
                }
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <ColorField
                label="Background"
                value={
                  colors.background
                }
                onChange={(
                  value
                ) =>
                  updateColor(
                    'background',
                    value
                  )
                }
              />

              <ColorField
                label="Main text"
                value={
                  colors.foreground
                }
                onChange={(
                  value
                ) =>
                  updateColor(
                    'foreground',
                    value
                  )
                }
              />

              <ColorField
                label="Secondary text"
                value={
                  colors.muted
                }
                onChange={(
                  value
                ) =>
                  updateColor(
                    'muted',
                    value
                  )
                }
              />

              <ColorField
                label="Divider"
                value={
                  colors.divider
                }
                onChange={(
                  value
                ) =>
                  updateColor(
                    'divider',
                    value
                  )
                }
              />
            </div>
          </fieldset>

          <div className="space-y-4">
            <div>
              <label
                htmlFor={`${sectionId}-headline`}
                className="text-sm font-semibold text-white"
              >
                Headline
              </label>

              <input
                id={`${sectionId}-headline`}
                type="text"
                value={
                  headline
                }
                onChange={(
                  event
                ) =>
                  setHeadline(
                    event.target.value
                  )
                }
                maxLength={100}
                className={
                  FIELD_CLASS_NAME
                }
              />
            </div>

            <div>
              <label
                htmlFor={`${sectionId}-message`}
                className="text-sm font-semibold text-white"
              >
                Story direction
              </label>

              <textarea
                id={`${sectionId}-message`}
                rows={3}
                value={
                  message
                }
                onChange={(
                  event
                ) =>
                  setMessage(
                    event.target.value
                  )
                }
                maxLength={240}
                className={
                  FIELD_CLASS_NAME
                }
              />

              <p className="mt-2 text-xs leading-5 text-slate-500">
                Tell viewers
                where the link to
                the complete edition
                can be found.
              </p>
            </div>

            <div>
              <label
                htmlFor={`${sectionId}-handle`}
                className="text-sm font-semibold text-white"
              >
                Social handle
              </label>

              <input
                id={`${sectionId}-handle`}
                type="text"
                value={
                  handle
                }
                onChange={(
                  event
                ) =>
                  setHandle(
                    event.target.value
                  )
                }
                maxLength={60}
                placeholder="@yourhandle"
                className={
                  FIELD_CLASS_NAME
                }
              />

              <p className="mt-2 text-xs leading-5 text-slate-500">
                Optional. This
                appears beneath
                the message,
                without an
                Instagram or TikTok
                promotional header.
              </p>
            </div>
          </div>

          <fieldset>
            <legend className="text-sm font-semibold text-white">
              Export dimensions
            </legend>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {(
                Object.keys(
                  EXPORT_FORMATS
                ) as ExportFormat[]
              ).map(
                (key) => (
                  <button
                    key={
                      key
                    }
                    type="button"
                    aria-pressed={
                      format === key
                    }
                    onClick={() =>
                      setFormat(
                        key
                      )
                    }
                    className={[
                      'min-h-14 rounded-xl border p-3 text-left transition',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300',
                      format === key
                        ? 'border-cyan-400/60 bg-cyan-500/10 text-cyan-100'
                        : 'border-slate-700 text-slate-300 hover:border-slate-500',
                    ].join(' ')}
                  >
                    <span className="block text-xs font-semibold">
                      {
                        EXPORT_FORMATS[
                          key
                        ].label
                      }
                    </span>

                    <span className="mt-1 block text-[11px] opacity-70">
                      {
                        EXPORT_FORMATS[
                          key
                        ].width
                      }
                      {' × '}
                      {
                        EXPORT_FORMATS[
                          key
                        ].height
                      }
                    </span>
                  </button>
                )
              )}
            </div>
          </fieldset>

          <div className="space-y-3 border-t border-slate-700/60 pt-5">
            {exportError ? (
              <p
                role="alert"
                className="rounded-xl border border-red-500/30 bg-red-950/20 p-3 text-xs leading-5 text-red-200"
              >
                {exportError}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() =>
                void downloadCard()
              }
              disabled={
                exporting ||
                !canExport
              }
              className="min-h-11 w-full rounded-lg bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting
                ? 'Preparing PNG…'
                : 'Download End Card'}
            </button>

            <button
              type="button"
              onClick={
                resetCard
              }
              disabled={
                exporting
              }
              className="min-h-10 w-full rounded-lg border border-slate-600 px-4 text-xs font-semibold text-slate-300 transition hover:border-slate-400 disabled:opacity-50"
            >
              Reset design
            </button>

            <p className="text-xs leading-5 text-slate-500">
              Downloads one
              standalone PNG.
              The existing edition,
              slide sequence, and
              carousel ZIP remain
              unchanged.
            </p>
          </div>
        </div>

        {/* Editorial preview — exact PNG renderer */}

        <div className="min-w-0">
          <div className="rounded-2xl border border-slate-700/60 bg-black/20 p-3 sm:p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">
                End card preview
              </p>

              <span className="text-[11px] text-slate-400">
                {format ===
                'instagram'
                  ? '4:5'
                  : '9:16'}
              </span>
            </div>

            <div className="mx-auto w-full max-w-[440px]">
              <canvas
                ref={previewCanvasRef}
                width={
                  EXPORT_FORMATS[
                    format
                  ].width
                }
                height={
                  EXPORT_FORMATS[
                    format
                  ].height
                }
                role="img"
                aria-label="Live preview of the promotional end card"
                className="block h-auto w-full rounded-xl border border-white/10 shadow-2xl"
                style={{
                  aspectRatio:
                    format ===
                    'instagram'
                      ? '4 / 5'
                      : '9 / 16',

                  backgroundColor:
                    colors.background,
                }}
              />
            </div>

            <p className="mt-4 text-center text-xs leading-5 text-slate-500">
              Exact canvas preview
              of your downloadable
              PNG.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

/* =========================================================
 * Color field
 * ======================================================= */

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const id = useId()

  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        className="block text-xs font-medium text-slate-300"
      >
        {label}
      </label>

      <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-700 bg-black/40 p-2">
        <input
          id={id}
          aria-label={`${label} color`}
          type="color"
          value={
            value
          }
          onChange={(
            event
          ) =>
            onChange(
              event.target.value
            )
          }
          className="h-8 w-9 shrink-0 cursor-pointer border-0 bg-transparent p-0"
        />

        <span className="min-w-0 truncate font-mono text-[11px] text-slate-400">
          {
            value.toUpperCase()
          }
        </span>
      </div>
    </div>
  )
}

/* =========================================================
 * Palette helpers
 * ======================================================= */

function paletteColors(
  key: EndCardEditorialPalette
): CardColors {
  const palette =
    EDITORIAL_PALETTES[
      key
    ]

  return {
    background:
      palette.background,

    foreground:
      palette.foreground,

    muted:
      palette.muted,

    divider:
      palette.divider,
  }
}

function withAlpha(
  color: string,
  alpha: number
): string {
  const match =
    /^#([0-9a-f]{6})$/i.exec(
      color
    )

  if (!match) {
    return color
  }

  const hex =
    match[1]!

  const red =
    parseInt(
      hex.slice(0, 2),
      16
    )

  const green =
    parseInt(
      hex.slice(2, 4),
      16
    )

  const blue =
    parseInt(
      hex.slice(4, 6),
      16
    )

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

/* =========================================================
 * Logo loading
 * ======================================================= */

function loadLogoImage(): Promise<HTMLImageElement> {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      const image =
        new Image()

      image.onload = () => {
        if (
          image.naturalWidth > 0 &&
          image.naturalHeight > 0
        ) {
          resolve(image)
          return
        }

        reject(
          new Error(
            'Roam logo has invalid dimensions.'
          )
        )
      }

      image.onerror = () => {
        reject(
          new Error(
            'Unable to load the Roam logo.'
          )
        )
      }

      image.src =
        LOGO_PATH
    }
  )
}

/* =========================================================
 * PNG renderer
 * ======================================================= */

function renderCardCanvas(
  content: CardContent,
  logo: HTMLImageElement
): HTMLCanvasElement {
  const dimensions =
    EXPORT_FORMATS[
      content.format
    ]

  const width =
    dimensions.width

  const height =
    dimensions.height

  const canvas =
    document.createElement(
      'canvas'
    )

  canvas.width =
    width

  canvas.height =
    height

  const context =
    canvas.getContext(
      '2d'
    )

  if (!context) {
    throw new Error(
      'Canvas is unavailable.'
    )
  }

  const {
    colors,
    headline,
    message,
    handle,
    format,
  } = content

  const isTikTok =
    format === 'tiktok'

  context.fillStyle =
    colors.background

  context.fillRect(
    0,
    0,
    width,
    height
  )

  /*
   * Match the original closing slide's oversized
   * rotated copper R watermark.
   */
  context.save()

  context.globalAlpha =
    0.13

  const logoWidth =
    width * 1.1

  const logoHeight =
    logoWidth *
    (
      logo.naturalHeight /
      logo.naturalWidth
    )

  const logoX =
    width * 0.7

  const logoY =
    height *
    (
      isTikTok
        ? 0.24
        : 0.16
    )

  context.translate(
    logoX,
    logoY
  )

  context.rotate(
    -13 * Math.PI / 180
  )

  context.drawImage(
    logo,
    -logoWidth / 2,
    0,
    logoWidth,
    logoHeight
  )

  context.restore()

  /*
   * Bottom-positioned editorial composition.
   * This mirrors the existing closing slide:
   * bottom 12% for Instagram and 27% for TikTok.
   */
  const left =
    width * 0.09

  const right =
    width * 0.91

  const contentWidth =
    right - left

  const bottom =
    height *
    (
      isTikTok
        ? 0.27
        : 0.12
    )

  const footerY =
    height - bottom

  /*
   * The standalone Story CTA has no additional footer.
   * Position the existing text within the freed space.
   */
  let cursorY =
    footerY

  if (handle) {
    context.fillStyle =
      colors.foreground

    const handleHeight =
      drawCanvasText({
        context,
        text: handle,
        x: left,
        y: cursorY - 46,
        maxWidth:
          contentWidth,
        maxLines: 2,
        fontSize: 30,
        minFontSize: 22,
        lineHeight: 1.2,
        weight: 600,
        color:
          colors.foreground,
      })

    cursorY -=
      handleHeight + 75
  } else {
    cursorY -= 45
  }

  /*
   * Supporting story direction.
   */
  const messageSize =
    isTikTok
      ? 39
      : 36

  const messageLayout =
    measureCanvasText({
      context,
      text: message,
      maxWidth:
        contentWidth,
      maxLines: 5,
      fontSize:
        messageSize,
      minFontSize: 25,
      lineHeight: 1.35,
      weight: 500,
    })

  const messageY =
    cursorY -
    messageLayout.height

  drawMeasuredText({
    context,
    layout:
      messageLayout,
    x: left,
    y: messageY,
    color:
      colors.muted,
  })

  // =====================================================
  // OVERSIZED EDITORIAL HEADLINE
  //
  // Restore the visual hierarchy of the original
  // closing slide while retaining canvas-based
  // preview/export parity.
  //
  // Short headlines render at up to 148px.
  // Longer headlines shrink to fit the available space.
  // =====================================================

  const headlineGap = 57
  const eyebrowGap = 75

  const headlineBottom =
    messageY -
    headlineGap

  const minimumTopMargin =
    height *
    (
      isTikTok
        ? 0.14
        : 0.10
    )

  const availableHeadlineHeight =
    Math.max(
      100,
      headlineBottom -
        minimumTopMargin -
        eyebrowGap
    )

  const headlineLayout =
    measureCanvasText({
      context,
      text: headline,
      maxWidth:
        contentWidth,
      maxLines: 4,
      fontSize: 148,
      minFontSize: 43,
      lineHeight: 0.96,
      weight: 900,
      maxHeight:
        availableHeadlineHeight,
    })

  const headlineY =
    headlineBottom -
    headlineLayout.height

  drawMeasuredText({
    context,
    layout:
      headlineLayout,
    x: left,
    y: headlineY,
    color:
      colors.foreground,
  })

  /*
   * Editorial eyebrow.
   */
  context.fillStyle =
    colors.muted

  context.font =
    '700 27px Arial, Helvetica, sans-serif'

  context.textAlign =
    'left'

  context.textBaseline =
    'top'

  context.fillText(
    'THE EDITION CONTINUES.',
    left,
    headlineY -
      eyebrowGap,
    contentWidth
  )

  return canvas
}

/* =========================================================
 * Canvas typography
 * ======================================================= */

type TextLayout = {
  lines: string[]
  fontSize: number
  lineHeight: number
  height: number
  weight: number
}

function measureCanvasText({
  context,
  text,
  maxWidth,
  maxLines,
  fontSize,
  minFontSize,
  lineHeight,
  weight,
  maxHeight,
}: {
  context: CanvasRenderingContext2D
  text: string
  maxWidth: number
  maxLines: number
  fontSize: number
  minFontSize: number
  lineHeight: number
  weight: number
  maxHeight?: number
}): TextLayout {
  const normalized =
    normalizeText(
      text,
      300
    )

  let currentFontSize =
    fontSize

  let lines: string[] =
    []

  while (
    currentFontSize >=
    minFontSize
  ) {
    context.font =
      `${weight} ${currentFontSize}px Arial, Helvetica, sans-serif`

    lines =
      wrapText(
        context,
        normalized,
        maxWidth
      )

    const calculatedHeight =
      lines.length *
      currentFontSize *
      lineHeight

    const fitsLineCount =
      lines.length <=
      maxLines

    const fitsHeight =
      maxHeight === undefined ||
      calculatedHeight <=
        maxHeight

    if (
      fitsLineCount &&
      fitsHeight
    ) {
      break
    }

    currentFontSize -= 2
  }

  if (
    currentFontSize <
    minFontSize
  ) {
    currentFontSize =
      minFontSize

    context.font =
      `${weight} ${currentFontSize}px Arial, Helvetica, sans-serif`

    lines =
      wrapText(
        context,
        normalized,
        maxWidth
      )
  }

  if (
    lines.length >
    maxLines
  ) {
    lines =
      lines.slice(
        0,
        maxLines
      )

    const last =
      lines.length - 1

    if (last >= 0) {
      lines[last] =
        truncateText(
          context,
          lines[last]!,
          maxWidth
        )
    }
  }

  const pixelLineHeight =
    currentFontSize *
    lineHeight

  return {
    lines,
    fontSize:
      currentFontSize,
    lineHeight:
      pixelLineHeight,
    height:
      lines.length *
      pixelLineHeight,
    weight,
  }
}

function drawMeasuredText({
  context,
  layout,
  x,
  y,
  color,
}: {
  context: CanvasRenderingContext2D
  layout: TextLayout
  x: number
  y: number
  color: string
}) {
  context.save()

  context.fillStyle =
    color

  context.textAlign =
    'left'

  context.textBaseline =
    'top'

  context.font =
    `${layout.weight} ${layout.fontSize}px Arial, Helvetica, sans-serif`

  layout.lines.forEach(
    (
      line,
      index
    ) => {
      context.fillText(
        line,
        x,
        y +
          index *
          layout.lineHeight
      )
    }
  )

  context.restore()
}

function drawCanvasText({
  context,
  text,
  x,
  y,
  maxWidth,
  maxLines,
  fontSize,
  minFontSize,
  lineHeight,
  weight,
  color,
}: {
  context: CanvasRenderingContext2D
  text: string
  x: number
  y: number
  maxWidth: number
  maxLines: number
  fontSize: number
  minFontSize: number
  lineHeight: number
  weight: number
  color: string
}): number {
  const layout =
    measureCanvasText({
      context,
      text,
      maxWidth,
      maxLines,
      fontSize,
      minFontSize,
      lineHeight,
      weight,
    })

  drawMeasuredText({
    context,
    layout,
    x,
    y,
    color,
  })

  return layout.height
}

function wrapText(
  context: CanvasRenderingContext2D,
  value: string,
  maxWidth: number
): string[] {
  if (!value) {
    return []
  }

  const words =
    value.split(/\s+/)

  const lines: string[] =
    []

  let line =
    ''

  for (const word of words) {
    const candidate =
      line
        ? `${line} ${word}`
        : word

    if (
      context.measureText(
        candidate
      ).width <=
      maxWidth
    ) {
      line =
        candidate

      continue
    }

    if (line) {
      lines.push(line)
      line = ''
    }

    if (
      context.measureText(
        word
      ).width <=
      maxWidth
    ) {
      line = word
      continue
    }

    let fragment =
      ''

    for (
      const character of
      word
    ) {
      const next =
        fragment +
        character

      if (
        fragment &&
        context.measureText(
          next
        ).width >
        maxWidth
      ) {
        lines.push(
          fragment
        )

        fragment =
          character
      } else {
        fragment =
          next
      }
    }

    line =
      fragment
  }

  if (line) {
    lines.push(line)
  }

  return lines
}

function truncateText(
  context: CanvasRenderingContext2D,
  value: string,
  maxWidth: number
): string {
  const ellipsis =
    '…'

  let text =
    value

  while (
    text &&
    context.measureText(
      text +
      ellipsis
    ).width >
    maxWidth
  ) {
    text =
      text.slice(0, -1)
  }

  return text.trimEnd() +
    ellipsis
}

/* =========================================================
 * Download helpers
 * ======================================================= */

function canvasToBlob(
  canvas: HTMLCanvasElement
): Promise<Blob> {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      try {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(
                new Error(
                  'PNG generation failed.'
                )
              )

              return
            }

            resolve(blob)
          },
          'image/png'
        )
      } catch (error) {
        reject(error)
      }
    }
  )
}

function buildFilename(
  title: string,
  format: ExportFormat
): string {
  const slug =
    title
      .toLowerCase()
      .normalize('NFKD')
      .replace(
        /[\u0300-\u036f]/g,
        ''
      )
      .replace(
        /[^a-z0-9]+/g,
        '-'
      )
      .replace(
        /^-+|-+$/g,
        ''
      )
      .slice(0, 60) ||
    'edition'

  return `roam-${slug}-end-card-${format}.png`
}

/* =========================================================
 * Primitive helpers
 * ======================================================= */

function normalizeText(
  value: unknown,
  maximumLength: number
): string {
  if (
    typeof value !==
    'string'
  ) {
    return ''
  }

  return value
    .trim()
    .replace(
      /\s+/g,
      ' '
    )
    .slice(
      0,
      maximumLength
    )
}

function normalizeHandle(
  value: unknown
): string {
  const normalized =
    normalizeText(
      value,
      60
    )

  if (!normalized) {
    return ''
  }

  return normalized.startsWith(
    '@'
  )
    ? normalized
    : `@${normalized}`
}
