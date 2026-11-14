
export type CreatorReadinessInput = {
  username: string | null
  hasCreatorProfile: boolean
  publicSocialLinkCount: number
  collaborationTagCount: number
  reputationFound: boolean
}

export type CreatorReadinessCheck = {
  key:
    | 'publicLink'
    | 'creatorStory'
    | 'contactLinks'
    | 'collaborations'
    | 'roamReputation'
  complete: boolean
}

export function calculateCreatorReadiness(
  input: CreatorReadinessInput
) {
  const checks: CreatorReadinessCheck[] = [
    {
      key: 'publicLink',
      complete: Boolean(input.username),
    },
    {
      key: 'creatorStory',
      complete: input.hasCreatorProfile,
    },
    {
      key: 'contactLinks',
      complete: input.publicSocialLinkCount > 0,
    },
    {
      key: 'collaborations',
      complete: input.collaborationTagCount > 0,
    },
    {
      key: 'roamReputation',
      complete: input.reputationFound,
    },
  ]

  const completedCount = checks.filter(
    (check) => check.complete
  ).length

  return {
    checks,
    completedCount,
    requiredCount: 5 as const,
    ready: completedCount === 5,
  }
}
