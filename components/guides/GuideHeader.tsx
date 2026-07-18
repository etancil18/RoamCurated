// components/guides/GuideHeader.tsx

import Link from 'next/link'

import {
  getGuideCopy,
  type GuideCopy,
} from '@/lib/guides/guideCopy'

import type {
  GuideConfig,
  GuideStatus,
} from '@/lib/guides/types'

/* ------------------------------------------------ */
/* Types                                            */
/* ------------------------------------------------ */

type Props = {
  guide: GuideConfig
  copy?: GuideCopy

  isPreview?: boolean
  showBackLink?: boolean
  backHref?: string
  backLabel?: string

  className?: string
}

/* ------------------------------------------------ */
/* Component                                        */
/* ------------------------------------------------ */

export default function GuideHeader({
  guide,
  copy: suppliedCopy,
  isPreview = false,
  showBackLink = false,
  backHref = '/',
  backLabel,
  className,
}: Props) {
  const copy =
    suppliedCopy ??
    getGuideCopy({
      mode: guide.guideMode,
      propertyName: guide.property.name,
      brandName: guide.brand.name,
      city: guide.property.city,
      guideTitle: guide.title,
      guideSubtitle: guide.subtitle,
      welcomeHeading: guide.welcomeHeading,
      welcomeDescription: guide.welcomeDescription,
      poweredByRoam: guide.poweredByRoam,
    })

  const logoUrl = cleanUrl(guide.brand.logoUrl)
  const heroImageUrl = cleanUrl(guide.heroImageUrl)
  const websiteUrl = normalizeWebsiteUrl(guide.property.website)

  const eyebrow = getGuideEyebrow({
    mode: guide.guideMode,
    propertyName: guide.property.name,
    brandName: guide.brand.name,
  })

  return (
    <header
      className={[
        'relative isolate overflow-hidden border-b border-[var(--guide-border)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {heroImageUrl ? (
        <div className="absolute inset-0 -z-20">
          <img
            src={heroImageUrl}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover"
          />

          <div className="absolute inset-0 bg-[var(--guide-overlay)]" />

          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to bottom, transparent 0%, var(--guide-background) 100%)',
            }}
          />
        </div>
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-20"
          style={{
            background:
              'radial-gradient(circle at top right, color-mix(in srgb, var(--guide-primary) 22%, transparent), transparent 42%), radial-gradient(circle at bottom left, color-mix(in srgb, var(--guide-accent) 14%, transparent), transparent 40%), var(--guide-background)',
          }}
        />
      )}

      <div className="mx-auto w-full max-w-6xl px-4 pb-8 pt-4 sm:px-6 sm:pb-10 sm:pt-6 lg:px-8">
        <div className="flex min-h-10 items-center justify-between gap-3">
          <div className="min-w-0">
            {showBackLink ? (
              <Link
                href={backHref}
                className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--guide-border)] bg-[var(--guide-surface)]/90 px-3 py-2 text-sm font-semibold text-[var(--guide-text)] backdrop-blur transition hover:bg-[var(--guide-surface-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--guide-focus-ring)]"
              >
                <span aria-hidden="true">←</span>
                <span className="truncate">
                  {backLabel || copy.actions.backToGuide}
                </span>
              </Link>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {isPreview ? (
              <HeaderBadge tone="preview">
                Preview
              </HeaderBadge>
            ) : null}

            {guide.status !== 'active' ? (
              <HeaderBadge tone="status">
                {getStatusLabel(guide.status, copy)}
              </HeaderBadge>
            ) : null}
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0 space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              {logoUrl ? (
                <div className="flex max-w-[13rem] items-center rounded-2xl border border-[var(--guide-border)] bg-[var(--guide-surface)]/90 px-3 py-2 shadow-lg backdrop-blur">
                  <img
                    src={logoUrl}
                    alt={`${guide.brand.name} logo`}
                    className="max-h-10 w-auto max-w-full object-contain"
                  />
                </div>
              ) : (
                <div className="inline-flex items-center rounded-full border border-[var(--guide-border)] bg-[var(--guide-surface)]/90 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-[var(--guide-accent)] backdrop-blur">
                  {guide.brand.name}
                </div>
              )}

              {guide.brand.brandingMode === 'co_branded' &&
              guide.brand.name !== guide.property.name ? (
                <span className="text-xs font-medium text-[var(--guide-muted-text)]">
                  In partnership with {guide.property.name}
                </span>
              ) : null}
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--guide-accent)]">
                {eyebrow}
              </p>

              <h1 className="max-w-4xl text-balance text-3xl font-semibold tracking-tight text-[var(--guide-text)] sm:text-4xl lg:text-5xl">
                {copy.pageTitle}
              </h1>

              {copy.pageSubtitle ? (
                <p className="max-w-3xl text-pretty text-base leading-7 text-[var(--guide-muted-text)] sm:text-lg">
                  {copy.pageSubtitle}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--guide-muted-text)]">
              {guide.property.city ? (
                <MetaItem icon="location">
                  {guide.property.city}
                </MetaItem>
              ) : null}

              {guide.property.address ? (
                <MetaItem icon="pin">
                  {guide.property.address}
                </MetaItem>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 lg:max-w-xs lg:justify-end">
            {websiteUrl ? (
              <a
                href={websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--guide-border)] bg-[var(--guide-surface)]/90 px-4 py-2.5 text-sm font-semibold text-[var(--guide-text)] shadow-sm backdrop-blur transition hover:bg-[var(--guide-surface-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--guide-focus-ring)]"
              >
                Hotel Website
                <span className="ml-2" aria-hidden="true">
                  ↗
                </span>
              </a>
            ) : null}

            <a
              href="#guide-content"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-transparent bg-[var(--guide-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--guide-button-text)] shadow-sm transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--guide-focus-ring)]"
            >
              Explore the Guide
              <span className="ml-2" aria-hidden="true">
                ↓
              </span>
            </a>
          </div>
        </div>

        {(copy.welcomeHeading || copy.welcomeDescription) && (
          <div className="mt-8 max-w-3xl rounded-2xl border border-[var(--guide-border)] bg-[var(--guide-surface)]/85 p-4 shadow-xl backdrop-blur sm:p-5">
            {copy.welcomeHeading ? (
              <h2 className="text-base font-semibold text-[var(--guide-text)] sm:text-lg">
                {copy.welcomeHeading}
              </h2>
            ) : null}

            {copy.welcomeDescription ? (
              <p className="mt-1.5 text-sm leading-6 text-[var(--guide-muted-text)] sm:text-base sm:leading-7">
                {copy.welcomeDescription}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </header>
  )
}

/* ------------------------------------------------ */
/* Supporting Components                            */
/* ------------------------------------------------ */

function HeaderBadge({
  children,
  tone,
}: {
  children: React.ReactNode
  tone: 'preview' | 'status'
}) {
  const classes =
    tone === 'preview'
      ? 'border-amber-300/40 bg-amber-300/15 text-amber-200'
      : 'border-[var(--guide-border)] bg-[var(--guide-surface)] text-[var(--guide-muted-text)]'

  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
        classes,
      ].join(' ')}
    >
      {children}
    </span>
  )
}

function MetaItem({
  icon,
  children,
}: {
  icon: 'location' | 'pin'
  children: React.ReactNode
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span
        aria-hidden="true"
        className="shrink-0 text-[var(--guide-accent)]"
      >
        {icon === 'location' ? '●' : '⌖'}
      </span>

      <span className="min-w-0">
        {children}
      </span>
    </span>
  )
}

/* ------------------------------------------------ */
/* Copy Helpers                                     */
/* ------------------------------------------------ */

function getGuideEyebrow({
  mode,
  propertyName,
  brandName,
}: {
  mode: GuideConfig['guideMode']
  propertyName: string
  brandName: string
}) {
  if (mode === 'hotel') {
    return `${propertyName} local guide`
  }

  if (mode === 'concierge') {
    return `${propertyName} concierge`
  }

  if (mode === 'partner') {
    return `${brandName} local guide`
  }

  return 'Roam guide'
}

function getStatusLabel(
  status: GuideStatus,
  copy: GuideCopy
) {
  return copy.statuses[status]
}

/* ------------------------------------------------ */
/* URL Helpers                                      */
/* ------------------------------------------------ */

function cleanUrl(
  value: string | null | undefined
): string | null {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()

  if (!trimmed) return null

  if (
    trimmed.startsWith('/') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://')
  ) {
    return trimmed
  }

  return null
}

function normalizeWebsiteUrl(
  value: string | null | undefined
): string | null {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()

  if (!trimmed) return null

  if (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://')
  ) {
    return trimmed
  }

  if (
    trimmed.startsWith('/') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('javascript:')
  ) {
    return null
  }

  return `https://${trimmed}`
}