// components/guides/PoweredByRoam.tsx

import Link from 'next/link'

/* ------------------------------------------------ */
/* Types                                            */
/* ------------------------------------------------ */

export type PoweredByRoamVariant =
  | 'inline'
  | 'pill'
  | 'compact'
  | 'stacked'

export type PoweredByRoamProps = {
  href?: string | null
  label?: string | null

  variant?: PoweredByRoamVariant

  external?: boolean
  showMark?: boolean
  showArrow?: boolean

  ariaLabel?: string | null

  className?: string
  markClassName?: string
  labelClassName?: string
}

/* ------------------------------------------------ */
/* Component                                        */
/* ------------------------------------------------ */

export default function PoweredByRoam({
  href = '/',
  label = 'Powered by',

  variant = 'inline',

  external,
  showMark = true,
  showArrow = false,

  ariaLabel = 'Powered by Roam',

  className,
  markClassName,
  labelClassName,
}: PoweredByRoamProps) {
  const normalizedHref = normalizeHref(href)
  const normalizedLabel = normalizePoweredByLabel(label)

  const resolvedExternal =
    typeof external === 'boolean'
      ? external
      : isExternalUrl(normalizedHref)

  const content = (
    <span
      className={[
        'inline-flex min-w-0 items-center',
        getContainerClassName(variant),
      ].join(' ')}
    >
      {normalizedLabel ? (
        <span
          className={[
            'truncate text-[var(--guide-muted-text)]',
            getLabelClassName(variant),
            labelClassName,
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {normalizedLabel}
        </span>
      ) : null}

      {showMark ? (
        <span
          className={[
            'inline-flex shrink-0 items-center justify-center',
            'border border-[var(--guide-border)]',
            'bg-[var(--guide-surface-elevated)]',
            'font-bold tracking-tight text-[var(--guide-text)]',
            getMarkClassName(variant),
            markClassName,
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <RoamMark variant={variant} />
        </span>
      ) : (
        <span
          className={[
            'shrink-0 font-bold tracking-tight text-[var(--guide-text)]',
            getPlainBrandClassName(variant),
            markClassName,
          ]
            .filter(Boolean)
            .join(' ')}
        >
          Roam
        </span>
      )}

      {showArrow ? (
        <span
          aria-hidden="true"
          className="shrink-0 text-[var(--guide-muted-text)]"
        >
          {resolvedExternal ? '↗' : '→'}
        </span>
      ) : null}
    </span>
  )

  const sharedClassName = [
    'inline-flex max-w-full items-center rounded-md',
    'transition hover:brightness-110',
    'focus-visible:outline-none',
    'focus-visible:ring-2',
    'focus-visible:ring-[var(--guide-focus-ring)]',
    'focus-visible:ring-offset-2',
    'focus-visible:ring-offset-[var(--guide-background)]',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const resolvedAriaLabel =
    cleanNullableText(ariaLabel) ??
    'Powered by Roam'

  if (resolvedExternal) {
    return (
      <a
        href={normalizedHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={resolvedAriaLabel}
        className={sharedClassName}
      >
        {content}
      </a>
    )
  }

  if (normalizedHref.startsWith('#')) {
    return (
      <a
        href={normalizedHref}
        aria-label={resolvedAriaLabel}
        className={sharedClassName}
      >
        {content}
      </a>
    )
  }

  return (
    <Link
      href={normalizedHref}
      aria-label={resolvedAriaLabel}
      className={sharedClassName}
    >
      {content}
    </Link>
  )
}

/* ------------------------------------------------ */
/* Roam Mark                                        */
/* ------------------------------------------------ */

function RoamMark({
  variant,
}: {
  variant: PoweredByRoamVariant
}) {
  if (variant === 'compact') {
    return (
      <span aria-hidden="true">
        R
      </span>
    )
  }

  return (
    <span aria-hidden="true">
      Roam
    </span>
  )
}

/* ------------------------------------------------ */
/* Variant Classes                                  */
/* ------------------------------------------------ */

function getContainerClassName(
  variant: PoweredByRoamVariant
) {
  if (variant === 'stacked') {
    return 'flex-col items-start gap-1'
  }

  if (variant === 'compact') {
    return 'gap-1'
  }

  if (variant === 'pill') {
    return 'gap-2 rounded-full border border-[var(--guide-border)] bg-[var(--guide-surface)] px-2.5 py-1.5'
  }

  return 'gap-1.5'
}

function getLabelClassName(
  variant: PoweredByRoamVariant
) {
  if (variant === 'stacked') {
    return 'text-[10px] font-medium uppercase tracking-[0.16em]'
  }

  if (variant === 'compact') {
    return 'text-[10px]'
  }

  return 'text-xs'
}

function getMarkClassName(
  variant: PoweredByRoamVariant
) {
  if (variant === 'compact') {
    return 'h-5 w-5 rounded-md text-[10px]'
  }

  if (variant === 'stacked') {
    return 'rounded-full px-2 py-0.5 text-xs'
  }

  if (variant === 'pill') {
    return 'rounded-full px-2 py-0.5 text-xs'
  }

  return 'rounded-full px-2 py-0.5 text-xs'
}

function getPlainBrandClassName(
  variant: PoweredByRoamVariant
) {
  if (variant === 'compact') {
    return 'text-[10px]'
  }

  return 'text-xs'
}

/* ------------------------------------------------ */
/* Label Helpers                                    */
/* ------------------------------------------------ */

function normalizePoweredByLabel(
  value: string | null | undefined
): string {
  const cleaned = cleanNullableText(value)

  if (!cleaned) {
    return 'Powered by'
  }

  const withoutRoam = cleaned
    .replace(/\s+roam$/i, '')
    .trim()

  if (!withoutRoam) {
    return 'Powered by'
  }

  if (/^powered\s+by$/i.test(withoutRoam)) {
    return 'Powered by'
  }

  if (/^powered\s+by\s+/i.test(withoutRoam)) {
    return withoutRoam
  }

  return withoutRoam
}

/* ------------------------------------------------ */
/* URL Helpers                                      */
/* ------------------------------------------------ */

function normalizeHref(
  value: string | null | undefined
): string {
  const cleaned = cleanNullableText(value)

  if (!cleaned) {
    return '/'
  }

  if (isSafeHref(cleaned)) {
    return cleaned
  }

  return '/'
}

function isSafeHref(
  href: string
) {
  const normalized = href.trim().toLowerCase()

  if (
    normalized.startsWith('javascript:') ||
    normalized.startsWith('data:') ||
    normalized.startsWith('vbscript:')
  ) {
    return false
  }

  return (
    href.startsWith('/') ||
    href.startsWith('#') ||
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('//') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:')
  )
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

/* ------------------------------------------------ */
/* Text Helpers                                     */
/* ------------------------------------------------ */

function cleanNullableText(
  value: string | null | undefined
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  return trimmed || null
}