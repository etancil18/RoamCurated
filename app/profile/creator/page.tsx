import type {
  Metadata,
} from 'next'

import Link from 'next/link'

import {
  redirect,
} from 'next/navigation'

import CreatorModeForm from '@/components/profile/creator/CreatorModeForm'

import CreatorKnowledgeAnswersEditor from '@/components/profile/creator/CreatorKnowledgeAnswersEditor'

import {
  CreatorSettingsLoadError,
  getCreatorSettings,
} from '@/lib/creator/getCreatorSettings'

import {
  CREATOR_MODE_COPY,
  CREATOR_ROUTES,
} from '@/lib/creator/constants'

import {
  safelyLoadPublicCreatorReputation,
} from '@/lib/reputation/safelyLoadPublicCreatorReputation'

import {
  CreatorOnboardingLoadError,
  getPrivateCreatorOnboarding,
} from '@/lib/creator-onboarding/getCreatorOnboarding'

import {
  createServerClient,
} from '@/lib/supabase/server'

import type {
  CreatorOnboardingState,
} from '@/lib/creator-onboarding/types'

export const dynamic =
  'force-dynamic'

export const metadata: Metadata = {
  title:
    'Creator Mode | Roam',

  description:
    'Build and manage your Roam creator profile, social links, collaboration availability, public exploration map, and collections.',

  robots: {
    index:
      false,

    follow:
      false,
  },
}

/* =========================================================
 * Page
 * ======================================================= */

export default async function CreatorSettingsPage() {
  let settings:
    Awaited<
      ReturnType<
        typeof getCreatorSettings
      >
    >

  try {
    settings =
      await getCreatorSettings()
  } catch (error) {
    if (
      error instanceof
      CreatorSettingsLoadError
    ) {
      console.error(
        '[app/profile/creator/page] Creator settings failed to load:',
        {
          code:
            error.code,

          message:
            error.message,
        }
      )

      return (
        <CreatorSettingsLoadFailure
          message={
            error.message
          }
        />
      )
    }

    throw error
  }

  if (!settings) {
    redirect(
      `/login?next=${encodeURIComponent(
        CREATOR_ROUTES.settings
      )}`
    )
  }

  const {
    userId,
    baseProfile,
    creatorProfile,
    socialLinks,
    selectedTagIds,
    availableTags,
  } =
    settings

  let creatorOnboarding:
    CreatorOnboardingState | null =
      null

  try {
    const supabase =
      await createServerClient()

    creatorOnboarding =
      await getPrivateCreatorOnboarding({
        supabase,
        creatorUserId:
          userId,
      })
  } catch (error) {
    if (
      error instanceof
      CreatorOnboardingLoadError
    ) {
      console.error(
        '[app/profile/creator/page] Creator knowledge failed to load:',
        {
          code:
            error.code,

          message:
            error.message,
        }
      )
    } else {
      console.error(
        '[app/profile/creator/page] Unexpected creator knowledge load failure:',
        error
      )
    }
  }

  /**
   * Server-component equivalent of the authenticated
   * /api/profile/reputation endpoint.
   *
   * This page calls the canonical loader directly rather than
   * adding an unnecessary server-to-server HTTP request.
   */
  const reputationResult =
    await safelyLoadPublicCreatorReputation(
      userId,
      {
        includeUnranked:
          true,

        includeGlobal:
          true,

        includeCity:
          true,
      }
    )

  const creatorModeEnabled =
    baseProfile
      .creator_mode_enabled ===
    true

  /**
   * Fail closed.
   *
   * The exploration map is considered public only when both
   * Creator Mode and the explicit map opt-in are enabled.
   */
  const showPublicExplorationMap =
    creatorModeEnabled &&
    baseProfile
      .show_public_exploration_map ===
      true

  const publicProfileHref =
    baseProfile.username
      ? CREATOR_ROUTES
          .publicProfile(
            baseProfile.username
          )
      : null

  const publicSocialLinkCount =
    socialLinks.filter(
      (
        link
      ) =>
        link.is_public
    ).length

  return (
    <main className="min-h-screen w-full overflow-x-clip bg-black text-white">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute left-[-22%] top-[-8%] h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl sm:left-[-10%]" />

        <div className="absolute right-[-28%] top-[18%] h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl sm:right-[-12%]" />
      </div>

      <div className="relative z-10 mx-auto w-full min-w-0 max-w-5xl px-4 pb-16 pt-[calc(4rem+env(safe-area-inset-top)+1rem)] sm:px-6">
        <CreatorSettingsHeader
          creatorModeEnabled={
            creatorModeEnabled
          }
          showPublicExplorationMap={
            showPublicExplorationMap
          }
          publicProfileHref={
            publicProfileHref
          }
        />

        <div className="mt-7 space-y-8 sm:mt-9 sm:space-y-10">
          <section
            id="creator-overview"
            aria-labelledby="creator-overview-title"
          >
            <h2
              id="creator-overview-title"
              className="sr-only"
            >
              Creator profile overview
            </h2>

            <CreatorModeStatusCard
              creatorModeEnabled={
                creatorModeEnabled
              }
              showPublicExplorationMap={
                showPublicExplorationMap
              }
              username={
                baseProfile.username
              }
              hasCreatorProfile={
                creatorProfile !==
                null
              }
              publicSocialLinkCount={
                publicSocialLinkCount
              }
              collaborationTagCount={
                selectedTagIds.length
              }
              reputationFound={
                reputationResult.found
              }
            />
          </section>

          <section
            id="creator-profile"
            aria-labelledby="creator-settings-form-title"
          >
            <SectionHeading
              id="creator-settings-form-title"
              title="Profile details"
              description="Control what people see and how they can connect with you."
            />

            <div className="mt-4 w-full min-w-0 overflow-hidden rounded-[1.75rem] border border-neutral-800/90 bg-neutral-950/80 shadow-2xl shadow-black/30 backdrop-blur-xl sm:rounded-[2rem]">
              <div className="flex min-w-0 items-center justify-between gap-3 border-b border-neutral-800/80 px-4 py-3.5 sm:px-6 sm:py-4">
                <p className="text-xs font-medium text-neutral-500">
                  Your public creator settings
                </p>

                <CreatorModeBadge
                  enabled={
                    creatorModeEnabled
                  }
                />
              </div>

              <div className="w-full min-w-0 p-3 sm:p-6">
                <CreatorModeForm
                  settings={
                    settings
                  }
                />
              </div>
            </div>
          </section>

          <section
            id="creator-knowledge"
            aria-labelledby="creator-knowledge-title"
          >
            <SectionHeading
              id="creator-knowledge-title"
              title="Creator knowledge"
              description="Keep your recommendations, routines, local expertise, and personal taste current."
            />

            <div className="mt-4">
              <CreatorKnowledgeAnswersEditor
                initialOnboarding={
                  creatorOnboarding
                }
              />
            </div>
          </section>

          <section
            id="creator-collections"
            aria-labelledby="creator-collections-title"
          >
            <SectionHeading
              id="creator-collections-title"
              title="Collections"
              description="Turn the places and experiences you love into guides people can save."
            />

            <div className="mt-4">
              <CreatorCollectionsCard
                creatorModeEnabled={
                  creatorModeEnabled
                }
              />
            </div>
          </section>

          <section
            id="creator-tips"
            aria-labelledby="creator-tips-title"
          >
            <CreatorModeGuidance />
          </section>
        </div>
      </div>
    </main>
  )
}

/* =========================================================
 * Page header
 * ======================================================= */

function CreatorSettingsHeader({
  creatorModeEnabled,
  showPublicExplorationMap,
  publicProfileHref,
}: {
  creatorModeEnabled:
    boolean

  showPublicExplorationMap:
    boolean

  publicProfileHref:
    string | null
}) {
  return (
    <header className="w-full min-w-0">
      <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-400 sm:text-xs">
            {
              CREATOR_MODE_COPY
                .eyebrow
            }
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Your creator profile
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">
            Manage how you show up, what
            you recommend, and how people
            can connect with you.
          </p>

          <div className="mt-4 flex min-w-0 flex-wrap items-center gap-2">
            <CreatorModeBadge
              enabled={
                creatorModeEnabled
              }
            />

            <CreatorExplorationMapBadge
              enabled={
                showPublicExplorationMap
              }
            />
          </div>
        </div>

        <nav
          aria-label="Creator settings actions"
          className="grid w-full shrink-0 grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap"
        >
          <Link
            href="/profile"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm font-medium text-neutral-300 transition hover:border-neutral-600 hover:bg-neutral-900 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <span
              aria-hidden="true"
              className="mr-2"
            >
              ←
            </span>

            My Account
          </Link>

          {publicProfileHref ? (
            <Link
              href={
                publicProfileHref
              }
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-200 transition hover:border-cyan-400/60 hover:bg-cyan-500/20 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              View Profile

              <span
                aria-hidden="true"
                className="ml-2"
              >
                →
              </span>
            </Link>
          ) : null}
        </nav>
      </div>
    </header>
  )
}

function SectionHeading({
  id,
  title,
  description,
}: {
  id:
    string

  title:
    string

  description:
    string
}) {
  return (
    <div className="min-w-0">
      <h2
        id={id}
        className="text-xl font-semibold tracking-tight text-white sm:text-2xl"
      >
        {title}
      </h2>

      <p className="mt-1.5 max-w-2xl text-sm leading-6 text-neutral-400">
        {description}
      </p>
    </div>
  )
}

/* =========================================================
 * Status badges
 * ======================================================= */

function CreatorModeBadge({
  enabled,
}: {
  enabled:
    boolean
}) {
  return (
    <span
      className={[
        'inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold',

        enabled
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
          : 'border-neutral-700 bg-neutral-900 text-neutral-400',
      ].join(
        ' '
      )}
    >
      <span
        aria-hidden="true"
        className={[
          'h-2 w-2 rounded-full',

          enabled
            ? 'bg-emerald-400'
            : 'bg-neutral-600',
        ].join(
          ' '
        )}
      />

      {enabled
        ? 'Creator profile live'
        : 'Creator profile off'}
    </span>
  )
}

function CreatorExplorationMapBadge({
  enabled,
}: {
  enabled:
    boolean
}) {
  return (
    <span
      className={[
        'inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold',

        enabled
          ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-200'
          : 'border-neutral-700 bg-neutral-900 text-neutral-500',
      ].join(
        ' '
      )}
    >
      <span
        aria-hidden="true"
        className={[
          'h-2 w-2 rounded-full',

          enabled
            ? 'bg-indigo-400'
            : 'bg-neutral-600',
        ].join(
          ' '
        )}
      />

      {enabled
        ? 'Map visible'
        : 'Map hidden'}
    </span>
  )
}

/* =========================================================
 * Status overview
 * ======================================================= */

function CreatorModeStatusCard({
  creatorModeEnabled,
  showPublicExplorationMap,
  username,
  hasCreatorProfile,
  publicSocialLinkCount,
  collaborationTagCount,
  reputationFound,
}: {
  creatorModeEnabled:
    boolean

  showPublicExplorationMap:
    boolean

  username:
    string | null

  hasCreatorProfile:
    boolean

  publicSocialLinkCount:
    number

  collaborationTagCount:
    number

  reputationFound:
    boolean
}) {
  const checks = [
    {
      label:
        'Public link',

      complete:
        Boolean(
          username
        ),

      detail:
        username
          ? `@${username}`
          : 'Add a username',
    },
    {
      label:
        'Creator story',

      complete:
        hasCreatorProfile,

      detail:
        hasCreatorProfile
          ? 'Complete'
          : 'Add your story',
    },
    {
      label:
        'Contact links',

      complete:
        publicSocialLinkCount >
        0,

      detail:
        publicSocialLinkCount ===
        1
          ? '1 visible'
          : `${publicSocialLinkCount.toLocaleString(
              'en-US'
            )} visible`,
    },
    {
      label:
        'Collaborations',

      complete:
        collaborationTagCount >
        0,

      detail:
        collaborationTagCount ===
        1
          ? '1 selected'
          : `${collaborationTagCount.toLocaleString(
              'en-US'
            )} selected`,
    },
    {
      label:
        'Roam reputation',

      complete:
        reputationFound,

      detail:
        reputationFound
          ? 'Activity found'
          : 'Still building',
    },
  ]

  const completedCount =
    checks.filter(
      (
        check
      ) =>
        check.complete
    ).length

  return (
    <section className="relative w-full min-w-0 overflow-hidden rounded-[1.75rem] border border-neutral-800/90 bg-gradient-to-br from-neutral-950 via-neutral-950 to-black p-4 sm:p-5">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent"
      />

      <div className="relative z-10 flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-500">
            Profile readiness
          </p>

          <h3 className="mt-1.5 text-lg font-semibold text-white">
            {creatorModeEnabled
              ? 'Your creator profile is live'
              : 'Get your creator profile ready'}
          </h3>

          <p className="mt-1 max-w-xl text-xs leading-5 text-neutral-500 sm:text-sm sm:leading-6">
            {creatorModeEnabled
              ? 'Keep the essentials current so people immediately understand your point of view.'
              : 'Complete the essentials, then turn Creator Mode on when you are ready to be discovered.'}
          </p>
        </div>

        <div className="shrink-0 rounded-xl border border-neutral-800 bg-black/40 px-3 py-2 text-right">
          <p className="text-lg font-semibold leading-none text-white">
            {completedCount}/
            {checks.length}
          </p>

          <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
            Ready
          </p>
        </div>
      </div>

      <div className="relative z-10 mt-4 divide-y divide-neutral-800/80 rounded-2xl border border-neutral-800 bg-black/25">
        {checks.map(
          (
            check
          ) => (
            <div
              key={
                check.label
              }
              className="flex min-w-0 items-center gap-3 px-3 py-2.5 sm:px-4"
            >
              <span
                aria-hidden="true"
                className={[
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',

                  check.complete
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : 'bg-neutral-800 text-neutral-500',
                ].join(
                  ' '
                )}
              >
                {check.complete
                  ? '✓'
                  : '·'}
              </span>

              <p className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-300">
                {check.label}
              </p>

              <p className="max-w-[45%] shrink-0 truncate text-right text-xs text-neutral-500">
                {check.detail}
              </p>
            </div>
          )
        )}
      </div>

      <ExplorationMapStatus
        creatorModeEnabled={
          creatorModeEnabled
        }
        showPublicExplorationMap={
          showPublicExplorationMap
        }
      />
    </section>
  )
}

function ExplorationMapStatus({
  creatorModeEnabled,
  showPublicExplorationMap,
}: {
  creatorModeEnabled:
    boolean

  showPublicExplorationMap:
    boolean
}) {
  const isPublic =
    creatorModeEnabled &&
    showPublicExplorationMap

  return (
    <div
      className={[
        'relative z-10 mt-3 flex min-w-0 items-center gap-3 rounded-2xl border px-3 py-2.5 sm:px-4',

        isPublic
          ? 'border-indigo-500/25 bg-indigo-500/[0.07]'
          : 'border-neutral-800 bg-black/25',
      ].join(
        ' '
      )}
    >
      <span
        aria-hidden="true"
        className={[
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-sm',

          isPublic
            ? 'border-indigo-500/30 bg-indigo-500/15 text-indigo-200'
            : 'border-neutral-800 bg-neutral-950 text-neutral-500',
        ].join(
          ' '
        )}
      >
        🗺️
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-neutral-300">
          Exploration map
        </p>

        <p className="mt-0.5 text-[11px] leading-4 text-neutral-500">
          {isPublic
            ? 'Eligible places you explore can appear on your public profile.'
            : creatorModeEnabled
              ? 'Your explored places stay private until you choose to show them.'
              : 'Your map stays private while Creator Mode is off.'}
        </p>
      </div>

      <span
        className={[
          'shrink-0 rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]',

          isPublic
            ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-200'
            : 'border-neutral-700 bg-neutral-900 text-neutral-500',
        ].join(
          ' '
        )}
      >
        {isPublic
          ? 'Visible'
          : 'Hidden'}
      </span>
    </div>
  )
}

/* =========================================================
 * Collections
 * ======================================================= */

function CreatorCollectionsCard({
  creatorModeEnabled,
}: {
  creatorModeEnabled:
    boolean
}) {
  return (
    <section className="relative w-full min-w-0 overflow-hidden rounded-[1.75rem] border border-indigo-500/20 bg-gradient-to-br from-indigo-500/[0.08] via-neutral-950 to-black p-4 sm:p-5">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-500/25 bg-indigo-500/10 text-base">
            ✦
          </div>

          <h3 className="mt-3 text-lg font-semibold text-white">
            Build collections people
            will save
          </h3>

          <p className="mt-1 max-w-xl text-sm leading-6 text-neutral-400">
            Group your favorite venues,
            properties, flows, and
            snapshots into useful,
            shareable guides.
          </p>

          {!creatorModeEnabled ? (
            <p className="mt-2 max-w-xl text-xs leading-5 text-amber-300/80">
              You can build now. Your
              collections will stay private
              until Creator Mode is active.
            </p>
          ) : null}
        </div>

        <Link
          href={
            CREATOR_ROUTES
              .collections
          }
          className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-5 py-2.5 text-sm font-semibold text-indigo-200 transition hover:border-indigo-400/60 hover:bg-indigo-500/20 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 sm:w-auto"
        >
          Manage collections

          <span
            aria-hidden="true"
            className="ml-2"
          >
            →
          </span>
        </Link>
      </div>
    </section>
  )
}

/* =========================================================
 * Guidance
 * ======================================================= */

function CreatorModeGuidance() {
  return (
    <details className="group w-full min-w-0 overflow-hidden rounded-[1.75rem] border border-neutral-800/80 bg-neutral-950/60">
      <summary className="flex min-h-[76px] cursor-pointer list-none items-center justify-between gap-4 p-4 outline-none transition hover:bg-white/[0.02] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400 sm:p-5 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-500">
            Quick tips
          </p>

          <h2
            id="creator-tips-title"
            className="mt-1 text-lg font-semibold text-white"
          >
            Build a stronger profile
          </h2>

          <p className="mt-1 max-w-2xl text-xs leading-5 text-neutral-500">
            Three ways to make your
            creator identity clearer and
            more useful.
          </p>
        </div>

        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-800 bg-black/30 text-lg text-neutral-400 transition group-open:rotate-45 group-open:border-cyan-500/30 group-open:text-cyan-300"
        >
          +
        </span>
      </summary>

      <div className="border-t border-neutral-800/80 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <GuidanceItem
            number="01"
            title="Be memorable"
            description="Say what you are known for, which cities you cover, and what kind of experiences you share."
          />

          <GuidanceItem
            number="02"
            title="Show your taste"
            description="Use genuine Roam activity, collections, and your optional map to make your point of view visible."
          />

          <GuidanceItem
            number="03"
            title="Make connecting easy"
            description="Keep at least one public contact or social link current so people know where to reach you."
          />
        </div>
      </div>
    </details>
  )
}

function GuidanceItem({
  number,
  title,
  description,
}: {
  number:
    string

  title:
    string

  description:
    string
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-neutral-800 bg-black/25 p-4">
      <p className="text-xs font-semibold text-cyan-400">
        {number}
      </p>

      <p className="mt-2 text-sm font-semibold text-white">
        {title}
      </p>

      <p className="mt-1 text-xs leading-5 text-neutral-500">
        {description}
      </p>
    </div>
  )
}

/* =========================================================
 * Safe loader failure state
 * ======================================================= */

function CreatorSettingsLoadFailure({
  message,
}: {
  message:
    string
}) {
  return (
    <main className="min-h-screen w-full overflow-x-clip bg-black px-4 pb-16 pt-[calc(4rem+env(safe-area-inset-top)+1rem)] text-white sm:px-6">
      <div className="mx-auto w-full max-w-2xl">
        <section
          role="alert"
          className="rounded-[1.75rem] border border-red-900/60 bg-red-950/20 p-5 sm:rounded-[2rem] sm:p-6"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-red-400">
            Creator Mode
          </p>

          <h1 className="mt-2 text-2xl font-semibold text-white">
            Creator settings unavailable
          </h1>

          <p className="mt-3 text-sm leading-6 text-red-200/80">
            {message}
          </p>

          <div className="mt-5 grid gap-2 sm:flex sm:flex-wrap">
            <Link
              href={
                CREATOR_ROUTES
                  .settings
              }
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-400"
            >
              Try again
            </Link>

            <Link
              href="/profile"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-neutral-700 px-4 py-2.5 text-sm font-medium text-neutral-300 transition hover:border-neutral-500 hover:text-white"
            >
              Back to profile
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}