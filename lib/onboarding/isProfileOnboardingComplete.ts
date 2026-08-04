// lib/onboarding/isProfileOnboardingComplete.ts

import type { Database } from '@/types/supabase'

type ProfileRow =
  Database['public']['Tables']['profiles']['Row']

/**
 * The smallest profile shape required to determine whether universal
 * profile onboarding is complete.
 *
 * Keep this list synchronized with the required fields enforced by:
 *
 * - app/onboarding/profile/page.tsx
 * - app/api/profile/onboarding/route.ts
 *
 * Do not add creator-specific fields here. Creator onboarding is evaluated
 * separately through creator_onboarding_completed_at.
 */
export type ProfileOnboardingCompletionInput = Pick<
  ProfileRow,
  | 'full_name'
  | 'username'
  | 'home_neighborhood'
  | 'preferred_vibes'
  | 'interest_categories'
  | 'deleted_at'
>

export type ProfileOnboardingRequirement =
  | 'full_name'
  | 'username'
  | 'home_neighborhood'
  | 'preferred_vibes'
  | 'interest_categories'

export type ProfileOnboardingCompletionResult = {
  complete: boolean
  missingRequirements: ProfileOnboardingRequirement[]
}

/**
 * Canonical profile-onboarding requirements.
 *
 * This is intentionally separate from:
 *
 * - has_seen_roam_intro
 * - onboarding_path
 * - creator_onboarding_completed_at
 * - creator_mode_enabled
 *
 * Those fields represent other stages of the onboarding lifecycle.
 */
export function evaluateProfileOnboardingCompletion(
  profile: ProfileOnboardingCompletionInput | null | undefined
): ProfileOnboardingCompletionResult {
  if (!profile || profile.deleted_at !== null) {
    return {
      complete: false,
      missingRequirements: [
        'full_name',
        'username',
        'home_neighborhood',
        'preferred_vibes',
        'interest_categories',
      ],
    }
  }

  const missingRequirements: ProfileOnboardingRequirement[] = []

  if (!hasMeaningfulText(profile.full_name)) {
    missingRequirements.push('full_name')
  }

  if (!hasValidUsername(profile.username)) {
    missingRequirements.push('username')
  }

  if (!hasMeaningfulText(profile.home_neighborhood)) {
    missingRequirements.push('home_neighborhood')
  }

  if (!hasMeaningfulStringArray(profile.preferred_vibes)) {
    missingRequirements.push('preferred_vibes')
  }

  if (!hasMeaningfulStringArray(profile.interest_categories)) {
    missingRequirements.push('interest_categories')
  }

  return {
    complete: missingRequirements.length === 0,
    missingRequirements,
  }
}

/**
 * Returns whether the user's universal Roam profile onboarding is complete.
 *
 * Use this boolean helper for routing decisions.
 */
export function isProfileOnboardingComplete(
  profile: ProfileOnboardingCompletionInput | null | undefined
): boolean {
  return evaluateProfileOnboardingCompletion(profile).complete
}

function hasMeaningfulText(
  value: string | null | undefined
): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0
  )
}

/**
 * The database should remain the final authority for username constraints.
 * This check only prevents blank or obviously malformed usernames from being
 * treated as completed onboarding data.
 */
function hasValidUsername(
  value: string | null | undefined
): value is string {
  if (!hasMeaningfulText(value)) {
    return false
  }

  const normalized = value.trim()

  return (
    normalized.length >= 2 &&
    normalized.length <= 30 &&
    /^[a-zA-Z0-9_]+$/.test(normalized)
  )
}

function hasMeaningfulStringArray(
  value: string[] | null | undefined
): value is string[] {
  return (
    Array.isArray(value) &&
    value.some(
      (item) =>
        typeof item === 'string' &&
        item.trim().length > 0
    )
  )
}