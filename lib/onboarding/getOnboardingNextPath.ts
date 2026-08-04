// lib/onboarding/getOnboardingNextPath.ts

import type { Database } from '@/types/supabase'

import {
  evaluateProfileOnboardingCompletion,
  type ProfileOnboardingCompletionInput,
  type ProfileOnboardingRequirement,
} from './isProfileOnboardingComplete'

type ProfileRow =
  Database['public']['Tables']['profiles']['Row']

export const ONBOARDING_PATHS = [
  'explorer',
  'creator',
] as const

export type OnboardingPath =
  (typeof ONBOARDING_PATHS)[number]

export const ONBOARDING_DESTINATIONS = {
  welcome: '/welcome',
  chooser: '/onboarding',
  profile: '/onboarding/profile',
  creator: '/onboarding/creator',
  explorerComplete: '/profile',
  creatorComplete: '/profile/creator',
} as const

export type OnboardingDestination =
  (typeof ONBOARDING_DESTINATIONS)[keyof typeof ONBOARDING_DESTINATIONS]

export type OnboardingNextPathReason =
  | 'roam_intro_required'
  | 'onboarding_path_required'
  | 'profile_onboarding_required'
  | 'creator_onboarding_required'
  | 'explorer_onboarding_complete'
  | 'creator_onboarding_complete'

export type OnboardingRoutingProfile =
  ProfileOnboardingCompletionInput &
    Pick<
      ProfileRow,
      | 'has_seen_roam_intro'
      | 'onboarding_path'
      | 'creator_onboarding_completed_at'
    >

export type OnboardingRoutingResult = {
  nextPath: string
  reason: OnboardingNextPathReason

  onboardingPath: OnboardingPath | null

  hasSeenRoamIntro: boolean
  profileCompleted: boolean
  creatorOnboardingCompleted: boolean

  missingProfileRequirements:
    ProfileOnboardingRequirement[]
}

/**
 * Returns the canonical destination for an authenticated Roam user.
 *
 * Routing order:
 *
 * 1. Roam introduction
 * 2. Onboarding path selection
 * 3. Universal profile onboarding
 * 4. Creator-specific onboarding, when selected
 * 5. Final profile destination
 *
 * This function does not perform redirects and does not access Supabase.
 * It is safe to use from Server Components, route handlers, and services.
 */
export function getOnboardingNextPath(
  profile: OnboardingRoutingProfile
): string {
  return evaluateOnboardingNextPath(profile).nextPath
}

/**
 * Returns the destination plus the state and reason behind the decision.
 *
 * Use this form in APIs or diagnostics where the frontend needs more than
 * the final URL.
 */
export function evaluateOnboardingNextPath(
  profile: OnboardingRoutingProfile
): OnboardingRoutingResult {
  const onboardingPath =
    normalizeOnboardingPath(
      profile.onboarding_path
    )

  const profileCompletion =
    evaluateProfileOnboardingCompletion(
      profile
    )

  const hasSeenRoamIntro =
    profile.has_seen_roam_intro === true

  const creatorOnboardingCompleted =
    hasCompletedCreatorOnboarding(
      profile.creator_onboarding_completed_at
    )

  if (!hasSeenRoamIntro) {
    return createResult({
      nextPath:
        ONBOARDING_DESTINATIONS.welcome,

      reason:
        'roam_intro_required',

      onboardingPath,
      hasSeenRoamIntro,
      profileCompleted:
        profileCompletion.complete,
      creatorOnboardingCompleted,

      missingProfileRequirements:
        profileCompletion.missingRequirements,
    })
  }

  if (!onboardingPath) {
    return createResult({
      nextPath:
        ONBOARDING_DESTINATIONS.chooser,

      reason:
        'onboarding_path_required',

      onboardingPath: null,
      hasSeenRoamIntro,
      profileCompleted:
        profileCompletion.complete,
      creatorOnboardingCompleted,

      missingProfileRequirements:
        profileCompletion.missingRequirements,
    })
  }

  if (!profileCompletion.complete) {
    const nextAfterProfile =
      onboardingPath === 'creator'
        ? ONBOARDING_DESTINATIONS.creator
        : ONBOARDING_DESTINATIONS.explorerComplete

    return createResult({
      nextPath:
        buildProfileOnboardingPath(
          nextAfterProfile
        ),

      reason:
        'profile_onboarding_required',

      onboardingPath,
      hasSeenRoamIntro,
      profileCompleted: false,
      creatorOnboardingCompleted,

      missingProfileRequirements:
        profileCompletion.missingRequirements,
    })
  }

  if (
    onboardingPath === 'creator' &&
    !creatorOnboardingCompleted
  ) {
    return createResult({
      nextPath:
        ONBOARDING_DESTINATIONS.creator,

      reason:
        'creator_onboarding_required',

      onboardingPath,
      hasSeenRoamIntro,
      profileCompleted: true,
      creatorOnboardingCompleted: false,

      missingProfileRequirements: [],
    })
  }

  if (onboardingPath === 'creator') {
    return createResult({
      nextPath:
        ONBOARDING_DESTINATIONS.creatorComplete,

      reason:
        'creator_onboarding_complete',

      onboardingPath,
      hasSeenRoamIntro,
      profileCompleted: true,
      creatorOnboardingCompleted: true,

      missingProfileRequirements: [],
    })
  }

  return createResult({
    nextPath:
      ONBOARDING_DESTINATIONS.explorerComplete,

    reason:
      'explorer_onboarding_complete',

    onboardingPath,
    hasSeenRoamIntro,
    profileCompleted: true,
    creatorOnboardingCompleted,

    missingProfileRequirements: [],
  })
}

/**
 * Builds a validated profile-onboarding URL with a server-controlled
 * destination.
 *
 * Never place an arbitrary browser-provided URL into this function.
 */
export function buildProfileOnboardingPath(
  nextPath:
    | typeof ONBOARDING_DESTINATIONS.creator
    | typeof ONBOARDING_DESTINATIONS.explorerComplete
): string {
  return `${ONBOARDING_DESTINATIONS.profile}?next=${encodeURIComponent(
    nextPath
  )}`
}

/**
 * Runtime guard for values loaded from the database or received from an API.
 *
 * Unknown values fail closed and are treated as no path selection.
 */
export function isOnboardingPath(
  value: unknown
): value is OnboardingPath {
  return (
    typeof value === 'string' &&
    (
      ONBOARDING_PATHS as readonly string[]
    ).includes(value)
  )
}

/**
 * Converts nullable or potentially invalid database values into the
 * canonical application union.
 */
export function normalizeOnboardingPath(
  value: unknown
): OnboardingPath | null {
  return isOnboardingPath(value)
    ? value
    : null
}

function hasCompletedCreatorOnboarding(
  value: string | null | undefined
): boolean {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0
  ) {
    return false
  }

  return !Number.isNaN(
    Date.parse(value)
  )
}

function createResult({
  nextPath,
  reason,
  onboardingPath,
  hasSeenRoamIntro,
  profileCompleted,
  creatorOnboardingCompleted,
  missingProfileRequirements,
}: OnboardingRoutingResult): OnboardingRoutingResult {
  return {
    nextPath,
    reason,
    onboardingPath,
    hasSeenRoamIntro,
    profileCompleted,
    creatorOnboardingCompleted,
    missingProfileRequirements,
  }
}