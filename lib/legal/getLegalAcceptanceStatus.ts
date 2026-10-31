
import 'server-only'

import type { User } from '@supabase/supabase-js'

import { createServerClient } from '@/lib/supabase/server'
import { getLegalAcceptanceConfig } from '@/lib/legal/config'

export type LegalAcceptanceStatus = {
  required: boolean
  accepted: boolean
  grandfathered: boolean
  termsVersion: string
  guidelinesVersion: string
}

export async function getLegalAcceptanceStatus(
  user: Pick<User, 'id' | 'created_at'>
): Promise<LegalAcceptanceStatus> {
  const {
    rolloutCutoff,
    policyVersions,
  } = getLegalAcceptanceConfig()

  const accountCreatedAt =
    new Date(user.created_at)

  if (
    !Number.isFinite(
      accountCreatedAt.getTime()
    )
  ) {
    throw new Error(
      '[legal] Authenticated user has an invalid account creation timestamp.'
    )
  }

  const grandfathered =
    accountCreatedAt.getTime() <
    rolloutCutoff.getTime()

  if (grandfathered) {
    return {
      required: false,
      accepted: true,
      grandfathered: true,
      termsVersion:
        policyVersions.termsVersion,
      guidelinesVersion:
        policyVersions.guidelinesVersion,
    }
  }

  const supabase =
    await createServerClient()

  const {
    data: acceptance,
    error,
  } =
    await supabase
      .from('user_legal_acceptances')
      .select('id')
      .eq('user_id', user.id)
      .eq(
        'terms_version',
        policyVersions.termsVersion
      )
      .eq(
        'guidelines_version',
        policyVersions.guidelinesVersion
      )
      .limit(1)
      .maybeSingle()

  if (error) {
    console.error(
      '[legal] Failed to verify legal acceptance:',
      {
        code: error.code,
        message: error.message,
      }
    )

    throw new Error(
      '[legal] Legal acceptance verification failed.'
    )
  }

  const accepted =
    Boolean(acceptance)

  return {
    required: !accepted,
    accepted,
    grandfathered: false,
    termsVersion:
      policyVersions.termsVersion,
    guidelinesVersion:
      policyVersions.guidelinesVersion,
  }
}
