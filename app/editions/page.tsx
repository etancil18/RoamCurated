
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

  return (
    <main className="min-h-screen bg-[#0a1727] text-[#f2eee7]">
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

      <div className="mx-auto max-w-7xl px-5 pb-24 pt-12 sm:px-8 lg:px-12 lg:pt-20">
        <header className="border-b border-white/10 pb-10 sm:pb-14">
          <div className="mb-9 flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/"
              className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d2ab86] transition hover:text-[#f1d0af]"
            >
              ← Back to Roam
            </Link>

            <span className="text-[10px] font-semibold uppercase tracking-[0.26em] text-white/45">
              Roam Editions / The Archive
            </span>
          </div>

          <h1 className="mt-5 max-w-4xl text-5xl font-black leading-[0.95] tracking-[-0.065em] sm:text-7xl lg:text-8xl">
            The Editorial
            <span className="block text-[#d2ab86]">
              Collection.
            </span>
          </h1>
        </header>

        <section
          aria-labelledby="library-heading"
          className="pt-12 sm:pt-16"
        >
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2
                id="library-heading"
                className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl"
              >
                Browse the Issues
              </h2>
            </div>

            <p className="text-xs uppercase tracking-[0.16em] text-white/45">
              {editions.length}{' '}
              {editions.length === 1 ? 'Issue' : 'Issues'}
            </p>
          </div>

          {editions.length === 0 ? (
            <div className="rounded-2xl border border-[#d2ab86]/20 bg-[#11243a] px-6 py-16 text-center sm:px-10">
              <div
                aria-hidden="true"
                className="mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-full border border-[#d2ab86]/30 text-3xl text-[#d2ab86]"
              >
                R
              </div>

              <h3 className="text-2xl font-bold tracking-tight">
                The shelves are being filled.
              </h3>

              <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-[#b9c2ca]">
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
                  <EditionCover edition={edition} />

                  <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#aab5bf]">
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
                </Link>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-24 border-t border-white/10 pt-6">
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
