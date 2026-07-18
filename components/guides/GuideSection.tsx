// components/guides/GuideSection.tsx

'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

import {
  getGuideSectionCopy,
  type GuideCopyContext,
  type GuideSectionCopy,
} from '@/lib/guides/guideCopy'

import type {
  GuideSectionConfig,
  GuideSectionDisplayStyle,
  GuideSectionKey,
} from '@/lib/guides/types'

/* ------------------------------------------------ */
/* Types                                            */
/* ------------------------------------------------ */

export type GuideSectionAction = {
  label: string
  href?: string | null
  onClick?: (() => void) | null
  external?: boolean
  disabled?: boolean
  ariaLabel?: string | null
}

export type GuideSectionProps = {
  sectionKey: GuideSectionKey

  section?: GuideSectionConfig | null
  copyContext?: GuideCopyContext
  copy?: GuideSectionCopy | null

  children?: ReactNode

  eyebrow?: string | null
  title?: string | null
  subtitle?: string | null

  action?: GuideSectionAction | null
  secondaryAction?: GuideSectionAction | null

  isEmpty?: boolean
  emptyTitle?: string | null
  emptyDescription?: string | null
  emptyAction?: GuideSectionAction | null

  displayStyle?: GuideSectionDisplayStyle
  itemCount?: number | null

  showDivider?: boolean
  contained?: boolean
  compact?: boolean
  hideHeader?: boolean

  id?: string
  className?: string
  headerClassName?: string
  contentClassName?: string
  emptyStateClassName?: string

  ariaLabel?: string
}

/* ------------------------------------------------ */
/* Component                                        */
/* ------------------------------------------------ */

export default function GuideSection({
  sectionKey,

  section,
  copyContext,
  copy: suppliedCopy,

  children,

  eyebrow,
  title,
  subtitle,

  action,
  secondaryAction,

  isEmpty = false,
  emptyTitle,
  emptyDescription,
  emptyAction,

  displayStyle,
  itemCount,

  showDivider = false,
  contained = false,
  compact = false,
  hideHeader = false,

  id,
  className,
  headerClassName,
  contentClassName,
  emptyStateClassName,

  ariaLabel,
}: GuideSectionProps) {
  if (section && !section.isVisible) {
    return null
  }

  const defaultCopy =
    suppliedCopy ??
    getGuideSectionCopy(sectionKey, copyContext ?? {})

  const resolvedEyebrow =
    cleanNullableText(eyebrow) ??
    cleanNullableText(defaultCopy.eyebrow)

  const resolvedTitle =
    cleanNullableText(title) ??
    cleanNullableText(section?.title) ??
    cleanNullableText(defaultCopy.title) ??
    humanizeSectionKey(sectionKey)

  const resolvedSubtitle =
    cleanNullableText(subtitle) ??
    cleanNullableText(section?.subtitle) ??
    cleanNullableText(defaultCopy.subtitle)

  const resolvedEmptyTitle =
    cleanNullableText(emptyTitle) ??
    cleanNullableText(defaultCopy.emptyTitle) ??
    'Nothing to show yet'

  const resolvedEmptyDescription =
    cleanNullableText(emptyDescription) ??
    cleanNullableText(defaultCopy.emptyDescription)

  const resolvedDisplayStyle =
    displayStyle ??
    section?.config?.displayStyle ??
    'grid'

  const resolvedSectionId =
    cleanNullableText(id) ??
    buildSectionId(sectionKey)

  const headingId = `${resolvedSectionId}-title`

  const normalizedItemCount =
    typeof itemCount === 'number' &&
    Number.isFinite(itemCount) &&
    itemCount >= 0
      ? Math.round(itemCount)
      : null

  return (
    <section
      id={resolvedSectionId}
      aria-label={ariaLabel}
      aria-labelledby={!hideHeader ? headingId : undefined}
      data-guide-section={sectionKey}
      data-guide-section-style={resolvedDisplayStyle}
      className={[
        'scroll-mt-24',
        showDivider
          ? 'border-t border-[var(--guide-subtle-border)] pt-8 sm:pt-10'
          : '',
        compact ? 'space-y-4' : 'space-y-5 sm:space-y-6',
        contained
          ? [
              'rounded-[1.5rem]',
              'border border-[var(--guide-border)]',
              'bg-[var(--guide-surface)]',
              'p-4 shadow-sm sm:p-6',
            ].join(' ')
          : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {!hideHeader ? (
        <GuideSectionHeader
          id={headingId}
          eyebrow={resolvedEyebrow}
          title={resolvedTitle}
          subtitle={resolvedSubtitle}
          itemCount={normalizedItemCount}
          action={isEmpty ? null : action}
          secondaryAction={isEmpty ? null : secondaryAction}
          compact={compact}
          className={headerClassName}
        />
      ) : null}

      {isEmpty ? (
        <GuideSectionEmptyState
          title={resolvedEmptyTitle}
          description={resolvedEmptyDescription}
          action={emptyAction}
          compact={compact}
          className={emptyStateClassName}
        />
      ) : (
        <div
          data-guide-section-content={sectionKey}
          data-display-style={resolvedDisplayStyle}
          className={[
            getContentLayoutClassName(resolvedDisplayStyle),
            contentClassName,
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {children}
        </div>
      )}
    </section>
  )
}

/* ------------------------------------------------ */
/* Header                                           */
/* ------------------------------------------------ */

function GuideSectionHeader({
  id,
  eyebrow,
  title,
  subtitle,
  itemCount,
  action,
  secondaryAction,
  compact,
  className,
}: {
  id: string
  eyebrow: string | null
  title: string
  subtitle: string | null
  itemCount: number | null
  action?: GuideSectionAction | null
  secondaryAction?: GuideSectionAction | null
  compact: boolean
  className?: string
}) {
  const hasPrimaryAction = isUsableAction(action)
  const hasSecondaryAction = isUsableAction(secondaryAction)

  return (
    <div
      className={[
        'flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
        compact ? 'gap-3' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="min-w-0 max-w-3xl">
        {eyebrow ? (
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--guide-accent)] sm:text-xs">
            {eyebrow}
          </p>
        ) : null}

        <div
          className={[
            'flex flex-wrap items-center gap-2',
            eyebrow ? 'mt-1.5' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <h2
            id={id}
            className={[
              'font-semibold tracking-tight text-[var(--guide-text)]',
              compact
                ? 'text-lg sm:text-xl'
                : 'text-xl sm:text-2xl',
            ].join(' ')}
          >
            {title}
          </h2>

          {itemCount !== null ? (
            <span
              aria-label={`${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}
              className={[
                'inline-flex min-w-6 items-center justify-center',
                'rounded-full border border-[var(--guide-border)]',
                'bg-[var(--guide-surface-elevated)]',
                'px-2 py-0.5 text-xs font-semibold',
                'text-[var(--guide-muted-text)]',
              ].join(' ')}
            >
              {itemCount}
            </span>
          ) : null}
        </div>

        {subtitle ? (
          <p
            className={[
              'max-w-2xl text-[var(--guide-muted-text)]',
              compact
                ? 'mt-1 text-xs leading-5 sm:text-sm'
                : 'mt-1.5 text-sm leading-6 sm:text-base sm:leading-7',
            ].join(' ')}
          >
            {subtitle}
          </p>
        ) : null}
      </div>

      {hasPrimaryAction || hasSecondaryAction ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {hasSecondaryAction && secondaryAction ? (
            <GuideSectionActionControl
              action={secondaryAction}
              variant="secondary"
            />
          ) : null}

          {hasPrimaryAction && action ? (
            <GuideSectionActionControl
              action={action}
              variant="primary"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------ */
/* Empty State                                      */
/* ------------------------------------------------ */

function GuideSectionEmptyState({
  title,
  description,
  action,
  compact,
  className,
}: {
  title: string
  description: string | null
  action?: GuideSectionAction | null
  compact: boolean
  className?: string
}) {
  return (
    <div
      role="status"
      className={[
        'rounded-2xl border border-dashed border-[var(--guide-border)]',
        'bg-[var(--guide-surface)] text-center',
        compact
          ? 'px-4 py-6'
          : 'px-5 py-8 sm:px-8 sm:py-10',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        aria-hidden="true"
        className={[
          'mx-auto flex h-10 w-10 items-center justify-center',
          'rounded-full border border-[var(--guide-border)]',
          'bg-[var(--guide-surface-elevated)]',
          'text-lg font-medium text-[var(--guide-accent)]',
        ].join(' ')}
      >
        +
      </div>

      <h3 className="mt-3 text-sm font-semibold text-[var(--guide-text)] sm:text-base">
        {title}
      </h3>

      {description ? (
        <p className="mx-auto mt-1.5 max-w-lg text-sm leading-6 text-[var(--guide-muted-text)]">
          {description}
        </p>
      ) : null}

      {isUsableAction(action) && action ? (
        <div className="mt-4 flex justify-center">
          <GuideSectionActionControl
            action={action}
            variant="secondary"
          />
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------ */
/* Action Control                                   */
/* ------------------------------------------------ */

function GuideSectionActionControl({
  action,
  variant,
}: {
  action: GuideSectionAction
  variant: 'primary' | 'secondary'
}) {
  const label = cleanNullableText(action.label)

  if (!label) {
    return null
  }

  const className =
    variant === 'primary'
      ? [
          'inline-flex min-h-10 items-center justify-center rounded-full',
          'border border-transparent',
          'bg-[var(--guide-primary)]',
          'px-4 py-2 text-sm font-semibold',
          'text-[var(--guide-button-text)]',
          'transition hover:brightness-105',
          'focus-visible:outline-none',
          'focus-visible:ring-2',
          'focus-visible:ring-[var(--guide-focus-ring)]',
          'focus-visible:ring-offset-2',
          'focus-visible:ring-offset-[var(--guide-background)]',
          'disabled:pointer-events-none disabled:opacity-50',
        ].join(' ')
      : [
          'inline-flex min-h-10 items-center justify-center rounded-full',
          'border border-[var(--guide-border)]',
          'bg-[var(--guide-surface)]',
          'px-4 py-2 text-sm font-semibold',
          'text-[var(--guide-text)]',
          'transition hover:bg-[var(--guide-surface-elevated)]',
          'focus-visible:outline-none',
          'focus-visible:ring-2',
          'focus-visible:ring-[var(--guide-focus-ring)]',
          'focus-visible:ring-offset-2',
          'focus-visible:ring-offset-[var(--guide-background)]',
          'disabled:pointer-events-none disabled:opacity-50',
        ].join(' ')

  const content = (
    <>
      <span>{label}</span>

      <span
        aria-hidden="true"
        className="ml-1.5"
      >
        {action.external ? '↗' : '→'}
      </span>
    </>
  )

  const ariaLabel =
    cleanNullableText(action.ariaLabel) ??
    label

  if (action.href) {
    const href = action.href.trim()

    if (!href) {
      return null
    }

    if (action.external || isExternalUrl(href)) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={ariaLabel}
          aria-disabled={action.disabled || undefined}
          tabIndex={action.disabled ? -1 : undefined}
          className={[
            className,
            action.disabled
              ? 'pointer-events-none cursor-not-allowed opacity-50'
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {content}
        </a>
      )
    }

    return (
      <Link
        href={href}
        aria-label={ariaLabel}
        aria-disabled={action.disabled || undefined}
        tabIndex={action.disabled ? -1 : undefined}
        className={[
          className,
          action.disabled
            ? 'pointer-events-none cursor-not-allowed opacity-50'
            : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {content}
      </Link>
    )
  }

  if (action.onClick) {
    return (
      <button
        type="button"
        onClick={action.onClick}
        disabled={action.disabled}
        aria-label={ariaLabel}
        className={className}
      >
        {content}
      </button>
    )
  }

  return null
}

/* ------------------------------------------------ */
/* Layout Helpers                                   */
/* ------------------------------------------------ */

function getContentLayoutClassName(
  displayStyle: GuideSectionDisplayStyle
) {
  if (displayStyle === 'list') {
    return 'space-y-3'
  }

  if (displayStyle === 'carousel') {
    return [
      '-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2',
      'scroll-smooth overscroll-x-contain',
      'sm:-mx-6 sm:px-6',
      '[scrollbar-width:thin]',
      '[scrollbar-color:var(--guide-border)_transparent]',
    ].join(' ')
  }

  if (displayStyle === 'compact') {
    return 'grid gap-2 sm:grid-cols-2'
  }

  if (displayStyle === 'featured') {
    return [
      'grid gap-4',
      'lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]',
    ].join(' ')
  }

  return 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
}

function buildSectionId(
  sectionKey: GuideSectionKey
) {
  return `guide-section-${sectionKey.replace(/_/g, '-')}`
}

function humanizeSectionKey(
  sectionKey: GuideSectionKey
) {
  return sectionKey
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

/* ------------------------------------------------ */
/* Validation Helpers                               */
/* ------------------------------------------------ */

function isUsableAction(
  action: GuideSectionAction | null | undefined
): action is GuideSectionAction {
  if (!action) return false
  if (!cleanNullableText(action.label)) return false

  return Boolean(
    cleanNullableText(action.href) ||
    typeof action.onClick === 'function'
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

function cleanNullableText(
  value: string | null | undefined
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  return trimmed || null
}