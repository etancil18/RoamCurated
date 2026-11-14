
import 'server-only'

import {
  getCreatorSettings,
} from '@/lib/creator/getCreatorSettings'

import {
  calculateCreatorReadiness,
} from '@/lib/creator/creatorReadiness'

import {
  getPublicCreatorReputation,
} from '@/lib/reputation/getPublicCreatorReputation'

import {
  createServerClient,
} from '@/lib/supabase/server'

export type CreatorSuggestionEligibility = {
  userId: string | null
  creatorModeEnabled: boolean
  completedCount: number
  ready: boolean
  hasPublicCollection: boolean
  canSuggestInCollection: boolean
  canSuggestStandalone: boolean
}

export async function getCreatorSuggestionEligibility():
  Promise<CreatorSuggestionEligibility> {

  const settings = await getCreatorSettings()

  if (!settings) {
    return {
      userId: null,
      creatorModeEnabled: false,
      completedCount: 0,
      ready: false,
      hasPublicCollection: false,
      canSuggestInCollection: false,
      canSuggestStandalone: false,
    }
  }

  const reputationResult =
    await getPublicCreatorReputation(
      settings.userId,
      {
        includeUnranked: true,
        includeGlobal: true,
        includeCity: true,
      }
    )

  const readiness = calculateCreatorReadiness({
    username: settings.baseProfile.username,
    hasCreatorProfile:
      settings.creatorProfile !== null,
    publicSocialLinkCount:
      settings.socialLinks.filter(
        (link) => link.is_public
      ).length,
    collaborationTagCount:
      settings.selectedTagIds.length,
    reputationFound:
      reputationResult.found,
  })

  const creatorModeEnabled =
    settings.baseProfile.creator_mode_enabled

  const canSuggestInCollection =
    creatorModeEnabled && readiness.ready

  let hasPublicCollection = false

  // The standalone check is needed only after
  // the core eligibility requirements pass.
  if (canSuggestInCollection) {
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('creator_collections')
      .select('id')
      .eq('user_id', settings.userId)
      .eq('visibility', 'public')
      .limit(1)

    if (error) {
      throw new Error(
        'Could not verify public collection eligibility.'
      )
    }

    hasPublicCollection = (data?.length ?? 0) > 0
  }

  return {
    userId: settings.userId,
    creatorModeEnabled,
    completedCount: readiness.completedCount,
    ready: readiness.ready,
    hasPublicCollection,
    canSuggestInCollection,
    canSuggestStandalone:
      canSuggestInCollection && hasPublicCollection,
  }
}
