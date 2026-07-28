import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import CreatorModeForm from '@/components/profile/creator/CreatorModeForm'
import {
  CreatorSettingsLoadError,
  getCreatorSettings,
} from '@/lib/creator/getCreatorSettings'
import {
  CREATOR_MODE_COPY,
  CREATOR_ROUTES,
} from '@/lib/creator/constants'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Creator Mode | Roam',
  description:
    'Build and manage your Roam creator profile, social links, collaboration availability, public exploration map, and collections.',
  robots: {
    index: false,
    follow: false,
  },
}

export default async function CreatorSettingsPage() {
  let settings: Awaited<
    ReturnType<typeof getCreatorSettings>
  >

  try {
    settings = await getCreatorSettings()
  } catch (error) {
    if (error instanceof CreatorSettingsLoadError) {
      console.error(
        '[app/profile/creator/page] Creator settings failed to load:',
        {
          code: error.code,
          message: error.message,
        }
      )

      return (
        <CreatorSettingsLoadFailure
          message={error.message}
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
    baseProfile,
    creatorProfile,
    socialLinks,
    selectedTagIds,
    availableTags,
  } = settings

  const creatorModeEnabled =
    baseProfile.creator_mode_enabled === true

  /**
   * Fail closed.
   *
   * The exploration map is considered public only when both
   * Creator Mode and the explicit map opt-in are enabled.
   */
  const showPublicExplorationMap =
    creatorModeEnabled &&
    baseProfile.show_public_exploration_map === true

  const publicProfileHref =
    baseProfile.username
      ? CREATOR_ROUTES.publicProfile(
          baseProfile.username
        )
      : null

  return (
    <main className="min-h-screen w-full overflow-x-clip bg-black px-4 pb-16 pt-[calc(4rem+env(safe-area-inset-top)+1rem)] text-white sm:px-6">
      <div className="mx-auto w-full min-w-0 max-w-4xl">
        <CreatorSettingsHeader
          creatorModeEnabled={creatorModeEnabled}
          showPublicExplorationMap={
            showPublicExplorationMap
          }
          publicProfileHref={publicProfileHref}
        />

        <div className="mt-6 grid w-full min-w-0 gap-5">
          <CreatorModeStatusCard
            creatorModeEnabled={creatorModeEnabled}
            showPublicExplorationMap={
              showPublicExplorationMap
            }
            username={baseProfile.username}
            hasCreatorProfile={creatorProfile !== null}
            publicSocialLinkCount={
              socialLinks.filter(
                (link) => link.is_public
              ).length
            }
            collaborationTagCount={
              selectedTagIds.length
            }
          />

          <section
            aria-labelledby="creator-settings-form-title"
            className="w-full min-w-0 overflow-hidden rounded-[2rem] border border-neutral-800/90 bg-neutral-950/80 shadow-2xl shadow-black/30 backdrop-blur-xl"
          >
            <div className="border-b border-neutral-800/80 px-4 py-5 sm:px-6">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-400">
                Profile setup
              </p>

              <h2
                id="creator-settings-form-title"
                className="mt-2 text-xl font-semibold tracking-tight text-white"
              >
                Creator profile details
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
                Define how brands and collaborators see
                your creator identity, social presence,
                and availability.
              </p>
            </div>

            <div className="w-full min-w-0 p-4 sm:p-6">
              <CreatorModeForm
                settings={settings}
              />
            </div>
          </section>

          <CreatorCollectionsCard
            creatorModeEnabled={creatorModeEnabled}
          />

          <CreatorModeGuidance />
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
  creatorModeEnabled: boolean
  showPublicExplorationMap: boolean
  publicProfileHref: string | null
}) {
  return (
    <header className="w-full min-w-0">
      <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-cyan-400">
            {CREATOR_MODE_COPY.eyebrow}
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {CREATOR_MODE_COPY.setupTitle}
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">
            {CREATOR_MODE_COPY.setupDescription}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <CreatorModeBadge
              enabled={creatorModeEnabled}
            />

            <CreatorExplorationMapBadge
              enabled={
                showPublicExplorationMap
              }
            />

            <span className="text-xs text-neutral-600">
              Changes appear on your public profile
              after saving.
            </span>
          </div>
        </div>

        <nav
          aria-label="Creator settings navigation"
          className="flex shrink-0 flex-wrap gap-2"
        >
          <Link
            href="/profile"
            className="inline-flex items-center justify-center rounded-full border border-neutral-800 bg-neutral-950 px-4 py-2 text-sm font-medium text-neutral-300 transition hover:border-neutral-600 hover:bg-neutral-900 hover:text-white"
          >
            ← Profile
          </Link>

          {publicProfileHref ? (
            <Link
              href={publicProfileHref}
              className="inline-flex items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:border-cyan-400/60 hover:bg-cyan-500/20 hover:text-cyan-100"
            >
              Preview Public Profile →
            </Link>
          ) : null}
        </nav>
      </div>
    </header>
  )
}

function CreatorModeBadge({
  enabled,
}: {
  enabled: boolean
}) {
  return (
    <span
      className={[
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold',
        enabled
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
          : 'border-neutral-700 bg-neutral-900 text-neutral-400',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className={[
          'h-2 w-2 rounded-full',
          enabled
            ? 'bg-emerald-400'
            : 'bg-neutral-600',
        ].join(' ')}
      />

      {enabled
        ? 'Creator Mode active'
        : 'Creator Mode inactive'}
    </span>
  )
}

function CreatorExplorationMapBadge({
  enabled,
}: {
  enabled: boolean
}) {
  return (
    <span
      className={[
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold',
        enabled
          ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-200'
          : 'border-neutral-700 bg-neutral-900 text-neutral-500',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className={[
          'h-2 w-2 rounded-full',
          enabled
            ? 'bg-indigo-400'
            : 'bg-neutral-600',
        ].join(' ')}
      />

      {enabled
        ? 'Exploration map public'
        : 'Exploration map private'}
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
}: {
  creatorModeEnabled: boolean
  showPublicExplorationMap: boolean
  username: string | null
  hasCreatorProfile: boolean
  publicSocialLinkCount: number
  collaborationTagCount: number
}) {
  const checks = [
    {
      label: 'Username',
      complete: Boolean(username),
      detail: username
        ? `@${username}`
        : 'Required for a public profile URL',
    },
    {
      label: 'Creator details',
      complete: hasCreatorProfile,
      detail: hasCreatorProfile
        ? 'Creator profile created'
        : 'Add your creator identity',
    },
    {
      label: 'Public social links',
      complete: publicSocialLinkCount > 0,
      detail:
        publicSocialLinkCount === 1
          ? '1 public social link'
          : `${publicSocialLinkCount.toLocaleString()} public social links`,
    },
    {
      label: 'Collaboration tags',
      complete: collaborationTagCount > 0,
      detail:
        collaborationTagCount === 1
          ? '1 collaboration tag'
          : `${collaborationTagCount.toLocaleString()} collaboration tags`,
    },
  ]

  const completedCount = checks.filter(
    (check) => check.complete
  ).length

  return (
    <section className="w-full min-w-0 rounded-[1.75rem] border border-neutral-800/90 bg-gradient-to-br from-neutral-950 to-black p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">
            Setup status
          </p>

          <h2 className="mt-2 text-lg font-semibold text-white">
            {creatorModeEnabled
              ? CREATOR_MODE_COPY.activeTitle
              : CREATOR_MODE_COPY.inactiveTitle}
          </h2>

          <p className="mt-1 max-w-xl text-sm leading-6 text-neutral-400">
            {creatorModeEnabled
              ? CREATOR_MODE_COPY.activeDescription
              : CREATOR_MODE_COPY.inactiveDescription}
          </p>
        </div>

        <div className="shrink-0 rounded-2xl border border-neutral-800 bg-black/40 px-4 py-3 text-center">
          <p className="text-xl font-semibold text-white">
            {completedCount}/{checks.length}
          </p>

          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
            Ready
          </p>
        </div>
      </div>

      <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2">
        {checks.map((check) => (
          <div
            key={check.label}
            className="flex min-w-0 items-start gap-3 rounded-2xl border border-neutral-800 bg-black/25 p-3"
          >
            <span
              aria-hidden="true"
              className={[
                'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                check.complete
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : 'bg-neutral-800 text-neutral-500',
              ].join(' ')}
            >
              {check.complete ? '✓' : '·'}
            </span>

            <div className="min-w-0">
              <p className="text-sm font-medium text-neutral-200">
                {check.label}
              </p>

              <p className="mt-0.5 break-words text-xs leading-5 text-neutral-500">
                {check.detail}
              </p>
            </div>
          </div>
        ))}
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
  creatorModeEnabled: boolean
  showPublicExplorationMap: boolean
}) {
  const isPublic =
    creatorModeEnabled &&
    showPublicExplorationMap

  return (
    <div
      className={[
        'mt-4 flex min-w-0 items-start gap-3 rounded-2xl border p-3',
        isPublic
          ? 'border-indigo-500/25 bg-indigo-500/[0.07]'
          : 'border-neutral-800 bg-black/25',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className={[
          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-sm',
          isPublic
            ? 'border-indigo-500/30 bg-indigo-500/15 text-indigo-200'
            : 'border-neutral-800 bg-neutral-950 text-neutral-500',
        ].join(' ')}
      >
        🗺️
      </span>

      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-neutral-200">
            Public exploration map
          </p>

          <span
            className={[
              'rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]',
              isPublic
                ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-200'
                : 'border-neutral-700 bg-neutral-900 text-neutral-500',
            ].join(' ')}
          >
            {isPublic
              ? 'Public'
              : 'Private'}
          </span>
        </div>

        <p className="mt-1 text-xs leading-5 text-neutral-500">
          {isPublic
            ? 'Eligible venue activity can appear on your public creator profile.'
            : creatorModeEnabled
              ? 'Your eligible venue activity remains private until you explicitly publish the map.'
              : 'The exploration map cannot be public while Creator Mode is inactive.'}
        </p>
      </div>
    </div>
  )
}

/* =========================================================
 * Collections entry point
 * ======================================================= */

function CreatorCollectionsCard({
  creatorModeEnabled,
}: {
  creatorModeEnabled: boolean
}) {
  return (
    <section className="w-full min-w-0 rounded-[1.75rem] border border-neutral-800/90 bg-neutral-950/70 p-4 sm:p-5">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-400">
            Collections
          </p>

          <h2 className="mt-2 text-lg font-semibold text-white">
            Curate your local point of view
          </h2>

          <p className="mt-1 max-w-xl text-sm leading-6 text-neutral-400">
            Build shareable collections of venues,
            properties, flows, and snapshots that
            demonstrate your taste and local authority.
          </p>

          {!creatorModeEnabled ? (
            <p className="mt-2 text-xs leading-5 text-amber-300/80">
              Collections can be prepared while Creator
              Mode is inactive, but they will not appear
              publicly until Creator Mode is enabled.
            </p>
          ) : null}
        </div>

        <Link
          href={CREATOR_ROUTES.collections}
          className="inline-flex shrink-0 items-center justify-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-2.5 text-sm font-semibold text-indigo-200 transition hover:border-indigo-400/60 hover:bg-indigo-500/20 hover:text-white"
        >
          Manage Collections →
        </Link>
      </div>
    </section>
  )
}

/* =========================================================
 * Product guidance
 * ======================================================= */

function CreatorModeGuidance() {
  return (
    <aside className="w-full min-w-0 rounded-[1.75rem] border border-neutral-800/80 bg-black/30 p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">
        What makes a strong profile
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <GuidanceItem
          number="01"
          title="Be specific"
          description="Name the cities, industries, and content formats you actually work in."
        />

        <GuidanceItem
          number="02"
          title="Show proof"
          description="Use real Roam activity, your optional exploration map, and collections instead of vague authority claims."
        />

        <GuidanceItem
          number="03"
          title="Make contact easy"
          description="Keep at least one public social profile current and clearly visible."
        />
      </div>
    </aside>
  )
}

function GuidanceItem({
  number,
  title,
  description,
}: {
  number: string
  title: string
  description: string
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-neutral-800 bg-neutral-950/70 p-4">
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
  message: string
}) {
  return (
    <main className="min-h-screen w-full overflow-x-clip bg-black px-4 pb-16 pt-[calc(4rem+env(safe-area-inset-top)+1rem)] text-white sm:px-6">
      <div className="mx-auto w-full max-w-2xl">
        <section
          role="alert"
          className="rounded-[2rem] border border-red-900/60 bg-red-950/20 p-5 sm:p-6"
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

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href={CREATOR_ROUTES.settings}
              className="inline-flex items-center justify-center rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-400"
            >
              Try Again
            </Link>

            <Link
              href="/profile"
              className="inline-flex items-center justify-center rounded-full border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-300 transition hover:border-neutral-500 hover:text-white"
            >
              Back to Profile
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}