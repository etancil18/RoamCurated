// app/onboarding/page.tsx

import type { Metadata } from 'next'

import Link from 'next/link'

import { redirect } from 'next/navigation'

import { createServerClient } from '@/lib/supabase/server'
import { logEvent } from '@/lib/logEvent'

import {
  evaluateOnboardingNextPath,
  isOnboardingPath,
  type OnboardingPath,
} from '@/lib/onboarding/getOnboardingNextPath'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Choose Your Path | Roam',

  description:
    'Choose how you want to begin using Roam: explore your city or start building your creator identity.',

  robots: {
    index: false,
    follow: false,
  },
}

const PROFILE_ROUTING_COLUMNS = `
  full_name,
  username,
  home_neighborhood,
  preferred_vibes,
  interest_categories,
  deleted_at,
  has_seen_roam_intro,
  onboarding_path,
  creator_onboarding_completed_at
` as const

type OnboardingPageProps = {
  searchParams?: Promise<{
    error?: string | string[]
  }>
}

/* =========================================================
 * Page
 * ======================================================= */

export default async function OnboardingPathPage({
  searchParams,
}: OnboardingPageProps) {
  const resolvedSearchParams =
    searchParams
      ? await searchParams
      : undefined

  const errorCode = getFirstSearchParam(
    resolvedSearchParams?.error
  )

  const supabase =
    await createServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect(
      `/login?next=${encodeURIComponent(
        '/onboarding'
      )}`
    )
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from('profiles')
    .select(PROFILE_ROUTING_COLUMNS)
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error(
      '[app/onboarding/page] Failed to load onboarding profile:',
      {
        userId: user.id,
        code: profileError.code,
        message: profileError.message,
        details: profileError.details,
        hint: profileError.hint,
      }
    )

    return (
      <OnboardingLoadFailure />
    )
  }

  if (!profile) {
    console.error(
      '[app/onboarding/page] Authenticated user has no profile row:',
      {
        userId: user.id,
      }
    )

    return (
      <OnboardingLoadFailure
        message="Your Roam profile could not be found. Please try signing out and back in."
      />
    )
  }

  const routing =
    evaluateOnboardingNextPath(
      profile
    )

  /**
   * This page is only a chooser while no path has been selected.
   *
   * Every other state is routed through the canonical onboarding state
   * machine rather than reconstructing navigation rules in this page.
   */
  if (
    routing.reason !==
    'onboarding_path_required'
  ) {
    redirect(routing.nextPath)
  }

  const pageError =
    getPageErrorMessage(errorCode)

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#05060a] text-white">
      <BackgroundEffects />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <header className="mx-auto max-w-3xl text-center">
          <div className="relative mx-auto mb-8 flex h-24 w-24 items-center justify-center">
            <div className="absolute inset-0 rounded-[1.75rem] bg-gradient-to-br from-cyan-400 via-indigo-500 to-fuchsia-500 opacity-70 blur-2xl" />

            <div className="absolute inset-0 rounded-[1.75rem] border border-white/15 bg-white/10 shadow-2xl backdrop-blur-xl" />

            <div className="absolute h-32 w-32 rounded-full border border-cyan-300/15" />

            <div className="relative flex h-16 w-16 items-center justify-center rounded-[1.25rem] border border-white/20 bg-black/45 shadow-2xl backdrop-blur-xl">
              <img
                src="/favicon-new.ico"
                alt="Roam"
                className="h-9 w-9 rounded-lg"
              />
            </div>
          </div>

          <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-300 sm:text-sm">
            Choose your starting path
          </p>

          <h1 className="mt-5 text-4xl font-black leading-[0.98] tracking-tight sm:text-6xl">
            What do you want Roam to
            become for you?
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-neutral-300 sm:text-lg sm:leading-8">
            Explore your city as a player
            or begin building a creator
            identity around the places and
            experiences you genuinely know.
          </p>
        </header>

        {pageError ? (
          <div
            role="alert"
            className="mx-auto mt-8 w-full max-w-3xl rounded-2xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200"
          >
            {pageError}
          </div>
        ) : null}

        <section
          aria-label="Choose an onboarding path"
          className="mx-auto mt-10 grid w-full max-w-5xl gap-5 lg:grid-cols-2"
        >
          <OnboardingPathCard
            path="explorer"
            eyebrow="Explore Roam"
            title="Make your city playable"
            description="Discover places, build Flows, check in, earn Passport progress, and save the experiences you love."
            highlights={[
              'Build your Roam Passport',
              'Discover and save places',
              'Create routes with friends',
            ]}
            buttonLabel="Start exploring"
            accent="cyan"
          />

          <OnboardingPathCard
            path="creator"
            eyebrow="Build as a creator"
            title="Turn your taste into a public point of view"
            description="Capture your local knowledge, curate collections, and build a creator profile around places you genuinely understand."
            highlights={[
              'Complete your Roam profile',
              'Capture your creator knowledge',
              'Publish maps and collections',
            ]}
            buttonLabel="Start creator setup"
            accent="indigo"
            recommended
          />
        </section>

        <div className="mx-auto mt-8 max-w-3xl text-center">
          <p className="text-xs leading-6 text-neutral-500">
            This choice only changes your
            onboarding journey. It does not
            permanently limit your account,
            and Creator Mode can be enabled
            or disabled later.
          </p>

          <Link
            href="/welcome"
            className="mt-5 inline-flex min-h-10 items-center justify-center rounded-full px-4 py-2 text-xs font-semibold text-neutral-500 transition hover:text-neutral-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <span
              aria-hidden="true"
              className="mr-2"
            >
              ←
            </span>

            Back to welcome
          </Link>
        </div>
      </div>
    </main>
  )
}

/* =========================================================
 * Server action
 * ======================================================= */

async function selectOnboardingPath(
  formData: FormData
) {
  'use server'

  const submittedPath =
    formData.get('path')

  if (
    !isOnboardingPath(
      submittedPath
    )
  ) {
    redirect(
      '/onboarding?error=invalid_path'
    )
  }

  const selectedPath:
    OnboardingPath =
      submittedPath

  const supabase =
    await createServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect(
      `/login?next=${encodeURIComponent(
        '/onboarding'
      )}`
    )
  }

  const selectedAt =
    new Date().toISOString()

  const {
    data: updatedProfile,
    error: updateError,
  } = await supabase
    .from('profiles')
    .update({
      onboarding_path:
        selectedPath,

      onboarding_path_selected_at:
        selectedAt,
    })
    .eq('id', user.id)
    .is('deleted_at', null)
    .select(
      PROFILE_ROUTING_COLUMNS
    )
    .maybeSingle()

  if (updateError) {
    console.error(
      '[app/onboarding/page] Failed to save onboarding path:',
      {
        userId: user.id,
        selectedPath,
        code: updateError.code,
        message:
          updateError.message,
        details:
          updateError.details,
        hint:
          updateError.hint,
      }
    )

    redirect(
      '/onboarding?error=selection_failed'
    )
  }

  if (!updatedProfile) {
    console.error(
      '[app/onboarding/page] Onboarding path update returned no profile:',
      {
        userId: user.id,
        selectedPath,
      }
    )

    redirect(
      '/onboarding?error=profile_missing'
    )
  }

  const routing =
    evaluateOnboardingNextPath(
      updatedProfile
    )

  /**
   * A valid selected path should always move the user beyond the chooser.
   * Fail closed rather than creating a redirect loop if the returned row is
   * unexpectedly inconsistent.
   */
  if (
    routing.nextPath ===
    '/onboarding'
  ) {
    console.error(
      '[app/onboarding/page] Selected onboarding path did not advance routing:',
      {
        userId: user.id,
        selectedPath,
        routing,
      }
    )

    redirect(
      '/onboarding?error=selection_failed'
    )
  }

  await safeLogOnboardingEvent(
    'onboarding_path_selected',
    {
      user_id: user.id,
      selected_path: selectedPath,
      selected_at: selectedAt,
      destination: routing.nextPath,
      source: 'onboarding_path_chooser',
    }
  )

  redirect(routing.nextPath)
}

/* =========================================================
 * Path card
 * ======================================================= */

function OnboardingPathCard({
  path,
  eyebrow,
  title,
  description,
  highlights,
  buttonLabel,
  accent,
  recommended = false,
}: {
  path: OnboardingPath
  eyebrow: string
  title: string
  description: string
  highlights: readonly string[]
  buttonLabel: string
  accent:
    | 'cyan'
    | 'indigo'
  recommended?: boolean
}) {
  const isCreator =
    accent === 'indigo'

  return (
    <form
      action={
        selectOnboardingPath
      }
      className="group min-w-0"
    >
      <input
        type="hidden"
        name="path"
        value={path}
      />

      <button
        type="submit"
        className={[
          'relative flex h-full w-full min-w-0 flex-col overflow-hidden rounded-[2rem] border p-5 text-left shadow-2xl backdrop-blur-xl transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#05060a] sm:p-7',

          isCreator
            ? 'border-indigo-400/30 bg-gradient-to-br from-indigo-500/[0.16] via-white/[0.07] to-black/40 hover:-translate-y-1 hover:border-indigo-300/55 focus-visible:ring-indigo-400'
            : 'border-cyan-400/25 bg-gradient-to-br from-cyan-500/[0.12] via-white/[0.07] to-black/40 hover:-translate-y-1 hover:border-cyan-300/50 focus-visible:ring-cyan-400',
        ].join(' ')}
      >
        <div
          aria-hidden="true"
          className={[
            'pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent',

            isCreator
              ? 'via-indigo-300/80'
              : 'via-cyan-300/70',
          ].join(' ')}
        />

        <div
          aria-hidden="true"
          className={[
            'pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full blur-3xl transition duration-300 group-hover:opacity-100',

            isCreator
              ? 'bg-indigo-500/20'
              : 'bg-cyan-500/15',
          ].join(' ')}
        />

        <div className="relative z-10 flex h-full w-full min-w-0 flex-col">
          <div className="flex min-w-0 items-start justify-between gap-4">
            <div
              className={[
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-xl shadow-lg',

                isCreator
                  ? 'border-indigo-400/30 bg-indigo-500/15 text-indigo-100'
                  : 'border-cyan-400/30 bg-cyan-500/15 text-cyan-100',
              ].join(' ')}
            >
              {isCreator
                ? '✦'
                : '⌖'}
            </div>

            {recommended ? (
              <span className="rounded-full border border-indigo-400/30 bg-indigo-500/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-200">
                Creator path
              </span>
            ) : null}
          </div>

          <p
            className={[
              'mt-6 text-xs font-bold uppercase tracking-[0.24em]',

              isCreator
                ? 'text-indigo-300'
                : 'text-cyan-300',
            ].join(' ')}
          >
            {eyebrow}
          </p>

          <h2 className="mt-3 text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl">
            {title}
          </h2>

          <p className="mt-4 text-sm leading-7 text-neutral-300">
            {description}
          </p>

          <div className="mt-6 space-y-3">
            {highlights.map(
              (highlight) => (
                <div
                  key={highlight}
                  className="flex items-start gap-3"
                >
                  <span
                    aria-hidden="true"
                    className={[
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black',

                      isCreator
                        ? 'bg-indigo-400/15 text-indigo-200'
                        : 'bg-cyan-400/15 text-cyan-200',
                    ].join(' ')}
                  >
                    ✓
                  </span>

                  <span className="text-sm leading-5 text-neutral-400">
                    {highlight}
                  </span>
                </div>
              )
            )}
          </div>

          {isCreator ? (
            <div className="mt-6 rounded-2xl border border-indigo-400/15 bg-black/25 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-300">
                Two-part setup
              </p>

              <div className="mt-3 grid gap-2 text-xs text-neutral-400 sm:grid-cols-2">
                <span className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                  1. Build your Passport
                </span>

                <span className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                  2. Capture your point of view
                </span>
              </div>
            </div>
          ) : null}

          <span
            className={[
              'mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-2xl px-5 py-3 text-sm font-black transition sm:w-fit',

              isCreator
                ? 'bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/20 group-hover:from-indigo-400 group-hover:to-fuchsia-400'
                : 'bg-gradient-to-r from-cyan-400 to-indigo-500 text-black shadow-lg shadow-cyan-500/20 group-hover:from-cyan-300 group-hover:to-indigo-400',
            ].join(' ')}
          >
            {buttonLabel}

            <span
              aria-hidden="true"
              className="ml-2 transition-transform group-hover:translate-x-1"
            >
              →
            </span>
          </span>
        </div>
      </button>
    </form>
  )
}

/* =========================================================
 * Background
 * ======================================================= */

function BackgroundEffects() {
  return (
    <>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(99,102,241,0.24),_transparent_32%),radial-gradient(circle_at_bottom_center,_rgba(217,70,239,0.12),_transparent_34%),linear-gradient(135deg,_#05060a_0%,_#09090f_48%,_#020617_100%)]" />

      <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.7)_1px,transparent_1px)] [background-size:44px_44px]" />

      <div className="pointer-events-none absolute left-1/2 top-[12%] h-[28rem] w-[28rem] -translate-x-1/2 rounded-full border border-white/[0.04]" />

      <div className="pointer-events-none absolute left-1/2 top-[8%] h-[38rem] w-[38rem] -translate-x-1/2 rounded-full border border-white/[0.025]" />
    </>
  )
}

/* =========================================================
 * Failure state
 * ======================================================= */

function OnboardingLoadFailure({
  message = 'Roam could not load your onboarding status. Please try again.',
}: {
  message?: string
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#05060a] px-4 text-white">
      <section
        role="alert"
        className="w-full max-w-lg rounded-[2rem] border border-red-500/30 bg-red-950/25 p-6 shadow-2xl"
      >
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-red-400">
          Onboarding unavailable
        </p>

        <h1 className="mt-3 text-2xl font-bold text-white">
          We could not prepare your next step
        </h1>

        <p className="mt-3 text-sm leading-6 text-red-100/75">
          {message}
        </p>

        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <Link
            href="/onboarding"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-400"
          >
            Try again
          </Link>

          <Link
            href="/profile"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-neutral-700 bg-black/25 px-4 py-2.5 text-sm font-medium text-neutral-300 transition hover:border-neutral-500 hover:text-white"
          >
            Go to profile
          </Link>
        </div>
      </section>
    </main>
  )
}

/* =========================================================
 * Analytics
 * ======================================================= */

async function safeLogOnboardingEvent(
  eventName: string,
  metadata: Record<string, unknown>
) {
  try {
    await Promise.resolve(
      logEvent(eventName, {
        metadata,
      })
    )
  } catch (error) {
    console.warn(
      '[app/onboarding/page] Analytics logging failed:',
      error
    )
  }
}

/* =========================================================
 * Utilities
 * ======================================================= */

function getFirstSearchParam(
  value:
    | string
    | string[]
    | undefined
): string | null {
  if (
    typeof value === 'string'
  ) {
    return value
  }

  if (
    Array.isArray(value)
  ) {
    return value[0] ?? null
  }

  return null
}

function getPageErrorMessage(
  code: string | null
): string | null {
  switch (code) {
    case 'invalid_path':
      return 'Choose one of the available onboarding paths.'

    case 'profile_missing':
      return 'Your profile could not be updated. Please sign out and try again.'

    case 'selection_failed':
      return 'Your selection could not be saved. Please try again.'

    default:
      return null
  }
}