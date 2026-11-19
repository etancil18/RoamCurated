
import type { Metadata } from 'next'
import Link from 'next/link'

import {
  getPublicEditions,
  type PublicEdition,
} from '@/lib/editorial/publicEditions'

// =====================================================
// EDITIONS LIBRARY — BUSINESS ANALYTICS
// =====================================================

import EditionsLibraryAnalytics from '@/components/editorial/EditionsLibraryAnalytics'

// =====================================================
// EDITIONS LIBRARY — PUBLIC SHARING
// =====================================================

import ShareEditionLink from '@/components/editorial/ShareEditionLink'

// =====================================================
// EDITIONS LIBRARY — DATABASE-MANAGED SOUNDTRACK DISCOVERY
//
// Used only to identify which public Editions have an
// enabled soundtrack. Playlist playback remains exclusively
// on the individual Edition page.
// =====================================================

import { supabaseAdmin } from '@/lib/supabase/admin'

export const metadata: Metadata = {
  title: 'The Roam Library | RoamCurated',
  description:
    'An ongoing collection of places, stories, seasons, and people. Explore the Roam Editions editorial archive.',
}

export const dynamic = 'force-dynamic'

const PALETTES = {
  midnight_navy: {
    background:
      'radial-gradient(ellipse at 70% 15%, #49647d 0%, #182f47 40%, #081729 100%)',
    accent: '#bed9e9',
  },
  after_hours: {
    background:
      'radial-gradient(ellipse at 70% 15%, #793f4c 0%, #421f2a 45%, #220f19 100%)',
    accent: '#e6b99c',
  },
  olive_oak: {
    background:
      'radial-gradient(ellipse at 70% 15%, #667259 0%, #233d32 45%, #10241d 100%)',
    accent: '#dfc7a6',
  },
  golden_hour: {
    background:
      'radial-gradient(ellipse at 70% 15%, #bb7954 0%, #70412f 45%, #382016 100%)',
    accent: '#ffd6a6',
  },
  noir_champagne: {
    background:
      'radial-gradient(ellipse at 70% 15%, #5f5859 0%, #28272d 45%, #141318 100%)',
    accent: '#d2ab86',
  },
  winter_blue: {
    background:
      'radial-gradient(ellipse at 70% 15%, #7798a8 0%, #263b50 45%, #112234 100%)',
    accent: '#c5dee6',
  },
} as const

type PaletteName = keyof typeof PALETTES

function getPalette(edition: PublicEdition) {
  const value = edition.design_settings?.palette

  if (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(PALETTES, value)
  ) {
    return PALETTES[value as PaletteName]
  }

  return PALETTES.midnight_navy
}

function publicationDate(value: string) {
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

function creatorCredit(edition: PublicEdition) {
  if (
    edition.credit_mode === 'roam_selects' ||
    !edition.creator
  ) {
    return 'A Roam Edit'
  }

  const name =
    edition.creator.full_name ||
    (edition.creator.username
      ? `@${edition.creator.username}`
      : 'Guest Creator')

  if (edition.credit_mode === 'creator_edit') {
    return `A Creator Edit by ${name}`
  }

  if (edition.credit_mode === 'roam_x_creator') {
    return `Roam × ${name}`
  }

  return 'A Roam Edit'
}

function EditionCover({
  edition,
}: {
  edition: PublicEdition
}) {
  const palette = getPalette(edition)

  return (
    <div
      className="relative aspect-[4/5] w-full overflow-hidden rounded-xl border border-white/10 text-white shadow-[0_24px_70px_rgba(0,0,0,0.28)] transition duration-500 group-hover:-translate-y-1 group-hover:shadow-[0_30px_85px_rgba(0,0,0,0.4)]"
      style={{
        background: palette.background,
      }}
    >
      <div
        className="absolute right-5 top-5 z-10 text-[10px] font-bold uppercase tracking-[0.22em]"
        style={{ color: palette.accent }}
      >
        Editions
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-[24%] top-[9%] w-[108%] rotate-[-13deg] opacity-[0.19]"
      >
        <img
          src="/branding/logo-transparent.png"
          alt=""
          className="h-auto w-full select-none object-contain"
        />
      </div>

      <div className="absolute bottom-[10%] left-[8%] right-[8%] z-10">
        <h3 className="max-w-[95%] break-words text-[clamp(28px,4vw,52px)] font-black leading-[0.98] tracking-[-0.055em]">
          {edition.title}
        </h3>

        {edition.subtitle && (
          <p className="mt-5 max-w-[90%] text-sm leading-relaxed text-white/75">
            {edition.subtitle}
          </p>
        )}

        <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">
          {creatorCredit(edition)}
        </p>
      </div>
    </div>
  )
}

export default async function EditionsLibraryPage() {
  const editions = await getPublicEditions()

  // =====================================================
  // EDITIONS LIBRARY — ENABLED SOUNDTRACK INDICATORS
  //
  // One batched, server-side lookup for the public Editions
  // already returned by getPublicEditions().
  //
  // No hardcoded playlist IDs or Edition associations.
  // No additional publication visibility rules.
  //
  // A failed soundtrack lookup must not prevent visitors
  // from browsing the existing editorial archive.
  // =====================================================

  const soundtrackEditionIds = new Set<string>()

  if (editions.length > 0) {
    try {
      const { data, error } = await supabaseAdmin
        .from('roam_editorial_edition_soundtracks')
        .select('edition_id')
        .in(
          'edition_id',
          editions.map((edition) => edition.id),
        )
        .eq('is_enabled', true)

      if (error) {
        console.error(
          '[EditionsLibrary] Unable to load soundtrack indicators:',
          error,
        )
      } else {
        for (const row of data ?? []) {
          if (typeof row.edition_id === 'string') {
            soundtrackEditionIds.add(row.edition_id)
          }
        }
      }
    } catch (error) {
      console.error(
        '[EditionsLibrary] Soundtrack indicator lookup failed:',
        error,
      )
    }
  }

  return (
    <main className="relative min-h-screen overflow-x-clip bg-[#070809] text-[#f5f3ef]">
      {/* =================================================
          EDITIONS LIBRARY — ROAM VISUAL ATMOSPHERE

          Matches the near-black Explore canvas.

          Editorial warmth is restrained so the individual
          Edition covers remain the dominant visual elements.

          The existing cover palettes are preserved.
          ================================================= */}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-[#d2ab86]/[0.035] blur-[130px]" />

        <div className="absolute -right-48 top-[22rem] h-[34rem] w-[34rem] rounded-full bg-white/[0.015] blur-[130px]" />

        <div className="absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-white/[0.018] to-transparent" />
      </div>

      {/* =================================================
          EDITIONS LIBRARY — BUSINESS ANALYTICS

          Tracks:
          1. Library page views
          2. Edition selection clicks

          No visual output and no modification to
          existing server-rendered edition content.
          ================================================= */}

      <EditionsLibraryAnalytics
        editionCount={editions.length}
      />

      <div className="relative mx-auto max-w-7xl px-5 pb-24 pt-12 sm:px-8 lg:px-12 lg:pt-20">
        {/* =================================================
            EDITORIAL LIBRARY — MASTHEAD

            Preserve existing archive navigation and sharing.
            Refine typography and spacing to establish
            a distinct publication identity.
            ================================================= */}

        <header className="border-b border-white/[0.09] pb-10 sm:pb-14">
          <div className="mb-11 flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/"
              className="group inline-flex min-h-11 items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#d2ab86] transition hover:text-[#f1d0af] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d2ab86]"
            >
              <span
                aria-hidden="true"
                className="transition-transform group-hover:-translate-x-1"
              >
                ←
              </span>

              Back to Roam
            </Link>

            {/* =================================================
                EDITIONS LIBRARY — SHARE ARCHIVE

                Shares the public /editions URL.
                Native share / copy-link behavior is handled
                by the dedicated client component.
                ================================================= */}

            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <span className="text-[10px] font-semibold uppercase tracking-[0.26em] text-white/45">
                The Archive
              </span>

              <ShareEditionLink
                path="/editions"
                title="The Roam Library"
                description="Explore the Roam Editions editorial archive."
              />
            </div>
          </div>

          {/* Editorial publication identifier */}

          <h1 className="mt-7 max-w-5xl font-serif text-[clamp(3.4rem,9vw,7.5rem)] font-normal leading-[0.92] tracking-[-0.06em] text-[#f5f3ef]">
            The Editorial
            <span className="block italic text-[#d2ab86]">
              Collection.
            </span>
          </h1>
        </header>

        {/* =================================================
            EDITORIAL ARCHIVE — EXISTING PUBLIC EDITIONS

            Same data source, ordering, cover styles, links,
            and selection analytics.

            Optional soundtrack presence is shown only
            as understated metadata beneath the cover.
            ================================================= */}

        <section
          aria-labelledby="library-heading"
          className="pt-12 sm:pt-16"
        >
          <div className="mb-9 flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.07] pb-5">
            <div>
              

              <h2
                id="library-heading"
                className="mt-3 font-serif text-3xl font-normal tracking-[-0.035em] text-[#f5f3ef] sm:text-4xl"
              >
                Browse the Issues
              </h2>
            </div>

            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
              {editions.length}{' '}
              {editions.length === 1 ? 'Issue' : 'Issues'}
            </p>
          </div>

          {editions.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.09] bg-white/[0.025] px-6 py-16 text-center sm:px-10">
              <div
                aria-hidden="true"
                className="mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-full border border-[#d2ab86]/25 text-3xl text-[#d2ab86]"
              >
                R
              </div>

              <h3 className="font-serif text-3xl font-normal tracking-[-0.035em] text-[#f5f3ef]">
                The shelves are being filled.
              </h3>

              <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-neutral-400">
                Our editorial collection is taking shape.
                Stories, people, and places worth remembering
                will find their home here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-x-7 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {editions.map((edition, index) => (
                <Link
                  key={edition.id}
                  href={`/editions/${encodeURIComponent(
                    edition.id,
                  )}`}
                  className="group block min-w-0 focus-visible:rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d2ab86]"
                  aria-label={`Read ${edition.title}`}

                  // =====================================
                  // EDITION SELECTION — ANALYTICS ONLY
                  // =====================================

                  data-roam-edition-id={edition.id}
                  data-roam-edition-position={index + 1}
                  data-roam-edition-city={edition.city ?? ''}
                  data-roam-edition-credit-mode={
                    edition.credit_mode ?? ''
                  }
                >
                  {/* Preserve the existing Edition cover. */}

                  <EditionCover edition={edition} />

                  {/* Existing publication metadata. */}

                  <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-400">
                    {edition.city && (
                      <span>{edition.city}</span>
                    )}

                    {edition.city && edition.published_at && (
                      <span aria-hidden="true">·</span>
                    )}

                    <span>
                      {publicationDate(edition.published_at)}
                    </span>
                  </div>

                  {/* =================================================
                      OPTIONAL SOUNDTRACK INDICATOR

                      Displayed only when Supabase has an
                      enabled soundtrack for this public Edition.

                      No embedded player on the archive.
                      ================================================= */}

                  {soundtrackEditionIds.has(edition.id) && (
                    <div className="mt-3 flex items-center gap-2">
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-3.5 w-3.5 text-[#d2ab86]"
                      >
                        <path d="M3 14v-3a9 9 0 0 1 18 0v3" />
                        <rect
                          x="2.5"
                          y="13"
                          width="4"
                          height="7"
                          rx="2"
                        />
                        <rect
                          x="17.5"
                          y="13"
                          width="4"
                          height="7"
                          rx="2"
                        />
                      </svg>

                      <span className="text-[10px] font-medium uppercase tracking-[0.13em] text-[#d2ab86]/85">
                        With soundtrack
                      </span>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-24 border-t border-white/[0.09] pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d2ab86]">
              Roam Editions
            </span>
          </div>
        </footer>
      </div>
    </main>
  )
}
