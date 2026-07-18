// components/guides/GuideFooter.tsx

import Link from 'next/link'
import type { ReactNode } from 'react'

import {
  getGuideCopy,
  type GuideCopy,
} from '@/lib/guides/guideCopy'

import {
  shouldShowPoweredByRoam,
} from '@/lib/guides/guideTheme'

import type {
  GuideConfig,
} from '@/lib/guides/types'

/* ------------------------------------------------ */
/* Types                                            */
/* ------------------------------------------------ */

export type GuideFooterLink = {
  label: string
  href: string
  external?: boolean
  ariaLabel?: string | null
}

export type GuideFooterProps = {
  guide: GuideConfig
  copy?: GuideCopy

  primaryLinks?: GuideFooterLink[]
  secondaryLinks?: GuideFooterLink[]

  showPropertyWebsite?: boolean
  showBackToTop?: boolean
  showPoweredByRoam?: boolean
  showGuideIdentity?: boolean

  backToTopHref?: string
  roamHref?: string

  copyrightLabel?: string | null

  className?: string
  contentClassName?: string

  children?: ReactNode
}

/* ------------------------------------------------ */
/* Component                                        */
/* ------------------------------------------------ */

export default function GuideFooter({
  guide,
  copy: suppliedCopy,

  primaryLinks = [],
  secondaryLinks = [],

  showPropertyWebsite = true,
  showBackToTop = true,
  showPoweredByRoam: suppliedShowPoweredByRoam,
  showGuideIdentity = true,

  backToTopHref = '#top',
  roamHref = '/',

  copyrightLabel,

  className,
  contentClassName,

  children,
}: GuideFooterProps) {
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

  const propertyWebsite = normalizeWebsiteUrl(
    guide.property.website
  )

  const logoUrl = cleanAssetUrl(
    guide.brand.logoUrl
  )

  const shouldRenderPoweredByRoam =
    typeof suppliedShowPoweredByRoam === 'boolean'
      ? suppliedShowPoweredByRoam
      : shouldShowPoweredByRoam(
          guide.brand,
          guide.poweredByRoam
        )

  const footerPrimaryLinks = dedupeFooterLinks([
    ...primaryLinks,
    ...(showPropertyWebsite && propertyWebsite
      ? [
          {
            label: `${guide.property.name} Website`,
            href: propertyWebsite,
            external: true,
          },
        ]
      : []),
  ])

  const footerSecondaryLinks = dedupeFooterLinks(
    secondaryLinks
  )

  const resolvedCopyrightLabel =
    cleanNullableText(copyrightLabel) ??
    `© ${new Date().getFullYear()} ${guide.brand.name}`

  return (
    <footer
      className={[
        'border-t border-[var(--guide-border)]',
        'bg-[var(--guide-surface)]',
        'text-[var(--guide-text)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className={[
          'mx-auto w-full max-w-6xl px-4 py-8',
          'sm:px-6 sm:py-10',
          'lg:px-8',
          contentClassName,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="min-w-0 space-y-4">
            {showGuideIdentity ? (
              <GuideFooterIdentity
                guide={guide}
                logoUrl={logoUrl}
                curatedByLabel={copy.system.curatedBy}
              />
            ) : null}

            {children ? (
              <div className="max-w-2xl text-sm leading-6 text-[var(--guide-muted-text)]">
                {children}
              </div>
            ) : null}

            {footerPrimaryLinks.length > 0 ? (
              <nav
                aria-label="Guide footer links"
                className="flex flex-wrap gap-x-4 gap-y-2"
              >
                {footerPrimaryLinks.map((link) => (
                  <GuideFooterLinkControl
                    key={`${link.label}-${link.href}`}
                    link={link}
                    variant="primary"
                  />
                ))}
              </nav>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            {showBackToTop ? (
              <a
                href={backToTopHref}
                className={[
                  'inline-flex min-h-10 items-center justify-center',
                  'rounded-full border border-[var(--guide-border)]',
                  'bg-[var(--guide-surface-elevated)]',
                  'px-4 py-2 text-sm font-semibold',
                  'text-[var(--guide-text)]',
                  'transition hover:brightness-105',
                  'focus-visible:outline-none',
                  'focus-visible:ring-2',
                  'focus-visible:ring-[var(--guide-focus-ring)]',
                  'focus-visible:ring-offset-2',
                  'focus-visible:ring-offset-[var(--guide-background)]',
                ].join(' ')}
              >
                Back to top
                <span
                  aria-hidden="true"
                  className="ml-2"
                >
                  ↑
                </span>
              </a>
            ) : null}

            {footerSecondaryLinks.length > 0 ? (
              <nav
                aria-label="Secondary guide footer links"
                className="flex flex-wrap gap-x-4 gap-y-2 lg:justify-end"
              >
                {footerSecondaryLinks.map((link) => (
                  <GuideFooterLinkControl
                    key={`${link.label}-${link.href}`}
                    link={link}
                    variant="secondary"
                  />
                ))}
              </nav>
            ) : null}
          </div>
        </div>

        <div
          className={[
            'mt-8 flex flex-col gap-3',
            'border-t border-[var(--guide-subtle-border)] pt-5',
            'sm:flex-row sm:items-center sm:justify-between',
          ].join(' ')}
        >
          <p className="text-xs text-[var(--guide-muted-text)]">
            {resolvedCopyrightLabel}
          </p>

          {shouldRenderPoweredByRoam ? (
            <PoweredByRoam
              href={roamHref}
              label={
                cleanNullableText(copy.system.poweredByRoam) ??
                'Powered by Roam'
              }
            />
          ) : (
            <p className="text-xs text-[var(--guide-muted-text)]">
              {getBrandingDescriptor(guide)}
            </p>
          )}
        </div>
      </div>
    </footer>
  )
}

/* ------------------------------------------------ */
/* Identity                                         */
/* ------------------------------------------------ */

function GuideFooterIdentity({
  guide,
  logoUrl,
  curatedByLabel,
}: {
  guide: GuideConfig
  logoUrl: string | null
  curatedByLabel: string
}) {
  return (
    <div className="flex items-start gap-3">
      {logoUrl ? (
        <div
          className={[
            'flex h-12 min-w-12 max-w-[11rem] items-center justify-center',
            'rounded-xl border border-[var(--guide-border)]',
            'bg-[var(--guide-surface-elevated)]',
            'px-3 py-2',
          ].join(' ')}
        >
          <img
            src={logoUrl}
            alt={`${guide.brand.name} logo`}
            className="max-h-8 max-w-full object-contain"
          />
        </div>
      ) : (
        <div
          aria-hidden="true"
          className={[
            'flex h-11 w-11 shrink-0 items-center justify-center',
            'rounded-xl border border-[var(--guide-border)]',
            'bg-[var(--guide-primary)]',
            'text-sm font-black uppercase',
            'text-[var(--guide-button-text)]',
          ].join(' ')}
        >
          {getBrandInitials(guide.brand.name)}
        </div>
      )}

      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--guide-text)]">
          {guide.title}
        </p>

        <p className="mt-0.5 text-xs text-[var(--guide-muted-text)]">
          {curatedByLabel}
        </p>

        {guide.property.city ? (
          <p className="mt-1 text-xs text-[var(--guide-muted-text)]">
            {guide.property.city}
          </p>
        ) : null}
      </div>
    </div>
  )
}

/* ------------------------------------------------ */
/* Powered By Roam                                  */
/* ------------------------------------------------ */

function PoweredByRoam({
  href,
  label,
}: {
  href: string
  label: string
}) {
  const normalizedHref =
    cleanNullableText(href) ?? '/'

  const content = (
    <>
      <span className="text-[var(--guide-muted-text)]">
        {stripPoweredByPrefix(label)}
      </span>

      <span
        className={[
          'ml-1.5 inline-flex items-center rounded-full',
          'border border-[var(--guide-border)]',
          'bg-[var(--guide-surface-elevated)]',
          'px-2 py-0.5 font-semibold',
          'text-[var(--guide-text)]',
        ].join(' ')}
      >
        Roam
      </span>
    </>
  )

  if (isExternalUrl(normalizedHref)) {
    return (
      <a
        href={normalizedHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Powered by Roam"
        className={[
          'inline-flex items-center text-xs',
          'transition hover:brightness-110',
          'focus-visible:outline-none',
          'focus-visible:ring-2',
          'focus-visible:ring-[var(--guide-focus-ring)]',
        ].join(' ')}
      >
        {content}
      </a>
    )
  }

  return (
    <Link
      href={normalizedHref}
      aria-label="Powered by Roam"
      className={[
        'inline-flex items-center text-xs',
        'transition hover:brightness-110',
        'focus-visible:outline-none',
        'focus-visible:ring-2',
        'focus-visible:ring-[var(--guide-focus-ring)]',
      ].join(' ')}
    >
      {content}
    </Link>
  )
}

/* ------------------------------------------------ */
/* Link Control                                     */
/* ------------------------------------------------ */

function GuideFooterLinkControl({
  link,
  variant,
}: {
  link: GuideFooterLink
  variant: 'primary' | 'secondary'
}) {
  const label = cleanNullableText(link.label)
  const href = cleanNullableText(link.href)

  if (!label || !href) {
    return null
  }

  const className =
    variant === 'primary'
      ? [
          'inline-flex items-center text-sm font-semibold',
          'text-[var(--guide-accent)]',
          'underline-offset-4 transition',
          'hover:underline hover:brightness-110',
          'focus-visible:outline-none',
          'focus-visible:ring-2',
          'focus-visible:ring-[var(--guide-focus-ring)]',
        ].join(' ')
      : [
          'inline-flex items-center text-xs font-medium',
          'text-[var(--guide-muted-text)]',
          'underline-offset-4 transition',
          'hover:text-[var(--guide-text)] hover:underline',
          'focus-visible:outline-none',
          'focus-visible:ring-2',
          'focus-visible:ring-[var(--guide-focus-ring)]',
        ].join(' ')

  const external =
    link.external === true ||
    isExternalUrl(href)

  const content = (
    <>
      <span>{label}</span>

      {external ? (
        <span
          aria-hidden="true"
          className="ml-1"
        >
          ↗
        </span>
      ) : null}
    </>
  )

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={
          cleanNullableText(link.ariaLabel) ??
          label
        }
        className={className}
      >
        {content}
      </a>
    )
  }

  if (href.startsWith('#')) {
    return (
      <a
        href={href}
        aria-label={
          cleanNullableText(link.ariaLabel) ??
          label
        }
        className={className}
      >
        {content}
      </a>
    )
  }

  return (
    <Link
      href={href}
      aria-label={
        cleanNullableText(link.ariaLabel) ??
        label
      }
      className={className}
    >
      {content}
    </Link>
  )
}

/* ------------------------------------------------ */
/* Helpers                                          */
/* ------------------------------------------------ */

function getBrandInitials(
  value: string
) {
  const words = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) return 'G'

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase()
  }

  return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase()
}

function getBrandingDescriptor(
  guide: GuideConfig
) {
  if (guide.brand.brandingMode === 'white_label') {
    return `${guide.brand.name} guide`
  }

  if (guide.brand.brandingMode === 'co_branded') {
    return `${guide.brand.name} × ${guide.property.name}`
  }

  return `${guide.property.name} guide`
}

function stripPoweredByPrefix(
  value: string
) {
  const cleaned = value
    .replace(/^powered\s+by\s+/i, '')
    .trim()

  return cleaned &&
    cleaned.toLowerCase() !== 'roam'
    ? `Powered by ${cleaned}`
    : 'Powered by'
}

function dedupeFooterLinks(
  links: GuideFooterLink[]
) {
  const seen = new Set<string>()
  const result: GuideFooterLink[] = []

  for (const link of links) {
    const label = cleanNullableText(link.label)
    const href = cleanNullableText(link.href)

    if (!label || !href) continue

    const key = `${label.toLowerCase()}::${href}`

    if (seen.has(key)) continue

    seen.add(key)

    result.push({
      ...link,
      label,
      href,
    })
  }

  return result
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
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('data:')
  ) {
    return null
  }

  return `https://${trimmed}`
}

function cleanAssetUrl(
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

function isExternalUrl(
  href: string
) {
  return (
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('//') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:')
  )
}

function cleanNullableText(
  value: string | null | undefined
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  return trimmed || null
}