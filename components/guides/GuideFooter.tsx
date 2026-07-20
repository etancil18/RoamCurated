'use client'

import type { ReactNode } from 'react'

import type {
  GuideConfig,
  GuideSectionKey,
} from '@/lib/guides/types'

/* ------------------------------------------------ */
/* Public contracts                                 */
/* ------------------------------------------------ */

export type GuideFooterLink = {
  /**
   * Stable identifier used as the React key.
   */
  id: string

  /**
   * Visible link label.
   */
  label: string

  /**
   * Destination URL, route, email, phone number,
   * or in-page section anchor.
   */
  href: string

  /**
   * Optional accessible label.
   */
  ariaLabel?: string

  /**
   * Optional leading icon.
   */
  icon?: ReactNode

  /**
   * Opens the link in a new browsing context.
   */
  external?: boolean
}

export type GuideFooterLinkGroup = {
  /**
   * Stable group identifier.
   */
  id: string

  /**
   * Visible group heading.
   */
  title: string

  /**
   * Links rendered beneath the heading.
   */
  links: GuideFooterLink[]
}

export type GuideFooterSocialLink = {
  /**
   * Stable identifier.
   */
  id: string

  /**
   * Social network or platform label.
   */
  label: string

  /**
   * Profile URL.
   */
  href: string

  /**
   * Optional custom icon.
   */
  icon?: ReactNode
}

export type GuideFooterProps = {
  guide: GuideConfig

  /**
   * Optional explicit navigation groups.
   *
   * When supplied, these replace groups derived from
   * the visible guide sections.
   */
  linkGroups?: GuideFooterLinkGroup[]

  /**
   * Optional explicit social links.
   *
   * When undefined, the component attempts to derive
   * them from the guide brand record.
   *
   * Pass an empty array to suppress social links.
   */
  socialLinks?: GuideFooterSocialLink[]

  /**
   * Optional top-level CTA.
   *
   * Pass null to suppress the CTA.
   */
  primaryAction?: GuideFooterLink | null

  /**
   * Optional footer description.
   *
   * Pass null to suppress it.
   */
  description?: string | null

  /**
   * Optional copyright holder.
   *
   * Defaults to the configured brand or property name.
   */
  copyrightName?: string | null

  /**
   * Optional legal links rendered in the bottom row.
   */
  legalLinks?: GuideFooterLink[]

  /**
   * Shows the configured brand logo.
   */
  showLogo?: boolean

  /**
   * Shows the return-to-top control.
   */
  showBackToTop?: boolean

  /**
   * Shows the current year and copyright notice.
   */
  showCopyright?: boolean

  /**
   * Maximum number of links in each derived group.
   */
  maxLinksPerGroup?: number

  className?: string
}

/* ------------------------------------------------ */
/* Internal contracts                               */
/* ------------------------------------------------ */

type SocialPlatform =
  | 'instagram'
  | 'facebook'
  | 'x'
  | 'linkedin'
  | 'youtube'
  | 'tiktok'
  | 'pinterest'
  | 'website'

type SocialDefinition = {
  platform: SocialPlatform
  label: string
  icon: ReactNode
  candidateKeys: string[]
}

/* ------------------------------------------------ */
/* Constants                                        */
/* ------------------------------------------------ */

const DEFAULT_MAX_LINKS_PER_GROUP = 6

const PRIMARY_SECTION_KEYS: GuideSectionKey[] = [
  'favorites',
  'suggested_routes',
  'dining',
  'coffee',
  'bars',
  'wellness',
]

const SECONDARY_SECTION_KEYS: GuideSectionKey[] = [
  'events',
  'partner_offers',
  'map',
  'custom',
]

const SECTION_LABELS: Record<
  GuideSectionKey,
  string
> = {
  welcome: 'Welcome',
  favorites: 'Local favorites',
  suggested_routes: 'Suggested routes',
  coffee: 'Coffee',
  dining: 'Dining',
  bars: 'Bars',
  wellness: 'Wellness',
  events: 'Nearby events',
  partner_offers: 'Partner offers',
  map: 'Map',
  custom: 'More',
}

const SOCIAL_DEFINITIONS: SocialDefinition[] = [
  {
    platform: 'instagram',
    label: 'Instagram',
    icon: <InstagramIcon />,
    candidateKeys: [
      'instagramUrl',
      'instagram',
      'socialInstagramUrl',
    ],
  },
  {
    platform: 'facebook',
    label: 'Facebook',
    icon: <FacebookIcon />,
    candidateKeys: [
      'facebookUrl',
      'facebook',
      'socialFacebookUrl',
    ],
  },
  {
    platform: 'x',
    label: 'X',
    icon: <XIcon />,
    candidateKeys: [
      'xUrl',
      'twitterUrl',
      'twitter',
      'socialXUrl',
    ],
  },
  {
    platform: 'linkedin',
    label: 'LinkedIn',
    icon: <LinkedInIcon />,
    candidateKeys: [
      'linkedinUrl',
      'linkedin',
      'socialLinkedinUrl',
    ],
  },
  {
    platform: 'youtube',
    label: 'YouTube',
    icon: <YouTubeIcon />,
    candidateKeys: [
      'youtubeUrl',
      'youtube',
      'socialYoutubeUrl',
    ],
  },
  {
    platform: 'tiktok',
    label: 'TikTok',
    icon: <TikTokIcon />,
    candidateKeys: [
      'tiktokUrl',
      'tikTokUrl',
      'tiktok',
      'socialTiktokUrl',
    ],
  },
  {
    platform: 'pinterest',
    label: 'Pinterest',
    icon: <PinterestIcon />,
    candidateKeys: [
      'pinterestUrl',
      'pinterest',
      'socialPinterestUrl',
    ],
  },
  {
    platform: 'website',
    label: 'Website',
    icon: <GlobeIcon />,
    candidateKeys: [
      'websiteUrl',
      'website',
      'url',
    ],
  },
]

/* ------------------------------------------------ */
/* Component                                        */
/* ------------------------------------------------ */

export default function GuideFooter({
  guide,
  linkGroups,
  socialLinks,
  primaryAction,
  description,
  copyrightName,
  legalLinks = [],
  showLogo = true,
  showBackToTop = true,
  showCopyright = true,
  maxLinksPerGroup = DEFAULT_MAX_LINKS_PER_GROUP,
  className,
}: GuideFooterProps) {
  const normalizedMaxLinks =
    normalizePositiveInteger(
      maxLinksPerGroup,
      DEFAULT_MAX_LINKS_PER_GROUP
    )

  const resolvedLinkGroups = (
    linkGroups ??
    deriveFooterLinkGroups(guide)
  )
    .map((group) => ({
      ...group,
      links: deduplicateLinks(
        group.links
      ).slice(0, normalizedMaxLinks),
    }))
    .filter(
      (group) =>
        normalizeText(group.title) &&
        group.links.length > 0
    )

  const resolvedSocialLinks =
    socialLinks ??
    deriveSocialLinks(guide)

  const resolvedPrimaryAction =
    primaryAction === undefined
      ? derivePrimaryAction(guide)
      : primaryAction

  const brandName =
    normalizeText(guide.brand.name)

  const propertyName =
    normalizeText(
      guide.property.name
    )

  const guideTitle =
    normalizeText(guide.title)

  const logoUrl =
    normalizeText(
      guide.brand.logoUrl
    )

  const resolvedDescription =
    description === undefined
      ? deriveFooterDescription(guide)
      : normalizeText(description)

  const resolvedCopyrightName =
    copyrightName === undefined
      ? brandName ??
        propertyName ??
        guideTitle ??
        'Guide'
      : normalizeText(copyrightName)

  const currentYear =
    new Date().getFullYear()

  const hasNavigation =
    resolvedLinkGroups.length > 0

  const hasSocialLinks =
    resolvedSocialLinks.length > 0

  const normalizedLegalLinks =
    deduplicateLinks(legalLinks)

  return (
    <footer
      data-guide-footer
      className={joinClassNames(
        'relative overflow-hidden',
        'border-t border-[color:var(--guide-border)]',
        'bg-[color:var(--guide-surface)]',
        'text-[color:var(--guide-text)]',
        className
      )}
    >
      <FooterBackground />

      <div
        className={[
          'relative z-10',
          'mx-auto w-full max-w-7xl',
          'px-4 py-12',
          'sm:px-6 sm:py-16',
          'lg:px-8',
        ].join(' ')}
      >
        {resolvedPrimaryAction ? (
          <FooterCallToAction
            action={resolvedPrimaryAction}
            guide={guide}
          />
        ) : null}

        <div
          className={joinClassNames(
            'grid gap-10',
            resolvedPrimaryAction
              ? 'mt-12 sm:mt-16'
              : '',
            hasNavigation
              ? 'lg:grid-cols-[minmax(0,1.35fr)_minmax(0,2fr)]'
              : 'lg:grid-cols-1'
          )}
        >
          <div className="max-w-xl">
            <FooterBrand
              logoUrl={logoUrl}
              brandName={brandName}
              propertyName={propertyName}
              guideTitle={guideTitle}
              showLogo={showLogo}
            />

            {resolvedDescription ? (
              <p
                className={[
                  'mt-5 max-w-lg',
                  'text-sm leading-6',
                  'text-[color:var(--guide-muted-text)]',
                  'sm:text-base sm:leading-7',
                ].join(' ')}
              >
                {resolvedDescription}
              </p>
            ) : null}

            {hasSocialLinks ? (
              <div className="mt-6">
                <p className="sr-only">
                  Social links
                </p>

                <div className="flex flex-wrap gap-2">
                  {resolvedSocialLinks.map(
                    (socialLink) => (
                      <SocialLink
                        key={socialLink.id}
                        socialLink={
                          socialLink
                        }
                      />
                    )
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {hasNavigation ? (
            <nav
              aria-label="Footer navigation"
              className={[
                'grid gap-8',
                'sm:grid-cols-2',
                resolvedLinkGroups.length >= 3
                  ? 'xl:grid-cols-3'
                  : '',
              ].join(' ')}
            >
              {resolvedLinkGroups.map(
                (group) => (
                  <FooterLinkGroup
                    key={group.id}
                    group={group}
                  />
                )
              )}
            </nav>
          ) : null}
        </div>

        <div
          className={[
            'mt-12 flex flex-col',
            'gap-5 border-t',
            'border-[color:var(--guide-border)]',
            'pt-6',
            'sm:mt-16',
            'sm:flex-row',
            'sm:items-center',
            'sm:justify-between',
          ].join(' ')}
        >
          <div
            className={[
              'flex flex-col gap-3',
              'sm:flex-row',
              'sm:items-center',
              'sm:gap-5',
            ].join(' ')}
          >
            {showCopyright &&
            resolvedCopyrightName ? (
              <p
                className={[
                  'text-xs leading-5',
                  'text-[color:var(--guide-muted-text)]',
                ].join(' ')}
              >
                © {currentYear}{' '}
                {resolvedCopyrightName}.
                All rights reserved.
              </p>
            ) : null}

            {normalizedLegalLinks.length >
            0 ? (
              <nav aria-label="Legal">
                <ul
                  className={[
                    'flex flex-wrap',
                    'items-center gap-x-4',
                    'gap-y-2',
                  ].join(' ')}
                >
                  {normalizedLegalLinks.map(
                    (link) => (
                      <li key={link.id}>
                        <FooterLegalLink
                          link={link}
                        />
                      </li>
                    )
                  )}
                </ul>
              </nav>
            ) : null}
          </div>

          {showBackToTop ? (
            <button
              type="button"
              onClick={handleScrollToTop}
              className={[
                'inline-flex min-h-10',
                'w-fit items-center',
                'justify-center gap-2',
                'rounded-full',
                'border border-[color:var(--guide-border)]',
                'bg-[color:var(--guide-background)]',
                'px-4 py-2',
                'text-sm font-semibold',
                'text-[color:var(--guide-text)]',
                'transition duration-200',
                'hover:-translate-y-0.5',
                'hover:border-[color:var(--guide-primary)]',
                'hover:text-[color:var(--guide-primary)]',
                'focus-visible:outline-none',
                'focus-visible:ring-2',
                'focus-visible:ring-[color:var(--guide-primary)]',
                'focus-visible:ring-offset-2',
                'focus-visible:ring-offset-[color:var(--guide-surface)]',
              ].join(' ')}
            >
              <ArrowUpIcon />

              <span>Back to top</span>
            </button>
          ) : null}
        </div>
      </div>
    </footer>
  )
}

/* ------------------------------------------------ */
/* CTA                                              */
/* ------------------------------------------------ */

function FooterCallToAction({
  action,
  guide,
}: {
  action: GuideFooterLink
  guide: GuideConfig
}) {
  const isExternal =
    action.external === true ||
    isExternalHref(action.href)

  const title =
    deriveCallToActionTitle(guide)

  const description =
    deriveCallToActionDescription(guide)

  return (
    <section
      aria-labelledby="guide-footer-cta-title"
      className={[
        'relative overflow-hidden',
        'rounded-3xl',
        'bg-[color:var(--guide-primary)]',
        'px-6 py-8',
        'text-[color:var(--guide-button-text)]',
        'shadow-lg',
        'sm:px-8 sm:py-10',
        'lg:flex lg:items-center',
        'lg:justify-between lg:gap-10',
      ].join(' ')}
    >
      <div
        aria-hidden="true"
        className={[
          'absolute -right-20 -top-24',
          'h-64 w-64 rounded-full',
          'bg-[color:var(--guide-accent)]',
          'opacity-25 blur-3xl',
        ].join(' ')}
      />

      <div
        aria-hidden="true"
        className={[
          'absolute -bottom-24 -left-20',
          'h-56 w-56 rounded-full',
          'bg-white',
          'opacity-10 blur-3xl',
        ].join(' ')}
      />

      <div className="relative max-w-2xl">
        <p
          className={[
            'text-xs font-semibold',
            'uppercase tracking-[0.16em]',
            'text-current opacity-70',
          ].join(' ')}
        >
          Continue exploring
        </p>

        <h2
          id="guide-footer-cta-title"
          className={[
            'mt-3 text-2xl',
            'font-semibold',
            'tracking-[-0.035em]',
            'sm:text-3xl',
          ].join(' ')}
        >
          {title}
        </h2>

        {description ? (
          <p
            className={[
              'mt-3 max-w-xl',
              'text-sm leading-6',
              'text-current opacity-75',
              'sm:text-base',
            ].join(' ')}
          >
            {description}
          </p>
        ) : null}
      </div>

      <div className="relative mt-6 shrink-0 lg:mt-0">
        <a
          href={action.href}
          aria-label={action.ariaLabel}
          target={
            isExternal
              ? '_blank'
              : undefined
          }
          rel={
            isExternal
              ? 'noreferrer noopener'
              : undefined
          }
          className={[
            'inline-flex min-h-12',
            'items-center justify-center',
            'gap-2 rounded-full',
            'bg-white px-5 py-3',
            'text-sm font-semibold',
            'text-black',
            'shadow-sm',
            'transition duration-200',
            'hover:-translate-y-0.5',
            'hover:shadow-md',
            'focus-visible:outline-none',
            'focus-visible:ring-2',
            'focus-visible:ring-white',
            'focus-visible:ring-offset-2',
            'focus-visible:ring-offset-[color:var(--guide-primary)]',
          ].join(' ')}
        >
          {action.icon ? (
            <span
              aria-hidden="true"
              className={[
                'flex h-5 w-5',
                'items-center justify-center',
              ].join(' ')}
            >
              {action.icon}
            </span>
          ) : null}

          <span>{action.label}</span>

          <span aria-hidden="true">
            {isExternal ? '↗' : '→'}
          </span>
        </a>
      </div>
    </section>
  )
}

/* ------------------------------------------------ */
/* Brand                                            */
/* ------------------------------------------------ */

function FooterBrand({
  logoUrl,
  brandName,
  propertyName,
  guideTitle,
  showLogo,
}: {
  logoUrl: string | null
  brandName: string | null
  propertyName: string | null
  guideTitle: string | null
  showLogo: boolean
}) {
  const primaryName =
    brandName ??
    propertyName ??
    guideTitle ??
    'Local guide'

  const secondaryName =
    propertyName &&
    propertyName !== primaryName
      ? propertyName
      : guideTitle &&
          guideTitle !== primaryName
        ? guideTitle
        : null

  return (
    <div className="flex items-center gap-3">
      {showLogo ? (
        logoUrl ? (
          <span
            className={[
              'flex h-12 w-12',
              'shrink-0 items-center',
              'justify-center',
              'overflow-hidden',
              'rounded-2xl',
              'border border-[color:var(--guide-border)]',
              'bg-white shadow-sm',
            ].join(' ')}
          >
            <img
              src={logoUrl}
              alt={`${primaryName} logo`}
              className={[
                'h-full w-full',
                'object-contain p-1.5',
              ].join(' ')}
            />
          </span>
        ) : (
          <span
            aria-hidden="true"
            className={[
              'flex h-12 w-12',
              'shrink-0 items-center',
              'justify-center',
              'rounded-2xl',
              'bg-[color:var(--guide-primary)]',
              'text-[color:var(--guide-button-text)]',
              'shadow-sm',
            ].join(' ')}
          >
            <CompassIcon />
          </span>
        )
      ) : null}

      <div className="min-w-0">
        <p
          className={[
            'truncate text-lg',
            'font-semibold',
            'tracking-[-0.025em]',
            'text-[color:var(--guide-text)]',
          ].join(' ')}
        >
          {primaryName}
        </p>

        {secondaryName ? (
          <p
            className={[
              'mt-0.5 truncate',
              'text-sm',
              'text-[color:var(--guide-muted-text)]',
            ].join(' ')}
          >
            {secondaryName}
          </p>
        ) : null}
      </div>
    </div>
  )
}

/* ------------------------------------------------ */
/* Link groups                                      */
/* ------------------------------------------------ */

function FooterLinkGroup({
  group,
}: {
  group: GuideFooterLinkGroup
}) {
  return (
    <section
      aria-labelledby={`guide-footer-group-${sanitizeId(
        group.id
      )}`}
    >
      <h2
        id={`guide-footer-group-${sanitizeId(
          group.id
        )}`}
        className={[
          'text-sm font-semibold',
          'text-[color:var(--guide-text)]',
        ].join(' ')}
      >
        {group.title}
      </h2>

      <ul className="mt-4 space-y-3">
        {group.links.map((link) => (
          <li key={link.id}>
            <FooterNavigationLink
              link={link}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}

function FooterNavigationLink({
  link,
}: {
  link: GuideFooterLink
}) {
  const isExternal =
    link.external === true ||
    isExternalHref(link.href)

  return (
    <a
      href={link.href}
      aria-label={link.ariaLabel}
      target={
        isExternal
          ? '_blank'
          : undefined
      }
      rel={
        isExternal
          ? 'noreferrer noopener'
          : undefined
      }
      className={[
        'group inline-flex',
        'items-center gap-2',
        'text-sm leading-6',
        'text-[color:var(--guide-muted-text)]',
        'transition',
        'hover:text-[color:var(--guide-primary)]',
        'focus-visible:rounded-sm',
        'focus-visible:outline-none',
        'focus-visible:ring-2',
        'focus-visible:ring-[color:var(--guide-primary)]',
        'focus-visible:ring-offset-2',
        'focus-visible:ring-offset-[color:var(--guide-surface)]',
      ].join(' ')}
    >
      {link.icon ? (
        <span
          aria-hidden="true"
          className={[
            'flex h-4 w-4',
            'shrink-0 items-center',
            'justify-center',
          ].join(' ')}
        >
          {link.icon}
        </span>
      ) : null}

      <span>{link.label}</span>

      {isExternal ? (
        <span
          aria-hidden="true"
          className={[
            'text-xs opacity-60',
            'transition-transform',
            'group-hover:translate-x-0.5',
            'group-hover:-translate-y-0.5',
          ].join(' ')}
        >
          ↗
        </span>
      ) : (
        <span
          aria-hidden="true"
          className={[
            'text-xs opacity-0',
            'transition',
            'group-hover:translate-x-0.5',
            'group-hover:opacity-60',
          ].join(' ')}
        >
          →
        </span>
      )}
    </a>
  )
}

/* ------------------------------------------------ */
/* Social links                                     */
/* ------------------------------------------------ */

function SocialLink({
  socialLink,
}: {
  socialLink: GuideFooterSocialLink
}) {
  return (
    <a
      href={socialLink.href}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={socialLink.label}
      title={socialLink.label}
      className={[
        'inline-flex h-10 w-10',
        'items-center justify-center',
        'rounded-full',
        'border border-[color:var(--guide-border)]',
        'bg-[color:var(--guide-background)]',
        'text-[color:var(--guide-muted-text)]',
        'transition duration-200',
        'hover:-translate-y-0.5',
        'hover:border-[color:var(--guide-primary)]',
        'hover:text-[color:var(--guide-primary)]',
        'focus-visible:outline-none',
        'focus-visible:ring-2',
        'focus-visible:ring-[color:var(--guide-primary)]',
        'focus-visible:ring-offset-2',
        'focus-visible:ring-offset-[color:var(--guide-surface)]',
      ].join(' ')}
    >
      {socialLink.icon ?? (
        <GlobeIcon />
      )}
    </a>
  )
}

/* ------------------------------------------------ */
/* Legal links                                      */
/* ------------------------------------------------ */

function FooterLegalLink({
  link,
}: {
  link: GuideFooterLink
}) {
  const isExternal =
    link.external === true ||
    isExternalHref(link.href)

  return (
    <a
      href={link.href}
      aria-label={link.ariaLabel}
      target={
        isExternal
          ? '_blank'
          : undefined
      }
      rel={
        isExternal
          ? 'noreferrer noopener'
          : undefined
      }
      className={[
        'text-xs',
        'text-[color:var(--guide-muted-text)]',
        'underline-offset-4',
        'transition',
        'hover:text-[color:var(--guide-primary)]',
        'hover:underline',
        'focus-visible:rounded-sm',
        'focus-visible:outline-none',
        'focus-visible:ring-2',
        'focus-visible:ring-[color:var(--guide-primary)]',
      ].join(' ')}
    >
      {link.label}
    </a>
  )
}

/* ------------------------------------------------ */
/* Background                                       */
/* ------------------------------------------------ */

function FooterBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
    >
      <div
        className={[
          'absolute -right-32 top-20',
          'h-80 w-80 rounded-full',
          'bg-[color:var(--guide-accent)]',
          'opacity-[0.07] blur-3xl',
        ].join(' ')}
      />

      <div
        className={[
          'absolute -bottom-40 -left-28',
          'h-96 w-96 rounded-full',
          'bg-[color:var(--guide-primary)]',
          'opacity-[0.06] blur-3xl',
        ].join(' ')}
      />
    </div>
  )
}

/* ------------------------------------------------ */
/* Derivation                                       */
/* ------------------------------------------------ */

function deriveFooterLinkGroups(
  guide: GuideConfig
): GuideFooterLinkGroup[] {
  const visibleSections =
    [...guide.sections]
      .filter(
        (section) =>
          section.isVisible &&
          section.key !== 'welcome'
      )
      .sort((left, right) => {
        if (
          left.position !==
          right.position
        ) {
          return (
            left.position -
            right.position
          )
        }

        return left.key.localeCompare(
          right.key
        )
      })

  const visibleKeys =
    new Set(
      visibleSections.map(
        (section) => section.key
      )
    )

  const primaryLinks =
    PRIMARY_SECTION_KEYS
      .filter((sectionKey) =>
        visibleKeys.has(sectionKey)
      )
      .filter((sectionKey) =>
        sectionShouldAppear({
          sectionKey,
          guide,
        })
      )
      .map((sectionKey) =>
        buildSectionLink(
          sectionKey,
          guide
        )
      )

  const secondaryLinks =
    SECONDARY_SECTION_KEYS
      .filter((sectionKey) =>
        visibleKeys.has(sectionKey)
      )
      .filter((sectionKey) =>
        sectionShouldAppear({
          sectionKey,
          guide,
        })
      )
      .map((sectionKey) =>
        buildSectionLink(
          sectionKey,
          guide
        )
      )

  const propertyLinks =
    derivePropertyLinks(guide)

  return [
    {
      id: 'explore',
      title: 'Explore',
      links: primaryLinks,
    },
    {
      id: 'discover',
      title: 'Discover',
      links: secondaryLinks,
    },
    {
      id: 'property',
      title: 'Property',
      links: propertyLinks,
    },
  ].filter(
    (group) =>
      group.links.length > 0
  )
}

function derivePropertyLinks(
  guide: GuideConfig
): GuideFooterLink[] {
  const property =
    guide.property as unknown as Record<
      string,
      unknown
    >

  const brand =
    guide.brand as unknown as Record<
      string,
      unknown
    >

  const websiteUrl =
    readStringFromRecord(
      property,
      [
        'websiteUrl',
        'website',
        'url',
      ]
    ) ??
    readStringFromRecord(
      brand,
      [
        'websiteUrl',
        'website',
        'url',
      ]
    )

  const bookingUrl =
    readStringFromRecord(
      property,
      [
        'bookingUrl',
        'reservationUrl',
        'bookUrl',
      ]
    )

  const phone =
    readStringFromRecord(
      property,
      [
        'phone',
        'phoneNumber',
        'telephone',
      ]
    )

  const email =
    readStringFromRecord(
      property,
      [
        'email',
        'contactEmail',
      ]
    )

  const address =
    normalizeText(
      guide.property.address
    )

  const city =
    normalizeText(
      guide.property.city
    )

  const directionsUrl =
    readStringFromRecord(
      property,
      [
        'directionsUrl',
        'mapsUrl',
        'mapUrl',
      ]
    ) ??
    buildMapsSearchUrl(
      joinNonEmpty(
        address,
        city
      )
    )

  const links: GuideFooterLink[] = []

  if (websiteUrl) {
    links.push({
      id: 'property-website',
      label: 'Visit website',
      href: websiteUrl,
      external: true,
      icon: <GlobeIcon />,
    })
  }

  if (bookingUrl) {
    links.push({
      id: 'property-booking',
      label: 'Book your stay',
      href: bookingUrl,
      external: true,
      icon: <CalendarIcon />,
    })
  }

  if (directionsUrl) {
    links.push({
      id: 'property-directions',
      label: 'Get directions',
      href: directionsUrl,
      external: true,
      icon: <MapPinIcon />,
    })
  }

  if (phone) {
    links.push({
      id: 'property-phone',
      label: phone,
      href: buildTelephoneHref(
        phone
      ),
      icon: <PhoneIcon />,
    })
  }

  if (email) {
    links.push({
      id: 'property-email',
      label: email,
      href: `mailto:${email}`,
      icon: <MailIcon />,
    })
  }

  return links
}

function deriveSocialLinks(
  guide: GuideConfig
): GuideFooterSocialLink[] {
  const brandRecord =
    guide.brand as unknown as Record<
      string,
      unknown
    >

  const propertyRecord =
    guide.property as unknown as Record<
      string,
      unknown
    >

  const links: GuideFooterSocialLink[] = []

  for (const definition of SOCIAL_DEFINITIONS) {
    const href =
      readStringFromRecord(
        brandRecord,
        definition.candidateKeys
      ) ??
      readStringFromRecord(
        propertyRecord,
        definition.candidateKeys
      )

    if (
      !href ||
      !isSafeExternalUrl(href)
    ) {
      continue
    }

    links.push({
      id: definition.platform,
      label: definition.label,
      href,
      icon: definition.icon,
    })
  }

  return links
}

function derivePrimaryAction(
  guide: GuideConfig
): GuideFooterLink | null {
  const propertyRecord =
    guide.property as unknown as Record<
      string,
      unknown
    >

  const bookingUrl =
    readStringFromRecord(
      propertyRecord,
      [
        'bookingUrl',
        'reservationUrl',
        'bookUrl',
      ]
    )

  if (bookingUrl) {
    return {
      id: 'book-stay',
      label: 'Book your stay',
      href: bookingUrl,
      external: true,
      icon: <CalendarIcon />,
    }
  }

  const visibleSectionKeys =
    new Set(
      guide.sections
        .filter(
          (section) =>
            section.isVisible
        )
        .map(
          (section) =>
            section.key
        )
    )

  if (
    guide.showPropertyFavorites &&
    visibleSectionKeys.has(
      'favorites'
    )
  ) {
    return {
      id: 'explore-favorites',
      label: 'Explore favorites',
      href: getGuideSectionAnchor(
        'favorites'
      ),
      icon: <HeartIcon />,
    }
  }

  if (
    guide.showSuggestedRoutes &&
    visibleSectionKeys.has(
      'suggested_routes'
    )
  ) {
    return {
      id: 'explore-routes',
      label: 'View suggested routes',
      href: getGuideSectionAnchor(
        'suggested_routes'
      ),
      icon: <RouteIcon />,
    }
  }

  if (
    visibleSectionKeys.has('map')
  ) {
    return {
      id: 'open-map',
      label: 'Open the guide map',
      href: getGuideSectionAnchor(
        'map'
      ),
      icon: <MapIcon />,
    }
  }

  return null
}

function deriveFooterDescription(
  guide: GuideConfig
): string | null {
  const guideRecord =
    guide as unknown as Record<
      string,
      unknown
    >

  const brandRecord =
    guide.brand as unknown as Record<
      string,
      unknown
    >

  const propertyRecord =
    guide.property as unknown as Record<
      string,
      unknown
    >

  return (
    readStringFromRecord(
      guideRecord,
      [
        'footerDescription',
        'description',
        'subtitle',
      ]
    ) ??
    readStringFromRecord(
      propertyRecord,
      [
        'description',
        'shortDescription',
      ]
    ) ??
    readStringFromRecord(
      brandRecord,
      [
        'description',
        'tagline',
      ]
    )
  )
}

function deriveCallToActionTitle(
  guide: GuideConfig
): string {
  const propertyName =
    normalizeText(
      guide.property.name
    )

  if (propertyName) {
    return `Make the most of your time at ${propertyName}.`
  }

  return 'Keep exploring the best of the area.'
}

function deriveCallToActionDescription(
  guide: GuideConfig
): string | null {
  const city =
    normalizeText(
      guide.property.city
    )

  if (city) {
    return `Use this guide to discover trusted places, local experiences, and useful recommendations around ${city}.`
  }

  return 'Use this guide to discover trusted places, local experiences, and useful recommendations nearby.'
}

/* ------------------------------------------------ */
/* Section helpers                                  */
/* ------------------------------------------------ */

function buildSectionLink(
  sectionKey: GuideSectionKey,
  guide: GuideConfig
): GuideFooterLink {
  const matchingSection =
    guide.sections.find(
      (section) =>
        section.key === sectionKey
    )

  const label =
    readCustomSectionTitle(
      matchingSection
    ) ??
    SECTION_LABELS[sectionKey]

  return {
    id: `section-${sectionKey}`,
    label,
    href:
      getGuideSectionAnchor(
        sectionKey
      ),
    icon:
      getSectionIcon(
        sectionKey
      ),
  }
}

function sectionShouldAppear({
  sectionKey,
  guide,
}: {
  sectionKey: GuideSectionKey
  guide: GuideConfig
}): boolean {
  switch (sectionKey) {
    case 'welcome':
      return false

    case 'favorites':
      return (
        guide.showPropertyFavorites &&
        guide.featuredVenues.some(
          (featuredVenue) =>
            featuredVenue.isVisible &&
            featuredVenue.venue != null
        )
      )

    case 'suggested_routes':
      return guide.showSuggestedRoutes

    case 'events':
      return guide.showNearbyEvents

    case 'partner_offers':
      return guide.showPartnerOffers

    case 'coffee':
    case 'dining':
    case 'bars':
    case 'wellness':
    case 'map':
    case 'custom':
      return true

    default:
      return assertUnreachable(
        sectionKey
      )
  }
}

function readCustomSectionTitle(
  section:
    | GuideConfig['sections'][number]
    | undefined
): string | null {
  if (!section) {
    return null
  }

  const sectionRecord =
    section as unknown as Record<
      string,
      unknown
    >

  const configRecord =
    section.config &&
    typeof section.config === 'object'
      ? (section.config as Record<
          string,
          unknown
        >)
      : null

  return (
    readStringFromRecord(
      sectionRecord,
      ['title', 'label']
    ) ??
    (configRecord
      ? readStringFromRecord(
          configRecord,
          ['title', 'label']
        )
      : null)
  )
}

function getGuideSectionAnchor(
  sectionKey: GuideSectionKey
): string {
  return `#guide-section-${sectionKey.replaceAll(
    '_',
    '-'
  )}`
}

function getSectionIcon(
  sectionKey: GuideSectionKey
): ReactNode {
  switch (sectionKey) {
    case 'welcome':
      return <HomeIcon />

    case 'favorites':
      return <HeartIcon />

    case 'suggested_routes':
      return <RouteIcon />

    case 'coffee':
      return <CoffeeIcon />

    case 'dining':
      return <DiningIcon />

    case 'bars':
      return <GlassIcon />

    case 'wellness':
      return <WellnessIcon />

    case 'events':
      return <CalendarIcon />

    case 'partner_offers':
      return <OfferIcon />

    case 'map':
      return <MapIcon />

    case 'custom':
      return <GridIcon />

    default:
      return assertUnreachable(
        sectionKey
      )
  }
}

/* ------------------------------------------------ */
/* Scroll behavior                                  */
/* ------------------------------------------------ */

function handleScrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: prefersReducedMotion()
      ? 'auto'
      : 'smooth',
  })

  window.history.replaceState(
    null,
    '',
    `${window.location.pathname}${window.location.search}`
  )
}

function prefersReducedMotion(): boolean {
  return window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches
}

/* ------------------------------------------------ */
/* Record readers                                   */
/* ------------------------------------------------ */

function readStringFromRecord(
  record: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const value =
      record[key]

    if (
      typeof value !== 'string'
    ) {
      continue
    }

    const normalized =
      normalizeText(value)

    if (normalized) {
      return normalized
    }
  }

  return null
}

/* ------------------------------------------------ */
/* URL helpers                                      */
/* ------------------------------------------------ */

function buildMapsSearchUrl(
  query: string | null
): string | null {
  if (!query) {
    return null
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    query
  )}`
}

function buildTelephoneHref(
  phone: string
): string {
  const normalizedPhone =
    phone.replace(
      /[^\d+]/g,
      ''
    )

  return `tel:${normalizedPhone}`
}

function isSafeExternalUrl(
  href: string
): boolean {
  try {
    const url = new URL(href)

    return (
      url.protocol === 'http:' ||
      url.protocol === 'https:'
    )
  } catch {
    return false
  }
}

function isExternalHref(
  href: string
): boolean {
  return (
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('//')
  )
}

/* ------------------------------------------------ */
/* Generic helpers                                  */
/* ------------------------------------------------ */

function normalizeText(
  value:
    | string
    | null
    | undefined
): string | null {
  if (
    typeof value !== 'string'
  ) {
    return null
  }

  const trimmed =
    value.trim()

  return trimmed.length > 0
    ? trimmed
    : null
}

function normalizePositiveInteger(
  value: number,
  fallback: number
): number {
  if (!Number.isFinite(value)) {
    return fallback
  }

  return Math.max(
    1,
    Math.trunc(value)
  )
}

function joinNonEmpty(
  ...values: Array<
    string | null | undefined
  >
): string | null {
  const normalized =
    values
      .map(normalizeText)
      .filter(
        (
          value
        ): value is string =>
          value !== null
      )

  return normalized.length > 0
    ? normalized.join(', ')
    : null
}

function deduplicateLinks<
  T extends {
    id: string
    href: string
  },
>(
  links: T[]
): T[] {
  const seen =
    new Set<string>()

  return links.filter((link) => {
    const key =
      `${link.id}:${link.href}`

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function sanitizeId(
  value: string
): string {
  return value
    .toLowerCase()
    .replace(
      /[^a-z0-9-_]+/g,
      '-'
    )
    .replace(/^-+|-+$/g, '')
}

function joinClassNames(
  ...values: Array<
    | string
    | null
    | undefined
    | false
  >
): string {
  return values
    .filter(
      (
        value
      ): value is string =>
        typeof value ===
          'string' &&
        value.length > 0
    )
    .join(' ')
}

function assertUnreachable(
  value: never
): never {
  throw new Error(
    `Unsupported guide section key: ${String(
      value
    )}`
  )
}

/* ------------------------------------------------ */
/* Icons                                            */
/* ------------------------------------------------ */

function CompassIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
      />
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
    </svg>
  )
}

function ArrowUpIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="17"
      height="17"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 10 6-6 6 6" />
      <path d="M12 4v16" />
    </svg>
  )
}

function HomeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10" />
      <path d="M9 20v-6h6v6" />
    </svg>
  )
}

function HeartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
    </svg>
  )
}

function RouteIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle
        cx="6"
        cy="19"
        r="2"
      />
      <circle
        cx="18"
        cy="5"
        r="2"
      />
      <path d="M8 19h3a4 4 0 0 0 4-4v-2a4 4 0 0 1 4-4" />
    </svg>
  )
}

function CoffeeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 8h13v5a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6V8Z" />
      <path d="M17 10h1a3 3 0 0 1 0 6h-2M6 3v2M10 3v2M14 3v2" />
    </svg>
  )
}

function DiningIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M16 3v18M16 3c3 2 4 5 4 8h-4" />
    </svg>
  )
}

function GlassIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 3h14l-2 7a5.2 5.2 0 0 1-10 0L5 3Z" />
      <path d="M12 15v6M8 21h8" />
    </svg>
  )
}

function WellnessIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 21c4-3 7-6.6 7-11a7 7 0 0 0-14 0c0 4.4 3 8 7 11Z" />
      <path d="M9 11c1.5 1 4.5 1 6 0M12 7v8" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="2"
      />
      <path d="M16 3v4M8 3v4M3 11h18" />
    </svg>
  )
}

function OfferIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 12 12 20 4 12V4h8l8 8Z" />
      <circle
        cx="8.5"
        cy="8.5"
        r="1.5"
      />
    </svg>
  )
}

function MapIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" />
      <path d="M9 3v15M15 6v15" />
    </svg>
  )
}

function GridIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="3"
        width="7"
        height="7"
        rx="1"
      />
      <rect
        x="14"
        y="3"
        width="7"
        height="7"
        rx="1"
      />
      <rect
        x="3"
        y="14"
        width="7"
        height="7"
        rx="1"
      />
      <rect
        x="14"
        y="14"
        width="7"
        height="7"
        rx="1"
      />
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="17"
      height="17"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
      />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
    </svg>
  )
}

function MapPinIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle
        cx="12"
        cy="10"
        r="2.5"
      />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z" />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2"
      />
      <path d="m3 7 9 6 9-6" />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="5"
      />
      <circle
        cx="12"
        cy="12"
        r="4"
      />
      <circle
        cx="17.5"
        cy="6.5"
        r="1"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M13.8 22v-8h2.7l.4-3h-3.1V9.1c0-.9.3-1.5 1.6-1.5H17V4.9c-.5-.1-1.3-.2-2.4-.2-2.4 0-4 1.5-4 4.1V11H8v3h2.6v8h3.2Z" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="17"
      height="17"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.9 3H22l-6.8 7.8L23.2 21H17l-4.9-6.4L6.5 21H3.4l7.2-8.3L2.8 3h6.4l4.4 5.8L18.9 3Zm-1.1 16h1.7L8.2 4.9H6.4L17.8 19Z" />
    </svg>
  )
}

function LinkedInIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="17"
      height="17"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M5.4 8.9H2.2V19h3.2V8.9ZM3.8 4A1.9 1.9 0 1 0 3.8 7.8 1.9 1.9 0 0 0 3.8 4ZM21.8 13.2c0-3.1-1.7-4.6-4-4.6-1.9 0-2.7 1-3.2 1.7V8.9h-3.2V19h3.2v-5.6c0-1.5.3-2.9 2.1-2.9 1.8 0 1.8 1.7 1.8 3V19h3.3v-5.8Z" />
    </svg>
  )
}

function YouTubeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="19"
      height="19"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M21.6 7.2a3 3 0 0 0-2.1-2.1C17.7 4.6 12 4.6 12 4.6s-5.7 0-7.5.5a3 3 0 0 0-2.1 2.1C2 9 2 12 2 12s0 3 .4 4.8a3 3 0 0 0 2.1 2.1c1.8.5 7.5.5 7.5.5s5.7 0 7.5-.5a3 3 0 0 0 2.1-2.1C22 15 22 12 22 12s0-3-.4-4.8ZM10 15.3V8.7l5.7 3.3-5.7 3.3Z" />
    </svg>
  )
}

function TikTokIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M16.7 3c.3 2.3 1.6 3.7 3.8 3.9v3.2a8.2 8.2 0 0 1-3.8-1.1v6.1a6.1 6.1 0 1 1-5.3-6.1v3.3a2.8 2.8 0 1 0 2 2.8V3h3.3Z" />
    </svg>
  )
}

function PinterestIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2a10 10 0 0 0-3.6 19.3c-.1-1.6 0-3.4.4-5l1.3-5.5s-.3-.7-.3-1.8c0-1.7 1-3 2.3-3 1.1 0 1.6.8 1.6 1.8 0 1.1-.7 2.7-1 4.2-.6 2.4 1.2 4.3 3.5 4.3 4.2 0 6.6-5.1 6.6-9.3 0-3.8-3.1-6.7-7.2-6.7-5.2 0-8.4 3.9-8.4 8.2 0 1.5.4 2.6 1.1 3.4.3.4.3.5.2.9l-.3 1.2c-.1.4-.4.5-.8.4-2.8-1.1-4.1-4.1-4.1-7.4C3.3 3.9 6.8 0 12.5 0 17.8 0 21 3.8 21 8.8c0 6.1-3.4 10.7-8.4 10.7-1.7 0-3.2-.9-3.7-1.9l-1 3.9c-.4 1.4-1.1 2.8-1.8 3.8A10 10 0 1 0 12 2Z" />
    </svg>
  )
}