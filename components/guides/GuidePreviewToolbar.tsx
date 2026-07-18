'use client'

import type { ReactNode } from 'react'
import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Eye,
  Laptop,
  Loader2,
  Monitor,
  RefreshCw,
  Smartphone,
  Tablet,
} from 'lucide-react'

import type { GuideStatus } from '@/lib/guides/types'

/* ------------------------------------------------ */
/* Types                                            */
/* ------------------------------------------------ */

type PreviewViewport =
  | 'desktop'
  | 'tablet'
  | 'mobile'

type Props = {
  guideId: string
  guideSlug: string
  guideStatus: GuideStatus

  guideTitle?: string | null
  children: ReactNode

  backHref?: string
  className?: string
}

/* ------------------------------------------------ */
/* Constants                                        */
/* ------------------------------------------------ */

const VIEWPORT_OPTIONS: Array<{
  value: PreviewViewport
  label: string
  description: string
  icon: typeof Monitor
}> = [
  {
    value: 'desktop',
    label: 'Desktop',
    description: 'Full-width preview',
    icon: Monitor,
  },
  {
    value: 'tablet',
    label: 'Tablet',
    description: '820px viewport',
    icon: Tablet,
  },
  {
    value: 'mobile',
    label: 'Mobile',
    description: '390px viewport',
    icon: Smartphone,
  },
]

const VIEWPORT_WIDTH_CLASSES: Record<
  PreviewViewport,
  string
> = {
  desktop: 'w-full max-w-none',
  tablet: 'w-full max-w-[820px]',
  mobile: 'w-full max-w-[390px]',
}

/* ------------------------------------------------ */
/* Component                                        */
/* ------------------------------------------------ */

export default function GuidePreviewToolbar({
  guideId,
  guideSlug,
  guideStatus,
  guideTitle,
  children,
  backHref = '/venue-admin',
  className,
}: Props) {
  const router = useRouter()

  const [viewport, setViewport] =
    useState<PreviewViewport>('desktop')

  const [isRefreshing, startRefresh] =
    useTransition()

  const [copied, setCopied] = useState(false)

  const publicGuideHref = useMemo(
    () => `/guide/${encodeURIComponent(guideSlug)}`,
    [guideSlug]
  )

  const previewHref = useMemo(
    () =>
      `/venue-admin/guides/${encodeURIComponent(
        guideId
      )}/preview`,
    [guideId]
  )

  useEffect(() => {
    if (!copied) return

    const timeout = window.setTimeout(() => {
      setCopied(false)
    }, 1800)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [copied])

  function handleRefresh() {
    startRefresh(() => {
      router.refresh()
    })
  }

  async function handleCopyPreviewLink() {
    try {
      const absoluteUrl = new URL(
        previewHref,
        window.location.origin
      ).toString()

      await navigator.clipboard.writeText(absoluteUrl)
      setCopied(true)
    } catch (error) {
      console.error(
        '[GuidePreviewToolbar] Failed to copy preview URL:',
        error
      )
    }
  }

  return (
    <div
      className={[
        'min-h-screen bg-neutral-900',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <header className="sticky top-0 z-[100] border-b border-neutral-800 bg-neutral-950/95 text-white shadow-xl shadow-black/20 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={backHref}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-neutral-400 transition hover:border-neutral-700 hover:text-white"
              aria-label="Return to guide administration"
              title="Return to guide administration"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-amber-200">
                  <Eye className="h-3 w-3" />
                  Preview mode
                </span>

                <GuideStatusPill status={guideStatus} />
              </div>

              <div className="mt-1 flex min-w-0 items-center gap-2">
                <h1 className="truncate text-sm font-semibold text-white">
                  {guideTitle?.trim() ||
                    'Property Guide Preview'}
                </h1>

                <span className="hidden truncate text-xs text-neutral-600 sm:inline">
                  /guide/{guideSlug}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <ViewportSelector
              viewport={viewport}
              onChange={setViewport}
            />

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopyPreviewLink}
                className={secondaryButtonClassName}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-300" />
                ) : (
                  <Laptop className="h-4 w-4" />
                )}

                {copied
                  ? 'Copied'
                  : 'Copy Preview Link'}
              </button>

              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className={secondaryButtonClassName}
              >
                {isRefreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}

                Refresh
              </button>

              {guideStatus === 'active' ? (
                <Link
                  href={publicGuideHref}
                  target="_blank"
                  rel="noreferrer"
                  className={primaryButtonClassName}
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Published Guide
                </Link>
              ) : (
                <span
                  className="inline-flex min-h-10 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs font-semibold text-neutral-600"
                  title="Publish this guide before opening a public version."
                >
                  Public guide unavailable
                </span>
              )}
            </div>
          </div>
        </div>

        <PreviewStatusStrip
          viewport={viewport}
          guideStatus={guideStatus}
        />
      </header>

      <main className="relative overflow-x-auto">
        <div className="pointer-events-none fixed inset-0 top-[120px] z-0">
          <div className="absolute left-[-10%] top-[-10%] h-96 w-96 rounded-full bg-cyan-500/5 blur-3xl" />
          <div className="absolute right-[-10%] top-[20%] h-96 w-96 rounded-full bg-indigo-500/5 blur-3xl" />
        </div>

        <div
          className={[
            'relative z-10 mx-auto min-h-[calc(100vh-7rem)] transition-[max-width] duration-300 ease-out',
            VIEWPORT_WIDTH_CLASSES[viewport],
            viewport === 'desktop'
              ? ''
              : 'my-5 overflow-hidden border border-neutral-700 bg-white shadow-2xl shadow-black/50',
            viewport === 'tablet'
              ? 'rounded-2xl'
              : '',
            viewport === 'mobile'
              ? 'rounded-[2rem]'
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {viewport !== 'desktop' ? (
            <DeviceFrameTop viewport={viewport} />
          ) : null}

          <div
            data-guide-preview-viewport={viewport}
            className={[
              'min-h-full',
              viewport === 'mobile'
                ? 'max-h-[calc(100vh-11rem)] overflow-y-auto'
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {children}
          </div>

          {viewport === 'mobile' ? (
            <MobileDeviceFooter />
          ) : null}
        </div>

        {viewport !== 'desktop' ? (
          <p className="relative z-10 pb-6 pt-1 text-center text-[11px] font-medium text-neutral-600">
            Simulated {viewport} viewport
          </p>
        ) : null}
      </main>
    </div>
  )
}

/* ------------------------------------------------ */
/* Viewport Selector                                */
/* ------------------------------------------------ */

function ViewportSelector({
  viewport,
  onChange,
}: {
  viewport: PreviewViewport
  onChange: (viewport: PreviewViewport) => void
}) {
  return (
    <div
      role="group"
      aria-label="Preview viewport"
      className="inline-flex rounded-full border border-neutral-800 bg-black/40 p-1"
    >
      {VIEWPORT_OPTIONS.map((option) => {
        const Icon = option.icon
        const active =
          viewport === option.value

        return (
          <button
            key={option.value}
            type="button"
            title={option.description}
            aria-pressed={active}
            onClick={() =>
              onChange(option.value)
            }
            className={[
              'inline-flex h-8 items-center justify-center gap-1.5 rounded-full px-2.5 text-xs font-semibold transition sm:px-3',
              active
                ? 'bg-cyan-300 text-neutral-950 shadow'
                : 'text-neutral-500 hover:bg-neutral-900 hover:text-white',
            ].join(' ')}
          >
            <Icon className="h-3.5 w-3.5" />

            <span className="hidden xl:inline">
              {option.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------ */
/* Preview Status Strip                             */
/* ------------------------------------------------ */

function PreviewStatusStrip({
  viewport,
  guideStatus,
}: {
  viewport: PreviewViewport
  guideStatus: GuideStatus
}) {
  const message =
    guideStatus === 'active'
      ? 'You are viewing the administrative preview of a published guide.'
      : guideStatus === 'archived'
        ? 'This archived guide is not publicly available.'
        : 'This draft guide is private and cannot be accessed from its public URL.'

  return (
    <div className="border-t border-neutral-800 bg-black/40 px-4 py-1.5">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-medium text-neutral-500">
          {message}
        </p>

        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
          {viewport === 'desktop'
            ? 'Responsive desktop'
            : viewport === 'tablet'
              ? '820px'
              : '390px'}
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------ */
/* Device Frames                                    */
/* ------------------------------------------------ */

function DeviceFrameTop({
  viewport,
}: {
  viewport: Exclude<
    PreviewViewport,
    'desktop'
  >
}) {
  if (viewport === 'mobile') {
    return (
      <div className="relative flex h-8 items-center justify-center bg-black">
        <div className="h-4 w-24 rounded-full bg-neutral-800" />

        <div className="absolute right-4 flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-neutral-700" />
          <span className="h-1.5 w-1.5 rounded-full bg-neutral-700" />
          <span className="h-1.5 w-1.5 rounded-full bg-neutral-700" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-8 items-center gap-1.5 border-b border-neutral-800 bg-neutral-950 px-3">
      <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
      <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />

      <div className="ml-3 h-4 flex-1 rounded-full bg-neutral-900" />
    </div>
  )
}

function MobileDeviceFooter() {
  return (
    <div className="flex h-7 items-center justify-center bg-black">
      <div className="h-1 w-24 rounded-full bg-neutral-700" />
    </div>
  )
}

/* ------------------------------------------------ */
/* Status                                           */
/* ------------------------------------------------ */

function GuideStatusPill({
  status,
}: {
  status: GuideStatus
}) {
  const className =
    status === 'active'
      ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
      : status === 'draft'
        ? 'border-amber-400/30 bg-amber-400/10 text-amber-200'
        : 'border-neutral-700 bg-neutral-900 text-neutral-400'

  const dotClassName =
    status === 'active'
      ? 'bg-emerald-400'
      : status === 'draft'
        ? 'bg-amber-400'
        : 'bg-neutral-500'

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]',
        className,
      ].join(' ')}
    >
      <span
        className={[
          'h-1.5 w-1.5 rounded-full',
          dotClassName,
        ].join(' ')}
      />

      {status}
    </span>
  )
}

/* ------------------------------------------------ */
/* Button Styles                                    */
/* ------------------------------------------------ */

const primaryButtonClassName = [
  'inline-flex min-h-10 items-center justify-center gap-2',
  'rounded-full bg-cyan-300 px-3 py-2',
  'text-xs font-bold text-neutral-950',
  'transition hover:bg-cyan-200',
].join(' ')

const secondaryButtonClassName = [
  'inline-flex min-h-10 items-center justify-center gap-2',
  'rounded-full border border-neutral-800',
  'bg-neutral-900 px-3 py-2',
  'text-xs font-semibold text-neutral-300',
  'transition hover:border-neutral-700 hover:bg-neutral-800 hover:text-white',
  'disabled:cursor-not-allowed disabled:opacity-50',
].join(' ')