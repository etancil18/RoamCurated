
/* =========================================================
 * Roam legal acceptance configuration
 *
 * Server-only. Do not import into client components.
 *
 * The rollout cutoff must remain fixed after launch.
 * Changing it retroactively changes who is grandfathered.
 * ======================================================= */

import 'server-only'

export type LegalAcceptanceContext =
  | 'email_signup'
  | 'google_onboarding'
  | 'legal_onboarding'

export type CurrentLegalPolicyVersions = {
  termsVersion: string
  guidelinesVersion: string
}

export type LegalAcceptanceConfig = {
  rolloutCutoff: Date
  policyVersions: CurrentLegalPolicyVersions
}

function requireConfiguration(
  name: string
): string {
  const value =
    process.env[name]?.trim()

  if (!value) {
    throw new Error(
      `[legal] Missing required server configuration: ${name}`
    )
  }

  return value
}

export function getLegalAcceptanceConfig():
  LegalAcceptanceConfig {
  const cutoffValue =
    requireConfiguration(
      'ROAM_LEGAL_ROLLOUT_CUTOFF'
    )

  const rolloutCutoff =
    new Date(cutoffValue)

  if (
    !Number.isFinite(
      rolloutCutoff.getTime()
    ) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      cutoffValue
    )
  ) {
    throw new Error(
      '[legal] ROAM_LEGAL_ROLLOUT_CUTOFF must be a valid ISO 8601 timestamp with a timezone.'
    )
  }

  return {
    rolloutCutoff,
    policyVersions: {
      termsVersion:
        requireConfiguration(
          'ROAM_TERMS_VERSION'
        ),

      guidelinesVersion:
        requireConfiguration(
          'ROAM_GUIDELINES_VERSION'
        ),
    },
  }
}
