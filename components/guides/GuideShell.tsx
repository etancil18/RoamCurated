// components/guides/GuideShell.tsx

import type {
  CSSProperties,
  ReactNode,
} from 'react'

import GuideFloatingNav, {
  type GuideFloatingNavItem,
} from '@/components/guides/GuideFloatingNav'

import GuideFooter, {
  type GuideFooterLink,
  type GuideFooterLinkGroup,
  type GuideFooterSocialLink,
} from '@/components/guides/GuideFooter'

import GuideStickyHeader, {
  type GuideStickyHeaderAction,
} from '@/components/guides/GuideStickyHeader'

import {
  getGuideCopy,
  type GuideCopy,
  type GuideCopyContext,
  type GuideCopyTone,
} from '@/lib/guides/guideCopy'

import {
  buildGuideThemeStyle,
  buildGuideThemeTokens,
  getGuideThemeClassNames,
  normalizeGuideBrand,
  type GuideThemeCssVariables,
  type GuideThemeTokens,
} from '@/lib/guides/guideTheme'

import type {
  GuideConfig,
  GuidePageContext,
} from '@/lib/guides/types'

/* ------------------------------------------------ */
/* Types                                            */
/* ------------------------------------------------ */

export type GuideShellHeaderOptions = {
  /**
   * Completely suppresses the sticky header.
   */
  hidden?: boolean

  /**
   * Optional explicit primary action.
   *
   * When undefined, GuideStickyHeader derives an action
   * from the guide configuration.
   *
   * Pass null to suppress the action.
   */
  primaryAction?: GuideStickyHeaderAction | null

  /**
   * Accessible navigation label.
   */
  ariaLabel?: string

  /**
   * Scroll distance before the header gains elevation.
   */
  elevationThreshold?: number

  /**
   * Scroll distance before compact header mode activates.
   */
  compactThreshold?: number

  /**
   * Shows the configured guide or brand logo.
   */
  showLogo?: boolean

  /**
   * Shows secondary property, location, or brand context.
   */
  showContext?: boolean

  /**
   * Shows the desktop back-to-top control after scrolling.
   */
  showBackToTop?: boolean

  /**
   * Uses fixed positioning rather than sticky positioning.
   */
  fixed?: boolean

  className?: string
}

export type GuideShellFooterOptions = {
  /**
   * Completely suppresses the footer.
   */
  hidden?: boolean

  /**
   * Explicit footer navigation groups.
   *
   * When undefined, GuideFooter derives groups from the guide.
   */
  linkGroups?: GuideFooterLinkGroup[]

  /**
   * Explicit social links.
   *
   * When undefined, GuideFooter attempts to derive them from
   * the guide brand and property records.
   *
   * Pass an empty array to suppress social links.
   */
  socialLinks?: GuideFooterSocialLink[]

  /**
   * Explicit footer CTA.
   *
   * When undefined, GuideFooter derives one.
   *
   * Pass null to suppress it.
   */
  primaryAction?: GuideFooterLink | null

  /**
   * Explicit footer description.
   *
   * When undefined, GuideFooter derives one.
   *
   * Pass null to suppress it.
   */
  description?: string | null

  /**
   * Name used in the generated copyright notice.
   *
   * Pass null to suppress the copyright holder.
   */
  copyrightName?: string | null

  /**
   * Privacy, terms, accessibility, or other legal links.
   */
  legalLinks?: GuideFooterLink[]

  showLogo?: boolean
  showBackToTop?: boolean
  showCopyright?: boolean

  maxLinksPerGroup?: number

  className?: string
}

export type GuideShellFloatingNavOptions = {
  /**
   * Completely suppresses the floating navigation.
   */
  hidden?: boolean

  /**
   * Explicit floating navigation items.
   *
   * When undefined, GuideFloatingNav derives items from
   * the guide section configuration.
   */
  items?: GuideFloatingNavItem[]

  ariaLabel?: string

  maxItems?: number
  observerOffset?: number
  minimumItems?: number

  showDesktopLabels?: boolean
  showContextLabel?: boolean

  position?: 'top' | 'bottom'

  className?: string
}

export type GuideShellProps = {
  guide: GuideConfig
  children: ReactNode

  copy?: GuideCopy
  copyTone?: GuideCopyTone | null
  copyContext?: Partial<GuideCopyContext>

  pageContext?: Partial<GuidePageContext>

  header?: GuideShellHeaderOptions
  footer?: GuideShellFooterOptions
  floatingNav?: GuideShellFloatingNavOptions

  beforeHeader?: ReactNode
  afterHeader?: ReactNode
  beforeContent?: ReactNode
  afterContent?: ReactNode
  beforeFooter?: ReactNode
  afterFooter?: ReactNode

  contentId?: string

  className?: string
  contentClassName?: string
  innerContentClassName?: string

  constrainContent?: boolean
  contentMaxWidthClassName?: string

  includeCustomCss?: boolean
  customCssNonce?: string

  style?: CSSProperties
}

/* ------------------------------------------------ */
/* Component                                        */
/* ------------------------------------------------ */

export default function GuideShell({
  guide,
  children,

  copy: suppliedCopy,
  copyTone,
  copyContext,

  pageContext,

  header,
  footer,
  floatingNav,

  beforeHeader,
  afterHeader,
  beforeContent,
  afterContent,
  beforeFooter,
  afterFooter,

  contentId = 'guide-content',

  className,
  contentClassName,
  innerContentClassName,

  constrainContent = true,
  contentMaxWidthClassName = 'max-w-6xl',

  includeCustomCss = false,
  customCssNonce,

  style,
}: GuideShellProps) {
  const normalizedBrand =
    normalizeGuideBrand(guide.brand)

  const themedGuide: GuideConfig = {
    ...guide,
    brand: normalizedBrand,
  }

  const themeStyle =
    buildGuideThemeStyle(normalizedBrand)

  const themeTokens =
    buildGuideThemeTokens(normalizedBrand)

  const themeClasses =
    getGuideThemeClassNames()

  const resolvedPageContext =
    normalizePageContext(pageContext)

  /*
   * Retained for shell-level copy normalization and backward
   * compatibility with callers already supplying copy configuration.
   *
   * The new visual shell components derive their own concise labels,
   * but resolving copy here preserves the existing GuideShell behavior
   * and validates the same guide-copy inputs.
   */
  const copy =
    suppliedCopy ??
    getGuideCopy({
      mode: themedGuide.guideMode,
      tone: copyTone,
      propertyName:
        themedGuide.property.name,
      brandName:
        normalizedBrand.name,
      city:
        themedGuide.property.city,
      guideTitle:
        themedGuide.title,
      guideSubtitle:
        themedGuide.subtitle,
      welcomeHeading:
        themedGuide.welcomeHeading,
      welcomeDescription:
        themedGuide.welcomeDescription,
      poweredByRoam:
        themedGuide.poweredByRoam,
      ...copyContext,
    })

  /*
   * GuideStickyHeader and GuideFooter no longer consume the legacy
   * GuideCopy object directly. Keep the resolution above active without
   * leaving an unused local when noUnusedLocals is enabled.
   */
  void copy

  const showHeader =
    header?.hidden !== true

  const showFooter =
    footer?.hidden !== true

  const showFloatingNav =
    floatingNav?.hidden !== true

  const resolvedContentId =
    normalizeHtmlId(contentId) ||
    'guide-content'

  const resolvedStyle:
    GuideThemeCssVariables &
    CSSProperties = {
    ...themeStyle,
    ...style,
  }

  const safeCustomCss =
    includeCustomCss
      ? sanitizeGuideCustomCss(
          normalizedBrand.customCss
        )
      : null

  return (
    <div
      id="top"
      data-guide-shell
      data-guide-id={themedGuide.id}
      data-guide-slug={themedGuide.slug}
      data-guide-mode={
        themedGuide.guideMode
      }
      data-guide-status={
        themedGuide.status
      }
      data-guide-branding-mode={
        normalizedBrand.brandingMode
      }
      data-guide-preview={
        resolvedPageContext.isPreview
          ? 'true'
          : 'false'
      }
      data-guide-access-mode={
        resolvedPageContext.accessMode
      }
      className={[
        themeClasses.page,
        'relative isolate min-h-screen overflow-x-hidden',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={resolvedStyle}
    >
      <GuideShellBackground
        tokens={themeTokens}
      />

      {safeCustomCss ? (
        <style
          nonce={customCssNonce}
          dangerouslySetInnerHTML={{
            __html:
              scopeCustomCssToGuideShell(
                safeCustomCss
              ),
          }}
        />
      ) : null}

      <SkipToGuideContentLink
        contentId={resolvedContentId}
      />

      {resolvedPageContext.isPreview ? (
        <GuidePreviewBanner
          guide={themedGuide}
          canEdit={
            resolvedPageContext.canEdit
          }
        />
      ) : null}

      {beforeHeader}

      {showHeader ? (
        <GuideStickyHeader
          guide={themedGuide}
          primaryAction={
            header?.primaryAction
          }
          ariaLabel={
            header?.ariaLabel
          }
          elevationThreshold={
            header?.elevationThreshold
          }
          compactThreshold={
            header?.compactThreshold
          }
          showLogo={
            header?.showLogo
          }
          showContext={
            header?.showContext
          }
          showBackToTop={
            header?.showBackToTop
          }
          fixed={header?.fixed}
          className={
            header?.className
          }
        />
      ) : null}

      {afterHeader}
      {beforeContent}

      <main
        id={resolvedContentId}
        tabIndex={-1}
        aria-label={`${themedGuide.title} guide content`}
        className={[
          'relative z-10 outline-none',
          showHeader
            ? ''
            : 'pt-6 sm:pt-8',
          contentClassName,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div
          className={[
            constrainContent
              ? [
                  'mx-auto w-full',
                  contentMaxWidthClassName,
                  'px-4 py-8',
                  'sm:px-6 sm:py-10',
                  'lg:px-8 lg:py-12',
                ].join(' ')
              : '',
            innerContentClassName,
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {children}
        </div>
      </main>

      {afterContent}
      {beforeFooter}

      {showFooter ? (
        <GuideFooter
          guide={themedGuide}
          linkGroups={
            footer?.linkGroups
          }
          socialLinks={
            footer?.socialLinks
          }
          primaryAction={
            footer?.primaryAction
          }
          description={
            footer?.description
          }
          copyrightName={
            footer?.copyrightName
          }
          legalLinks={
            footer?.legalLinks
          }
          showLogo={
            footer?.showLogo
          }
          showBackToTop={
            footer?.showBackToTop
          }
          showCopyright={
            footer?.showCopyright
          }
          maxLinksPerGroup={
            footer?.maxLinksPerGroup
          }
          className={
            footer?.className
          }
        />
      ) : null}

      {afterFooter}

      {showFloatingNav ? (
        <GuideFloatingNav
          guide={themedGuide}
          items={
            floatingNav?.items
          }
          ariaLabel={
            floatingNav?.ariaLabel
          }
          maxItems={
            floatingNav?.maxItems
          }
          observerOffset={
            floatingNav?.observerOffset
          }
          minimumItems={
            floatingNav?.minimumItems
          }
          showDesktopLabels={
            floatingNav
              ?.showDesktopLabels
          }
          showContextLabel={
            floatingNav
              ?.showContextLabel
          }
          position={
            floatingNav?.position
          }
          className={
            floatingNav?.className
          }
        />
      ) : null}
    </div>
  )
}

/* ------------------------------------------------ */
/* Background                                       */
/* ------------------------------------------------ */

function GuideShellBackground({
  tokens,
}: {
  tokens: GuideThemeTokens
}) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundColor:
            tokens.background,
        }}
      />

      <div
        className="absolute left-[-12rem] top-[-10rem] h-[28rem] w-[28rem] rounded-full blur-3xl"
        style={{
          backgroundColor:
            withAlpha(
              tokens.primary,
              0.12
            ),
        }}
      />

      <div
        className="absolute right-[-14rem] top-[18%] h-[32rem] w-[32rem] rounded-full blur-3xl"
        style={{
          backgroundColor:
            withAlpha(
              tokens.accent,
              0.08
            ),
        }}
      />

      <div
        className="absolute bottom-[-16rem] left-[24%] h-[30rem] w-[30rem] rounded-full blur-3xl"
        style={{
          backgroundColor:
            withAlpha(
              tokens.secondary,
              0.1
            ),
        }}
      />
    </div>
  )
}

/* ------------------------------------------------ */
/* Accessibility                                    */
/* ------------------------------------------------ */

function SkipToGuideContentLink({
  contentId,
}: {
  contentId: string
}) {
  return (
    <a
      href={`#${contentId}`}
      className={[
        'fixed left-4 top-3 z-[100]',
        '-translate-y-24 focus:translate-y-0',
        'rounded-full',
        'border border-[var(--guide-border)]',
        'bg-[var(--guide-surface-elevated)]',
        'px-4 py-2',
        'text-sm font-semibold',
        'text-[var(--guide-text)]',
        'shadow-xl',
        'transition-transform',
        'focus-visible:outline-none',
        'focus-visible:ring-2',
        'focus-visible:ring-[var(--guide-focus-ring)]',
        'focus-visible:ring-offset-2',
        'focus-visible:ring-offset-[var(--guide-background)]',
      ].join(' ')}
    >
      Skip to guide content
    </a>
  )
}

/* ------------------------------------------------ */
/* Preview Banner                                   */
/* ------------------------------------------------ */

function GuidePreviewBanner({
  guide,
  canEdit,
}: {
  guide: GuideConfig
  canEdit: boolean
}) {
  return (
    <div
      role="status"
      aria-label="Guide preview mode"
      className={[
        'relative z-50',
        'border-b border-amber-400/30',
        'bg-amber-300/10',
        'text-[var(--guide-text)]',
      ].join(' ')}
    >
      <div
        className={[
          'mx-auto flex min-h-11 w-full max-w-6xl',
          'flex-wrap items-center justify-between gap-2',
          'px-4 py-2 sm:px-6 lg:px-8',
        ].join(' ')}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-flex h-2 w-2 shrink-0 rounded-full bg-amber-400"
          />

          <p className="truncate text-xs font-semibold sm:text-sm">
            Previewing {guide.title}
          </p>

          <span
            className={[
              'rounded-full',
              'border border-amber-400/30',
              'bg-amber-400/10',
              'px-2 py-0.5',
              'text-[10px] font-bold uppercase tracking-wide',
            ].join(' ')}
          >
            {guide.status}
          </span>
        </div>

        {canEdit ? (
          <p className="text-xs text-[var(--guide-muted-text)]">
            Admin preview
          </p>
        ) : null}
      </div>
    </div>
  )
}

/* ------------------------------------------------ */
/* Page Context                                     */
/* ------------------------------------------------ */

function normalizePageContext(
  context:
    | Partial<GuidePageContext>
    | undefined
): GuidePageContext {
  const accessMode =
    context?.accessMode ===
      'preview' ||
    context?.accessMode === 'admin'
      ? context.accessMode
      : 'public'

  const isPreview =
    typeof context?.isPreview ===
    'boolean'
      ? context.isPreview
      : accessMode !== 'public'

  const canEdit =
    typeof context?.canEdit ===
    'boolean'
      ? context.canEdit
      : accessMode === 'admin'

  return {
    accessMode,
    isPreview,
    canEdit,
  }
}

/* ------------------------------------------------ */
/* Custom CSS                                       */
/* ------------------------------------------------ */

/**
 * Custom guide CSS remains disabled unless includeCustomCss is true.
 *
 * Only trusted administrators should be allowed to write custom_css.
 * This function removes the most obvious unsafe CSS constructs before
 * the remaining rules are scoped beneath the guide shell.
 */
function sanitizeGuideCustomCss(
  value:
    | string
    | null
    | undefined
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  const limited =
    trimmed.slice(0, 20_000)

  const sanitized = limited
    .replace(
      /<\/?style\b[^>]*>/gi,
      ''
    )
    .replace(
      /@charset\b[^;]*;?/gi,
      ''
    )
    .replace(
      /@import\b[^;]*;?/gi,
      ''
    )
    .replace(
      /expression\s*\([^)]*\)/gi,
      ''
    )
    .replace(
      /url\s*\(\s*(['"]?)\s*(?:javascript|vbscript|data):[^)]*\1\s*\)/gi,
      ''
    )
    .replace(
      /behavior\s*:[^;]+;?/gi,
      ''
    )
    .replace(
      /-moz-binding\s*:[^;]+;?/gi,
      ''
    )
    .replace(
      /javascript\s*:/gi,
      ''
    )
    .replace(
      /vbscript\s*:/gi,
      ''
    )

  return (
    sanitized.trim() || null
  )
}

/**
 * Scopes ordinary CSS selectors beneath [data-guide-shell].
 *
 * This intentionally avoids pretending to be a complete CSS parser.
 * Complex administrator-authored @media and @supports rules should still
 * be tested before production use.
 */
function scopeCustomCssToGuideShell(
  css: string
): string {
  return css.replace(
    /(^|})\s*([^@}{][^{]*)\{/g,
    (
      fullMatch,
      boundary: string,
      selectorGroup: string
    ) => {
      const scopedSelectors =
        selectorGroup
          .split(',')
          .map((selector) =>
            selector.trim()
          )
          .filter(Boolean)
          .map((selector) => {
            if (
              selector.startsWith(
                '[data-guide-shell]'
              )
            ) {
              return selector
            }

            if (
              selector === ':root' ||
              selector === 'html' ||
              selector === 'body'
            ) {
              return (
                '[data-guide-shell]'
              )
            }

            return `[data-guide-shell] ${selector}`
          })
          .join(', ')

      if (!scopedSelectors) {
        return fullMatch
      }

      return `${boundary}\n${scopedSelectors} {`
    }
  )
}

/* ------------------------------------------------ */
/* Color Helpers                                    */
/* ------------------------------------------------ */

function withAlpha(
  color: string,
  alpha: number
): string {
  const normalizedAlpha =
    clamp(alpha, 0, 1)

  const rgb =
    parseHexColor(color)

  if (!rgb) {
    return `rgba(34, 211, 238, ${normalizedAlpha})`
  }

  return `rgba(${rgb.red}, ${rgb.green}, ${rgb.blue}, ${normalizedAlpha})`
}

function parseHexColor(
  value: string
): {
  red: number
  green: number
  blue: number
} | null {
  const normalized =
    normalizeHexColor(value)

  if (!normalized) {
    return null
  }

  return {
    red: Number.parseInt(
      normalized.slice(1, 3),
      16
    ),
    green: Number.parseInt(
      normalized.slice(3, 5),
      16
    ),
    blue: Number.parseInt(
      normalized.slice(5, 7),
      16
    ),
  }
}

function normalizeHexColor(
  value: string
): string | null {
  const trimmed = value.trim()

  const shortMatch =
    trimmed.match(
      /^#([0-9a-f]{3})$/i
    )

  if (shortMatch) {
    const [
      red,
      green,
      blue,
    ] = shortMatch[1].split('')

    return `#${red}${red}${green}${green}${blue}${blue}`
  }

  const longMatch =
    trimmed.match(
      /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/i
    )

  if (longMatch) {
    return `#${longMatch[1]}`
  }

  return null
}

function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  return Math.min(
    maximum,
    Math.max(minimum, value)
  )
}

/* ------------------------------------------------ */
/* General Helpers                                  */
/* ------------------------------------------------ */

function normalizeHtmlId(
  value:
    | string
    | null
    | undefined
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9_-]+/g,
      '-'
    )
    .replace(
      /^-+|-+$/g,
      ''
    )

  return normalized || null
}