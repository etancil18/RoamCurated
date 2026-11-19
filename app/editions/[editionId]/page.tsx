
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

// ============================================================
// ROAM EDITIONS — DATABASE-MANAGED EDITION SOUNDTRACK
// ============================================================

import {
  getPublicEditionSoundtrack,
} from '@/lib/editorial/publicEditionSoundtracks'

import EditionSoundtrackCard from '@/components/editorial/EditionSoundtrackCard'

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
//
// Concise public-facing attribution.
//
// The underlying credit modes remain unchanged:
// - roam_selects
// - creator_edit
// - roam_x_creator
// ============================================================

function getCreatorCredit(
  edition: PublicEditionDetail,
): string {
  if (
    edition.credit_mode === 'roam_selects' ||
    !edition.creator
  ) {
    return 'Roam'
  }

  const creatorName =
    edition.creator.full_name?.trim() ||
    (edition.creator.username
      ? `@${edition.creator.username}`
      : null)

  if (!creatorName) {
    return 'Roam'
  }

  if (edition.credit_mode === 'creator_edit') {
    return creatorName
  }

  if (edition.credit_mode === 'roam_x_creator') {
    return `Roam × ${creatorName}`
  }

  return 'Roam'
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

  // ==========================================================
  // EDITION SOUNDTRACK — DATABASE-MANAGED PUBLIC COMPANION
  //
  // The existing getPublicEdition() visibility checks
  // must pass before resolving an Edition's soundtrack.
  //
  // Soundtrack pairings are managed in Supabase.
  // Editions without an enabled playlist remain unchanged.
  // ==========================================================

  const soundtrack = await getPublicEditionSoundtrack(
    edition.id,
  )

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
    <main className="relative min-h-[100dvh] overflow-x-clip bg-[#070809] pt-16 text-[#f5f3ef]">
      {/* ======================================================
          EDITIONS — ROAM VISUAL ATMOSPHERE

          Align the canvas with Explore's near-black palette.
          Decorative only. No interaction or reader changes.
          ====================================================== */}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute left-[-18%] top-[-9rem] h-[30rem] w-[30rem] rounded-full bg-[#d2ab86]/[0.035] blur-[120px]" />

        <div className="absolute right-[-20%] top-[20rem] h-[34rem] w-[34rem] rounded-full bg-white/[0.015] blur-[130px]" />

        <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-white/[0.018] to-transparent" />
      </div>

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

      <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-7 sm:px-8 lg:px-12 lg:pt-10">
        {/* ==================================================
            PUBLIC EDITION — LIBRARY NAVIGATION AND SHARING

            Existing links and sharing behavior preserved.
            ================================================== */}

        <header className="mb-10 flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.09] pb-5 lg:mb-14">
          <Link
            href="/editions"
            className="group inline-flex min-h-11 items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#d2ab86] transition hover:text-[#f1d0af] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d2ab86]"
          >
            <span
              aria-hidden="true"
              className="text-lg font-normal transition-transform group-hover:-translate-x-1"
            >
              ←
            </span>

            The Editorial Collection
          </Link>

          <div className="flex flex-wrap items-center gap-3 sm:gap-5">
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.23em] text-white/35 sm:inline">
              The Archive
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

        {/* ==================================================
            THE LIVING EDITION

            Editorial information and the existing swipeable
            Edition reader remain separate.

            No additional hero or reader wrapper is added.
            ================================================== */}

        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,540px)] lg:items-start lg:gap-14">
          {/* ==================================================
              LEFT COLUMN — EDITORIAL IDENTITY
              ================================================== */}

          <div className="min-w-0 lg:sticky lg:top-24">
            {/* Publication marker */}

            {/* The Edition's existing title remains the hero
                of the editorial information column. */}

            <h1 className="mt-7 max-w-2xl break-words font-serif text-[clamp(3.25rem,6vw,5.8rem)] font-normal leading-[0.96] tracking-[-0.055em] text-[#f5f3ef]">
              {edition.title}
            </h1>

            {edition.subtitle && (
              <p className="mt-6 max-w-lg text-base leading-7 text-neutral-400 sm:text-lg sm:leading-8">
                {edition.subtitle}
              </p>
            )}

            {/* Editorial metadata */}

            <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-500">
              {edition.city && (
                <span className="text-neutral-300">
                  {edition.city}
                </span>
              )}

              {edition.city && publicationDate && (
                <span
                  aria-hidden="true"
                  className="h-1 w-1 rounded-full bg-[#d2ab86]/50"
                />
              )}

              {publicationDate && (
                <span>{publicationDate}</span>
              )}

              {(edition.city || publicationDate) && (
                <span
                  aria-hidden="true"
                  className="h-1 w-1 rounded-full bg-[#d2ab86]/50"
                />
              )}

              <span>
                {edition.items.length}{' '}
                {edition.items.length === 1
                  ? 'Place'
                  : 'Places'}
              </span>
            </div>

            {/* ==================================================
                CREATOR ATTRIBUTION — CONCISE PUBLIC BYLINE

                Credit modes and creator profile navigation
                remain unchanged.
                ================================================== */}

            <div className="mt-9 border-t border-white/[0.1] pt-6">
              <div className="flex items-start gap-4">
                <span
                  aria-hidden="true"
                  className="mt-1 block h-8 w-px shrink-0 bg-[#d2ab86]/55"
                />

                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.19em] text-[#c68b67]">
                    Curated By
                  </p>

                  <p className="mt-2 text-sm leading-6 text-[#e6ddd4]">
                    {edition.creator?.username &&
                    edition.credit_mode !== 'roam_selects' ? (
                      <>
                        {edition.credit_mode === 'roam_x_creator'
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
                            className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 text-[11px] font-medium text-neutral-400 transition hover:border-[#d2ab86]/35 hover:bg-white/[0.065] hover:text-[#f1d0af] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d2ab86]"
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
              </div>
            </div>

            {/* ==================================================
                EDITION SOUNDTRACK — QUIET LISTENING COMPANION

                Database-managed through Supabase.

                The compact component does not visibly render
                the generic database title or description.

                Kept outside RoamEditionReader so slide
                navigation does not remount Spotify.
                ================================================== */}

            {soundtrack && (
              <div className="mt-7 border-y border-white/[0.09] py-5">
                <EditionSoundtrackCard
                  title={soundtrack.title}
                  description={soundtrack.description}
                  spotifyPlaylistId={soundtrack.spotifyPlaylistId}
                />
              </div>
            )}

            {/* ==================================================
                EDITORIAL DESCRIPTION — EXISTING CONTENT

                Preserve conditional rendering and saved copy.
                ================================================== */}

            {editorialDescription && (
              <section
                aria-labelledby="edition-description-heading"
                className="mt-8"
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="h-px w-5 shrink-0 bg-[#c68b67]/60"
                  />

                  <h2
                    id="edition-description-heading"
                    className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c68b67]"
                  >
                    Behind the Story
                  </h2>
                </div>

                <p className="mt-5 max-w-lg whitespace-pre-line text-sm leading-7 text-neutral-400">
                  {editorialDescription}
                </p>
              </section>
            )}
          </div>

          {/* ==================================================
              RIGHT COLUMN — EXISTING SWIPEABLE EDITION

              The reader is deliberately left untouched.
              Its artwork, controls, and transitions remain
              the primary visual experience on the page.
              ================================================== */}

          <div className="min-w-0">
            <RoamEditionReader edition={edition} />
          </div>
        </div>

        {/* ==================================================
            FOOTER — RETURN TO THE LIBRARY
            ================================================== */}

         <footer className="mt-24 border-t border-white/[0.09] pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d2ab86]">
              Roam Editions
            </span>

            <Link
              href="/editions"
              className="inline-flex min-h-11 items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#d2ab86] transition hover:text-[#f1d0af] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d2ab86]"
            >
              Back to the Collection

              <ArrowUpRight
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
            </Link>
          </div>
        </footer>
      </div>
    </main>
  )
}
