
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowUpRight,
  Instagram,
  Music2,
} from 'lucide-react'

import {
  getPublicEdition,
  type PublicEditionDetail,
} from '@/lib/editorial/publicEditions'

import RoamEditionReader from './RoamEditionReader'

// ============================================================
// ROAM EDITIONS — BUSINESS ANALYTICS
// ============================================================

import EditionReaderAnalytics from './EditionReaderAnalytics'

// ============================================================
// ROAM EDITIONS — PUBLIC SHARING
// ============================================================

import ShareEditionLink from '@/components/editorial/ShareEditionLink'

type PageProps = {
  params: Promise<{
    editionId: string
  }>
}

// ============================================================
// ROAM EDITIONS — PUBLIC READER
//
// Public-facing editorial experience.
//
// - No admin authentication required
// - Publication visibility enforced server-side
// - No unpublished or draft edition access
// - Interactive touch/trackpad/mouse swiping
// - Canonical venue profile links
// - Existing cover/closing palette system
// - No changes to admin or social export infrastructure
// ============================================================

export const dynamic = 'force-dynamic'

// ============================================================
// EDITORIAL CREDIT FORMAT
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

function formatPublicationDate(
  value: string,
): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

// ============================================================
// DYNAMIC SEO METADATA
//
// getPublicEdition() independently verifies:
// - is_public = true
// - published_at is not null
// - approved_at is not null
// - status is approved or archived
// ============================================================

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { editionId } = await params

  const edition = await getPublicEdition(editionId)

  if (!edition) {
    return {
      title: 'Edition Not Found | Roam',
      robots: {
        index: false,
        follow: false,
      },
    }
  }

  const description =
    edition.subtitle?.trim() ||
    `Explore ${edition.title}, a Roam Editions editorial collection of places worth knowing.`

  return {
    title: `${edition.title} | Roam Editions`,
    description,
    openGraph: {
      title: `${edition.title} | Roam Editions`,
      description,
      type: 'article',
      siteName: 'RoamCurated',
      publishedTime: edition.published_at,
    },
    twitter: {
      card: 'summary',
      title: `${edition.title} | Roam Editions`,
      description,
    },
  }
}

// ============================================================
// PUBLIC EDITION PAGE
// ============================================================

export default async function EditionReaderPage({
  params,
}: PageProps) {
  const { editionId } = await params

  const edition = await getPublicEdition(editionId)

  if (!edition) {
    notFound()
  }

  const publicationDate = formatPublicationDate(
    edition.published_at,
  )

  const credit = getCreatorCredit(edition)

  // ==========================================================
  // EDITORIAL CREDIT — PUBLIC CREATOR SOCIAL LINKS
  //
  // publicEditions.ts returns only explicitly public
  // Instagram/TikTok links from creator_social_links.
  //
  // Roam Selects editions do not imply creator endorsement.
  // ==========================================================

  const creatorSocialLinks =
    edition.creator &&
    edition.credit_mode !== 'roam_selects'
      ? edition.creator.social_links
      : []

  // ==========================================================
  // EDITORIAL DESCRIPTION
  //
  // Optional until the publication data layer includes
  // the saved description field.
  // No placeholder or subtitle duplication.
  // ==========================================================

  const editorialDescription = (
    edition as PublicEditionDetail & {
      description?: string | null
    }
  ).description?.trim()

  return (
    <main className="min-h-[100dvh] bg-[#0a1727] pt-16 text-[#f2eee7]">
      {/* ======================================================
          BUSINESS ANALYTICS — PUBLISHED EDITION VIEW

          Client-side observation, not a server request count.
          No changes to publication permissions or reader logic.
          ====================================================== */}

      <EditionReaderAnalytics
        editionId={edition.id}
        city={edition.city}
        creditMode={edition.credit_mode}
        placeCount={edition.items.length}
        hasCreatorProfile={Boolean(
          edition.creator?.username &&
            edition.credit_mode !== 'roam_selects',
        )}
      />

      <div className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-8 lg:px-12 lg:pt-12">
        {/* Header navigation */}
        <header className="mb-10 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <Link
            href="/editions"
            className="inline-flex min-h-11 items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#d2ab86] transition hover:text-[#f1d0af] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d2ab86]"
          >
            <span aria-hidden="true">←</span>
            The Roam Library
          </Link>

          {/* ==================================================
              PUBLIC EDITION — SHARE THIS ISSUE

              Shares this published edition's canonical path.
              Native sharing and copy-link fallback are
              handled by the dedicated client component.
              ================================================== */}

          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <span className="text-[10px] font-semibold uppercase tracking-[0.26em] text-white/45">
              Roam Editions / The Archive
            </span>

            <ShareEditionLink
              path={`/editions/${encodeURIComponent(
                edition.id,
              )}`}
              title={`${edition.title} | Roam Editions`}
              description={
                edition.subtitle?.trim() ||
                `Explore ${edition.title} on Roam.`
              }
            />
          </div>
        </header>

        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,540px)] lg:items-start lg:gap-12">
          {/* Editorial information */}
          <div className="lg:sticky lg:top-12">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#c68b67]">
              The Editorial Collection
            </p>

            <h1 className="mt-5 max-w-2xl break-words text-5xl font-black leading-[0.95] tracking-[-0.065em] sm:text-6xl lg:text-7xl">
              {edition.title}
            </h1>

            {edition.subtitle && (
              <p className="mt-6 max-w-lg text-lg leading-8 text-[#b9c2ca]">
                {edition.subtitle}
              </p>
            )}

            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#aeb9c5]">
              {edition.city && (
                <span>{edition.city}</span>
              )}

              {publicationDate && (
                <span>{publicationDate}</span>
              )}

              <span>
                {edition.items.length}{' '}
                {edition.items.length === 1
                  ? 'Place'
                  : 'Places'}
              </span>
            </div>

            <div className="mt-8 border-t border-white/10 pt-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c68b67]">
                Editorial Credit
              </p>

              <p className="mt-2 text-sm text-[#e6ddd4]">
                {edition.creator?.username &&
                edition.credit_mode !== 'roam_selects' ? (
                  <>
                    {edition.credit_mode === 'creator_edit'
                      ? 'A Creator Edit by '
                      : edition.credit_mode === 'roam_x_creator'
                        ? 'Roam × '
                        : ''}

                    <Link
                      href={`/u/${encodeURIComponent(
                        edition.creator.username,
                      )}`}
                      className="font-semibold text-[#d2ab86] underline decoration-[#d2ab86]/40 underline-offset-4 transition hover:text-[#f1d0af] hover:decoration-[#f1d0af] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d2ab86]"

                      // =====================================
                      // BUSINESS ANALYTICS — CREATOR DISCOVERY
                      // =====================================

                      data-roam-edition-creator-profile="true"
                    >
                      {edition.creator.full_name?.trim() ||
                        `@${edition.creator.username}`}

                      {/* SVG replaces platform-dependent ↗ glyph */}
                      <ArrowUpRight
                        aria-hidden="true"
                        className="ml-1 inline-block h-3.5 w-3.5 align-[-1px]"
                      />
                    </Link>
                  </>
                ) : (
                  credit
                )}
              </p>

              {/* ==================================================
                  EDITORIAL CREDIT — CREATOR SOCIAL ACCOUNTS

                  Only public Instagram/TikTok URLs returned
                  by the existing public edition data layer.

                  Links are separate from the creator profile
                  link; no nested interactive elements.
                  ================================================== */}

              {creatorSocialLinks.length > 0 && (
                <nav
                  aria-label="Featured creator social profiles"
                  className="mt-4 flex flex-wrap items-center gap-2"
                >
                  {creatorSocialLinks.map((link) => {
                    const isInstagram =
                      link.platform === 'instagram'

                    const Icon = isInstagram
                      ? Instagram
                      : Music2

                    const label = isInstagram
                      ? 'Instagram'
                      : 'TikTok'

                    return (
                      <a
                        key={link.platform}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Visit featured creator on ${label} (opens in a new tab)`}
                        className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 text-[11px] font-medium text-[#b9c2ca] transition hover:border-[#d2ab86]/40 hover:bg-white/[0.08] hover:text-[#f1d0af] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d2ab86]"
                      >
                        <Icon
                          aria-hidden="true"
                          className="h-3.5 w-3.5 shrink-0"
                        />

                        <span>{label}</span>

                        <ArrowUpRight
                          aria-hidden="true"
                          className="h-3 w-3 shrink-0 opacity-60"
                        />
                      </a>
                    )
                  })}
                </nav>
              )}
            </div>

            {/* Editorial description — displayed only when saved */}
            {editorialDescription && (
              <section
                aria-labelledby="edition-description-heading"
                className="mt-8 border-t border-white/10 pt-6"
              >
                <h2
                  id="edition-description-heading"
                  className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c68b67]"
                >
                  About This Edition
                </h2>

                <p className="mt-4 max-w-lg whitespace-pre-line text-sm leading-7 text-[#b9c2ca]">
                  {editorialDescription}
                </p>
              </section>
            )}
          </div>

          {/* Swipeable editorial */}
          <div className="min-w-0">
            <RoamEditionReader edition={edition} />
          </div>
        </div>

        {/* Return to the library */}
        <footer className="mx-auto mt-20 max-w-6xl border-t border-white/10 pt-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
              Roam Editions · Play Your City
            </span>
          </div>
        </footer>
      </div>
    </main>
  )
}
